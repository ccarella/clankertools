/**
 * Performance monitoring utilities for mobile scrolling
 */

export class PerformanceMonitor {
  private frameCount = 0
  private startTime = 0
  private fps = 0
  private animationId: number | null = null
  private callback?: (fps: number) => void

  constructor(callback?: (fps: number) => void) {
    this.callback = callback
  }

  start() {
    this.frameCount = 0
    this.startTime = performance.now()
    this.measure()
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  private measure = () => {
    this.frameCount++
    const currentTime = performance.now()
    const elapsed = currentTime - this.startTime

    // Calculate FPS every second
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed)
      this.callback?.(this.fps)
      
      // Reset for next measurement
      this.frameCount = 0
      this.startTime = currentTime
    }

    this.animationId = requestAnimationFrame(this.measure)
  }

  getFPS() {
    return this.fps
  }
}

/**
 * Hook to monitor scroll performance
 */
export function useScrollPerformance() {
  const monitor = new PerformanceMonitor()
  
  const startMonitoring = (element: HTMLElement | null) => {
    if (!element) return

    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      if (!isScrolling) {
        monitor.start()
        isScrolling = true
      }

      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        monitor.stop()
        isScrolling = false
        
        const fps = monitor.getFPS()
        if (fps < 55) {
          console.warn(`Poor scroll performance detected: ${fps} FPS`)
        }
      }, 150)
    }

    element.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      element.removeEventListener('scroll', handleScroll)
      monitor.stop()
    }
  }

  return { startMonitoring }
}

/**
 * Utility to measure paint performance
 */
export function measurePaintPerformance() {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'paint') {
          console.log(`${entry.name}: ${entry.startTime}ms`)
        }
      })
    })
    
    observer.observe({ entryTypes: ['paint'] })
    return observer
  }
  return null
}

/**
 * Check if device is likely mobile based on viewport and touch support
 */
export function isMobileDevice() {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isMobileViewport = window.innerWidth <= 768
  const userAgent = navigator.userAgent.toLowerCase()
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  
  return hasTouch && (isMobileViewport || isMobileUA)
}

/**
 * Debounce function optimized for scroll performance
 */
export function debounceScroll<T extends (...args: unknown[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null
  let lastCallTime = 0

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall >= wait) {
      lastCallTime = now
      func.apply(this, args)
    } else {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        lastCallTime = Date.now()
        func.apply(this, args)
      }, wait - timeSinceLastCall)
    }
  }
}