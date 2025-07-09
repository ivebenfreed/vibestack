import type { ViewportInfo, Column } from '../types';
import type { OverlayConfig, CellPosition } from './OverlayTypes';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// COORDINATE SYSTEM UTILITIES
// ====================================

export class CoordinateSystem {
  private config: OverlayConfig;
  private rowIndexMap: Map<string, number> = new Map();
  private columnIndexMap: Map<string, number> = new Map();
  private indexToRowId: Map<number, string> = new Map();
  private indexToColumnId: Map<number, string> = new Map();
  private isInsideScrollContainer: boolean = true; // Canvas is now inside scrollable body
  
  // Dimension manager reference
  private dimensionManager: ColumnDimensionManager | null = null;
  private columns: Column[] = [];
  
  // Position cache
  private positionCache: Map<string, CellPosition> = new Map();
  private columnOffsetCache: Map<string, number> = new Map();
  private columnWidthCache: Map<string, number> = new Map();
  private cellKeyCache: Map<string, { rowId: string; columnId: string }> = new Map();
  
  // Add method to parse cell key with caching
  parseCellKey(cellKey: string): { rowId: string; columnId: string } | null {
    let parsed = this.cellKeyCache.get(cellKey);
    if (parsed) {
      return parsed;
    }
    
    const parts = cellKey.split(':');
    if (parts.length !== 2) {
      return null;
    }
    
    parsed = { rowId: parts[0], columnId: parts[1] };
    this.cellKeyCache.set(cellKey, parsed);
    
    // Limit cache size
    if (this.cellKeyCache.size > 500) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.cellKeyCache.keys()).slice(0, 100);
      keysToDelete.forEach(key => this.cellKeyCache.delete(key));
    }
    
    return parsed;
  }

  constructor(config: OverlayConfig, dimensionManager?: ColumnDimensionManager) {
    this.config = config;
    this.dimensionManager = dimensionManager || null;
  }

  // Update the index mappings when data changes
  updateMappings(
    rowIds: string[], 
    columnIds: string[]
  ): void {
    this.rowIndexMap.clear();
    this.columnIndexMap.clear();
    this.indexToRowId.clear();
    this.indexToColumnId.clear();
    
    // Clear all caches when mappings change
    this.clearCaches();

    rowIds.forEach((id, index) => {
      this.rowIndexMap.set(id, index);
      this.indexToRowId.set(index, id);
    });

    columnIds.forEach((id, index) => {
      this.columnIndexMap.set(id, index);
      this.indexToColumnId.set(index, id);
    });
  }
  
  private clearCaches(): void {
    this.positionCache.clear();
    this.columnOffsetCache.clear();
    this.columnWidthCache.clear();
    this.cellKeyCache.clear();
  }
  
  // Columns are now managed by dimensionManager passed during initialization
  
  // Get column width with caching
  private getColumnWidth(columnId: string): number {
    let width = this.columnWidthCache.get(columnId);
    if (width === undefined) {
      width = this.dimensionManager?.getColumnWidth(columnId) || this.config.cellWidth;
      this.columnWidthCache.set(columnId, width);
    }
    return width;
  }
  
  // Get column offset (x position) with caching
  private getColumnOffset(columnId: string): number {
    let offset = this.columnOffsetCache.get(columnId);
    if (offset === undefined) {
      offset = this.dimensionManager?.getColumnOffset(columnId) || 0;
      this.columnOffsetCache.set(columnId, offset);
    }
    return offset;
  }
  
  // Get column by x position
  private getColumnByX(x: number): { columnId: string; columnIndex: number } | null {
    let currentX = 0;
    
    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      const width = this.getColumnWidth(col.id);
      
      if (x >= currentX && x < currentX + width) {
        const columnIndex = this.columnIndexMap.get(col.id);
        if (columnIndex !== undefined) {
          return { columnId: col.id, columnIndex };
        }
      }
      
      currentX += width;
    }
    
    return null;
  }

  // Convert viewport coordinates to cell indices
  viewportToCell(x: number, y: number, viewport: ViewportInfo): CellPosition | null {
    // The canvas is positioned at viewport.start * cellHeight
    // The Y coordinate we receive is relative to the canvas position (0,0 is top-left of canvas)
    // So we need to calculate which row this Y position represents within the canvas
    const canvasStartRow = viewport.start;
    
    // Calculate the row index by adding the canvas start row to the row within canvas
    const rowWithinCanvas = Math.floor(y / this.config.cellHeight);
    const row = canvasStartRow + rowWithinCanvas;
    
    // Find column by x position using actual column widths
    const columnInfo = this.getColumnByX(x);
    if (!columnInfo) {
      return null;
    }
    
    console.log('CoordinateSystem.viewportToCell:', {
      inputX: x,
      inputY: y,
      canvasStartRow,
      rowWithinCanvas,
      absoluteRow: row,
      columnId: columnInfo.columnId,
      columnIndex: columnInfo.columnIndex,
      viewport: { start: viewport.start, end: viewport.end }
    });

    // Validate bounds
    if (row < 0) {
      return null;
    }

    return {
      x: this.getColumnOffset(columnInfo.columnId),
      y: y, // Y is already relative to canvas
      row,
      column: columnInfo.columnIndex
    };
  }

  // Convert cell indices to viewport coordinates
  cellToViewport(row: number, column: number, viewport: ViewportInfo): CellPosition {
    // Get column ID from index
    const columnId = this.indexToColumnId.get(column);
    if (!columnId) {
      // Fallback to old calculation if column not found
      const x = column * this.config.cellWidth;
      const canvasStartRow = viewport.start;
      const canvasOffsetY = canvasStartRow * this.config.cellHeight;
      const y = row * this.config.cellHeight - canvasOffsetY;
      return { x, y, row, column };
    }
    
    // Use actual column offset
    const x = this.getColumnOffset(columnId);
    
    // When canvas is inside scroll container, we need to adjust for canvas offset
    // The canvas is positioned based on the virtual grid's visible range
    // Note: The viewport passed here already includes buffer rows from CanvasOverlayCore
    const canvasStartRow = viewport.start; // Already includes buffer
    const canvasOffsetY = canvasStartRow * this.config.cellHeight;
    
    // Calculate Y position relative to the canvas's current position
    const y = row * this.config.cellHeight - canvasOffsetY;

    return { x, y, row, column };
  }

  // Get cell position by IDs with caching
  getCellPositionByIds(
    rowId: string, 
    columnId: string, 
    viewport: ViewportInfo
  ): CellPosition | null {
    // Create cache key including viewport to handle scrolling
    const cacheKey = `${rowId}:${columnId}:${viewport.start}`;
    
    let position = this.positionCache.get(cacheKey);
    if (position) {
      return position;
    }
    
    const rowIndex = this.rowIndexMap.get(rowId);
    const columnIndex = this.columnIndexMap.get(columnId);

    if (rowIndex === undefined || columnIndex === undefined) {
      return null;
    }

    position = this.cellToViewport(rowIndex, columnIndex, viewport);
    
    // Cache the position for future use
    this.positionCache.set(cacheKey, position);
    
    // Limit cache size to prevent memory issues
    if (this.positionCache.size > 1000) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.positionCache.keys()).slice(0, 200);
      keysToDelete.forEach(key => this.positionCache.delete(key));
    }
    
    return position;
  }

  // Convert cell indices to IDs
  cellIndicesToIds(row: number, column: number): { rowId: string | null; columnId: string | null } {
    return {
      rowId: this.indexToRowId.get(row) || null,
      columnId: this.indexToColumnId.get(column) || null
    };
  }

  // Check if a cell is visible in the viewport
  isCellVisible(row: number, column: number, viewport: ViewportInfo): boolean {
    const position = this.cellToViewport(row, column, viewport);
    
    return position.y >= -this.config.cellHeight && 
           position.y <= viewport.height + this.config.cellHeight &&
           position.x >= 0 &&
           position.x <= viewport.width;
  }

  // Get visible cell range for the current viewport
  getVisibleCellRange(viewport: ViewportInfo): {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  } {
    // Since viewport is already expanded with buffer, use it directly
    const startRow = Math.max(0, viewport.start);
    const endRow = Math.min(this.rowIndexMap.size, viewport.end);
    
    // Calculate visible columns based on actual column widths
    let startColumn = 0;
    let endColumn = this.columns.length;
    
    // If we have columns, calculate which are visible
    if (this.columns.length > 0) {
      let currentX = 0;
      let foundStart = false;
      
      for (let i = 0; i < this.columns.length; i++) {
        const width = this.getColumnWidth(this.columns[i].id);
        
        if (!foundStart && currentX + width > 0) {
          startColumn = i;
          foundStart = true;
        }
        
        if (currentX > viewport.width) {
          endColumn = i + 1;
          break;
        }
        
        currentX += width;
      }
    }

    return { startRow, endRow, startColumn, endColumn };
  }

  // Calculate cell range from drag selection
  calculateDragSelection(
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    viewport: ViewportInfo
  ): Set<string> {
    const selection = new Set<string>();

    const startCell = this.viewportToCell(startPos.x, startPos.y, viewport);
    const endCell = this.viewportToCell(endPos.x, endPos.y, viewport);

    if (!startCell || !endCell) {
      return selection;
    }

    const minRow = Math.min(startCell.row, endCell.row);
    const maxRow = Math.max(startCell.row, endCell.row);
    const minCol = Math.min(startCell.column, endCell.column);
    const maxCol = Math.max(startCell.column, endCell.column);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const { rowId, columnId } = this.cellIndicesToIds(row, col);
        if (rowId && columnId) {
          selection.add(`${rowId}:${columnId}`);
        }
      }
    }

    return selection;
  }

  // Get row and column counts
  getDimensions(): { rowCount: number; columnCount: number } {
    return {
      rowCount: this.rowIndexMap.size,
      columnCount: this.columnIndexMap.size
    };
  }
}