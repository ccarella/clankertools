import { ScanReport, Vulnerability } from './security-scanner';

export function generateMarkdownReport(report: ScanReport): string {
  let markdown = `# Security Scan Report\n\n`;
  markdown += `Scan ID: ${report.scanId}\n`;
  markdown += `Timestamp: ${report.timestamp}\n`;
  markdown += `Project Path: ${report.projectPath}\n`;
  markdown += `Status: ${report.status}\n`;
  markdown += `Duration: ${report.duration}ms\n`;
  markdown += `Scanned Files: ${report.scannedFiles}\n\n`;

  if (report.incrementalScan) {
    markdown += `**Scan Type:** Incremental\n`;
    if (report.targetFiles) {
      markdown += `**Target Files:** ${report.targetFiles.length} files\n\n`;
    }
  }

  markdown += `## Summary\n\n`;
  markdown += `Total Vulnerabilities: ${report.summary.total}\n\n`;
  markdown += `- Critical: ${report.summary.critical}\n`;
  markdown += `- High: ${report.summary.high}\n`;
  markdown += `- Medium: ${report.summary.medium}\n`;
  markdown += `- Low: ${report.summary.low}\n`;
  markdown += `- Info: ${report.summary.info}\n\n`;

  if (report.vulnerabilities.length > 0) {
    markdown += `## Vulnerabilities\n\n`;
    
    const vulnerabilitiesBySeverity = groupBySeverity(report.vulnerabilities);
    
    for (const [severity, vulns] of Object.entries(vulnerabilitiesBySeverity)) {
      if (vulns.length > 0) {
        markdown += `### ${severity.toUpperCase()} Severity\n\n`;
        
        for (const vuln of vulns) {
          markdown += `#### ${vuln.title}\n\n`;
          markdown += `**ID:** ${vuln.id}\n`;
          markdown += `**Type:** ${vuln.type}\n`;
          markdown += `**Severity:** ${vuln.severity}\n`;
          markdown += `**File:** ${vuln.file}\n`;
          markdown += `**Line:** ${vuln.line}\n`;
          markdown += `**Column:** ${vuln.column}\n\n`;
          markdown += `**Description:** ${vuln.description}\n\n`;
          markdown += `**Code:**\n\`\`\`\n${vuln.code}\n\`\`\`\n\n`;
          markdown += `**Remediation:** ${vuln.remediation}\n\n`;
          
          if (vuln.cwe) {
            markdown += `**CWE:** ${vuln.cwe}\n`;
          }
          if (vuln.owasp) {
            markdown += `**OWASP:** ${vuln.owasp}\n`;
          }
          markdown += '\n---\n\n';
        }
      }
    }
  } else {
    markdown += `## No vulnerabilities found! 🎉\n`;
  }

  if (report.error) {
    markdown += `## Error\n\n`;
    markdown += `**Error:** ${report.error}\n`;
  }

  if (report.config) {
    markdown += `## Configuration\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(report.config, null, 2)}\n\`\`\`\n`;
  }

  return markdown;
}

export function generateJsonReport(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}

