// ====================================
// DIMENSIONS SLICE - CLEAN VERSION
// ====================================
// Single source of truth: coordinateMapping
// No deprecated fields, no backward compatibility
// Elegant, focused, and simple

import { assign } from 'xstate';
import type { Column } from '../../../types';

// ====================================
// CONSTANTS
// ====================================

const SELECTION_COLUMN_ID = '__selection';
const SELECTION_COLUMN_WIDTH = 48;
const DEFAULT_COLUMN_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 40;

// ====================================
// TYPES
// ====================================

export interface ColumnCoordinate {
  columnId: string;
  index: number;
  offset: number;
  width: number;
}

export interface RowCoordinate {
  rowId: string;
  originalIndex: number;
  sortedIndex: number;
  offset: number;
}

export interface CoordinateMapping {
  rows: RowCoordinate[];
  columns: ColumnCoordinate[];
  version: number;
}

export interface DimensionsState {
  // Row dimensions
  rowHeight: number;
  totalRows: number;
  
  // The single source of truth
  coordinateMapping: CoordinateMapping;
}

// ====================================
// BUILDER FUNCTIONS
// ====================================

/**
 * Build column coordinates from configuration
 */
const buildColumnCoordinates = (
  columns: Column[],
  columnOrder: string[],
  columnVisibility: Record<string, boolean>,
  columnWidths?: Record<string, number>
): ColumnCoordinate[] => {
  const coordinates: ColumnCoordinate[] = [];
  let currentOffset = 0;
  let currentIndex = 0;
  
  // Always add selection column first
  coordinates.push({
    columnId: SELECTION_COLUMN_ID,
    index: currentIndex++,
    offset: currentOffset,
    width: SELECTION_COLUMN_WIDTH
  });
  currentOffset += SELECTION_COLUMN_WIDTH;
  
  // Add visible columns in order
  for (const columnId of columnOrder) {
    if (columnId === SELECTION_COLUMN_ID) continue;
    
    const column = columns.find(col => col.id === columnId);
    if (column && columnVisibility[columnId] !== false) {
      const width = columnWidths?.[columnId] || column.width || DEFAULT_COLUMN_WIDTH;
      coordinates.push({
        columnId: column.id,
        index: currentIndex++,
        offset: currentOffset,
        width
      });
      currentOffset += width;
    }
  }
  
  // Add any remaining visible columns not in order
  const processedIds = new Set([SELECTION_COLUMN_ID, ...columnOrder]);
  for (const column of columns) {
    if (!processedIds.has(column.id) && columnVisibility[column.id] !== false) {
      const width = columnWidths?.[column.id] || column.width || DEFAULT_COLUMN_WIDTH;
      coordinates.push({
        columnId: column.id,
        index: currentIndex++,
        offset: currentOffset,
        width
      });
      currentOffset += width;
    }
  }
  
  return coordinates;
};

/**
 * Build row coordinates
 */
const buildRowCoordinates = (rowCount: number, rowHeight: number): RowCoordinate[] => {
  return Array.from({ length: rowCount }, (_, index) => ({
    rowId: `row-${index}`,
    originalIndex: index,
    sortedIndex: index,
    offset: index * rowHeight
  }));
};

// ====================================
// INITIAL STATE
// ====================================

export const createInitialDimensionsState = (
  columns: Column[],
  rowCount: number,
  rowHeight: number = DEFAULT_ROW_HEIGHT,
  columnOrder: string[] = [],
  columnVisibility: Record<string, boolean> = {},
  columnWidths?: Record<string, number>
): DimensionsState => {
  // Default visibility - all columns visible
  const visibility = Object.keys(columnVisibility).length > 0 
    ? columnVisibility 
    : Object.fromEntries(columns.map(col => [col.id, true]));
  
  // Default order - all columns
  const order = columnOrder.length > 0 
    ? columnOrder 
    : columns.map(col => col.id);
  
  // Build coordinate mapping
  const coordinateMapping: CoordinateMapping = {
    rows: buildRowCoordinates(rowCount, rowHeight),
    columns: buildColumnCoordinates(columns, order, visibility, columnWidths),
    version: 0
  };
  
  return {
    rowHeight,
    totalRows: rowCount,
    coordinateMapping
  };
};

// ====================================
// ACTIONS
// ====================================

