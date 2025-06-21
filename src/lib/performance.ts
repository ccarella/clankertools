export interface PerformanceMetrics<T = unknown> {
  duration: number;
  success: boolean;
  result?: T;
  error?: string;
  memoryUsage?: {
    before: MemoryInfo;
    after: MemoryInfo;
    delta: number;
  };
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface BundleSizeReport {
  passed: boolean;
  totalSize: number;
  files: Record<string, {
    size: number;
    limit?: number;
    passed: boolean;
    percentage: number;
    gzipEstimate?: number;
  }>;
  violations?: string[];
  summary?: {
    totalFiles: number;
    totalSize: number;
    largestFile: string;
    smallestFile: string;
  };
}

export interface MeasureOptions {
  includeMemory?: boolean;
}

export interface BundleSizeOptions {
  estimateGzip?: boolean;
}

/**
 * Measures the render time of a component
 */
export async function measureComponentRenderTime(
  componentName: string,
  renderFn: () => Promise<void>
): Promise<number> {
  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  const measureName = `${componentName}-render`;

  try {
    performance.mark(startMark);
    await renderFn();
    performance.mark(endMark);
    
    performance.measure(measureName, startMark, endMark);
    
    const entries = performance.getEntriesByName(measureName);
    const duration = entries.length > 0 ? entries[0].duration : 0;
    
    return duration;
  } finally {
    // Clean up performance marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }
}

/**
 * Measures the execution time of an async operation
 */
export async function measureAsyncOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: MeasureOptions = {}
): Promise<PerformanceMetrics<T>> {
  const startMark = `${operationName}-start`;
  const endMark = `${operationName}-end`;
  const measureName = `${operationName}-measure`;
  
  let memoryBefore: MemoryInfo | undefined;
  let memoryAfter: MemoryInfo | undefined;
  
  if (options.includeMemory) {
    memoryBefore = measureMemoryUsage() || undefined;
  }

  performance.mark(startMark);
  
  try {
    const result = await operation();
    performance.mark(endMark);
    
    if (options.includeMemory) {
      memoryAfter = measureMemoryUsage() || undefined;
    }
    
    performance.measure(measureName, startMark, endMark);
    
    const entries = performance.getEntriesByName(measureName);
    const duration = entries.length > 0 ? entries[0].duration : 0;
    
    const metrics: PerformanceMetrics<T> = {
      duration,
      success: true,
      result,
    };
    
    if (memoryBefore && memoryAfter) {
      metrics.memoryUsage = {
        before: memoryBefore,
        after: memoryAfter,
        delta: memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize,
      };
    }
    
    return metrics;
  } catch (error) {
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    
    const entries = performance.getEntriesByName(measureName);
    const duration = entries.length > 0 ? entries[0].duration : 0;
    
    return {
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }
}

/**
 * Checks bundle sizes against specified limits
 */
export function checkBundleSize(
  bundleSizes: Record<string, number>,
  limits: Record<string, number>,
  options: BundleSizeOptions = {}
): BundleSizeReport {
  const report: BundleSizeReport = {
    passed: true,
    totalSize: 0,
    files: {},
    violations: [],
  };

  let largestFile = '';
  let largestSize = 0;
  let smallestFile = '';
  let smallestSize = Infinity;

  // Check individual files
  for (const [filename, size] of Object.entries(bundleSizes)) {
    const limit = limits[filename];
    const passed = !limit || size <= limit;
    const percentage = limit ? (size / limit) * 100 : 0;
    
    report.files[filename] = {
      size,
      limit,
      passed,
      percentage,
    };
    
    if (options.estimateGzip) {
      // Estimate gzip size (roughly 30% of original)
      report.files[filename].gzipEstimate = Math.round(size * 0.3);
    }
    
    if (!passed) {
      report.passed = false;
      const excess = size - limit;
      report.violations!.push(
        `${filename} exceeds limit by ${Math.round(excess / 1024)}KB`
      );
    }
    
    report.totalSize += size;
    
    // Track largest and smallest files
    if (size > largestSize) {
      largestSize = size;
      largestFile = filename;
    }
    if (size < smallestSize) {
      smallestSize = size;
      smallestFile = filename;
    }
  }

  // Check total size limit
  if (limits.total && report.totalSize > limits.total) {
    report.passed = false;
    const excess = report.totalSize - limits.total;
    report.violations!.push(
      `Total bundle size exceeds limit by ${Math.round(excess / 1024)}KB`
    );
  }

  // Add summary
  report.summary = {
    totalFiles: Object.keys(bundleSizes).length,
    totalSize: report.totalSize,
    largestFile,
    smallestFile,
  };

  return report;
}

/**
 * Measures current memory usage
 */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export function measureMemoryUsage(): MemoryInfo | null {
  if (typeof performance === 'undefined' || !(performance as PerformanceWithMemory).memory) {
    return null;
  }

  const memory = (performance as PerformanceWithMemory).memory!;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
}

/**
 * Creates a performance observer for monitoring specific entry types
 */
export function createPerformanceObserver(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ entryTypes });
    return observer;
  } catch (error) {
    console.error('Failed to create PerformanceObserver:', error);
    return null;
  }
}

/**
 * Utility function to format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Utility to calculate performance score based on metrics
 */
export function calculatePerformanceScore(metrics: {
  FCP?: number;
  LCP?: number;
  FID?: number;
  CLS?: number;
  TTI?: number;
}): number {
  const weights = {
    FCP: 0.15,
    LCP: 0.25,
    FID: 0.3,
    CLS: 0.15,
    TTI: 0.15,
  };

  const thresholds = {
    FCP: { good: 1800, needs: 3000 },
    LCP: { good: 2500, needs: 4000 },
    FID: { good: 100, needs: 300 },
    CLS: { good: 0.1, needs: 0.25 },
    TTI: { good: 3800, needs: 7300 },
  };

  let score = 0;
  let totalWeight = 0;

  for (const [metric, value] of Object.entries(metrics)) {
    if (value === undefined) continue;
    
    const weight = weights[metric as keyof typeof weights];
    const threshold = thresholds[metric as keyof typeof thresholds];
    
    let metricScore = 0;
    if (metric === 'CLS') {
      // Lower is better for CLS
      if (value <= threshold.good) metricScore = 100;
      else if (value <= threshold.needs) {
        metricScore = 50 + 50 * ((threshold.needs - value) / (threshold.needs - threshold.good));
      }
    } else {
      // Lower is better for time metrics
      if (value <= threshold.good) metricScore = 100;
      else if (value <= threshold.needs) {
        metricScore = 50 + 50 * ((threshold.needs - value) / (threshold.needs - threshold.good));
      }
    }
    
    score += metricScore * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(score / totalWeight) : 0;
}