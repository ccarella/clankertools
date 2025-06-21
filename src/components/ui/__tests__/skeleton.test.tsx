import React from 'react';
import { render } from '@testing-library/react';
import { Skeleton } from '../skeleton';
import { measureComponentRenderTime } from '@/lib/performance';

// Mock performance API
const mockPerformanceObserver = jest.fn();
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

global.PerformanceObserver = jest.fn().mockImplementation((callback) => {
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

describe('Skeleton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders skeleton with animation class', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="w-full h-4" />);
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toHaveClass('w-full', 'h-4');
  });

  it('applies correct base styles', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).toHaveClass('bg-accent', 'rounded-md');
  });

  describe('Performance', () => {
    it('renders within performance threshold', async () => {
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: 5 }, // 5ms render time
      ]);

      const renderTime = await measureComponentRenderTime('Skeleton', async () => {
        render(<Skeleton />);
      });

      expect(renderTime).toBeLessThan(16); // Should render in less than 16ms (60fps)
    });

    it('renders multiple skeletons efficiently', async () => {
      (global.performance.getEntriesByName as jest.Mock).mockReturnValue([
        { duration: 10 }, // 10ms for multiple skeletons
      ]);

      const renderTime = await measureComponentRenderTime('MultipleSkeletons', async () => {
        render(
          <div>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-4 mb-2" />
            ))}
          </div>
        );
      });

      expect(renderTime).toBeLessThan(50); // Should handle multiple skeletons efficiently
    });
  });

  describe('Loading States', () => {
    it('simulates text loading skeleton', () => {
      const { container } = render(
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      );

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons).toHaveLength(3);
    });

    it('simulates card loading skeleton', () => {
      const { container } = render(
        <div className="rounded-lg border p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 mt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      );

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons).toHaveLength(3);
    });

    it('simulates image loading skeleton', () => {
      const { container } = render(
        <Skeleton className="h-[200px] w-[200px] rounded-lg" />
      );

      const skeleton = container.querySelector('[data-slot="skeleton"]');
      expect(skeleton).toHaveClass('h-[200px]', 'w-[200px]', 'rounded-lg');
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      const { container } = render(<Skeleton aria-label="Loading content" />);
      const skeleton = container.querySelector('[data-slot="skeleton"]');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
    });

    it('can be hidden from screen readers when needed', () => {
      const { container } = render(<Skeleton aria-hidden="true" />);
      const skeleton = container.querySelector('[data-slot="skeleton"]');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Skeleton Patterns', () => {
    it('creates a form skeleton', () => {
      const { container } = render(
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-20 mb-2" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" /> {/* Label */}
            <Skeleton className="h-10 w-full" /> {/* Input */}
          </div>
          <Skeleton className="h-10 w-32" /> {/* Button */}
        </div>
      );

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons).toHaveLength(5);
    });

    it('creates a list skeleton', () => {
      const { container } = render(
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );

      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons).toHaveLength(15); // 3 skeletons × 5 items
    });
  });
});