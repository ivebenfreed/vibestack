// ====================================
// ROW DIMENSION MANAGER
// ====================================

export interface RowDimensions {
  totalRows: number;
  rowHeight: number;
  totalHeight: number;
}

export interface VisibleRowRange {
  start: number;
  end: number;
  startWithBuffer: number;
  endWithBuffer: number;
}

export interface RowDimensionChangeEvent {
  type: 'row-count' | 'row-height' | 'total-height';
  oldValue: number;
  newValue: number;
  dimensions: RowDimensions;
}

type RowDimensionChangeListener = (event: RowDimensionChangeEvent) => void;

/**
 * Single source of truth for all row dimension data across VibeGridX.
 * Manages row count, row height, and provides consistent calculations
 * for viewport, virtual scrolling, and overlay synchronization.
 */
export class RowDimensionManager {
  private totalRows: number = 0;
  private rowHeight: number = 40;
  private bufferRows: number = 10;
  private overscan: number = 3;
  private listeners = new Set<RowDimensionChangeListener>();
  
  constructor(defaultRowHeight: number = 40, bufferRows: number = 10) {
    this.rowHeight = defaultRowHeight;
    this.bufferRows = bufferRows;
  }
  
  // ====================================
  // ROW COUNT MANAGEMENT
  // ====================================
  
  /**
   * Set the total number of rows in the table.
   * This is the primary method for updating row count when data changes.
   */
  setRowCount(count: number): void {
    if (count < 0) {
      console.warn('RowDimensionManager: Attempted to set negative row count');
      count = 0;
    }
    
    if (this.totalRows === count) return;
    
    const oldCount = this.totalRows;
    const oldHeight = this.getTotalHeight();
    
    this.totalRows = count;
    
    // Notify listeners of row count change
    this.notifyListeners({
      type: 'row-count',
      oldValue: oldCount,
      newValue: count,
      dimensions: this.getDimensions()
    });
    
    // Also notify of total height change
    const newHeight = this.getTotalHeight();
    if (oldHeight !== newHeight) {
      this.notifyListeners({
        type: 'total-height',
        oldValue: oldHeight,
        newValue: newHeight,
        dimensions: this.getDimensions()
      });
    }
  }
  
  /**
   * Get the current row count
   */
  getRowCount(): number {
    return this.totalRows;
  }
  
  // ====================================
  // ROW HEIGHT MANAGEMENT
  // ====================================
  
  /**
   * Set the height for all rows (uniform height)
   * Future: Can be extended to support variable row heights
   */
  setRowHeight(height: number): void {
    if (height <= 0) {
      console.warn('RowDimensionManager: Invalid row height', height);
      return;
    }
    
    if (this.rowHeight === height) return;
    
    const oldHeight = this.rowHeight;
    const oldTotalHeight = this.getTotalHeight();
    
    this.rowHeight = height;
    
    // Notify listeners
    this.notifyListeners({
      type: 'row-height',
      oldValue: oldHeight,
      newValue: height,
      dimensions: this.getDimensions()
    });
    
    // Also notify of total height change
    const newTotalHeight = this.getTotalHeight();
    if (oldTotalHeight !== newTotalHeight) {
      this.notifyListeners({
        type: 'total-height',
        oldValue: oldTotalHeight,
        newValue: newTotalHeight,
        dimensions: this.getDimensions()
      });
    }
  }
  
  /**
   * Get the current row height
   */
  getRowHeight(): number {
    return this.rowHeight;
  }
  
  // ====================================
  // DIMENSION CALCULATIONS
  // ====================================
  
  /**
   * Get the total height of all rows
   */
  getTotalHeight(): number {
    return Math.max(0, this.totalRows * this.rowHeight);
  }
  
  /**
   * Get the top position (Y offset) for a specific row
   */
  getRowTop(rowIndex: number): number {
    if (rowIndex < 0 || rowIndex >= this.totalRows) {
      return 0;
    }
    return rowIndex * this.rowHeight;
  }
  
