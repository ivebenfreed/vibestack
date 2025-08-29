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
  
  // Add visible columns in the order they appear in the columns array
  for (const column of columns) {
    // Skip if column is undefined or doesn't have an id
    if (!column || !column.id) continue;
    
    // Skip selection column - it's already added
    if (column.id === SELECTION_COLUMN_ID) continue;
    
    // Skip hidden columns
    if (columnVisibility[column.id] === false) continue;
    
    const width = columnWidths?.[column.id] || column.width || DEFAULT_COLUMN_WIDTH;
    coordinates.push({
      columnId: column.id,
      index: currentIndex++,
      offset: currentOffset,
      width
    });
    currentOffset += width;
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
  columnWidths?: Record<string, number>,
  storeActor?: any
): DimensionsState => {
  // Create a minimal initial coordinate mapping
  // This will be recalculated when store data becomes available
  const initialColumns = columns.length > 0 ? columns : [];
  const visibility = Object.keys(columnVisibility).length > 0 
    ? columnVisibility 
    : Object.fromEntries(initialColumns.map(col => [col.id, true]));
  
  console.log('🔧 Creating initial dimensions state', {
    columnsCount: initialColumns.length,
    rowCount
  });
  
  // Build initial coordinate mapping - will be replaced when store syncs
  const coordinateMapping: CoordinateMapping = {
    rows: buildRowCoordinates(rowCount, rowHeight),
    columns: buildColumnCoordinates(initialColumns, visibility, columnWidths),
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
   * Calculate coordinates directly from store data - no persistent mapping
   */
  recalculateCoordinateMapping: assign({
    coordinateMapping: ({ context }) => {
      // Get columns and visibility directly from store
      const storeSnapshot = context.storeActor?.getSnapshot();
      const storeColumns = storeSnapshot?.context?.columns || context.columns;
      const columnVisibility = storeSnapshot?.context?.columnVisibility || context.columnVisibility || {};
      const columnWidths = storeSnapshot?.context?.columnWidths || context.columnWidths || {};
      
      console.log('🔄 Recalculating coordinates from store data', {
        storeColumnsCount: storeColumns.length,
        storeColumnIds: storeColumns.map(c => c.id),
        visibilityKeys: Object.keys(columnVisibility),
        visibility: columnVisibility,
        widthKeys: Object.keys(columnWidths),
        hiddenColumns: Object.entries(columnVisibility).filter(([_, visible]) => visible === false).map(([id]) => id)
      });
      
      const columnCoordinates = buildColumnCoordinates(
        storeColumns,
        columnVisibility,
        columnWidths
      );
      
      console.log('🔄 Built column coordinates', {
        coordinatesCount: columnCoordinates.length,
        coordinateIds: columnCoordinates.map(c => c.columnId)
      });
      
      const rowCoordinates = buildRowCoordinates(context.totalRows, context.rowHeight);
      
      return {
        rows: rowCoordinates,
        columns: columnCoordinates,
        version: (context.coordinateMapping?.version || 0) + 1
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