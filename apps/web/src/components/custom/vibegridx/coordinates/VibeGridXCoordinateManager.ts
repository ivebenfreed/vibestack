// ====================================
// VIBEGRIDX COORDINATE MANAGER
// ====================================

import type { CellRef, TableRow, Column } from '../types';

export interface CoordinatePosition {
  rowIndex: number;
  columnIndex: number;
}

export interface RowMapping {
  rowId: string;
  originalIndex: number;
  sortedIndex: number;
}

export interface ColumnMapping {
  columnId: string;
  index: number;
  offset: number;
  width: number;
}

export interface CoordinateChangeEvent {
  type: 'sort-changed' | 'data-changed' | 'columns-changed';
  oldMapping: CoordinateMapping;
  newMapping: CoordinateMapping;
  timestamp: number;
}

export interface CoordinateMapping {
  rows: RowMapping[];
  columns: ColumnMapping[];
  version: number;
  sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

type CoordinateChangeListener = (event: CoordinateChangeEvent) => void;

/**
 * Centralized coordinate management system for VibeGridX.
 * Maintains reliable mappings between:
 * - Logical positions (rowIndex, columnIndex) 
 * - Physical identities (rowId, columnId)
 * - Sorted positions after data transformations
 * 
 * Ensures DOM renderer, canvas overlay, and selection state all use
 * the same coordinate system regardless of sort/filter operations.
 */
export class VibeGridXCoordinateManager {
  private mapping: CoordinateMapping;
  private listeners = new Set<CoordinateChangeListener>();
  private version = 0;
  
  constructor() {
    this.mapping = {
      rows: [],
      columns: [],
      version: 0,
      sortBy: []
    };
  }
  
  // ====================================
  // DATA UPDATES
  // ====================================
  
