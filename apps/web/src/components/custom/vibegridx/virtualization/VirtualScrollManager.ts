import type { ActorRefFrom } from 'xstate';
import type { ViewportInfo, TableRow } from '../types';

// ====================================
// VIRTUAL SCROLL CONFIGURATION
// ====================================

interface VirtualScrollConfig {
  itemHeight: number;
  bufferSize: number;
  overscan: number;
  containerHeight: number;
  totalItems: number;
  
  // Performance tuning
  throttleMs: number;
  maxConcurrentActors: number;
  actorPoolSize: number;
}

interface VirtualScrollState {
  viewport: ViewportInfo;
  visibleRange: { start: number; end: number };
  activeRowActors: Map<string, ActorRefFrom<any>>;
  actorPool: ActorRefFrom<any>[];
  scrollPosition: number;
  isScrolling: boolean;
  lastScrollTime: number;
}

// ====================================
// ACTOR LIFECYCLE MANAGER
// ====================================

class ActorLifecycleManager {
  private activeActors = new Map<string, ActorRefFrom<any>>();
  private actorPool: ActorRefFrom<any>[] = [];
  private spawning = new Set<string>();
  
  private maxConcurrentActors: number;
  private poolSize: number;
  private spawnActor: (id: string) => ActorRefFrom<any>;
  private stopActor: (actor: ActorRefFrom<any>) => void;
  
  constructor(
    maxConcurrentActors: number,
    poolSize: number,
    spawnActor: (id: string) => ActorRefFrom<any>,
    stopActor: (actor: ActorRefFrom<any>) => void
  ) {
    this.maxConcurrentActors = maxConcurrentActors;
    this.poolSize = poolSize;
    this.spawnActor = spawnActor;
    this.stopActor = stopActor;
  }
  
  // Get or create actor for row
  getActor(rowId: string): ActorRefFrom<any> | null {
    // Return existing actor
    if (this.activeActors.has(rowId)) {
      return this.activeActors.get(rowId)!;
    }
    
    // Check if we're at capacity
    if (this.activeActors.size >= this.maxConcurrentActors) {
      return null;
    }
    
    // Prevent concurrent spawning
    if (this.spawning.has(rowId)) {
      return null;
    }
    
    // Try to reuse from pool
    let actor = this.actorPool.pop();
    
    if (!actor) {
      // Spawn new actor
      this.spawning.add(rowId);
      actor = this.spawnActor(rowId);
      this.spawning.delete(rowId);
    }
    
    this.activeActors.set(rowId, actor);
    return actor;
  }
  
  // Release actor for row
  releaseActor(rowId: string): void {
    const actor = this.activeActors.get(rowId);
    if (!actor) return;
    
    this.activeActors.delete(rowId);
    
    // Return to pool if space available
    if (this.actorPool.length < this.poolSize) {
      // Reset actor state
      actor.send({ type: 'CLEANUP' });
      this.actorPool.push(actor);
    } else {
      // Stop actor
      this.stopActor(actor);
    }
  }
  
  // Bulk operations for efficiency
  updateActiveRows(visibleRowIds: string[]): void {
    const currentActors = new Set(this.activeActors.keys());
    const newRowIds = new Set(visibleRowIds);
    
    // Release actors for rows no longer visible
    for (const rowId of currentActors) {
      if (!newRowIds.has(rowId)) {
        this.releaseActor(rowId);
      }
    }
    
    // Create actors for new visible rows
    for (const rowId of visibleRowIds) {
      if (!this.activeActors.has(rowId) && !this.spawning.has(rowId)) {
        this.getActor(rowId);
      }
    }
  }
  
  // Get metrics
  getMetrics() {
    return {
      activeActors: this.activeActors.size,
      pooledActors: this.actorPool.length,
      spawningActors: this.spawning.size,
      totalActors: this.activeActors.size + this.actorPool.length
    };
  }
  
  // Cleanup
  destroy(): void {
    // Stop all active actors
    for (const actor of this.activeActors.values()) {
      this.stopActor(actor);
    }
    
    // Stop all pooled actors
    for (const actor of this.actorPool) {
      this.stopActor(actor);
    }
    
    this.activeActors.clear();
    this.actorPool.length = 0;
    this.spawning.clear();
  }
}

// ====================================
// VIRTUAL SCROLL MANAGER
// ====================================

export class VirtualScrollManager {
  private config: VirtualScrollConfig;
  private state: VirtualScrollState;
  private actorManager: ActorLifecycleManager;
  
