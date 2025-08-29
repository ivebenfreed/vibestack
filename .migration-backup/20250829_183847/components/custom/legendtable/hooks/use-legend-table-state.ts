import { useMemo, useEffect } from 'react';
import { observe } from '@legendapp/state';
import { createTableState, type TableState } from '../state/table-state';
import type { TableConfig } from '../types';

export function useLegendTableState(config: TableConfig): TableState {
  // Create table state only once, memoized by tableId
  const tableState$ = useMemo(() => {
    console.log('[useLegendTableState] Creating table state for:', config.tableId);
    return createTableState(config);
  }, [config.tableId]);
  
  // Auto-save state changes to localStorage if persistence is enabled
  useEffect(() => {
    if (!config.persistState) return;
    
    console.log('[useLegendTableState] Setting up persistence for:', config.tableId);
    
    // Debounced save function to avoid excessive localStorage writes
    let saveTimeout: NodeJS.Timeout;
    
    const cleanup = observe(() => {
      // Get state to save (exclude functions and non-serializable data)
      const state = {
        viewport: tableState$.viewport.get(),
        sorting: tableState$.sorting.get(),
        filters: Array.from(tableState$.filters.get().entries()), // Convert Map to array
        searchTerm: tableState$.searchTerm.get(),
        settings: tableState$.settings.get()
      };
      
      // Debounced save to localStorage
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        try {
          const key = `legend-table-${config.tableId}`;
          localStorage.setItem(key, JSON.stringify(state));
          console.log('[useLegendTableState] State saved to localStorage:', key);
        } catch (error) {
          console.warn('[useLegendTableState] Failed to save state:', error);
        }
      }, 500);
    });
    
    return () => {
      clearTimeout(saveTimeout);
      cleanup();
    };
  }, [config.tableId, config.persistState, tableState$]);
  
  // Restore state from localStorage on mount
  useEffect(() => {
    if (!config.persistState) return;
    
    try {
      const key = `legend-table-${config.tableId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const state = JSON.parse(saved);
        console.log('[useLegendTableState] Restoring state from localStorage:', key, state);
        
        // Restore state
        if (state.viewport) {
          tableState$.viewport.assign(state.viewport);
        }
        if (state.sorting) {
          tableState$.sorting.assign(state.sorting);
        }
        if (state.filters && Array.isArray(state.filters)) {
          // Convert array back to Map
          tableState$.filters.set(new Map(state.filters));
        }
        if (state.searchTerm) {
          tableState$.searchTerm.set(state.searchTerm);
        }
        if (state.settings) {
          tableState$.settings.assign(state.settings);
        }
      }
    } catch (error) {
      console.warn('[useLegendTableState] Failed to restore state:', error);
    }
  }, [config.tableId, config.persistState, tableState$]);
  
  return tableState$;
}