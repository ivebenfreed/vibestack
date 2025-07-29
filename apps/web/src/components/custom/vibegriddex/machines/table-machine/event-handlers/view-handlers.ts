// ====================================
// VIEW EVENT HANDLERS
// ====================================

import { sendTo, assign, raise, emit } from 'xstate';
import { selectionActions } from '../slices/selection-slice';
import { dimensionActions } from '../slices/dimensions-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';
import { applyDragPreview, clearDragPreview } from '../helpers/drag-preview-helpers';
import type { SortConfig } from '../../../types';

export const viewHandlers = {
  'view.sort.set': {
    actions: [
      // Just forward to store - no local state update
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({ type: 'setSortBy', sortBy: event.sortBy });
        }
      },
      
      // Clear selection when sorting changes
      selectionActions.clearSelection,
      
      // Clear canvas selection visual
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
          
          // Also hide fill handle
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'HIDE_FILL_HANDLE'
            }
          });
        }
      }
    ]
  },
  
  'view.column.click': {
    actions: [
      // Calculate new sort state and send it as a new event
      ({ context, event, self }) => {
        const field = (event as any).field;
        const shiftKey = (event as any).shiftKey || false;
        
        if (!field) {
          console.error('view.column.click: No field provided in event', event);
          return;
        }
        
        // Always get the current sortBy from the store actor for accurate state
        const storeSnapshot = context.storeActor?.getSnapshot();
        const currentSortBy = storeSnapshot?.context?.sortBy || [];
        
        console.log('view.column.click: Current sortBy state', { 
          currentSortBy,
          currentSortByFields: currentSortBy.map(s => ({ field: s.field, dir: s.direction })),
          field,
          shiftKey,
          fromStore: !!storeSnapshot,
          contextSortBy: context.sortBy
        });
        
        const existingSort = currentSortBy.find(s => s.field === field);
        console.log('view.column.click: Field matching', {
          searchingFor: field,
          existingSort,
          allSortFields: currentSortBy.map(s => s.field)
        });
        let newSortBy: SortConfig[];
        
        if (existingSort) {
          // Toggle direction or remove
          if (existingSort.direction === 'asc') {
            newSortBy = shiftKey
              ? currentSortBy.map(s => s.field === field ? { ...s, direction: 'desc' } : s)
              : [{ field: field, direction: 'desc' }];
          } else {
            // desc -> remove (no sort)
            newSortBy = shiftKey
              ? currentSortBy.filter(s => s.field !== field)
              : [];
          }
        } else {
          // No existing sort - add new sort as 'asc'
          newSortBy = shiftKey
            ? [...currentSortBy, { field: field, direction: 'asc' }]
            : [{ field: field, direction: 'asc' }];
        }
        
        console.log('view.column.click: Calculated new sortBy', { 
          existingSort,
          newSortBy,
          transition: existingSort 
            ? `${existingSort.direction} -> ${newSortBy.find(s => s.field === field)?.direction || 'none'}`
            : 'none -> asc'
        });
        
        // Send new event with calculated sort state
        self.send({
          type: 'view.sort.set',
          sortBy: newSortBy
        });
      }
    ]
  },
  
  'view.filter.set': {
    actions: [
      // Just forward to store
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({ type: 'setFilters', filters: event.filters });
        }
      }
    ]
  },
  
  'view.group.set': {
    actions: [
      // Just forward to store
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'setGroupBy',
            groupBy: event.groupBy
          });
        }
      }
    ]
  },
  
  'view.columns.toggle': {
    actions: [
      // Just forward to store
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'toggleColumnVisibility',
            columnId: event.columnId
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.visibility.set': {
    actions: [
      // Just forward to store - no local state update
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'setColumnVisibility',
            columnVisibility: event.visibility
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.show.all': {
    actions: [
      // Just forward to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'showAllColumns'
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.hide.all': {
    actions: [
      // Just forward to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'hideAllColumns'
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.order.set': {
    actions: [
      // Just forward to store
      ({ context, event }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'setColumnOrder',
            columnOrder: event.order
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.reorder': {
    actions: [
      // Send column reorder event to store first
      ({ context, event }) => {
        console.log('🔄 view.columns.reorder: Sending to store', {
          fromIndex: event.fromIndex,
          toIndex: event.toIndex
        });
        
        if (context.storeActor) {
          context.storeActor.send({
            type: 'reorderColumns',
            fromIndex: event.fromIndex,
            toIndex: event.toIndex
          });
        }
      },
      
      // Clear drag state and restore column visibility
      ({ context }) => {
        console.log('🔄 view.columns.reorder: Clearing drag state');
        if ((window as any).__vibegridx_renderer_instance) {
          const renderer = (window as any).__vibegridx_renderer_instance;
          const header = renderer.header;
          if (header) {
            // Clear ALL drag-related styles and classes
            header.querySelectorAll('.vibegridx-header-cell').forEach((el: HTMLElement) => {
              el.style.opacity = '';
              el.style.pointerEvents = '';
              el.style.visibility = '';
              el.style.transform = '';
              el.style.transition = '';
              el.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
            });
          }
        }
      },
      
      // Clear selection when columns are reordered
      selectionActions.clearSelection,
      
      // Clear canvas selection visual
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
          
          // Also hide fill handle
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'HIDE_FILL_HANDLE'
            }
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.columns.order.reset': {
    actions: [
      // Forward to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'resetColumnOrder'
          });
        }
      },
      
      // Clear selection when column order is reset
      selectionActions.clearSelection,
      
      // Clear canvas selection visual
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: []
            }
          });
          
          // Also hide fill handle
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'HIDE_FILL_HANDLE'
            }
          });
        }
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
    ]
  },
  
  'view.viewport.update': {
    actions: [
      // Update viewport in table state (still needed for coordinate calculations)
      assign({
        viewport: ({ event }) => event.viewport
      }),
      
      // Send viewport update to canvas actor
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
      // Update coordinate mapping with new width
      dimensionActions.updateColumnWidth,
      
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
      
      // Send message to renderer to hide column and create initial drag preview
      ({ context, event }) => {
        if (context.actors?.rendererActor) {
          // Create initial drag preview with floating element
          const column = context.columns.find(col => col.id === event.columnId);
          const dragPreview = {
            draggedColumnId: event.columnId,
            targetIndex: -1,
            columnsToShift: [],
            dropIndicatorX: 0,
            mouseX: event.clientX || event.x,
            mouseY: event.clientY || event.y,
            columnName: column?.name || event.columnId,
            // Add flag to indicate this is the initial preview
            isInitialPreview: true
          };
          
          console.log('🎯 ViewHandler: Sending initial drag preview to renderer', {
            columnId: event.columnId,
            columnName: dragPreview.columnName,
            mouseX: event.x,
            mouseY: event.y
          });
          
          context.actors.rendererActor.send({
            type: 'APPLY_DRAG_PREVIEW',
            dragPreview
          });
        }
      },
      
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
      
    ]
  },
  
  'view.columns.drag.move': {
    actions: [
      
      // Just pass the mouse position to renderer - let it handle all calculations
      ({ context, event }) => {
        if (!context.actors?.rendererActor) {
          return;
        }
        
        const draggedColumnId = (context as any)._draggedColumnId || event.columnId;
        const column = context.columns.find(col => col.id === draggedColumnId);
        
        // Send simple drag update to renderer - let it calculate everything
        context.actors.rendererActor.send({
          type: 'UPDATE_DRAG_POSITION',
          draggedColumnId: draggedColumnId,
          columnName: column?.name || draggedColumnId,
          mouseX: event.clientX || event.x,
          mouseY: event.clientY || event.y
        });
      },
      
      // Emit event for UI feedback
      emit(({ context }) => ({
        type: 'view.drag.updated',
        columnDragState: context.columnDragState
      }))
    ]
  },
  
  'view.columns.drag.end': {
    actions: [
      // Use the renderer's stored target index from the drag
      ({ context, event, self }) => {
        console.log('🎯 ViewHandler: Column drag end - using renderer target', {
          columnId: event.columnId,
          clientX: event.clientX,
          clientY: event.clientY
        });
        
        // Get current state from store for accurate calculation
        const storeSnapshot = context.storeActor?.getSnapshot();
        const storeColumns = storeSnapshot?.context?.columns || [];
        const currentColumnVisibility = storeSnapshot?.context?.columnVisibility || {};
        
        // Get visible columns only
        const visibleColumns = storeColumns.filter(col => 
          col.id !== '__selection' && currentColumnVisibility[col.id] !== false
        );
        const currentIndex = visibleColumns.findIndex(col => col.id === event.columnId);
        
        // Get the target index from the renderer which tracked it during drag
        let targetIndex = currentIndex; // Default to no change
        
        if ((window as any).__vibegridx_renderer_instance) {
          const renderer = (window as any).__vibegridx_renderer_instance;
          // Get the last calculated target from the drag
          targetIndex = renderer._lastCalculatedTargetIndex >= 0 ? 
            renderer._lastCalculatedTargetIndex : currentIndex;
          console.log('🎯 ViewHandler: Using renderer target index', {
            targetIndex,
            currentIndex,
            lastCalculatedTarget: renderer._lastCalculatedTargetIndex
          });
        }
        
        // Only send reorder if position actually changed
        if (currentIndex !== -1 && currentIndex !== targetIndex) {
          self.send({
            type: 'view.columns.reorder',
            fromIndex: currentIndex,
            toIndex: targetIndex
          });
        }
      },
      
      // Clear drag preview
      ({ context }) => {
        if (context.actors?.rendererActor) {
          context.actors.rendererActor.send({
            type: 'CLEAR_DRAG_PREVIEW'
          });
        }
      },
      
      // Clear drag state is now handled by clearing temporary vars
      
      // Clear temporary tracking state and restore cursor
      ({ context }) => {
        delete (context as any)._lastDragTargetIndex;
        delete (context as any)._lastDragMouseX;
        delete (context as any)._lastDragMouseY;
        
        // Restore cursor
        document.body.style.cursor = '';
        document.body.classList.remove('vibegridx-dragging-active');
      },
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.ended' })
    ]
  },
  
  'view.columns.drag.cancel': {
    actions: [
      // Clear drag preview and restore column visibility
      ({ context }) => {
        if (context.actors?.rendererActor) {
          context.actors.rendererActor.send({
            type: 'CLEAR_DRAG_PREVIEW'
          });
          
          // Restore column visibility and cursor
          const domManager = (context.actors.rendererActor.getSnapshot().context as any)?.renderer?.domManager;
          if (domManager) {
            const header = domManager.getElement('header');
            console.log('🎯 ViewHandler: Restoring column visibility');
            header.querySelectorAll('.vibegridx-header-cell').forEach((el: HTMLElement) => {
              console.log('🎯 ViewHandler: Restoring column', {
                column: el.dataset.column,
                before: {
                  opacity: el.style.opacity,
                  pointerEvents: el.style.pointerEvents,
                  visibility: el.style.visibility
                }
              });
              el.style.opacity = '';
              el.style.pointerEvents = '';
              el.style.visibility = '';
            });
          }
          
          // Restore cursor
          document.body.style.cursor = '';
          document.body.classList.remove('vibegridx-dragging-active');
        }
      },
      
      // Clear stored drag tracking state
      ({ context }) => {
        delete (context as any)._lastDragTargetIndex;
        delete (context as any)._calculatedTargetIndex;
        delete (context as any)._lastDragMouseX;
        delete (context as any)._lastDragMouseY;
      },
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.cancelled' })
    ]
  },
  
  // DIMENSIONS RECALCULATION - SINGLE SOURCE OF TRUTH
  'dimensions.recalculate': {
    actions: [
      // Use the actual dimension action directly
      dimensionActions.recalculateCoordinateMapping,
      
      // Forward updated coordinates to canvas for overlay sync
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
          console.log('ViewHandlers: Forwarding updated coordinates to canvas');
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping
            }
          });
        }
      },
      
      // Forward updated coordinates to renderer for passive consumption
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          console.log('ViewHandlers: Forwarding updated coordinates to renderer');
          self.send({
            type: 'FORWARD_TO_RENDERER', 
            event: {
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping,
              version: context.coordinateMapping.version
            }
          });
        }
      },
      
      ({ context }) => {
        console.log('ViewHandlers: Coordinate mapping recalculated:', {
          version: context.coordinateMapping.version,
          columnCount: context.coordinateMapping.columns.length
        });
      }
    ]
  },
  
  // Column resize events
  'view.columns.resize.start': {
    actions: [
      
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
      
      // Update coordinate mapping with new column width (immutably)
      assign({
        coordinateMapping: ({ context }) => {
          if (!context.coordinateMapping || !context.columnResizeState) {
            return context.coordinateMapping;
          }
          
          const { columnId, currentWidth } = context.columnResizeState;
          
          // Update column width in coordinate mapping
          const newColumns = context.coordinateMapping.columns.map(col => {
            if (col.columnId === columnId) {
              return { ...col, width: currentWidth };
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
      
      // Send updated coordinates to renderer for real-time column width updates
      ({ context, self }) => {
        if (context.actors?.rendererActor && context.coordinateMapping) {
          self.send({
            type: 'FORWARD_TO_RENDERER',
            event: {
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping,
              version: context.coordinateMapping.version
            }
          });
        }
      },
      
      // Update selection overlay if needed
      ({ context, self }) => {
        if (context.selectedCells && context.selectedCells.size > 0 && context.actors.canvasActor) {
          const visualPositions = calculateVisualPositions(
            context.selectedCells,
            context.coordinateMapping,
            context.viewport,
            context.rowHeight || context.settings?.rowHeight || 40
          );
          
          if (visualPositions.length > 0) {
            self.send({
              type: 'FORWARD_TO_CANVAS',
              event: {
                type: 'UPDATE_SELECTION_VISUAL',
                visualCells: visualPositions
              }
            });
            
            // Also update fill handle position
            self.send({
              type: 'FORWARD_TO_CANVAS',
              event: {
                type: 'RENDER_FILL_HANDLE',
                visualCells: visualPositions
              }
            });
          }
        }
      },
      
      // Emit event for UI feedback  
      emit(({ context }) => ({
        type: 'view.resize.updated',
        columnResizeState: context.columnResizeState
      })),
      
      // Column resize move handled
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
      
      // Update coordinate mapping with final width
      assign({
        coordinateMapping: ({ context }) => {
          if (!context.columnResizeState) return context.coordinateMapping;
          
          const { columnId, currentWidth } = context.columnResizeState;
          
          // Update column width in coordinate mapping
          const newColumns = context.coordinateMapping.columns.map(col => {
            if (col.columnId === columnId) {
              return { ...col, width: currentWidth };
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
        },
        // Also update columnWidths in context
        columnWidths: ({ context }) => {
          if (!context.columnResizeState) return context.columnWidths || {};
          
          const { columnId, currentWidth } = context.columnResizeState;
          return {
            ...context.columnWidths,
            [columnId]: currentWidth
          };
        }
      }),
      
      // Persist the state
      'persistSnapshot',
      
      // Send column width update to store
      ({ context }) => {
        if (context.storeActor && context.columnResizeState) {
          const { columnId, currentWidth } = context.columnResizeState;
          context.storeActor.send({
            type: 'setColumnWidth',
            columnId,
            width: currentWidth
          });
        }
      },
      
      // Increment version to trigger re-render
      assign({
        version: ({ context }) => context.version + 1
      }),
      
      // Send the updated coordinates directly to renderer
      ({ context, self }) => {
        if (context.actors.rendererActor && context.coordinateMapping) {
          context.actors.rendererActor.send({
            type: 'UPDATE_COORDINATES',
            mapping: context.coordinateMapping,
            version: context.coordinateMapping.version
          });
        }
      },
      
      // Clear the resize state is handled by the store
      
      // Emit event for UI feedback
      emit({ type: 'view.resize.ended' })
    ]
  },
  
  'view.columns.resize.cancel': {
    actions: [
      
      // Emit event for UI feedback
      emit({ type: 'view.resize.cancelled' }),
      
      () => {
        console.log('TableMachine: Column resize cancelled');
      }
    ]
  },
  
  // ====================================
  // CATCHALL: COLUMN LAYOUT CHANGED
  // ====================================
  
  'COLUMN_LAYOUT_CHANGED': {
    actions: [
      // Recalculate coordinate mapping AFTER the context has been updated with new columns
      ({ context, event }) => {
        const isReorderOnly = (event as any).isReorderOnly;
        console.log('🔄 COLUMN_LAYOUT_CHANGED: Deferring coordinate recalculation', {
          isReorderOnly
        });
        // The coordinate recalculation will happen after STORE_SNAPSHOT_RECEIVED updates context.columns
      },
      
      // Forward updated coordinates to canvas for overlay sync
      ({ context, self, event }) => {
        if (context.actors?.canvasActor) {
          const isReorderOnly = (event as any).isReorderOnly;
          
          // Skip canvas update for column-only reorder to avoid forced reflow
          if (isReorderOnly) {
            console.log('🔄 COLUMN_LAYOUT_CHANGED: Skipping canvas update for column reorder (optimization)');
            return;
          }
          
          console.log('🔄 COLUMN_LAYOUT_CHANGED: Forwarding updated coordinates to canvas');
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping
            }
          });
        }
      }
    ]
  }
};

