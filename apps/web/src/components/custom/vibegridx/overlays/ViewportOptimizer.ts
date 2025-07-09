import type { ViewportInfo } from '../types';
import type { OverlayConfig } from './OverlayTypes';

// ====================================
// VIEWPORT OPTIMIZER
// ====================================

export interface ViewportBounds {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
  totalCells: number;
}

export interface OptimizationMetrics {
  visibleCells: number;
  culledCells: number;
  renderTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export class ViewportOptimizer {
  private config: OverlayConfig;
  private lastViewport: ViewportInfo | null = null;
  private lastBounds: ViewportBounds | null = null;
  private metrics: OptimizationMetrics = {
    visibleCells: 0,
    culledCells: 0,
    renderTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  // Cache for cell visibility calculations
  private visibilityCache = new Map<string, boolean>();
  private cacheGeneration = 0;
  
  // Flag to indicate if canvas is inside scroll container
  private isInsideScrollContainer: boolean = true;
  
  constructor(config: OverlayConfig) {
    this.config = config;
  }
  
  // Calculate visible bounds with buffer for smooth scrolling
  calculateViewportBounds(viewport: ViewportInfo, bufferRows = 2, bufferColumns = 1): ViewportBounds {
    // Check if viewport hasn't changed significantly
    if (this.lastViewport && this.isViewportSimilar(viewport, this.lastViewport)) {
      this.metrics.cacheHits++;
      return this.lastBounds!;
    }
    
    this.metrics.cacheMisses++;
    
    // When canvas is inside scroll container, visible rows are different
    // The canvas moves with the scroll, so we need to consider absolute positions
    let minRow: number;
    let maxRow: number;
    
    if (this.isInsideScrollContainer) {
      // Canvas is inside scrollable area, so it moves with content
      // All cells are technically "visible" from the canvas perspective
      // We only need to cull based on absolute viewport bounds
      minRow = Math.max(0, Math.floor(viewport.scrollTop / this.config.cellHeight) - bufferRows);
      maxRow = Math.ceil((viewport.scrollTop + viewport.height) / this.config.cellHeight) + bufferRows;
    } else {
      // Canvas is fixed overlay, use relative positioning
      minRow = Math.max(0, Math.floor(viewport.scrollTop / this.config.cellHeight) - bufferRows);
      maxRow = Math.ceil((viewport.scrollTop + viewport.height) / this.config.cellHeight) + bufferRows;
    }
    
    // Calculate visible columns (no horizontal scrolling yet, but prepared for it)
    const minColumn = 0;
    const maxColumn = Math.ceil(viewport.width / this.config.cellWidth) + bufferColumns;
    
    const bounds: ViewportBounds = {
      minRow,
      maxRow,
      minColumn,
      maxColumn,
      totalCells: (maxRow - minRow + 1) * (maxColumn - minColumn + 1)
    };
    
    // Update cache
    this.lastViewport = { ...viewport };
    this.lastBounds = bounds;
    
    // Invalidate visibility cache on significant viewport change
    if (this.shouldInvalidateCache(viewport)) {
      this.visibilityCache.clear();
      this.cacheGeneration++;
    }
    
    return bounds;
  }
  
  // Check if a cell should be rendered based on viewport
  shouldRenderCell(row: number, column: number, viewport: ViewportInfo): boolean {
    const cacheKey = `${this.cacheGeneration}:${row}:${column}`;
    
    // Check cache first
    if (this.visibilityCache.has(cacheKey)) {
      return this.visibilityCache.get(cacheKey)!;
    }
    
    const bounds = this.calculateViewportBounds(viewport);
    const isVisible = row >= bounds.minRow && 
                     row <= bounds.maxRow && 
                     column >= bounds.minColumn && 
                     column <= bounds.maxColumn;
    
    // Cache result
    this.visibilityCache.set(cacheKey, isVisible);
    
    // Update metrics
    if (isVisible) {
      this.metrics.visibleCells++;
    } else {
      this.metrics.culledCells++;
    }
    
    return isVisible;
  }
  
  // Filter cells based on viewport visibility
  filterVisibleCells<T extends { row: number; column: number }>(
    cells: T[], 
    viewport: ViewportInfo
  ): T[] {
    const startTime = performance.now();
    const bounds = this.calculateViewportBounds(viewport);
    
    const visibleCells = cells.filter(cell => 
      cell.row >= bounds.minRow && 
      cell.row <= bounds.maxRow && 
      cell.column >= bounds.minColumn && 
      cell.column <= bounds.maxColumn
    );
    
    this.metrics.renderTime = performance.now() - startTime;
    return visibleCells;
  }
  
  // Batch check for multiple cells
  getVisibleCellKeys(
    cellKeys: Set<string>, 
    viewport: ViewportInfo,
    getCellPosition: (key: string) => { row: number; column: number } | null
  ): Set<string> {
    // When canvas is inside scroll container, we don't need to filter by viewport
    // The canvas itself scrolls with the content, so all selected cells should be rendered
    if (this.isInsideScrollContainer) {
      return new Set(cellKeys);
    }
    
    const visibleKeys = new Set<string>();
    const bounds = this.calculateViewportBounds(viewport);
    
    console.log('ViewportOptimizer: Checking visibility with bounds:', {
      bounds,
      viewport: { scrollTop: viewport.scrollTop, height: viewport.height },
      isInsideScrollContainer: this.isInsideScrollContainer
    });
    
    for (const key of cellKeys) {
      const position = getCellPosition(key);
      
      // Debug first cell
      if (Array.from(cellKeys)[0] === key) {
        console.log('ViewportOptimizer: First cell check:', {
          key,
          position,
          bounds,
          inBounds: position && 
            position.row >= bounds.minRow && 
            position.row <= bounds.maxRow && 
            position.column >= bounds.minColumn && 
            position.column <= bounds.maxColumn
        });
      }
      
      if (position && 
          position.row >= bounds.minRow && 
          position.row <= bounds.maxRow && 
          position.column >= bounds.minColumn && 
          position.column <= bounds.maxColumn) {
        visibleKeys.add(key);
      }
    }
    
    return visibleKeys;
  }
  
  // Check if viewport changed significantly
  private isViewportSimilar(v1: ViewportInfo, v2: ViewportInfo): boolean {
    const scrollDiff = Math.abs(v1.scrollTop - v2.scrollTop);
    const sizeDiff = Math.abs(v1.height - v2.height) + Math.abs(v1.width - v2.width);
    
    // Consider similar if scroll difference is less than half a cell height
    // and size hasn't changed significantly
    return scrollDiff < this.config.cellHeight / 2 && sizeDiff < 10;
  }
  
  // Determine if cache should be invalidated
  private shouldInvalidateCache(viewport: ViewportInfo): boolean {
    if (!this.lastViewport) return true;
    
    const scrollDiff = Math.abs(viewport.scrollTop - this.lastViewport.scrollTop);
    const sizeDiff = Math.abs(viewport.height - this.lastViewport.height) + 
                     Math.abs(viewport.width - this.lastViewport.width);
    
    // Invalidate if scrolled more than 5 rows or viewport size changed significantly
    return scrollDiff > this.config.cellHeight * 5 || sizeDiff > 100;
  }
  
  // Get optimization metrics
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }
  
  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      visibleCells: 0,
      culledCells: 0,
      renderTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  // Clear all caches
  clearCache(): void {
    this.visibilityCache.clear();
    this.lastViewport = null;
    this.lastBounds = null;
    this.cacheGeneration++;
  }
}