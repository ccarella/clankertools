#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const AUDIT_SCRIPTS = {
  lighthouse: {
    name: 'Lighthouse Audit',
    command: 'node scripts/lighthouse-audit.js',
    emoji: '🚀'
  },
  bundle: {
    name: 'Bundle Size Analysis',
    command: 'node scripts/bundle-analyzer.js --compare --dependencies',
    emoji: '📦'
  },
  webVitals: {
    name: 'Web Vitals Analysis',
    command: 'node scripts/web-vitals-analyzer.js --period 14d',
    emoji: '📊'
  },
  api: {
    name: 'API Performance',
    command: 'node scripts/api-performance-monitor.js',
    emoji: '🔍'
  },
  runtime: {
    name: 'Runtime Performance',
    command: 'node scripts/runtime-performance-monitor.js',
    emoji: '⚡'
  },
  memory: {
    name: 'Memory Profile',
    command: 'node scripts/memory-profiler.js --duration 30s',
    emoji: '🧠'
  }
};

const runAudit = async (auditType) => {
  const audit = AUDIT_SCRIPTS[auditType];
  if (!audit) {
    throw new Error(`Unknown audit type: ${auditType}`);
  }
  
  console.log(`\n${audit.emoji} Running ${audit.name}...\n`);
  
  try {
    const { stdout, stderr } = await execAsync(audit.command, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    return {
      type: auditType,
      name: audit.name,
      success: true,
      output: stdout,
      error: stderr
    };
  } catch (error) {
    return {
      type: auditType,
      name: audit.name,
      success: false,
      output: error.stdout || '',
      error: error.message
    };
  }
};

const generateMasterReport = async (results) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `performance-audit-${timestamp}.html`);
  
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
    <title>Performance Audit Report - ${new Date().toLocaleString()}</title>
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
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid transparent;
        }
        .summary-card.success {
            border-color: #0cce6b;
        }
        .summary-card.failed {
            border-color: #ff4e42;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 1.2rem;
        }
        .summary-card .status {
            font-size: 2rem;
            margin: 10px 0;
        }
        .audit-section {
            margin: 40px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .audit-output {
            background: #1a1a1a;
            color: #f0f0f0;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
        }
        .error {
            background: #fee;
            border: 1px solid #fcc;
            padding: 10px;
            border-radius: 5px;
            color: #c00;
            margin: 10px 0;
        }
        .recommendations {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .recommendations ul {
            margin: 10px 0;
            padding-left: 25px;
        }
        .recommendations li {
            margin: 5px 0;
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
        <h1>🎯 Performance Audit Report</h1>
        <p>Comprehensive performance analysis of ClankerTools application</p>
        
        <div class="summary">
            ${results.map(result => `
            <div class="summary-card ${result.success ? 'success' : 'failed'}">
                <h3>${result.name}</h3>
                <div class="status">${result.success ? '✅' : '❌'}</div>
                <p>${result.success ? 'Completed' : 'Failed'}</p>
            </div>
            `).join('')}
        </div>
        
        ${results.map(result => `
        <div class="audit-section">
            <h2>${AUDIT_SCRIPTS[result.type].emoji} ${result.name}</h2>
            ${result.success ? `
                <div class="audit-output">${escapeHtml(result.output)}</div>
            ` : `
                <div class="error">
                    <strong>Error:</strong> ${result.error}
                </div>
                ${result.output ? `
                    <div class="audit-output">${escapeHtml(result.output)}</div>
                ` : ''}
            `}
        </div>
        `).join('')}
        
        <div class="recommendations">
            <h2>🔧 Overall Recommendations</h2>
            <ul>
                <li>Run this comprehensive audit bi-weekly as outlined in the Performance Playbook</li>
                <li>Set up automated alerts for performance regressions</li>
                <li>Integrate performance budgets into CI/CD pipeline</li>
                <li>Monitor real user metrics in production</li>
                <li>Profile on actual devices, not just desktop Chrome</li>
                <li>Consider implementing a performance dashboard</li>
                <li>Document performance improvements and share with team</li>
            </ul>
        </div>
        
        <div class="timestamp">
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  return reportPath;
};

const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const audits = [];
  
  if (args.length === 0) {
    // Run all audits by default
    return Object.keys(AUDIT_SCRIPTS);
  }
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const auditType = arg.substring(2);
      if (AUDIT_SCRIPTS[auditType]) {
        audits.push(auditType);
      }
    }
  });
  
  return audits.length > 0 ? audits : Object.keys(AUDIT_SCRIPTS);
};

