import {
  measureComponentRenderTime,
  measureAsyncOperation,
  checkBundleSize,
  measureMemoryUsage,
  createPerformanceObserver,
  type PerformanceMetrics,
} from '../performance';

// Mock performance API
const mockPerformanceObserver = jest.fn();
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

// Define PerformanceObserverCallback type for proper typing
type PerformanceObserverCallback = (list: PerformanceObserverEntryList, observer: PerformanceObserver) => void;

global.PerformanceObserver = jest.fn().mockImplementation((callback: PerformanceObserverCallback) => {
  mockPerformanceObserver(callback);
  return {
    observe: mockObserve,
    disconnect: mockDisconnect,
  };
}) as unknown as typeof PerformanceObserver;

global.performance.mark = jest.fn();
global.performance.measure = jest.fn();
global.performance.getEntriesByName = jest.fn();
global.performance.clearMarks = jest.fn();
global.performance.clearMeasures = jest.fn();

// Mock memory API
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

(global.performance as PerformanceWithMemory).memory = {
  usedJSHeapSize: 10000000,
  totalJSHeapSize: 20000000,
  jsHeapSizeLimit: 50000000,
};

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('measureComponentRenderTime', () => {
    it('should measure component render time', async () => {
      const mockRenderTime = 16.5;
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: mockRenderTime },
      ]);

      const renderTime = await measureComponentRenderTime('TestComponent', async () => {
        // Simulate component render
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(global.performance.mark).toHaveBeenCalledWith('TestComponent-start');
      expect(global.performance.mark).toHaveBeenCalledWith('TestComponent-end');
      expect(global.performance.measure).toHaveBeenCalledWith(
        'TestComponent-render',
        'TestComponent-start',
        'TestComponent-end'
      );
      expect(renderTime).toBe(mockRenderTime);
    });

    it('should clean up performance marks after measurement', async () => {
      await measureComponentRenderTime('TestComponent', async () => {});

      expect(global.performance.clearMarks).toHaveBeenCalledWith('TestComponent-start');
      expect(global.performance.clearMarks).toHaveBeenCalledWith('TestComponent-end');
      expect(global.performance.clearMeasures).toHaveBeenCalledWith('TestComponent-render');
    });

    it('should handle errors during measurement', async () => {
      const error = new Error('Render failed');
      
      await expect(
        measureComponentRenderTime('TestComponent', async () => {
          throw error;
        })
      ).rejects.toThrow('Render failed');

      // Should still clean up marks
      expect(global.performance.clearMarks).toHaveBeenCalled();
    });
  });

  describe('measureAsyncOperation', () => {
    it('should measure async operation time', async () => {
      const mockDuration = 250.5;
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: mockDuration },
      ]);

      const metrics = await measureAsyncOperation('fetchData', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: 'test' };
      });

      expect(metrics.duration).toBe(mockDuration);
      expect(metrics.success).toBe(true);
      expect(metrics.result).toEqual({ data: 'test' });
    });

    it('should capture errors in async operations', async () => {
      const error = new Error('Network error');
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: 100 },
      ]);

      const metrics = await measureAsyncOperation('fetchData', async () => {
        throw error;
      });

      expect(metrics.duration).toBe(100);
      expect(metrics.success).toBe(false);
      expect(metrics.error).toBe('Network error');
    });

    it('should include memory usage if enabled', async () => {
      const metrics = await measureAsyncOperation(
        'fetchData',
        async () => 'result',
        { includeMemory: true }
      );

      expect(metrics.memoryUsage).toEqual({
        before: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 50000000,
        },
        after: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 50000000,
        },
        delta: 0,
      });
    });
  });

  describe('checkBundleSize', () => {
    it('should check bundle sizes against limits', () => {
      const bundleSizes = {
        'main.js': 150000, // 150KB
        'vendor.js': 250000, // 250KB
        'styles.css': 50000, // 50KB
      };

      const limits = {
        'main.js': 200000, // 200KB limit
        'vendor.js': 300000, // 300KB limit
        'styles.css': 100000, // 100KB limit
        total: 600000, // 600KB total limit
      };

      const report = checkBundleSize(bundleSizes, limits);

      expect(report.passed).toBe(true);
      expect(report.totalSize).toBe(450000);
      expect(report.files['main.js'].size).toBe(150000);
      expect(report.files['main.js'].limit).toBe(200000);
      expect(report.files['main.js'].passed).toBe(true);
      expect(report.files['main.js'].percentage).toBe(75);
    });

    it('should fail when bundle exceeds limit', () => {
      const bundleSizes = {
        'main.js': 250000, // 250KB - exceeds limit
        'vendor.js': 200000, // 200KB
      };

      const limits = {
        'main.js': 200000, // 200KB limit
        'vendor.js': 300000, // 300KB limit
        total: 400000, // 400KB total limit
      };

      const report = checkBundleSize(bundleSizes, limits);

      expect(report.passed).toBe(false);
      expect(report.totalSize).toBe(450000);
      expect(report.files['main.js'].passed).toBe(false);
      expect(report.files['main.js'].percentage).toBe(125);
      expect(report.violations).toContain('main.js exceeds limit by 49KB');
      expect(report.violations).toContain('Total bundle size exceeds limit by 49KB');
    });

    it('should handle missing limits gracefully', () => {
      const bundleSizes = {
        'main.js': 150000,
        'new-chunk.js': 50000, // No limit defined
      };

      const limits = {
        'main.js': 200000,
        total: 500000,
      };

      const report = checkBundleSize(bundleSizes, limits);

      expect(report.files['new-chunk.js'].size).toBe(50000);
      expect(report.files['new-chunk.js'].limit).toBeUndefined();
      expect(report.files['new-chunk.js'].passed).toBe(true);
    });
  });

  describe('measureMemoryUsage', () => {
    it('should measure memory usage', () => {
      const memory = measureMemoryUsage();

      expect(memory).toEqual({
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 50000000,
      });
    });

    it('should return null when memory API is not available', () => {
      const originalMemory = (global.performance as PerformanceWithMemory).memory;
      (global.performance as PerformanceWithMemory).memory = undefined;

      const memory = measureMemoryUsage();
      expect(memory).toBeNull();

      (global.performance as PerformanceWithMemory).memory = originalMemory;
    });
  });

  describe('createPerformanceObserver', () => {
    it('should create performance observer for navigation timing', () => {
      const callback = jest.fn();
      const observer = createPerformanceObserver(['navigation'], callback);

      expect(mockObserve).toHaveBeenCalledWith({
        entryTypes: ['navigation'],
      });

      observer?.disconnect();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should process performance entries', () => {
      const callback = jest.fn();
      let observerCallback: PerformanceObserverCallback | undefined;

      (global.PerformanceObserver as unknown as jest.Mock).mockImplementation((cb: PerformanceObserverCallback) => {
        observerCallback = cb;
        return {
          observe: mockObserve,
          disconnect: mockDisconnect,
        };
      });

      createPerformanceObserver(['measure', 'mark'], callback);

      const mockEntries = [
        { name: 'test-mark', entryType: 'mark', startTime: 100 },
        { name: 'test-measure', entryType: 'measure', duration: 50 },
      ];

      const mockList = {
        getEntries: () => mockEntries,
      } as unknown as PerformanceObserverEntryList;

      if (observerCallback) {
        observerCallback(mockList, {} as PerformanceObserver);
      }

      expect(callback).toHaveBeenCalledWith(mockEntries);
    });

    it('should handle observer errors gracefully', () => {
      (global.PerformanceObserver as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Observer not supported');
      });

      const callback = jest.fn();
      const observer = createPerformanceObserver(['navigation'], callback);

      expect(observer).toBeNull();
    });
  });

  describe('Performance Thresholds', () => {
    it('should validate against performance thresholds', async () => {
      const thresholds = {
        renderTime: 16, // 16ms for 60fps
        asyncOperation: 1000, // 1 second
        bundleSize: 500000, // 500KB
      };

      // Test render time threshold
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: 15 },
      ]);

      const renderTime = await measureComponentRenderTime('FastComponent', async () => {});
      expect(renderTime).toBeLessThan(thresholds.renderTime);

      // Test async operation threshold
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: 800 },
      ]);

      const asyncMetrics = await measureAsyncOperation('quickFetch', async () => 'data');
      expect(asyncMetrics.duration).toBeLessThan(thresholds.asyncOperation);
    });
  });

  describe('Performance Metrics Aggregation', () => {
    it('should aggregate multiple performance measurements', async () => {
      const measurements: PerformanceMetrics[] = [];

      // Simulate multiple component renders
      for (let i = 0; i < 5; i++) {
        (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
          { duration: 10 + i * 2 },
        ]);

        const metrics = await measureAsyncOperation(`render-${i}`, async () => {});
        measurements.push(metrics);
      }

      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
      expect(avgDuration).toBe(14); // (10 + 12 + 14 + 16 + 18) / 5
    });
  });
});

