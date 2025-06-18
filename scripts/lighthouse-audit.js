#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const urls = [
  'http://localhost:3000',
  'http://localhost:3000/profile',
  'http://localhost:3000/create-token',
];

const runLighthouse = (url) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, '..', 'lighthouse-reports', `${url.replace(/[^a-z0-9]/gi, '-')}.json`);
    
    exec(
      `npx lighthouse ${url} --output=json --output-path="${outputPath}" --only-categories=performance,accessibility,best-practices,seo --throttling.cpuSlowdownMultiplier=4 --preset=mobile`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running Lighthouse for ${url}:`, error);
          reject(error);
        } else {
          console.log(`Lighthouse audit completed for ${url}`);
          
          // Read and parse the results
          const results = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
          const scores = {
            url,
            performance: results.categories.performance.score * 100,
            accessibility: results.categories.accessibility.score * 100,
            bestPractices: results.categories['best-practices'].score * 100,
            seo: results.categories.seo.score * 100,
            metrics: {
              firstContentfulPaint: results.audits['first-contentful-paint'].numericValue,
              largestContentfulPaint: results.audits['largest-contentful-paint'].numericValue,
              totalBlockingTime: results.audits['total-blocking-time'].numericValue,
              cumulativeLayoutShift: results.audits['cumulative-layout-shift'].numericValue,
              speedIndex: results.audits['speed-index'].numericValue,
            }
          };
          
          resolve(scores);
        }
      }
    );
  });
};

const main = async () => {
  console.log('Starting Lighthouse performance audit...');
  console.log('Note: This requires the dev server to be running on http://localhost:3000');
  console.log('Run "npm run dev" in another terminal if not already running.\n');
  
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(__dirname, '..', 'lighthouse-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  const results = [];
  
  for (const url of urls) {
    try {
      const score = await runLighthouse(url);
      results.push(score);
    } catch (error) {
      console.error(`Failed to audit ${url}`);
    }
  }
  
  console.log('\n=== LIGHTHOUSE AUDIT RESULTS ===\n');
  
  results.forEach(result => {
    console.log(`URL: ${result.url}`);
    console.log(`Performance: ${result.performance.toFixed(1)}%`);
    console.log(`Accessibility: ${result.accessibility.toFixed(1)}%`);
    console.log(`Best Practices: ${result.bestPractices.toFixed(1)}%`);
    console.log(`SEO: ${result.seo.toFixed(1)}%`);
    console.log('\nKey Metrics:');
    console.log(`- First Contentful Paint: ${(result.metrics.firstContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`- Largest Contentful Paint: ${(result.metrics.largestContentfulPaint / 1000).toFixed(2)}s`);
    console.log(`- Total Blocking Time: ${result.metrics.totalBlockingTime}ms`);
    console.log(`- Cumulative Layout Shift: ${result.metrics.cumulativeLayoutShift.toFixed(3)}`);
    console.log(`- Speed Index: ${(result.metrics.speedIndex / 1000).toFixed(2)}s`);
    console.log('---\n');
  });
  
  // Check if performance targets are met
  const performanceTargetMet = results.every(r => r.metrics.largestContentfulPaint < 3000);
  
  if (performanceTargetMet) {
    console.log('✅ Performance target met: All pages load within 3 seconds!');
  } else {
    console.log('❌ Performance target not met: Some pages take longer than 3 seconds to load.');
    console.log('Consider optimizing bundle size, images, and critical rendering path.');
  }
  
  // Save summary report
  const summaryPath = path.join(reportsDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nFull reports saved to ${reportsDir}/`);
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