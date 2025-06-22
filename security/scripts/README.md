# Security Scanner Scripts

This directory contains security scanning tools for the ClankerTools project.

## Overview

The security scanner performs comprehensive vulnerability detection across the codebase, checking for common security issues including:

- Cross-Site Scripting (XSS)
- SQL Injection
- Cross-Site Request Forgery (CSRF)
- Insecure Authentication
- Hardcoded Secrets
- Path Traversal vulnerabilities

## Installation

First, install the required dependencies:

```bash
npm install
```

## Usage

### Basic Scan

Run a basic security scan:

```bash
npm run security:scan
```

### Scan with All Report Formats

Generate reports in JSON, Markdown, and HTML:

```bash
npm run security:scan:report
```

### Quick Scan (JSON only, quiet mode)

For CI/CD integration:

```bash
npm run security:scan:quick
```

### Continuous Monitoring

Start continuous security monitoring:

```bash
npm run security:scan:watch
```

## Command Line Options

```bash
tsx security/scripts/run-scan.ts [options]
```

### Options:

- `-o, --output <dir>` - Output directory for reports (default: `security/scans`)
- `-f, --format <formats...>` - Report formats: json, markdown, html (default: `json markdown`)
- `-e, --exclude <paths...>` - Paths to exclude from scanning
- `-i, --include <patterns...>` - File patterns to include
- `-s, --severity <level>` - Minimum severity level to report (default: `low`)
- `-c, --continuous` - Run continuous monitoring
- `--interval <ms>` - Scan interval for continuous mode in milliseconds (default: `3600000`)
- `-l, --list` - List recent scans
- `--cleanup <days>` - Clean up scans older than N days
- `-r, --report <scanId>` - View a specific scan report
- `--stats` - Show statistics from recent scans
- `-q, --quiet` - Quiet mode - minimal output
- `-v, --verbose` - Verbose mode - detailed output
- `-h, --help` - Display help

## Examples

### Run scan with custom exclude patterns

```bash
tsx security/scripts/run-scan.ts -e node_modules dist coverage .next __tests__
```

### View a specific scan report

```bash
tsx security/scripts/run-scan.ts -r scan-abc123 -v
```

### Clean up old scans

```bash
tsx security/scripts/run-scan.ts --cleanup 30
```

### Show scan statistics

```bash
tsx security/scripts/run-scan.ts --stats
```

### Run scan with high severity threshold

```bash
tsx security/scripts/run-scan.ts -s high
```

## Report Formats

### JSON Report
- Machine-readable format
- Complete vulnerability details
- Suitable for integration with other tools

### Markdown Report
- Human-readable format
- Organized by severity
- Includes remediation guidance

### HTML Report
- Interactive web format
- Color-coded severity levels
- Easy to share with stakeholders

## Severity Levels

- **Critical** - Immediate action required
- **High** - Should be fixed as soon as possible
- **Medium** - Should be addressed in the near future
- **Low** - Can be addressed when convenient
- **Info** - Informational findings

## Exit Codes

- `0` - No vulnerabilities found above threshold
- `1` - Vulnerabilities found above threshold or error occurred

## Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
- name: Security Scan
  run: npm run security:scan:quick
  continue-on-error: false
```

## Storage

Scan results are stored in Redis with a 7-day retention period and can be retrieved using the scan ID.