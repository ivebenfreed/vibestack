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
    initializationActions.setLoading(true, 'Loading universe schemas');
    initializationActions.setProgress(10);

    // Actually load the universe context - this is what the XState machine was doing
    const { loadUniverseContext } = await import('@/legend-state/observables');
    await loadUniverseContext(userId, organizationIds, organizationData);
    
    // Now check the loaded schema
    const { universeSchema$ } = await import('@/legend-state');
    const schema = universeSchema$.peek();
    const entityCount = schema?.entities ? Object.keys(schema.entities).length : 0;
    
    initLog.info('[LegendStateInit] Universe schemas ready:', { entityCount });
    
    initializationActions.setProgress(50, 0, entityCount);
    initializationActions.setLoading(true, 'Creating observables');
    
    // Observables are created on-demand, so we just mark as ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
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