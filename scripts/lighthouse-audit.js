#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const DEFAULT_URLS = [
  'http://localhost:3000',
  'http://localhost:3000/profile',
  'http://localhost:3000/create-token',
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const config = {
    urls: DEFAULT_URLS,
    device: 'mobile',
    outputFormat: 'html,json',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--desktop':
        config.device = 'desktop';
        break;
      case '--url':
        config.urls = [args[++i]];
        break;
      case '--format':
        config.outputFormat = args[++i];
        break;
    }
  }

  return config;
};

const runLighthouse = (url, config) => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlSlug = url.replace(/[^a-z0-9]/gi, '-');
    const outputPath = path.join(__dirname, '..', 'reports', `lighthouse-${config.device}-${urlSlug}-${timestamp}`);
    
    const preset = config.device === 'desktop' ? 'desktop' : 'mobile';
    
    exec(
      `npx lighthouse ${url} --output=${config.outputFormat} --output-path="${outputPath}" --only-categories=performance,accessibility,best-practices,seo --preset=${preset}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running Lighthouse for ${url}:`, error);
          reject(error);
        } else {
          console.log(`Lighthouse audit completed for ${url}`);
          
          // Read and parse the results
          fs.readFile(`${outputPath}.json`, 'utf8')
            .then(data => {
              const results = JSON.parse(data);
              const scores = {
                url,
                device: config.device,
                timestamp: new Date().toISOString(),
                performance: results.categories.performance.score * 100,
                accessibility: results.categories.accessibility.score * 100,
                bestPractices: results.categories['best-practices'].score * 100,
                seo: results.categories.seo.score * 100,
                metrics: {
                  firstContentfulPaint: results.audits['first-contentful-paint'].numericValue,
                  firstInputDelay: results.audits['max-potential-fid']?.numericValue || 0,
                  largestContentfulPaint: results.audits['largest-contentful-paint'].numericValue,
                  totalBlockingTime: results.audits['total-blocking-time'].numericValue,
                  cumulativeLayoutShift: results.audits['cumulative-layout-shift'].numericValue,
                  speedIndex: results.audits['speed-index'].numericValue,
                  timeToInteractive: results.audits['interactive'].numericValue,
                },
                reportPath: config.outputFormat.includes('html') ? `${outputPath}.html` : null
              };
              
              resolve(scores);
            })
            .catch(reject);
        }
      }
    );
  });
};

const evaluatePerformance = (metrics) => {
  const thresholds = {
    good: { lcp: 2500, fid: 100, cls: 0.1, tbt: 200 },
    needsImprovement: { lcp: 4000, fid: 300, cls: 0.25, tbt: 600 }
  };

  let status = 'good';
  if (metrics.largestContentfulPaint > thresholds.needsImprovement.lcp ||
      metrics.totalBlockingTime > thresholds.needsImprovement.tbt ||
      metrics.cumulativeLayoutShift > thresholds.needsImprovement.cls) {
    status = 'poor';
  } else if (metrics.largestContentfulPaint > thresholds.good.lcp ||
             metrics.totalBlockingTime > thresholds.good.tbt ||
             metrics.cumulativeLayoutShift > thresholds.good.cls) {
    status = 'needs-improvement';
  }

  return status;
};

const main = async () => {
  const config = parseArgs();
  
  console.log('🚀 Starting Lighthouse performance audit...');
  console.log(`📱 Device: ${config.device}`);
  console.log(`📊 Output format: ${config.outputFormat}`);
  console.log('Note: This requires the dev server to be running on http://localhost:3000\n');
  
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(__dirname, '..', 'reports');
  try {
    await fs.access(reportsDir);
  } catch {
    await fs.mkdir(reportsDir, { recursive: true });
  }
  
  const results = [];
  
  for (const url of config.urls) {
    try {
      const score = await runLighthouse(url, config);
      results.push(score);
    } catch (error) {
      console.error(`Failed to audit ${url}`);
    }
  }
  
  console.log('\n📈 LIGHTHOUSE AUDIT RESULTS\n');
  
  results.forEach(result => {
    const status = evaluatePerformance(result.metrics);
    const statusEmoji = status === 'good' ? '✅' : status === 'needs-improvement' ? '⚠️' : '❌';
    
    console.log(`${statusEmoji} URL: ${result.url}`);
    console.log(`   Device: ${result.device}`);
    console.log(`   Performance: ${result.performance.toFixed(1)}%`);
    console.log(`   Accessibility: ${result.accessibility.toFixed(1)}%`);
    console.log(`   Best Practices: ${result.bestPractices.toFixed(1)}%`);
    console.log(`   SEO: ${result.seo.toFixed(1)}%`);
    console.log('\n   Core Web Vitals:');
    console.log(`   • LCP: ${(result.metrics.largestContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`   • FID: ${result.metrics.firstInputDelay}ms`);
    console.log(`   • CLS: ${result.metrics.cumulativeLayoutShift.toFixed(3)}`);
    console.log('\n   Other Metrics:');
    console.log(`   • FCP: ${(result.metrics.firstContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`   • TTI: ${(result.metrics.timeToInteractive / 1000).toFixed(2)}s`);
    console.log(`   • TBT: ${result.metrics.totalBlockingTime}ms`);
    console.log(`   • Speed Index: ${(result.metrics.speedIndex / 1000).toFixed(2)}s`);
    
    if (result.reportPath) {
      console.log(`\n   📄 Full report: ${result.reportPath}`);
    }
    console.log('   ---\n');
  });
  
  // Performance summary
  const avgPerformance = results.reduce((acc, r) => acc + r.performance, 0) / results.length;
  const failingMetrics = results.filter(r => evaluatePerformance(r.metrics) === 'poor');
  
  console.log('\n📊 SUMMARY\n');
  console.log(`Average Performance Score: ${avgPerformance.toFixed(1)}%`);
  
  if (failingMetrics.length === 0) {
    console.log('✅ All pages meet Core Web Vitals thresholds!');
  } else {
    console.log(`❌ ${failingMetrics.length} page(s) need performance improvements`);
    console.log('\n🔧 Recommendations:');
    
    const avgLCP = results.reduce((acc, r) => acc + r.metrics.largestContentfulPaint, 0) / results.length;
    if (avgLCP > 2500) {
      console.log('   • Optimize largest contentful paint (server response, render blocking resources)');
    }
    
    const avgTBT = results.reduce((acc, r) => acc + r.metrics.totalBlockingTime, 0) / results.length;
    if (avgTBT > 200) {
      console.log('   • Reduce JavaScript execution time (code splitting, lazy loading)');
    }
    
    const avgCLS = results.reduce((acc, r) => acc + r.metrics.cumulativeLayoutShift, 0) / results.length;
    if (avgCLS > 0.1) {
      console.log('   • Fix layout shifts (set dimensions, avoid dynamic content)');
    }
  }
  
  // Save summary report
  const summaryPath = path.join(reportsDir, `lighthouse-summary-${config.device}-${new Date().toISOString().split('T')[0]}.json`);
  await fs.writeFile(summaryPath, JSON.stringify({
    config,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      averagePerformance: avgPerformance,
      failingPages: failingMetrics.length,
      device: config.device
    }
  }, null, 2));
  
  console.log(`\n📁 Summary saved to: ${summaryPath}`);
};

// Only run if lighthouse is available
exec('which lighthouse || where lighthouse', (error) => {
  if (error) {
    console.log('Lighthouse not installed. Run: npm install -g lighthouse');
    process.exit(1);
  } else {
    main().catch(console.error);
  }
});