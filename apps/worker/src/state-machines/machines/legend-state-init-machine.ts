/**
 * Legend State Initialization Machine
 * 
 * Handles the sequential initialization of Legend State observables with proper loading states.
 * This machine is spawned by the auth machine after successful authentication and organization setup.
 * 
 * States:
 * - idle: Not yet started
 * - loadingSchemas: Fetching organization schemas via loadUniverseContext()
 * - initializingPersistence: Setting up IndexedDB and persistence layer
 * - creatingObservables: Creating entity observables for all schemas
 * - triggeringInitialLoad: Explicitly triggering initial data fetch for each entity
 * - ready: All observables created and data loading initiated
 * - error: Something failed, with retry capability
 */

import { setup, assign, fromPromise } from 'xstate'
import { loadUniverseContext, universeSchema$ } from '@/legend-state'
import { log } from '@/logger'

const fileLog = log('state-machines/machines/legend-state-init-machine.ts')

export interface LegendStateInitContext {
  // User/org info from auth
  userId: string | null
  organizationIds: string[]
  currentOrgId: string | null
  organizationData?: Array<{ id: string; name: string }>
  
  // Progress tracking
  currentStep: string
  totalSteps: number
  completedSteps: number
  
  // Schema loading
  schemasLoaded: boolean
  totalEntities: number
  
  // Observable creation
  observablesCreated: string[]
  failedObservables: string[]
  
  // Data loading
  entitiesTriggered: string[]
  entitiesLoaded: string[]
  entitiesWithData: { [entityName: string]: number }
  
  // Error handling
  error: string | null
  retryCount: number
  maxRetries: number
}

export type LegendStateInitEvent =
  | { type: 'START'; userId: string; organizationIds: string[]; currentOrgId?: string }
  | { type: 'START_UNIVERSE'; userId: string; organizationIds: string[] }
  | { type: 'START_SINGLE_ORG'; userId: string; orgId: string }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'SCHEMAS_LOADED'; entityCount: number }
  | { type: 'OBSERVABLE_CREATED'; entityName: string }
  | { type: 'OBSERVABLE_FAILED'; entityName: string; error: string }
  | { type: 'DATA_LOADED'; entityName: string; recordCount: number }
  | { type: 'STEP_PROGRESS'; step: string; completed: number; total: number }

// Schema loading service
const loadSchemasService = fromPromise(async ({ 
  input 
}: { 
  input: { 
    userId: string
    organizationIds: string[]
    currentOrgId?: string
    organizationData?: Array<{ id: string; name: string }>
  } 
}) => {
  const { userId, organizationIds, currentOrgId, organizationData } = input
  
  fileLog.info('[LegendStateInit] Loading universe schemas:', {
    userId,
    organizationIds,
    currentOrgId,
    hasOrgData: !!organizationData,
    orgDataReceived: organizationData  // Added debug output to see actual data
  })
  
  try {
    // Always load universe context with all organizations and their names
    await loadUniverseContext(userId, organizationIds, organizationData)
    
    // Get the loaded schema to count entities
    const schema = universeSchema$.peek()
    const entityCount = schema?.entities ? Object.keys(schema.entities).length : 0
    
    fileLog.info('[LegendStateInit] Universe schemas loaded successfully:', {
      entityCount,
      orgId: schema?.orgId
    })
    
    return { entityCount, schema }
    
  } catch (error) {
    fileLog.error('[LegendStateInit] Failed to load universe schemas:', error)
    throw error
  }
})

