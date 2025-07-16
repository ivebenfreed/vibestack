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
  
  // Ensure selection column is always visible
  const baseVisibility = persistedData?.columnVisibility || defaultVisibility;
  const columnVisibility = {
    ...baseVisibility,
    '__selection': true // Always visible
  };
  
  // Filter persisted column order to only include valid column IDs
  const validColumnIds = new Set(columns.map(col => col.id));
  const persistedColumnOrder = persistedData?.columnOrder || [];
  const validPersistedOrder = persistedColumnOrder.filter((id: string) => validColumnIds.has(id));
  
  // Add any new columns that aren't in the persisted order
  const missingColumns = columns
    .map(col => col.id)
    .filter(id => !validPersistedOrder.includes(id));
    
  // Build column order with selection column always first
  const baseOrder = validPersistedOrder.length > 0 
    ? [...validPersistedOrder, ...missingColumns]
    : columns.map(col => col.id);
    
  // Ensure selection column is always first (remove if exists and prepend)
  const orderWithoutSelection = baseOrder.filter(id => id !== '__selection');
  const columnOrder = ['__selection', ...orderWithoutSelection];
  
  // Calculate hidden column count from column visibility
  const hiddenColumnCount = Object.values(columnVisibility).filter(visible => !visible).length;
  
  console.log('[ViewSlice] createInitialViewState:', {
    entityType,
    providedColumns: columns.map(c => c.id),
    persistedColumnOrder,
    validPersistedOrder,
    missingColumns,
    finalColumnOrder: columnOrder,
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
    columnDragState: ({ event, context }: any) => {
      // Find the column's current position in the coordinate mapping
      const draggedColumn = context.coordinateMapping?.columns.find(
        (col: any) => col.columnId === event.columnId
      );
      
      console.log('🎯 StartColumnDrag: Setting up drag state', {
        columnId: event.columnId,
        mouseX: event.x,
        draggedColumn: draggedColumn ? {
          id: draggedColumn.columnId,
          start: draggedColumn.offset,
          end: draggedColumn.offset + draggedColumn.width,
          width: draggedColumn.width
        } : null,
        allColumns: context.coordinateMapping?.columns.map((col: any) => ({
          id: col.columnId,
          start: col.offset,
          end: col.offset + col.width
        }))
      });
      
      return {
        columnId: event.columnId,
        startX: event.x,
        startY: event.y,
        mouseX: event.x,
        mouseY: event.y,
        // Store the column's original bounds to check if mouse has left
        originalBounds: draggedColumn ? {
          start: draggedColumn.offset,
          end: draggedColumn.offset + draggedColumn.width
        } : null,
        // Store the coordinate mapping version to detect stale bounds
        coordinateMappingVersion: context.coordinateMapping?.version || 0,
        // Initialize with no preview
        currentTargetIndex: null,
        previewActive: false
      };
    }
  }),
  
  updateColumnDrag: assign({
    columnDragState: ({ context, event }: any) => {
      if (!context.columnDragState) return null;
      
      const state = context.columnDragState;
      
      // Check if mouse has left the original column bounds
      if (state.originalBounds && !state.previewActive) {
        // Verify that our coordinate mapping is still valid
        const currentCoordinateVersion = context.coordinateMapping?.version || 0;
        const stateCoordinateVersion = state.coordinateMappingVersion || 0;
        
        if (currentCoordinateVersion !== stateCoordinateVersion) {
          console.log('🎯 UpdateColumnDrag: Coordinate mapping changed, recalculating bounds', {
            currentVersion: currentCoordinateVersion,
            stateVersion: stateCoordinateVersion
          });
          
          // Recalculate original bounds with current coordinate mapping
          const draggedColumn = context.coordinateMapping?.columns.find(
            (col: any) => col.columnId === state.columnId
          );
          
          if (draggedColumn) {
            const newOriginalBounds = {
              start: draggedColumn.offset,
              end: draggedColumn.offset + draggedColumn.width
            };
            
            // Update the state with new bounds and version
            const updatedState = {
              ...state,
              originalBounds: newOriginalBounds,
              coordinateMappingVersion: currentCoordinateVersion,
              mouseX: event.x,
              mouseY: event.y
            };
            
            // Check bounds with the updated bounds
            const isOutsideBounds = event.x < newOriginalBounds.start || event.x > newOriginalBounds.end;
            
            console.log('🎯 UpdateColumnDrag: Checking updated bounds', {
              mouseX: event.x,
              newOriginalBounds,
              isOutsideBounds
            });
            
            if (isOutsideBounds) {
              console.log('🎯 UpdateColumnDrag: Activating preview - mouse left updated column');
              return {
                ...updatedState,
                previewActive: true
              };
            }
            
            return updatedState;
          }
        }
        
        // Use existing bounds logic
        const isOutsideBounds = event.x < state.originalBounds.start || event.x > state.originalBounds.end;
        
        console.log('🎯 UpdateColumnDrag: Checking bounds', {
          mouseX: event.x,
          originalBounds: state.originalBounds,
          isOutsideBounds,
          previewActive: state.previewActive
        });
        
        if (isOutsideBounds) {
          // Mouse has left the original column - activate preview
          console.log('🎯 UpdateColumnDrag: Activating preview - mouse left column');
          return {
            ...state,
            mouseX: event.x,
            mouseY: event.y,
            previewActive: true
          };
        }
      }
      
      // Just update mouse position
      return {
        ...state,
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