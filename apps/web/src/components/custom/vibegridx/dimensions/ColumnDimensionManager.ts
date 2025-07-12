import type { Column } from '../types';

// ====================================
// COLUMN DIMENSION MANAGER
// ====================================

export interface ColumnDimensions {
  width: number;
  offset: number;
  index: number;
}

export interface DimensionChangeEvent {
  columnId: string;
  oldWidth: number;
  newWidth: number;
  offset: number;
}

type DimensionChangeListener = (event: DimensionChangeEvent) => void;

/**
 * Single source of truth for all column dimension data across VibeGridX.
 * Manages column widths, offsets, and provides consistent calculations
 * for both DOM and Canvas layers.
 */
export class ColumnDimensionManager {
  private columns: Column[] = [];
  private dimensionsMap = new Map<string, ColumnDimensions>();
  private totalWidth: number = 0;
  private defaultColumnWidth: number = 120;
  private listeners = new Set<DimensionChangeListener>();
  private enableSelectionColumn: boolean = false;
  private selectionColumnWidth: number = 48;
  
  constructor(defaultWidth: number = 120) {
    this.defaultColumnWidth = defaultWidth;
  }
  
  // ====================================
  // INITIALIZATION
  // ====================================
  
  /**
   * Initialize or update columns configuration.
   * Recalculates all offsets and dimensions.
   */
  setColumns(columns: Column[]): void {
    this.columns = columns;
    this.recalculateDimensions();
  }
  
  /**
   * Enable or disable the selection column
   */
  setSelectionColumnEnabled(enabled: boolean): void {
    if (this.enableSelectionColumn !== enabled) {
      this.enableSelectionColumn = enabled;
      this.recalculateDimensions();
    }
  }
  
  /**
   * Recalculate all column dimensions and offsets
   */
  private recalculateDimensions(): void {
    this.dimensionsMap.clear();
    let currentOffset = 0;
    
    // Account for selection column if enabled
    if (this.enableSelectionColumn) {
      currentOffset = this.selectionColumnWidth;
    }
    
    this.columns.forEach((column, index) => {
      const width = column.width || this.defaultColumnWidth;
      
      this.dimensionsMap.set(column.id, {
        width,
        offset: currentOffset,
        index
      });
      
      currentOffset += width;
    });
    
    this.totalWidth = currentOffset;
  }
  
  // ====================================
  // DIMENSION QUERIES
  // ====================================
  
  /**
   * Get width for a specific column
   */
  getColumnWidth(columnId: string): number {
    const dimensions = this.dimensionsMap.get(columnId);
    return dimensions?.width || this.defaultColumnWidth;
  }
  
  /**
   * Get x-offset for a specific column
   */
  getColumnOffset(columnId: string): number {
    const dimensions = this.dimensionsMap.get(columnId);
    return dimensions?.offset || 0;
  }
  
  /**
   * Get complete dimensions for a column
   */
  getColumnDimensions(columnId: string): ColumnDimensions | null {
    return this.dimensionsMap.get(columnId) || null;
  }
  
  /**
   * Get column by x position
   */
  getColumnByX(x: number): { column: Column; dimensions: ColumnDimensions } | null {
    for (const column of this.columns) {
      const dimensions = this.dimensionsMap.get(column.id);
      if (!dimensions) continue;
      
      if (x >= dimensions.offset && x < dimensions.offset + dimensions.width) {
        return { column, dimensions };
      }
    }
    
    return null;
  }
  
  /**
   * Get all columns with their dimensions
   */
  getAllColumnDimensions(): Array<{ column: Column; dimensions: ColumnDimensions }> {
    return this.columns.map(column => ({
      column,
      dimensions: this.dimensionsMap.get(column.id)!
    })).filter(item => item.dimensions != null);
  }
  
  /**
   * Get total width of all columns
   */
  getTotalWidth(): number {
    return this.totalWidth;
  }
  
  /**
   * Get column count
   */
  getColumnCount(): number {
    return this.columns.length;
  }
  
  /**
   * Get column by index
   */
  getColumnByIndex(index: number): Column | null {
    return this.columns[index] || null;
  }
  
  /**
   * Get column index by ID
   */
  getColumnIndex(columnId: string): number {
    const dimensions = this.dimensionsMap.get(columnId);
    return dimensions?.index ?? -1;
  }
  
  /**
   * Get column X position by index
   */
  getColumnX(index: number): number {
    const column = this.columns[index];
    if (!column) return 0;
    const dimensions = this.dimensionsMap.get(column.id);
    return dimensions?.offset || 0;
  }
  
  /**
   * Get column name by index
   */
  getColumnName(index: number): string {
    const column = this.columns[index];
    return column?.name || '';
  }
  
