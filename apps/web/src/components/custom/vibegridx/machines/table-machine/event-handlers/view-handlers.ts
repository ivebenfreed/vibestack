// ====================================
// VIEW EVENT HANDLERS
// ====================================

import { sendTo, assign, raise, emit } from 'xstate';
import { viewActions } from '../slices/view-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

export const viewHandlers = {
  'view.sort.set': {
    actions: [
      viewActions.setSortBy,
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.column.click': {
    actions: [
      viewActions.toggleSort,
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.filter.set': {
    actions: [
      viewActions.setFilters,
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.group.set': {
    actions: [
      viewActions.setGroupBy,
      
      // Persist the state
      'persistSnapshot',
      
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
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing to update visible columns
      raise({ type: 'INVOKE_VIEW_ACTOR' })
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
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing to update visible columns
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.columns.show.all': {
    actions: [
      viewActions.showAllColumns,
      
      () => {
        console.log('TableMachine: All columns shown');
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing to update visible columns
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.columns.hide.all': {
    actions: [
      viewActions.hideAllColumns,
      
      () => {
        console.log('TableMachine: All columns hidden');
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing to update visible columns
      raise({ type: 'INVOKE_VIEW_ACTOR' })
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
      },
      
      // Need to reprocess view data to update coordinate mappings
      ({ self }) => {
        self.send({ type: 'INVOKE_VIEW_ACTOR' });
      }
    ]
  },
  
  'view.columns.order.reset': {
    actions: [
      viewActions.resetColumnOrder,
      
      () => {
        console.log('TableMachine: Column order reset to default');
      },
      
      // Need to reprocess view data to update coordinate mappings
      ({ self }) => {
        self.send({ type: 'INVOKE_VIEW_ACTOR' });
      }
    ]
  },
  
  'view.viewport.update': {
    actions: [
      viewActions.updateViewport,
      
      // Update viewport in table state
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
      
      // Persistence will be handled by persistSnapshot action
      
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
      
      // Remove logging for performance - too many events
      // ({ event }) => {
      //   console.log('TableMachine: Column drag move', {
      //     position: { x: event.x, y: event.y }
      //   });
      // }
    ]
  },
  
  'view.columns.drag.end': {
    actions: [
      // Update column order in context
      assign({
        columnOrder: ({ context, event }) => {
          if (event.targetIndex !== undefined && context.columnDragState?.columnId) {
            const draggedColumnId = context.columnDragState.columnId;
            
            // Work with data columns only (exclude selection column)
            const dataColumnOrder = context.columnOrder.filter(id => id !== '__selection');
            
            // Find current index in data columns
            const currentIndex = dataColumnOrder.indexOf(draggedColumnId);
            
            if (currentIndex === -1) {
              console.error('Dragged column not found in columnOrder:', draggedColumnId);
              return context.columnOrder;
            }
            
            // Don't move if dropping in same position
            if (currentIndex === event.targetIndex || 
                (currentIndex === event.targetIndex - 1 && event.targetIndex > currentIndex)) {
              console.log('Column dropped in same position, no change needed');
              return context.columnOrder;
            }
            
            // Create new order array for data columns
            const newDataOrder = [...dataColumnOrder];
            
            // Remove from current position
            const [removed] = newDataOrder.splice(currentIndex, 1);
            
            // Adjust target index if needed (when dragging from left to right)
            let adjustedTargetIndex = event.targetIndex;
            if (currentIndex < event.targetIndex) {
              adjustedTargetIndex = event.targetIndex - 1;
            }
            
            // Insert at new position
            newDataOrder.splice(adjustedTargetIndex, 0, removed);
            
            // Reconstruct full column order with selection column first
            const newOrder = context.columnOrder.includes('__selection') 
              ? ['__selection', ...newDataOrder]
              : newDataOrder;
            
            
            // Persistence will be handled by persistSnapshot action
            
            return newOrder;
          }
          return context.columnOrder;
        },
        // Increment version to trigger re-render
        version: ({ context }) => context.version + 1
      }),
      
      // Clear drag state
      viewActions.clearColumnDrag,
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger view processing to apply new column order
      raise({ type: 'INVOKE_VIEW_ACTOR' }),
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.ended' }),
      
    ]
  },
  
  'view.columns.drag.cancel': {
    actions: [
      viewActions.clearColumnDrag,
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.cancelled' }),
      
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
      
      // Send column width update to renderer actor for real-time visual feedback
      sendTo(
        ({ context }) => context.actors.rendererActor!,
        ({ context }) => ({
          type: 'UPDATE_COLUMN_WIDTH',
          columnId: context.columnResizeState!.columnId,
          width: context.columnResizeState!.currentWidth
        })
      ),
      
      // Update coordinate mapping with new column width
      ({ context, self }) => {
        if (context.coordinateMapping && context.columnResizeState) {
          const { columnId, currentWidth } = context.columnResizeState;
          
          // Find and update the column in the coordinate mapping
          const columnIndex = context.coordinateMapping.columns.findIndex((c: any) => c.columnId === columnId);
          if (columnIndex !== -1) {
            const oldWidth = context.coordinateMapping.columns[columnIndex].width;
            const widthDiff = currentWidth - oldWidth;
            
            // Update the column width
            context.coordinateMapping.columns[columnIndex].width = currentWidth;
            
            // Update offsets for all columns after the resized one
            for (let i = columnIndex + 1; i < context.coordinateMapping.columns.length; i++) {
              context.coordinateMapping.columns[i].offset += widthDiff;
            }
            
            // If there's a selection, update the overlay
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
      
      // Persist the state
      'persistSnapshot',
      
      // Increment version to trigger re-render
      assign({
        version: ({ context }) => context.version + 1
      }),
      
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

