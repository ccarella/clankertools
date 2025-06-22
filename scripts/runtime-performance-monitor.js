#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const USER_FLOWS = {
  'token-creation': {
    name: 'Token Creation Flow',
    steps: [
      { action: 'goto', url: 'http://localhost:3000/create-token' },
      { action: 'waitForSelector', selector: 'form' },
      { action: 'type', selector: 'input[name="name"]', text: 'Test Token' },
      { action: 'type', selector: 'input[name="ticker"]', text: 'TEST' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'waitForSelector', selector: '.success-message', timeout: 10000 }
    ]
  },
  'wallet-connection': {
    name: 'Wallet Connection Flow',
    steps: [
      { action: 'goto', url: 'http://localhost:3000' },
      { action: 'waitForSelector', selector: '.connect-wallet' },
      { action: 'click', selector: '.connect-wallet' },
      { action: 'waitForSelector', selector: '.wallet-modal' }
    ]
  },
  'page-navigation': {
    name: 'Page Navigation Flow',
    steps: [
      { action: 'goto', url: 'http://localhost:3000' },
      { action: 'waitForSelector', selector: 'nav' },
      { action: 'click', selector: 'a[href="/profile"]' },
      { action: 'waitForNavigation' },
      { action: 'click', selector: 'a[href="/create-token"]' },
      { action: 'waitForNavigation' }
    ]
  }
};

const monitorRuntimePerformance = async (url, options = {}) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable performance monitoring
    await page.evaluateOnNewDocument(() => {
      window.__performanceMetrics = {
        marks: [],
        measures: []
      };
      
      // Override performance.mark and performance.measure
      const originalMark = performance.mark.bind(performance);
      const originalMeasure = performance.measure.bind(performance);
      
      performance.mark = function(name) {
        window.__performanceMetrics.marks.push({
          name,
          time: performance.now()
        });
        return originalMark(name);
      };
      
      performance.measure = function(name, startMark, endMark) {
        const measure = originalMeasure(name, startMark, endMark);
        window.__performanceMetrics.measures.push({
          name,
          duration: performance.getEntriesByName(name, 'measure')[0]?.duration || 0
        });
        return measure;
      };
    });
    
    // Collect performance observer data
    await page.evaluateOnNewDocument(() => {
      window.__webVitals = {};
      
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            window.__webVitals.LCP = entry.renderTime || entry.loadTime;
          }
          if (entry.entryType === 'first-input' && entry.name === 'first-input') {
            window.__webVitals.FID = entry.processingStart - entry.startTime;
          }
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            window.__webVitals.CLS = (window.__webVitals.CLS || 0) + entry.value;
          }
        }
      }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    });
    
    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Wait for any async operations
    await page.waitForTimeout(2000);
    
    // Collect metrics
    const metrics = await page.metrics();
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      
      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive,
          domComplete: navigation.domComplete
        },
        paint: paint.reduce((acc, entry) => {
          acc[entry.name] = entry.startTime;
          return acc;
        }, {}),
        customMetrics: window.__performanceMetrics,
        webVitals: window.__webVitals,
        resources: performance.getEntriesByType('resource').map(r => ({
          name: r.name,
          duration: r.duration,
          size: r.transferSize,
          type: r.initiatorType
        }))
      };
    });
    
    // Calculate runtime metrics
    const runtimeMetrics = {
      renderTime: performanceData.paint['first-contentful-paint'] || 0,
      scriptingTime: metrics.TaskDuration || 0,
      layoutTime: metrics.LayoutDuration || 0,
      paintTime: performanceData.paint['first-paint'] || 0,
      totalBlockingTime: calculateTBT(performanceData.resources)
    };
    
    return {
      url,
      metrics: runtimeMetrics,
      webVitals: performanceData.webVitals,
      navigation: performanceData.navigation,
      jsHeapSize: metrics.JSHeapUsedSize,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
};

