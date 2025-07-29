// ====================================
// EDIT EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { editActions } from '../slices/edit-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';
import { EditingOverlay } from '../../../overlays/EditingOverlay';

// Global editing overlay instance - managed directly without actor wrapper
let globalEditingOverlay: EditingOverlay | null = null;

// Helper function to ensure editing overlay is initialized
function ensureEditingOverlay(context: any, self?: any): EditingOverlay {
  // Always check if container has changed - recreate overlay if needed
  let container = context.canvasContainer || context.containerElement;
  
  if (!container) {
    // Try to find the vibegridx body container
    container = document.querySelector('[data-vibegridx-container]') || 
               document.querySelector('.vibegridx-body') ||
               document.querySelector('.vibegridx-container');
  }
  
  if (!container) {
    throw new Error('EditHandlers: No container found for editing overlay. Available containers: ' + 
      Array.from(document.querySelectorAll('[class*="vibegridx"]')).map(el => el.className).join(', '));
  }
  
  // Check if we need to recreate the overlay (container changed or not initialized)
  const needsRecreation = !globalEditingOverlay || 
                         (globalEditingOverlay as any).container !== container ||
                         !document.contains((globalEditingOverlay as any).container);
  
  if (needsRecreation) {
    // Clean up existing overlay if any
    if (globalEditingOverlay) {
      console.log('EditHandlers: Container changed, cleaning up old EditingOverlay');
      globalEditingOverlay.destroy();
      globalEditingOverlay = null;
    }
    
    const config = {
      onCommit: (value: any) => {
        // Send commit event back to state machine with safety check
        if (self && self.getSnapshot && self.getSnapshot().status !== 'stopped') {
          try {
            self.send({ type: 'EDIT_COMMIT', value });
          } catch (error) {
            console.warn('EditHandlers: Could not send EDIT_COMMIT, machine may be stopped:', error);
          }
        }
      },
      onCancel: () => {
        // Send cancel event back to state machine with safety check
        if (self && self.getSnapshot && self.getSnapshot().status !== 'stopped') {
          try {
            self.send({ type: 'EDIT_CANCEL' });
          } catch (error) {
            console.warn('EditHandlers: Could not send EDIT_CANCEL, machine may be stopped:', error);
          }
        }
      },
      zIndex: 1000,
      relationshipContext: {
        relationshipResolvers: context.relationshipResolvers,
        // Get store actor from context to access relationship data
        getStore: () => {
          const store = context.storeActor || (window as any).__vibegridx_store_actor;
          console.log('EditHandlers: getStore called', { 
            hasContextStore: !!context.storeActor, 
            hasWindowStore: !!(window as any).__vibegridx_store_actor,
            store: store
          });
          return store;
        }
      },
      getRowData: (rowId: string) => {
        // Find the entity data by row ID
        const entity = context.entities.find((e: any) => e.id === rowId);
        return entity || null;
      }
    };
    
    globalEditingOverlay = new EditingOverlay(container, config);
    console.log('EditHandlers: Created new EditingOverlay instance', {
      container,
      containerClass: container.className
    });
  }
  
  return globalEditingOverlay;
}

// Helper function to cleanup editing overlay
function cleanupEditingOverlay(): void {
  if (globalEditingOverlay) {
    globalEditingOverlay.destroy();
    globalEditingOverlay = null;
    console.log('EditHandlers: Cleaned up EditingOverlay instance');
  }
}