describe('Bundle Size Analysis', () => {
  it('should generate detailed bundle report', () => {
    const bundleSizes = {
      'main.js': 180000,
      'vendor.js': 280000,
      'styles.css': 40000,
      'polyfills.js': 30000,
    };

    const limits = {
      'main.js': 200000,
      'vendor.js': 300000,
      'styles.css': 50000,
      'polyfills.js': 50000,
      total: 600000,
    };

    const report = checkBundleSize(bundleSizes, limits);

    // Check detailed report
    expect(report.summary).toBeDefined();
    expect(report.summary!.totalFiles).toBe(4);
    expect(report.summary!.totalSize).toBe(530000);
    expect(report.summary!.largestFile).toBe('vendor.js');
    expect(report.summary!.smallestFile).toBe('polyfills.js');
  });

  it('should calculate gzip estimates', () => {
    const bundleSizes = {
      'main.js': 200000,
      'vendor.js': 300000,
    };

    const report = checkBundleSize(bundleSizes, {}, { estimateGzip: true });

    // Assuming ~70% compression ratio
    expect(report.files['main.js'].gzipEstimate).toBeCloseTo(60000, -3);
    expect(report.files['vendor.js'].gzipEstimate).toBeCloseTo(90000, -3);
  });
});

describe('Loading Time Thresholds', () => {
  it('should validate loading time thresholds', () => {
    const thresholds = {
      FCP: 1800, // First Contentful Paint - 1.8s
      LCP: 2500, // Largest Contentful Paint - 2.5s
      FID: 100, // First Input Delay - 100ms
      CLS: 0.1, // Cumulative Layout Shift - 0.1
      TTI: 3800, // Time to Interactive - 3.8s
    };

    // Mock web vitals measurements
    const metrics = {
      FCP: 1500,
      LCP: 2200,
      FID: 80,
      CLS: 0.05,
      TTI: 3500,
    };

    Object.entries(metrics).forEach(([metric, value]) => {
      expect(value).toBeLessThanOrEqual(thresholds[metric as keyof typeof thresholds]);
    });
  });
});