  /**
   * Get column index at X position
   */
  getColumnIndexAtX(x: number): number {
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      const dimensions = this.dimensionsMap.get(column.id);
      if (!dimensions) continue;
      
      if (x >= dimensions.offset && x < dimensions.offset + dimensions.width) {
        return i;
      }
    }
    return this.columns.length; // Return last index + 1 if beyond all columns
  }
  
  // ====================================
  // DIMENSION UPDATES
  // ====================================
  
  /**
   * Update width for a specific column (e.g., during resize)
   */
  setColumnWidth(columnId: string, newWidth: number): void {
    const column = this.columns.find(c => c.id === columnId);
    if (!column) return;
    
    const oldDimensions = this.dimensionsMap.get(columnId);
    if (!oldDimensions) return;
    
    // Enforce min/max constraints
    const minWidth = column.minWidth || 50;
    const maxWidth = column.maxWidth || 500;
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    // Update column definition
    column.width = constrainedWidth;
    
    // Store old width for event
    const oldWidth = oldDimensions.width;
    
    // Recalculate all dimensions (offsets will change for subsequent columns)
    this.recalculateDimensions();
    
    // Get new dimensions
    const newDimensions = this.dimensionsMap.get(columnId)!;
    
    // Notify listeners
    this.notifyListeners({
      columnId,
      oldWidth,
      newWidth: constrainedWidth,
      offset: newDimensions.offset
    });
  }
  
  /**
   * Batch update multiple column widths
   */
  setColumnWidths(updates: Array<{ columnId: string; width: number }>): void {
    // Apply all updates first
    updates.forEach(({ columnId, width }) => {
      const column = this.columns.find(c => c.id === columnId);
      if (column) {
        const minWidth = column.minWidth || 50;
        const maxWidth = column.maxWidth || 500;
        column.width = Math.max(minWidth, Math.min(maxWidth, width));
      }
    });
    
    // Recalculate once
    this.recalculateDimensions();
    
    // Notify for each change
    updates.forEach(({ columnId }) => {
      const dimensions = this.dimensionsMap.get(columnId);
      if (dimensions) {
        this.notifyListeners({
          columnId,
          oldWidth: dimensions.width, // This is simplified - in real impl might track old values
          newWidth: dimensions.width,
          offset: dimensions.offset
        });
      }
    });
  }
  
  // ====================================
  // CHANGE NOTIFICATIONS
  // ====================================
  
  /**
   * Subscribe to dimension changes
   */
  subscribe(listener: DimensionChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of a dimension change
   */
  private notifyListeners(event: DimensionChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('ColumnDimensionManager: Error in dimension change listener', error);
      }
    });
  }
  
  // ====================================
  // UTILITIES
  // ====================================
  
  /**
   * Export current dimensions for persistence
   */
  exportDimensions(): Record<string, number> {
    const dimensions: Record<string, number> = {};
    
    this.columns.forEach(column => {
      dimensions[column.id] = column.width || this.defaultColumnWidth;
    });
    
    return dimensions;
  }
  
  /**
   * Import saved dimensions
   */
  importDimensions(dimensions: Record<string, number>): void {
    const updates: Array<{ columnId: string; width: number }> = [];
    
    Object.entries(dimensions).forEach(([columnId, width]) => {
      if (this.columns.find(c => c.id === columnId)) {
        updates.push({ columnId, width });
      }
    });
    
    if (updates.length > 0) {
      this.setColumnWidths(updates);
    }
  }
  
  /**
   * Reset all columns to default widths
   */
  resetToDefaults(): void {
    const updates = this.columns.map(column => ({
      columnId: column.id,
      width: column.width || this.defaultColumnWidth
    }));
    
    this.setColumnWidths(updates);
  }
  
  /**
   * Clone this manager with same configuration
   */
  clone(): ColumnDimensionManager {
    const cloned = new ColumnDimensionManager(this.defaultColumnWidth);
    cloned.setColumns([...this.columns]);
    return cloned;
  }
  
  /**
   * Debug helper - log current dimensions
   */
  debugDimensions(): void {
    console.log('ColumnDimensionManager Debug:', {
      totalWidth: this.totalWidth,
      columnCount: this.columns.length,
      dimensions: Array.from(this.dimensionsMap.entries()).map(([id, dims]) => ({
        id,
        ...dims
      }))
    });
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createColumnDimensionManager(
  columns: Column[], 
  defaultWidth: number = 120,
  entityType?: string
): ColumnDimensionManager {
  const manager = new ColumnDimensionManager(defaultWidth);
  
  // Load persisted widths from localStorage
  if (entityType && typeof window !== 'undefined') {
    const widthsKey = `vibegridx-column-widths-${entityType}`;
    const persistedWidths = JSON.parse(localStorage.getItem(widthsKey) || '{}');
    
    // Apply persisted widths to columns
    columns = columns.map(col => ({
      ...col,
      width: persistedWidths[col.id] || col.width || defaultWidth
    }));
  }
  
  manager.setColumns(columns);
  return manager;
}