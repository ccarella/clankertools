#!/usr/bin/env node

import { SecurityScanner, ScanConfig, ScanReport } from '../security-scanner';
import * as path from 'path';
import * as fs from 'fs/promises';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { redis } from '@/lib/redis';

interface CliOptions {
  output?: string;
  format?: string[];
  exclude?: string[];
  include?: string[];
  severity?: string;
  continuous?: boolean;
  interval?: number;
  list?: boolean;
  cleanup?: number;
  report?: string;
  stats?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

const formatBytes = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const severityColors = {
  critical: chalk.red,
  high: chalk.yellow,
  medium: chalk.blue,
  low: chalk.green,
  info: chalk.gray,
};

const printReport = (report: ScanReport, verbose: boolean = false) => {
  console.log('\n' + chalk.bold.underline('Security Scan Report'));
  console.log(chalk.gray(`Scan ID: ${report.scanId}`));
  console.log(chalk.gray(`Timestamp: ${new Date(report.timestamp).toLocaleString()}`));
  console.log(chalk.gray(`Duration: ${formatDuration(report.duration)}`));
  console.log(chalk.gray(`Files Scanned: ${report.scannedFiles}`));
  
  if (report.status !== 'completed') {
    console.log(chalk.red(`Status: ${report.status}`));
    if (report.error) {
      console.log(chalk.red(`Error: ${report.error}`));
    }
  }

  console.log('\n' + chalk.bold('Vulnerability Summary:'));
  console.log(severityColors.critical(`  Critical: ${report.summary.critical}`));
  console.log(severityColors.high(`  High: ${report.summary.high}`));
  console.log(severityColors.medium(`  Medium: ${report.summary.medium}`));
  console.log(severityColors.low(`  Low: ${report.summary.low}`));
  console.log(severityColors.info(`  Info: ${report.summary.info}`));
  console.log(chalk.bold(`  Total: ${report.summary.total}`));

  if (verbose && report.vulnerabilities.length > 0) {
    console.log('\n' + chalk.bold('Detailed Findings:'));
    
    const grouped = report.vulnerabilities.reduce((acc, vuln) => {
      if (!acc[vuln.severity]) acc[vuln.severity] = [];
      acc[vuln.severity].push(vuln);
      return acc;
    }, {} as Record<string, typeof report.vulnerabilities>);

    ['critical', 'high', 'medium', 'low', 'info'].forEach(severity => {
      const vulns = grouped[severity];
      if (!vulns || vulns.length === 0) return;

      console.log('\n' + severityColors[severity as keyof typeof severityColors](
        `${severity.toUpperCase()} (${vulns.length})`
      ));

      vulns.forEach((vuln, index) => {
        console.log(`\n  ${index + 1}. ${chalk.bold(vuln.title)}`);
        console.log(`     Type: ${vuln.type}`);
        console.log(`     File: ${vuln.file}:${vuln.line}:${vuln.column}`);
        console.log(`     Description: ${vuln.description}`);
        if (vuln.cwe) console.log(`     CWE: ${vuln.cwe}`);
        if (vuln.owasp) console.log(`     OWASP: ${vuln.owasp}`);
        console.log(`     Code: ${chalk.dim(vuln.code.substring(0, 80))}...`);
        console.log(`     Fix: ${chalk.green(vuln.remediation)}`);
      });
    });
  }
};

const main = async () => {
  program
    .name('security-scan')
    .description('Security scanner for ClankerTools')
    .version('1.0.0')
    .option('-o, --output <dir>', 'Output directory for reports', 'security/scans')
    .option('-f, --format <formats...>', 'Report formats (json, markdown, html)', ['json', 'markdown'])
    .option('-e, --exclude <paths...>', 'Paths to exclude from scanning')
    .option('-i, --include <patterns...>', 'File patterns to include')
    .option('-s, --severity <level>', 'Minimum severity level to report', 'low')
    .option('-c, --continuous', 'Run continuous monitoring')
    .option('--interval <ms>', 'Scan interval for continuous mode (ms)', '3600000')
    .option('-l, --list', 'List recent scans')
    .option('--cleanup <days>', 'Clean up scans older than N days')
    .option('-r, --report <scanId>', 'View a specific scan report')
    .option('--stats', 'Show statistics from recent scans')
    .option('-q, --quiet', 'Quiet mode - minimal output')
    .option('-v, --verbose', 'Verbose mode - detailed output')
    .parse(process.argv);

  const options = program.opts<CliOptions>();
  
  try {
    // Handle special commands first
    if (options.list) {
      await listScans();
      process.exit(0);
    }

    if (options.cleanup) {
      await cleanupScans(options.cleanup);
      process.exit(0);
    }

    if (options.report) {
      await viewReport(options.report, options.verbose || false);
      process.exit(0);
    }

    if (options.stats) {
      await showStats();
      process.exit(0);
    }

    // Run security scan
    const projectRoot = path.resolve(process.cwd());
    const outputDir = path.resolve(options.output || 'security/scans');

    const scanConfig: ScanConfig = {
      excludePaths: options.exclude || ['node_modules', 'dist', 'coverage', '.next', 'security/scans'],
      includePatterns: options.include || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      severityThreshold: options.severity as any,
    };

    const scanner = new SecurityScanner({
      projectRoot,
      outputDir,
      redis,
      config: scanConfig,
    });

    if (options.continuous) {
      console.log(chalk.blue('Starting continuous security monitoring...'));
      console.log(chalk.gray(`Scan interval: ${formatDuration(parseInt(String(options.interval || '3600000')))}`));
      
      const monitor = scanner.startContinuousMonitoring({
        interval: parseInt(String(options.interval || '3600000')),
        paths: [projectRoot],
        autoFix: false,
      });

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n' + chalk.yellow('Stopping continuous monitoring...'));
        await monitor.stop();
        process.exit(0);
      });

      // Keep process alive
      setInterval(() => {}, 1000);
    } else {
      // Single scan
      const spinner = !options.quiet ? ora('Running security scan...').start() : null;
      const startTime = Date.now();

      const report = await scanner.scan();
      
      if (spinner) {
        if (report.status === 'completed') {
          spinner.succeed(`Security scan completed in ${formatDuration(Date.now() - startTime)}`);
        } else {
          spinner.fail(`Security scan ${report.status}: ${report.error || 'Unknown error'}`);
        }
      }

      // Print report to console
      if (!options.quiet) {
        printReport(report, options.verbose);
      }

      // Save reports in requested formats
      const savedFiles: string[] = [];
      for (const format of options.format || ['json', 'markdown']) {
        const filepath = await scanner.saveReport(report, format as any);
        savedFiles.push(filepath);
      }

      if (!options.quiet && savedFiles.length > 0) {
        console.log('\n' + chalk.green('Reports saved:'));
        savedFiles.forEach(file => {
          console.log(chalk.gray(`  - ${file}`));
        });
      }

      // Exit with error code if vulnerabilities found
      if (report.summary.total > 0) {
        const threshold = options.severity || 'low';
        const thresholdOrder = ['info', 'low', 'medium', 'high', 'critical'];
        const thresholdIndex = thresholdOrder.indexOf(threshold);
        
        let hasViolations = false;
        for (let i = thresholdIndex; i < thresholdOrder.length; i++) {
          const severity = thresholdOrder[i] as keyof typeof report.summary;
          if (report.summary[severity] > 0) {
            hasViolations = true;
            break;
          }
        }

        if (hasViolations) {
          console.log('\n' + chalk.red(`Security vulnerabilities found above threshold (${threshold})`));
          process.exit(1);
        }
      }

      console.log('\n' + chalk.green('No security vulnerabilities found above threshold'));
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

const listScans = async () => {
  const projectRoot = path.resolve(process.cwd());
  const scanner = new SecurityScanner({
    projectRoot,
    outputDir: 'security/scans',
    redis,
  });

  const scans = await scanner.listRecentScans(20);
  
  if (scans.length === 0) {
    console.log(chalk.yellow('No recent scans found'));
    return;
  }

  console.log(chalk.bold(`Recent Security Scans (${scans.length}):\n`));
  
  scans.forEach(scan => {
    const status = scan.status === 'completed' 
      ? chalk.green(scan.status) 
      : chalk.red(scan.status);
    
    console.log(`${chalk.cyan(scan.scanId)}`);
    console.log(`  Date: ${new Date(scan.timestamp).toLocaleString()}`);
    console.log(`  Status: ${status}`);
    console.log(`  Files: ${scan.scannedFiles}`);
    console.log(`  Vulnerabilities: ${severityColors.critical(scan.summary.critical)} critical, ${severityColors.high(scan.summary.high)} high, ${severityColors.medium(scan.summary.medium)} medium`);
    console.log();
  });
};

const cleanupScans = async (days: number) => {
  const projectRoot = path.resolve(process.cwd());
  const scanner = new SecurityScanner({
    projectRoot,
    outputDir: 'security/scans',
    redis,
  });

  const spinner = ora(`Cleaning up scans older than ${days} days...`).start();
  const deleted = await scanner.cleanupOldScans(days);
  spinner.succeed(`Cleaned up ${deleted} old scan(s)`);
};

const viewReport = async (scanId: string, verbose: boolean) => {
  const projectRoot = path.resolve(process.cwd());
  const scanner = new SecurityScanner({
    projectRoot,
    outputDir: 'security/scans',
    redis,
  });

  const report = await scanner.getScanResult(scanId);
  
  if (!report) {
    console.log(chalk.red(`Scan report not found: ${scanId}`));
    return;
  }

  printReport(report, verbose);
};

const showStats = async () => {
  const projectRoot = path.resolve(process.cwd());
  const scanner = new SecurityScanner({
    projectRoot,
    outputDir: 'security/scans',
    redis,
  });

  const scans = await scanner.listRecentScans(100);
  
  if (scans.length === 0) {
    console.log(chalk.yellow('No scans found for statistics'));
    return;
  }

  const stats = scanner.generateSummaryStatistics(scans);
  
  console.log(chalk.bold('Security Scan Statistics\n'));
  console.log(`Total Scans: ${stats.totalScans}`);
  console.log(`Total Vulnerabilities: ${stats.totalVulnerabilities}`);
  console.log(`Average per Scan: ${stats.averageVulnerabilitiesPerScan.toFixed(1)}`);
  console.log('\nSeverity Breakdown:');
  console.log(severityColors.critical(`  Critical: ${stats.severityBreakdown.critical}`));
  console.log(severityColors.high(`  High: ${stats.severityBreakdown.high}`));
  console.log(severityColors.medium(`  Medium: ${stats.severityBreakdown.medium}`));
  console.log(severityColors.low(`  Low: ${stats.severityBreakdown.low}`));
  console.log(severityColors.info(`  Info: ${stats.severityBreakdown.info}`));

  // Trend analysis
  const recentScans = scans.slice(0, 10);
  const olderScans = scans.slice(10, 20);
  
  if (olderScans.length > 0) {
    const recentAvg = recentScans.reduce((sum, s) => sum + s.summary.total, 0) / recentScans.length;
    const olderAvg = olderScans.reduce((sum, s) => sum + s.summary.total, 0) / olderScans.length;
    const trend = recentAvg - olderAvg;
    
    console.log('\nTrend Analysis:');
    if (trend < 0) {
      console.log(chalk.green(`  ↓ Vulnerabilities decreasing (${Math.abs(trend).toFixed(1)} per scan)`));
    } else if (trend > 0) {
      console.log(chalk.red(`  ↑ Vulnerabilities increasing (${trend.toFixed(1)} per scan)`));
    } else {
      console.log(chalk.gray('  → Vulnerabilities stable'));
    }
  }
};

// Run the CLI
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});