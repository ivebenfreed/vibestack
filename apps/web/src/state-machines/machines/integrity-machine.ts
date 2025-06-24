/**
 * Integrity Machine - Dedicated integrity validation and reset handling
 * 
 * Extracted from sync-machine-v3.ts to follow the planned architecture:
 * - sync-machine-v3.ts handles sync coordination (500 lines)
 * - integrity-machine.ts handles integrity validation/reset (300 lines)
 * 
 * This machine operates as a child of the sync machine and handles all
 * integrity-related states and logic independently.
 */

import { setup, assign, fromPromise } from 'xstate';
import { syncLogger } from '../../sync/utils/SyncLogger';
import type { ServiceCoordinator } from '../../sync/utils/ServiceCoordinator';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface IntegrityMachineContext {
  // Service coordination
  serviceCoordinator: ServiceCoordinator | null;
  clientId: string;
  
  // Validation state
  lastValidationResult: any | null;
  validationReason: string | null;
  
  // Reset state
  resetReason: string | null;
  resetType: 'full_reset' | 'table_reset' | null;
  
  // Error tracking
  error: string | null;
  retryCount: number;
  maxRetries: number;
}

export type IntegrityMachineEvent =
  | { type: 'VALIDATE'; reason?: string }
  | { type: 'RESET'; reason: string; resetType?: 'full_reset' | 'table_reset' }
  | { type: 'VALIDATION_SUCCESS'; result: any }
  | { type: 'VALIDATION_ERROR'; error: Error }
  | { type: 'RESET_SUCCESS'; result: any }
  | { type: 'RESET_ERROR'; error: Error }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }
  | { type: 'SERVER_RESET_COMMAND'; command: any; reason: string };

// ============================================================================
// Actors
// ============================================================================

const validateIntegrityActor = fromPromise(async ({ input }: {
  input: { serviceCoordinator: ServiceCoordinator; reason: string; clientId: string }
}): Promise<{ result: any }> => {
  const { serviceCoordinator, reason, clientId } = input;
  const services = serviceCoordinator?.getServices();
  
  if (!services?.integrity) {
    throw new Error('IntegrityService not available for validation');
  }
  
  syncLogger.info('validation', `Starting integrity validation: ${reason}`);
  
  try {
    const result = await services.integrity.validateIntegrity(reason);
    
    syncLogger.info('validation', 'Integrity validation completed', {
      isValid: result.isValid,
      issues: result.issues?.length || 0,
      recommendedAction: result.recommendedAction
    });
    
    return { result };
  } catch (error) {
    syncLogger.serviceError('IntegrityService', error as Error, 'validation');
    throw error;
  }
});

const resetIntegrityActor = fromPromise(async ({ input }: {
  input: { serviceCoordinator: ServiceCoordinator; reason: string; resetType: string; clientId: string }
}): Promise<{ result: any }> => {
  const { serviceCoordinator, reason, resetType, clientId } = input;
  const services = serviceCoordinator?.getServices();
  
  if (!services?.integrity) {
    throw new Error('IntegrityService not available for reset');
  }
  
  syncLogger.info('validation', `Starting integrity reset: ${reason} (type: ${resetType})`);
  
  try {
    const result = await services.integrity.executeReset(reason, resetType as any);
    
    syncLogger.info('validation', 'Integrity reset completed', {
      success: result.success,
      resetType: result.resetType
    });
    
    return { result };
  } catch (error) {
    syncLogger.serviceError('IntegrityService', error as Error, 'reset');
    throw error;
  }
});

// ============================================================================
// Machine Definition
// ============================================================================