  /**
   * Get the bottom position for a specific row
   */
  getRowBottom(rowIndex: number): number {
    return this.getRowTop(rowIndex) + this.rowHeight;
  }
  
  /**
   * Calculate visible row range based on scroll position and viewport height
   */
  getVisibleRange(scrollTop: number, viewportHeight: number): VisibleRowRange {
    if (this.totalRows === 0 || viewportHeight <= 0) {
      return {
        start: 0,
        end: 0,
        startWithBuffer: 0,
        endWithBuffer: 0
      };
    }
    
    // Calculate core visible range
    const firstVisibleRow = Math.floor(scrollTop / this.rowHeight);
    const lastVisibleRow = Math.ceil((scrollTop + viewportHeight) / this.rowHeight) - 1;
    
    // Clamp to actual row bounds
    const start = Math.max(0, firstVisibleRow);
    const end = Math.min(this.totalRows - 1, lastVisibleRow);
    
    // Add buffer for smooth scrolling
    const startWithBuffer = Math.max(0, start - this.bufferRows - this.overscan);
    const endWithBuffer = Math.min(this.totalRows - 1, end + this.bufferRows + this.overscan);
    
    return {
      start,
      end,
      startWithBuffer,
      endWithBuffer
    };
  }
  
  /**
   * Check if a row is within the visible range
   */
  isRowVisible(rowIndex: number, scrollTop: number, viewportHeight: number): boolean {
    const range = this.getVisibleRange(scrollTop, viewportHeight);
    return rowIndex >= range.startWithBuffer && rowIndex <= range.endWithBuffer;
  }
  
  /**
   * Get all current dimensions
   */
  getDimensions(): RowDimensions {
    return {
      totalRows: this.totalRows,
      rowHeight: this.rowHeight,
      totalHeight: this.getTotalHeight()
    };
  }
  
  // ====================================
  // BUFFER CONFIGURATION
  // ====================================
  
  /**
   * Set the number of buffer rows to render outside viewport
   */
  setBufferRows(bufferRows: number): void {
    this.bufferRows = Math.max(0, bufferRows);
  }
  
  /**
   * Set the overscan amount for additional buffering
   */
  setOverscan(overscan: number): void {
    this.overscan = Math.max(0, overscan);
  }
  
  // ====================================
  // CHANGE NOTIFICATIONS
  // ====================================
  
  /**
   * Subscribe to dimension changes
   */
  subscribe(listener: RowDimensionChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of a dimension change
   */
  private notifyListeners(event: RowDimensionChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('RowDimensionManager: Error in dimension change listener', error);
      }
    });
  }
  
  // ====================================
  // UTILITIES
  // ====================================
  
  /**
   * Calculate the maximum scroll position
   */
  getMaxScrollTop(viewportHeight: number): number {
    const totalHeight = this.getTotalHeight();
    return Math.max(0, totalHeight - viewportHeight);
  }
  
  /**
   * Validate and clamp a scroll position
   */
  clampScrollTop(scrollTop: number, viewportHeight: number): number {
    const maxScroll = this.getMaxScrollTop(viewportHeight);
    return Math.max(0, Math.min(scrollTop, maxScroll));
  }
  
  /**
   * Get row index from Y position
   */
  getRowIndexFromY(y: number): number {
    if (y < 0) return 0;
    const index = Math.floor(y / this.rowHeight);
    return Math.min(index, this.totalRows - 1);
  }
  
  /**
   * Debug helper - log current state
   */
  debug(): void {
    console.log('RowDimensionManager Debug:', {
      totalRows: this.totalRows,
      rowHeight: this.rowHeight,
      totalHeight: this.getTotalHeight(),
      bufferRows: this.bufferRows,
      overscan: this.overscan,
      listenerCount: this.listeners.size
    });
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createRowDimensionManager(
  totalRows: number = 0,
  rowHeight: number = 40,
  bufferRows: number = 10
): RowDimensionManager {
  const manager = new RowDimensionManager(rowHeight, bufferRows);
  if (totalRows > 0) {
    manager.setRowCount(totalRows);
  }
  return manager;
}