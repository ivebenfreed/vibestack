// ====================================
// VIEW SLICE
// ====================================
// Manages view state including sorting, filtering, grouping, and column visibility

import { assign } from 'xstate';
import type { SortConfig, FilterConfig, Column, ViewportInfo } from '../../../types';

// ====================================
// TYPES
// ====================================

export interface ViewState {
  // Sorting
  sortBy: SortConfig[];
  
  // Filtering
  filters: FilterConfig[];
  
  // Grouping
  groupBy: string[];
  
  // Column visibility
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  hiddenColumnCount: number;
  
  // Viewport
  viewport: ViewportInfo | null;
}

// ====================================
// HELPERS
// ====================================

// ====================================
// INITIAL STATE
// ====================================

export const createInitialViewState = (
  entityType: string,
  columns: Column[],
  initialViewport?: ViewportInfo,
  persistedData?: any
): ViewState => {
  const defaultVisibility = Object.fromEntries(columns.map(col => [col.id, true]));
  
  // Use persisted state if available, otherwise use defaults
  const sortBy = persistedData?.sortBy || [];
  const filters = persistedData?.filters || [];
  const groupBy = persistedData?.groupBy || [];
  const columnVisibility = persistedData?.columnVisibility || defaultVisibility;
  const columnOrder = persistedData?.columnOrder || columns.map(col => col.id);
  
  // Calculate hidden column count from column visibility
  const hiddenColumnCount = Object.values(columnVisibility).filter(visible => !visible).length;
  
  console.log('[ViewSlice] createInitialViewState:', {
    entityType,
    hasPersistedData: !!persistedData,
    persistedColumnOrder: persistedData?.columnOrder,
    defaultColumnOrder: columns.map(col => col.id),
    finalColumnOrder: columnOrder
  });
  
  return {
    sortBy,
    filters,
    groupBy,
    columnVisibility,
    columnOrder,
    hiddenColumnCount,
    viewport: initialViewport || null
  };
};

// ====================================
// ACTIONS
// ====================================