  /**
   * Update row mappings from sorted data
   */
  updateRows(sortedRows: TableRow[], sortBy: Array<{ field: string; direction: 'asc' | 'desc' }> = []): void {
    const oldMapping = { ...this.mapping };
    
    // Create new row mappings
    const newRows: RowMapping[] = sortedRows.map((row, sortedIndex) => ({
      rowId: row.id,
      originalIndex: -1, // We don't track original index for now
      sortedIndex
    }));
    
    this.mapping = {
      ...this.mapping,
      rows: newRows,
      sortBy: [...sortBy],
      version: ++this.version
    };
    
    // Notify listeners if the sort configuration changed
    const sortChanged = JSON.stringify(oldMapping.sortBy) !== JSON.stringify(sortBy);
    if (sortChanged || oldMapping.rows.length !== newRows.length) {
      this.notifyListeners({
        type: sortChanged ? 'sort-changed' : 'data-changed',
        oldMapping,
        newMapping: { ...this.mapping },
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Update column mappings
   */
  updateColumns(columns: Column[]): void {
    const oldMapping = { ...this.mapping };
    
    let currentOffset = 0;
    const newColumns: ColumnMapping[] = columns.map((column, index) => {
      const width = column.width || 120;
      const mapping: ColumnMapping = {
        columnId: column.id,
        index,
        offset: currentOffset,
        width
      };
      currentOffset += width;
      return mapping;
    });
    
    this.mapping = {
      ...this.mapping,
      columns: newColumns,
      version: ++this.version
    };
    
    // Notify if columns changed
    if (oldMapping.columns.length !== newColumns.length) {
      this.notifyListeners({
        type: 'columns-changed',
        oldMapping,
        newMapping: { ...this.mapping },
        timestamp: Date.now()
      });
    }
  }
  
  // ====================================
  // COORDINATE CONVERSIONS
  // ====================================
  
  /**
   * Convert cell reference to logical position
   */
  cellRefToPosition(cellRef: CellRef): CoordinatePosition | null {
    const rowMapping = this.mapping.rows.find(r => r.rowId === cellRef.rowId);
    const columnMapping = this.mapping.columns.find(c => c.columnId === cellRef.columnId);
    
    if (!rowMapping || !columnMapping) {
      console.warn('VibeGridXCoordinateManager: Could not find mapping for cell', cellRef);
      return null;
    }
    
    return {
      rowIndex: rowMapping.sortedIndex,
      columnIndex: columnMapping.index
    };
  }
  
  /**
   * Convert logical position to cell reference
   */
  positionToCellRef(position: CoordinatePosition): CellRef | null {
    const rowMapping = this.mapping.rows[position.rowIndex];
    const columnMapping = this.mapping.columns[position.columnIndex];
    
    if (!rowMapping || !columnMapping) {
      console.warn('VibeGridXCoordinateManager: Invalid position', position);
      return null;
    }
    
    return {
      rowId: rowMapping.rowId,
      columnId: columnMapping.columnId
    };
  }
  
  /**
   * Convert set of cell keys to logical positions
   */
  cellKeysToPositions(cellKeys: Set<string>): Set<string> {
    const positions = new Set<string>();
    
    for (const cellKey of cellKeys) {
      const [rowId, columnId] = cellKey.split(':');
      const position = this.cellRefToPosition({ rowId, columnId });
      
      if (position) {
        positions.add(`${position.rowIndex}:${position.columnIndex}`);
      }
    }
    
    return positions;
  }
  
  /**
   * Convert set of position keys to cell keys
   */
  positionsToCellKeys(positionKeys: Set<string>): Set<string> {
    const cellKeys = new Set<string>();
    
    for (const positionKey of positionKeys) {
      const [rowIndexStr, columnIndexStr] = positionKey.split(':');
      const rowIndex = parseInt(rowIndexStr, 10);
      const columnIndex = parseInt(columnIndexStr, 10);
      
      const cellRef = this.positionToCellRef({ rowIndex, columnIndex });
      if (cellRef) {
        cellKeys.add(`${cellRef.rowId}:${cellRef.columnId}`);
      }
    }
    
    return cellKeys;
  }
  
  // ====================================
  // RANGE OPERATIONS
  // ====================================
  
  /**
   * Calculate range of logical positions between two cell references
   */
  calculateLogicalRange(start: CellRef, end: CellRef): CoordinatePosition[] {
    const startPos = this.cellRefToPosition(start);
    const endPos = this.cellRefToPosition(end);
    
    if (!startPos || !endPos) {
      return [];
    }
    
    const minRow = Math.min(startPos.rowIndex, endPos.rowIndex);
    const maxRow = Math.max(startPos.rowIndex, endPos.rowIndex);
    const minCol = Math.min(startPos.columnIndex, endPos.columnIndex);
    const maxCol = Math.max(startPos.columnIndex, endPos.columnIndex);
    
    const positions: CoordinatePosition[] = [];
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        positions.push({ rowIndex: row, columnIndex: col });
      }
    }
    
    return positions;
  }
  
  /**
   * Calculate range of cell keys between two cell references using logical coordinates
   */
  calculateCellRange(start: CellRef, end: CellRef): Set<string> {
    const positions = this.calculateLogicalRange(start, end);
    const cellKeys = new Set<string>();
    
    for (const position of positions) {
      const cellRef = this.positionToCellRef(position);
      if (cellRef) {
        cellKeys.add(`${cellRef.rowId}:${cellRef.columnId}`);
      }
    }
    
    return cellKeys;
  }
  
  // ====================================
  // NAVIGATION
  // ====================================
  
  /**
   * Move from current cell reference in a direction
   */
  moveCellRef(current: CellRef, direction: 'up' | 'down' | 'left' | 'right'): CellRef | null {
    const currentPos = this.cellRefToPosition(current);
    if (!currentPos) return null;
    
    let newPos: CoordinatePosition;
    
    switch (direction) {
      case 'up':
        newPos = { ...currentPos, rowIndex: Math.max(0, currentPos.rowIndex - 1) };
        break;
      case 'down':
        newPos = { ...currentPos, rowIndex: Math.min(this.mapping.rows.length - 1, currentPos.rowIndex + 1) };
        break;
      case 'left':
        newPos = { ...currentPos, columnIndex: Math.max(0, currentPos.columnIndex - 1) };
        break;
      case 'right':
        newPos = { ...currentPos, columnIndex: Math.min(this.mapping.columns.length - 1, currentPos.columnIndex + 1) };
        break;
      default:
        return current;
    }
    
    return this.positionToCellRef(newPos);
  }
  
  // ====================================
  // GETTERS
  // ====================================
  
  /**
   * Get current coordinate mapping
   */
  getMapping(): Readonly<CoordinateMapping> {
    return this.mapping;
  }
  
  /**
   * Get current version for change detection
   */
  getVersion(): number {
    return this.version;
  }
  
  /**
   * Get sorted row IDs in current order
   */
  getSortedRowIds(): string[] {
    return this.mapping.rows.map(row => row.rowId);
  }
  
  /**
   * Get column IDs in current order
   */
  getColumnIds(): string[] {
    return this.mapping.columns.map(col => col.columnId);
  }
  
  /**
   * Get column offset for positioning
   */
  getColumnOffset(columnId: string): number {
    const column = this.mapping.columns.find(c => c.columnId === columnId);
    return column?.offset || 0;
  }
  
  /**
   * Get column width
   */
  getColumnWidth(columnId: string): number {
    const column = this.mapping.columns.find(c => c.columnId === columnId);
    return column?.width || 120;
  }
  
  /**
   * Check if a row exists in current mapping
   */
  hasRow(rowId: string): boolean {
    return this.mapping.rows.some(r => r.rowId === rowId);
  }
  
  /**
   * Check if a column exists in current mapping
   */
  hasColumn(columnId: string): boolean {
    return this.mapping.columns.some(c => c.columnId === columnId);
  }
  
  /**
   * Get row count
   */
  getRowCount(): number {
    return this.mapping.rows.length;
  }
  
  /**
   * Get column count
   */
  getColumnCount(): number {
    return this.mapping.columns.length;
  }
  
  // ====================================
  // EVENT HANDLING
  // ====================================
  
  /**
   * Subscribe to coordinate changes
   */
  subscribe(listener: CoordinateChangeListener): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of coordinate changes
   */
  private notifyListeners(event: CoordinateChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('VibeGridXCoordinateManager: Error in change listener', error);
      }
    });
  }
  
  // ====================================
  // UTILITIES
  // ====================================
  
  /**
   * Clear all mappings
   */
  clear(): void {
    const oldMapping = { ...this.mapping };
    
    this.mapping = {
      rows: [],
      columns: [],
      version: ++this.version,
      sortBy: []
    };
    
    this.notifyListeners({
      type: 'data-changed',
      oldMapping,
      newMapping: { ...this.mapping },
      timestamp: Date.now()
    });
  }
  
  /**
   * Debug helper
   */
  debug(): void {
    console.log('VibeGridXCoordinateManager Debug:', {
      version: this.version,
      rowCount: this.mapping.rows.length,
      columnCount: this.mapping.columns.length,
      sortBy: this.mapping.sortBy,
      listenerCount: this.listeners.size,
      sampleRows: this.mapping.rows.slice(0, 3),
      sampleColumns: this.mapping.columns.slice(0, 3)
    });
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createVibeGridXCoordinateManager(): VibeGridXCoordinateManager {
  return new VibeGridXCoordinateManager();
}