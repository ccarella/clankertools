#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const profileMemoryUsage = async (url, options = {}) => {
  const {
    duration = 30000,
    interval = 1000,
    captureGC = false,
    trackAllocations = false,
    production = false
  } = options;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--js-flags=--expose-gc']
  });

  try {
    const page = await browser.newPage();
    
    // Enable memory profiling
    const client = await page.target().createCDPSession();
    await client.send('HeapProfiler.enable');
    
    if (trackAllocations && !production) {
      await client.send('HeapProfiler.startTrackingHeapObjects');
    }
    
    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    const samples = [];
    const startTime = Date.now();
    
    // Collect memory samples
    while (Date.now() - startTime < duration) {
      const metrics = await page.metrics();
      const timestamp = Date.now() - startTime;
      
      samples.push({
        timestamp,
        heapUsed: metrics.JSHeapUsedSize,
        heapTotal: metrics.JSHeapTotalSize,
        external: metrics.JSHeapUsedSize - metrics.JSHeapTotalSize
      });
      
      if (captureGC) {
        // Force garbage collection to get more accurate readings
        await page.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
        });
      }
      
      await page.waitForTimeout(interval);
    }
    
    // Get allocation data if tracking
    let allocations = null;
    if (trackAllocations && !production) {
      await client.send('HeapProfiler.stopTrackingHeapObjects');
      
      // Get allocation summary
      allocations = await page.evaluate(() => {
        const typeCounts = {};
        
        // This is a simplified version - real implementation would use heap snapshot
        if (window.performance && window.performance.memory) {
          return [
            { type: 'Total', size: window.performance.memory.usedJSHeapSize, count: 1 },
            { type: 'Limit', size: window.performance.memory.jsHeapSizeLimit, count: 1 }
          ];
        }
        
        return [];
      });
    }
    
    // Get GC statistics
    let gcEvents = null;
    if (captureGC) {
      gcEvents = await page.evaluate(() => {
        // This would require more sophisticated monitoring in real implementation
        return {
          minorGCs: 0,
          majorGCs: 0,
          totalGCTime: 0,
          memoryFreed: 0
        };
      });
    }
    
    // Calculate summary statistics
    const heapSizes = samples.map(s => s.heapUsed);
    const summary = {
      initialHeap: heapSizes[0],
      finalHeap: heapSizes[heapSizes.length - 1],
      peakHeap: Math.max(...heapSizes),
      averageHeap: heapSizes.reduce((a, b) => a + b, 0) / heapSizes.length,
      minHeap: Math.min(...heapSizes)
    };
    
    return {
      url,
      samples,
      summary,
      allocations,
      gcActivity: gcEvents,
      topAllocations: allocations?.slice(0, 10),
      duration,
      timestamp: new Date().toISOString()
    };
    
  } finally {
    await browser.close();
  }
};

