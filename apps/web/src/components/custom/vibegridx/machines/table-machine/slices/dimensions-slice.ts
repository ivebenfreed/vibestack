// ====================================
// DIMENSIONS SLICE
// ====================================
// SINGLE SOURCE OF TRUTH for all coordinate and dimension data
// This slice is the authoritative source for all coordinate calculations

import { assign } from 'xstate';
import type { Column } from '../../../types';
import { createColumnDimensionManager } from '../../../dimensions/ColumnDimensionManager';
import { createRowDimensionManager } from '../../../dimensions/RowDimensionManager';

// ====================================
// TYPES
// ====================================

export interface DimensionsState {
  // Column dimensions - AUTHORITATIVE
  columnWidths: Record<string, number>;
  columnOffsets: Record<string, number>;
  totalWidth: number;
  
  // Row dimensions - AUTHORITATIVE
  rowHeight: number;
  totalRows: number;
  totalHeight: number;
  
  // Coordinate mapping - AUTHORITATIVE
  coordinateMapping: {
    rows: Array<{
      rowId: string;
      originalIndex: number;
      sortedIndex: number;
      offset: number;
    }>;
    columns: Array<{
      columnId: string;
      index: number;
      offset: number;
      width: number;
    }>;
    version: number;
  };
  
  // Managers (for backward compatibility, will be phased out)
  dimensionManager?: any;
  rowDimensionManager?: any;
}

