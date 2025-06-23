import { setup, assign, fromPromise, sendParent } from 'xstate';

// ============================================================================
// Service Registry Pattern (matching sync machine v2)
// ============================================================================

// 🔥 AUTH-AWARE CLEANUP: Automatically destroy live changes services when user signs out
let authCleanupInitialized = false;

export const initializeAuthAwareLiveChangesCleanup = () => {
  if (authCleanupInitialized) return;
  authCleanupInitialized = true;

  console.log('[LiveChangesMachine] 🔐 Initializing auth-aware live changes cleanup...');
  
  const authActor = (window as any).authMachineActor;
  if (!authActor) {
    console.warn('[LiveChangesMachine] AuthMachine actor not available for cleanup subscription');
    return;
  }

  // Subscribe to auth state changes
  const subscription = authActor.subscribe((snapshot: any) => {
    const isAuthenticated = snapshot.matches('authenticated');
    const isSigningOut = snapshot.matches('signingOut');
    
    console.log('[LiveChangesMachine] 🔐 Auth state change:', { 
      state: snapshot.value, 
      isAuthenticated, 
      isSigningOut
    });
    
    // If user is signing out or no longer authenticated, send SIGNOUT to live changes machine
    if (isSigningOut || !isAuthenticated) {
      console.log('[LiveChangesMachine] 🔐 User signed out, sending SIGNOUT to live changes machine');
      
      // Find and send SIGNOUT to live changes machine
      const orchestratorActor = (window as any).orchestratorV2Actor;
      if (orchestratorActor) {
        const orchestratorSnapshot = orchestratorActor.getSnapshot();
        const appInitMachine = orchestratorSnapshot?.children?.appInitMachine;
        if (appInitMachine) {
          const appInitSnapshot = appInitMachine.getSnapshot();
          const liveChangesMachine = appInitSnapshot?.children?.liveChangesMachine;
          if (liveChangesMachine) {
            console.log('[LiveChangesMachine] 🔐 Sending SIGNOUT to live changes machine');
            liveChangesMachine.send({ type: 'SIGNOUT' });
          }
        }
      }
    }
  });

  // Store subscription for cleanup
  (window as any).liveChangesAuthSubscription = subscription;
};

// Initialize auth cleanup when module loads
if (typeof window !== 'undefined') {
  // Delay to ensure auth machine is available
  setTimeout(() => {
    initializeAuthAwareLiveChangesCleanup();
  }, 100);
}

const liveChangesServiceRegistry = new Map<string, {
  liveChangesManager: any | null;
}>();

const getLiveChangesServices = (context: LiveChangesContext) => {
  if (!context.serviceRegistryKey) return null;
  return liveChangesServiceRegistry.get(context.serviceRegistryKey) || null;
};

