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
  
  // Helper function to send data for grouping
  const sendDataForGrouping = () => {
    const currentData = entityObservable.get();
    if (currentData && typeof currentData === 'object') {
      const entities = Object.values(currentData);
      const rows = entities.map((entity: any) => ({
        id: entity.id,
        data: entity
      }));
      
      log.info(`🎨 UIBridge: Sending data for grouping`, {
        entityCount: entities.length,
        entityTableName
      });
      
      if (typeof (window as any).__vibegrid_send_data_to_table_machine === 'function') {
        (window as any).__vibegrid_send_data_to_table_machine({
          type: 'PROCESS_GROUPS_WITH_DATA',
          entities: entities,
          rows: rows,
          loading: false,
          source: 'legend_state_for_grouping_custom_event'
        });
      }
    }
  };
  
  // Listen for custom event from group handlers
  const handleGroupingDataRequest = (event: CustomEvent) => {
    log.info(`🎨 UIBridge: Received grouping data request for ${entityTableName}`, event.detail);
    sendDataForGrouping();
  };
  
  window.addEventListener('vibegrid-request-grouping-data', handleGroupingDataRequest);

  // ====================================
  // REACTIVE RENDERER UPDATES
  // ====================================
  
  /**
   * Observe Legend State changes and trigger renderer updates
   * Handles both direct rendering and table machine integration for grouping
   */
  const dataChangeDisposer = observe(() => {
    try {
      const currentData = entityObservable.get();
      
      if (!currentData) {
        log.info(`🎨 UIBridge: No data available for ${entityTableName} yet`);
        return;
      }
      
      const recordCount = typeof currentData === 'object' ? Object.keys(currentData).length : 0;
      const uiState = uiStore?.getSnapshot();
      const hasGrouping = uiState?.context?.groupConfig && uiState.context.groupConfig.fields && uiState.context.groupConfig.fields.length > 0;
      
      log.info(`🎨 UIBridge: Data changed for ${entityTableName}`, {
        recordCount,
        isInitialized,
        hasGrouping
      });
      
      // HYBRID APPROACH: Direct rendering for flat data, table machine for grouping
      if (hasGrouping) {
        // For grouping, send data directly to PROCESS_GROUPS event to avoid race conditions
        log.info(`🎨 UIBridge: Grouping enabled, sending data directly to GroupProcessor`);
        
        // Convert Legend State data to rows format for GroupProcessor
        const entities = Object.values(currentData);
        const rows = entities.map((entity: any) => ({
          id: entity.id,
          data: entity
        }));
        
        // Send data directly with PROCESS_GROUPS event to ensure data is available
        if (typeof (window as any).__vibegrid_send_data_to_table_machine === 'function') {
          (window as any).__vibegrid_send_data_to_table_machine({
            type: 'PROCESS_GROUPS_WITH_DATA',
            entities: entities,
            rows: rows,
            loading: false,
            source: 'legend_state_for_grouping'
          });
        }
      }
      
      // Always trigger renderer update for direct rendering path
      if (renderer && typeof renderer.render === 'function') {
        // Create minimal state object with just UI configuration
        const minimalState = {
          columns: uiState?.context.columns || [],
          columnVisibility: uiState?.context.columnVisibility || {},
          sortBy: uiState?.context.sortBy || [],
          filters: uiState?.context.filters || [],
          // NO rows for flat rendering - renderer gets data from Legend State
          // For grouping, rows will come through table machine after GroupProcessor
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
      const hasGrouping = uiState?.context?.groupConfig && uiState.context.groupConfig.fields && uiState.context.groupConfig.fields.length > 0;
      
      log.info(`🎨 UIBridge: UI state changed for ${entityTableName}`, {
        sortBy: uiState.context.sortBy?.length || 0,
        filters: uiState.context.filters?.length || 0,
        hiddenColumns: uiState.context.hiddenColumnCount || 0,
        hasGrouping
      });
      
      // HYBRID APPROACH: Check if grouping was enabled and we need to send data to table machine
      if (hasGrouping) {
        const currentData = entityObservable.get();
        if (currentData) {
          log.info(`🎨 UIBridge: Grouping enabled via UI change, sending data directly to GroupProcessor`);
          
          // Convert Legend State data to rows format for GroupProcessor
          const entities = Object.values(currentData);
          const rows = entities.map((entity: any) => ({
            id: entity.id,
            data: entity
          }));
          
          // Send data directly with PROCESS_GROUPS event to ensure data is available
          if (typeof (window as any).__vibegrid_send_data_to_table_machine === 'function') {
            (window as any).__vibegrid_send_data_to_table_machine({
              type: 'PROCESS_GROUPS_WITH_DATA',
              entities: entities,
              rows: rows,
              loading: false,
              source: 'legend_state_for_grouping_ui_change'
            });
          }
        }
      }
      
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
    
    // Clean up event listener
    window.removeEventListener('vibegrid-request-grouping-data', handleGroupingDataRequest);
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