export const editHandlers = {
  'edit.cell.start': {
    actions: [
      // Create cell ref from event
      ({ context, event, self }) => {
        const cell = {
          rowId: event.rowId,
          columnId: event.columnId,
          field: context.columns.find(c => c.id === event.columnId)?.field || event.columnId
        };
        
        // Get current value from row data
        const row = context.rows.find(r => r.id === event.rowId);
        const value = row?.data[cell.field];
        
        // Send the edit.start event with proper structure
        self.send({
          type: 'edit.start',
          cell,
          value
        });
      }
    ]
  },

  'edit.cell.start.single': {
    actions: [
      // Log single-click edit initiation
      ({ context, event }) => {
        console.log('🎯 Edit Handler: Single-click edit initiated', {
          rowId: event.rowId,
          columnId: event.columnId,
          immediate: event.immediate,
          timestamp: Date.now()
        });
      },
      
      // Validate that the column is editable
      ({ context, event, self }) => {
        const column = context.columns.find(c => c.id === event.columnId);
        if (!column) {
          console.warn('🎯 Edit Handler: Column not found', { columnId: event.columnId });
          return;
        }
        
        if (column.editable === false) {
          console.warn('🎯 Edit Handler: Column not editable', { columnId: event.columnId });
          return;
        }
        
        // Create cell ref from event
        const cell = {
          rowId: event.rowId,
          columnId: event.columnId,
          field: column.field || event.columnId
        };
        
        // Get current value from row data
        const row = context.rows.find(r => r.id === event.rowId);
        const value = row?.data[cell.field];
        
        console.log('🎯 Edit Handler: Starting single-click edit', {
          cell,
          value,
          column: column.name
        });
        
        // Send the edit.start event with proper structure and immediate flag
        self.send({
          type: 'edit.start',
          cell,
          value,
          mode: 'single-click',
          immediate: event.immediate
        });
      }
    ]
  },
  
  'edit.start': {
    actions: [
      editActions.startEdit,
      
      // Update overlay state to show editing cell
      assign({
        editingCell: ({ event }) => event.cell
      }),
      
      // Show editor directly using EditingOverlay
      ({ context, event, self }) => {
        try {
          console.log('EditHandlers: About to ensure EditingOverlay', {
            hasCanvasContainer: !!context.canvasContainer,
            canvasContainer: context.canvasContainer,
            canvasContainerClass: context.canvasContainer?.className,
            hasContainerElement: !!context.containerElement,
            containerElement: context.containerElement,
            containerClass: context.containerElement?.className
          });
          
          const editingOverlay = ensureEditingOverlay(context, self);
          const column = context.columns.find(c => c.id === event.cell.columnId);
          if (!column) {
            console.error('EditHandlers: Column not found for cell', event.cell);
            return;
          }
          
          // Use the same visual position calculation as canvas overlay
          const cellKey = `${event.cell.rowId}:${event.cell.columnId}`;
          const visualPositions = calculateVisualPositions(
            new Set([cellKey]),
            context.coordinateMapping,
            context.viewport,
            context.settings.rowHeight
          );
          
          const position = visualPositions[0] || { x: 0, y: 0, width: 100, height: 40 };
          
          console.log('EditHandlers: Showing editor directly', {
            cell: event.cell,
            column: column.id,
            value: event.value,
            position,
            mode: event.mode || 'double-click'
          });
          
          editingOverlay.showAt(
            position,
            event.cell,
            column,
            event.value,
            undefined, // validationErrors
            event.mode || 'double-click'
          );
        } catch (error) {
          console.error('EditHandlers: Error showing editor', error);
        }
      },
      
      // Send to canvas actor to show editing overlay
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ context, event }) => {
          const cellKey = `${event.cell.rowId}:${event.cell.columnId}`;
          const visualPositions = calculateVisualPositions(
            new Set([cellKey]),
            context.coordinateMapping,
            context.viewport,
            context.settings.rowHeight
          );
          
          const position = visualPositions[0] || { x: 0, y: 0, width: 100, height: 40 };
          
          return {
            type: 'SHOW_EDITING',
            position
          };
        }
      ),
      
      // Emit edit start event
      emit(({ event }) => ({
        type: 'vibegridx.cell.edit.start',
        cell: event.cell,
        value: event.value
      })),
      
      ({ event }) => {
        console.log('TableMachine: Edit started', {
          cell: event.cell,
          value: event.value
        });
      }
    ]
  },

  'edit.update': {
    actions: [
      editActions.updateEditValue,
      
      // No need to update editing actor on every keypress
      // The editor component manages its own state
      
      ({ context, event }) => {
        console.log('TableMachine: Edit value updated', {
          cell: context.editingCell,
          newValue: event.value,
          isDirty: context.isDirty
        });
      }
    ]
  },


  'edit.cancel': {
    actions: [
      // Set canceling flag first
      assign({
        isCanceling: () => true
      }),
      
      editActions.cancelEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide editor directly
      ({ context }) => {
        try {
          if (globalEditingOverlay) {
            globalEditingOverlay.hide();
            console.log('EditHandlers: Editor hidden directly');
          }
        } catch (error) {
          console.error('EditHandlers: Error hiding editor', error);
        }
      },
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
        })
      ),
      
      ({ context }) => {
        console.log('TableMachine: Edit cancelled', {
          cell: context.editingCell
        });
      }
    ]
  },

  'edit.validate': {
    actions: [
      // Validation logic would go here
      // For now, just log the validation request
      ({ context, event }) => {
        console.log('TableMachine: Edit validation requested', {
          cell: context.editingCell,
          value: event.value
        });
      }
    ]
  },

  'edit.error': {
    actions: [
      editActions.setValidationErrors,
      
      // Update editor validation directly
      ({ context, event }) => {
        try {
          if (globalEditingOverlay) {
            globalEditingOverlay.updateValidationErrors(event.errors);
            console.log('EditHandlers: Validation errors updated directly');
          }
        } catch (error) {
          console.error('EditHandlers: Error updating validation errors', error);
        }
      },
      
      emit(({ event }) => ({
        type: 'vibegridx.error',
        error: new Error(event.message || 'Edit validation failed'),
        context: 'edit'
      })),
      
      ({ event }) => {
        console.error('TableMachine: Edit error', {
          errors: event.errors,
          message: event.message
        });
      }
    ]
  },

  // Optimistic operation management
  'edit.operation.remove': {
    actions: [
      editActions.removeOptimisticOperation,
      
      ({ event }) => {
        console.log('TableMachine: Optimistic operation removed', {
          operationId: event.operationId
        });
      }
    ]
  },

  'edit.operation.update': {
    actions: [
      editActions.updateOptimisticOperationStatus,
      
      ({ event }) => {
        console.log('TableMachine: Optimistic operation updated', {
          operationId: event.operationId,
          status: event.status
        });
      }
    ]
  },

  // Canvas actor responses
  'EDIT_UPDATE': {
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit update from canvas', {
          value: event.value
        });
      },
      
      // Forward the update to the edit slice
      ({ self, event }) => {
        self.send({
          type: 'edit.update',
          value: event.value
        });
      }
    ]
  },

  'EDIT_COMMIT': {
    guard: ({ context, event }) => {
      // Check if value actually changed
      const hasChanged = context.originalValue !== event.value;
      console.log('TableMachine: Edit commit guard check', {
        originalValue: context.originalValue,
        newValue: event.value,
        hasChanged
      });
      return hasChanged;
    },
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit commit from canvas', {
          value: event.value
        });
      },
      
      // Store editing cell info before clearing it
      ({ context, event, self }) => {
        if (!context.editingCell) return;
        
        const editingCell = context.editingCell;
        const { rowId, columnId, field } = editingCell;
        
        // Store optimistic operation for tracking
        const operationId = `edit-${rowId}-${columnId}-${Date.now()}`;
        const newOperations = new Map(context.optimisticOperations);
        newOperations.set(operationId, {
          id: operationId,
          type: 'update',
          entityId: rowId,
          field: field,
          newValue: event.value,
          oldValue: context.originalValue,
          timestamp: Date.now()
        });
        
        // Update optimistic operations
        Object.assign(context, { optimisticOperations: newOperations });
        
        // CRITICAL: Update both entities and rows optimistically
        const entityIndex = context.entities.findIndex(e => e.id === rowId);
        const rowIndex = context.rows.findIndex(r => r.id === rowId);
        
        if (entityIndex !== -1 && rowIndex !== -1) {
          // Update entity first
          const updatedEntity = {
            ...context.entities[entityIndex],
            [field]: event.value
          };
          const updatedEntities = [...context.entities];
          updatedEntities[entityIndex] = updatedEntity;
          Object.assign(context, { entities: updatedEntities });
          
          // Then update row data
          const currentRowData = context.rows[rowIndex].data;
          
          // Debug: Log current resolved fields
          const resolvedFields = Object.keys(currentRowData).filter(k => k.startsWith('__resolved_'));
          if (resolvedFields.length > 0) {
            console.log('TableMachine: Current resolved fields before update', {
              rowId,
              resolvedFields,
              resolvedValues: resolvedFields.reduce((acc, key) => {
                acc[key] = currentRowData[key];
                return acc;
              }, {} as any)
            });
          }
          
          const updatedRowData = {
            ...currentRowData,
            [field]: event.value
          };
          
          // Check if this is a relationship column and resolve it
          const column = context.columns.find(c => c.id === columnId);
          console.log('TableMachine: Checking if column needs relationship resolution', {
            columnId,
            columnType: column?.cellType || column?.type,
            isRelationship: (column?.cellType || column?.type)?.startsWith('relationship'),
            hasResolvers: !!context.relationshipResolvers,
            hasThisResolver: !!context.relationshipResolvers?.[columnId],
            resolverKeys: Object.keys(context.relationshipResolvers || {})
          });
          
          if (column && (column.cellType || column.type)?.startsWith('relationship')) {
            const resolver = context.relationshipResolvers?.[columnId];
            console.log('TableMachine: Attempting to resolve relationship', {
              columnId,
              hasResolver: !!resolver,
              eventValue: event.value,
              eventValueType: typeof event.value
            });
            
            if (resolver && event.value != null) {
              try {
                // Update the resolved value as well
                const resolvedValue = resolver(event.value);
                updatedRowData[`__resolved_${columnId}`] = resolvedValue;
                console.log('TableMachine: Successfully resolved relationship value', {
                  columnId,
                  rawValue: event.value,
                  resolvedValue,
                  resolvedKey: `__resolved_${columnId}`
                });
              } catch (error) {
                console.error('TableMachine: Error resolving relationship', {
                  columnId,
                  value: event.value,
                  error
                });
              }
            } else {
              console.warn('TableMachine: Cannot resolve relationship - missing resolver or null value', {
                columnId,
                hasResolver: !!resolver,
                value: event.value
              });
            }
          }
          
          // Skip optimistic update if we have an onEntityUpdate handler (Dexie will handle it)
          const hasEntityUpdateHandler = !!context.onEntityUpdate;
          
          if (!hasEntityUpdateHandler) {
            // Only do optimistic update if there's no entity update handler
            const updatedRow = {
              ...context.rows[rowIndex],
              data: updatedRowData
            };
            const updatedRows = [...context.rows];
            updatedRows[rowIndex] = updatedRow;
            Object.assign(context, { rows: updatedRows });
            
            console.log('TableMachine: Updated row data optimistically (no entity handler)', {
              rowId,
              field,
              newValue: event.value,
              oldValue: context.originalValue
            });
            
            // Trigger ViewActor to process updated data and re-render
            // This ensures consistent sorting, styling, and relationship resolution
            if (self && self.send) {
              console.log('TableMachine: Triggering view processing after edit');
              self.send({ type: 'INVOKE_VIEW_ACTOR' });
            }
          } else {
            console.log('TableMachine: Skipping optimistic update - entity handler will trigger updates', {
              rowId,
              field,
              newValue: event.value
            });
          }
          
          // Use onEntityUpdate for updates
          if (context.onEntityUpdate && typeof context.onEntityUpdate === 'function') {
            const updates = { [field]: event.value };
            
            console.log('TableMachine: Using onEntityUpdate for update', {
              rowId,
              updates,
              field
            });
            
            // Use onEntityUpdate method (maintains sync tracking)
            const updateResult = context.onEntityUpdate(rowId, updates);
            
            // Handle both sync and async updates
            if (updateResult instanceof Promise) {
              updateResult
                .then(() => {
                  console.log('TableMachine: Entity update successful', { rowId, field });
                  // Remove optimistic operation on success
                  self.send({
                    type: 'edit.operation.remove',
                    operationId
                  });
                })
                .catch((error: any) => {
                  console.error('TableMachine: Entity update failed', {
                    rowId,
                    field,
                    error
                  });
                  // Emit error event
                  self.send({
                  type: 'edit.error',
                  message: `Failed to update ${field}: ${error.message}`,
                  errors: [error.message]
                });
                // Revert optimistic update
                self.send({
                  type: 'edit.operation.revert',
                  operationId
                });
              });
            } else {
              // Sync update completed
              console.log('TableMachine: Entity update successful (sync)', { rowId, field });
              self.send({
                type: 'edit.operation.remove',
                operationId
              });
            }
          } else {
            console.warn('TableMachine: No onEntityUpdate handler provided', {
              rowId,
              field,
              value: event.value
            });
          }
        } else {
          console.warn('TableMachine: Could not find entity or row to update', {
            rowId,
            entityIndex,
            rowIndex
          });
        }
      },
      
      editActions.commitEdit,
      
      // Clear editing state after commit
      editActions.clearEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide editor directly
      ({ context }) => {
        try {
          if (globalEditingOverlay) {
            globalEditingOverlay.hide();
            console.log('EditHandlers: Editor hidden directly');
          }
        } catch (error) {
          console.error('EditHandlers: Error hiding editor', error);
        }
      },
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
        })
      )
    ]
  },

  'EDIT_CANCEL': {
    actions: [
      ({ event }) => {
        console.log('TableMachine: Edit cancel from canvas');
      },
      
      // Forward the cancel to the edit slice
      ({ self }) => {
        self.send({
          type: 'edit.cancel'
        });
      }
    ]
  },

  'edit.ensure.end': {
    guard: ({ context }) => {
      // Only act if we're actually in edit mode
      return context.editingCell !== null;
    },
    actions: [
      ({ context }) => {
        console.log('TableMachine: Ensuring edit mode ends', {
          editingCell: context.editingCell,
          isDirty: context.isDirty
        });
      },
      
      // Clear editing state
      editActions.clearEdit,
      
      // Update overlay state
      assign({
        editingCell: () => null
      }),
      
      // Hide editor directly
      ({ context }) => {
        try {
          if (globalEditingOverlay) {
            globalEditingOverlay.hide();
            console.log('EditHandlers: Editor hidden directly');
          }
        } catch (error) {
          console.error('EditHandlers: Error hiding editor', error);
        }
      },
      
      // Hide editing overlay in canvas
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        () => ({
          type: 'HIDE_EDITING'
        })
      )
    ]
  },

  // Cleanup when editing system is destroyed
  'cleanup.editing': {
    actions: [
      () => {
        cleanupEditingOverlay();
      }
    ]
  }

};

// Export cleanup function for external use
export { cleanupEditingOverlay };