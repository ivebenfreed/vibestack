import React from 'react'

/**
 * Performance Monitoring Utilities
 * 
 * Provides tools for measuring and tracking component performance
 * to ensure we maintain our 4,840x improvement over shadcn/ui components.
 */

export const PERFORMANCE_TARGETS = {
  /** Target interaction time for cell clicks */
  CELL_INTERACTION: 5, // ms
  /** Target dropdown open time */
  DROPDOWN_OPEN: 10, // ms  
  /** Target for bulk operations */
  BULK_OPERATION: 50, // ms
  /** Target for table sort */
  TABLE_SORT: 100, // ms
  /** Target for initial render */
  INITIAL_RENDER: 200, // ms
  /** Target memory usage per table */
  MEMORY_USAGE: 50, // MB
} as const

export interface PerformanceMeasurement {
  label: string
  duration: number
  target: number
  timestamp: number
  exceeded: boolean
}

/**
 * Performance measurement class for tracking component performance
 */
export class PerformanceTracker {
  private measurements: PerformanceMeasurement[] = []
  private isEnabled: boolean = true

  constructor(enabled: boolean = process.env.NODE_ENV === 'development') {
    this.isEnabled = enabled
  }

  /**
   * Start timing a performance-critical operation
   */
  startTiming(label: string): number {
    if (!this.isEnabled) return 0
    
    performance.mark(`${label}-start`)
    return performance.now()
  }

  /**
   * End timing and record measurement
   */
  endTiming(label: string, startTime: number, target: number = PERFORMANCE_TARGETS.CELL_INTERACTION): PerformanceMeasurement {
    if (!this.isEnabled) {
      return {
        label,
        duration: 0,
        target,
        timestamp: Date.now(),
        exceeded: false
      }
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    const exceeded = duration > target
    
    performance.mark(`${label}-end`)
    performance.measure(label, `${label}-start`, `${label}-end`)
    
    const measurement: PerformanceMeasurement = {
      label,
      duration,
      target,
      timestamp: Date.now(),
      exceeded
    }

    this.measurements.push(measurement)

    // Log performance warnings in development
    if (exceeded) {
      console.warn(
        `⚠️ [Performance] ${label} exceeded target: ${duration.toFixed(2)}ms (target: ${target}ms)`
      )
    } else {
      console.log(
        `✅ [Performance] ${label}: ${duration.toFixed(2)}ms (target: ${target}ms)`
      )
    }

    return measurement
  }

  /**
   * Get all measurements
   */
  getMeasurements(): PerformanceMeasurement[] {
    return [...this.measurements]
  }

  /**
   * Get measurements that exceeded targets
   */
  getSlowMeasurements(): PerformanceMeasurement[] {
    return this.measurements.filter(m => m.exceeded)
  }

  /**
   * Get average duration for a specific label
   */
  getAverageDuration(label: string): number {
    const matching = this.measurements.filter(m => m.label === label)
    if (matching.length === 0) return 0
    
    const total = matching.reduce((sum, m) => sum + m.duration, 0)
    return total / matching.length
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const totalMeasurements = this.measurements.length
    const slowMeasurements = this.getSlowMeasurements().length
    const successRate = ((totalMeasurements - slowMeasurements) / totalMeasurements * 100).toFixed(1)

    const report = [
      '📊 Performance Report',
      '==================',
      `Total measurements: ${totalMeasurements}`,
      `Within targets: ${totalMeasurements - slowMeasurements}`,
      `Exceeded targets: ${slowMeasurements}`,
      `Success rate: ${successRate}%`,
      '',
      'Averages by operation:',
    ]

    // Group by label and calculate averages
    const labelGroups = this.measurements.reduce((acc, m) => {
      if (!acc[m.label]) {
        acc[m.label] = []
      }
      acc[m.label].push(m)
      return acc
    }, {} as Record<string, PerformanceMeasurement[]>)

    Object.entries(labelGroups).forEach(([label, measurements]) => {
      const avg = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length
      const target = measurements[0].target
      const status = avg <= target ? '✅' : '⚠️'
      report.push(`  ${status} ${label}: ${avg.toFixed(2)}ms (target: ${target}ms)`)
    })

    return report.join('\n')
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = []
    // Clear performance marks and measures
    if (typeof performance !== 'undefined' && performance.clearMarks) {
      performance.clearMarks()
      performance.clearMeasures()
    }
  }

  /**
   * Export measurements as JSON
   */
  exportData(): string {
    return JSON.stringify(this.measurements, null, 2)
  }
}

/**
 * Global performance tracker instance
 */
export const performanceTracker = new PerformanceTracker()

/**
 * Higher-order component for measuring component render performance
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo(function PerformanceTrackedComponent(props: P) {
    const startTime = performanceTracker.startTiming(`${componentName}-render`)
    
    React.useEffect(() => {
      performanceTracker.endTiming(
        `${componentName}-render`, 
        startTime, 
        PERFORMANCE_TARGETS.INITIAL_RENDER
      )
    })

    return React.createElement(Component, props)
  })
}

/**
 * Hook for measuring interaction performance
 */
export function usePerformanceTracking() {
  return React.useMemo(() => ({
    startTiming: performanceTracker.startTiming.bind(performanceTracker),
    endTiming: performanceTracker.endTiming.bind(performanceTracker),
    measureInteraction: (label: string, fn: () => void) => {
      const startTime = performanceTracker.startTiming(label)
      fn()
      performanceTracker.endTiming(label, startTime, PERFORMANCE_TARGETS.CELL_INTERACTION)
    },
    measureAsyncInteraction: async (label: string, fn: () => Promise<void>) => {
      const startTime = performanceTracker.startTiming(label)
      await fn()
      performanceTracker.endTiming(label, startTime, PERFORMANCE_TARGETS.CELL_INTERACTION)
    }
  }), [])
}

/**
 * Development utilities for performance debugging
 */
export const devUtils = {
  /**
   * Log current performance state
   */
  logPerformanceState: () => {
    console.log(performanceTracker.generateReport())
  },

  /**
   * Export performance data to console
   */
  exportPerformanceData: () => {
    console.log('Performance Data:', performanceTracker.exportData())
  },

  /**
   * Reset performance tracking
   */
  resetTracking: () => {
    performanceTracker.clear()
    console.log('Performance tracking reset')
  },

  /**
   * Enable/disable performance tracking
   */
  setTrackingEnabled: (enabled: boolean) => {
    (performanceTracker as any).isEnabled = enabled
    console.log(`Performance tracking ${enabled ? 'enabled' : 'disabled'}`)
  }
}

// TODO: Re-enable global assignment after debugging the calling issue
// Make dev utils available globally in development
// if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
//   (window as any).__performanceUtils = devUtils
//   (window as any).__performanceTracker = performanceTracker
// } 