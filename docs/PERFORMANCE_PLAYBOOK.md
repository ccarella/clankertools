# Performance Monitoring Playbook

## Overview

This playbook provides a comprehensive guide for conducting bi-weekly performance reviews of the ClankerTools application. Follow these procedures to monitor application speed, identify bottlenecks, and maintain optimal user experience.

## Quick Start Checklist

- [ ] Run Lighthouse audit
- [ ] Check bundle size metrics
- [ ] Review API response times
- [ ] Analyze Core Web Vitals
- [ ] Profile memory usage
- [ ] Monitor frame rates
- [ ] Generate performance report
- [ ] Create optimization tickets

## Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| First Contentful Paint (FCP) | < 1.8s | > 3s |
| Largest Contentful Paint (LCP) | < 2.5s | > 4s |
| Cumulative Layout Shift (CLS) | < 0.1 | > 0.25 |
| First Input Delay (FID) | < 100ms | > 300ms |
| Time to Interactive (TTI) | < 3.8s | > 7.3s |
| Total Blocking Time (TBT) | < 200ms | > 600ms |
| JavaScript Bundle Size | < 200KB | > 350KB |
| CSS Bundle Size | < 50KB | > 100KB |
| API Response Time (p95) | < 500ms | > 1000ms |
| Mobile Frame Rate | 60 fps | < 30 fps |

## Bi-Weekly Review Process

### 1. Automated Performance Audit (30 min)

Run the comprehensive performance audit script:

```bash
# Run all performance checks
npm run perf:audit

# Or run individual checks
npm run perf:lighthouse    # Lighthouse audit
npm run perf:bundle       # Bundle size analysis
npm run perf:api          # API performance check
npm run perf:runtime      # Runtime performance
```

### 2. Core Web Vitals Analysis (20 min)

#### Desktop Performance
```bash
# Run desktop Lighthouse audit
node scripts/lighthouse-audit.js --desktop

# Check results in: reports/lighthouse-desktop-[timestamp].html
```

#### Mobile Performance
```bash
# Run mobile Lighthouse audit (default)
node scripts/lighthouse-audit.js

# Check results in: reports/lighthouse-mobile-[timestamp].html
```

#### Real User Monitoring
```bash
# Analyze RUM data from last 2 weeks
node scripts/web-vitals-analyzer.js --period 14d

# Generate Core Web Vitals report
node scripts/performance-report.js --vitals
```

### 3. Bundle Size Analysis (15 min)

```bash
# Analyze current bundle sizes
node scripts/bundle-analyzer.js

# Compare with previous period
node scripts/bundle-analyzer.js --compare

# Check for large dependencies
node scripts/bundle-analyzer.js --dependencies
```

Key areas to check:
- Main bundle size growth
- New dependencies impact
- Code splitting effectiveness
- Tree shaking opportunities
- Unused code detection

### 4. API Performance Review (20 min)

```bash
# Run API performance tests
node scripts/api-performance-monitor.js

# Analyze endpoint response times
node scripts/api-performance-monitor.js --endpoints

# Check database query performance
node scripts/api-performance-monitor.js --queries
```

Focus areas:
- `/api/deploy/*` endpoints (critical path)
- `/api/token/[address]` response times
- Database connection pooling
- Redis cache hit rates
- External API dependencies (Clanker, IPFS)

### 5. Runtime Performance Profiling (25 min)

```bash
# Start runtime monitoring
node scripts/runtime-performance-monitor.js

# Profile specific user flows
node scripts/runtime-performance-monitor.js --flow token-creation
node scripts/runtime-performance-monitor.js --flow wallet-connection
```

Critical user flows to profile:
1. **Token Creation Flow**
   - Form rendering performance
   - Image upload and processing
   - Deploy transaction time
   
2. **Wallet Connection Flow**
   - Provider initialization
   - Connection handshake time
   - State update performance

3. **Token Details Page**
   - Initial data fetch
   - Chart rendering performance
   - Real-time updates efficiency

### 6. Memory Usage Analysis (15 min)

```bash
# Run memory profiling
node scripts/memory-profiler.js

# Check for memory leaks
node scripts/memory-profiler.js --leak-detection

# Analyze heap snapshots
node scripts/memory-profiler.js --heap-analysis
```

Common memory issues:
- Event listener leaks
- Detached DOM nodes
- Large object retention
- WebSocket connection cleanup
- Image caching problems

### 7. Mobile-Specific Performance (20 min)

