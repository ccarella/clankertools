import { getRedisClient } from '@/lib/redis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';

export interface Vulnerability {
  id: string;
  type: 'xss' | 'sql-injection' | 'csrf' | 'insecure-auth' | 'hardcoded-secret' | 'path-traversal';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  line: number;
  column: number;
  code: string;
  remediation: string;
  cwe?: string;
  owasp?: string;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface ScanReport {
  scanId: string;
  timestamp: string;
  projectPath: string;
  vulnerabilities: Vulnerability[];
  summary: ScanSummary;
  duration: number;
  scannedFiles: number;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
  incrementalScan?: boolean;
  targetFiles?: string[];
  config?: ScanConfig;
}

export interface ScanConfig {
  excludePaths?: string[];
  includePatterns?: string[];
  severityThreshold?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  enabledChecks?: string[];
}

interface ScannerOptions {
  projectRoot: string;
  outputDir: string;
  redis?: any;
  config?: ScanConfig;
  timeout?: number;
}

interface ContinuousMonitor {
  isRunning: () => boolean;
  getInterval: () => number;
  stop: () => Promise<void>;
}

export class SecurityScanner {
  private projectRoot: string;
  private outputDir: string;
  private redis: any;
  private config: ScanConfig;
  private timeout: number;
  private patternCache: Map<string, RegExp[]> = new Map();

