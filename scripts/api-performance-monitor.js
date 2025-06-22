#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

const API_ENDPOINTS = {
  internal: [
    '/api/deploy/simple',
    '/api/deploy/advanced',
    '/api/connectWallet',
    '/api/token/0x1234567890123456789012345678901234567890',
    '/api/frame/token/0x1234567890123456789012345678901234567890'
  ],
  external: [
    'https://api.clanker.com/tokens',
    'https://ipfs.io/ipfs/QmTest'
  ]
};

const monitorApiPerformance = async (endpoints, options = {}) => {
  const results = [];
  const { headers = {}, timeout = 30000, external = false } = options;
  
  for (const endpoint of endpoints) {
    const url = external ? endpoint : `http://localhost:3000${endpoint}`;
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.push({
        endpoint,
        responseTime,
        status: response.status,
        success: response.ok,
        serverTime: response.headers.get('x-response-time'),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      results.push({
        endpoint,
        responseTime,
        status: error.name === 'AbortError' ? 'timeout' : 'error',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return results;
};

const analyzeEndpoints = async (performanceData) => {
  const analysis = {};
  
  // Group by endpoint
  const grouped = performanceData.reduce((acc, item) => {
    if (!acc[item.endpoint]) {
      acc[item.endpoint] = [];
    }
    acc[item.endpoint].push(item);
    return acc;
  }, {});
  
  // Calculate statistics for each endpoint
  for (const [endpoint, data] of Object.entries(grouped)) {
    const responseTimes = data
      .filter(d => d.success)
      .map(d => d.responseTime);
    
    if (responseTimes.length === 0) {
      analysis[endpoint] = {
        count: data.length,
        errorRate: 100,
        average: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0
      };
      continue;
    }
    
    responseTimes.sort((a, b) => a - b);
    
    analysis[endpoint] = {
      count: data.length,
      successCount: responseTimes.length,
      errorRate: ((data.length - responseTimes.length) / data.length) * 100,
      average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: responseTimes[Math.floor(responseTimes.length / 2)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      min: responseTimes[0],
      max: responseTimes[responseTimes.length - 1]
    };
  }
  
  return analysis;
};

const checkQueryPerformance = async (queries) => {
  // Mock implementation - in real scenario, this would analyze actual query logs
  const totalQueries = queries.reduce((sum, q) => sum + q.count, 0);
  const totalDuration = queries.reduce((sum, q) => sum + (q.duration * q.count), 0);
  const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;
  
  const slowQueries = queries.filter(q => q.duration > 100);
  const warnings = [];
  const recommendations = [];
  
  // Check for N+1 patterns
  const similarQueries = queries.filter(q => q.count > 50);
  if (similarQueries.length > 0) {
    warnings.push('Potential N+1 query pattern detected');
    recommendations.push('Consider using batch queries or eager loading');
  }
  
  // Check for missing indexes
  slowQueries.forEach(q => {
    if (q.executionPlan && q.executionPlan.includes('SCAN TABLE')) {
      recommendations.push(`Consider adding index for: ${q.query}`);
    }
  });
  
  return {
    totalQueries,
    averageDuration,
    slowQueries,
    warnings,
    recommendations
  };
};

const classifyResponseTime = (responseTime) => {
  if (responseTime < 200) return 'excellent';
  if (responseTime < 500) return 'good';
  if (responseTime < 1000) return 'acceptable';
  return 'poor';
};

const calculateSlaCompliance = (data, slaThreshold = 1000) => {
  const validResponses = data.filter(d => d.success);
  if (validResponses.length === 0) return 0;
  
  const withinSla = validResponses.filter(d => d.responseTime < slaThreshold);
  return (withinSla.length / validResponses.length) * 100;
};

const generateApiReport = async (data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `api-performance-${timestamp}.html`);
  
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
    <title>API Performance Report - ${data.timestamp}</title>
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
        .endpoint-card {
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .endpoint-card.excellent { border-left-color: #0cce6b; }
        .endpoint-card.good { border-left-color: #90ee90; }
        .endpoint-card.acceptable { border-left-color: #ffa400; }
        .endpoint-card.poor { border-left-color: #ff4e42; }
        .endpoint-card.error { border-left-color: #ff0000; }
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
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .recommendation {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
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
        <h1>API Performance Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
        
        <h2>Endpoint Performance</h2>
        ${Object.entries(data.endpoints).map(([endpoint, stats]) => {
            const classification = stats.errorRate === 100 ? 'error' : classifyResponseTime(stats.average);
            
            return `
            <div class="endpoint-card ${classification}">
                <h3>${endpoint}</h3>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-label">Average Response Time</div>
                        <div class="metric-value">${stats.average.toFixed(0)}ms</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">95th percentile</div>
                        <div class="metric-value">${stats.p95.toFixed(0)}ms</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Success Rate</div>
                        <div class="metric-value">${(100 - stats.errorRate).toFixed(1)}%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Total Requests</div>
                        <div class="metric-value">${stats.count}</div>
                    </div>
                </div>
                ${stats.errorRate > 0 ? `
                <div class="warning">
                    Error Rate: ${stats.errorRate.toFixed(1)}%
                </div>
                ` : ''}
            </div>
            `;
        }).join('')}
        
        ${data.queries ? `
        <h2>Database Performance</h2>
        <div class="endpoint-card">
            <div class="metric">
                <div class="metric-label">Total Queries</div>
                <div class="metric-value">${data.queries.totalQueries}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Average Duration</div>
                <div class="metric-value">${data.queries.averageDuration.toFixed(0)}ms</div>
            </div>
        </div>
        
        ${data.queries.warnings.map(w => `
            <div class="warning">⚠️ ${w}</div>
        `).join('')}
        
        ${data.queries.recommendations.map(r => `
            <div class="recommendation">💡 ${r}</div>
        `).join('')}
        ` : ''}
        
        <h2>SLA Compliance</h2>
        <table>
            <thead>
                <tr>
                    <th>Endpoint</th>
                    <th>SLA Target</th>
                    <th>Compliance</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.endpoints).map(([endpoint, stats]) => {
                    const compliance = calculateSlaCompliance([stats], 1000);
                    return `
                    <tr>
                        <td>${endpoint}</td>
                        <td>&lt; 1000ms</td>
                        <td>${compliance.toFixed(1)}%</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let mode = 'all';
  let period = '1h';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--endpoints') {
      mode = 'endpoints';
    } else if (args[i] === '--queries') {
      mode = 'queries';
    } else if (args[i] === '--period' && args[i + 1]) {
      period = args[++i];
    }
  }
  
  if (!['all', 'endpoints', 'queries'].includes(mode)) {
    throw new Error('Invalid monitoring mode');
  }
  
  return { mode, period };
};

const main = async () => {
  try {
    const { mode, period } = parseArgs();
    
    console.log(`🔍 Starting API Performance Monitor`);
    console.log(`Mode: ${mode}, Period: ${period}\n`);
    
    // Monitor internal endpoints
    console.log('📡 Monitoring internal API endpoints...');
    const internalResults = await monitorApiPerformance(API_ENDPOINTS.internal);
    
    // Monitor external endpoints
    console.log('🌐 Monitoring external API endpoints...');
    const externalResults = await monitorApiPerformance(API_ENDPOINTS.external, { external: true });
    
    // Analyze results
    const allResults = [...internalResults, ...externalResults];
    const analysis = await analyzeEndpoints(allResults);
    
    // Display results
    console.log('\n📊 API PERFORMANCE RESULTS\n');
    
    for (const [endpoint, stats] of Object.entries(analysis)) {
      const classification = classifyResponseTime(stats.average);
      const emoji = {
        excellent: '🚀',
        good: '✅',
        acceptable: '⚠️',
        poor: '❌',
        error: '💥'
      }[stats.errorRate === 100 ? 'error' : classification];
      
      console.log(`${emoji} ${endpoint}`);
      console.log(`   Average: ${stats.average.toFixed(0)}ms`);
      console.log(`   P95: ${stats.p95.toFixed(0)}ms`);
      console.log(`   Success Rate: ${(100 - stats.errorRate).toFixed(1)}%`);
      console.log(`   Range: ${stats.min.toFixed(0)}ms - ${stats.max.toFixed(0)}ms`);
      console.log('');
    }
    
    // Check query performance (mock data for demo)
    const mockQueries = [
      { query: 'SELECT * FROM tokens WHERE address = ?', duration: 5, count: 1000 },
      { query: 'SELECT * FROM users WHERE fid = ?', duration: 3, count: 500 },
      { query: 'INSERT INTO wallets', duration: 15, count: 100 }
    ];
    
    const queryAnalysis = await checkQueryPerformance(mockQueries);
    
    // Generate report
    const reportData = {
      timestamp: new Date().toISOString(),
      endpoints: analysis,
      queries: mode !== 'endpoints' ? queryAnalysis : null
    };
    
    const reportPath = await generateApiReport(reportData);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // SLA summary
    console.log('\n🎯 SLA COMPLIANCE\n');
    let totalCompliance = 0;
    let endpointCount = 0;
    
    for (const [endpoint, stats] of Object.entries(analysis)) {
      if (stats.successCount > 0) {
        const compliance = (stats.p95 < 1000) ? 100 : 0;
        totalCompliance += compliance;
        endpointCount++;
        console.log(`${endpoint}: ${compliance}% (target: <1000ms)`);
      }
    }
    
    const avgCompliance = endpointCount > 0 ? totalCompliance / endpointCount : 0;
    console.log(`\nOverall SLA Compliance: ${avgCompliance.toFixed(1)}%`);
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS\n');
    
    const slowEndpoints = Object.entries(analysis)
      .filter(([_, stats]) => stats.average > 500)
      .map(([endpoint]) => endpoint);
    
    if (slowEndpoints.length > 0) {
      console.log('Slow endpoints detected:');
      slowEndpoints.forEach(ep => console.log(`  • ${ep}`));
      console.log('\nConsider:');
      console.log('  - Adding caching (Redis)');
      console.log('  - Optimizing database queries');
      console.log('  - Implementing pagination');
    }
    
    const errorEndpoints = Object.entries(analysis)
      .filter(([_, stats]) => stats.errorRate > 5)
      .map(([endpoint]) => endpoint);
    
    if (errorEndpoints.length > 0) {
      console.log('\nHigh error rate endpoints:');
      errorEndpoints.forEach(ep => console.log(`  • ${ep}`));
      console.log('\nInvestigate:');
      console.log('  - Server logs for errors');
      console.log('  - Rate limiting issues');
      console.log('  - Timeout configurations');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Export for testing
module.exports = {
  monitorApiPerformance,
  analyzeEndpoints,
  checkQueryPerformance,
  generateApiReport,
  classifyResponseTime,
  calculateSlaCompliance,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}