// Observable creation service
const createObservablesService = fromPromise(async ({ 
  input 
}: { 
  input: { 
    entityNames: string[]
  } 
}) => {
  const { entityNames } = input
  
  fileLog.info('[LegendStateInit] Creating observables for entities:', entityNames)
  
  const results = {
    created: [] as string[],
    failed: [] as { entityName: string; error: string }[]
  }
  
  // Import getEntity$ here to avoid circular dependencies
  const { getEntity$ } = await import('@/legend-state')
  
  for (const entityName of entityNames) {
    try {
      const observable = getEntity$(entityName)
      if (observable) {
        results.created.push(entityName)
        fileLog.info(`[LegendStateInit] ✅ Created observable for ${entityName}`)
      } else {
        results.failed.push({ entityName, error: 'Observable creation returned null' })
        fileLog.warn(`[LegendStateInit] ❌ Failed to create observable for ${entityName}`)
      }
    } catch (error) {
      results.failed.push({ 
        entityName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      fileLog.error(`[LegendStateInit] ❌ Error creating observable for ${entityName}:`, error)
    }
  }
  
  return results
})

// Initial data loading service
const triggerInitialLoadsService = fromPromise(async ({ 
  input 
}: { 
  input: { 
    entityNames: string[]
  } 
}) => {
  const { entityNames } = input
  
  fileLog.info('[LegendStateInit] Triggering initial loads for entities:', entityNames)
  
  const results = {
    triggered: [] as string[],
    loaded: [] as { entityName: string; recordCount: number }[]
  }
  
  // Import getEntity$ here to avoid circular dependencies
  const { getEntity$ } = await import('@/legend-state')
  
  // Don't trigger initial loads for ALL entities - let them load on-demand
  // This significantly improves initial page load performance
  // Each entity will load when first accessed via getEntity$().get()
  
  for (const entityName of entityNames) {
    try {
      const observable = getEntity$(entityName)
      if (observable) {
        // Just verify the observable exists, don't trigger data load
        results.triggered.push(entityName)
        results.loaded.push({ entityName, recordCount: 0 })
        
        fileLog.info(`[LegendStateInit] ✅ Observable ready for ${entityName} (on-demand loading enabled)`)
      }
    } catch (error) {
      fileLog.error(`[LegendStateInit] ❌ Error preparing observable for ${entityName}:`, error)
    }
  }
  
  return results
})

export const legendStateInitMachine = setup({
  types: {
    context: {} as LegendStateInitContext,
    events: {} as LegendStateInitEvent,
    input: {} as {
      userId: string
      organizationIds: string[]
    }
  },
  
  actors: {
    loadSchemas: loadSchemasService,
    createObservables: createObservablesService,
    triggerInitialLoads: triggerInitialLoadsService
  },
  
  actions: {
    setProgress: assign(({ context, event }) => {
      if (event.type === 'STEP_PROGRESS') {
        return {
          currentStep: event.step,
          completedSteps: event.completed,
          totalSteps: event.total
        }
      }
      return {}
    }),
    
    incrementProgress: assign(({ context }) => ({
      completedSteps: Math.min(context.completedSteps + 1, context.totalSteps)
    })),
    
    resetError: assign({
      error: null,
      retryCount: 0
    }),
    
    incrementRetry: assign(({ context }) => ({
      retryCount: context.retryCount + 1
    })),
    
    setError: assign(({ event }) => ({
      error: event.type === 'OBSERVABLE_FAILED' ? event.error : 'Initialization failed'
    })),
    
    dispatchProgressEvent: ({ context }) => {
      // Dispatch progress event for loading UI
      const progressPercent = context.totalSteps > 0 ? 
        Math.round((context.completedSteps / context.totalSteps) * 100) : 0
      
      window.dispatchEvent(new CustomEvent('legend-state:init-progress', {
        detail: {
          step: context.currentStep,
          progress: progressPercent,
          completed: context.completedSteps,
          total: context.totalSteps,
          entitiesLoaded: context.entitiesLoaded.length,
          totalEntities: context.totalEntities
        }
      }))
    },
    
    dispatchReadyEvent: ({ context }) => {
      fileLog.info('[LegendStateInit] ✅ Legend State initialization complete!', {
        totalEntities: context.totalEntities,
        entitiesLoaded: context.entitiesLoaded.length,
        entitiesWithData: Object.keys(context.entitiesWithData).length
      })
      
      window.dispatchEvent(new CustomEvent('legend-state:ready', {
        detail: {
          totalEntities: context.totalEntities,
          entitiesLoaded: context.entitiesLoaded,
          entitiesWithData: context.entitiesWithData,
          organizationIds: context.organizationIds
        }
      }))
    }
  },
  
  guards: {
    canRetry: ({ context }) => context.retryCount < context.maxRetries,
    hasEntities: ({ context }) => context.totalEntities > 0
  }
}).createMachine({
  id: 'legendStateInit',
  
  context: ({ input }) => ({
    userId: input?.userId || null,
    organizationIds: input?.organizationIds || [],
    currentOrgId: null, // Always null in universe mode
    organizationData: input?.organizationData || undefined,
    
    currentStep: 'idle',
    totalSteps: 4, // loadingSchemas, initializingPersistence, creatingObservables, triggeringInitialLoad
    completedSteps: 0,
    
    schemasLoaded: false,
    totalEntities: 0,
    
    observablesCreated: [],
    failedObservables: [],
    
    entitiesTriggered: [],
    entitiesLoaded: [],
    entitiesWithData: {},
    
    error: null,
    retryCount: 0,
    maxRetries: 3
  }),
  
  initial: 'idle',
  
  states: {
    idle: {
      entry: [
        ({ context }) => {
          if (context.userId && context.organizationIds.length > 0) {
            fileLog.info('[LegendStateInit] Machine initialized with input:', {
              userId: context.userId,
              organizationIds: context.organizationIds,
              universeMode: true
            });
          } else {
            fileLog.info('[LegendStateInit] Machine ready, waiting for START event');
          }
        },
        assign({
          currentStep: 'Loading universe schemas',
          completedSteps: 0
        }),
        'resetError',
        'dispatchProgressEvent'
      ],
      
      // Automatically transition to loadingSchemas after setup
      always: {
        target: 'loadingSchemas',
        guard: ({ context }) => !!context.userId && context.organizationIds.length > 0
      },
      
      on: {
        START: {
          target: 'loadingSchemas',
          actions: [
            assign(({ event }) => ({
              userId: event.userId,
              organizationIds: event.organizationIds,
              currentOrgId: event.currentOrgId || null,
              currentStep: 'Loading universe schemas',
              completedSteps: 0
            })),
            'resetError',
            'dispatchProgressEvent'
          ]
        },
        
        START_UNIVERSE: {
          target: 'loadingSchemas',
          actions: [
            assign(({ event }) => ({
              userId: event.userId,
              organizationIds: event.organizationIds,
              currentOrgId: null,
              currentStep: 'Loading universe schemas',
              completedSteps: 0
            })),
            'resetError',
            'dispatchProgressEvent'
          ]
        }
      }
    },
    
    loadingSchemas: {
      entry: () => fileLog.info('[LegendStateInit] 🔄 Loading organization schemas...'),
      
      invoke: {
        src: 'loadSchemas',
        input: ({ context }) => ({
          userId: context.userId!,
          organizationIds: context.organizationIds,
          currentOrgId: context.currentOrgId || undefined,
          organizationData: context.organizationData
        }),
        
        onDone: {
          target: 'creatingObservables',
          actions: [
            assign(({ event }) => ({
              schemasLoaded: true,
              totalEntities: event.output.entityCount,
              currentStep: 'Creating observables',
              completedSteps: 1
            })),
            'dispatchProgressEvent'
          ]
        },
        
        onError: {
          target: 'error',
          actions: [
            assign(({ event }) => ({
              error: `Schema loading failed: ${event.error?.message || 'Unknown error'}`,
              currentStep: 'Schema loading failed'
            })),
            'dispatchProgressEvent'
          ]
        }
      }
    },
    
    creatingObservables: {
      entry: ({ context }) => {
        fileLog.info(`[LegendStateInit] 🔄 Creating observables for ${context.totalEntities} entities...`)
      },
      
      always: [
        {
          guard: 'hasEntities',
          target: 'creatingObservablesProcess'
        },
        {
          // No entities - skip to ready
          target: 'ready',
          actions: [
            assign({
              currentStep: 'Ready (no entities)',
              completedSteps: 4
            }),
            'dispatchProgressEvent',
            'dispatchReadyEvent'
          ]
        }
      ]
    },
    
    creatingObservablesProcess: {
      invoke: {
        src: 'createObservables',
        input: ({ context }) => {
          // Get entity names from current schema
          const schema = universeSchema$.peek()
          const entityNames = schema?.entities ? Object.keys(schema.entities) : []
          return { entityNames }
        },
        
        onDone: {
          target: 'triggeringInitialLoad',
          actions: [
            assign(({ event }) => ({
              observablesCreated: event.output.created,
              failedObservables: event.output.failed.map(f => f.entityName),
              currentStep: 'Triggering initial data loads',
              completedSteps: 2
            })),
            'dispatchProgressEvent'
          ]
        },
        
        onError: {
          target: 'error',
          actions: [
            assign(({ event }) => ({
              error: `Observable creation failed: ${event.error?.message || 'Unknown error'}`,
              currentStep: 'Observable creation failed'
            })),
            'dispatchProgressEvent'
          ]
        }
      }
    },
    
    triggeringInitialLoad: {
      entry: ({ context }) => {
        fileLog.info(`[LegendStateInit] 🔄 Triggering initial loads for ${context.observablesCreated.length} observables...`)
      },
      
      invoke: {
        src: 'triggerInitialLoads',
        input: ({ context }) => ({
          entityNames: context.observablesCreated
        }),
        
        onDone: {
          target: 'ready',
          actions: [
            assign(({ event }) => ({
              entitiesTriggered: event.output.triggered,
              entitiesLoaded: event.output.loaded.map(l => l.entityName),
              entitiesWithData: event.output.loaded.reduce((acc, item) => {
                acc[item.entityName] = item.recordCount
                return acc
              }, {} as { [entityName: string]: number }),
              currentStep: 'Ready',
              completedSteps: 4
            })),
            'dispatchProgressEvent',
            'dispatchReadyEvent'
          ]
        },
        
        onError: {
          target: 'error',
          actions: [
            assign(({ event }) => ({
              error: `Initial load failed: ${event.error?.message || 'Unknown error'}`,
              currentStep: 'Initial load failed'
            })),
            'dispatchProgressEvent'
          ]
        }
      }
    },
    
    ready: {
      entry: ({ context }) => {
        fileLog.info('[LegendStateInit] ✅ All Legend State observables ready!', {
          entitiesLoaded: context.entitiesLoaded.length,
          totalEntities: context.totalEntities
        })
      },
      
      type: 'final'
    },
    
    error: {
      entry: ({ context }) => {
        fileLog.error(`[LegendStateInit] ❌ Error in ${context.currentStep}:`, context.error)
      },
      
      after: {
        // Auto-retry with exponential backoff
        2000: [
          {
            guard: 'canRetry',
            target: 'loadingSchemas',
            actions: [
              'incrementRetry',
              assign({
                currentStep: 'Retrying...',
                completedSteps: 0
              }),
              'dispatchProgressEvent'
            ]
          }
        ]
      },
      
      on: {
        RETRY: {
          target: 'loadingSchemas',
          actions: [
            'resetError',
            assign({
              currentStep: 'Retrying...',
              completedSteps: 0
            }),
            'dispatchProgressEvent'
          ]
        },
        
        RESET: {
          target: 'idle',
          actions: [
            assign({
              userId: null,
              organizationIds: [],
              currentOrgId: null,
              currentStep: 'idle',
              completedSteps: 0,
              schemasLoaded: false,
              totalEntities: 0,
              observablesCreated: [],
              failedObservables: [],
              entitiesTriggered: [],
              entitiesLoaded: [],
              entitiesWithData: {}
            }),
            'resetError'
          ]
        }
      }
    }
  }
})