  private scrollThrottleId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private performanceMetrics = {
    lastScrollDuration: 0,
    totalScrollEvents: 0,
    actorSpawnCount: 0,
    actorStopCount: 0
  };
  
  // Callbacks
  private onViewportChange?: (viewport: ViewportInfo) => void;
  private onVisibleRowsChange?: (rowIds: string[]) => void;
  private onActorMetricsChange?: (metrics: any) => void;
  
  constructor(
    config: VirtualScrollConfig,
    spawnRowActor: (id: string) => ActorRefFrom<any>,
    stopRowActor: (actor: ActorRefFrom<any>) => void
  ) {
    this.config = config;
    
    this.actorManager = new ActorLifecycleManager(
      config.maxConcurrentActors,
      config.actorPoolSize,
      spawnRowActor,
      stopRowActor
    );
    
    this.state = {
      viewport: {
        start: 0,
        end: Math.min(config.bufferSize * 2, config.totalItems),
        height: config.containerHeight,
        scrollTop: 0,
        itemHeight: config.itemHeight
      },
      visibleRange: { start: 0, end: 0 },
      activeRowActors: new Map(),
      actorPool: [],
      scrollPosition: 0,
      isScrolling: false,
      lastScrollTime: 0
    };
    
    this.calculateVisibleRange();
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  // Update scroll position
  handleScroll(scrollTop: number): void {
    const startTime = performance.now();
    
    this.state.scrollPosition = scrollTop;
    this.state.isScrolling = true;
    this.state.lastScrollTime = Date.now();
    
    // Throttle scroll events
    if (this.scrollThrottleId) {
      cancelAnimationFrame(this.scrollThrottleId);
    }
    
    this.scrollThrottleId = requestAnimationFrame(() => {
      this.updateViewport(scrollTop);
      this.state.isScrolling = false;
      
      // Performance tracking
      this.performanceMetrics.lastScrollDuration = performance.now() - startTime;
      this.performanceMetrics.totalScrollEvents++;
    });
  }
  
  // Update container size
  updateContainerSize(height: number): void {
    if (this.config.containerHeight === height) return;
    
    this.config.containerHeight = height;
    this.state.viewport.height = height;
    
    this.calculateVisibleRange();
    this.updateActorLifecycle();
  }
  
  // Update total items count
  updateItemCount(totalItems: number): void {
    if (this.config.totalItems === totalItems) return;
    
    this.config.totalItems = totalItems;
    this.calculateVisibleRange();
    this.updateActorLifecycle();
  }
  
  // Update item height
  updateItemHeight(itemHeight: number): void {
    if (this.config.itemHeight === itemHeight) return;
    
    this.config.itemHeight = itemHeight;
    this.state.viewport.itemHeight = itemHeight;
    
    this.calculateVisibleRange();
    this.updateActorLifecycle();
  }
  
  // Get current viewport info
  getViewport(): ViewportInfo {
    return { ...this.state.viewport };
  }
  
  // Get visible row indices
  getVisibleRange(): { start: number; end: number } {
    return { ...this.state.visibleRange };
  }
  
  // Get visible row IDs
  getVisibleRowIds(allRows: TableRow[]): string[] {
    const { start, end } = this.state.visibleRange;
    return allRows.slice(start, end + 1).map(row => row.id);
  }
  
  // Get actor for specific row
  getRowActor(rowId: string): ActorRefFrom<any> | null {
    return this.actorManager.getActor(rowId);
  }
  
  // Force actor update
  updateVisibleActors(visibleRowIds: string[]): void {
    this.actorManager.updateActiveRows(visibleRowIds);
    this.onActorMetricsChange?.(this.actorManager.getMetrics());
  }
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  // Set callbacks
  setCallbacks(callbacks: {
    onViewportChange?: (viewport: ViewportInfo) => void;
    onVisibleRowsChange?: (rowIds: string[]) => void;
    onActorMetricsChange?: (metrics: any) => void;
  }): void {
    this.onViewportChange = callbacks.onViewportChange;
    this.onVisibleRowsChange = callbacks.onVisibleRowsChange;
    this.onActorMetricsChange = callbacks.onActorMetricsChange;
  }
  
  // ====================================
  // PRIVATE METHODS
  // ====================================
  
  private updateViewport(scrollTop: number): void {
    const oldViewport = { ...this.state.viewport };
    
    this.state.viewport.scrollTop = scrollTop;
    this.calculateVisibleRange();
    
    // Check if viewport actually changed
    const viewportChanged = 
      oldViewport.start !== this.state.viewport.start ||
      oldViewport.end !== this.state.viewport.end ||
      oldViewport.scrollTop !== this.state.viewport.scrollTop;
    
    if (viewportChanged) {
      this.updateActorLifecycle();
      this.onViewportChange?.(this.state.viewport);
    }
  }
  
  private calculateVisibleRange(): void {
    const {
      scrollPosition,
      viewport: { height, itemHeight }
    } = this.state;
    
    const { bufferSize, overscan, totalItems } = this.config;
    
    // Calculate visible items
    const startIndex = Math.floor(scrollPosition / itemHeight);
    const endIndex = Math.min(
      totalItems - 1,
      startIndex + Math.ceil(height / itemHeight)
    );
    
    // Add buffer and overscan
    const bufferedStart = Math.max(0, startIndex - bufferSize - overscan);
    const bufferedEnd = Math.min(totalItems - 1, endIndex + bufferSize + overscan);
    
    // Update state
    this.state.visibleRange = {
      start: bufferedStart,
      end: bufferedEnd
    };
    
    this.state.viewport.start = bufferedStart;
    this.state.viewport.end = bufferedEnd;
  }
  
  private updateActorLifecycle(): void {
    const { start, end } = this.state.visibleRange;
    const visibleRowIds = Array.from(
      { length: end - start + 1 }, 
      (_, i) => `row-${start + i}`
    );
    
    this.actorManager.updateActiveRows(visibleRowIds);
    this.onVisibleRowsChange?.(visibleRowIds);
    this.onActorMetricsChange?.(this.actorManager.getMetrics());
  }
  
  // ====================================
  // PERFORMANCE AND DEBUGGING
  // ====================================
  
  getPerformanceMetrics() {
    return {
      scroll: this.performanceMetrics,
      actors: this.actorManager.getMetrics(),
      viewport: this.state.viewport,
      visibleRange: this.state.visibleRange,
      config: this.config
    };
  }
  
  // Debug helpers
  isRowVisible(rowIndex: number): boolean {
    const { start, end } = this.state.visibleRange;
    return rowIndex >= start && rowIndex <= end;
  }
  
  getRowTop(rowIndex: number): number {
    return rowIndex * this.config.itemHeight;
  }
  
  getTotalHeight(): number {
    return this.config.totalItems * this.config.itemHeight;
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  destroy(): void {
    if (this.scrollThrottleId) {
      cancelAnimationFrame(this.scrollThrottleId);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.actorManager.destroy();
    
    // Clear callbacks
    this.onViewportChange = undefined;
    this.onVisibleRowsChange = undefined;
    this.onActorMetricsChange = undefined;
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export const createVirtualScrollManager = (
  config: Partial<VirtualScrollConfig>,
  spawnRowActor: (id: string) => ActorRefFrom<any>,
  stopRowActor: (actor: ActorRefFrom<any>) => void
): VirtualScrollManager => {
  
  const defaultConfig: VirtualScrollConfig = {
    itemHeight: 40,
    bufferSize: 10,
    overscan: 5,
    containerHeight: 600,
    totalItems: 0,
    throttleMs: 16, // ~60fps
    maxConcurrentActors: 100,
    actorPoolSize: 20
  };
  
  const mergedConfig = { ...defaultConfig, ...config };
  
  return new VirtualScrollManager(
    mergedConfig,
    spawnRowActor,
    stopRowActor
  );
};

// ====================================
// REACT HOOK
// ====================================

export const useVirtualScrollManager = (
  config: Partial<VirtualScrollConfig>,
  spawnRowActor: (id: string) => ActorRefFrom<any>,
  stopRowActor: (actor: ActorRefFrom<any>) => void
) => {
  const manager = createVirtualScrollManager(config, spawnRowActor, stopRowActor);
  
  return {
    manager,
    handleScroll: (scrollTop: number) => manager.handleScroll(scrollTop),
    updateItemCount: (count: number) => manager.updateItemCount(count),
    updateContainerSize: (height: number) => manager.updateContainerSize(height),
    getViewport: () => manager.getViewport(),
    getVisibleRange: () => manager.getVisibleRange(),
    getMetrics: () => manager.getPerformanceMetrics(),
    destroy: () => manager.destroy()
  };
};