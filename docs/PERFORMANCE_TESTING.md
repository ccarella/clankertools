# Performance Testing Guide

This document describes the performance testing utilities and patterns available in the ClankerTools codebase.

## Performance Utilities (`src/lib/performance.ts`)

### Core Functions

#### `measureComponentRenderTime(componentName, renderFn)`
Measures the render time of a React component.

```typescript
const renderTime = await measureComponentRenderTime('MyComponent', async () => {
  render(<MyComponent />);
});
// Returns render time in milliseconds
```

#### `measureAsyncOperation(operationName, operation, options)`
Measures execution time of async operations with optional memory tracking.

```typescript
const metrics = await measureAsyncOperation('fetchData', async () => {
  return await fetch('/api/data');
}, { includeMemory: true });
// Returns: { duration, success, result, memoryUsage? }
```

#### `checkBundleSize(bundleSizes, limits, options)`
Validates bundle sizes against specified limits.

```typescript
const report = checkBundleSize({
  'main.js': 200000,
  'vendor.js': 300000
}, {
  'main.js': 250000,
  'vendor.js': 400000,
  total: 700000
});
// Returns detailed report with pass/fail status
```

#### `createPerformanceObserver(entryTypes, callback)`
Creates a performance observer for monitoring specific metrics.

```typescript
const observer = createPerformanceObserver(['navigation', 'resource'], (entries) => {
  console.log('Performance entries:', entries);
});
```

## Performance Hook (`src/hooks/usePerformanceMonitor.ts`)

React hook for monitoring web vitals and performance metrics in components.

```typescript
const { metrics, recordMetric, getPerformanceScore } = usePerformanceMonitor({
  enableWebVitals: true,
  enableResourceTiming: true,
  enableMemoryMonitoring: true,
  reportCallback: (metrics) => console.log('Performance:', metrics)
});
```

### Monitored Metrics
- **Web Vitals**: FCP, LCP, FID, CLS, TTFB
- **Resource Timing**: Script, CSS, image loading times
- **Memory Usage**: Heap size and limits
- **Navigation Timing**: DOM load, interactive times

## Performance Thresholds

### Core Web Vitals
- **FCP (First Contentful Paint)**: < 1.8s (good), < 3s (needs improvement)
- **LCP (Largest Contentful Paint)**: < 2.5s (good), < 4s (needs improvement)
- **FID (First Input Delay)**: < 100ms (good), < 300ms (needs improvement)
- **CLS (Cumulative Layout Shift)**: < 0.1 (good), < 0.25 (needs improvement)
- **TTI (Time to Interactive)**: < 3.8s (good), < 7.3s (needs improvement)

### Bundle Size Limits
- **Main bundle**: 200KB
- **Vendor bundle**: 300KB
- **CSS**: 50KB
- **Total**: 600KB

### Mobile Network Targets
- **3G**: FCP < 3.9s, LCP < 6s, TTI < 12.5s
- **4G**: FCP < 2.1s, LCP < 3.5s, TTI < 5s
- **5G**: FCP < 1s, LCP < 1.8s, TTI < 2.5s

## Running Performance Tests

```bash
# Run all performance tests
npm test src/lib/__tests__/performance.test.ts

# Run specific performance test suites
npm test src/lib/__tests__/loading-thresholds.test.ts
npm test src/lib/__tests__/lazy-loading.test.tsx
npm test src/components/ui/__tests__/skeleton.test.tsx

# Analyze bundle size
npm run analyze
```

## Bundle Analysis

To analyze bundle sizes:

1. Set the ANALYZE environment variable:
   ```bash
   ANALYZE=true npm run build
   ```

2. View the generated reports in the browser

3. Compare against configured limits in `next.config.bundle-analyzer.js`

## Best Practices

1. **Test Mobile Performance**: Always test on mobile viewport sizes and network conditions
2. **Monitor Web Vitals**: Use the performance hook to track real user metrics
3. **Set Performance Budgets**: Define and enforce bundle size limits
4. **Lazy Load Components**: Use dynamic imports for non-critical components
5. **Use Skeleton Screens**: Show loading states immediately for better perceived performance

## Example: Testing Component Performance

```typescript
describe('MyComponent Performance', () => {
  it('renders within 16ms threshold', async () => {
    const renderTime = await measureComponentRenderTime('MyComponent', async () => {
      render(<MyComponent />);
    });
    
    expect(renderTime).toBeLessThan(16); // 60fps target
  });

  it('loads data within acceptable time', async () => {
    const metrics = await measureAsyncOperation('loadData', async () => {
      return await fetchComponentData();
    });
    
    expect(metrics.duration).toBeLessThan(1000); // 1s threshold
    expect(metrics.success).toBe(true);
  });
});
```

## Performance Monitoring in Production

Use the `usePerformanceMonitor` hook to track real user metrics:

```typescript
function App() {
  const { metrics, getPerformanceScore } = usePerformanceMonitor({
    reportCallback: (metrics) => {
      // Send to analytics service
      analytics.track('performance', {
        score: getPerformanceScore(),
        ...metrics
      });
    }
  });

  return <YourApp />;
}
```