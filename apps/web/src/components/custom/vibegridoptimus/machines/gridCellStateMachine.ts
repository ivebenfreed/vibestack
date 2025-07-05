/**
 * XState Machine for Grid Cell Optimistic Updates
 * 
 * Eliminates the flash issue by managing cell state transitions explicitly:
 * idle → editing → committing → persisting → reconciling → idle
 * 
 * Key features:
 * - No timing gaps between editor close and atom updates
 * - Clear error handling and recovery paths
 * - Event-driven architecture for loose coupling
 * - Optimistic display during save operations
 */

import { setup, assign, type ActorRef } from 'xstate'

export interface GridCellContext {
  cellId: string
  columnKey: string
  atomValue: any
  displayValue: any
  isEditing: boolean
  isCommitting: boolean
  isPersisting: boolean
  hasError: boolean
  error: string | null
  retryCount: number
  // Enhanced context for parent communication
  parentRef?: ActorRef<any>
  persistenceKey: string
  conflictState: 'none' | 'detected' | 'resolved'
  lastServerUpdate: number
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

export type GridCellEvent =
  | { type: 'START_EDIT' }
  | { type: 'CHANGE_VALUE'; value: any }
  | { type: 'COMMIT_EDIT'; value: any }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; error: string }
  | { type: 'ATOM_UPDATE'; value: any }
  | { type: 'RETRY_SAVE' }
  | { type: 'SET_UPDATE_HANDLER'; onUpdate: (id: string, column: string, value: any) => Promise<void> }
  | { type: 'SET_PARENT_REF'; parentRef: ActorRef<any> }
  | { type: 'CONFLICT_DETECTED'; serverValue: any }
  | { type: 'CONFLICT_RESOLVED'; resolvedValue: any }

