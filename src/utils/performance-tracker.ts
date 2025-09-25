export interface NavigationTiming {
  clickTimestamp: number;
  routeChangeStart?: number;
  firstPaintStart?: number;
  contentLoaded?: number;
  totalTime?: number;
  route?: string;
}

class PerformanceTracker {
  private navigationStart: number | null = null;
  private currentNavigation: NavigationTiming | null = null;
  private measurements: NavigationTiming[] = [];
  private rafCallbacks: Set<() => void> = new Set();

  startNavigation(route: string) {
    const now = performance.now();
    this.navigationStart = now;
    this.currentNavigation = {
      clickTimestamp: now,
      route
    };

    console.log(`🚀 [PERF] Navigation started to ${route} at ${now.toFixed(2)}ms`);

    // Track route change
    this.scheduleRouteChangeDetection();
  }

  private scheduleRouteChangeDetection() {
    let lastUrl = window.location.pathname;
    let checkCount = 0;
    const maxChecks = 100; // 100ms max wait

    const checkRouteChange = () => {
      checkCount++;
      const currentUrl = window.location.pathname;

      if (currentUrl !== lastUrl && this.currentNavigation) {
        this.currentNavigation.routeChangeStart = performance.now();
        const elapsed = this.currentNavigation.routeChangeStart - this.currentNavigation.clickTimestamp;
        console.log(`📍 [PERF] Route changed to ${currentUrl} after ${elapsed.toFixed(2)}ms`);

        // Now track first paint
        this.trackFirstPaint();
        return;
      }

      if (checkCount < maxChecks) {
        requestAnimationFrame(checkRouteChange);
      }
    };

    requestAnimationFrame(checkRouteChange);
  }

  private trackFirstPaint() {
    if (!this.currentNavigation) return;

    let paintDetected = false;
    let frameCount = 0;
    const maxFrames = 60; // 1 second max

    const detectPaint = () => {
      frameCount++;

      // Check for actual DOM changes
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      const hasContent = mainContent && mainContent.children.length > 0;

      // Check if we have meaningful content
      const hasMeaningfulContent = document.querySelectorAll('h1, h2, h3, [data-testid], .dashboard, .grid, table').length > 0;

      if (hasContent && hasMeaningfulContent && !paintDetected) {
        paintDetected = true;
        this.currentNavigation.firstPaintStart = performance.now();
        this.currentNavigation.totalTime = this.currentNavigation.firstPaintStart - this.currentNavigation.clickTimestamp;

        console.log(`🎨 [PERF] First meaningful paint after ${this.currentNavigation.totalTime.toFixed(2)}ms`);
        console.log(`📊 [PERF] Breakdown:`, {
          clickToRouteChange: (this.currentNavigation.routeChangeStart! - this.currentNavigation.clickTimestamp).toFixed(2) + 'ms',
          routeChangeToFirstPaint: (this.currentNavigation.firstPaintStart - this.currentNavigation.routeChangeStart!).toFixed(2) + 'ms',
          total: this.currentNavigation.totalTime.toFixed(2) + 'ms'
        });

        // Store measurement
        this.measurements.push({ ...this.currentNavigation });
        this.reportTiming();

        // Execute RAF callbacks
        this.rafCallbacks.forEach(cb => cb());
        this.rafCallbacks.clear();

        return;
      }

      if (frameCount < maxFrames && !paintDetected) {
        requestAnimationFrame(detectPaint);
      } else if (!paintDetected) {
        console.warn(`⚠️ [PERF] Paint detection timeout after ${frameCount} frames`);
      }
    };

    requestAnimationFrame(detectPaint);
  }

  private reportTiming() {
    if (!this.currentNavigation || !this.currentNavigation.totalTime) return;

    // Create visual indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${this.currentNavigation.totalTime < 100 ? '#10b981' : '#f59e0b'};
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 99999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      animation: slideIn 0.3s ease-out;
    `;

    indicator.textContent = `⚡ ${this.currentNavigation.totalTime.toFixed(1)}ms`;
    document.body.appendChild(indicator);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Remove after 3 seconds
    setTimeout(() => {
      indicator.remove();
      style.remove();
    }, 3000);
  }

  onNextFrame(callback: () => void) {
    this.rafCallbacks.add(callback);
  }

  getLastMeasurement(): NavigationTiming | null {
    return this.measurements[this.measurements.length - 1] || null;
  }

  getAllMeasurements(): NavigationTiming[] {
    return [...this.measurements];
  }

  getAverageTime(): number {
    if (this.measurements.length === 0) return 0;
    const validMeasurements = this.measurements.filter(m => m.totalTime);
    if (validMeasurements.length === 0) return 0;

    const sum = validMeasurements.reduce((acc, m) => acc + m.totalTime!, 0);
    return sum / validMeasurements.length;
  }

  reset() {
    this.measurements = [];
    this.currentNavigation = null;
    this.navigationStart = null;
  }
}

export const performanceTracker = new PerformanceTracker();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceTracker = performanceTracker;
  (window as any).getPerfStats = () => {
    const measurements = performanceTracker.getAllMeasurements();
    const avg = performanceTracker.getAverageTime();
    console.table(measurements);
    console.log(`Average navigation time: ${avg.toFixed(2)}ms`);
    return { measurements, average: avg };
  };
}