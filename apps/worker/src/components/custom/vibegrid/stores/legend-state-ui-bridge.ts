/**
 * Legend State UI Bridge - Simplified
 * 
 * ELIMINATES data copying! This bridge only handles:
 * 1. UI state initialization (relationships, column setup)
 * 2. Reactive renderer updates when Legend State changes
 * 
 * NO MORE DATA DUPLICATION - data stays in Legend State
 */

import React from 'react';
import { observe } from '@legendapp/state';
import { getEntity$, universeSchema$, universeLoading$ } from '@/legend-state/observables';
import { uiLog } from '@/logger';

const log = uiLog('components/custom/vibegrid/stores/legend-state-ui-bridge.ts');

/**
 * Creates a simplified bridge that ONLY handles UI initialization and reactive updates
 * NO data copying - renderer reads directly from Legend State
 */
export function createLegendStateUIBridge(
  entityTableName: string,
  uiStore: any,          // Simplified UI store
  renderer: any,         // Unified renderer
  legendStateObservable?: any  // Optional pre-fetched observable
) {
  log.info(`🎨 UIBridge: Creating simplified bridge for ${entityTableName}`);
  
  let isInitialized = false;
  
  // Get the entity observable
  const entityObservable = legendStateObservable || getEntity$(entityTableName);
  
  if (!entityObservable) {
    log.warn(`🎨 UIBridge: No entity observable available for ${entityTableName}`);
    return { dispose: () => {} };
  }

  // Set up renderer integration
  if (renderer && typeof renderer.setLegendStateIntegration === 'function') {
    renderer.setLegendStateIntegration(entityTableName, entityObservable, uiStore);
    log.info(`🎨 UIBridge: Configured renderer with Legend State integration`);
  }

  // ====================================
  // REACTIVE RENDERER UPDATES
  // ====================================
  
  /**
   * Observe Legend State changes and trigger renderer updates
   * NO data copying - just trigger re-render
   */
  const dataChangeDisposer = observe(() => {
    try {
      const currentData = entityObservable.get();
      
      if (!currentData) {
        log.info(`🎨 UIBridge: No data available for ${entityTableName} yet`);
        return;
      }
      
      const recordCount = typeof currentData === 'object' ? Object.keys(currentData).length : 0;
      
      log.info(`🎨 UIBridge: Data changed for ${entityTableName}`, {
        recordCount,
        isInitialized
      });
      
      // Trigger renderer update - NO data copying
      // Renderer will read data directly from Legend State
      if (renderer && typeof renderer.render === 'function') {
        // Create minimal state object with just UI configuration
        const uiState = uiStore?.getSnapshot();
        const minimalState = {
          columns: uiState?.context.columns || [],
          columnVisibility: uiState?.context.columnVisibility || {},
          sortBy: uiState?.context.sortBy || [],
          filters: uiState?.context.filters || [],
          // NO rows, entities, processedRows - renderer gets data from Legend State
          version: Date.now() // Force update
        };
        
        renderer.render(minimalState);
      }
      
      if (!isInitialized) {
        // Initialize UI store with relationships if needed
        if (uiStore && typeof uiStore.send === 'function') {
          uiStore.send({
            type: 'initialize'
          });
        }
        
        isInitialized = true;
        log.info(`🎨 UIBridge: Initialized for ${entityTableName}`);
      }
      
    } catch (error) {
      log.error(`🎨 UIBridge: Error in data change observer for ${entityTableName}:`, error);
    }
  });

  // ====================================
  // UI STATE CHANGES
  // ====================================
  
  /**
   * Observe UI store changes and trigger renderer updates
   * This handles column visibility, sorting, filtering changes
   */
  let uiChangeDisposer: (() => void) | null = null;
  
  if (uiStore) {
    const observeUIChanges = () => {
      const uiState = uiStore.getSnapshot();
      
      log.info(`🎨 UIBridge: UI state changed for ${entityTableName}`, {
        sortBy: uiState.context.sortBy?.length || 0,
        filters: uiState.context.filters?.length || 0,
        hiddenColumns: uiState.context.hiddenColumnCount || 0
      });
      
      // Trigger renderer update with new UI state
      if (renderer && typeof renderer.render === 'function') {
        const minimalState = {
          columns: uiState.context.columns || [],
          columnVisibility: uiState.context.columnVisibility || {},
          sortBy: uiState.context.sortBy || [],
          filters: uiState.context.filters || [],
          version: Date.now()
        };
        
        renderer.render(minimalState);
      }
    };
    
    // Subscribe to UI store changes
    if (typeof uiStore.subscribe === 'function') {
      uiChangeDisposer = uiStore.subscribe(observeUIChanges);
    }
  }

  // ====================================
  // CLEANUP
  // ====================================
  
  const dispose = () => {
    log.info(`🎨 UIBridge: Disposing bridge for ${entityTableName}`);
    
    if (dataChangeDisposer) {
      dataChangeDisposer();
    }
    
    if (uiChangeDisposer) {
      uiChangeDisposer();
    }
  };

  return {
    dispose,
    
    // Debug helpers
    getDebugInfo: () => ({
      entityTableName,
      isInitialized,
      hasRenderer: !!renderer,
      hasUIStore: !!uiStore,
      hasEntityObservable: !!entityObservable
    })
  };
}

/**
 * Legacy bridge replacement - just returns the new simplified bridge
 */
export function createAtomicObservableBridge(
  entityTableName: string, 
  tableSend: (event: any) => void,
  // New parameters for unified architecture
  uiStore?: any,
  renderer?: any,
  legendStateObservable?: any
) {
  log.info(`🔄 Bridge: Creating unified bridge (legacy compatibility) for ${entityTableName}`);
  
  // If we have the new parameters, use the new bridge
  if (uiStore && renderer) {
    return createLegendStateUIBridge(entityTableName, uiStore, renderer, legendStateObservable);
  }
  
  // Otherwise, create a minimal bridge that just handles initialization
  return {
    dispose: () => {},
    getDebugInfo: () => ({
      entityTableName,
      isLegacy: true,
      message: 'Use createLegendStateUIBridge for new unified architecture'
    })
  };
}