const setLiveChangesServices = (context: LiveChangesContext, services: {
  liveChangesManager: any | null;
}) => {
  if (!context.serviceRegistryKey) {
    context.serviceRegistryKey = `live_changes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  liveChangesServiceRegistry.set(context.serviceRegistryKey, services);
};

export interface LiveChangesContext {
  // Service registry key instead of direct service instances
  serviceRegistryKey: string | null;
  
  isActive: boolean;
  entities: string[];
  lastChangeTime: number | null;
  error: string | null;
  isPaused: boolean;
  processingStats: {
    changesProcessed: number;
    lastProcessedAt: number | null;
    throughputPerSec: number;
  };
}

export type LiveChangesEvent =
  | { type: 'START'; entities: string[] }
  | { type: 'STOP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CHANGE_RECEIVED'; entityType: string; changeType: 'INSERT' | 'UPDATE' | 'DELETE'; data: any }
  | { type: 'PROCESSING_COMPLETE'; count: number }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'CLEANUP_SERVICES' }
  | { type: 'SIGNOUT' };

export const liveChangesMachine = setup({
  types: {
    context: {} as LiveChangesContext,
    events: {} as LiveChangesEvent,
  },
  actors: {
    initializeLiveChanges: fromPromise(async ({ input }: { input: { entities: string[]; serviceRegistryKey: string } }) => {
      try {
        console.log(`[LiveChangesMachine] Initializing live changes for ${input.entities.length} entities`);
        
        // Import live changes manager (using singleton pattern)
        const { liveChangesManager } = await import('@/lib/live-changes-manager');
        const { getLiveChangesEntities } = await import('@/lib/live-changes-config');
        
        const entityConfigs = await getLiveChangesEntities();
        
        const { getGlobalDataSource } = await import('@/db/global-datasource');
        const dataSource = await getGlobalDataSource();
        
        // Store services in registry to avoid serialization issues
        setLiveChangesServices({ serviceRegistryKey: input.serviceRegistryKey } as LiveChangesContext, {
          liveChangesManager
        });
        
        await liveChangesManager.initialize(entityConfigs, dataSource);
        
        console.log(`[LiveChangesMachine] ✅ Live changes initialization complete - returning success`);
        return { active: true, entities: input.entities };
      } catch (error) {
        console.error(`[LiveChangesMachine] ❌ Live changes initialization failed:`, error);
        throw error;
      }
    }),
    
    processChange: fromPromise(async ({ input }: { 
      input: { entityType: string; changeType: string; data: any } 
    }) => {
      // Process individual change - this would typically be handled
      // by the live changes manager, but we can track metrics here
      console.log(`[LiveChangesMachine] Processing ${input.changeType} for ${input.entityType}`);
      
      // Simulate processing time for metrics
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return { processed: true, entityType: input.entityType };
    }),
    
    cleanupServices: fromPromise(async ({ input }: { input: { serviceRegistryKey: string } }) => {
      try {
        console.log('[LiveChangesMachine] Cleaning up services...');
        
        const services = getLiveChangesServices({ serviceRegistryKey: input.serviceRegistryKey } as LiveChangesContext);
        if (services?.liveChangesManager) {
          await services.liveChangesManager.stop();
        }
        
        // Remove from registry
        if (input.serviceRegistryKey) {
          liveChangesServiceRegistry.delete(input.serviceRegistryKey);
        }
        
        console.log('[LiveChangesMachine] ✅ Services cleaned up successfully');
        return { cleaned: true };
      } catch (error) {
        console.error('[LiveChangesMachine] ❌ Service cleanup failed:', error);
        throw error;
      }
    })
  },
  
  guards: {
    canStart: ({ context }) => !context.isActive,
    isActive: ({ context }) => context.isActive,
    isPaused: ({ context }) => context.isPaused,
    hasError: ({ context }) => !!context.error,
    hasServices: ({ context }) => {
      const services = getLiveChangesServices(context);
      return !!services?.liveChangesManager;
    },
  },
  
  actions: {
    initializeContext: assign({
      serviceRegistryKey: () => `live_changes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entities: ({ event }) => 
        event.type === 'START' ? event.entities : [],
      error: null,
      isActive: false,
      isPaused: false,
    }),
    
    markActive: assign({
      isActive: true,
      error: null,
    }),
    
    markInactive: assign({
      isActive: false,
      isPaused: false,
    }),
    
    pause: assign({
      isPaused: true,
    }),
    
    resume: assign({
      isPaused: false,
    }),
    
    pauseServices: ({ context }) => {
      const services = getLiveChangesServices(context);
      if (services?.liveChangesManager) {
        services.liveChangesManager.pause();
      }
    },
    
    resumeServices: ({ context }) => {
      const services = getLiveChangesServices(context);
      if (services?.liveChangesManager) {
        services.liveChangesManager.resume();
      }
    },
    
    recordChange: assign({
      lastChangeTime: () => Date.now(),
      processingStats: ({ context }) => ({
        ...context.processingStats,
        changesProcessed: context.processingStats.changesProcessed + 1,
        lastProcessedAt: Date.now(),
      }),
    }),
    
    updateThroughput: assign({
      processingStats: ({ context, event }) => {
        if (event.type !== 'PROCESSING_COMPLETE') return context.processingStats;
        
        const now = Date.now();
        const timeDiff = context.processingStats.lastProcessedAt 
          ? now - context.processingStats.lastProcessedAt 
          : 1000;
        
        const throughput = timeDiff > 0 ? (event.count / timeDiff) * 1000 : 0;
        
        return {
          ...context.processingStats,
          throughputPerSec: throughput,
          lastProcessedAt: now,
        };
      },
    }),
    
    storeError: assign({
      error: ({ event }) => 
        event.type === 'ERROR' ? event.error : null,
      isActive: false,
    }),
    
    reset: assign({
      isActive: false,
      entities: [],
      lastChangeTime: null,
      error: null,
      isPaused: false,
      processingStats: {
        changesProcessed: 0,
        lastProcessedAt: null,
        throughputPerSec: 0,
      },
    }),
    
    cleanupServicesAction: ({ context }) => {
      console.log('[LiveChangesMachine] Cleaning up services...');
      
      const services = getLiveChangesServices(context);
      if (services?.liveChangesManager) {
        services.liveChangesManager.stop().catch((error: any) => {
          console.error('[LiveChangesMachine] Error stopping live changes manager:', error);
        });
        
        // Remove from registry
        if (context.serviceRegistryKey) {
          liveChangesServiceRegistry.delete(context.serviceRegistryKey);
        }
      }
    },
    
    logParentNotification: () => console.log('[LiveChangesMachine] 🔥 Notifying parent: LIVE_CHANGES_ACTIVE'),
    notifyParentActive: sendParent({ type: 'LIVE_CHANGES_ACTIVE' }),
    notifyParentInactive: sendParent({ type: 'LIVE_CHANGES_INACTIVE' }),
    notifyParentError: sendParent(({ context }) => ({ 
      type: 'LIVE_CHANGES_ERROR', 
      error: context.error 
    })),
  }
}).createMachine({
  id: 'liveChanges',
  initial: 'inactive',
  context: {
    serviceRegistryKey: null,
    isActive: false,
    entities: [],
    lastChangeTime: null,
    error: null,
    isPaused: false,
    processingStats: {
      changesProcessed: 0,
      lastProcessedAt: null,
      throughputPerSec: 0,
    },
  },
  
  states: {
    inactive: {
      entry: 'markInactive',
      on: {
        START: {
          target: 'starting',
          actions: 'initializeContext'
        }
      }
    },
    
    starting: {
      entry: () => console.log('[LiveChangesMachine] Entering starting state'),
      invoke: {
        src: 'initializeLiveChanges',
        input: ({ context, event }) => ({
          entities: event.type === 'START' ? event.entities : [],
          serviceRegistryKey: context.serviceRegistryKey!
        }),
        onDone: {
          target: 'active',
          actions: [
            () => console.log('[LiveChangesMachine] ✅ Initialization successful - transitioning to active'),
            'markActive', 
            'logParentNotification',
            'notifyParentActive'
          ]
        },
        onError: {
          target: 'error',
          actions: [
            ({ event }) => console.error('[LiveChangesMachine] ❌ Initialization failed:', event.error),
            'storeError', 
            'notifyParentError'
          ]
        }
      }
    },
    
    active: {
      entry: [
        () => console.log('[LiveChangesMachine] ✅ Entering active state'),
        'markActive'
      ],
      
      on: {
        STOP: {
          target: 'stopping',
          actions: 'cleanupServicesAction'
        },
        SIGNOUT: {
          target: 'stopping',
          actions: [
            () => console.log('[LiveChangesMachine] 🔐 SIGNOUT received in active state - cleaning up'),
            'cleanupServicesAction'
          ]
        },
        PAUSE: {
          target: 'paused',
          actions: ['pause', 'pauseServices']
        },
        ERROR: {
          target: 'error',
          actions: ['storeError', 'notifyParentError']
        },
        
        CHANGE_RECEIVED: [
          {
            target: 'processing',
            guard: ({ context }) => !context.isPaused,
            actions: 'recordChange'
          }
          // If paused, ignore changes
        ],
        
        PROCESSING_COMPLETE: {
          actions: 'updateThroughput'
        }
      }
    },
    
    processing: {
      invoke: {
        src: 'processChange',
        input: ({ event }) => ({
          entityType: event.type === 'CHANGE_RECEIVED' ? event.entityType : '',
          changeType: event.type === 'CHANGE_RECEIVED' ? event.changeType : '',
          data: event.type === 'CHANGE_RECEIVED' ? event.data : null,
        }),
        onDone: {
          target: 'active',
          actions: 'updateThroughput'
        },
        onError: {
          target: 'active', // Continue processing even if individual change fails
          actions: 'recordChange'
        }
      }
    },
    
    paused: {
      entry: ['pause', 'pauseServices'],
      on: {
        RESUME: {
          target: 'active',
          actions: ['resume', 'resumeServices']
        },
        STOP: {
          target: 'stopping',
          actions: 'cleanupServicesAction'
        },
        SIGNOUT: {
          target: 'stopping',
          actions: [
            () => console.log('[LiveChangesMachine] 🔐 SIGNOUT received in paused state - cleaning up'),
            'cleanupServicesAction'
          ]
        }
      }
    },
    
    stopping: {
      entry: () => console.log('[LiveChangesMachine] Stopping and cleaning up services...'),
      invoke: {
        src: 'cleanupServices',
        input: ({ context }) => ({
          serviceRegistryKey: context.serviceRegistryKey!
        }),
        onDone: {
          target: 'inactive',
          actions: [
            () => console.log('[LiveChangesMachine] ✅ Services cleaned up, transitioning to inactive'),
            'markInactive',
            'notifyParentInactive'
          ]
        },
        onError: {
          target: 'inactive', // Still transition to inactive even if cleanup fails
          actions: [
            ({ event }) => console.error('[LiveChangesMachine] ❌ Service cleanup failed:', event.error),
            'markInactive',
            'notifyParentInactive'
          ]
        }
      }
    },
    
    error: {
      entry: ['notifyParentError', 'cleanupServicesAction'],
      on: {
        START: {
          target: 'starting',
          actions: 'initializeContext'
        },
        RESET: {
          target: 'inactive',
          actions: ['reset', 'cleanupServicesAction']
        }
      }
    }
  }
}); 