  constructor(options: ScannerOptions) {
    if (!options.projectRoot) {
      throw new Error('Invalid project root');
    }
    if (!options.outputDir) {
      throw new Error('Invalid output directory');
    }

    this.projectRoot = options.projectRoot;
    this.outputDir = options.outputDir;
    this.redis = options.redis || null;
    this.config = options.config || {};
    this.timeout = options.timeout || 120000; // 2 minutes default
    
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // XSS patterns
    this.patternCache.set('xss', [
      /dangerouslySetInnerHTML\s*=\s*\{[^}]*__html:/g,
      /innerHTML\s*=\s*[^;]+/g,
      /document\.write\s*\([^)]*\)/g,
      /eval\s*\([^)]*\)/g,
      /\.html\s*\([^)]*\)/g, // jQuery html()
    ]);

    // SQL Injection patterns
    this.patternCache.set('sql', [
      /query\s*\(\s*[`"'].*\$\{[^}]+\}/g,
      /execute\s*\(\s*[`"'].*\+/g,
      /db\.[a-zA-Z]+\s*\(\s*[`"'].*\$\{/g,
      /SELECT.*FROM.*WHERE.*\+/gi,
    ]);

    // Hardcoded secrets patterns
    this.patternCache.set('secrets', [
      /(api[_-]?key|apikey)\s*[:=]\s*["'][^"']{20,}/gi,
      /(secret|password|pwd)\s*[:=]\s*["'][^"']+/gi,
      /sk_live_[a-zA-Z0-9]+/g,
      /pk_live_[a-zA-Z0-9]+/g,
      /bearer\s+[a-zA-Z0-9._-]{20,}/gi,
    ]);

    // Insecure auth patterns
    this.patternCache.set('auth', [
      /token\s*===?\s*["'][^"']+["']/g,
      /password\s*===?\s*["'][^"']+["']/g,
      /admin\s*===?\s*true/gi,
      /auth.*bypass/gi,
    ]);

    // CSRF patterns
    this.patternCache.set('csrf', [
      /router\.(post|put|delete|patch)\s*\([^)]*\)\s*{(?!.*csrf)/gi,
      /app\.(post|put|delete|patch)\s*\([^)]*\)\s*{(?!.*csrf)/gi,
    ]);

    // Path traversal patterns
    this.patternCache.set('pathTraversal', [
      /\.\.\/|\.\.\\/g,
      /path\.join\s*\([^)]*req\./g,
      /readFile\s*\([^)]*req\./g,
    ]);
  }

  async scan(): Promise<ScanReport> {
    try {
      const report = await this.withTimeout(this.performScan());
      await this.storeScanResult(report);
      return report;
    } catch (error) {
      const errorReport: ScanReport = {
        scanId: uuidv4(),
        timestamp: new Date().toISOString(),
        projectPath: this.projectRoot,
        vulnerabilities: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
        duration: 0,
        scannedFiles: 0,
        status: error instanceof TimeoutError ? 'timeout' : 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      await this.storeScanResult(errorReport);
      return errorReport;
    }
  }

  async scanFiles(files: string[]): Promise<ScanReport> {
    // Validate file paths
    for (const file of files) {
      if (!this.isValidFilePath(file)) {
        return {
          scanId: uuidv4(),
          timestamp: new Date().toISOString(),
          projectPath: this.projectRoot,
          vulnerabilities: [],
          summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
          duration: 0,
          scannedFiles: 0,
          status: 'failed',
          error: 'Invalid file path detected',
        };
      }
    }

    try {
      const report = await this.withTimeout(this.performScan(files));
      report.incrementalScan = true;
      report.targetFiles = files;
      await this.storeScanResult(report);
      return report;
    } catch (error) {
      const errorReport: ScanReport = {
        scanId: uuidv4(),
        timestamp: new Date().toISOString(),
        projectPath: this.projectRoot,
        vulnerabilities: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
        duration: 0,
        scannedFiles: 0,
        status: error instanceof TimeoutError ? 'timeout' : 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        incrementalScan: true,
        targetFiles: files,
      };
      await this.storeScanResult(errorReport);
      return errorReport;
    }
  }

  async getScanResult(scanId: string): Promise<ScanReport | null> {
    if (!this.redis) return null;
    try {
      const data = await this.redis.get(`security:scan:${scanId}`);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async listRecentScans(limit: number): Promise<ScanReport[]> {
    if (!this.redis) return [];
    const keys = await this.redis.keys('security:scan:*');
    const reports: ScanReport[] = [];

    for (const key of keys.slice(0, limit)) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          reports.push(JSON.parse(data));
        } catch (error) {
          // Skip corrupted data
        }
      }
    }

    return reports.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async cleanupOldScans(daysOld: number): Promise<number> {
    if (!this.redis) return 0;
    const keys = await this.redis.keys('security:scan:*');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const report = JSON.parse(data);
          if (new Date(report.timestamp) < cutoffDate) {
            await this.redis.del(key);
            deletedCount++;
          }
        } catch (error) {
          // Skip corrupted data
        }
      }
    }

    return deletedCount;
  }

  async generateMarkdownReport(report: ScanReport): Promise<string> {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      info: 'ℹ️',
    };

    let markdown = `# Security Scan Report

## Summary
- **Scan ID:** ${report.scanId}
- **Timestamp:** ${report.timestamp}
- **Project Path:** ${report.projectPath}
- **Status:** ${report.status}
- **Duration:** ${(report.duration / 1000).toFixed(2)}s
- **Files Scanned:** ${report.scannedFiles}
${report.incrementalScan ? '- **Type:** Incremental Scan\n' : ''}
${report.error ? `- **Error:** ${report.error}\n` : ''}

## Vulnerability Summary
- ${severityEmoji.critical} Critical: ${report.summary.critical}
- ${severityEmoji.high} High: ${report.summary.high}
- ${severityEmoji.medium} Medium: ${report.summary.medium}
- ${severityEmoji.low} Low: ${report.summary.low}
- ${severityEmoji.info} Info: ${report.summary.info}
- **Total Vulnerabilities:** ${report.summary.total}

`;

    if (report.vulnerabilities.length > 0) {
      markdown += '## Vulnerabilities\n\n';
      
      const groupedVulns = this.groupVulnerabilitiesBySeverity(report.vulnerabilities);
      
      for (const [severity, vulns] of Object.entries(groupedVulns)) {
        if (vulns.length === 0) continue;
        
        markdown += `### ${severityEmoji[severity as keyof typeof severityEmoji]} ${severity.toUpperCase()} (${vulns.length})\n\n`;
        
        for (const vuln of vulns) {
          markdown += `#### ${vuln.title}
- **Type:** ${vuln.type}
- **File:** ${vuln.file}
- **Line:** ${vuln.line}:${vuln.column}
${vuln.cwe ? `- **CWE:** ${vuln.cwe}\n` : ''}${vuln.owasp ? `- **OWASP:** ${vuln.owasp}\n` : ''}
**Description:** ${vuln.description}

**Code:**
\`\`\`typescript
${vuln.code}
\`\`\`

**Remediation:** ${vuln.remediation}

---

`;
        }
      }
    }

    return markdown;
  }

  generateJsonReport(report: ScanReport): string {
    return JSON.stringify(report, null, 2);
  }

  async generateHtmlReport(report: ScanReport): Promise<string> {
    const severityColors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#facc15',
      low: '#84cc16',
      info: '#0ea5e9',
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report - ${report.scanId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1, h2, h3 { margin-top: 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .summary-card { padding: 20px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb; }
    .severity-critical { border-left: 4px solid ${severityColors.critical}; }
    .severity-high { border-left: 4px solid ${severityColors.high}; }
    .severity-medium { border-left: 4px solid ${severityColors.medium}; }
    .severity-low { border-left: 4px solid ${severityColors.low}; }
    .severity-info { border-left: 4px solid ${severityColors.info}; }
    .vulnerability { margin: 20px 0; padding: 20px; border-radius: 8px; background: #f9fafb; }
    .code-block { background: #1f2937; color: #e5e7eb; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: 'Monaco', 'Courier New', monospace; font-size: 14px; }
    .meta-info { color: #6b7280; font-size: 14px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Security Scan Report</h1>
    
    <div class="meta-info">
      <p><strong>Scan ID:</strong> ${report.scanId}</p>
      <p><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
      <p><strong>Duration:</strong> ${(report.duration / 1000).toFixed(2)}s</p>
      <p><strong>Files Scanned:</strong> ${report.scannedFiles}</p>
      <p><strong>Status:</strong> <span class="badge" style="background: ${report.status === 'completed' ? '#10b981' : '#ef4444'}; color: white;">${report.status}</span></p>
    </div>

    <h2>Summary</h2>
    <div class="summary">
      <div class="summary-card">
        <h3 style="color: ${severityColors.critical};">Critical</h3>
        <p style="font-size: 32px; margin: 0;">${report.summary.critical}</p>
      </div>
      <div class="summary-card">
        <h3 style="color: ${severityColors.high};">High</h3>
        <p style="font-size: 32px; margin: 0;">${report.summary.high}</p>
      </div>
      <div class="summary-card">
        <h3 style="color: ${severityColors.medium};">Medium</h3>
        <p style="font-size: 32px; margin: 0;">${report.summary.medium}</p>
      </div>
      <div class="summary-card">
        <h3 style="color: ${severityColors.low};">Low</h3>
        <p style="font-size: 32px; margin: 0;">${report.summary.low}</p>
      </div>
      <div class="summary-card">
        <h3 style="color: ${severityColors.info};">Info</h3>
        <p style="font-size: 32px; margin: 0;">${report.summary.info}</p>
      </div>
    </div>

    ${report.vulnerabilities.length > 0 ? `
    <h2>Vulnerabilities</h2>
    ${report.vulnerabilities.map(vuln => `
      <div class="vulnerability severity-${vuln.severity}">
        <h3>${vuln.title}</h3>
        <p class="meta-info">
          <span class="badge" style="background: ${severityColors[vuln.severity]}; color: white;">${vuln.severity.toUpperCase()}</span>
          <span class="badge" style="background: #6b7280; color: white;">${vuln.type}</span>
          ${vuln.cwe ? `<span class="badge" style="background: #3b82f6; color: white;">${vuln.cwe}</span>` : ''}
          ${vuln.owasp ? `<span class="badge" style="background: #8b5cf6; color: white;">${vuln.owasp}</span>` : ''}
        </p>
        <p><strong>File:</strong> ${vuln.file} (Line ${vuln.line}:${vuln.column})</p>
        <p><strong>Description:</strong> ${vuln.description}</p>
        <div class="code-block">${this.escapeHtml(vuln.code)}</div>
        <p><strong>Remediation:</strong> ${vuln.remediation}</p>
      </div>
    `).join('')}
    ` : '<p>No vulnerabilities found.</p>'}
  </div>
</body>
</html>`;
  }

  async saveReport(report: ScanReport, format: 'markdown' | 'json' | 'html'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${report.scanId}_${timestamp}.${format === 'markdown' ? 'md' : format}`;
    const filepath = path.join(this.outputDir, filename);

    await fs.mkdir(this.outputDir, { recursive: true });

    let content: string;
    switch (format) {
      case 'markdown':
        content = await this.generateMarkdownReport(report);
        break;
      case 'json':
        content = this.generateJsonReport(report);
        break;
      case 'html':
        content = await this.generateHtmlReport(report);
        break;
    }

    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  generateSummaryStatistics(reports: ScanReport[]): any {
    const totalVulnerabilities = reports.reduce((sum, report) => sum + report.summary.total, 0);
    const severityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    reports.forEach(report => {
      severityBreakdown.critical += report.summary.critical;
      severityBreakdown.high += report.summary.high;
      severityBreakdown.medium += report.summary.medium;
      severityBreakdown.low += report.summary.low;
      severityBreakdown.info += report.summary.info;
    });

    return {
      totalScans: reports.length,
      totalVulnerabilities,
      averageVulnerabilitiesPerScan: totalVulnerabilities / reports.length,
      severityBreakdown,
    };
  }

  startContinuousMonitoring(config: { interval: number; paths?: string[]; autoFix?: boolean }): ContinuousMonitor {
    let intervalId: NodeJS.Timeout;
    let running = true;

    const runScan = async () => {
      if (running) {
        await this.scan();
      }
    };

    intervalId = setInterval(runScan, config.interval);

    return {
      isRunning: () => running,
      getInterval: () => config.interval,
      stop: async () => {
        running = false;
        clearInterval(intervalId);
      },
    };
  }

  private async performScan(targetFiles?: string[]): Promise<ScanReport> {
    const startTime = Date.now();
    const scanId = uuidv4();
    const vulnerabilities: Vulnerability[] = [];
    
    const files = targetFiles || await this.getFilesToScan();
    
    await this.scanFilesParallel(files);
    
    // Collect vulnerabilities from parallel scan
    for (const file of files) {
      const fileVulns = await this.detectVulnerabilities(file);
      vulnerabilities.push(...fileVulns);
    }

    const summary = this.aggregateVulnerabilities(vulnerabilities);
    const duration = Date.now() - startTime;

    return {
      scanId,
      timestamp: new Date().toISOString(),
      projectPath: this.projectRoot,
      vulnerabilities,
      summary,
      duration,
      scannedFiles: files.length,
      status: 'completed',
      config: this.config,
    };
  }

  private async storeScanResult(report: ScanReport): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(
      `security:scan:${report.scanId}`,
      JSON.stringify(report),
      { ex: 7 * 24 * 60 * 60 } // 7 days
    );
  }

  private aggregateVulnerabilities(vulnerabilities: Vulnerability[]): ScanSummary {
    const summary: ScanSummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: vulnerabilities.length,
    };

    vulnerabilities.forEach(vuln => {
      summary[vuln.severity]++;
    });

    return summary;
  }

  private async detectXSS(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    const vulnerabilities: Vulnerability[] = [];
    const patterns = this.patternCache.get('xss') || [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1];
        const column = match.index - content.lastIndexOf('\n', match.index);

        vulnerabilities.push({
          id: uuidv4(),
          type: 'xss',
          severity: 'high',
          title: 'Cross-Site Scripting (XSS)',
          description: 'Potential XSS vulnerability detected',
          file: path.relative(this.projectRoot, file),
          line: lineNumber,
          column,
          code: line.trim(),
          remediation: 'Use proper output encoding or React text content',
          cwe: 'CWE-79',
          owasp: 'A03:2021',
        });
      }
    });

    return vulnerabilities;
  }

  private async detectSQLInjection(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    const vulnerabilities: Vulnerability[] = [];
    const patterns = this.patternCache.get('sql') || [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1];
        const column = match.index - content.lastIndexOf('\n', match.index);

        vulnerabilities.push({
          id: uuidv4(),
          type: 'sql-injection',
          severity: 'critical',
          title: 'SQL Injection',
          description: 'Potential SQL injection vulnerability detected',
          file: path.relative(this.projectRoot, file),
          line: lineNumber,
          column,
          code: line.trim(),
          remediation: 'Use parameterized queries or prepared statements',
          cwe: 'CWE-89',
          owasp: 'A03:2021',
        });
      }
    });

    return vulnerabilities;
  }

  private async detectInsecureAuth(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    const vulnerabilities: Vulnerability[] = [];
    const patterns = this.patternCache.get('auth') || [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1];
        const column = match.index - content.lastIndexOf('\n', match.index);

        vulnerabilities.push({
          id: uuidv4(),
          type: 'insecure-auth',
          severity: 'high',
          title: 'Insecure Authentication',
          description: 'Weak or hardcoded authentication detected',
          file: path.relative(this.projectRoot, file),
          line: lineNumber,
          column,
          code: line.trim(),
          remediation: 'Implement proper authentication with secure token management',
          cwe: 'CWE-287',
          owasp: 'A07:2021',
        });
      }
    });

    return vulnerabilities;
  }

  private async detectHardcodedSecrets(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    const vulnerabilities: Vulnerability[] = [];
    const patterns = this.patternCache.get('secrets') || [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1];
        const column = match.index - content.lastIndexOf('\n', match.index);

        vulnerabilities.push({
          id: uuidv4(),
          type: 'hardcoded-secret',
          severity: 'critical',
          title: 'Hardcoded Secret',
          description: 'Sensitive information found in source code',
          file: path.relative(this.projectRoot, file),
          line: lineNumber,
          column,
          code: line.trim().substring(0, 50) + '...', // Truncate sensitive info
          remediation: 'Use environment variables or secure key management',
          cwe: 'CWE-798',
          owasp: 'A02:2021',
        });
      }
    });

    return vulnerabilities;
  }

  private async detectCSRF(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    const vulnerabilities: Vulnerability[] = [];
    const patterns = this.patternCache.get('csrf') || [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1];
        const column = match.index - content.lastIndexOf('\n', match.index);

        vulnerabilities.push({
          id: uuidv4(),
          type: 'csrf',
          severity: 'medium',
          title: 'Cross-Site Request Forgery (CSRF)',
          description: 'Missing CSRF protection on state-changing operation',
          file: path.relative(this.projectRoot, file),
          line: lineNumber,
          column,
          code: line.trim(),
          remediation: 'Implement CSRF token validation',
          cwe: 'CWE-352',
          owasp: 'A01:2021',
        });
      }
    });

    return vulnerabilities;
  }

  private async detectVulnerabilities(file: string): Promise<Vulnerability[]> {
    // Skip non-source files
    if (!this.isSourceFile(file)) return [];

    const vulnerabilities: Vulnerability[] = [];

    // Run all detection methods
    const detectors = [
      this.detectXSS.bind(this),
      this.detectSQLInjection.bind(this),
      this.detectInsecureAuth.bind(this),
      this.detectHardcodedSecrets.bind(this),
      this.detectCSRF.bind(this),
    ];

    for (const detector of detectors) {
      try {
        const vulns = await detector(file);
        vulnerabilities.push(...vulns);
      } catch (error) {
        // Continue scanning even if one detector fails
      }
    }

    return vulnerabilities;
  }

  private async scanFilesParallel(files: string[]): Promise<void> {
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(file => this.detectVulnerabilities(file)));
    }
  }

  private async getFilesToScan(): Promise<string[]> {
    const patterns = this.config.includePatterns || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const excludes = this.config.excludePaths || ['node_modules', 'dist', 'coverage', '.next'];
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: excludes,
        absolute: true,
      });
      files.push(...matches);
    }
    
    return files;
  }

  private isValidFilePath(filepath: string): boolean {
    // Prevent path traversal attacks
    const normalizedPath = path.normalize(filepath);
    return !normalizedPath.includes('..') && 
           !normalizedPath.startsWith('/etc') &&
           !normalizedPath.includes('\\Windows\\');
  }

  private isSourceFile(filepath: string): boolean {
    const ext = path.extname(filepath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  private groupVulnerabilitiesBySeverity(vulnerabilities: Vulnerability[]): Record<string, Vulnerability[]> {
    return vulnerabilities.reduce((acc, vuln) => {
      if (!acc[vuln.severity]) acc[vuln.severity] = [];
      acc[vuln.severity].push(vuln);
      return acc;
    }, {} as Record<string, Vulnerability[]>);
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new TimeoutError('Scan timeout exceeded')), this.timeout)
      ),
    ]);
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}