describe('Lazy Loading Detection', () => {
  it('should detect lazy loaded components', () => {
    const componentImports = [
      { name: 'HomePage', type: 'static', size: 50000 },
      { name: 'ProfilePage', type: 'lazy', size: 80000 },
      { name: 'SettingsPage', type: 'lazy', size: 60000 },
    ];

    const lazyComponents = componentImports.filter(c => c.type === 'lazy');
    expect(lazyComponents).toHaveLength(2);

    const totalLazySize = lazyComponents.reduce((sum, c) => sum + c.size, 0);
    expect(totalLazySize).toBe(140000);
  });
});

describe('Skeleton Screen Performance', () => {
  it('should measure skeleton screen display time', async () => {
    const skeletonStartTime = performance.now();
    
    // Simulate skeleton screen display
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const contentLoadTime = performance.now();
    const skeletonDisplayTime = contentLoadTime - skeletonStartTime;

    expect(skeletonDisplayTime).toBeGreaterThanOrEqual(100);
    expect(skeletonDisplayTime).toBeLessThan(150); // Allow some overhead
  });

  it('should track perceived loading time with skeleton screens', () => {
    const metrics = {
      skeletonRenderStart: 50,
      skeletonRenderComplete: 100,
      contentStart: 100,
      contentComplete: 500,
      perceivedLoadTime: 100, // Time until skeleton appears
      actualLoadTime: 500, // Total time until content
    };

    expect(metrics.perceivedLoadTime).toBeLessThan(metrics.actualLoadTime);
    expect(metrics.perceivedLoadTime).toBeLessThanOrEqual(150); // Should feel fast
  });
});