const profileUserFlow = async (flowName, options = {}) => {
  const flow = USER_FLOWS[flowName];
  if (!flow) {
    throw new Error(`Unknown flow: ${flowName}`);
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Start tracing
    const tracePath = path.join(__dirname, '..', 'reports', `trace-${flowName}-${Date.now()}.json`);
    await page.tracing.start({ path: tracePath });
    
    const stepMetrics = [];
    const startTime = Date.now();
    
    // Execute flow steps
    for (const step of flow.steps) {
      const stepStart = Date.now();
      
      try {
        switch (step.action) {
          case 'goto':
            await page.goto(step.url, { waitUntil: 'networkidle0' });
            break;
          case 'click':
            await page.click(step.selector);
            break;
          case 'type':
            await page.type(step.selector, step.text);
            break;
          case 'waitForSelector':
            await page.waitForSelector(step.selector, { timeout: step.timeout || 5000 });
            break;
          case 'waitForNavigation':
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            break;
        }
        
        const stepEnd = Date.now();
        stepMetrics.push({
          name: `${step.action}: ${step.selector || step.url || ''}`,
          duration: stepEnd - stepStart,
          success: true
        });
        
      } catch (error) {
        stepMetrics.push({
          name: `${step.action}: ${step.selector || step.url || ''}`,
          duration: Date.now() - stepStart,
          success: false,
          error: error.message
        });
        
        if (options.stopOnError) {
          throw error;
        }
      }
    }
    
    // Stop tracing
    await page.tracing.stop();
    
    // Get final metrics
    const finalMetrics = await page.metrics();
    const totalDuration = Date.now() - startTime;
    
    return {
      flow: flowName,
      name: flow.name,
      totalDuration,
      steps: stepMetrics,
      memoryDelta: finalMetrics.JSHeapUsedSize - (stepMetrics[0]?.heapSize || 0),
      tracePath,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
};

const measureFrameRate = async (page, action) => {
  // Inject FPS monitoring script
  await page.evaluateOnNewDocument(() => {
    window.__fps = {
      frames: 0,
      startTime: 0,
      fps: 0
    };
    
    let lastTime = performance.now();
    
    function measureFPS() {
      window.__fps.frames++;
      
      const currentTime = performance.now();
      const delta = currentTime - window.__fps.startTime;
      
      if (delta >= 1000) {
        window.__fps.fps = (window.__fps.frames * 1000) / delta;
        window.__fps.frames = 0;
        window.__fps.startTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    }
    
    window.__fps.startTime = performance.now();
    requestAnimationFrame(measureFPS);
  });
  
  // Perform action
  const startTime = Date.now();
  
  switch (action) {
    case 'scroll':
      await page.evaluate(() => {
        return new Promise(resolve => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 16); // ~60fps
        });
      });
      break;
      
    case 'animation':
      // Trigger CSS animations if any
      await page.evaluate(() => {
        document.querySelectorAll('[class*="animate"]').forEach(el => {
          el.style.animation = 'none';
          el.offsetHeight; // Trigger reflow
          el.style.animation = '';
        });
      });
      await page.waitForTimeout(3000);
      break;
  }
  
  const duration = Date.now() - startTime;
  
  // Get FPS data
  const fpsData = await page.evaluate(() => window.__fps);
  
  // Calculate dropped frames
  const expectedFrames = (duration / 1000) * 60; // 60fps target
  const droppedFrames = Math.max(0, expectedFrames - fpsData.frames);
  
  let performance = 'good';
  if (fpsData.fps < 30) performance = 'poor';
  else if (fpsData.fps < 50) performance = 'acceptable';
  
  const recommendations = [];
  if (performance === 'poor') {
    recommendations.push('Reduce JavaScript execution during ' + action);
    recommendations.push('Optimize CSS animations and transitions');
    recommendations.push('Use CSS transform instead of position properties');
  }
  
  return {
    action,
    averageFps: fpsData.fps,
    frames: fpsData.frames,
    duration,
    droppedFrames,
    performance,
    recommendations
  };
};

const calculateTBT = (resources) => {
  // Simplified TBT calculation based on long JavaScript tasks
  const jsResources = resources.filter(r => r.type === 'script' && r.duration > 50);
  return jsResources.reduce((total, r) => total + Math.max(0, r.duration - 50), 0);
};

const generateRuntimeReport = async (data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `runtime-performance-${timestamp}.html`);
  
  // Ensure reports directory exists
  const reportsDir = path.dirname(reportPath);
  try {
    await fs.access(reportsDir);
  } catch {
    await fs.mkdir(reportsDir, { recursive: true });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Runtime Performance Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2 {
            color: #1a1a1a;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .metric-card.good { border-left-color: #0cce6b; }
        .metric-card.warning { border-left-color: #ffa400; }
        .metric-card.poor { border-left-color: #ff4e42; }
        .flow-step {
            padding: 10px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .flow-step.failed {
            background: #ffe6e6;
            border-left: 3px solid #ff4e42;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Runtime Performance Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        
        ${data.runtime ? `
        <h2>Runtime Metrics</h2>
        <div class="metric-card ${data.runtime.totalBlockingTime > 600 ? 'poor' : data.runtime.totalBlockingTime > 200 ? 'warning' : 'good'}">
            <h3>Performance Summary</h3>
            <p>Render Time: ${data.runtime.renderTime.toFixed(0)}ms</p>
            <p>Scripting Time: ${data.runtime.scriptingTime.toFixed(0)}ms</p>
            <p>Total Blocking Time: ${data.runtime.totalBlockingTime.toFixed(0)}ms</p>
            <p>JS Heap Size: ${(data.runtime.jsHeapSize / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        ` : ''}
        
        ${data.userFlows ? `
        <h2>User Flow Performance</h2>
        ${data.userFlows.map(flow => `
            <div class="metric-card">
                <h3>${flow.name}</h3>
                <p>Total Duration: ${flow.totalDuration}ms</p>
                <p>Memory Delta: ${(flow.memoryDelta / 1024 / 1024).toFixed(2)} MB</p>
                
                <h4>Steps:</h4>
                ${flow.steps.map(step => `
                    <div class="flow-step ${!step.success ? 'failed' : ''}">
                        ${step.name}: ${step.duration}ms
                        ${!step.success ? `<br>Error: ${step.error}` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('')}
        ` : ''}
        
        ${data.frameRate ? `
        <h2>Frame Rate Analysis</h2>
        <div class="metric-card ${data.frameRate.performance}">
            <h3>${data.frameRate.action}</h3>
            <p>Average FPS: ${data.frameRate.averageFps.toFixed(1)}</p>
            <p>Dropped Frames: ${data.frameRate.droppedFrames}</p>
            <p>Performance: ${data.frameRate.performance}</p>
            
            ${data.frameRate.recommendations.length > 0 ? `
            <h4>Recommendations:</h4>
            <ul>
                ${data.frameRate.recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
            ` : ''}
        </div>
        ` : ''}
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let mode = 'runtime';
  let flow = null;
  let url = 'http://localhost:3000';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--flow' && args[i + 1]) {
      mode = 'flow';
      flow = args[++i];
      if (!USER_FLOWS[flow]) {
        throw new Error(`Invalid flow name. Available flows: ${Object.keys(USER_FLOWS).join(', ')}`);
      }
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    }
  }
  
  return { mode, flow, url };
};

const main = async () => {
  try {
    const { mode, flow, url } = parseArgs();
    
    console.log('🚀 Runtime Performance Monitor\n');
    
    const reportData = {
      timestamp: new Date().toISOString()
    };
    
    if (mode === 'runtime') {
      console.log(`📊 Monitoring runtime performance for ${url}...\n`);
      
      const runtimeData = await monitorRuntimePerformance(url);
      reportData.runtime = runtimeData.metrics;
      reportData.runtime.jsHeapSize = runtimeData.jsHeapSize;
      
      console.log('Runtime Metrics:');
      console.log(`• Render Time: ${runtimeData.metrics.renderTime.toFixed(0)}ms`);
      console.log(`• Scripting Time: ${runtimeData.metrics.scriptingTime.toFixed(0)}ms`);
      console.log(`• Total Blocking Time: ${runtimeData.metrics.totalBlockingTime.toFixed(0)}ms`);
      console.log(`• JS Heap Size: ${(runtimeData.jsHeapSize / 1024 / 1024).toFixed(2)} MB`);
      
      if (runtimeData.webVitals) {
        console.log('\nWeb Vitals:');
        console.log(`• LCP: ${runtimeData.webVitals.LCP?.toFixed(0) || 'N/A'}ms`);
        console.log(`• FID: ${runtimeData.webVitals.FID?.toFixed(0) || 'N/A'}ms`);
        console.log(`• CLS: ${runtimeData.webVitals.CLS?.toFixed(3) || 'N/A'}`);
      }
      
    } else if (mode === 'flow') {
      console.log(`🔄 Profiling user flow: ${flow}\n`);
      
      const flowData = await profileUserFlow(flow);
      reportData.userFlows = [flowData];
      
      console.log(`Flow: ${flowData.name}`);
      console.log(`Total Duration: ${flowData.totalDuration}ms`);
      console.log(`Memory Delta: ${(flowData.memoryDelta / 1024 / 1024).toFixed(2)} MB`);
      console.log('\nSteps:');
      
      flowData.steps.forEach((step, i) => {
        const status = step.success ? '✅' : '❌';
        console.log(`${i + 1}. ${status} ${step.name} - ${step.duration}ms`);
        if (!step.success) {
          console.log(`   Error: ${step.error}`);
        }
      });
      
      console.log(`\nTrace saved to: ${flowData.tracePath}`);
    }
    
    // Generate report
    const reportPath = await generateRuntimeReport(reportData);
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Performance recommendations
    console.log('\n💡 RECOMMENDATIONS\n');
    
    if (reportData.runtime?.totalBlockingTime > 200) {
      console.log('• High Total Blocking Time detected');
      console.log('  - Break up long JavaScript tasks');
      console.log('  - Use code splitting and lazy loading');
      console.log('  - Consider web workers for heavy computations');
    }
    
    if (reportData.runtime?.jsHeapSize > 50 * 1024 * 1024) {
      console.log('• High memory usage detected');
      console.log('  - Check for memory leaks');
      console.log('  - Clean up event listeners');
      console.log('  - Optimize data structures');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Export for testing
module.exports = {
  monitorRuntimePerformance,
  profileUserFlow,
  measureFrameRate,
  generateRuntimeReport,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}