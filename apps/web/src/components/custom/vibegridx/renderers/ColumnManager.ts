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
    
    // First pass: add columns in the specified order
    for (const columnId of order) {
      const column = this.columns.find(c => c.id === columnId);
      if (column) {
        orderedColumns.push(column);
      }
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