export const viewActions = {
  // Sorting actions
  setSortBy: assign({
    sortBy: ({ context, event }) => event.sortBy
  }),
  
  toggleSort: assign({
    sortBy: ({ context, event }) => {
      // Safely access event properties with defaults
      const field = (event as any).field;
      const shiftKey = (event as any).shiftKey || false;
      
      if (!field) {
        console.error('toggleSort: No field provided in event', event);
        return context.sortBy;
      }
      
      const existingSort = context.sortBy.find(s => s.field === field);
      let newSortBy: SortConfig[];
      
      if (existingSort) {
        // Toggle direction or remove
        if (existingSort.direction === 'asc') {
          newSortBy = shiftKey
            ? context.sortBy.map(s => s.field === field ? { ...s, direction: 'desc' } : s)
            : [{ field: field, direction: 'desc' }];
        } else {
          newSortBy = shiftKey
            ? context.sortBy.filter(s => s.field !== field)
            : [];
        }
      } else {
        // Add new sort
        newSortBy = shiftKey
          ? [...context.sortBy, { field: field, direction: 'asc' }]
          : [{ field: field, direction: 'asc' }];
      }
      
      console.log('toggleSort: Updating sort', { field, shiftKey, newSortBy });
      return newSortBy;
    }
  }),
  
  // Filter actions
  setFilters: assign({
    filters: ({ context, event }) => event.filters
  }),
  
  // Grouping actions
  setGroupBy: assign({
    groupBy: ({ context, event }) => event.groupBy
  }),
  
  // Column visibility actions
  toggleColumnVisibility: assign({
    columnVisibility: ({ context, event }) => {
      if (!event || !event.columnId) {
        console.warn('toggleColumnVisibility: Invalid event', event);
        return context.columnVisibility;
      }
      
      const currentValue = context.columnVisibility[event.columnId];
      const newValue = currentValue === false ? true : false;
      
      const newVisibility = {
        ...context.columnVisibility,
        [event.columnId]: newValue
      };
      
      return newVisibility;
    },
    hiddenColumnCount: ({ context, event }) => {
      if (!event || !event.columnId) {
        return context.hiddenColumnCount;
      }
      
      const willBeHidden = context.columnVisibility[event.columnId] !== false;
      return willBeHidden
        ? context.hiddenColumnCount + 1
        : context.hiddenColumnCount - 1;
    }
  }),
  
  setColumnVisibility: assign({
    columnVisibility: ({ context, event }) => event.visibility,
    hiddenColumnCount: ({ event }) => {
      return Object.values(event.visibility).filter(v => !v).length;
    }
  }),
  
  showAllColumns: assign({
    columnVisibility: ({ context }) => {
      const allVisible = Object.fromEntries(
        Object.keys(context.columnVisibility).map(id => [id, true])
      );
      return allVisible;
    },
    hiddenColumnCount: () => 0
  }),
  
  hideAllColumns: assign({
    columnVisibility: ({ context }) => {
      const allHidden = Object.fromEntries(
        Object.keys(context.columnVisibility).map(id => [id, false])
      );
      return allHidden;
    },
    hiddenColumnCount: ({ context }) => Object.keys(context.columnVisibility).length
  }),
  
  // Column order actions
  setColumnOrder: assign({
    columnOrder: ({ context, event }) => event.order
  }),
  
  reorderColumns: assign({
    columnOrder: ({ context, event }) => {
      const newOrder = [...context.columnOrder];
      const [removed] = newOrder.splice(event.fromIndex, 1);
      newOrder.splice(event.toIndex, 0, removed);
      return newOrder;
    }
  }),
  
  resetColumnOrder: assign({
    columnOrder: ({ context }) => {
      const defaultOrder = context.columns.map((col: Column) => col.id);
      return defaultOrder;
    }
  }),
  
  // Viewport actions
  updateViewport: assign({
    viewport: ({ event }) => event.viewport
  }),
  
  // Column drag actions
  startColumnDrag: assign({
    columnDragState: ({ event }: any) => ({
      columnId: event.columnId,
      startX: event.x,
      startY: event.y,
      mouseX: event.x,
      mouseY: event.y
    })
  }),
  
  updateColumnDrag: assign({
    columnDragState: ({ context, event }: any) => {
      if (!context.columnDragState) return null;
      return {
        ...context.columnDragState,
        mouseX: event.x,
        mouseY: event.y
      };
    }
  }),
  
  endColumnDrag: assign({
    columnDragState: null
  }),
  
  clearColumnDrag: assign({
    columnDragState: null
  }),
  
  // Column resize actions
  startColumnResize: assign({
    columnResizeState: ({ event }: any) => ({
      isResizing: true,
      resizingColumnId: event.columnId,
      columnId: event.columnId,
      startX: event.x,
      startWidth: event.width,
      currentWidth: event.width,
      previewWidth: event.width,
      minWidth: 50,
      maxWidth: 1000
    })
  }),
  
  updateColumnResize: assign({
    columnResizeState: ({ context, event }: any) => {
      if (!context.columnResizeState) return null;
      const deltaX = event.x - context.columnResizeState.startX;
      const newWidth = Math.max(
        context.columnResizeState.minWidth,
        Math.min(
          context.columnResizeState.maxWidth,
          context.columnResizeState.startWidth + deltaX
        )
      );
      return {
        ...context.columnResizeState,
        currentWidth: newWidth,
        previewWidth: newWidth
      };
    }
  }),
  
  endColumnResize: assign({
    columnResizeState: null
  }),
  
  clearColumnResize: assign({
    columnResizeState: null
  })
};

// ====================================
// SELECTORS
// ====================================

export const viewSelectors = {
  getSortBy: (context: any): SortConfig[] => {
    return context.sortBy;
  },
  
  getFilters: (context: any): FilterConfig[] => {
    return context.filters;
  },
  
  getGroupBy: (context: any): string[] => {
    return context.groupBy;
  },
  
  getColumnVisibility: (context: any): Record<string, boolean> => {
    return context.columnVisibility;
  },
  
  getColumnOrder: (context: any): string[] => {
    return context.columnOrder;
  },
  
  getHiddenColumnCount: (context: any): number => {
    return context.hiddenColumnCount;
  },
  
  isColumnVisible: (context: any, columnId: string): boolean => {
    return context.columnVisibility[columnId] !== false;
  },
  
  getVisibleColumns: (context: any): Column[] => {
    return context.columns.filter((col: Column) => 
      context.columnVisibility[col.id] !== false
    );
  },
  
  getOrderedVisibleColumns: (context: any): Column[] => {
    const visibleColumns = context.columns.filter((col: Column) => 
      context.columnVisibility[col.id] !== false
    );
    
    // Sort by column order
    return visibleColumns.sort((a: Column, b: Column) => {
      const aIndex = context.columnOrder.indexOf(a.id);
      const bIndex = context.columnOrder.indexOf(b.id);
      
      // If column not in order array, put it at the end
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  },
  
  getViewport: (context: any): ViewportInfo | null => {
    return context.viewport;
  }
};