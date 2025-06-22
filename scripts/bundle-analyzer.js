#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const BUNDLE_SIZE_TARGETS = {
  'First Load JS': { target: 200, critical: 350 },
  'Total Bundle': { target: 500, critical: 1000 }
};

const parseBuildOutput = (output) => {
  const lines = output.split('\n');
  const pageStats = {};
  let inPageSection = false;
  let currentPage = null;
  
  lines.forEach(line => {
    // Detect page sections
    if (line.includes('Page') && line.includes('Size')) {
      inPageSection = true;
      return;
    }
    
    if (inPageSection && line.trim() === '') {
      inPageSection = false;
      return;
    }
    
    if (inPageSection) {
      // Parse page sizes
      const match = line.match(/^([│├└]\s+)?([^\s]+)\s+(\d+(?:\.\d+)?)\s*(kB|B)/);
      if (match) {
        const [, , pagePath, size, unit] = match;
        const sizeInKB = unit === 'B' ? parseFloat(size) / 1024 : parseFloat(size);
        
        if (!pageStats[pagePath]) {
          pageStats[pagePath] = {};
        }
        
        if (line.includes('First Load JS')) {
          pageStats[pagePath].firstLoadJS = sizeInKB;
        } else {
          pageStats[pagePath].size = sizeInKB;
        }
      }
    }
  });
  
  return pageStats;
};