const checkPrerequisites = async () => {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check if dev server is running
  try {
    const response = await fetch('http://localhost:3000');
    console.log('✅ Dev server is running');
  } catch (error) {
    console.log('❌ Dev server is not running');
    console.log('   Please run "npm run dev" in another terminal\n');
    throw new Error('Dev server not running');
  }
  
  // Check for required tools
  const tools = [
    { name: 'Lighthouse', check: 'which lighthouse || where lighthouse' },
    { name: 'Node.js', check: 'node --version' }
  ];
  
  for (const tool of tools) {
    try {
      await execAsync(tool.check);
      console.log(`✅ ${tool.name} is installed`);
    } catch (error) {
      console.log(`❌ ${tool.name} is not installed`);
      if (tool.name === 'Lighthouse') {
        console.log('   Install with: npm install -g lighthouse');
      }
    }
  }
  
  console.log('');
};

const main = async () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     🚀 ClankerTools Performance Audit 🚀     ║
╚══════════════════════════════════════════════╝
`);
  
  try {
    // Check prerequisites
    await checkPrerequisites();
    
    // Parse command line arguments
    const auditsToRun = parseArgs();
    
    console.log(`Running ${auditsToRun.length} performance audits...\n`);
    console.log('Audits to run:');
    auditsToRun.forEach(audit => {
      console.log(`  ${AUDIT_SCRIPTS[audit].emoji} ${AUDIT_SCRIPTS[audit].name}`);
    });
    
    // Run audits sequentially to avoid resource conflicts
    const results = [];
    for (const auditType of auditsToRun) {
      const result = await runAudit(auditType);
      results.push(result);
      
      // Brief pause between audits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Generate master report
    console.log('\n📄 Generating master report...\n');
    const reportPath = await generateMasterReport(results);
    
    // Summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('                    SUMMARY                    ');
    console.log('═══════════════════════════════════════════════\n');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful audits: ${successful}`);
    console.log(`❌ Failed audits: ${failed}`);
    console.log(`\n📊 Master report: ${reportPath}`);
    
    // Performance score calculation (simplified)
    const performanceScore = (successful / results.length) * 100;
    console.log(`\n🎯 Overall Performance Score: ${performanceScore.toFixed(0)}%`);
    
    if (performanceScore === 100) {
      console.log('   Excellent! All audits passed successfully.');
    } else if (performanceScore >= 80) {
      console.log('   Good performance, but some areas need attention.');
    } else {
      console.log('   Performance issues detected. Review the report for details.');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Review the detailed report');
    console.log('2. Address any critical issues first');
    console.log('3. Create tickets for performance improvements');
    console.log('4. Schedule the next audit in 2 weeks');
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    process.exit(1);
  }
};

// NPM script aliases
const createNpmScripts = () => {
  return {
    "perf:audit": "node scripts/performance-audit.js",
    "perf:lighthouse": "node scripts/lighthouse-audit.js",
    "perf:bundle": "node scripts/bundle-analyzer.js",
    "perf:api": "node scripts/api-performance-monitor.js",
    "perf:runtime": "node scripts/runtime-performance-monitor.js",
    "perf:memory": "node scripts/memory-profiler.js",
    "perf:vitals": "node scripts/web-vitals-analyzer.js"
  };
};

// Export for testing
module.exports = {
  runAudit,
  generateMasterReport,
  parseArgs,
  createNpmScripts
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}