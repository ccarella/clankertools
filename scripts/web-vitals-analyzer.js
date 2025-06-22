#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const calculatePercentile = (data, percentile) => {
  if (!data || data.length === 0) return 0;
  
  const sorted = [...data].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const classifyMetric = (metric, value) => {
  const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    fid: { good: 100, poor: 300 },
    cls: { good: 0.1, poor: 0.25 },
    fcp: { good: 1800, poor: 3000 },
    ttfb: { good: 800, poor: 1800 }
  };

  const t = thresholds[metric];
  if (!t) return 'unknown';
  
  if (value <= t.good) return 'good';
  if (value >= t.poor) return 'poor';
  return 'needs-improvement';
};

const analyzeWebVitals = async (data, period = '14d') => {
  const metrics = {};
  
  // Calculate statistics for each metric
  for (const [metric, values] of Object.entries(data)) {
    if (values.length === 0) {
      metrics[metric] = {
        median: 0,
        p75: 0,
        p95: 0,
        average: 0
      };
      continue;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    metrics[metric] = {
      median: calculatePercentile(values, 50),
      p75: calculatePercentile(values, 75),
      p95: calculatePercentile(values, 95),
      average: sum / values.length
    };
  }

  // Calculate overall score
  let score = 100;
  const scoreWeights = {
    lcp: 25,
    fid: 25,
    cls: 25,
    fcp: 15,
    ttfb: 10
  };

  for (const [metric, weight] of Object.entries(scoreWeights)) {
    const value = metrics[metric]?.p75 || 0;
    const classification = classifyMetric(metric, value);
    
    if (classification === 'poor') {
      score -= weight;
    } else if (classification === 'needs-improvement') {
      score -= weight * 0.5;
    }
  }

  // Determine overall status
  let status = 'good';
  if (score < 50) status = 'poor';
  else if (score < 75) status = 'needs-improvement';

  return {
    period,
    metrics,
    score: Math.max(0, score),
    status,
    timestamp: new Date().toISOString()
  };
};

const generateVitalsReport = async (analysis) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `web-vitals-${timestamp}.html`);
  
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
    <title>Core Web Vitals Report - ${analysis.timestamp}</title>
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
        .score {
            font-size: 3rem;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .score.good { background: #0cce6b; color: white; }
        .score.needs-improvement { background: #ffa400; color: white; }
        .score.poor { background: #ff4e42; color: white; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .metric-card.good { border-left-color: #0cce6b; }
        .metric-card.needs-improvement { border-left-color: #ffa400; }
        .metric-card.poor { border-left-color: #ff4e42; }
        .metric-name {
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
            font-size: 0.9rem;
            color: #666;
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-details {
            font-size: 0.9rem;
            color: #666;
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
        .timestamp {
            text-align: center;
            color: #666;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Core Web Vitals Report</h1>
        
        <div class="score ${analysis.status}">
            Score: ${analysis.score}
        </div>
        
        <h2>Metrics Summary</h2>
        <div class="metrics-grid">
            ${Object.entries(analysis.metrics).map(([metric, stats]) => {
                const p75 = stats.p75 || 0;
                const status = classifyMetric(metric, p75);
                const unit = metric === 'cls' ? '' : 'ms';
                const displayValue = metric === 'cls' ? p75.toFixed(3) : p75.toFixed(0);
                
                return `
                <div class="metric-card ${status}">
                    <div class="metric-name">${metric.toUpperCase()}</div>
                    <div class="metric-value">${displayValue}${unit}</div>
                    <div class="metric-details">
                        <div>Median: ${metric === 'cls' ? stats.median.toFixed(3) : stats.median.toFixed(0)}${unit}</div>
                        <div>95th: ${metric === 'cls' ? stats.p95.toFixed(3) : stats.p95.toFixed(0)}${unit}</div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        
        <h2>Detailed Statistics</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Average</th>
                    <th>Median (p50)</th>
                    <th>p75</th>
                    <th>p95</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(analysis.metrics).map(([metric, stats]) => {
                    const unit = metric === 'cls' ? '' : 'ms';
                    const status = classifyMetric(metric, stats.p75);
                    const format = (val) => metric === 'cls' ? val.toFixed(3) : val.toFixed(0);
                    
                    return `
                    <tr>
                        <td><strong>${metric.toUpperCase()}</strong></td>
                        <td>${format(stats.average)}${unit}</td>
                        <td>${format(stats.median)}${unit}</td>
                        <td>${format(stats.p75)}${unit}</td>
                        <td>${format(stats.p95)}${unit}</td>
                        <td><span class="${status}">${status}</span></td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        
        <div class="timestamp">
            Generated on ${new Date(analysis.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let period = '14d';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--period' && args[i + 1]) {
      period = args[++i];
      if (!period.match(/^\d+[dhw]$/)) {
        throw new Error('Invalid period format. Use format like "14d", "7d", "1w"');
      }
    }
  }
  
  return { period };
};

// Mock data generator for testing
const generateMockData = (period) => {
  const days = parseInt(period.match(/\d+/)[0]);
  const dataPoints = days * 100; // 100 data points per day
  
  return {
    lcp: Array.from({ length: dataPoints }, () => 1500 + Math.random() * 2000),
    fid: Array.from({ length: dataPoints }, () => 50 + Math.random() * 150),
    cls: Array.from({ length: dataPoints }, () => 0.05 + Math.random() * 0.15),
    fcp: Array.from({ length: dataPoints }, () => 800 + Math.random() * 1500),
    ttfb: Array.from({ length: dataPoints }, () => 200 + Math.random() * 800)
  };
};

const main = async () => {
  try {
    const { period } = parseArgs();
    
    console.log(`📊 Analyzing Web Vitals data for the last ${period}...`);
    
    // In a real implementation, this would fetch data from monitoring service
    // For now, we'll use mock data
    const data = generateMockData(period);
    
    const analysis = await analyzeWebVitals(data, period);
    
    console.log('\n📈 WEB VITALS ANALYSIS\n');
    console.log(`Period: ${period}`);
    console.log(`Overall Score: ${analysis.score}/100 (${analysis.status})`);
    console.log('\nCore Web Vitals (p75):');
    
    const metrics = ['lcp', 'fid', 'cls'];
    metrics.forEach(metric => {
      const stats = analysis.metrics[metric];
      const status = classifyMetric(metric, stats.p75);
      const emoji = status === 'good' ? '✅' : status === 'needs-improvement' ? '⚠️' : '❌';
      const unit = metric === 'cls' ? '' : 'ms';
      const value = metric === 'cls' ? stats.p75.toFixed(3) : stats.p75.toFixed(0);
      
      console.log(`${emoji} ${metric.toUpperCase()}: ${value}${unit} (${status})`);
    });
    
    console.log('\nAdditional Metrics:');
    ['fcp', 'ttfb'].forEach(metric => {
      const stats = analysis.metrics[metric];
      const value = stats.p75.toFixed(0);
      console.log(`• ${metric.toUpperCase()}: ${value}ms`);
    });
    
    // Generate report
    const reportPath = await generateVitalsReport(analysis);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Provide recommendations
    console.log('\n🔧 RECOMMENDATIONS\n');
    
    if (classifyMetric('lcp', analysis.metrics.lcp.p75) !== 'good') {
      console.log('• Optimize Largest Contentful Paint:');
      console.log('  - Reduce server response times');
      console.log('  - Optimize images and fonts');
      console.log('  - Remove render-blocking resources');
    }
    
    if (classifyMetric('fid', analysis.metrics.fid.p75) !== 'good') {
      console.log('• Improve First Input Delay:');
      console.log('  - Break up long JavaScript tasks');
      console.log('  - Use web workers for heavy computations');
      console.log('  - Reduce third-party script impact');
    }
    
    if (classifyMetric('cls', analysis.metrics.cls.p75) !== 'good') {
      console.log('• Fix Cumulative Layout Shift:');
      console.log('  - Set explicit dimensions for images/videos');
      console.log('  - Avoid inserting content above existing content');
      console.log('  - Use transform animations instead of layout properties');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Export for testing
module.exports = {
  analyzeWebVitals,
  generateVitalsReport,
  calculatePercentile,
  classifyMetric,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}