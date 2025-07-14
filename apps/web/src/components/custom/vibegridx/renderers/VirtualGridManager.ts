import type { ViewportInfo } from '../types';

// ====================================
// VIRTUAL GRID MANAGER
// ====================================

/**
 * Manages virtual scrolling calculations and viewport state
 * Extracted from AtomicTableRenderer for better separation of concerns
 */
export class VirtualGridManager {
  private viewport: ViewportInfo;
  private totalRows: number;
  private rowHeight: number;
  private visibleRange: { start: number; end: number };
  
  constructor(initialViewport: ViewportInfo) {
    this.viewport = initialViewport;
    this.totalRows = 0;
    this.rowHeight = initialViewport.itemHeight;
    
    // PERFORMANCE FIX: Initialize visible range from initial viewport
    const bufferRows = 5;
    this.visibleRange = {
      start: Math.max(0, initialViewport.start - bufferRows),
      end: Math.max(0, initialViewport.end + bufferRows)
    };
  }
  
  updateViewport(viewport: ViewportInfo, totalRows: number): boolean {
    const oldRange = { ...this.visibleRange };
    
    this.viewport = viewport;
    this.totalRows = totalRows;
    this.rowHeight = viewport.itemHeight;
    
    // Calculate visible range with buffer
    const bufferRows = 5;
    
    // Always try to render a few extra rows for smooth scrolling
    // But ensure we don't go beyond the actual data
    this.visibleRange = {
      start: Math.max(0, viewport.start - bufferRows),
      end: Math.min(totalRows, viewport.end + bufferRows)
    };
    
    // Return true if range changed
    return oldRange.start !== this.visibleRange.start || 
           oldRange.end !== this.visibleRange.end;
  }
  
  isRowVisible(index: number): boolean {
    return index >= this.visibleRange.start && index < this.visibleRange.end;
  }
  
  getVisibleRange(): { start: number; end: number } {
    return { ...this.visibleRange };
  }
  
  getRowTop(index: number): number {
    // Since we use box-sizing: border-box, borders are included in row height
    return index * this.rowHeight;
  }
  
  getTotalHeight(): number {
    // Calculate base height for all rows
    const baseHeight = this.totalRows * this.rowHeight;
    
    // Add extra space at the bottom to ensure the last row is never cut off
    // This needs to be at least one row height to guarantee full visibility
    const bottomPadding = this.rowHeight;
    
    return Math.max(0, baseHeight + bottomPadding);
  }
  
  getRowHeight(): number {
    return this.rowHeight;
  }
  
  setRowCount(count: number): void {
    this.totalRows = count;
  }
  
  /**
   * Calculate viewport info from scroll position
   * Used during scroll events
   */
  calculateViewportFromScroll(
    scrollTop: number, 
    viewportHeight: number, 
    viewportWidth: number,
    scrollLeft: number = 0
  ): ViewportInfo {
    // Calculate visible rows based on scroll position
    const calculatedStart = Math.floor(scrollTop / this.rowHeight);
    // Calculate how many rows fit in viewport, ensuring we always show enough
    const visibleRowCount = Math.ceil(viewportHeight / this.rowHeight);
    // Add buffer rows for smooth scrolling
    const bufferRows = 5;
    const calculatedEnd = calculatedStart + visibleRowCount + bufferRows;
    
    // Cap to actual row count
    const cappedEnd = Math.min(calculatedEnd, this.totalRows);
    
    console.log('VirtualGridManager: calculateViewportFromScroll', {
      scrollTop,
      viewportHeight,
      rowHeight: this.rowHeight,
      visibleRowCount,
      calculatedStart,
      calculatedEnd,
      cappedEnd,
      totalRows: this.totalRows
    });
    
    return {
      start: calculatedStart,
      end: cappedEnd,
      height: viewportHeight,
      width: viewportWidth,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
      itemHeight: this.rowHeight
    };
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      totalRows: this.totalRows,
      rowHeight: this.rowHeight,
      visibleRange: this.visibleRange,
      viewport: this.viewport,
      totalHeight: this.getTotalHeight()
    };
  }
}