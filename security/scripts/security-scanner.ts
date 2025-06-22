import { redis } from '@/lib/redis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import { detectVulnerability } from './vulnerability-detector';
import { generateMarkdownReport, generateJsonReport, generateHtmlReport } from './report-generator';
import { storeScanResult, getScanResult as getStoredScanResult, listRecentScans as listStoredScans } from './storage';

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

interface SecurityScannerConfig {
  projectRoot: string;
  outputDir: string;
  redis: typeof redis;
  config?: ScanConfig;
  timeout?: number;
}

interface ContinuousMonitor {
  isRunning(): boolean;
  getInterval(): number;
  stop(): Promise<void>;
}

export class SecurityScanner {
  private config: SecurityScannerConfig;
  private vulnerabilityCache: Map<string, Vulnerability[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: SecurityScannerConfig) {
    if (!config.projectRoot) {
      throw new Error('Invalid project root');
    }
    if (!config.outputDir) {
      throw new Error('Invalid output directory');
    }
    this.config = config;
  }

  async scan(): Promise<ScanReport> {
    const startTime = Date.now();
    const scanId = `scan-${uuidv4()}`;

    try {
      if (this.config.timeout) {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Scan timeout after ${this.config.timeout}ms`)), this.config.timeout);
        });

        // Race between scan and timeout
        const report = await Promise.race([
          this.performScan(),
          timeoutPromise
        ]);
        
        report.scanId = scanId;
        await this.storeScanResult(report);
        return report;
      } else {
        const report = await this.performScan();
        report.scanId = scanId;
        await this.storeScanResult(report);
        return report;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        return this.createErrorReport(scanId, 'timeout', errorMessage);
      }
      
      return this.createErrorReport(scanId, 'failed', errorMessage);
    }
  }

  async scanFiles(files: string[]): Promise<ScanReport> {
    const startTime = Date.now();
    const scanId = `scan-${uuidv4()}`;

    // Validate file paths
    for (const file of files) {
      if (this.isInvalidPath(file)) {
        return this.createErrorReport(scanId, 'failed', 'Invalid file path detected');
      }
    }

    try {
      const report = await this.performScan(files);
      report.scanId = scanId;
      report.incrementalScan = true;
      report.targetFiles = files;
      await this.storeScanResult(report);
      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorReport(scanId, 'failed', errorMessage);
    }
  }

  async getScanResult(scanId: string): Promise<ScanReport | null> {
    try {
      return await getStoredScanResult(scanId, this.config.redis);
    } catch (error) {
      console.error('Error retrieving scan result:', error);
      return null;
    }
  }

  async listRecentScans(limit: number): Promise<ScanReport[]> {
    try {
      return await listStoredScans(limit, this.config.redis);
    } catch (error) {
      console.error('Error listing recent scans:', error);
      return [];
    }
  }

  async cleanupOldScans(daysOld: number): Promise<number> {
    const keys = await this.config.redis.keys('security:scan:*');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    
    for (const key of keys) {
      const reportStr = await this.config.redis.get(key);
      if (reportStr) {
        try {
          const report = JSON.parse(reportStr) as ScanReport;
          if (new Date(report.timestamp) < cutoffDate) {
            await this.config.redis.del(key);
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
    return generateMarkdownReport(report);
  }

  generateJsonReport(report: ScanReport): string {
    return generateJsonReport(report);
  }

  async generateHtmlReport(report: ScanReport): Promise<string> {
    return generateHtmlReport(report);
  }

  async saveReport(report: ScanReport, format: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `security-report-${report.scanId}-${timestamp}`;
    
    let content: string;
    let extension: string;
    
    switch (format) {
      case 'markdown':
        content = await this.generateMarkdownReport(report);
        extension = 'md';
        break;
      case 'json':
        content = this.generateJsonReport(report);
        extension = 'json';
        break;
      case 'html':
        content = await this.generateHtmlReport(report);
        extension = 'html';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    const outputPath = path.join(this.config.outputDir, `${filename}.${extension}`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf-8');
    
    return outputPath;
  }

  generateSummaryStatistics(reports: ScanReport[]): any {
    const totalVulnerabilities = reports.reduce((sum, report) => sum + report.summary.total, 0);
    const severityBreakdown = {
      critical: reports.reduce((sum, report) => sum + report.summary.critical, 0),
      high: reports.reduce((sum, report) => sum + report.summary.high, 0),
      medium: reports.reduce((sum, report) => sum + report.summary.medium, 0),
      low: reports.reduce((sum, report) => sum + report.summary.low, 0),
      info: reports.reduce((sum, report) => sum + report.summary.info, 0),
    };
    
    return {
      totalScans: reports.length,
      totalVulnerabilities,
      averageVulnerabilitiesPerScan: totalVulnerabilities / reports.length,
      severityBreakdown,
    };
  }

  startContinuousMonitoring(config: any): ContinuousMonitor {
    const { interval, paths, autoFix } = config;
    let isRunning = true;
    
    this.monitoringInterval = setInterval(async () => {
      if (isRunning) {
        await this.scan();
      }
    }, interval);
    
    return {
      isRunning: () => isRunning,
      getInterval: () => interval,
      stop: async () => {
        isRunning = false;
        if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
        }
      },
    };
  }

  private async performScan(targetFiles?: string[]): Promise<ScanReport> {
    const startTime = Date.now();
    const scanId = `scan-${uuidv4()}`;
    
    try {
      const files = targetFiles || await this.getAllFiles();
      const vulnerabilities: Vulnerability[] = [];
      
      await this.scanFilesParallel(files);
      
      // Collect vulnerabilities from cache
      for (const [file, vulns] of this.vulnerabilityCache) {
        vulnerabilities.push(...vulns);
      }
      
      const summary = this.aggregateVulnerabilities(vulnerabilities);
      
      return {
        scanId,
        timestamp: new Date().toISOString(),
        projectPath: this.config.projectRoot,
        vulnerabilities,
        summary,
        duration: Date.now() - startTime,
        scannedFiles: files.length,
        status: 'completed',
        config: this.config.config,
      };
    } catch (error) {
      throw error;
    }
  }

  private async storeScanResult(report: ScanReport): Promise<void> {
    await storeScanResult(report, this.config.redis);
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
    
    for (const vuln of vulnerabilities) {
      summary[vuln.severity]++;
    }
    
    return summary;
  }

  private async detectXSS(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    return detectVulnerability(content, file, 'xss');
  }

  private async detectSQLInjection(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    return detectVulnerability(content, file, 'sql-injection');
  }

  private async detectInsecureAuth(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    return detectVulnerability(content, file, 'insecure-auth');
  }

  private async detectHardcodedSecrets(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    return detectVulnerability(content, file, 'hardcoded-secret');
  }

  private async detectCSRF(file: string): Promise<Vulnerability[]> {
    const content = await fs.readFile(file, 'utf-8');
    return detectVulnerability(content, file, 'csrf');
  }

  private async detectVulnerabilities(file: string): Promise<Vulnerability[]> {
    // Check cache first
    if (this.vulnerabilityCache.has(file)) {
      return this.vulnerabilityCache.get(file)!;
    }
    
    const vulnerabilities: Vulnerability[] = [];
    
    if (this.shouldCheckForType('xss')) {
      vulnerabilities.push(...await this.detectXSS(file));
    }
    if (this.shouldCheckForType('sql-injection')) {
      vulnerabilities.push(...await this.detectSQLInjection(file));
    }
    if (this.shouldCheckForType('insecure-auth')) {
      vulnerabilities.push(...await this.detectInsecureAuth(file));
    }
    if (this.shouldCheckForType('hardcoded-secret')) {
      vulnerabilities.push(...await this.detectHardcodedSecrets(file));
    }
    if (this.shouldCheckForType('csrf')) {
      vulnerabilities.push(...await this.detectCSRF(file));
    }
    
    // Cache results
    this.vulnerabilityCache.set(file, vulnerabilities);
    
    return vulnerabilities;
  }

  private async scanFilesParallel(files: string[]): Promise<void> {
    const batchSize = 10;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(file => this.detectVulnerabilities(file)));
    }
  }

  private async getAllFiles(): Promise<string[]> {
    const patterns = this.config.config?.includePatterns || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const excludePaths = this.config.config?.excludePaths || ['node_modules', 'dist', 'coverage'];
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.config.projectRoot,
        absolute: true,
        ignore: excludePaths,
      });
      files.push(...matches);
    }
    
    return files;
  }

  private shouldCheckForType(type: string): boolean {
    if (!this.config.config?.enabledChecks) {
      return true;
    }
    return this.config.config.enabledChecks.includes(type);
  }

  private isInvalidPath(filePath: string): boolean {
    const invalidPatterns = [
      /\.\.\//,
      /^\/etc\//,
      /^\/usr\//,
      /^\/var\//,
      /^C:\\/i,
      /System32/i,
    ];
    
    return invalidPatterns.some(pattern => pattern.test(filePath));
  }

  private createErrorReport(scanId: string, status: 'failed' | 'timeout', error: string): ScanReport {
    return {
      scanId,
      timestamp: new Date().toISOString(),
      projectPath: this.config.projectRoot,
      vulnerabilities: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        total: 0,
      },
      duration: 0,
      scannedFiles: 0,
      status,
      error,
    };
  }
}

export async function runSecurityScan(config: SecurityScannerConfig): Promise<ScanReport> {
  const scanner = new SecurityScanner(config);
  return scanner.scan();
}

export async function runIncrementalScan(files: string[], config: SecurityScannerConfig): Promise<ScanReport> {
  const scanner = new SecurityScanner(config);
  return scanner.scanFiles(files);
}