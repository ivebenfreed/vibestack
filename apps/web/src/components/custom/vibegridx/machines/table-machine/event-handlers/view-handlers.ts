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
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
      
      // Trigger coordinate recalculation for layout changes
      raise({ type: 'COLUMN_LAYOUT_CHANGED' }),
      
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
      
      // Clear drag state and remove dragging class
      ({ context }) => {
        if (context.actors?.rendererActor) {
          const domManager = (context.actors.rendererActor.getSnapshot().context as any)?.renderer?.domManager;
          if (domManager) {
            const header = domManager.getElement('header');
            // Remove dragging class from all columns
            header.querySelectorAll('.vibegridx-dragging').forEach((el: HTMLElement) => {
              el.classList.remove('vibegridx-dragging');
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
      
      // Add dragging class to the column
      ({ context, event }) => {
        if (context.actors?.rendererActor) {
          const domManager = (context.actors.rendererActor.getSnapshot().context as any)?.renderer?.domManager;
          if (domManager) {
            const header = domManager.getElement('header');
            const draggingColumn = header.querySelector(`[data-column="${event.columnId}"]`);
            if (draggingColumn) {
              draggingColumn.classList.add('vibegridx-dragging');
            }
          }
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
        
        // Only calculate preview if it's active (mouse has left the original column)
        if (!context.columnDragState.previewActive) {
          console.log('🎯 ViewHandler: Preview not active yet');
          return;
        }
        
        // Store last preview state on context to detect changes
        const lastTargetIndex = (context as any)._lastDragTargetIndex;
        
        // Calculate drag preview
        const dragPreview = calculateDragPreview(
          event.x,
          context.columnDragState.columnId,
          context.coordinateMapping
        );
        
        // Only send update if target has actually changed
        if (lastTargetIndex !== dragPreview.targetIndex) {
          console.log('🎯 ViewHandler: Drag target changed', {
            from: lastTargetIndex,
            to: dragPreview.targetIndex,
            mouseX: event.x,
            previewActive: context.columnDragState.previewActive
          });
          
          // Store new target
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
  
  'view.columns.drag.end': {
    actions: [
      // Calculate target column based on mouse coordinates
      ({ context, event }) => {
        console.log('🎯 ViewHandler: Column drag end - calculating target from coordinates', {
          columnId: event.columnId,
          mouseX: event.x,
          mouseY: event.y,
          coordinateMapping: context.coordinateMapping
        });
        
        // Use drag preview helper to calculate target
        const dragPreview = calculateDragPreview(
          event.x,
          event.columnId,
          context.coordinateMapping
        );
        
        // Double-check the current index from drag preview matches our calculation
        const dataColumnOrder = context.columnOrder.filter(id => id !== '__selection');
        const currentIndexFromOrder = dataColumnOrder.indexOf(event.columnId);
        
        console.log('🎯 ViewHandler: Calculated drag target', {
          currentColumn: event.columnId,
          targetIndex: dragPreview.targetIndex,
          debugInfo: dragPreview.debugInfo,
          currentIndexFromDragPreview: dragPreview.debugInfo?.currentIndex,
          currentIndexFromColumnOrder: currentIndexFromOrder,
          indexMismatch: dragPreview.debugInfo?.currentIndex !== currentIndexFromOrder
        });
        
        // Store calculated target on context for next action
        (context as any)._calculatedTargetIndex = dragPreview.targetIndex;
      },
      
      // Update column order in context using calculated target
      assign({
        columnOrder: ({ context, event }) => {
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
      
      // Clear drag preview before clearing drag state
      ({ context }) => {
        if (context.actors?.rendererActor) {
          context.actors.rendererActor.send({
            type: 'CLEAR_DRAG_PREVIEW'
          });
        }
      },
      
      // Clear drag state
      viewActions.clearColumnDrag,
      
      // Clear stored drag target indices
      ({ context }) => {
        delete (context as any)._lastDragTargetIndex;
        delete (context as any)._calculatedTargetIndex;
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
      
      // Trigger view processing to apply new column order
      raise({ type: 'INVOKE_VIEW_ACTOR' }),
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.ended' }),
      
    ]
  },
  
  'view.columns.drag.cancel': {
    actions: [
      // Clear drag preview
      ({ context }) => {
        if (context.actors?.rendererActor) {
          context.actors.rendererActor.send({
            type: 'CLEAR_DRAG_PREVIEW'
          });
        }
      },
      
      viewActions.clearColumnDrag,
      
      // Clear stored drag target indices
      ({ context }) => {
        delete (context as any)._lastDragTargetIndex;
        delete (context as any)._calculatedTargetIndex;
      },
      
      // Emit event for UI feedback
      emit({ type: 'view.drag.cancelled' })
    ]
  },
  
  // DIMENSIONS RECALCULATION - SINGLE SOURCE OF TRUTH
  'dimensions.recalculate': {
    actions: [
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
      
      // Column width visual update now handled through coordinate mapping update below
      
      // Update coordinate mapping with new column width (immutably)
      assign({
        coordinateMapping: ({ context }) => {
          if (!context.coordinateMapping || !context.columnResizeState) {
            return context.coordinateMapping;
          }
          
          const { columnId, currentWidth } = context.columnResizeState;
          
          // Find the column in the coordinate mapping
          const columnIndex = context.coordinateMapping.columns.findIndex((c: any) => c.columnId === columnId);
          if (columnIndex === -1) {
            return context.coordinateMapping;
          }
          
          const oldWidth = context.coordinateMapping.columns[columnIndex].width;
          const widthDiff = currentWidth - oldWidth;
          
          // Create new coordinate mapping with updated widths and offsets
          const newColumns = context.coordinateMapping.columns.map((col: any, index: number) => {
            if (index === columnIndex) {
              // Update the resizing column's width
              return { ...col, width: currentWidth };
            } else if (index > columnIndex) {
              // Update offsets for columns after the resized one
              return { ...col, offset: col.offset + widthDiff };
            }
            return col;
          });
          
          // Also update the columnWidths in the new mapping to ensure consistency
          return {
            ...context.coordinateMapping,
            columns: newColumns,
            version: Date.now()
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
      assign({
        coordinateMapping: ({ context }) => {
          const { columns, columnOrder, columnWidths } = context;
          
          const newCoordinateMapping = {
            rows: context.coordinateMapping.rows, // Preserve existing row mapping
            columns: [] as Array<{
              columnId: string;
              index: number;
              offset: number;
              width: number;
            }>,
            version: Date.now() // Update version to trigger re-render
          };
          
          // Recalculate column positions based on new order
          let currentOffset = 0;
          const selectionWidth = 48;
          
          // Process columns in the specified order
          columnOrder.forEach((columnId, orderIndex) => {
            // Handle selection column (always first) or regular columns
            if (columnId === '__selection') {
              newCoordinateMapping.columns.push({
                columnId: '__selection',
                index: orderIndex,
                offset: currentOffset,
                width: selectionWidth
              });
              currentOffset += selectionWidth;
            } else {
              const column = columns.find(c => c.id === columnId);
              if (column) {
                const width = columnWidths[columnId] || column.width || 120;
                
                newCoordinateMapping.columns.push({
                  columnId,
                  index: orderIndex,
                  offset: currentOffset,
                  width
                });
                
                currentOffset += width;
              }
            }
          });
          
          console.log('🔄 COLUMN_LAYOUT_CHANGED: Coordinate mapping recalculated', {
            version: newCoordinateMapping.version,
            columnCount: newCoordinateMapping.columns.length,
            columnOrder: columnOrder.slice(0, 5), // Log first 5 for debugging
            firstColumnOffset: newCoordinateMapping.columns[0]?.offset,
            firstColumnId: newCoordinateMapping.columns[0]?.columnId
          });
          
          return newCoordinateMapping;
        }
      }),
      
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
      },
      
      // Forward updated coordinates to renderer for passive consumption
      ({ context, self }) => {
        if (context.actors?.rendererActor) {
          console.log('🔄 COLUMN_LAYOUT_CHANGED: Forwarding updated coordinates to renderer');
          self.send({
            type: 'FORWARD_TO_RENDERER', 
            event: {
              type: 'UPDATE_COORDINATES',
              mapping: context.coordinateMapping,
              version: context.coordinateMapping.version
            }
          });
        }
      }
    ]
  }
};

