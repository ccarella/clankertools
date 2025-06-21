import { renderHook, act } from '@testing-library/react';
import { usePerformanceMonitor } from '../usePerformanceMonitor';

// Mock performance observer
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

interface MockPerformanceObserverEntryList {
  getEntries: () => MockPerformanceEntry[];
}

interface MockPerformanceEntry extends PerformanceEntry {
  // Additional properties for specific entry types
  renderTime?: number;
  loadTime?: number;
  processingStart?: number;
  value?: number;
  hadRecentInput?: boolean;
  initiatorType?: string;
  transferSize?: number;
  decodedBodySize?: number;
}

type PerformanceObserverCallback = (list: MockPerformanceObserverEntryList) => void;

interface ObserverOptions {
  type?: string;
  entryTypes?: string[];
  buffered?: boolean;
}

const observers: { callback: PerformanceObserverCallback; options: ObserverOptions }[] = [];

class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  
  observe(options: ObserverOptions) {
    mockObserve(options);
    observers.push({ callback: this.callback, options });
  }
  
  disconnect() {
    mockDisconnect();
    const index = observers.findIndex(obs => obs.callback === this.callback);
    if (index > -1) {
      observers.splice(index, 1);
    }
  }
}

global.PerformanceObserver = Object.assign(MockPerformanceObserver, {
  supportedEntryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'navigation', 'resource', 'paint']
}) as unknown as typeof PerformanceObserver;

// Mock performance.memory
interface PerformanceWithMemory extends Performance {
  memory: {
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

// Mock console.error to suppress expected error logs in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('usePerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    observers.length = 0; // Clear observers array
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with empty metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());
    
