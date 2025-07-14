import type { Column } from '../types';

// ====================================
// COLUMN MANAGER
// ====================================

/**
 * Manages column configuration, visibility, ordering, and widths
 * Extracted from AtomicTableRenderer for better separation of concerns
 */
export class ColumnManager {
  private columns: Column[] = [];
  private columnVisibility: Record<string, boolean> = {};
  private visibleColumns: Column[] = [];
  private columnWidths: Record<string, number> = {};
  private enableSelectionColumn: boolean;
  
  constructor(options: {
    columns?: Column[];
    enableSelectionColumn?: boolean;
    columnVisibility?: Record<string, boolean>;
    columnWidths?: Record<string, number>;
  } = {}) {
    this.enableSelectionColumn = options.enableSelectionColumn || false;
    
    if (options.columns) {
      this.setColumns(options.columns);
    }
    
    if (options.columnVisibility) {
      this.columnVisibility = options.columnVisibility;
    }
    
    if (options.columnWidths) {
      this.columnWidths = options.columnWidths;
    }
  }
  
  /**
   * Set or update columns
   */
  setColumns(columns: Column[]): void {
    this.columns = columns;
    this.updateVisibleColumns();
  }
  
  /**
   * Get all columns
   */
  getColumns(): Column[] {
    return this.columns;
  }
  
  /**
   * Set or update column visibility
   */
  setColumnVisibility(visibility: Record<string, boolean>): void {
    this.columnVisibility = visibility;
    this.updateVisibleColumns();
    
    // Note: Column ordering is maintained separately from visibility
    // The view-actor.ts handles filtering out hidden columns from the order
  }
  
  /**
   * Get column visibility map
   */
  getColumnVisibility(): Record<string, boolean> {
    return this.columnVisibility;
  }
  
  /**
   * Apply column order
   */
  setColumnOrder(order: string[]): void {
    const orderedColumns: Column[] = [];
    
    // First pass: add columns in the specified order (only if they exist)
    for (const columnId of order) {
      const column = this.columns.find(c => c.id === columnId);
      if (column) {
        orderedColumns.push(column);
      }
      // Note: Silently skip columns that don't exist in this.columns
      // This prevents warnings when column order contains hidden columns
    }
    
    // Second pass: add any remaining columns not in the order
    for (const column of this.columns) {
      if (!order.includes(column.id)) {
        orderedColumns.push(column);
      }
    }
    
    this.columns = orderedColumns;
    this.updateVisibleColumns();
  }
  
  /**
   * Set column widths
   */
  setColumnWidths(widths: Record<string, number>): void {
    this.columnWidths = widths;
  }
  
  /**
   * Set width for a specific column
   */
  setColumnWidth(columnId: string, width: number): void {
    this.columnWidths[columnId] = width;
  }
  
  /**
   * Get column width
   */
  getColumnWidth(columnId: string, defaultWidth = 120): number {
    const column = this.columns.find(c => c.id === columnId);
    return this.columnWidths[columnId] || column?.width || defaultWidth;
  }
  
  /**
   * Get all column widths
   */
  getColumnWidths(): Record<string, number> {
    return this.columnWidths;
  }
  
  /**
   * Get visible columns (filtered by visibility settings)
   */
  getVisibleColumns(): Column[] {
    return this.visibleColumns;
  }
  
  /**
   * Get data columns (visible columns excluding selection column)
   */
  getDataColumns(): Column[] {
    // Filter out the selection column when enabled
    return this.enableSelectionColumn 
      ? this.visibleColumns.filter(col => col.id !== '__selection')
      : this.visibleColumns;
  }
  
  /**
   * Check if selection column is enabled
   */
  isSelectionColumnEnabled(): boolean {
    return this.enableSelectionColumn;
  }
  
  /**
   * Enable or disable selection column
   */
  setSelectionColumnEnabled(enabled: boolean): void {
    this.enableSelectionColumn = enabled;
    this.updateVisibleColumns();
  }
  
  /**
   * Calculate total width of all visible columns
   */
  getTotalWidth(): number {
    let totalWidth = 0;
    
    // Add selection column width if enabled
    if (this.enableSelectionColumn) {
      totalWidth += 48; // Fixed width for selection column
    }
    
    // Add widths of all visible data columns
    for (const column of this.visibleColumns) {
      totalWidth += this.getColumnWidth(column.id);
    }
    
    return totalWidth;
  }
  
  /**
   * Get column by ID
   */
  getColumnById(columnId: string): Column | undefined {
    return this.columns.find(col => col.id === columnId);
  }
  
  /**
   * Get visible column order (filters out hidden columns)
   */
  getVisibleColumnOrder(): string[] {
    return this.getVisibleColumns().map(col => col.id);
  }
  
  /**
   * Get column index in visible columns
   */
  getVisibleColumnIndex(columnId: string): number {
    return this.visibleColumns.findIndex(col => col.id === columnId);
  }
  
  /**
   * Update the list of visible columns based on visibility settings
   */
  private updateVisibleColumns(): void {
    // Filter columns based on visibility settings
    this.visibleColumns = this.columns.filter(column => {
      // If no visibility settings, all columns are visible by default
      if (Object.keys(this.columnVisibility).length === 0) {
        return true;
      }
      // Otherwise check visibility setting (default to true if not specified)
      return this.columnVisibility[column.id] !== false;
    });
  }
  