export const dimensionActions = {
  /**
   * Recalculate coordinate mapping when layout changes
   */
  recalculateCoordinateMapping: assign({
    coordinateMapping: ({ context }) => {
      // Get current column widths from existing coordinate mapping
      const currentColumnWidths = context.coordinateMapping?.columns ? 
        Object.fromEntries(context.coordinateMapping.columns.map(col => [col.columnId, col.width])) : 
        {};
      
      const columnCoordinates = buildColumnCoordinates(
        context.columns,
        context.columnOrder,
        context.columnVisibility,
        currentColumnWidths
      );
      
      return {
        rows: context.coordinateMapping.rows,
        columns: columnCoordinates,
        version: context.coordinateMapping.version + 1
      };
    }
  }),

  /**
   * Update a single column's width
   */
  updateColumnWidth: assign({
    coordinateMapping: ({ context }, event: { columnId: string; width: number }) => {
      const newColumns = context.coordinateMapping.columns.map(col => {
        if (col.columnId === event.columnId) {
          return { ...col, width: event.width };
        }
        return col;
      });
      
      // Recalculate offsets
      let currentOffset = 0;
      newColumns.forEach(col => {
        col.offset = currentOffset;
        currentOffset += col.width;
      });
      
      return {
        ...context.coordinateMapping,
        columns: newColumns,
        version: context.coordinateMapping.version + 1
      };
    }
  }),
  
  /**
   * Update row dimensions
   */
  updateRowHeight: assign({
    rowHeight: (_, event: { height: number }) => event.height,
    coordinateMapping: ({ context }, event: { height: number }) => {
      const newRows = context.coordinateMapping.rows.map((row, index) => ({
        ...row,
        offset: index * event.height
      }));
      
      return {
        ...context.coordinateMapping,
        rows: newRows,
        version: context.coordinateMapping.version + 1
      };
    }
  }),
  
  updateRowCount: assign({
    totalRows: (_, event: { count: number }) => event.count,
    coordinateMapping: ({ context }, event: { count: number }) => {
      const newRows = buildRowCoordinates(event.count, context.rowHeight);
      
      return {
        ...context.coordinateMapping,
        rows: newRows,
        version: context.coordinateMapping.version + 1
      };
    }
  })
};

// ====================================
// SELECTORS
// ====================================

export const dimensionSelectors = {
  // Column queries
  getColumnWidth: (context: DimensionsState, columnId: string): number => {
    const column = context.coordinateMapping.columns.find(col => col.columnId === columnId);
    return column?.width || DEFAULT_COLUMN_WIDTH;
  },
  
  getColumnOffset: (context: DimensionsState, columnId: string): number => {
    const column = context.coordinateMapping.columns.find(col => col.columnId === columnId);
    return column?.offset || 0;
  },
  
  getColumnByIndex: (context: DimensionsState, index: number): ColumnCoordinate | undefined => {
    return context.coordinateMapping.columns.find(col => col.index === index);
  },
  
  getColumnById: (context: DimensionsState, columnId: string): ColumnCoordinate | undefined => {
    return context.coordinateMapping.columns.find(col => col.columnId === columnId);
  },
  
  getColumnAtPosition: (context: DimensionsState, x: number): ColumnCoordinate | undefined => {
    return context.coordinateMapping.columns.find(
      col => x >= col.offset && x < col.offset + col.width
    );
  },
  
  // Column collections
  getAllColumns: (context: DimensionsState): ColumnCoordinate[] => {
    return context.coordinateMapping.columns;
  },
  
  getDataColumns: (context: DimensionsState): ColumnCoordinate[] => {
    return context.coordinateMapping.columns.filter(col => col.columnId !== SELECTION_COLUMN_ID);
  },
  
  getSelectionColumn: (context: DimensionsState): ColumnCoordinate | undefined => {
    return context.coordinateMapping.columns.find(col => col.columnId === SELECTION_COLUMN_ID);
  },
  
  // Row queries
  getRowHeight: (context: DimensionsState): number => {
    return context.rowHeight;
  },
  
  getRowByIndex: (context: DimensionsState, index: number): RowCoordinate | undefined => {
    return context.coordinateMapping.rows.find(row => row.sortedIndex === index);
  },
  
  getRowById: (context: DimensionsState, rowId: string): RowCoordinate | undefined => {
    return context.coordinateMapping.rows.find(row => row.rowId === rowId);
  },
  
  getRowAtPosition: (context: DimensionsState, y: number): RowCoordinate | undefined => {
    const rowIndex = Math.floor(y / context.rowHeight);
    return context.coordinateMapping.rows[rowIndex];
  },
  
  // Aggregate queries
  getTotalWidth: (context: DimensionsState): number => {
    const columns = context.coordinateMapping.columns;
    if (columns.length === 0) return 0;
    const lastColumn = columns[columns.length - 1];
    return lastColumn.offset + lastColumn.width;
  },
  
  getTotalHeight: (context: DimensionsState): number => {
    return context.totalRows * context.rowHeight;
  },
  
  // Meta queries
  getCoordinateMapping: (context: DimensionsState): CoordinateMapping => {
    return context.coordinateMapping;
  },
  
  getVersion: (context: DimensionsState): number => {
    return context.coordinateMapping.version;
  },
  
  // Utility queries
  getColumnCount: (context: DimensionsState): number => {
    return context.coordinateMapping.columns.length;
  },
  
  getDataColumnCount: (context: DimensionsState): number => {
    return context.coordinateMapping.columns.filter(col => col.columnId !== SELECTION_COLUMN_ID).length;
  },
  
  getRowCount: (context: DimensionsState): number => {
    return context.totalRows;
  }
};