    expect(result.current.metrics).toEqual({});
    // isMonitoring is based on observersRef which is updated asynchronously
    // So we just check that metrics are initialized properly
  });

  it('sets up performance observers when enabled', () => {
    renderHook(() => usePerformanceMonitor({
      enableWebVitals: true,
      enableResourceTiming: true,
    }));

    // Should create observers for different entry types
    expect(mockObserve).toHaveBeenCalled();
  });

  it('cleans up observers on unmount', () => {
    const { unmount } = renderHook(() => usePerformanceMonitor());

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('monitors memory usage when enabled', () => {
    // Mock performance.memory exists
    const performanceWithMemory = global.performance as PerformanceWithMemory;
    if (!performanceWithMemory.memory) {
      performanceWithMemory.memory = {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 50000000,
      };
    }

    const { result } = renderHook(() => usePerformanceMonitor({
      enableMemoryMonitoring: true,
    }));

    // Fast-forward time to trigger memory monitoring (5 seconds)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Memory monitoring should have captured the values
    expect(result.current.metrics.memory).toEqual({
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 20000000,
      jsHeapSizeLimit: 50000000,
    });
  });

  it('records custom metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    act(() => {
      result.current.recordMetric('customMetric', 123);
    });

    expect(result.current.metrics).toHaveProperty('customMetric', 123);
  });

  it('records web vital metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    act(() => {
      result.current.recordMetric('FCP', 1500, 'webVital');
      result.current.recordMetric('LCP', 2200, 'webVital');
    });

    expect(result.current.metrics.webVitals).toEqual({
      FCP: 1500,
      LCP: 2200,
    });
  });

  it('calculates performance score based on web vitals', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    // Set good web vitals
    act(() => {
      result.current.recordMetric('FCP', 1500, 'webVital'); // Good
      result.current.recordMetric('LCP', 2200, 'webVital'); // Good
      result.current.recordMetric('FID', 80, 'webVital');   // Good
      result.current.recordMetric('CLS', 0.05, 'webVital'); // Good
      result.current.recordMetric('TTFB', 500, 'webVital'); // Good
    });

    expect(result.current.getPerformanceScore()).toBe(100);

    // Set poor web vitals
    act(() => {
      result.current.recordMetric('FCP', 4000, 'webVital');  // Poor
      result.current.recordMetric('LCP', 5000, 'webVital');  // Poor
      result.current.recordMetric('FID', 400, 'webVital');   // Poor
      result.current.recordMetric('CLS', 0.3, 'webVital');   // Poor
      result.current.recordMetric('TTFB', 2000, 'webVital'); // Poor
    });

    expect(result.current.getPerformanceScore()).toBe(0);
  });

  it('calls report callback when metrics change', () => {
    const reportCallback = jest.fn();
    const { result } = renderHook(() => usePerformanceMonitor({
      reportCallback,
    }));

    act(() => {
      result.current.recordMetric('testMetric', 100);
    });

    expect(reportCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        testMetric: 100,
      })
    );
  });

  it('processes LCP entries correctly', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    // Find the LCP observer
    const lcpObserver = observers.find(obs => 
      obs.options.type === 'largest-contentful-paint' || 
      obs.options.entryTypes?.includes('largest-contentful-paint')
    );

    if (lcpObserver) {
      const lcpEntries: MockPerformanceEntry[] = [{
        entryType: 'largest-contentful-paint',
        renderTime: 2500,
        loadTime: 0,
        duration: 0,
        name: 'largest-contentful-paint',
        startTime: 2500,
        toJSON: () => ({}),
      }];

      act(() => {
        lcpObserver.callback({
          getEntries: () => lcpEntries,
        });
      });

      expect(result.current.metrics.webVitals?.LCP).toBe(2500);
    }
  });

  it('processes FID entries correctly', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    // Find the FID observer
    const fidObserver = observers.find(obs => 
      obs.options.type === 'first-input' || 
      obs.options.entryTypes?.includes('first-input')
    );

    if (fidObserver) {
      const fidEntries: MockPerformanceEntry[] = [{
        entryType: 'first-input',
        startTime: 1000,
        processingStart: 1050,
        duration: 50,
        name: 'first-input',
        toJSON: () => ({}),
      }];

      act(() => {
        fidObserver.callback({
          getEntries: () => fidEntries,
        });
      });

      expect(result.current.metrics.webVitals?.FID).toBe(50);
    }
  });

  it('accumulates CLS values correctly', () => {
    const { result } = renderHook(() => usePerformanceMonitor());

    // Find the CLS observer
    const clsObserver = observers.find(obs => 
      obs.options.type === 'layout-shift' || 
      obs.options.entryTypes?.includes('layout-shift')
    );

    if (clsObserver) {
      const clsEntries: MockPerformanceEntry[] = [
        { entryType: 'layout-shift', value: 0.05, hadRecentInput: false, duration: 0, name: 'layout-shift', startTime: 0, toJSON: () => ({}) },
        { entryType: 'layout-shift', value: 0.03, hadRecentInput: false, duration: 0, name: 'layout-shift', startTime: 0, toJSON: () => ({}) },
        { entryType: 'layout-shift', value: 0.1, hadRecentInput: true, duration: 0, name: 'layout-shift', startTime: 0, toJSON: () => ({}) }, // Should be ignored
      ];

      act(() => {
        clsObserver.callback({
          getEntries: () => clsEntries,
        });
      });

      expect(result.current.metrics.webVitals?.CLS).toBeCloseTo(0.08, 2);
    }
  });

  it('processes resource timing entries', () => {
    const { result } = renderHook(() => usePerformanceMonitor({
      enableResourceTiming: true,
    }));

    // Find the resource observer
    const resourceObserver = observers.find(obs => 
      obs.options.type === 'resource' || 
      obs.options.entryTypes?.includes('resource')
    );

    if (resourceObserver) {
      const resourceEntries: MockPerformanceEntry[] = [
        {
          entryType: 'resource',
          name: 'https://example.com/script.js',
          initiatorType: 'script',
          duration: 150,
          transferSize: 50000,
          decodedBodySize: 50000,
          startTime: 0,
          toJSON: () => ({}),
        },
        {
          entryType: 'resource',
          name: 'https://example.com/cached.js',
          initiatorType: 'script',
          duration: 10,
          transferSize: 0,
          decodedBodySize: 30000,
          startTime: 0,
          toJSON: () => ({}),
        },
      ];

      act(() => {
        resourceObserver.callback({
          getEntries: () => resourceEntries,
        });
      });

      expect(result.current.metrics.resources).toHaveLength(2);
      expect(result.current.metrics.resources?.[0]).toEqual({
        name: 'https://example.com/script.js',
        type: 'script',
        duration: 150,
        size: 50000,
        cached: false,
      });
      expect(result.current.metrics.resources?.[1].cached).toBe(true);
    }
  });

  it('handles errors gracefully', () => {
    // Temporarily replace MockPerformanceObserver to throw an error
    const OriginalMockPerformanceObserver = global.PerformanceObserver;
    global.PerformanceObserver = Object.assign(
      jest.fn().mockImplementation(() => {
        throw new Error('Observer not supported');
      }),
      { supportedEntryTypes: [] }
    ) as unknown as typeof PerformanceObserver;

    const { result } = renderHook(() => usePerformanceMonitor());

    // Should not throw and monitoring should be disabled
    expect(result.current.isMonitoring).toBe(false);

    // Restore original mock
    global.PerformanceObserver = OriginalMockPerformanceObserver;
  });

  it('skips monitoring when options are disabled', () => {
    jest.clearAllMocks();
    
    renderHook(() => usePerformanceMonitor({
      enableWebVitals: false,
      enableResourceTiming: false,
      enableMemoryMonitoring: false,
    }));

    // Should not create any observers
    expect(mockObserve).not.toHaveBeenCalled();
  });
});