export const gridCellMachine = setup({
  types: {
    context: {} as GridCellContext,
    events: {} as GridCellEvent,
    input: {} as {
      cellId: string
      columnKey: string
      atomValue: any
      onUpdate?: (id: string, column: string, value: any) => Promise<void>
    },
    output: {} as {
      finalValue: any
      wasSuccessful: boolean
      errorMessage?: string
    }
  },
  actions: {
    notifyParentEditStart: ({ context }) => {
      if (context.parentRef) {
        context.parentRef.send({
          type: 'CELL_EDIT_START',
          cellId: context.cellId,
          columnKey: context.columnKey
        })
      }
    },
    notifyParentSaveStart: ({ context }) => {
      if (context.parentRef) {
        context.parentRef.send({
          type: 'CELL_SAVE_START',
          cellId: context.cellId,
          columnKey: context.columnKey
        })
      }
    },
    notifyParentSaveComplete: ({ context }) => {
      if (context.parentRef) {
        context.parentRef.send({
          type: 'CELL_SAVE_COMPLETE',
          cellId: context.cellId,
          columnKey: context.columnKey
        })
      }
    },
    notifyParentSaveFailed: ({ context, event }) => {
      if (context.parentRef && event.type === 'SAVE_ERROR') {
        context.parentRef.send({
          type: 'CELL_SAVE_FAILED',
          cellId: context.cellId,
          columnKey: context.columnKey,
          error: event.error
        })
      }
    },
    performSave: async ({ context }) => {
      if (context.onUpdate) {
        try {
          console.log('[GridCellMachine] 💾 Starting save operation:', {
            cellId: context.cellId,
            columnKey: context.columnKey,
            value: context.displayValue
          })
          await context.onUpdate(context.cellId, context.columnKey, context.displayValue)
          // Success will be handled by SAVE_SUCCESS event
        } catch (error) {
          // Error will be handled by SAVE_ERROR event
          console.error('[GridCellMachine] ❌ Save failed:', error)
        }
      }
    },
    logConflictDetected: ({ context, event }) => {
      if (event.type === 'ATOM_UPDATE' && context.isCommitting && context.displayValue !== event.value) {
        console.log('[GridCellMachine] 🚨 Conflict detected:', {
          optimistic: context.displayValue,
          server: event.value
        })
      }
    },
    logTransitionToIdle: () => {
      console.log('[GridCellMachine] ✅ Transitioning to idle - atom matches optimistic')
    },
    logTransitionToReconciling: ({ context, event }) => {
      if (event.type === 'ATOM_UPDATE') {
        console.log('[GridCellMachine] 🔄 Transitioning to reconciling - values differ:', {
          optimistic: context.displayValue,
          atom: event.value
        })
      }
    }
  },
  guards: {
    atomMatchesOptimistic: ({ context, event }) => {
      if (event.type !== 'ATOM_UPDATE') return false
      // Avoid JSON.stringify for performance - use simple equality
      const matches = context.displayValue === event.value
      console.log('[GridCellMachine] 🔍 atomMatchesOptimistic:', {
        optimistic: context.displayValue,
        atom: event.value,
        matches
      })
      return matches
    },
    canRetry: ({ context }) => {
      return context.retryCount < 3
    }
  }
}).createMachine({
  id: 'gridCell',
  initial: 'idle',
  context: ({ input }) => ({
    cellId: input.cellId,
    columnKey: input.columnKey,
    atomValue: input.atomValue,
    displayValue: input.atomValue,
    isEditing: false,
    isCommitting: false,
    isPersisting: false,
    hasError: false,
    error: null,
    retryCount: 0,
    parentRef: undefined,
    persistenceKey: `${input.cellId}:${input.columnKey}`,
    conflictState: 'none' as const,
    lastServerUpdate: 0,
    onUpdate: input.onUpdate
  }),
  states: {
    idle: {
      description: 'Normal display state, showing atom values',
      entry: [
        assign({
          isEditing: false,
          isCommitting: false,
          isPersisting: false,
          hasError: false,
          displayValue: ({ context }) => context.atomValue
        })
      ],
      on: {
        START_EDIT: {
          target: 'editing',
          actions: [
            assign({
              isEditing: true,
              displayValue: ({ context }) => context.atomValue,
              error: null,
              hasError: false
            }),
            // Notify parent grid of edit start
            ({ context }) => {
              if (context.parentRef) {
                context.parentRef.send({
                  type: 'CELL_EDIT_START',
                  cellId: context.cellId,
                  columnKey: context.columnKey
                })
              }
            }
          ]
        },
        ATOM_UPDATE: {
          actions: [
            assign({
              atomValue: ({ event }) => event.value,
              displayValue: ({ event, context }) => 
                context.isEditing ? context.displayValue : event.value,
              lastServerUpdate: () => Date.now()
            }),
            // Check for conflicts
            ({ context, event }) => {
              if (context.isCommitting && context.displayValue !== event.value) {
                console.log('[GridCellMachine] 🚨 Conflict detected:', {
                  optimistic: context.displayValue,
                  server: event.value
                })
              }
            }
          ]
        },
        SET_UPDATE_HANDLER: {
          actions: assign({
            onUpdate: ({ event }) => event.onUpdate
          })
        },
        SET_PARENT_REF: {
          actions: assign({
            parentRef: ({ event }) => event.parentRef
          })
        }
      }
    },
    
    editing: {
      description: 'Editor is active, local state managed',
      entry: assign({
        isEditing: true
      }),
      on: {
        CHANGE_VALUE: {
          actions: assign({
            displayValue: ({ event }) => event.value
          })
        },
        COMMIT_EDIT: {
          target: 'committing',
          actions: [
            assign({
              isCommitting: true,
              isEditing: false,
              displayValue: ({ event }) => event.value
            }),
            // Notify parent grid of save start
            ({ context }) => {
              if (context.parentRef) {
                context.parentRef.send({
                  type: 'CELL_SAVE_START',
                  cellId: context.cellId,
                  columnKey: context.columnKey
                })
              }
            }
          ]
        },
        CANCEL_EDIT: {
          target: 'idle',
          actions: assign({
            isEditing: false,
            displayValue: ({ context }) => context.atomValue,
            error: null,
            hasError: false
          })
        },
        ATOM_UPDATE: {
          actions: assign({
            atomValue: ({ event }) => event.value,
            lastServerUpdate: () => Date.now()
          })
        }
      }
    },
    
    committing: {
      description: 'Editor closed, optimistic display of new value',
      entry: [
        assign({ isCommitting: true }),
        // Trigger save operation
        async ({ context }) => {
          if (context.onUpdate) {
            try {
              console.log('[GridCellMachine] 💾 Starting save operation:', {
                cellId: context.cellId,
                columnKey: context.columnKey,
                value: context.displayValue
              })
              await context.onUpdate(context.cellId, context.columnKey, context.displayValue)
              // Success will be handled by SAVE_SUCCESS event
            } catch (error) {
              // Error will be handled by SAVE_ERROR event
              console.error('[GridCellMachine] ❌ Save failed:', error)
            }
          }
        }
      ],
      on: {
        SAVE_SUCCESS: {
          target: 'persisting',
          actions: [
            assign({ isPersisting: true, isCommitting: false }),
            // Notify parent grid of save completion
            ({ context }) => {
              if (context.parentRef) {
                context.parentRef.send({
                  type: 'CELL_SAVE_COMPLETE',
                  cellId: context.cellId,
                  columnKey: context.columnKey
                })
              }
            }
          ]
        },
        SAVE_ERROR: {
          target: 'error',
          actions: [
            assign({
              error: ({ event }) => event.error,
              hasError: true,
              isCommitting: false,
              retryCount: ({ context }) => context.retryCount + 1
            }),
            // Notify parent grid of save failure
            ({ context, event }) => {
              if (context.parentRef) {
                context.parentRef.send({
                  type: 'CELL_SAVE_FAILED',
                  cellId: context.cellId,
                  columnKey: context.columnKey,
                  error: event.error
                })
              }
            }
          ]
        },
        ATOM_UPDATE: {
          actions: assign({
            atomValue: ({ event }) => event.value,
            lastServerUpdate: () => Date.now()
          })
        }
      }
    },
    
    persisting: {
      description: 'Database save completed, waiting for atom update',
      entry: assign({ isPersisting: true }),
      on: {
        ATOM_UPDATE: [
          {
            guard: 'atomMatchesOptimistic',
            target: 'idle',
            actions: [
              assign({
                atomValue: ({ event }) => event.value,
                isPersisting: false,
                error: null,
                hasError: false,
                retryCount: 0,
                conflictState: 'none'
              }),
              () => console.log('[GridCellMachine] ✅ Transitioning to idle - atom matches optimistic')
            ]
          },
          {
            target: 'reconciling',
            actions: [
              assign({
                atomValue: ({ event }) => event.value,
                conflictState: 'detected'
              }),
              ({ context, event }) => console.log('[GridCellMachine] 🔄 Transitioning to reconciling - values differ:', { 
                optimistic: context.displayValue, 
                atom: event.value 
              })
            ]
          }
        ]
      }
    },
    
    reconciling: {
      description: 'Atom value differs from optimistic, resolving conflict',
      entry: assign({
        conflictState: 'detected',
        displayValue: ({ context }) => context.atomValue // Use server value for now
      }),
      after: {
        100: {
          target: 'idle',
          actions: assign({
            isPersisting: false,
            error: null,
            hasError: false,
            retryCount: 0,
            conflictState: 'resolved'
          })
        }
      },
      on: {
        CONFLICT_RESOLVED: {
          target: 'idle',
          actions: assign({
            displayValue: ({ event }) => event.resolvedValue,
            atomValue: ({ event }) => event.resolvedValue,
            conflictState: 'resolved'
          })
        }
      }
    },
    
    error: {
      description: 'Save failed, showing error state',
      entry: assign({
        hasError: true,
        displayValue: ({ context }) => context.atomValue // Revert to atom value
      }),
      on: {
        RETRY_SAVE: [
          {
            guard: 'canRetry',
            target: 'committing',
            actions: assign({
              hasError: false
            })
          },
          {
            target: 'idle',
            actions: assign({
              error: 'Max retries exceeded',
              hasError: true,
              displayValue: ({ context }) => context.atomValue,
              retryCount: 0
            })
          }
        ],
        START_EDIT: {
          target: 'editing',
          actions: assign({
            isEditing: true,
            hasError: false,
            error: null,
            retryCount: 0
          })
        },
        ATOM_UPDATE: {
          target: 'idle',
          actions: assign({
            atomValue: ({ event }) => event.value,
            displayValue: ({ event }) => event.value,
            hasError: false,
            error: null,
            retryCount: 0
          })
        }
      }
    }
  }
})

// Export the machine for use in the grid machine
export { gridCellMachine as default }