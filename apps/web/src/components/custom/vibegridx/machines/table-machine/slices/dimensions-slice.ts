// ====================================
// DIMENSIONS SLICE
// ====================================
// Manages column and row dimensions state in the table machine context

import { assign } from 'xstate';
import type { Column } from '../../../types';
import { createColumnDimensionManager } from '../../../dimensions/ColumnDimensionManager';
import { createRowDimensionManager } from '../../../dimensions/RowDimensionManager';

// ====================================
// TYPES
// ====================================

export interface DimensionsState {
  // Column dimensions
  columnWidths: Record<string, number>;
  columnOffsets: Record<string, number>;
  totalWidth: number;
  
  // Row dimensions
  rowHeight: number;
  totalRows: number;
  totalHeight: number;
  
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
  enableSelectionColumn: boolean = false
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
  
  if (enableSelectionColumn) {
    columnWidths['__selection'] = 48;
    columnOffsets['__selection'] = 0;
    totalWidth = 48;
  }
  
  columns.forEach((col, index) => {
    const width = col.width || 120;
    columnWidths[col.id] = width;
    columnOffsets[col.id] = totalWidth;
    totalWidth += width;
  });
  
  return {
    columnWidths,
    columnOffsets,
    totalWidth,
    rowHeight,
    totalRows: rowCount,
    totalHeight: rowCount * rowHeight,
    dimensionManager,
    rowDimensionManager
  };
};

// ====================================
// ACTIONS
// ====================================

export const dimensionActions = {
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
  }
};