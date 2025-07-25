// ====================================
// VIEW EVENT HANDLERS
// ====================================

import { sendTo, assign, raise, emit } from 'xstate';
import { viewActions } from '../slices/view-slice';
import { selectionActions } from '../slices/selection-slice';
import { dimensionActions } from '../slices/dimensions-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';
import { calculateDragPreview, applyDragPreview, clearDragPreview } from '../helpers/drag-preview-helpers';

export const viewHandlers = {
  'view.sort.set': {
    actions: [
      viewActions.setSortBy,
      
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
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Send sort update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_SORT_BY',
            sortBy: context.sortBy
          });
        }
      }
    ]
  },
  
  'view.column.click': {
    actions: [
      viewActions.toggleSort,
      
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
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Send sort update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_SORT_BY',
            sortBy: context.sortBy
          });
        }
      }
    ]
  },
  
  'view.filter.set': {
    actions: [
      viewActions.setFilters,
      
      // Persist the state
      'persistSnapshot',
      
      // Send filter update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_FILTERS',
            filters: context.filters
          });
        }
      }
    ]
  },
  
  'view.group.set': {
    actions: [
      viewActions.setGroupBy,
      
      // Persist the state
      'persistSnapshot',
      
      // Send group update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_GROUP_BY',
            groupBy: context.groupBy
          });
        }
      }
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
      // Send column visibility update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_COLUMN_VISIBILITY',
            columnVisibility: context.columnVisibility
          });
        }
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
      },
      
      // Persist the state
      'persistSnapshot',
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
      // Send column visibility update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_COLUMN_VISIBILITY',
            columnVisibility: context.columnVisibility
          });
        }
      }
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
      // Send column visibility update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_COLUMN_VISIBILITY',
            columnVisibility: context.columnVisibility
          });
        }
      }
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
      // Send column visibility update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_COLUMN_VISIBILITY',
            columnVisibility: context.columnVisibility
          });
        }
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
      },
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' })
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
      
      // Clear drag state and restore column visibility
      ({ context }) => {
        if (context.actors?.rendererActor) {
          const domManager = (context.actors.rendererActor.getSnapshot().context as any)?.renderer?.domManager;
          if (domManager) {
            const header = domManager.getElement('header');
            // Restore visibility of all header columns
            header.querySelectorAll('.vibegridx-header-cell').forEach((el: HTMLElement) => {
              el.style.opacity = '';
              el.style.pointerEvents = '';
            });
            // Clear drag preview classes
            clearDragPreview(domManager);
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
      
      // Store automatically reprocesses data when view state changes
    ]
  },
  
  'view.columns.order.reset': {
    actions: [
      viewActions.resetColumnOrder,
      
      () => {
        console.log('TableMachine: Column order reset to default');
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
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
      // Store automatically reprocesses data when view state changes
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
      viewActions.startColumnDrag,
      
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
      viewActions.updateColumnDrag,
      
      // Calculate and apply drag preview only when preview is active
      ({ context, event }) => {
        if (!context.columnDragState || !context.coordinateMapping || !context.actors?.rendererActor) {
          return;
        }
        
        // Track last mouse position to avoid event spam
        const lastMouseX = (context as any)._lastDragMouseX || 0;
        const lastMouseY = (context as any)._lastDragMouseY || 0;
        const lastTargetIndex = (context as any)._lastDragTargetIndex;
        
        // Get current scroll position from viewport
        const scrollLeft = context.viewport?.scrollLeft || 0;
        
        // Calculate drag preview with scroll position
        const dragPreview = calculateDragPreview(
          event.x,
          context.columnDragState.columnId,
          context.coordinateMapping,
          scrollLeft
        );
        
        // Add mouse coordinates and column name to drag preview
        // Use client coordinates for the floating preview
        dragPreview.mouseX = event.clientX || event.x;
        dragPreview.mouseY = event.clientY || event.y;
        
        // Find column name from columns array
        const column = context.columns.find(col => col.id === context.columnDragState.columnId);
        dragPreview.columnName = column?.name || context.columnDragState.columnId;
        
        // Not an initial preview - this is a drag move update
        delete (dragPreview as any).isInitialPreview;
        
        // Only send update if mouse position changed significantly OR target index changed
        const mouseXChanged = Math.abs((event.clientX || event.x) - lastMouseX) > 5;
        const mouseYChanged = Math.abs((event.clientY || event.y) - lastMouseY) > 5;
        const targetIndexChanged = dragPreview.targetIndex !== lastTargetIndex;
        
        if (mouseXChanged || mouseYChanged || targetIndexChanged) {
          // Only log significant changes
          if (targetIndexChanged) {
            console.log('🎯 ViewHandler: Drag target changed', {
              targetIndex: dragPreview.targetIndex,
              columnName: dragPreview.columnName
            });
          }
          
          // Store new position and target
          (context as any)._lastDragMouseX = event.clientX || event.x;
          (context as any)._lastDragMouseY = event.clientY || event.y;
          (context as any)._lastDragTargetIndex = dragPreview.targetIndex;
          
          // Send preview data to renderer
          context.actors.rendererActor.send({
            type: 'APPLY_DRAG_PREVIEW',
            dragPreview
          });
        }
      },
      
      // Emit event for UI feedback
      emit(({ context }) => ({
        type: 'view.drag.updated',
        columnDragState: context.columnDragState
      }))
    ]
  },
  
  'view.columns.drag.end': [
    {
      // Check if column was actually moved
      guard: ({ context, event }) => {
        // Quick check to see if drag resulted in any movement
        const scrollLeft = context.viewport?.scrollLeft || 0;
        const dragPreview = calculateDragPreview(
          event.x,
          event.columnId,
          context.coordinateMapping,
          scrollLeft
        );
        
        const dataColumnOrder = context.columnOrder.filter(id => id !== '__selection' && context.columnVisibility[id] !== false);
        const currentIndex = dataColumnOrder.indexOf(event.columnId);
        
        // If column didn't move, skip all actions
        if (currentIndex === dragPreview.targetIndex) {
          console.log('Column dropped in same position, skipping all drag end actions');
          
          // Still need to clear drag state and restore UI
          if (context.actors?.rendererActor) {
            context.actors.rendererActor.send({ type: 'CLEAR_DRAG_PREVIEW' });
          }
          document.body.style.cursor = '';
          document.body.classList.remove('vibegridx-dragging-active');
          
          return false;
        }
        
        return true;
      },
      actions: [
        // Calculate target column based on mouse coordinates
        ({ context, event }) => {
        console.log('🎯 ViewHandler: Column drag end - calculating target from coordinates', {
          columnId: event.columnId,
          mouseX: event.x,
          mouseY: event.y,
          coordinateMapping: context.coordinateMapping
        });
        
        // Get current scroll position from viewport
        const scrollLeft = context.viewport?.scrollLeft || 0;
        
        // Use drag preview helper to calculate target with scroll position
        const dragPreview = calculateDragPreview(
          event.x,
          event.columnId,
          context.coordinateMapping,
          scrollLeft
        );
        
        // Double-check the current index from drag preview matches our calculation
        const dataColumnOrder = context.columnOrder.filter(id => id !== '__selection' && context.columnVisibility[id] !== false);
        const currentIndexFromOrder = dataColumnOrder.indexOf(event.columnId);
        
        console.log('🎯 ViewHandler: Calculated drag target', {
          currentColumn: event.columnId,
          targetIndex: dragPreview.targetIndex,
          debugInfo: dragPreview.debugInfo,
          currentIndexFromDragPreview: dragPreview.debugInfo?.currentIndex,
          currentIndexFromColumnOrder: currentIndexFromOrder,
          indexMismatch: dragPreview.debugInfo?.currentIndex !== currentIndexFromOrder
        });
        
        // Early exit if no actual movement
        if (currentIndexFromOrder === dragPreview.targetIndex) {
          console.log('Column dropped in same position, skipping all updates');
          // Set a flag to skip subsequent actions
          (context as any)._skipColumnReorder = true;
          return;
        }
        
        // Store calculated target on context for next action
        (context as any)._calculatedTargetIndex = dragPreview.targetIndex;
        (context as any)._skipColumnReorder = false;
      },
      
      // Update column order in context using calculated target
      assign({
        columnOrder: ({ context, event }) => {
          // Skip if flagged as no-op
          if ((context as any)._skipColumnReorder) {
            return context.columnOrder;
          }
          
          const targetIndex = (context as any)._calculatedTargetIndex;
          
          if (targetIndex !== undefined && context.columnDragState?.columnId) {
            const draggedColumnId = context.columnDragState.columnId;
            
            // Work with visible data columns only (exclude selection column AND hidden columns)
            const dataColumnOrder = context.columnOrder.filter(id => {
              if (id === '__selection') return false;
              // Check if column is visible
              return context.columnVisibility[id] !== false;
            });
            
            // Find current index in visible data columns
            const currentIndex = dataColumnOrder.indexOf(draggedColumnId);
            
            // Also find the index in coordinate mapping for debugging
            const coordMappingColumns = context.coordinateMapping?.columns || [];
            const coordMappingDataColumns = coordMappingColumns
              .filter((col: any) => col.columnId !== '__selection')
              .sort((a: any, b: any) => a.index - b.index);
            const coordMappingIndex = coordMappingDataColumns.findIndex((col: any) => col.columnId === draggedColumnId);
            
            console.log('🎯 ViewHandler: Finding dragged column position', {
              draggedColumnId,
              dataColumnOrder,
              currentIndex,
              columnOrderFull: context.columnOrder,
              hiddenColumns: context.columnOrder.filter(id => context.columnVisibility[id] === false),
              columnVisibility: context.columnVisibility,
              coordinateMappingColumns: coordMappingColumns.map((c: any) => ({ id: c.columnId, index: c.index })),
              coordinateMappingDataColumns: coordMappingDataColumns.map((c: any) => ({ id: c.columnId, index: c.index })),
              coordMappingIndex
            });
            
            if (currentIndex === -1) {
              console.error('Dragged column not found in columnOrder:', draggedColumnId);
              return context.columnOrder;
            }
            
            // Don't move if dropping in same position
            if (currentIndex === targetIndex) {
              console.log('Column dropped in same position, no change needed');
              return context.columnOrder;
            }
            
            console.log('🎯 ViewHandler: Before adjustment', {
              currentIndex,
              targetIndex,
              draggedColumn: draggedColumnId,
              dataColumnOrder
            });
            
            // Create new order array for data columns
            const newDataOrder = [...dataColumnOrder];
            
            // Remove from current position
            const [removed] = newDataOrder.splice(currentIndex, 1);
            console.log('🎯 ViewHandler: After removal', {
              removed,
              newDataOrder,
              originalLength: dataColumnOrder.length,
              newLength: newDataOrder.length
            });
            
            // The targetIndex from drag preview is where we want to insert in the original array
            // We need to use it directly for insertion
            let insertionIndex = targetIndex;
            
            // Only adjust if we're moving right and the target is after the current position
            // because removing the element shifts indices down
            if (targetIndex > currentIndex) {
              insertionIndex = targetIndex - 1;
            }
            
            console.log('🎯 ViewHandler: Insertion calculation', {
              targetIndex,
              currentIndex,
              insertionIndex,
              isMovingLeft: targetIndex < currentIndex,
              isMovingRight: targetIndex > currentIndex
            });
            
            // Insert at calculated position
            newDataOrder.splice(insertionIndex, 0, removed);
            
            // Reconstruct full column order preserving hidden columns
            // We need to update the positions of visible columns while keeping hidden ones in place
            const newFullOrder: string[] = [];
            let visibleIndex = 0;
            
            // Go through the original order and place columns appropriately
            context.columnOrder.forEach(colId => {
              if (colId === '__selection') {
                // Selection column always goes first
                newFullOrder.push(colId);
              } else if (context.columnVisibility[colId] === false) {
                // Hidden column - keep in same position
                newFullOrder.push(colId);
              } else {
                // Visible column - use the new order
                if (visibleIndex < newDataOrder.length) {
                  newFullOrder.push(newDataOrder[visibleIndex]);
                  visibleIndex++;
                }
              }
            });
            
            const newOrder = newFullOrder;
            
            console.log('🎯 ViewHandler: Column order updated', {
              from: currentIndex,
              to: insertionIndex,
              originalTarget: targetIndex,
              draggedColumn: draggedColumnId,
              visibleColumnsNewOrder: newDataOrder,
              fullNewOrder: newOrder,
              hiddenColumns: context.columnOrder.filter(id => context.columnVisibility[id] === false),
              originalOrder: context.columnOrder
            });
            
            return newOrder;
          }
          return context.columnOrder;
        },
        // Increment version to trigger re-render
        version: ({ context }) => context.version + 1
      }),
      
      // Trigger coordinate recalculation
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
      
      // Clear drag state
      viewActions.clearColumnDrag,
      
      // Clear stored drag tracking state
      ({ context }) => {
        delete (context as any)._lastDragTargetIndex;
        delete (context as any)._calculatedTargetIndex;
        delete (context as any)._lastDragMouseX;
        delete (context as any)._lastDragMouseY;
      },
      
      // Clear selection when columns are reordered via drag
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
      
      // Persist the state
      'persistSnapshot',
      
      // Send column order update to store
      ({ context }) => {
        if (context.storeActor) {
          context.storeActor.send({
            type: 'SET_COLUMN_ORDER',
            columnOrder: context.columnOrder
          });
        }
      },
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.ended' }),
      ]
    },
    {
      // No-op case: just clean up drag state
      actions: [
        // Clear drag state
        viewActions.clearColumnDrag,
        
        // Clear stored drag tracking state
        ({ context }) => {
          delete (context as any)._lastDragTargetIndex;
          delete (context as any)._calculatedTargetIndex;
          delete (context as any)._lastDragMouseX;
          delete (context as any)._lastDragMouseY;
          delete (context as any)._skipColumnReorder;
        }
      ]
    }
  ],
  
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
      
      viewActions.clearColumnDrag,
      
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
        }
      }),
      
      // Persist the state
      'persistSnapshot',
      
      // Increment version to trigger re-render
      assign({
        version: ({ context }) => context.version + 1
      }),
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
  },
  
  // ====================================
  // CATCHALL: COLUMN LAYOUT CHANGED
  // ====================================
  
  'COLUMN_LAYOUT_CHANGED': {
    actions: [
      // Recalculate coordinate mapping whenever column layout changes
      dimensionActions.recalculateCoordinateMapping,
      
      // Trigger full render with new column order
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          console.log('🔄 COLUMN_LAYOUT_CHANGED: Triggering full render with new column order', {
            columnOrder: context.columnOrder,
            columnCount: context.columns.length
          });
          
          // Get visible columns in the new order
          const visibleColumns = context.columns.filter(col => 
            context.columnVisibility[col.id] !== false
          );
          
          // Apply the new column order
          const orderedColumns = context.columnOrder.length > 0
            ? context.columnOrder
                .map(colId => visibleColumns.find(col => col.id === colId))
                .filter(Boolean)
            : visibleColumns;
          
          // Add selection column if enabled
          const columnsWithSelection = context.enableSelectionColumn
            ? [{ id: '__selection', field: '__selection', name: 'Select', width: 48 }, ...orderedColumns]
            : orderedColumns;
          
          // Send CALCULATE_COORDINATES which will trigger a full render
          context.actors.rendererActor.send({
            type: 'CALCULATE_COORDINATES',
            rows: context.rows,
            columns: columnsWithSelection,
            columnWidths: context.coordinateMapping?.columns
              ? Object.fromEntries(context.coordinateMapping.columns.map(col => [col.columnId, col.width]))
              : undefined
          });
        }
      },
      
      // Forward updated coordinates to canvas for overlay sync
      ({ context, self }) => {
        if (context.actors?.canvasActor) {
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
  },

  // Column drag event handlers
  'view.column.drag.start': {
    actions: [
      viewActions.startColumnDrag,
      
      ({ event, context }) => {
        console.log('TableMachine: Column drag started via view event', {
          columnId: event.columnId,
          position: { x: event.x, y: event.y }
        });
        
        // Apply initial drag preview to hide the original column
        if (context.actors?.rendererActor && context.coordinateMapping) {
          const dragPreview = calculateDragPreview(
            event.x,
            event.columnId,
            context.coordinateMapping,
            context.viewport?.scrollLeft || 0
          );
          
          // Mark as initial preview and add column name
          (dragPreview as any).isInitialPreview = true;
          
          // Find column name from columns
          const column = context.columns.find((col: any) => col.id === event.columnId);
          if (column) {
            dragPreview.columnName = column.name || column.id;
          }
          
          const renderer = context.actors.rendererActor.getSnapshot().context as any;
          if (renderer?.renderer?.domManager) {
            applyDragPreview(dragPreview, renderer.renderer.domManager);
          }
        }
      }
    ]
  },

  'view.column.drag.move': {
    actions: [
      viewActions.updateColumnDragPosition,
      
      // Calculate and apply drag preview
      ({ event, context }) => {
        if (context.columnDragState && context.actors?.rendererActor) {
          // Get container bounds for relative positioning
          const renderer = context.actors.rendererActor.getSnapshot().context as any;
          const container = renderer?.renderer?.domManager?.getElement('container');
          let relativeX = event.x;
          
          if (container) {
            const rect = container.getBoundingClientRect();
            relativeX = event.x - rect.left;
          }
          
          const dragPreview = calculateDragPreview(
            relativeX,
            context.columnDragState.draggedColumnId,
            context.coordinateMapping,
            context.viewport?.scrollLeft || 0
          );
          
          // Add mouse position for floating preview
          dragPreview.mouseX = event.x;
          dragPreview.mouseY = event.y;
          
          // Apply preview to DOM
          if (renderer?.renderer?.domManager) {
            applyDragPreview(dragPreview, renderer.renderer.domManager);
          }
        }
      }
    ]
  },

  'view.column.drag.end': {
    actions: [
      // Calculate final position and trigger reorder
      ({ event, context, self }) => {
        if (context.columnDragState && context.coordinateMapping) {
          // Get container bounds for relative positioning
          const renderer = context.actors.rendererActor.getSnapshot().context as any;
          const container = renderer?.renderer?.domManager?.getElement('container');
          let relativeX = event.clientX;
          
          if (container) {
            const rect = container.getBoundingClientRect();
            relativeX = event.clientX - rect.left;
          }
          
          const dragPreview = calculateDragPreview(
            relativeX,
            context.columnDragState.draggedColumnId,
            context.coordinateMapping,
            context.viewport?.scrollLeft || 0
          );
          
          const currentIndex = context.columnOrder.indexOf(context.columnDragState.draggedColumnId);
          
          // Only reorder if position actually changed
          if (dragPreview.targetIndex !== -1 && dragPreview.targetIndex !== currentIndex) {
            console.log('TableMachine: Column reorder needed', {
              from: currentIndex,
              to: dragPreview.targetIndex
            });
            
            // Send reorder event
            self.send({
              type: 'view.columns.reorder',
              fromIndex: currentIndex,
              toIndex: dragPreview.targetIndex
            });
          }
        }
      },
      
      viewActions.endColumnDrag,
      
      // Clear any remaining preview
      ({ context }) => {
        if (context.actors?.rendererActor) {
          const renderer = context.actors.rendererActor.getSnapshot().context as any;
          if (renderer?.renderer?.domManager) {
            clearDragPreview(renderer.renderer.domManager);
          }
        }
      }
    ]
  }
};

