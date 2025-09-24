/**
 * Simple Legend State Initialization
 * 
 * Replaces the complex XState init machine with a simple observable-based system.
 * This leverages the existing reactive universe context loading in auth.ts
 */

import { observable } from '@legendapp/state';
import { log } from '@/logger';

const initLog = log('legend-state/initialization');

// Simple initialization state observable
export interface LegendStateInitState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  step: string;
  progress: number;
  entitiesReady: number;
  totalEntities: number;
}

export const legendStateInit$ = observable<LegendStateInitState>({
  isInitialized: false,
  isLoading: false,
  error: null,
  step: 'idle',
  progress: 0,
  entitiesReady: 0,
  totalEntities: 0
});

// Simple initialization functions
export const initializationActions = {
  setLoading: (loading: boolean, step?: string) => {
    legendStateInit$.isLoading.set(loading);
    if (step) legendStateInit$.step.set(step);
  },

  setProgress: (progress: number, entitiesReady?: number, totalEntities?: number) => {
    legendStateInit$.progress.set(progress);
    if (entitiesReady !== undefined) legendStateInit$.entitiesReady.set(entitiesReady);
    if (totalEntities !== undefined) legendStateInit$.totalEntities.set(totalEntities);
  },

  setError: (error: string | null) => {
    legendStateInit$.error.set(error);
    legendStateInit$.isLoading.set(false);
  },

  setInitialized: (initialized: boolean) => {
    legendStateInit$.isInitialized.set(initialized);
    legendStateInit$.isLoading.set(false);
    if (initialized) {
      legendStateInit$.progress.set(100);
      legendStateInit$.step.set('ready');
      legendStateInit$.error.set(null);
      
      initLog.info('[LegendStateInit] ✅ Initialization complete!', {
        entitiesReady: legendStateInit$.entitiesReady.peek(),
        totalEntities: legendStateInit$.totalEntities.peek()
      });
      
      // Dispatch ready event for any UI that needs it
      window.dispatchEvent(new CustomEvent('legend-state:ready', {
        detail: {
          entitiesReady: legendStateInit$.entitiesReady.peek(),
          totalEntities: legendStateInit$.totalEntities.peek()
        }
      }));
    }
  },

  reset: () => {
    legendStateInit$.assign({
      isInitialized: false,
      isLoading: false,
      error: null,
      step: 'idle',
      progress: 0,
      entitiesReady: 0,
      totalEntities: 0
    });
  }
};

/**
 * Simple hook for components to track initialization state
 */
export function useLegendStateInit() {
  return {
    isInitialized: legendStateInit$.isInitialized,
    isLoading: legendStateInit$.isLoading,
    error: legendStateInit$.error,
    step: legendStateInit$.step,
    progress: legendStateInit$.progress,
    entitiesReady: legendStateInit$.entitiesReady,
    totalEntities: legendStateInit$.totalEntities,
    
    // Actions
    ...initializationActions
  };
}

/**
 * Simple initialization function that replaces the XState machine
 * This is called automatically by the reactive effect in auth.ts
 */
export async function initializeLegendState(
  userId: string, 
  organizationIds: string[], 
  organizationData?: Array<{ id: string; name: string }>
): Promise<void> {
  initLog.info('[LegendStateInit] Starting simplified initialization:', {
    userId,
    organizationIds,
    hasOrgData: !!organizationData
  });

  try {
    initializationActions.setLoading(true, 'Setting up persistence');
    initializationActions.setProgress(10);

    // Persistence is now initialized internally within loadUniverseContext
    // This ensures proper dependency ordering without race conditions

    initializationActions.setProgress(30);
    initializationActions.setLoading(true, 'Loading universe schemas');

    // Now load the universe context - entities will be created with persistence
    const { loadUniverseContext } = await import('@/legend-state/observables');
    await loadUniverseContext(userId, organizationIds, organizationData);
    
    // Reactively wait for schema to be properly loaded instead of timing hack
    const { universeSchema$ } = await import('@/legend-state');
    const { when } = await import('@legendapp/state');
    
    // Wait for schema object to exist (not necessarily with entities - some orgs have 0 entities)
    await when(() => {
      const schema = universeSchema$.peek();
      initLog.info('[LegendStateInit] Checking schema readiness:', { 
        hasSchema: !!schema,
        hasEntities: !!(schema?.entities),
        entityCount: schema?.entities ? Object.keys(schema.entities).length : 0
      });
      return !!schema; // Wait until we have schema object (entities may be empty)
    });
    
    // Get the final entity count (may be 0 for some organizations)
    const schema = universeSchema$.peek();
    const entityCount = schema?.entities ? Object.keys(schema.entities).length : 0;
    
    initLog.info('[LegendStateInit] Universe schemas ready:', { entityCount });
    
    initializationActions.setProgress(70, entityCount, entityCount);
    initializationActions.setLoading(true, 'Connecting sync');
    
    // 🔄 SYNC: Connect sync manager when Legend State is ready
    const primaryOrgId = organizationIds[0];
    if (primaryOrgId) {
      await connectSyncManager(primaryOrgId, userId);
    }
    
    initializationActions.setProgress(90, entityCount, entityCount);
    initializationActions.setLoading(true, 'Finalizing initialization');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    initializationActions.setInitialized(true);
    
  } catch (error) {
    initLog.error('[LegendStateInit] Initialization failed:', error);
    initializationActions.setError(
      error instanceof Error ? error.message : 'Initialization failed'
    );
  }
}

/**
 * Helper function to connect sync manager from Legend State initialization
 */
async function connectSyncManager(organizationId: string, userId: string): Promise<void> {
  initLog.info('🔄 [Sync] Connecting sync manager from Legend State initialization:', { 
    organizationId, 
    userId 
  });
  
  try {
    // Import the sync manager dynamically to avoid circular dependencies
    const { syncActions } = await import('./sync-manager');
    
    // Connect using the reactive sync manager
    await syncActions.connect(organizationId, userId);
    
    initLog.info('✅ [Sync] Sync manager connected successfully');
    
  } catch (error) {
    initLog.error('❌ [Sync] Failed to connect sync manager:', error);
    // Don't throw - sync connection failure shouldn't break Legend State init
  }
}