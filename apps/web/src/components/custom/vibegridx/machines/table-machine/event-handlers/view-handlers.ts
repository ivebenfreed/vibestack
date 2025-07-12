// ====================================
// VIEW EVENT HANDLERS
// ====================================

import { sendTo, assign, raise } from 'xstate';
import { viewActions } from '../slices/view-slice';

export const viewHandlers = {
  'view.sort.set': {
    actions: [
      viewActions.setSortBy,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.column.click': {
    actions: [
      viewActions.toggleSort,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.filter.set': {
    actions: [
      viewActions.setFilters,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.group.set': {
    actions: [
      viewActions.setGroupBy,
      
      // Trigger view processing
      raise({ type: 'INVOKE_VIEW_ACTOR' })
    ]
  },
  
  'view.columns.toggle': {
    actions: [
      viewActions.toggleColumnVisibility,
      
      ({ context, event }) => {
        console.log('TableMachine: Column visibility toggled', {
          columnId: event.columnId,
          isVisible: context.columnVisibility[event.columnId] !== false,
          hiddenCount: context.hiddenColumnCount
        });
      }
    ]
  },
  
  'view.columns.visibility.set': {
    actions: [
      viewActions.setColumnVisibility,
      
      ({ context }) => {
        console.log('TableMachine: Column visibility updated', {
          hiddenCount: context.hiddenColumnCount,
          totalColumns: Object.keys(context.columnVisibility).length
        });
      }
    ]
  },
  
  'view.columns.show.all': {
    actions: [
      viewActions.showAllColumns,
      
      () => {
        console.log('TableMachine: All columns shown');
      }
    ]
  },
  
  'view.columns.hide.all': {
    actions: [
      viewActions.hideAllColumns,
      
      () => {
        console.log('TableMachine: All columns hidden');
      }
    ]
  },
  
  'view.columns.order.set': {
    actions: [
      viewActions.setColumnOrder,
      
      ({ event }) => {
        console.log('TableMachine: Column order updated', {
          newOrder: event.order
        });
      }
    ]
  },
  
  'view.columns.reorder': {
    actions: [
      viewActions.reorderColumns,
      
      ({ event }) => {
        console.log('TableMachine: Columns reordered', {
          from: event.fromIndex,
          to: event.toIndex
        });
      }
    ]
  },
  
  'view.columns.order.reset': {
    actions: [
      viewActions.resetColumnOrder,
      
      () => {
        console.log('TableMachine: Column order reset to default');
      }
    ]
  },
  
  'view.viewport.update': {
    actions: [
      viewActions.updateViewport,
      
      // Send to overlay actor for canvas updates
      sendTo(
        ({ context }) => context.actors.overlayActor!,
        ({ event }) => ({
          type: 'VIEWPORT_UPDATE',
          viewport: event.viewport
        })
      ),
      
      // Send to canvas actor
      sendTo(
        ({ context }) => context.actors.canvasActor!,
        ({ event }) => ({
          type: 'UPDATE_VIEWPORT',
          viewport: event.viewport
        })
      ),
      
      // Update visual positions for selected cells
      ({ context, self }) => {
        if (context.selectedCells.size > 0) {
          const visualPositions = calculateVisualPositions(
            context.selectedCells,
            context.coordinateMapping,
            context.viewport,
            context.rowHeight || context.settings?.rowHeight || 40
          );
          
          if (context.actors.canvasActor && visualPositions.length > 0) {
            self.send({
              type: 'FORWARD_TO_CANVAS',
              event: {
                type: 'UPDATE_SELECTION_VISUAL',
                visualCells: visualPositions
              }
            });
          }
        }
      }
    ]
  },
  
  // Column resize event from view coordinator
  'view.column.resized': {
    actions: [
      // Update dimension state
      ({ context, event }) => {
        if (context.dimensionManager) {
          context.dimensionManager.setColumnWidth(event.columnId, event.width);
        }
      },
      
      // Update column widths in context
      assign({
        columnWidths: ({ context, event }) => ({
          ...context.columnWidths,
          [event.columnId]: event.width
        })
      }),
      
      // Persist to localStorage
      ({ context, event }) => {
        const columnWidths = loadFromStorage(context.entityType, 'columnWidths', {});
        columnWidths[event.columnId] = event.width;
        saveToStorage(context.entityType, 'columnWidths', columnWidths);
      },
      
      ({ event }) => {
        console.log('TableMachine: Column resized', {
          columnId: event.columnId,
          newWidth: event.width
        });
      }
    ]
  }
};

// Import helpers
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

// Storage helpers (should be in a separate file but including here for completeness)
const getStorageKey = (entityType: string, key: string) => `vibegridx-${entityType}-${key}`;

const loadFromStorage = <T>(entityType: string, key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const stored = localStorage.getItem(getStorageKey(entityType, key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveToStorage = (entityType: string, key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(getStorageKey(entityType, key), JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};