```bash
# Run mobile performance suite
node scripts/mobile-performance.js

# Check touch responsiveness
node scripts/mobile-performance.js --touch

# Analyze scroll performance
node scripts/mobile-performance.js --scroll
```

Mobile checkpoints:
- Touch target sizes (min 44px)
- Scroll performance (60 fps)
- Gesture responsiveness
- Viewport rendering
- Network request optimization

## Optimization Workflow

### 1. Identify Issues

After running all performance checks, categorize issues by:
- **Critical**: Blocking user experience
- **High**: Noticeable performance degradation
- **Medium**: Optimization opportunities
- **Low**: Nice-to-have improvements

### 2. Root Cause Analysis

For each identified issue:
1. Reproduce in development
2. Profile with Chrome DevTools
3. Identify specific code/assets
4. Measure baseline metrics
5. Document findings

### 3. Implement Optimizations

Common optimization techniques:

#### JavaScript Optimizations
- Code splitting for large components
- Lazy loading non-critical features
- Memoization of expensive computations
- Debouncing/throttling event handlers
- Virtual scrolling for long lists

#### Asset Optimizations
- Image format optimization (WebP/AVIF)
- Responsive image loading
- Font subsetting and preloading
- CSS purging unused styles
- SVG optimization

#### Network Optimizations
- HTTP/2 push for critical resources
- Preconnect to external domains
- DNS prefetching
- Service worker caching
- API response compression

#### React Optimizations
- React.memo for pure components
- useMemo/useCallback hooks
- Suspense boundaries
- Progressive hydration
- State normalization

### 4. Validation

After implementing optimizations:
1. Re-run performance audits
2. Compare before/after metrics
3. Test on real devices
4. Monitor production metrics
5. Document improvements

## Performance Report Template

```markdown
# Performance Review - [Date]

## Executive Summary
- Overall performance score: [X/100]
- Critical issues found: [count]
- Improvements since last review: [list]

## Core Web Vitals
- LCP: [value] ([change]%)
- FID: [value] ([change]%)
- CLS: [value] ([change]%)

## Bundle Size Metrics
- Main bundle: [size] ([change]%)
- Total size: [size] ([change]%)
- Largest dependencies: [list]

## API Performance
- Average response time: [value]ms
- 95th percentile: [value]ms
- Slowest endpoints: [list]

## Identified Issues
1. [Issue description]
   - Impact: [Critical/High/Medium/Low]
   - Solution: [proposed fix]
   - Effort: [hours estimate]

## Recommended Actions
1. [Priority 1 action]
2. [Priority 2 action]
3. [Priority 3 action]

## Next Review Date: [Date]
```

## Automated Monitoring Setup

### GitHub Actions Integration

The performance monitoring workflow runs automatically:
- Every 2 weeks on Monday at 9 AM
- On demand via workflow dispatch
- After major deployments

### Alerting Thresholds

Automatic alerts trigger when:
- Performance score drops below 80
- Bundle size increases > 10%
- API response time > 1s (p95)
- Error rate > 1%

### Dashboard Access

Performance metrics dashboard:
- Vercel Analytics: [URL]
- Custom dashboard: `/admin/performance`
- Lighthouse reports: `/reports/`

## Troubleshooting Guide

### Common Issues

#### High LCP Values
1. Check image sizes and formats
2. Verify font loading strategy
3. Review server response times
4. Analyze render-blocking resources

#### Large Bundle Sizes
1. Run bundle analyzer
2. Check for duplicate dependencies
3. Review dynamic imports
4. Verify tree shaking config

#### Slow API Responses
1. Check database indexes
2. Review query complexity
3. Verify caching strategy
4. Monitor external API latency

#### Memory Leaks
1. Profile with Chrome DevTools
2. Check event listener cleanup
3. Review component unmounting
4. Analyze closure retention

## Best Practices

### Development
- Run performance checks before PRs
- Include performance impact in PR descriptions
- Test on low-end devices
- Monitor bundle size changes

### Code Review
- Flag performance-critical changes
- Request benchmarks for optimizations
- Review lazy loading boundaries
- Check for proper memoization

### Deployment
- Run Lighthouse in CI/CD
- Set performance budgets
- Monitor real user metrics
- A/B test major changes

## Resources

### Tools
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [WebPageTest](https://www.webpagetest.org/)

### Documentation
- [Web Vitals Guide](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Next.js Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)

### Internal Docs
- [Performance Utilities](/src/lib/performance/README.md)
- [Testing Guide](/docs/TESTING.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)

## Contact

For questions or improvements to this playbook:
- Create an issue with `performance` label
- Slack: #clankertools-performance
- Email: performance@clankertools.com