// This is needed for the context to have all required fields
export interface DimensionsContext extends DimensionsState {
  enableSelectionColumn: boolean;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialDimensionsState = (
  columns: Column[],
  rowCount: number,
  rowHeight: number = 40,
  enableSelectionColumn: boolean = false,
  persistedColumnWidths?: Record<string, number>,
  columnOrder?: string[]
): DimensionsState => {
  // Create managers for backward compatibility
  const dimensionManager = createColumnDimensionManager(columns || []);
  if (enableSelectionColumn) {
    dimensionManager.setSelectionColumnEnabled(true);
  }
  
  const rowDimensionManager = createRowDimensionManager(rowCount, rowHeight);
  
  // Extract initial state from managers
  const columnWidths: Record<string, number> = {};
  const columnOffsets: Record<string, number> = {};
  let totalWidth = 0;
  
  // Build coordinate mapping - AUTHORITATIVE source
  const coordinateMapping = {
    rows: Array.from({ length: rowCount }, (_, index) => ({
      rowId: `row-${index}`,
      originalIndex: index,
      sortedIndex: index,
      offset: index * rowHeight
    })),
    columns: [] as Array<{
      columnId: string;
      index: number;
      offset: number;
      width: number;
    }>,
    version: 0
  };
  
  // Handle selection column first if enabled
  if (enableSelectionColumn) {
    const selectionWidth = 48;
    columnWidths['__selection'] = selectionWidth;
    columnOffsets['__selection'] = 0;
    coordinateMapping.columns.push({
      columnId: '__selection',
      index: 0,
      offset: 0,
      width: selectionWidth
    });
    totalWidth = selectionWidth;
  }
  
  // Order columns according to columnOrder if provided
  const orderedColumns = columnOrder 
    ? columnOrder.map(id => columns.find(col => col.id === id)).filter(Boolean) as Column[]
    : columns;
  
  // Add remaining columns not in the order
  const remainingColumns = columns.filter(col => !orderedColumns.some(oc => oc.id === col.id));
  const allOrderedColumns = [...orderedColumns, ...remainingColumns];
  
  allOrderedColumns.forEach((col, index) => {
    const width = persistedColumnWidths?.[col.id] || col.width || 120;
    columnWidths[col.id] = width;
    columnOffsets[col.id] = totalWidth;
    
    coordinateMapping.columns.push({
      columnId: col.id,
      index: enableSelectionColumn ? index + 1 : index,
      offset: totalWidth,
      width: width
    });
    
    totalWidth += width;
  });
  
  return {
    columnWidths,
    columnOffsets,
    totalWidth,
    rowHeight,
    totalRows: rowCount,
    totalHeight: rowCount * rowHeight,
    coordinateMapping,
    dimensionManager,
    rowDimensionManager
  };
};

// ====================================
// ACTIONS
// ====================================

export const dimensionActions = {
  // AUTHORITATIVE coordinate recalculation - called when column order changes
  recalculateCoordinateMapping: assign({
    coordinateMapping: ({ context }, event: { columns: Column[]; columnOrder: string[]; columnWidths: Record<string, number>; enableSelectionColumn: boolean }) => {
      const { columns, columnOrder, columnWidths, enableSelectionColumn } = event;
      
      const newCoordinateMapping = {
        rows: context.coordinateMapping.rows, // Preserve existing row mapping
        columns: [] as Array<{
          columnId: string;
          index: number;
          offset: number;
          width: number;
        }>,
        version: context.coordinateMapping.version + 1
      };
      
      let totalOffset = 0;
      
      // Add selection column first if enabled
      if (enableSelectionColumn) {
        const selectionWidth = 48;
        newCoordinateMapping.columns.push({
          columnId: '__selection',
          index: 0,
          offset: 0,
          width: selectionWidth
        });
        totalOffset = selectionWidth;
      }
      
      // Order columns according to columnOrder
      const orderedColumns = columnOrder
        .map(id => columns.find(col => col.id === id))
        .filter(Boolean) as Column[];
      
      // Add remaining columns not in the order
      const remainingColumns = columns.filter(col => !orderedColumns.some(oc => oc.id === col.id));
      const allOrderedColumns = [...orderedColumns, ...remainingColumns];
      
      allOrderedColumns.forEach((col, index) => {
        const width = columnWidths[col.id] || col.width || 120;
        newCoordinateMapping.columns.push({
          columnId: col.id,
          index: enableSelectionColumn ? index + 1 : index,
          offset: totalOffset,
          width: width
        });
        totalOffset += width;
      });
      
      console.log('DimensionsSlice: Recalculated coordinate mapping:', {
        version: newCoordinateMapping.version,
        columnCount: newCoordinateMapping.columns.length,
        columnOrder
      });
      
      return newCoordinateMapping;
    },
    columnOffsets: ({ context }, event: { columns: Column[]; columnOrder: string[]; columnWidths: Record<string, number>; enableSelectionColumn: boolean }) => {
      const { columns, columnOrder, columnWidths, enableSelectionColumn } = event;
      const newOffsets: Record<string, number> = {};
      let totalOffset = 0;
      
      // Add selection column first if enabled
      if (enableSelectionColumn) {
        const selectionWidth = 48;
        newOffsets['__selection'] = 0;
        totalOffset = selectionWidth;
      }
      
      // Order columns according to columnOrder
      const orderedColumns = columnOrder
        .map(id => columns.find(col => col.id === id))
        .filter(Boolean) as Column[];
      
      // Add remaining columns not in the order
      const remainingColumns = columns.filter(col => !orderedColumns.some(oc => oc.id === col.id));
      const allOrderedColumns = [...orderedColumns, ...remainingColumns];
      
      allOrderedColumns.forEach((col) => {
        const width = columnWidths[col.id] || col.width || 120;
        newOffsets[col.id] = totalOffset;
        totalOffset += width;
      });
      
      return newOffsets;
    },
    totalWidth: ({ context }, event: { columns: Column[]; columnOrder: string[]; columnWidths: Record<string, number>; enableSelectionColumn: boolean }) => {
      const { columns, columnWidths, enableSelectionColumn } = event;
      let totalWidth = enableSelectionColumn ? 48 : 0;
      
      columns.forEach(col => {
        totalWidth += columnWidths[col.id] || col.width || 120;
      });
      
      return totalWidth;
    }
  }),

  updateColumnWidth: assign({
    columnWidths: ({ context }, event: { columnId: string; width: number }) => ({
      ...context.columnWidths,
      [event.columnId]: event.width
    }),
    columnOffsets: ({ context }, event: { columnId: string; width: number }) => {
      // Recalculate offsets when width changes
      const newOffsets = { ...context.columnOffsets };
      const columns = Object.keys(context.columnWidths);
      let offset = 0;
      
      for (const colId of columns) {
        newOffsets[colId] = offset;
        offset += colId === event.columnId ? event.width : (context.columnWidths[colId] || 120);
      }
      
      return newOffsets;
    },
    totalWidth: ({ context }, event: { columnId: string; width: number }) => {
      const oldWidth = context.columnWidths[event.columnId] || 120;
      return context.totalWidth - oldWidth + event.width;
    },
    coordinateMapping: ({ context }, event: { columnId: string; width: number }) => {
      // Update coordinate mapping when column width changes
      const newCoordinateMapping = {
        ...context.coordinateMapping,
        columns: context.coordinateMapping.columns.map(col => {
          if (col.columnId === event.columnId) {
            return { ...col, width: event.width };
          }
          return col;
        }),
        version: context.coordinateMapping.version + 1
      };
      
      // Recalculate offsets for all columns after the resized one
      let totalOffset = 0;
      newCoordinateMapping.columns.forEach((col, index) => {
        newCoordinateMapping.columns[index] = {
          ...col,
          offset: totalOffset
        };
        totalOffset += col.width;
      });
      
      return newCoordinateMapping;
    },
    dimensionManager: ({ context }, event: { columnId: string; width: number }) => {
      // Update manager for backward compatibility
      if (context.dimensionManager) {
        context.dimensionManager.setColumnWidth(event.columnId, event.width);
      }
      return context.dimensionManager;
    }
  }),
  
  updateRowHeight: assign({
    rowHeight: (_, event: { height: number }) => event.height,
    totalHeight: ({ context }, event: { height: number }) => context.totalRows * event.height,
    rowDimensionManager: ({ context }, event: { height: number }) => {
      if (context.rowDimensionManager) {
        context.rowDimensionManager.setRowHeight(event.height);
      }
      return context.rowDimensionManager;
    }
  }),
  
  updateRowCount: assign({
    totalRows: (_, event: { count: number }) => event.count,
    totalHeight: ({ context }, event: { count: number }) => event.count * context.rowHeight,
    rowDimensionManager: ({ context }, event: { count: number }) => {
      if (context.rowDimensionManager) {
        context.rowDimensionManager.setTotalRows(event.count);
      }
      return context.rowDimensionManager;
    }
  }),
  
  resetColumnDimensions: assign({
    columnWidths: ({ context }, event: { columns: Column[] }) => {
      const newWidths: Record<string, number> = {};
      
      if (context.enableSelectionColumn) {
        newWidths['__selection'] = 48;
      }
      
      event.columns.forEach(col => {
        newWidths[col.id] = col.width || 120;
      });
      
      return newWidths;
    },
    columnOffsets: ({ context }, event: { columns: Column[] }) => {
      const newOffsets: Record<string, number> = {};
      let offset = 0;
      
      if (context.enableSelectionColumn) {
        newOffsets['__selection'] = 0;
        offset = 48;
      }
      
      event.columns.forEach(col => {
        newOffsets[col.id] = offset;
        offset += col.width || 120;
      });
      
      return newOffsets;
    },
    totalWidth: ({ context }, event: { columns: Column[] }) => {
      let width = context.enableSelectionColumn ? 48 : 0;
      event.columns.forEach(col => {
        width += col.width || 120;
      });
      return width;
    },
    dimensionManager: ({ context }, event: { columns: Column[] }) => {
      const manager = createColumnDimensionManager(event.columns);
      if (context.enableSelectionColumn) {
        manager.setSelectionColumnEnabled(true);
      }
      return manager;
    }
  })
};

// ====================================
// SELECTORS
// ====================================

export const dimensionSelectors = {
  getColumnWidth: (context: any, columnId: string): number => {
    return context.columnWidths[columnId] || 120;
  },
  
  getColumnOffset: (context: any, columnId: string): number => {
    return context.columnOffsets[columnId] || 0;
  },
  
  getTotalWidth: (context: any): number => {
    return context.totalWidth;
  },
  
  getRowHeight: (context: any): number => {
    return context.rowHeight;
  },
  
  getTotalHeight: (context: any): number => {
    return context.totalHeight;
  },
  
  getVisibleColumns: (context: any): string[] => {
    return Object.keys(context.columnWidths).filter(
      colId => context.columnVisibility[colId] !== false
    );
  },
  
  // AUTHORITATIVE coordinate mapping selectors
  getCoordinateMapping: (context: any) => {
    return context.coordinateMapping;
  },
  
  getColumnCoordinates: (context: any, columnId: string) => {
    return context.coordinateMapping.columns.find(
      (col: any) => col.columnId === columnId
    );
  },
  
  getRowCoordinates: (context: any, rowId: string) => {
    return context.coordinateMapping.rows.find(
      (row: any) => row.rowId === rowId
    );
  },
  
  getCoordinateVersion: (context: any): number => {
    return context.coordinateMapping.version;
  }
};