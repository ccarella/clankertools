import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  SecurityScanner, 
  Vulnerability, 
  ScanReport, 
  ScanSummary,
  ScanConfig 
} from '../scripts/security-scanner';
import { glob } from 'glob';

jest.mock('@/lib/redis', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  }
}));
jest.mock('fs/promises');
jest.mock('glob');

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;
  let mockRedis: any;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked redis from the module
    const { redis } = require('@/lib/redis');
    mockRedis = redis;
    
    // Mock glob to return empty array by default
    (glob as jest.Mock).mockResolvedValue([]);
    
    // Mock fs.readFile to return empty content by default
    mockFs.readFile.mockResolvedValue('');
    
    scanner = new SecurityScanner({
      projectRoot: '/test/project',
      outputDir: '/test/output',
      redis: mockRedis,
    });
  });

  describe('Security Scan Execution', () => {
    it('should execute a complete security scan', async () => {
      const mockReport: ScanReport = {
        scanId: 'scan-123',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1234,
        scannedFiles: 100,
        status: 'completed',
      };

      jest.spyOn(scanner as any, 'performScan').mockResolvedValue(mockReport);
      mockRedis.set.mockResolvedValue('OK');

      const result = await scanner.scan();

      expect(result).toEqual(mockReport);
      expect(scanner['performScan']).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        `security:scan:${mockReport.scanId}`,
        JSON.stringify(mockReport),
        { ex: 7 * 24 * 60 * 60 } // 7 days
      );
    });

    it('should handle scan with vulnerabilities found', async () => {
      const vulnerabilities: Vulnerability[] = [
        {
          id: 'vuln-001',
          type: 'xss',
          severity: 'high',
          title: 'Cross-Site Scripting (XSS)',
          description: 'Unescaped user input in HTML output',
          file: '/test/project/src/components/UserProfile.tsx',
          line: 42,
          column: 15,
          code: '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
          remediation: 'Use proper HTML escaping or React text content',
          cwe: 'CWE-79',
          owasp: 'A03:2021',
        },
        {
          id: 'vuln-002',
          type: 'sql-injection',
          severity: 'critical',
          title: 'SQL Injection',
          description: 'Direct string concatenation in SQL query',
          file: '/test/project/src/api/users.ts',
          line: 87,
          column: 23,
          code: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
          remediation: 'Use parameterized queries',
          cwe: 'CWE-89',
          owasp: 'A03:2021',
        },
      ];

      const mockReport: ScanReport = {
        scanId: 'scan-456',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities,
        summary: {
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
          total: 2,
        },
        duration: 2345,
        scannedFiles: 150,
        status: 'completed',
      };

      jest.spyOn(scanner as any, 'performScan').mockResolvedValue(mockReport);

      const result = await scanner.scan();

      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.summary.critical).toBe(1);
      expect(result.summary.high).toBe(1);
      expect(result.summary.total).toBe(2);
    });

    it('should execute incremental scan for specific files', async () => {
      const targetFiles = [
        '/test/project/src/api/deploy.ts',
        '/test/project/src/components/WalletConnect.tsx',
      ];

      const mockReport: ScanReport = {
        scanId: 'scan-789',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 500,
        scannedFiles: 2,
        status: 'completed',
        incrementalScan: true,
        targetFiles,
      };

      jest.spyOn(scanner as any, 'performScan').mockResolvedValue(mockReport);

      const result = await scanner.scanFiles(targetFiles);

      expect(result.incrementalScan).toBe(true);
      expect(result.targetFiles).toEqual(targetFiles);
      expect(result.scannedFiles).toBe(2);
    });

    it('should support custom scan configurations', async () => {
      const customConfig = {
        excludePaths: ['node_modules', 'dist', 'coverage'],
        includePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        severityThreshold: 'medium' as const,
        enabledChecks: ['xss', 'sql-injection', 'path-traversal'],
      };

      const scannerWithConfig = new SecurityScanner({
        projectRoot: '/test/project',
        outputDir: '/test/output',
        redis: mockRedis,
        config: customConfig,
      });

      const mockReport: ScanReport = {
        scanId: 'scan-custom',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1500,
        scannedFiles: 80,
        status: 'completed',
        config: customConfig,
      };

      jest.spyOn(scannerWithConfig as any, 'performScan').mockResolvedValue(mockReport);

      const result = await scannerWithConfig.scan();

      expect(result.config).toEqual(customConfig);
    });
  });

  describe('Vulnerability Detection', () => {
    it('should detect XSS vulnerabilities', async () => {
      const xssVulnerability: Vulnerability = {
        id: 'xss-001',
        type: 'xss',
        severity: 'high',
        title: 'Cross-Site Scripting (XSS)',
        description: 'Unescaped user input in HTML output',
        file: '/test/project/src/pages/profile.tsx',
        line: 25,
        column: 10,
        code: 'innerHTML = userData.bio',
        remediation: 'Use textContent or proper escaping',
        cwe: 'CWE-79',
        owasp: 'A03:2021',
      };

      jest.spyOn(scanner as any, 'detectXSS').mockResolvedValue([xssVulnerability]);

      const vulnerabilities = await scanner['detectXSS']('/test/project/src/pages/profile.tsx');

      expect(vulnerabilities).toHaveLength(1);
      expect(vulnerabilities[0].type).toBe('xss');
      expect(vulnerabilities[0].severity).toBe('high');
    });

    it('should detect SQL injection vulnerabilities', async () => {
      const sqlInjectionVulnerability: Vulnerability = {
        id: 'sql-001',
        type: 'sql-injection',
        severity: 'critical',
        title: 'SQL Injection',
        description: 'Unsanitized user input in SQL query',
        file: '/test/project/src/api/database.ts',
        line: 45,
        column: 15,
        code: 'db.query(`SELECT * FROM tokens WHERE id = ${tokenId}`)',
        remediation: 'Use parameterized queries or prepared statements',
        cwe: 'CWE-89',
        owasp: 'A03:2021',
      };

      jest.spyOn(scanner as any, 'detectSQLInjection').mockResolvedValue([sqlInjectionVulnerability]);

      const vulnerabilities = await scanner['detectSQLInjection']('/test/project/src/api/database.ts');

      expect(vulnerabilities).toHaveLength(1);
      expect(vulnerabilities[0].type).toBe('sql-injection');
      expect(vulnerabilities[0].severity).toBe('critical');
    });

    it('should detect insecure authentication patterns', async () => {
      const authVulnerability: Vulnerability = {
        id: 'auth-001',
        type: 'insecure-auth',
        severity: 'high',
        title: 'Insecure Authentication',
        description: 'Weak authentication implementation',
        file: '/test/project/src/middleware/auth.ts',
        line: 15,
        column: 5,
        code: 'if (request.headers.token === "admin123")',
        remediation: 'Implement proper JWT or OAuth authentication',
        cwe: 'CWE-287',
        owasp: 'A07:2021',
      };

      jest.spyOn(scanner as any, 'detectInsecureAuth').mockResolvedValue([authVulnerability]);

      const vulnerabilities = await scanner['detectInsecureAuth']('/test/project/src/middleware/auth.ts');

      expect(vulnerabilities).toHaveLength(1);
      expect(vulnerabilities[0].type).toBe('insecure-auth');
    });

    it('should detect hardcoded secrets', async () => {
      const secretVulnerability: Vulnerability = {
        id: 'secret-001',
        type: 'hardcoded-secret',
        severity: 'critical',
        title: 'Hardcoded Secret',
        description: 'API key found in source code',
        file: '/test/project/src/config/api.ts',
        line: 8,
        column: 12,
        code: 'const API_KEY = "sk_live_abcd1234efgh5678"',
        remediation: 'Use environment variables for secrets',
        cwe: 'CWE-798',
        owasp: 'A02:2021',
      };

      jest.spyOn(scanner as any, 'detectHardcodedSecrets').mockResolvedValue([secretVulnerability]);

      const vulnerabilities = await scanner['detectHardcodedSecrets']('/test/project/src/config/api.ts');

      expect(vulnerabilities).toHaveLength(1);
      expect(vulnerabilities[0].type).toBe('hardcoded-secret');
      expect(vulnerabilities[0].severity).toBe('critical');
    });

    it('should detect CSRF vulnerabilities', async () => {
      const csrfVulnerability: Vulnerability = {
        id: 'csrf-001',
        type: 'csrf',
        severity: 'medium',
        title: 'Cross-Site Request Forgery (CSRF)',
        description: 'Missing CSRF token validation',
        file: '/test/project/src/api/transfer.ts',
        line: 32,
        column: 8,
        code: 'router.post("/transfer", async (req, res) => {',
        remediation: 'Implement CSRF token validation',
        cwe: 'CWE-352',
        owasp: 'A01:2021',
      };

      jest.spyOn(scanner as any, 'detectCSRF').mockResolvedValue([csrfVulnerability]);

      const vulnerabilities = await scanner['detectCSRF']('/test/project/src/api/transfer.ts');

      expect(vulnerabilities).toHaveLength(1);
      expect(vulnerabilities[0].type).toBe('csrf');
    });

    it('should aggregate vulnerabilities by severity', async () => {
      const vulnerabilities: Vulnerability[] = [
        { severity: 'critical' } as Vulnerability,
        { severity: 'critical' } as Vulnerability,
        { severity: 'high' } as Vulnerability,
        { severity: 'medium' } as Vulnerability,
        { severity: 'medium' } as Vulnerability,
        { severity: 'medium' } as Vulnerability,
        { severity: 'low' } as Vulnerability,
        { severity: 'info' } as Vulnerability,
      ];

      const summary = scanner['aggregateVulnerabilities'](vulnerabilities);

      expect(summary).toEqual({
        critical: 2,
        high: 1,
        medium: 3,
        low: 1,
        info: 1,
        total: 8,
      });
    });
  });

  describe('Scan Result Storage and Retrieval', () => {
    it('should store scan results in Redis', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-store-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      mockRedis.set.mockResolvedValue('OK');

      await scanner['storeScanResult'](scanReport);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `security:scan:${scanReport.scanId}`,
        JSON.stringify(scanReport),
        { ex: 7 * 24 * 60 * 60 }
      );
    });

    it('should retrieve scan results from Redis', async () => {
      const scanId = 'scan-retrieve-001';
      const storedReport: ScanReport = {
        scanId,
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(storedReport));

      const result = await scanner.getScanResult(scanId);

      expect(result).toEqual(storedReport);
      expect(mockRedis.get).toHaveBeenCalledWith(`security:scan:${scanId}`);
    });

    it('should return null for non-existent scan results', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await scanner.getScanResult('non-existent-scan');

      expect(result).toBeNull();
    });

    it('should list recent scan results', async () => {
      const scanIds = ['scan-001', 'scan-002', 'scan-003'];
      mockRedis.keys.mockResolvedValue(scanIds.map(id => `security:scan:${id}`));

      const reports: ScanReport[] = scanIds.map(id => ({
        scanId: id,
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      }));

      reports.forEach((report, index) => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify(report));
      });

      const results = await scanner.listRecentScans(10);

      expect(results).toHaveLength(3);
      expect(mockRedis.keys).toHaveBeenCalledWith('security:scan:*');
    });

    it('should handle storage failures gracefully', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-fail-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(scanner['storeScanResult'](scanReport)).rejects.toThrow('Redis connection failed');
    });

    it('should clean up old scan results', async () => {
      const oldScanIds = Array.from({ length: 20 }, (_, i) => `security:scan:old-${i}`);
      mockRedis.keys.mockResolvedValue(oldScanIds);

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      oldScanIds.forEach((key, index) => {
        const report: ScanReport = {
          scanId: `old-${index}`,
          timestamp: oneMonthAgo.toISOString(),
          projectPath: '/test/project',
          vulnerabilities: [],
          summary: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
            total: 0,
          },
          duration: 1000,
          scannedFiles: 50,
          status: 'completed',
        };
        mockRedis.get.mockResolvedValueOnce(JSON.stringify(report));
      });

      mockRedis.del.mockResolvedValue(1);

      const deletedCount = await scanner.cleanupOldScans(30); // 30 days

      expect(deletedCount).toBe(20);
      expect(mockRedis.del).toHaveBeenCalledTimes(20);
    });
  });

  describe('Report Generation and Formatting', () => {
    it('should generate markdown report', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-md-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [
          {
            id: 'vuln-001',
            type: 'xss',
            severity: 'high',
            title: 'Cross-Site Scripting (XSS)',
            description: 'Unescaped user input',
            file: '/src/components/Profile.tsx',
            line: 42,
            column: 15,
            code: '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
            remediation: 'Use proper escaping',
            cwe: 'CWE-79',
            owasp: 'A03:2021',
          },
        ],
        summary: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
          total: 1,
        },
        duration: 1234,
        scannedFiles: 100,
        status: 'completed',
      };

      const markdown = await scanner.generateMarkdownReport(scanReport);

      expect(markdown).toContain('# Security Scan Report');
      expect(markdown).toContain('Scan ID: scan-md-001');
      expect(markdown).toContain('Total Vulnerabilities: 1');
      expect(markdown).toContain('Cross-Site Scripting (XSS)');
      expect(markdown).toContain('**Severity:** high');
      expect(markdown).toContain('**File:** /src/components/Profile.tsx');
      expect(markdown).toContain('**Line:** 42');
    });

    it('should generate JSON report', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-json-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      const jsonReport = scanner.generateJsonReport(scanReport);

      expect(JSON.parse(jsonReport)).toEqual(scanReport);
    });

    it('should generate HTML report', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-html-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [
          {
            id: 'vuln-001',
            type: 'xss',
            severity: 'high',
            title: 'Cross-Site Scripting (XSS)',
            description: 'Unescaped user input',
            file: '/src/components/Profile.tsx',
            line: 42,
            column: 15,
            code: '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
            remediation: 'Use proper escaping',
            cwe: 'CWE-79',
            owasp: 'A03:2021',
          },
        ],
        summary: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
          total: 1,
        },
        duration: 1234,
        scannedFiles: 100,
        status: 'completed',
      };

      const html = await scanner.generateHtmlReport(scanReport);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Security Scan Report</title>');
      expect(html).toContain('scan-html-001');
      expect(html).toContain('Cross-Site Scripting (XSS)');
      expect(html).toContain('class="severity-high"');
    });

    it('should save report to file system', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-save-001',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const reportPath = await scanner.saveReport(scanReport, 'markdown');

      expect(reportPath).toContain('scan-save-001');
      expect(reportPath).toContain('.md');
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should generate summary statistics', () => {
      const scanReports: ScanReport[] = [
        {
          scanId: 'scan-001',
          timestamp: new Date().toISOString(),
          projectPath: '/test/project',
          vulnerabilities: [],
          summary: {
            critical: 2,
            high: 3,
            medium: 5,
            low: 1,
            info: 0,
            total: 11,
          },
          duration: 1000,
          scannedFiles: 100,
          status: 'completed',
        },
        {
          scanId: 'scan-002',
          timestamp: new Date().toISOString(),
          projectPath: '/test/project',
          vulnerabilities: [],
          summary: {
            critical: 1,
            high: 2,
            medium: 3,
            low: 4,
            info: 5,
            total: 15,
          },
          duration: 1500,
          scannedFiles: 120,
          status: 'completed',
        },
      ];

      const stats = scanner.generateSummaryStatistics(scanReports);

      expect(stats.totalScans).toBe(2);
      expect(stats.totalVulnerabilities).toBe(26);
      expect(stats.averageVulnerabilitiesPerScan).toBe(13);
      expect(stats.severityBreakdown.critical).toBe(3);
      expect(stats.severityBreakdown.high).toBe(5);
      expect(stats.severityBreakdown.medium).toBe(8);
      expect(stats.severityBreakdown.low).toBe(5);
      expect(stats.severityBreakdown.info).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle scan failures gracefully', async () => {
      jest.spyOn(scanner as any, 'performScan').mockRejectedValue(new Error('Scan engine failed'));

      const result = await scanner.scan();

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Scan engine failed');
      expect(result.vulnerabilities).toEqual([]);
    });

    it('should timeout long-running scans', async () => {
      jest.spyOn(scanner as any, 'performScan').mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const scannerWithTimeout = new SecurityScanner({
        projectRoot: '/test/project',
        outputDir: '/test/output',
        redis: mockRedis,
        timeout: 100, // 100ms timeout
      });

      const result = await scannerWithTimeout.scan();

      expect(result.status).toBe('timeout');
      expect(result.error).toContain('timeout');
    });

    it('should handle invalid file paths', async () => {
      const invalidFiles = [
        '../../../etc/passwd',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM',
      ];

      const result = await scanner.scanFiles(invalidFiles);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Invalid file path');
    });

    it('should handle corrupted scan data', async () => {
      mockRedis.get.mockResolvedValue('{ invalid json');

      const result = await scanner.getScanResult('corrupted-scan');

      expect(result).toBeNull();
    });

    it('should validate scan configuration', () => {
      expect(() => {
        new SecurityScanner({
          projectRoot: '',
          outputDir: '/test/output',
          redis: mockRedis,
        });
      }).toThrow('Invalid project root');

      expect(() => {
        new SecurityScanner({
          projectRoot: '/test/project',
          outputDir: '',
          redis: mockRedis,
        });
      }).toThrow('Invalid output directory');
    });

    it('should handle file system errors during report generation', async () => {
      const scanReport: ScanReport = {
        scanId: 'scan-fs-error',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 1000,
        scannedFiles: 50,
        status: 'completed',
      };

      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(scanner.saveReport(scanReport, 'markdown')).rejects.toThrow('Disk full');
    });
  });

  describe('Performance and Optimization', () => {
    it('should batch process files for better performance', async () => {
      const files = Array.from({ length: 1000 }, (_, i) => `/test/project/file-${i}.ts`);
      
      jest.spyOn(scanner as any, 'performScan').mockResolvedValue({
        scanId: 'scan-batch',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
        duration: 5000,
        scannedFiles: 1000,
        status: 'completed',
      });

      const result = await scanner.scanFiles(files);

      expect(result.scannedFiles).toBe(files.length);
      expect(result.duration).toBeDefined();
    });

    it('should cache vulnerability patterns for repeated scans', async () => {
      const file = '/test/project/src/api/endpoint.ts';
      
      // First scan
      jest.spyOn(scanner as any, 'detectVulnerabilities').mockResolvedValue([]);
      await scanner['detectVulnerabilities'](file);

      // Second scan should use cache
      const cachedResult = await scanner['detectVulnerabilities'](file);
      
      expect(scanner['detectVulnerabilities']).toHaveBeenCalledTimes(1);
    });

    it('should support parallel vulnerability detection', async () => {
      const files = [
        '/test/project/src/api/auth.ts',
        '/test/project/src/api/users.ts',
        '/test/project/src/api/tokens.ts',
      ];

      const detectSpy = jest.spyOn(scanner as any, 'detectVulnerabilities')
        .mockResolvedValue([]);

      await scanner['scanFilesParallel'](files);

      expect(detectSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration Tests', () => {
    it('should perform end-to-end scan with report generation', async () => {
      const mockReport: ScanReport = {
        scanId: 'scan-e2e',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        vulnerabilities: [
          {
            id: 'vuln-001',
            type: 'xss',
            severity: 'high',
            title: 'Cross-Site Scripting (XSS)',
            description: 'Unescaped user input',
            file: '/src/components/Profile.tsx',
            line: 42,
            column: 15,
            code: '<div dangerouslySetInnerHTML={{ __html: userInput }} />',
            remediation: 'Use proper escaping',
            cwe: 'CWE-79',
            owasp: 'A03:2021',
          },
        ],
        summary: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
          total: 1,
        },
        duration: 2500,
        scannedFiles: 150,
        status: 'completed',
      };

      jest.spyOn(scanner as any, 'performScan').mockResolvedValue(mockReport);
      mockRedis.set.mockResolvedValue('OK');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      // Perform scan
      const scanResult = await scanner.scan();
      expect(scanResult.scanId).toMatch(/^scan-[a-f0-9-]+$/);

      // Save reports in different formats
      const mdPath = await scanner.saveReport(scanResult, 'markdown');
      const jsonPath = await scanner.saveReport(scanResult, 'json');
      const htmlPath = await scanner.saveReport(scanResult, 'html');

      expect(mdPath).toContain('.md');
      expect(jsonPath).toContain('.json');
      expect(htmlPath).toContain('.html');

      // Retrieve scan result
      mockRedis.get.mockResolvedValue(JSON.stringify(scanResult));
      const retrieved = await scanner.getScanResult(scanResult.scanId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.scanId).toBe(scanResult.scanId);
    });

    it('should support continuous monitoring mode', async () => {
      const monitor = scanner.startContinuousMonitoring({
        interval: 3600000, // 1 hour
        paths: ['/test/project/src'],
        autoFix: false,
      });

      expect(monitor.isRunning()).toBe(true);
      expect(monitor.getInterval()).toBe(3600000);

      await monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });
  });
});