const analyzeBundle = async (options = {}) => {
  const { compare = false, dependencies = false } = options;
  
  console.log('🔨 Building project for analysis...\n');
  
  try {
    // Build with bundle analyzer
    const buildEnv = {
      ...process.env,
      ANALYZE: 'true'
    };
    
    const { stdout, stderr } = await execAsync('npm run build', {
      env: buildEnv,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    // Parse build output
    const pageStats = parseBuildOutput(stdout);
    
    // Get bundle stats from .next directory
    const statsPath = path.join(process.cwd(), '.next', 'build-stats.json');
    let buildStats = {};
    
    try {
      const statsContent = await fs.readFile(statsPath, 'utf8');
      buildStats = JSON.parse(statsContent);
    } catch (e) {
      // Stats file might not exist
    }
    
    return {
      pageStats,
      buildStats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error during build:', error.message);
    throw error;
  }
};

const analyzeDependencies = async () => {
  console.log('\n📦 Analyzing dependencies...\n');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  
  // Get sizes of dependencies
  const depSizes = {};
  
  for (const dep of Object.keys(packageJson.dependencies || {})) {
    try {
      const { stdout } = await execAsync(`du -sh node_modules/${dep} 2>/dev/null | cut -f1`);
      depSizes[dep] = stdout.trim();
    } catch (e) {
      // Dependency might not be installed
    }
  }
  
  // Sort by size
  const sortedDeps = Object.entries(depSizes)
    .sort((a, b) => {
      const sizeA = parseSize(a[1]);
      const sizeB = parseSize(b[1]);
      return sizeB - sizeA;
    })
    .slice(0, 20); // Top 20 largest
  
  return sortedDeps;
};

const parseSize = (sizeStr) => {
  const match = sizeStr.match(/^([\d.]+)([KMGT]?)$/);
  if (!match) return 0;
  
  const [, num, unit] = match;
  const multipliers = { K: 1, M: 1024, G: 1024 * 1024, T: 1024 * 1024 * 1024 };
  
  return parseFloat(num) * (multipliers[unit] || 1);
};

const compareWithPrevious = async (currentStats) => {
  const historyPath = path.join(process.cwd(), '.bundle-history.json');
  let history = [];
  
  try {
    const historyContent = await fs.readFile(historyPath, 'utf8');
    history = JSON.parse(historyContent);
  } catch (e) {
    // History file doesn't exist yet
  }
  
  // Add current stats to history
  history.push({
    timestamp: currentStats.timestamp,
    stats: currentStats.pageStats
  });
  
  // Keep only last 10 builds
  if (history.length > 10) {
    history = history.slice(-10);
  }
  
  // Save updated history
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  
  // Compare with previous build
  if (history.length < 2) {
    return null;
  }
  
  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  
  const comparison = {};
  
  for (const [page, stats] of Object.entries(current.stats)) {
    const prevStats = previous.stats[page];
    if (!prevStats) continue;
    
    comparison[page] = {
      size: {
        current: stats.size,
        previous: prevStats.size,
        change: stats.size - prevStats.size,
        changePercent: ((stats.size - prevStats.size) / prevStats.size) * 100
      },
      firstLoadJS: {
        current: stats.firstLoadJS,
        previous: prevStats.firstLoadJS,
        change: stats.firstLoadJS - prevStats.firstLoadJS,
        changePercent: ((stats.firstLoadJS - prevStats.firstLoadJS) / prevStats.firstLoadJS) * 100
      }
    };
  }
  
  return comparison;
};

const generateBundleReport = async (data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(process.cwd(), 'reports', `bundle-analysis-${timestamp}.html`);
  
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
    <title>Bundle Analysis Report - ${data.timestamp}</title>
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
        .page-card {
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .page-card.good { border-left-color: #0cce6b; }
        .page-card.warning { border-left-color: #ffa400; }
        .page-card.critical { border-left-color: #ff4e42; }
        .metric {
            display: inline-block;
            margin: 10px 20px 10px 0;
        }
        .metric-label {
            font-size: 0.9rem;
            color: #666;
        }
        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
        }
        .change {
            font-size: 0.9rem;
            margin-left: 10px;
        }
        .change.increase { color: #ff4e42; }
        .change.decrease { color: #0cce6b; }
        .deps-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .deps-table th,
        .deps-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .deps-table th {
            background: #f8f9fa;
            font-weight: bold;
        }
        .chart-container {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Bundle Analysis Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        
        <h2>Page Bundle Sizes</h2>
        ${Object.entries(data.pageStats).map(([page, stats]) => {
            const firstLoadStatus = stats.firstLoadJS < 200 ? 'good' : 
                                   stats.firstLoadJS < 350 ? 'warning' : 'critical';
            
            const comparison = data.comparison?.[page];
            
            return `
            <div class="page-card ${firstLoadStatus}">
                <h3>${page}</h3>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-label">Page Size</div>
                        <div class="metric-value">
                            ${stats.size?.toFixed(1) || 'N/A'} kB
                            ${comparison ? `
                                <span class="change ${comparison.size.change > 0 ? 'increase' : 'decrease'}">
                                    ${comparison.size.change > 0 ? '+' : ''}${comparison.size.change.toFixed(1)} kB
                                    (${comparison.size.changePercent > 0 ? '+' : ''}${comparison.size.changePercent.toFixed(1)}%)
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">First Load JS</div>
                        <div class="metric-value">
                            ${stats.firstLoadJS?.toFixed(1) || 'N/A'} kB
                            ${comparison ? `
                                <span class="change ${comparison.firstLoadJS.change > 0 ? 'increase' : 'decrease'}">
                                    ${comparison.firstLoadJS.change > 0 ? '+' : ''}${comparison.firstLoadJS.change.toFixed(1)} kB
                                    (${comparison.firstLoadJS.changePercent > 0 ? '+' : ''}${comparison.firstLoadJS.changePercent.toFixed(1)}%)
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('')}
        
        ${data.dependencies ? `
        <h2>Largest Dependencies</h2>
        <table class="deps-table">
            <thead>
                <tr>
                    <th>Package</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>
                ${data.dependencies.map(([dep, size]) => `
                    <tr>
                        <td>${dep}</td>
                        <td>${size}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
        
        <h2>Optimization Recommendations</h2>
        <ul>
            ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    compare: false,
    dependencies: false
  };
  
  args.forEach(arg => {
    if (arg === '--compare') options.compare = true;
    if (arg === '--dependencies') options.dependencies = true;
  });
  
  return options;
};

const main = async () => {
  try {
    const options = parseArgs();
    
    console.log('📊 Bundle Size Analyzer\n');
    
    // Analyze bundle
    const bundleData = await analyzeBundle(options);
    
    // Display results
    console.log('\n📦 BUNDLE ANALYSIS RESULTS\n');
    
    Object.entries(bundleData.pageStats).forEach(([page, stats]) => {
      const firstLoadStatus = stats.firstLoadJS < 200 ? '✅' : 
                             stats.firstLoadJS < 350 ? '⚠️' : '❌';
      
      console.log(`${firstLoadStatus} ${page}`);
      console.log(`   Page Size: ${stats.size?.toFixed(1) || 'N/A'} kB`);
      console.log(`   First Load JS: ${stats.firstLoadJS?.toFixed(1) || 'N/A'} kB`);
      console.log('');
    });
    
    // Compare with previous build
    let comparison = null;
    if (options.compare) {
      console.log('📈 Comparing with previous build...\n');
      comparison = await compareWithPrevious(bundleData);
      
      if (comparison) {
        Object.entries(comparison).forEach(([page, changes]) => {
          console.log(`${page}:`);
          if (changes.size.change !== 0) {
            const emoji = changes.size.change > 0 ? '📈' : '📉';
            console.log(`   ${emoji} Size: ${changes.size.change > 0 ? '+' : ''}${changes.size.change.toFixed(1)} kB (${changes.size.changePercent > 0 ? '+' : ''}${changes.size.changePercent.toFixed(1)}%)`);
          }
          if (changes.firstLoadJS.change !== 0) {
            const emoji = changes.firstLoadJS.change > 0 ? '📈' : '📉';
            console.log(`   ${emoji} First Load JS: ${changes.firstLoadJS.change > 0 ? '+' : ''}${changes.firstLoadJS.change.toFixed(1)} kB (${changes.firstLoadJS.changePercent > 0 ? '+' : ''}${changes.firstLoadJS.changePercent.toFixed(1)}%)`);
          }
          console.log('');
        });
      } else {
        console.log('No previous build data to compare.\n');
      }
    }
    
    // Analyze dependencies
    let dependencies = null;
    if (options.dependencies) {
      dependencies = await analyzeDependencies();
      
      console.log('🏋️ Largest Dependencies:\n');
      dependencies.forEach(([dep, size]) => {
        console.log(`   ${dep}: ${size}`);
      });
      console.log('');
    }
    
    // Generate recommendations
    const recommendations = [];
    
    const largeBundles = Object.entries(bundleData.pageStats)
      .filter(([, stats]) => stats.firstLoadJS > 200);
    
    if (largeBundles.length > 0) {
      recommendations.push('Consider code splitting for pages with First Load JS > 200kB');
      recommendations.push('Use dynamic imports for components not needed on initial load');
    }
    
    if (dependencies) {
      const largeDeps = dependencies.filter(([, size]) => parseSize(size) > 1024); // > 1MB
      if (largeDeps.length > 0) {
        recommendations.push(`Large dependencies detected: ${largeDeps.map(d => d[0]).join(', ')}`);
        recommendations.push('Consider lighter alternatives or tree-shaking unused code');
      }
    }
    
    recommendations.push('Enable compression (gzip/brotli) on your server');
    recommendations.push('Use Next.js Image component for automatic image optimization');
    recommendations.push('Implement proper caching headers for static assets');
    
    console.log('💡 RECOMMENDATIONS\n');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    // Generate HTML report
    const reportData = {
      timestamp: bundleData.timestamp,
      pageStats: bundleData.pageStats,
      comparison,
      dependencies,
      recommendations
    };
    
    const reportPath = await generateBundleReport(reportData);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Check bundle size budget
    console.log('\n🎯 BUNDLE SIZE BUDGET\n');
    
    let budgetPassed = true;
    Object.entries(bundleData.pageStats).forEach(([page, stats]) => {
      if (stats.firstLoadJS > BUNDLE_SIZE_TARGETS['First Load JS'].target) {
        console.log(`❌ ${page}: First Load JS exceeds target (${stats.firstLoadJS.toFixed(1)} kB > ${BUNDLE_SIZE_TARGETS['First Load JS'].target} kB)`);
        budgetPassed = false;
      }
    });
    
    if (budgetPassed) {
      console.log('✅ All pages meet bundle size targets!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Export for testing
module.exports = {
  analyzeBundle,
  analyzeDependencies,
  compareWithPrevious,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}