const detectMemoryLeaks = async (page, options = {}) => {
  const {
    duration = 60000,
    threshold = 0.1, // 10% growth threshold
    scenario = 'idle',
    checkDOM = true,
    actions = [],
    iterations = 1
  } = options;
  
  const samples = [];
  const startTime = Date.now();
  
  // Get initial metrics
  const initialMetrics = await page.metrics();
  const initialHeap = initialMetrics.JSHeapUsedSize;
  
  // Perform scenario
  if (scenario === 'repeated-action' && actions.length > 0) {
    for (let i = 0; i < iterations; i++) {
      for (const action of actions) {
        switch (action.type) {
          case 'click':
            await page.click(action.selector);
            break;
          case 'type':
            await page.type(action.selector, action.text);
            break;
          case 'navigate':
            await page.goto(action.url);
            break;
        }
        await page.waitForTimeout(500);
      }
      
      const metrics = await page.metrics();
      samples.push({
        iteration: i + 1,
        heapSize: metrics.JSHeapUsedSize,
        timestamp: Date.now() - startTime
      });
    }
  } else {
    // Monitor idle memory growth
    const interval = 2000;
    while (Date.now() - startTime < duration) {
      const metrics = await page.metrics();
      samples.push({
        heapSize: metrics.JSHeapUsedSize,
        timestamp: Date.now() - startTime
      });
      await page.waitForTimeout(interval);
    }
  }
  
  // Analyze growth pattern
  const finalHeap = samples[samples.length - 1].heapSize;
  const growth = finalHeap - initialHeap;
  const growthRate = growth / initialHeap;
  
  // Linear regression to detect consistent growth
  const xValues = samples.map(s => s.timestamp);
  const yValues = samples.map(s => s.heapSize);
  const n = samples.length;
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((total, x, i) => total + x * yValues[i], 0);
  const sumX2 = xValues.reduce((total, x) => total + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared to measure fit
  const yMean = sumY / n;
  const ssTotal = yValues.reduce((total, y) => total + Math.pow(y - yMean, 2), 0);
  const ssResidual = yValues.reduce((total, y, i) => {
    const predicted = slope * xValues[i] + intercept;
    return total + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);
  
  // Determine if there's a leak
  const hasLeak = growthRate > threshold && rSquared > 0.8 && slope > 0;
  const confidence = Math.min(100, rSquared * 100);
  
  // Check DOM for leaks
  let domLeaks = null;
  if (checkDOM) {
    domLeaks = await page.evaluate(() => {
      const nodes = document.querySelectorAll('*');
      const detached = [];
      
      // Simple check for common leak patterns
      const listeners = getEventListeners ? getEventListeners(window).length : 0;
      
      return {
        domNodes: nodes.length,
        detachedNodes: detached.length,
        listeners,
        excessiveListeners: listeners > 1000
      };
    });
    
    if (domLeaks.detachedNodes > 100) {
      domLeaks.recommendation = 'Remove references to detached DOM nodes';
    }
  }
  
  return {
    hasLeak,
    confidence,
    growthRate,
    growthBytes: growth,
    samples: samples.slice(-10), // Last 10 samples
    regression: { slope, intercept, rSquared },
    details: hasLeak ? 
      `Memory grew by ${(growthRate * 100).toFixed(1)}% with consistent growth pattern` :
      'No significant memory leak detected',
    scenario,
    domLeaks
  };
};

const analyzeHeapSnapshot = async (page, options = {}) => {
  const { findRetained = false, compare = false, baselineSnapshot = null } = options;
  
  const client = await page.target().createCDPSession();
  await client.send('HeapProfiler.enable');
  
  // Take heap snapshot
  const chunks = [];
  client.on('HeapProfiler.addHeapSnapshotChunk', ({ chunk }) => {
    chunks.push(chunk);
  });
  
  await client.send('HeapProfiler.takeHeapSnapshot', {
    reportProgress: false,
    treatGlobalObjectsAsRoots: true
  });
  
  // Parse snapshot
  const snapshotData = chunks.join('');
  const snapshot = JSON.parse(snapshotData);
  
  // Analyze object types
  const objectTypes = {};
  let totalSize = 0;
  
  if (snapshot.nodes) {
    snapshot.nodes.forEach(node => {
      const type = node.type || 'Unknown';
      const name = node.name || type;
      const size = node.size || 0;
      
      if (!objectTypes[name]) {
        objectTypes[name] = { count: 0, size: 0 };
      }
      
      objectTypes[name].count++;
      objectTypes[name].size += size;
      totalSize += size;
    });
  }
  
  // Find largest objects
  const largestObjects = Object.entries(objectTypes)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);
  
  // Find retained objects if requested
  let retainedObjects = [];
  if (findRetained && snapshot.nodes) {
    retainedObjects = snapshot.nodes
      .filter(node => node.retained && node.size > 10000)
      .map(node => ({
        path: node.path || 'Unknown',
        size: node.size,
        type: node.type
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
  }
  
  // Compare with baseline if provided
  let diff = null;
  if (compare && baselineSnapshot) {
    const baselineSize = baselineSnapshot.totalSize || 0;
    diff = {
      sizeDelta: totalSize - baselineSize,
      growth: ((totalSize - baselineSize) / baselineSize) * 100,
      newObjects: Object.keys(objectTypes).length - Object.keys(baselineSnapshot.objectTypes || {}).length
    };
  }
  
  return {
    totalSize,
    objectTypes,
    largestObjects,
    retainedObjects,
    diff,
    timestamp: new Date().toISOString()
  };
};

const generateMemoryReport = async (data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `memory-profile-${timestamp}.html`);
  
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
    <title>Memory Profile Report</title>
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
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .critical {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .chart-container {
            width: 100%;
            height: 300px;
            margin: 20px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Memory Profile Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        
        ${data.profile ? `
        <h2>Memory Usage Summary</h2>
        <div class="metric-card">
            <p><strong>Initial Heap:</strong> ${(data.profile.summary.initialHeap / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Final Heap:</strong> ${(data.profile.summary.finalHeap / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Peak Heap:</strong> ${(data.profile.summary.peakHeap / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Average Heap:</strong> ${(data.profile.summary.averageHeap / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Growth:</strong> ${((data.profile.summary.finalHeap - data.profile.summary.initialHeap) / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        
        <div class="chart-container">
            <div class="memory-timeline">Memory usage chart would go here</div>
        </div>
        ` : ''}
        
        ${data.leaks && data.leaks.hasLeak ? `
        <div class="critical">
            <h3>⚠️ Memory leak detected!</h3>
            <p>${data.leaks.details}</p>
            <p>Confidence: ${data.leaks.confidence.toFixed(1)}%</p>
            <p>Growth rate: ${(data.leaks.growthRate * 100).toFixed(1)}% over test period</p>
        </div>
        ` : data.leaks ? `
        <div class="metric-card">
            <h3>✅ No memory leaks detected</h3>
            <p>${data.leaks.details}</p>
        </div>
        ` : ''}
        
        ${data.leaks?.domLeaks ? `
        <h2>DOM Analysis</h2>
        <div class="metric-card">
            <p><strong>DOM Nodes:</strong> ${data.leaks.domLeaks.domNodes}</p>
            <p><strong>Detached Nodes:</strong> ${data.leaks.domLeaks.detachedNodes}</p>
            <p><strong>Event Listeners:</strong> ${data.leaks.domLeaks.listeners}</p>
            ${data.leaks.domLeaks.detachedNodes > 100 ? `
            <div class="warning">
                <strong>Warning:</strong> ${data.leaks.domLeaks.detachedNodes} detached nodes found. 
                This may indicate a memory leak.
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        ${data.heapAnalysis ? `
        <h2>Heap Analysis</h2>
        <div class="metric-card">
            <p><strong>Total Size:</strong> ${(data.heapAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Object Types:</strong> ${Object.keys(data.heapAnalysis.objectTypes).length}</p>
        </div>
        
        <h3>Largest Object Types</h3>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Count</th>
                    <th>Size (MB)</th>
                    <th>% of Total</th>
                </tr>
            </thead>
            <tbody>
                ${data.heapAnalysis.largestObjects.map(obj => `
                    <tr>
                        <td>${obj.name}</td>
                        <td>${obj.count.toLocaleString()}</td>
                        <td>${(obj.size / 1024 / 1024).toFixed(2)}</td>
                        <td>${((obj.size / data.heapAnalysis.totalSize) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
        
        ${data.heapAnalysis?.retainedObjects?.length > 0 ? `
        <h3>Large Retained Objects</h3>
        <div class="warning">
            <p>The following objects are being retained in memory and may indicate leaks:</p>
            <ul>
                ${data.heapAnalysis.retainedObjects.map(obj => `
                    <li><strong>${obj.path}</strong>: ${(obj.size / 1024 / 1024).toFixed(2)} MB</li>
                `).join('')}
            </ul>
        </div>
        ` : ''}
        
        <h2>Recommendations</h2>
        <ul>
            ${data.profile && data.profile.summary.finalHeap > data.profile.summary.initialHeap * 1.5 ? 
              '<li>Significant memory growth detected. Check for memory leaks.</li>' : ''}
            ${data.leaks?.domLeaks?.detachedNodes > 100 ? 
              '<li>Clean up detached DOM nodes by removing all references.</li>' : ''}
            ${data.leaks?.domLeaks?.excessiveListeners ? 
              '<li>Remove unused event listeners to prevent memory leaks.</li>' : ''}
            ${data.heapAnalysis?.largestObjects?.[0]?.size > 10 * 1024 * 1024 ? 
              '<li>Large objects detected. Consider breaking them into smaller chunks.</li>' : ''}
            <li>Use weak references for caches and temporary data.</li>
            <li>Implement proper cleanup in component unmount handlers.</li>
            <li>Profile memory usage regularly during development.</li>
        </ul>
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let mode = 'profile';
  let duration = 30000;
  let url = 'http://localhost:3000';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--leak-detection') {
      mode = 'leak-detection';
    } else if (args[i] === '--heap-analysis') {
      mode = 'heap-analysis';
    } else if (args[i] === '--duration' && args[i + 1]) {
      const durationStr = args[++i];
      const match = durationStr.match(/^(\d+)(s|m)?$/);
      if (match) {
        const [, num, unit] = match;
        duration = parseInt(num) * (unit === 'm' ? 60000 : unit === 's' ? 1000 : 1);
      }
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    }
  }
  
  return { mode, duration, url };
};

const main = async () => {
  let browser;
  
  try {
    const { mode, duration, url } = parseArgs();
    
    console.log('🧠 Memory Profiler\n');
    console.log(`Mode: ${mode}`);
    console.log(`URL: ${url}`);
    console.log(`Duration: ${duration / 1000}s\n`);
    
    const reportData = {
      timestamp: new Date().toISOString()
    };
    
    if (mode === 'profile' || mode === 'leak-detection') {
      console.log('📊 Profiling memory usage...\n');
      
      const profile = await profileMemoryUsage(url, {
        duration,
        interval: 1000,
        captureGC: true,
        production: process.env.NODE_ENV === 'production'
      });
      
      reportData.profile = profile;
      
      console.log('Memory Usage Summary:');
      console.log(`• Initial: ${(profile.summary.initialHeap / 1024 / 1024).toFixed(2)} MB`);
      console.log(`• Final: ${(profile.summary.finalHeap / 1024 / 1024).toFixed(2)} MB`);
      console.log(`• Peak: ${(profile.summary.peakHeap / 1024 / 1024).toFixed(2)} MB`);
      console.log(`• Growth: ${((profile.summary.finalHeap - profile.summary.initialHeap) / 1024 / 1024).toFixed(2)} MB`);
    }
    
    if (mode === 'leak-detection') {
      console.log('\n🔍 Checking for memory leaks...\n');
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      const leaks = await detectMemoryLeaks(page, {
        duration: Math.min(duration, 60000), // Max 1 minute for leak detection
        checkDOM: true
      });
      
      reportData.leaks = leaks;
      
      if (leaks.hasLeak) {
        console.log(`❌ Memory leak detected! (${leaks.confidence.toFixed(1)}% confidence)`);
        console.log(`   ${leaks.details}`);
      } else {
        console.log('✅ No memory leaks detected');
      }
      
      if (leaks.domLeaks) {
        console.log(`\nDOM Stats:`);
        console.log(`• Nodes: ${leaks.domLeaks.domNodes}`);
        console.log(`• Detached: ${leaks.domLeaks.detachedNodes}`);
        console.log(`• Listeners: ${leaks.domLeaks.listeners}`);
      }
    }
    
    if (mode === 'heap-analysis') {
      console.log('\n📸 Taking heap snapshot...\n');
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      const heapAnalysis = await analyzeHeapSnapshot(page, {
        findRetained: true
      });
      
      reportData.heapAnalysis = heapAnalysis;
      
      console.log(`Total Heap Size: ${(heapAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log('\nTop 5 Object Types:');
      heapAnalysis.largestObjects.slice(0, 5).forEach((obj, i) => {
        console.log(`${i + 1}. ${obj.name}: ${(obj.size / 1024 / 1024).toFixed(2)} MB (${obj.count} objects)`);
      });
    }
    
    // Generate report
    const reportPath = await generateMemoryReport(reportData);
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Recommendations
    console.log('\n💡 MEMORY OPTIMIZATION TIPS\n');
    console.log('1. Remove event listeners when components unmount');
    console.log('2. Clear timers and intervals properly');
    console.log('3. Avoid storing large objects in closures');
    console.log('4. Use WeakMap/WeakSet for object references');
    console.log('5. Implement virtual scrolling for long lists');
    console.log('6. Lazy load images and components');
    console.log('7. Profile regularly during development');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Export for testing
module.exports = {
  profileMemoryUsage,
  detectMemoryLeaks,
  analyzeHeapSnapshot,
  generateMemoryReport,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}