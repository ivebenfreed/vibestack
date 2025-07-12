// ====================================
// VIEW EVENT HANDLERS
// ====================================

import { sendTo, assign, raise, emit } from 'xstate';
import { viewActions } from '../slices/view-slice';

export const viewHandlers = {
  'view.sort.set': {
    actions: [
      viewActions.setSortBy,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.column.click': {
    actions: [
      viewActions.toggleSort,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.filter.set': {
    actions: [
      viewActions.setFilters,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.group.set': {
    actions: [
      viewActions.setGroupBy,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.columns.toggle': {
    actions: [
      viewActions.toggleColumnVisibility,
      
      ({ context, event }) => {
        console.log('TableMachine: Column visibility toggled', {
          columnId: event.columnId,
          isVisible: context.columnVisibility[event.columnId] !== false,
          hiddenCount: context.hiddenColumnCount
        });
      }
    ]
  },
  
  'view.columns.visibility.set': {
    actions: [
      viewActions.setColumnVisibility,
      
      ({ context }) => {
        console.log('TableMachine: Column visibility updated', {
          hiddenCount: context.hiddenColumnCount,
          totalColumns: Object.keys(context.columnVisibility).length
        });
      }
    ]
  },
  
  'view.columns.show.all': {
    actions: [
      viewActions.showAllColumns,
      
      () => {
        console.log('TableMachine: All columns shown');
      }
    ]
  },
  
  'view.columns.hide.all': {
    actions: [
      viewActions.hideAllColumns,
      
      () => {
        console.log('TableMachine: All columns hidden');
      }
    ]
  },
  
  'view.columns.order.set': {
    actions: [
      viewActions.setColumnOrder,
      
      ({ event }) => {
        console.log('TableMachine: Column order updated', {
          newOrder: event.order
        });
      }
    ]
  },
  
  'view.columns.reorder': {
    actions: [
      viewActions.reorderColumns,
      
      ({ event }) => {
        console.log('TableMachine: Columns reordered', {
          from: event.fromIndex,
          to: event.toIndex
        });
      }
    ]
  },
  
  'view.columns.order.reset': {
    actions: [
      viewActions.resetColumnOrder,
      
      () => {
        console.log('TableMachine: Column order reset to default');
      }
    ]
  },
  
  'view.viewport.update': {
    actions: [
      viewActions.updateViewport,
      
      // Send to overlay actor for canvas updates
      sendTo(
        ({ context }) => context.actors.overlayActor!,
        ({ event }) => ({
          type: 'VIEWPORT_UPDATE',
          viewport: event.viewport
        })
      ),
      
      // Send to canvas actor
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ event }) => ({
          type: 'UPDATE_VIEWPORT',
          viewport: event.viewport
        })
      ),
      
      // Update selection positions with scroll offset to keep them pinned to cells
      ({ context, self }) => {
        console.log('ViewHandler: Viewport update - updating selection positions with scroll offset', {
          selectedCellsSize: context.selectedCells?.size || 0,
          viewportStart: context.viewport?.start,
          viewportScrollTop: context.viewport?.scrollTop
        });
        
        if (context.selectedCells && context.selectedCells.size > 0) {
          console.log('ViewHandler: Recalculating selection positions with scroll offset');
          const visualPositions = calculateVisualPositions(
            context.selectedCells,
            context.coordinateMapping,
            context.viewport,
            context.rowHeight || context.settings?.rowHeight || 40
          );
          
          if (context.actors.canvasActor && visualPositions.length > 0) {
            console.log('ViewHandler: Sending scroll-adjusted visual positions to canvas actor');
            self.send({
              type: 'FORWARD_TO_CANVAS',
              event: {
                type: 'UPDATE_SELECTION_VISUAL',
                visualCells: visualPositions
              }
            });
          }
        }
      }
    ]
  },
  
  // Column resize event from view coordinator
  'view.column.resized': {
    actions: [
      // Update dimension state
      ({ context, event }) => {
        if (context.dimensionManager) {
          context.dimensionManager.setColumnWidth(event.columnId, event.width);
        }
      },
      
      // Update column widths in context
      assign({
        columnWidths: ({ context, event }) => ({
          ...context.columnWidths,
          [event.columnId]: event.width
        })
      }),
      
      // Persist to localStorage
      ({ context, event }) => {
        const columnWidths = loadFromStorage(context.entityType, 'columnWidths', {});
        columnWidths[event.columnId] = event.width;
        saveToStorage(context.entityType, 'columnWidths', columnWidths);
      },
      
      ({ event }) => {
        console.log('TableMachine: Column resized', {
          columnId: event.columnId,
          newWidth: event.width
        });
      }
    ]
  },
  
  // Column drag events
  'view.columns.drag.start': {
    actions: [
      viewActions.startColumnDrag,
      
      // Emit event for UI feedback
      emit(({ event }) => ({
        type: 'view.drag.started',
        columnDragState: {
          columnId: event.columnId,
          startX: event.x,
          startY: event.y,
          mouseX: event.x,
          mouseY: event.y
        }
      })),
      
      ({ event }) => {
        console.log('TableMachine: Column drag started', {
          columnId: event.columnId,
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },
  
  'view.columns.drag.move': {
    actions: [
      viewActions.updateColumnDrag,
      
      // Emit event for UI feedback
      emit(({ context }) => ({
        type: 'view.drag.updated',
        columnDragState: context.columnDragState
      })),
      
      ({ event }) => {
        console.log('TableMachine: Column drag move', {
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },
  
  'view.columns.drag.end': {
    actions: [
      viewActions.endColumnDrag,
      
      // Reorder columns if valid drop
      ({ context, event }) => {
        if (event.targetIndex !== undefined && context.columnDragState?.columnId) {
          const columns = context.columns;
          const draggedColumn = columns.find(c => c.id === context.columnDragState.columnId);
          const currentIndex = columns.indexOf(draggedColumn!);
          
          if (currentIndex !== -1 && currentIndex !== event.targetIndex) {
            // Update column order
            const newOrder = [...context.columnOrder];
            const [removed] = newOrder.splice(currentIndex, 1);
            newOrder.splice(event.targetIndex, 0, removed);
            
            // Save to storage
            saveToStorage(context.entityType, 'columnOrder', newOrder);
          }
        }
      },
      
      // Update column order in context
      assign({
        columnOrder: ({ context, event }) => {
          if (event.targetIndex !== undefined && context.columnDragState?.columnId) {
            const columns = context.columns;
            const draggedColumn = columns.find(c => c.id === context.columnDragState.columnId);
            const currentIndex = columns.indexOf(draggedColumn!);
            
            if (currentIndex !== -1 && currentIndex !== event.targetIndex) {
              const newOrder = [...context.columnOrder];
              const [removed] = newOrder.splice(currentIndex, 1);
              newOrder.splice(event.targetIndex, 0, removed);
              return newOrder;
            }
          }
          return context.columnOrder;
        }
      }),
      
      // Clear drag state
      viewActions.clearColumnDrag,
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.ended' }),
      
      ({ event }) => {
        console.log('TableMachine: Column drag ended', {
          targetIndex: event.targetIndex
        });
      }
    ]
  },
  
  'view.columns.drag.cancel': {
    actions: [
      viewActions.clearColumnDrag,
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.cancelled' }),
      
      () => {
        console.log('TableMachine: Column drag cancelled');
      }
    ]
  },
  
  // Column resize events
  'view.columns.resize.start': {
    actions: [
      viewActions.startColumnResize,
      
      // Emit event for UI feedback
      emit(({ context, event }) => ({
        type: 'view.resize.started',
        columnResizeState: context.columnResizeState || {
          isResizing: true,
          resizingColumnId: event.columnId,
          columnId: event.columnId,
          startX: event.x,
          startWidth: event.width,
          currentWidth: event.width,
          previewWidth: event.width,
          minWidth: 50,
          maxWidth: 1000
        }
      })),
      
      ({ event }) => {
        console.log('TableMachine: Column resize started', {
          columnId: event.columnId,
          startX: event.x,
          startWidth: event.width
        });
      }
    ]
  },
  
  'view.columns.resize.move': {
    actions: [
      viewActions.updateColumnResize,
      
      // Update column widths in context directly
      assign({
        columnWidths: ({ context }) => {
          if (!context.columnResizeState) return context.columnWidths;
          const { columnId, currentWidth } = context.columnResizeState;
          return {
            ...context.columnWidths,
            [columnId]: currentWidth
          };
        }
      }),
      
      // Send column width update to renderer
      sendTo(
        ({ context }) => context.actors.rendererActor!,
        ({ context }) => ({
          type: 'UPDATE_COLUMN_WIDTH',
          columnId: context.columnResizeState?.columnId,
          width: context.columnResizeState?.currentWidth
        })
      ),
      
      // Emit event for UI feedback  
      emit(({ context }) => ({
        type: 'view.resize.updated',
        columnResizeState: context.columnResizeState
      })),
      
      ({ event }) => {
        console.log('TableMachine: Column resize move', {
          x: event.x
        });
      }
    ]
  },
  
  'view.columns.resize.end': {
    actions: [
      // Log the final state before any modifications
      ({ context }) => {
        console.log('TableMachine: Column resize ended', {
          columnId: context.columnResizeState?.columnId,
          finalWidth: context.columnResizeState?.currentWidth
        });
      },
      
      
      // Update column widths in context
      assign({
        columnWidths: ({ context }) => {
          if (context.columnResizeState) {
            const { columnId, currentWidth } = context.columnResizeState;
            return {
              ...context.columnWidths,
              [columnId]: currentWidth
            };
          }
          return context.columnWidths;
        }
      }),
      
      // Persist to localStorage
      ({ context }) => {
        if (context.columnResizeState) {
          const { columnId, currentWidth } = context.columnResizeState;
          const columnWidths = loadFromStorage(context.entityType, 'columnWidths', {});
          columnWidths[columnId] = currentWidth;
          saveToStorage(context.entityType, 'columnWidths', columnWidths);
        }
      },
      
      // Trigger a full re-render to ensure all cells are properly sized
      sendTo(
        ({ context }) => context.actors.rendererActor!,
        ({ context }) => ({
          type: 'RENDER',
          state: {
            rows: context.rows,
            columns: context.columns,
            selectedCells: context.selectedCells,
            editingCell: null,
            groupedData: [],
            optimisticOperations: new Map(),
            version: context.version + 1,
            sortBy: context.sortBy,
            columnVisibility: context.columnVisibility,
            columnOrder: context.columnOrder,
            columnWidths: context.columnWidths
          }
        })
      ),
      
      // Clear the resize state (do this last)
      viewActions.endColumnResize,
      
      // Emit event for UI feedback
      emit({ type: 'view.resize.ended' })
    ]
  },
  
  'view.columns.resize.cancel': {
    actions: [
      viewActions.clearColumnResize,
      
      // Emit event for UI feedback
      emit({ type: 'view.resize.cancelled' }),
      
      () => {
        console.log('TableMachine: Column resize cancelled');
      }
    ]
  }
};

// Import helpers
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

// Storage helpers (should be in a separate file but including here for completeness)
const getStorageKey = (entityType: string, key: string) => `vibegridx-${entityType}-${key}`;

const loadFromStorage = <T>(entityType: string, key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const stored = localStorage.getItem(getStorageKey(entityType, key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveToStorage = (entityType: string, key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(getStorageKey(entityType, key), JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};