export const integrityMachine = setup({
  types: {
    context: {} as IntegrityMachineContext,
    events: {} as IntegrityMachineEvent,
  },
  
  actors: {
    validateIntegrity: validateIntegrityActor,
    resetIntegrity: resetIntegrityActor,
  },
  
  actions: {
    recordValidationResult: assign(({ event }) => {
      if (event.type === 'VALIDATION_SUCCESS') {
        return {
          lastValidationResult: event.result,
          error: null
        };
      }
      return {};
    }),
    
    recordValidationError: assign(({ event }) => {
      if (event.type === 'VALIDATION_ERROR') {
        return {
          error: event.error.message,
          retryCount: ({ context }) => context.retryCount + 1
        };
      }
      return {};
    }),
    
    recordResetResult: assign(({ event }) => {
      if (event.type === 'RESET_SUCCESS') {
        return {
          error: null,
          retryCount: 0
        };
      }
      return {};
    }),
    
    recordResetError: assign(({ event }) => {
      if (event.type === 'RESET_ERROR') {
        return {
          error: event.error.message,
          retryCount: ({ context }) => context.retryCount + 1
        };
      }
      return {};
    }),
    
    clearError: assign({
      error: null,
      retryCount: 0
    }),
    
    setValidationReason: assign(({ event }) => {
      if (event.type === 'VALIDATE') {
        return {
          validationReason: event.reason || 'manual_validation'
        };
      }
      return {};
    }),
    
    setResetReason: assign(({ event }) => {
      if (event.type === 'RESET') {
        return {
          resetReason: event.reason,
          resetType: event.resetType || 'full_reset'
        };
      }
      return {};
    })
  },
  
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    
    shouldResetAfterValidation: ({ context }) => {
      const result = context.lastValidationResult;
      return result && !result.isValid && result.recommendedAction === 'reset';
    },
    
    hasValidationResult: ({ context }) => !!context.lastValidationResult
  }
}).createMachine({
  id: 'integrityMachine',
  initial: 'idle',
  
  context: ({ input }: { input?: Partial<IntegrityMachineContext> }) => ({
    serviceCoordinator: input?.serviceCoordinator || null,
    clientId: input?.clientId || '',
    lastValidationResult: null,
    validationReason: null,
    resetReason: null,
    resetType: null,
    error: null,
    retryCount: 0,
    maxRetries: 3
  }),
  
  states: {
    idle: {
      entry: [
        () => syncLogger.stateEntry('integrity:idle', 'Ready for validation or reset requests')
      ],
      
      on: {
        VALIDATE: {
          target: 'validating',
          actions: ['setValidationReason', 'clearError']
        },
        
        RESET: {
          target: 'resetting',
          actions: ['setResetReason', 'clearError']
        },
        
        SERVER_RESET_COMMAND: {
          target: 'resetting',
          actions: [
            assign(({ event }) => ({
              resetReason: event.reason,
              resetType: 'full_reset' as const
            })),
            'clearError'
          ]
        }
      }
    },
    
    validating: {
      entry: [
        () => syncLogger.stateEntry('integrity:validating', 'Running integrity validation')
      ],
      
      invoke: {
        src: 'validateIntegrity',
        input: ({ context }) => ({
          serviceCoordinator: context.serviceCoordinator!,
          reason: context.validationReason!,
          clientId: context.clientId
        }),
        
        onDone: {
          target: 'validation_complete',
          actions: [
            'recordValidationResult',
            ({ event }) => {
              syncLogger.info('validation', 'Validation completed successfully', {
                isValid: event.output.result.isValid,
                issues: event.output.result.issues?.length || 0
              });
            }
          ]
        },
        
        onError: [
          {
            target: 'validation_failed',
            guard: 'canRetry',
            actions: [
              'recordValidationError',
              ({ event, context }) => {
                syncLogger.warn('validation', `Validation failed, retrying (${context.retryCount + 1}/${context.maxRetries})`, {
                  error: event.error.message
                });
              }
            ]
          },
          {
            target: 'validation_failed',
            actions: [
              'recordValidationError',
              ({ event }) => {
                syncLogger.error('validation', 'Validation failed after max retries', {
                  error: event.error.message
                });
              }
            ]
          }
        ]
      },
      
      on: {
        CANCEL: {
          target: 'idle',
          actions: ['clearError']
        }
      }
    },
    
    validation_complete: {
      entry: [
        () => syncLogger.stateEntry('integrity:validation_complete', 'Validation completed successfully')
      ],
      
      always: [
        {
          target: 'resetting',
          guard: 'shouldResetAfterValidation',
          actions: [
            assign(({ context }) => ({
              resetReason: `Validation failed: ${context.lastValidationResult?.issues?.length || 0} issues found`,
              resetType: 'full_reset' as const
            })),
            () => syncLogger.info('validation', 'Validation result indicates reset required')
          ]
        },
        {
          target: 'idle',
          actions: [
            () => syncLogger.info('validation', 'Validation passed - returning to idle')
          ]
        }
      ]
    },
    
    validation_failed: {
      entry: [
        () => syncLogger.stateEntry('integrity:validation_failed', 'Validation failed')
      ],
      
      on: {
        RETRY: {
          target: 'validating',
          guard: 'canRetry',
          actions: ['clearError']
        },
        
        RESET: {
          target: 'resetting',
          actions: ['setResetReason', 'clearError']
        },
        
        CANCEL: {
          target: 'idle',
          actions: ['clearError']
        }
      },
      
      after: {
        5000: {
          target: 'idle',
          actions: [
            () => syncLogger.warn('validation', 'Validation failed - returning to idle after timeout')
          ]
        }
      }
    },
    
    resetting: {
      entry: [
        () => syncLogger.stateEntry('integrity:resetting', 'Performing integrity reset')
      ],
      
      invoke: {
        src: 'resetIntegrity',
        input: ({ context }) => ({
          serviceCoordinator: context.serviceCoordinator!,
          reason: context.resetReason!,
          resetType: context.resetType!,
          clientId: context.clientId
        }),
        
        onDone: {
          target: 'reset_complete',
          actions: [
            'recordResetResult',
            ({ event }) => {
              syncLogger.info('validation', 'Reset completed successfully', {
                resetType: event.output.result.resetType
              });
            }
          ]
        },
        
        onError: [
          {
            target: 'reset_failed',
            guard: 'canRetry',
            actions: [
              'recordResetError',
              ({ event, context }) => {
                syncLogger.warn('validation', `Reset failed, retrying (${context.retryCount + 1}/${context.maxRetries})`, {
                  error: event.error.message
                });
              }
            ]
          },
          {
            target: 'reset_failed',
            actions: [
              'recordResetError',
              ({ event }) => {
                syncLogger.error('validation', 'Reset failed after max retries', {
                  error: event.error.message
                });
              }
            ]
          }
        ]
      },
      
      on: {
        CANCEL: {
          target: 'idle',
          actions: ['clearError']
        }
      }
    },
    
    reset_complete: {
      entry: [
        () => syncLogger.stateEntry('integrity:reset_complete', 'Reset completed successfully')
      ],
      
      after: {
        1000: {
          target: 'idle',
          actions: [
            () => syncLogger.info('validation', 'Reset completed - returning to idle')
          ]
        }
      }
    },
    
    reset_failed: {
      entry: [
        () => syncLogger.stateEntry('integrity:reset_failed', 'Reset failed')
      ],
      
      on: {
        RETRY: {
          target: 'resetting',
          guard: 'canRetry',
          actions: ['clearError']
        },
        
        CANCEL: {
          target: 'idle',
          actions: ['clearError']
        }
      },
      
      after: {
        10000: {
          target: 'idle',
          actions: [
            () => syncLogger.warn('validation', 'Reset failed - returning to idle after timeout')
          ]
        }
      }
    }
  }
});