  /**
   * Get total width of all visible columns using render state context
   * @param renderStateWidths Optional column widths from render state
   */
  getTotalColumnsWidth(renderStateWidths?: Record<string, number>): number {
    // Use render state column widths if available (from table machine context)
    if (renderStateWidths) {
      let totalWidth = 0;
      
      // Selection column is always included
      if (this.enableSelectionColumn) {
        totalWidth += 48; // Fixed width for selection column
      }
      
      this.visibleColumns.forEach(column => {
        totalWidth += renderStateWidths[column.id] || column.width || 120;
      });
      
      return totalWidth;
    }
    
    // Fallback: calculate from column definitions
    let totalWidth = 0;
    
    // Selection column is always included
    if (this.enableSelectionColumn) {
      totalWidth += 48; // Fixed width for selection column
    }
    
    this.visibleColumns.forEach(column => {
      totalWidth += this.getColumnWidth(column.id);
    });
    
    console.log('ColumnManager: Total width calculation:', {
      totalWidth,
      visibleColumns: this.visibleColumns.length,
      hasRenderStateWidths: !!renderStateWidths,
      columnWidths: this.columnWidths
    });
    
    return totalWidth;
  }
  
  /**
   * Get column offset position for visible columns only
   * @param columnId The column ID to get offset for
   * @param renderStateOffsets Optional column offsets from render state
   * @param renderStateWidths Optional column widths from render state
   */
  getColumnOffset(
    columnId: string, 
    renderStateOffsets?: Record<string, number>,
    renderStateWidths?: Record<string, number>
  ): number {
    // Use render state column offsets if available (from table machine context)
    if (renderStateOffsets && renderStateOffsets[columnId] !== undefined) {
      return renderStateOffsets[columnId];
    }
    
    // Fallback: calculate offset based on visible columns that come before this column
    let offset = 0;
    
    // Selection column is always included and goes first
    if (this.enableSelectionColumn) {
      offset += 48; // Fixed width for selection column
    }
    
    for (const column of this.visibleColumns) {
      if (column.id === columnId) {
        break;
      }
      const width = renderStateWidths?.[column.id] || this.getColumnWidth(column.id);
      offset += width;
    }
    
    return offset;
  }
  
  /**
   * Calculate all column offsets for current visible columns
   * @returns Map of column ID to offset position
   */
  calculateColumnOffsets(): Record<string, number> {
    const offsets: Record<string, number> = {};
    let currentOffset = 0;
    
    // Handle selection column specially if it exists
    if (this.enableSelectionColumn) {
      offsets['__selection'] = 0;
      currentOffset = 48; // Selection column is always 48px wide
    }
    
    // Position data columns
    this.visibleColumns.forEach(column => {
      if (column.id === '__selection') return; // Already handled
      
      offsets[column.id] = currentOffset;
      const width = this.getColumnWidth(column.id);
      currentOffset += width;
    });
    
    return offsets;
  }
  
  /**
   * Update column width and calculate new layout information
   * @param columnId The column to update
   * @param width The new width
   * @returns Layout information needed for DOM updates
   */
  updateColumnWidthAndCalculateLayout(columnId: string, width: number): {
    totalWidth: number;
    columnOffsets: Record<string, number>;
    columnWidths: Record<string, number>;
    visibleColumns: Column[];
    columnIndex: number;
  } | null {
    console.log('[ColumnManager] Updating column width', { columnId, width });
    
    // Update the width
    this.setColumnWidth(columnId, width);
    
    // Find the column index
    const columnIndex = this.getVisibleColumnIndex(columnId);
    if (columnIndex === -1) return null;
    
    // Calculate new offsets
    let currentOffset = 0;
    const columnOffsets: Record<string, number> = {};
    const columnWidths: Record<string, number> = {};
    
    console.log('[ColumnManager] Calculating offsets:', {
      enableSelectionColumn: this.enableSelectionColumn,
      startingOffset: currentOffset,
      visibleColumns: this.visibleColumns.map(c => c.id)
    });
    
    // Handle selection column specially if it exists
    if (this.enableSelectionColumn) {
      columnOffsets['__selection'] = 0;
      currentOffset = 48; // Selection column is always 48px wide
      console.log('[ColumnManager] Selection column found, positioned at 0, next offset: 48');
    } else {
      // If no selection column in visibleColumns but cells expect it, start at 48
      currentOffset = 48;
      console.log('[ColumnManager] No selection column in visibleColumns, but starting at 48 for cell compatibility');
    }
    
    // Position data columns and collect widths
    this.visibleColumns.forEach(col => {
      if (col.id === '__selection') return; // Already handled
      
      columnOffsets[col.id] = currentOffset;
      const colWidth = this.getColumnWidth(col.id);
      columnWidths[col.id] = colWidth;
      console.log(`[ColumnManager] Column ${col.id}: offset=${currentOffset}, width=${colWidth}`);
      currentOffset += colWidth;
    });
    
    return {
      totalWidth: currentOffset,
      columnOffsets,
      columnWidths,
      visibleColumns: this.visibleColumns,
      columnIndex
    };
  }
  
  /**
   * Get metrics for debugging
   */
  getMetrics() {
    return {
      totalColumns: this.columns.length,
      visibleColumns: this.visibleColumns.length,
      hiddenColumns: this.columns.length - this.visibleColumns.length,
      selectionColumnEnabled: this.enableSelectionColumn,
      totalWidth: this.getTotalWidth(),
      columnWidths: this.columnWidths
    };
  }
}