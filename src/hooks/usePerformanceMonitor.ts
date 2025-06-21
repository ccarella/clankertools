import { useEffect, useRef, useState } from 'react';
import { createPerformanceObserver } from '@/lib/performance';

interface WebVitalsMetrics {
  FCP?: number;
  LCP?: number;
  FID?: number;
  CLS?: number;
  TTFB?: number;
}

interface UsePerformanceMonitorOptions {
  enableWebVitals?: boolean;
  enableResourceTiming?: boolean;
  enableMemoryMonitoring?: boolean;
  reportCallback?: (metrics: PerformanceReport) => void;
}

interface PerformanceReport {
  webVitals?: WebVitalsMetrics;
  resources?: ResourceTiming[];
  memory?: MemoryInfo;
  navigation?: NavigationTiming;
}

interface ResourceTiming {
  name: string;
  type: string;
  duration: number;
  size?: number;
  cached?: boolean;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

export function usePerformanceMonitor(options: UsePerformanceMonitorOptions = {}) {
  const {
    enableWebVitals = true,
    enableResourceTiming = true,
    enableMemoryMonitoring = true,
    reportCallback,
  } = options;

  const [metrics, setMetrics] = useState<PerformanceReport>({});
  const observersRef = useRef<PerformanceObserver[]>([]);

  useEffect(() => {
    const observers: PerformanceObserver[] = [];

    // Monitor Web Vitals
    if (enableWebVitals && typeof window !== 'undefined') {
      try {
        // Largest Contentful Paint
        const lcpObserver = createPerformanceObserver(['largest-contentful-paint'], (entries) => {
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
          setMetrics(prev => ({
            ...prev,
            webVitals: {
              ...prev.webVitals,
              LCP: lastEntry.renderTime || lastEntry.loadTime,
            },
          }));
        });
        if (lcpObserver) observers.push(lcpObserver);

        // First Input Delay
        const fidObserver = createPerformanceObserver(['first-input'], (entries) => {
          const firstInput = entries[0] as PerformanceEntry & { processingStart: number; startTime: number };
          setMetrics(prev => ({
            ...prev,
            webVitals: {
              ...prev.webVitals,
              FID: firstInput.processingStart - firstInput.startTime,
            },
          }));
        });
        if (fidObserver) observers.push(fidObserver);

        // Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = createPerformanceObserver(['layout-shift'], (entries) => {
          for (const entry of entries) {
            const layoutShiftEntry = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }
          setMetrics(prev => ({
            ...prev,
            webVitals: {
              ...prev.webVitals,
              CLS: clsValue,
            },
          }));
        });
        if (clsObserver) observers.push(clsObserver);

        // Navigation timing for FCP and TTFB
        const paintObserver = createPerformanceObserver(['paint'], (entries) => {
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              setMetrics(prev => ({
                ...prev,
                webVitals: {
                  ...prev.webVitals,
                  FCP: entry.startTime,
                },
              }));
            }
          });
        });
        if (paintObserver) observers.push(paintObserver);

        // Time to First Byte
        const navigationObserver = createPerformanceObserver(['navigation'], (entries) => {
          const navEntry = entries[0] as PerformanceNavigationTiming;
          setMetrics(prev => ({
            ...prev,
            webVitals: {
              ...prev.webVitals,
              TTFB: navEntry.responseStart - navEntry.fetchStart,
            },
            navigation: {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
              loadComplete: navEntry.loadEventEnd - navEntry.fetchStart,
              firstPaint: navEntry.fetchStart,
              firstContentfulPaint: navEntry.responseEnd,
            },
          }));
        });
        if (navigationObserver) observers.push(navigationObserver);
      } catch (error) {
        console.error('Failed to setup web vitals monitoring:', error);
      }
    }

    // Monitor Resource Timing
    if (enableResourceTiming && typeof window !== 'undefined') {
      try {
        const resourceObserver = createPerformanceObserver(['resource'], (entries) => {
          const resources: ResourceTiming[] = entries.map((entry) => {
            const resourceEntry = entry as PerformanceResourceTiming;
            return {
              name: resourceEntry.name,
              type: resourceEntry.initiatorType,
              duration: resourceEntry.duration,
              size: resourceEntry.transferSize,
              cached: resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize > 0,
            };
          });

          setMetrics(prev => ({
            ...prev,
            resources: [...(prev.resources || []), ...resources],
          }));
        });
        if (resourceObserver) observers.push(resourceObserver);
      } catch (error) {
        console.error('Failed to setup resource timing monitoring:', error);
      }
    }

    // Monitor Memory Usage
    if (enableMemoryMonitoring && typeof window !== 'undefined' && 'memory' in performance) {
      const memoryInterval = setInterval(() => {
        const performanceWithMemory = performance as Performance & { memory: MemoryInfo };
        const memory = performanceWithMemory.memory;
        setMetrics(prev => ({
          ...prev,
          memory: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          },
        }));
      }, 5000); // Check every 5 seconds

      return () => {
        clearInterval(memoryInterval);
        observers.forEach(observer => observer.disconnect());
      };
    }

    observersRef.current = observers;

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, [enableWebVitals, enableResourceTiming, enableMemoryMonitoring]);

  // Report metrics when they change
  useEffect(() => {
    if (reportCallback && Object.keys(metrics).length > 0) {
      reportCallback(metrics);
    }
  }, [metrics, reportCallback]);

  // Manual metric recording
  const recordMetric = (name: string, value: number, type: 'webVital' | 'custom' = 'custom') => {
    if (type === 'webVital') {
      setMetrics(prev => ({
        ...prev,
        webVitals: {
          ...prev.webVitals,
          [name]: value,
        },
      }));
    } else {
      setMetrics(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Get current performance score
  const getPerformanceScore = (): number => {
    const { webVitals } = metrics;
    if (!webVitals) return 0;

    let score = 100;
    const thresholds = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 600, poor: 1500 },
    };

    Object.entries(webVitals).forEach(([metric, value]) => {
      if (value !== undefined && thresholds[metric as keyof typeof thresholds]) {
        const threshold = thresholds[metric as keyof typeof thresholds];
        if (value > threshold.poor) {
          score -= 20;
        } else if (value > threshold.good) {
          score -= 10;
        }
      }
    });

    return Math.max(0, score);
  };

  return {
    metrics,
    recordMetric,
    getPerformanceScore,
    isMonitoring: observersRef.current.length > 0,
  };
}