export function generateHtmlReport(report: ScanReport): string {
  const vulnerabilitiesBySeverity = groupBySeverity(report.vulnerabilities);
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Scan Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        
        h2 {
            color: #34495e;
            margin-top: 30px;
        }
        
        h3 {
            color: #7f8c8d;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .summary-item {
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            background-color: #f8f9fa;
        }
        
        .summary-number {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .severity-critical { color: #e74c3c; }
        .severity-high { color: #e67e22; }
        .severity-medium { color: #f39c12; }
        .severity-low { color: #3498db; }
        .severity-info { color: #95a5a6; }
        
        .vulnerability {
            margin: 20px 0;
            padding: 20px;
            border-left: 4px solid;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        
        .vulnerability.critical { border-color: #e74c3c; }
        .vulnerability.high { border-color: #e67e22; }
        .vulnerability.medium { border-color: #f39c12; }
        .vulnerability.low { border-color: #3498db; }
        .vulnerability.info { border-color: #95a5a6; }
        
        .vulnerability h4 {
            margin-top: 0;
            color: #2c3e50;
        }
        
        .vulnerability-details {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px;
            margin: 10px 0;
        }
        
        .vulnerability-details dt {
            font-weight: bold;
            color: #7f8c8d;
        }
        
        .vulnerability-details dd {
            margin: 0;
        }
        
        code {
            background-color: #f1f1f1;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
        }
        
        pre {
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
        
        .metadata {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-top: 20px;
        }
        
        .status-completed { color: #27ae60; }
        .status-failed { color: #e74c3c; }
        .status-timeout { color: #f39c12; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Security Scan Report</h1>
        
        <div class="metadata">
            <p><strong>Scan ID:</strong> ${report.scanId}</p>
            <p><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
            <p><strong>Project Path:</strong> <code>${report.projectPath}</code></p>
            <p><strong>Status:</strong> <span class="status-${report.status}">${report.status}</span></p>
            <p><strong>Duration:</strong> ${report.duration}ms</p>
            <p><strong>Scanned Files:</strong> ${report.scannedFiles}</p>
            ${report.incrementalScan ? '<p><strong>Scan Type:</strong> Incremental</p>' : ''}
        </div>
        
        <h2>Summary</h2>
        <div class="summary">
            <div class="summary-item">
                <div class="summary-number severity-critical">${report.summary.critical}</div>
                <div>Critical</div>
            </div>
            <div class="summary-item">
                <div class="summary-number severity-high">${report.summary.high}</div>
                <div>High</div>
            </div>
            <div class="summary-item">
                <div class="summary-number severity-medium">${report.summary.medium}</div>
                <div>Medium</div>
            </div>
            <div class="summary-item">
                <div class="summary-number severity-low">${report.summary.low}</div>
                <div>Low</div>
            </div>
            <div class="summary-item">
                <div class="summary-number severity-info">${report.summary.info}</div>
                <div>Info</div>
            </div>
            <div class="summary-item">
                <div class="summary-number">${report.summary.total}</div>
                <div>Total</div>
            </div>
        </div>
        
        ${report.vulnerabilities.length > 0 ? generateVulnerabilitiesHtml(vulnerabilitiesBySeverity) : '<h2>No vulnerabilities found! 🎉</h2>'}
        
        ${report.error ? `<h2>Error</h2><p class="error">${report.error}</p>` : ''}
    </div>
</body>
</html>`;
  
  return html;
}

function generateVulnerabilitiesHtml(vulnerabilitiesBySeverity: Record<string, Vulnerability[]>): string {
  let html = '<h2>Vulnerabilities</h2>';
  
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  
  for (const severity of severityOrder) {
    const vulns = vulnerabilitiesBySeverity[severity] || [];
    if (vulns.length > 0) {
      html += `<h3>${severity.toUpperCase()} Severity (${vulns.length})</h3>`;
      
      for (const vuln of vulns) {
        html += `
        <div class="vulnerability ${severity}">
            <h4>${vuln.title}</h4>
            <dl class="vulnerability-details">
                <dt>ID:</dt>
                <dd>${vuln.id}</dd>
                <dt>Type:</dt>
                <dd>${vuln.type}</dd>
                <dt>File:</dt>
                <dd><code>${vuln.file}</code></dd>
                <dt>Location:</dt>
                <dd>Line ${vuln.line}, Column ${vuln.column}</dd>
                <dt>Description:</dt>
                <dd>${vuln.description}</dd>
            </dl>
            <h5>Code:</h5>
            <pre><code>${escapeHtml(vuln.code)}</code></pre>
            <h5>Remediation:</h5>
            <p>${vuln.remediation}</p>
            ${vuln.cwe ? `<p><strong>CWE:</strong> ${vuln.cwe}</p>` : ''}
            ${vuln.owasp ? `<p><strong>OWASP:</strong> ${vuln.owasp}</p>` : ''}
        </div>`;
      }
    }
  }
  
  return html;
}

function groupBySeverity(vulnerabilities: Vulnerability[]): Record<string, Vulnerability[]> {
  const grouped: Record<string, Vulnerability[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
  };
  
  for (const vuln of vulnerabilities) {
    grouped[vuln.severity].push(vuln);
  }
  
  return grouped;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}