/**
 * Reactive Bridge - Connects Unified Table State to XState and Renderer
 * 
 * This replaces the complex legend-state-ui-bridge.ts with a simple reactive connection:
 * - XState events update the observable state
 * - Renderer observes the computed view
 * - No data copying, no window functions, just reactive flow
 */

import { observe, batch } from '@legendapp/state';
import { createTableState$, tableStateUpdaters, connectRendererToState } from './unified-table-state';
import { uiLog } from '@/logger';
import type { Column } from '../types';

const log = uiLog('components/custom/vibegrid/stores/reactive-bridge.ts');

export interface ReactiveBridgeConfig {
  entityType: string;
  columns: Column[];
  renderer: any;
  tableSend?: (event: any) => void;
  initialState?: any;
}

/**
 * Create a reactive bridge that connects everything with observables
 */
export function createReactiveBridge(config: ReactiveBridgeConfig) {
  const { entityType, columns, renderer, tableSend, initialState } = config;
  
  log.info('🌉 ReactiveBridge: Creating reactive bridge', {
    entityType,
    columnCount: columns.length,
    hasRenderer: !!renderer
  });
  
  // ====================================
  // 1. CREATE UNIFIED TABLE STATE
  // ====================================
  
  const tableState$ = createTableState$(entityType, columns, initialState);
  
  // ====================================
  // 2. CONNECT RENDERER TO STATE
  // ====================================
  
  let rendererDisposer: (() => void) | null = null;
  
  if (renderer) {
    // Give renderer direct access to the observable state
    if (typeof renderer.setTableState === 'function') {
      renderer.setTableState(tableState$);
    }
    
    // Connect renderer to observe the computed view
    rendererDisposer = connectRendererToState(renderer, tableState$);
    log.info('🌉 ReactiveBridge: Renderer connected to reactive state');
  }
  
  // ====================================
  // 3. CREATE EVENT HANDLERS FOR XSTATE
  // ====================================
  
  const eventHandlers = {
    // Sorting
    'view.sort.toggle': (event: any) => {
      tableStateUpdaters.toggleSort(tableState$, event.field);
      log.info('🌉 ReactiveBridge: Sort toggled', { field: event.field });
    },
    
    'view.sort.clear': () => {
      tableState$.sortBy.set([]);
      log.info('🌉 ReactiveBridge: Sort cleared');
    },
    
    // Filtering
    'view.filter.add': (event: any) => {
      tableStateUpdaters.addFilter(tableState$, event.filter);
      log.info('🌉 ReactiveBridge: Filter added', event.filter);
    },
    
    'view.filter.remove': (event: any) => {
      tableStateUpdaters.removeFilter(tableState$, event.index);
      log.info('🌉 ReactiveBridge: Filter removed', { index: event.index });
    },
    
    'view.filter.clear': () => {
      tableState$.filters.set([]);
      log.info('🌉 ReactiveBridge: Filters cleared');
    },
    
    // Column visibility
    'view.columns.toggle': (event: any) => {
      tableStateUpdaters.toggleColumnVisibility(tableState$, event.columnId);
      log.info('🌉 ReactiveBridge: Column visibility toggled', { columnId: event.columnId });
    },
    
    'view.columns.show': (event: any) => {
      const visibility = tableState$.columnVisibility.get();
      tableState$.columnVisibility.set({
        ...visibility,
        [event.columnId]: true
      });
    },
    
    'view.columns.hide': (event: any) => {
      const visibility = tableState$.columnVisibility.get();
      tableState$.columnVisibility.set({
        ...visibility,
        [event.columnId]: false
      });
    },
    
    'view.columns.showAll': () => {
      // Use batch for multiple updates (Legend State best practice)
      batch(() => {
        const visibility: Record<string, boolean> = {};
        columns.forEach(col => {
          visibility[col.id] = true;
        });
        tableState$.columnVisibility.set(visibility);
      });
    },
    
    'view.columns.hideAll': () => {
      // Use batch for multiple updates
      batch(() => {
        const visibility: Record<string, boolean> = {};
        columns.forEach(col => {
          visibility[col.id] = false;
        });
        tableState$.columnVisibility.set(visibility);
      });
    },
    
    // Grouping
    'group.config.set': (event: any) => {
      tableStateUpdaters.setGroupConfig(tableState$, event.config);
      log.info('🌉 ReactiveBridge: Group config set', event.config);
    },
    
    'CLEAR_GROUPING_RENDER': () => {
      tableStateUpdaters.setGroupConfig(tableState$, null);
      log.info('🌉 ReactiveBridge: Grouping cleared');
    },
    
    // Selection events
    'selection.cell.select': (event: any) => {
      tableStateUpdaters.selectCell(tableState$, event.cellId, event.isMulti);
    },
    
    'selection.row.select': (event: any) => {
      tableStateUpdaters.selectRow(tableState$, event.rowId, event.isMulti);
    },
    
    'selection.row.toggle': (event: any) => {
      tableStateUpdaters.toggleRowSelection(tableState$, event.rowId);
    },
    
    'selection.range.select': (event: any) => {
      tableStateUpdaters.selectRange(tableState$, event.start, event.end);
    },
    
    'selection.cell.deselect': (event: any) => {
      tableStateUpdaters.deselectCell(tableState$, event.cellId);
    },
    
    'selection.clear': () => {
      tableStateUpdaters.clearSelection(tableState$);
    },
    
    'selection.mode.set': (event: any) => {
      tableStateUpdaters.setSelectionMode(tableState$, event.mode);
    },
    
    // Editing events
    'edit.cell.start': (event: any) => {
      tableStateUpdaters.startEditing(tableState$, {
        rowId: event.rowId,
        columnId: event.columnId
      }, event.initialValue);
    },
    
    'edit.value.update': (event: any) => {
      tableStateUpdaters.updateEditValue(tableState$, event.value);
    },
    
    'edit.validation.set': (event: any) => {
      tableStateUpdaters.setEditValidation(tableState$, event.validation);
    },
    
    'edit.cell.save': () => {
      tableStateUpdaters.saveEdit(tableState$);
    },
    
    'edit.cell.cancel': () => {
      tableStateUpdaters.cancelEdit(tableState$);
    }
  };
  
  // ====================================
  // 4. HANDLE XSTATE EVENTS
  // ====================================
  
  const handleEvent = (event: any) => {
    const handler = eventHandlers[event.type as keyof typeof eventHandlers];
    if (handler) {
      handler(event);
    }
  };
  
  // ====================================
  // 5. PUBLIC API
  // ====================================
  
  return {
    // The reactive state itself
    tableState$,
    
    // Handle events from XState
    handleEvent,
    
    // Direct updaters for external use
    updaters: tableStateUpdaters,
    
    // Cleanup
    dispose: () => {
      log.info('🌉 ReactiveBridge: Disposing reactive bridge', { entityType });
      
      if (rendererDisposer) {
        rendererDisposer();
      }
    },
    
    // Debug info
    getDebugInfo: () => ({
      entityType,
      hasRenderer: !!renderer,
      currentState: {
        sortBy: tableState$.sortBy.get(),
        filters: tableState$.filters.get(),
        columnVisibility: tableState$.columnVisibility.get(),
        groupConfig: tableState$.groupConfig.get(),
        dataCount: Object.keys(tableState$.data.get()).length
      }
    })
  };
}

/**
 * Simple integration point for XState machine
 */
export function createXStateReactiveBridge(
  entityType: string,
  columns: Column[],
  renderer: any,
  initialState?: any
) {
  const bridge = createReactiveBridge({
    entityType,
    columns,
    renderer,
    initialState
  });
  
  // Return a function that XState can call with events
  const sendToReactiveBridge = (event: any) => {
    bridge.handleEvent(event);
  };
  
  // Attach bridge to the send function for cleanup
  (sendToReactiveBridge as any).__bridge = bridge;
  
  return sendToReactiveBridge;
}