import { setup, assign, fromPromise } from 'xstate';
import type { 
  SelectionContext, 
  CellRef, 
  SelectionRange, 
  SelectionMode,
  TableEvents 
} from '../types';

// ====================================
// HELPER FUNCTIONS
// ====================================

const createCellKey = (rowId: string, columnId: string): string => `${rowId}:${columnId}`;

const parseCellKey = (cellKey: string): CellRef => {
  const [rowId, columnId] = cellKey.split(':');
  return { rowId, columnId };
};

const calculateRangeSelection = (
  start: CellRef, 
  end: CellRef, 
  visibleRowIds: string[], 
  columns: any[]
): Set<string> => {
  const selection = new Set<string>();
  
  const startRowIndex = visibleRowIds.indexOf(start.rowId);
  const endRowIndex = visibleRowIds.indexOf(end.rowId);
  const startColIndex = columns.findIndex(col => col.id === start.columnId);
  const endColIndex = columns.findIndex(col => col.id === end.columnId);
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    return selection;
  }
  
  const minRow = Math.min(startRowIndex, endRowIndex);
  const maxRow = Math.max(startRowIndex, endRowIndex);
  const minCol = Math.min(startColIndex, endColIndex);
  const maxCol = Math.max(startColIndex, endColIndex);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const rowId = visibleRowIds[row];
      const columnId = columns[col].id;
      if (rowId && columnId) {
        selection.add(createCellKey(rowId, columnId));
      }
    }
  }
  
  return selection;
};

const moveCell = (
  current: CellRef, 
  direction: 'up' | 'down' | 'left' | 'right',
  visibleRowIds: string[],
  columns: any[]
): CellRef => {
  const currentRowIndex = visibleRowIds.indexOf(current.rowId);
  const currentColIndex = columns.findIndex(col => col.id === current.columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return current;
  }
  
  switch (direction) {
    case 'up':
      const upRowIndex = Math.max(0, currentRowIndex - 1);
      return {
        rowId: visibleRowIds[upRowIndex],
        columnId: current.columnId
      };
      
    case 'down':
      const downRowIndex = Math.min(visibleRowIds.length - 1, currentRowIndex + 1);
      return {
        rowId: visibleRowIds[downRowIndex],
        columnId: current.columnId
      };
      
    case 'left':
      const leftColIndex = Math.max(0, currentColIndex - 1);
      return {
        rowId: current.rowId,
        columnId: columns[leftColIndex].id
      };
      
    case 'right':
      const rightColIndex = Math.min(columns.length - 1, currentColIndex + 1);
      return {
        rowId: current.rowId,
        columnId: columns[rightColIndex].id
      };
      
    default:
      return current;
  }
};

// ====================================
// ASYNC ACTORS
// ====================================

const extractSelectedData = fromPromise(async ({ input }: {
  input: { selectedCells: Set<string>; getEntityData: (rowId: string, field: string) => any }
}) => {
  const { selectedCells, getEntityData } = input;
  const data: Array<{ rowId: string; columnId: string; value: any }> = [];
  
  for (const cellKey of selectedCells) {
    const { rowId, columnId } = parseCellKey(cellKey);
    const value = getEntityData(rowId, columnId);
    data.push({ rowId, columnId, value });
  }
  
  return { data };
});

// ====================================
// SELECTION COORDINATOR MACHINE
// ====================================

interface SelectionCoordinatorContext extends SelectionContext {
  entityType: string;
  visibleRowIds: string[];
  columns: any[];
  
  // Clipboard functionality
  clipboard: {
    cells: string[];
    data: any[];
    mode: 'copy' | 'cut';
    timestamp: number;
  } | null;
  
  // Fill handle for Excel-like drag fill
  fillHandle: {
    source: CellRef;
    value: any;
    direction: 'horizontal' | 'vertical' | null;
    targetCells: Set<string>;
  } | null;
}

type SelectionEvents = 
  | { type: 'selection.cell.select'; rowId: string; columnId: string; ctrlKey?: boolean; shiftKey?: boolean }
  | { type: 'selection.range.select'; start: CellRef; end: CellRef }
  | { type: 'selection.row.select'; rowId: string }
  | { type: 'selection.column.select'; columnId: string }
  | { type: 'selection.clear' }
  | { type: 'keyboard.arrow'; direction: string; extend?: boolean }
  | { type: 'keyboard.copy' }
  | { type: 'keyboard.paste' }
  // Internal events
  | { type: 'ENTITY_TYPE_CHANGED'; entityType: string }
  | { type: 'VISIBLE_ROWS_CHANGED'; rowIds: string[] }
  | { type: 'COLUMNS_CHANGED'; columns: any[] }
  | { type: 'FILL_START'; cellRef: CellRef; value: any }
  | { type: 'FILL_EXTEND'; targetRef: CellRef }
  | { type: 'FILL_APPLY' }
  | { type: 'FILL_CANCEL' };

export const selectionCoordinatorMachine = setup({
  types: {
    context: {} as SelectionCoordinatorContext,
    events: {} as SelectionEvents,
    input: {} as { 
      entityType: string;
      visibleRowIds?: string[];
      columns?: any[];
    }
  },
  
  actors: {
    extractSelectedData
  },
  
  actions: {
    // Cell selection
    selectCell: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'selection.cell.select') return context.selectedCells;
        
        const cellKey = createCellKey(event.rowId, event.columnId);
        const newSelection = new Set(context.selectedCells);
        
        console.log('SelectionCoordinator: selectCell action', {
          cellKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          hasAnchor: !!context.anchor,
          anchor: context.anchor
        });
        
        if (event.ctrlKey) {
          // Multi-select: toggle
          if (newSelection.has(cellKey)) {
            newSelection.delete(cellKey);
          } else {
            newSelection.add(cellKey);
          }
        } else if (event.shiftKey && context.anchor) {
          // Range select
          const rangeSelection = calculateRangeSelection(
            context.anchor, 
            { rowId: event.rowId, columnId: event.columnId },
            context.visibleRowIds,
            context.columns
          );
          console.log('SelectionCoordinator: Range selection calculated', {
            anchorCell: context.anchor,
            targetCell: { rowId: event.rowId, columnId: event.columnId },
            rangeSize: rangeSelection.size,
            visibleRowIds: context.visibleRowIds.length,
            columns: context.columns.length
          });
          return rangeSelection;
        } else {
          // Single select
          newSelection.clear();
          newSelection.add(cellKey);
        }
        
        return newSelection;
      },
      
      activeCell: ({ event }) => 
        event.type === 'selection.cell.select' 
          ? { rowId: event.rowId, columnId: event.columnId } 
          : null,
          
      anchor: ({ context, event }) => {
        if (event.type !== 'selection.cell.select') return context.anchor;
        
        // Set anchor for future range selections
        return event.shiftKey && context.anchor ? context.anchor : {
          rowId: event.rowId,
          columnId: event.columnId
        };
      }
    }),
    
    // Range selection
    selectRange: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'selection.range.select') return context.selectedCells;
        
        return calculateRangeSelection(
          event.start,
          event.end,
          context.visibleRowIds,
          context.columns
        );
      },
      
      activeCell: ({ event }) => 
        event.type === 'selection.range.select' ? event.end : null,
        
      anchor: ({ event }) => 
        event.type === 'selection.range.select' ? event.start : null
    }),
    
    // Row selection
    selectRow: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'selection.row.select') return context.selectedCells;
        
        const newSelection = new Set<string>();
        
        // Select all cells in the row
        context.columns.forEach(column => {
          newSelection.add(createCellKey(event.rowId, column.id));
        });
        
        if (event.extend) {
          // Add to existing selection
          context.selectedCells.forEach(cellKey => newSelection.add(cellKey));
        }
        
        return newSelection;
      },
      
      activeCell: ({ context, event }) => {
        if (event.type !== 'selection.row.select') return context.activeCell;
        
        // Set active cell to first column of the row
        return {
          rowId: event.rowId,
          columnId: context.columns[0]?.id || ''
        };
      }
    }),
    
    // Column selection
    selectColumn: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'selection.column.select') return context.selectedCells;
        
        const newSelection = new Set<string>();
        
        // Select all cells in the column
        context.visibleRowIds.forEach(rowId => {
          newSelection.add(createCellKey(rowId, event.columnId));
        });
        
        if (event.extend) {
          // Add to existing selection
          context.selectedCells.forEach(cellKey => newSelection.add(cellKey));
        }
        
        return newSelection;
      },
      
      activeCell: ({ context, event }) => {
        if (event.type !== 'selection.column.select') return context.activeCell;
        
        // Set active cell to first row of the column
        return {
          rowId: context.visibleRowIds[0] || '',
          columnId: event.columnId
        };
      }
    }),
    
    // Clear selection
    clearSelection: assign({
      selectedCells: new Set(),
      activeCell: null,
      anchor: null,
      selectionRanges: []
    }),
    
    // Keyboard navigation
    moveSelection: assign(({ context, event }) => {
      if (event.type !== 'keyboard.arrow' || !context.activeCell) return {};
      
      const newCell = moveCell(
        context.activeCell,
        event.direction,
        context.visibleRowIds,
        context.columns
      );
      
      const cellKey = createCellKey(newCell.rowId, newCell.columnId);
      
      if (event.extend) {
        // Extend selection (range selection)
        const anchor = context.anchor || context.activeCell;
        const rangeSelection = calculateRangeSelection(
          anchor,
          newCell,
          context.visibleRowIds,
          context.columns
        );
        
        return {
          selectedCells: rangeSelection,
          activeCell: newCell,
          anchor
        };
      } else {
        // Move selection
        return {
          selectedCells: new Set([cellKey]),
          activeCell: newCell,
          anchor: newCell
        };
      }
    }),
    
    // Clipboard operations
    copySelection: assign({
      clipboard: ({ context }) => ({
        cells: Array.from(context.selectedCells),
        data: [], // Will be populated by async actor
        mode: 'copy' as const,
        timestamp: Date.now()
      })
    }),
    
    // Entity updates
    updateEntityType: assign({
      entityType: ({ event }) => 
        event.type === 'ENTITY_TYPE_CHANGED' ? event.entityType : ''
    }),
    
    updateVisibleRows: assign({
      visibleRowIds: ({ event }) => 
        event.type === 'VISIBLE_ROWS_CHANGED' ? event.rowIds : []
    }),
    
    updateColumns: assign({
      columns: ({ event }) => 
        event.type === 'COLUMNS_CHANGED' ? event.columns : []
    })
  },
  
  guards: {
    hasSelection: ({ context }) => context.selectedCells.size > 0,
    hasActiveCell: ({ context }) => context.activeCell !== null,
    canNavigate: ({ context }) => 
      context.activeCell !== null && 
      context.visibleRowIds.length > 0 && 
      context.columns.length > 0,
    isMultiCellSelection: ({ context }) => context.selectedCells.size > 1
  }
  
}).createMachine({
  id: 'selectionCoordinator',
  
  initial: 'idle',
  
  context: ({ input }) => ({
    entityType: input.entityType,
    visibleRowIds: input.visibleRowIds || [],
    columns: input.columns || [],
    selectedCells: new Set(),
    activeCell: null,
    selectionRanges: [],
    selectionMode: 'single' as SelectionMode,
    anchor: null,
    clipboard: null,
    fillHandle: null
  }),
  
  states: {
    idle: {
      on: {
        // Selection events
        'selection.cell.select': {
          actions: 'selectCell'
        },
        
        'selection.range.select': {
          actions: 'selectRange'
        },
        
        'selection.row.select': {
          actions: 'selectRow'
        },
        
        'selection.column.select': {
          actions: 'selectColumn'
        },
        
        'selection.clear': {
          actions: 'clearSelection'
        },
        
        // Keyboard navigation
        'keyboard.arrow': {
          guard: 'canNavigate',
          actions: 'moveSelection'
        },
        
        // Clipboard operations
        'keyboard.copy': {
          guard: 'hasSelection',
          target: 'copying',
          actions: 'copySelection'
        },
        
        'keyboard.paste': {
          guard: 'hasActiveCell',
          target: 'pasting'
        },
        
        // Configuration updates
        ENTITY_TYPE_CHANGED: {
          actions: ['updateEntityType', 'clearSelection']
        },
        
        VISIBLE_ROWS_CHANGED: {
          actions: 'updateVisibleRows'
        },
        
        COLUMNS_CHANGED: {
          actions: 'updateColumns'
        },
        
        // Fill operations
        FILL_START: {
          target: 'filling',
          actions: assign({
            fillHandle: ({ event }) => ({
              source: event.cellRef,
              value: event.value,
              direction: null,
              targetCells: new Set()
            })
          })
        }
      }
    },
    
    copying: {
      invoke: {
        src: 'extractSelectedData',
        input: ({ context }) => ({
          selectedCells: context.selectedCells,
          getEntityData: (rowId: string, field: string) => {
            // This will be provided by the entity integration layer
            return `${rowId}:${field}`;
          }
        }),
        onDone: {
          target: 'idle',
          actions: assign({
            clipboard: ({ context, event }) => ({
              ...context.clipboard!,
              data: event.output.data
            })
          })
        }
      }
    },
    
    pasting: {
      entry: [
        // Emit paste event for edit coordinator to handle
        ({ context }) => {
          console.log('Pasting data at:', context.activeCell);
          // The actual paste logic will be handled by the edit coordinator
        }
      ],
      
      always: 'idle'
    },
    
    filling: {
      on: {
        FILL_EXTEND: {
          actions: assign({
            fillHandle: ({ context, event }) => {
              if (!context.fillHandle) return context.fillHandle;
              
              const sourceRow = context.visibleRowIds.indexOf(context.fillHandle.source.rowId);
              const sourceCol = context.columns.findIndex(col => col.id === context.fillHandle.source.columnId);
              const targetRow = context.visibleRowIds.indexOf(event.targetRef.rowId);
              const targetCol = context.columns.findIndex(col => col.id === event.targetRef.columnId);
              
              const direction = Math.abs(targetRow - sourceRow) > Math.abs(targetCol - sourceCol) 
                ? 'vertical' : 'horizontal';
              
              // Calculate fill range
              const targetCells = calculateRangeSelection(
                context.fillHandle.source,
                event.targetRef,
                context.visibleRowIds,
                context.columns
              );
              
              return {
                ...context.fillHandle,
                direction,
                targetCells
              };
            }
          })
        },
        
        FILL_APPLY: {
          target: 'idle',
          actions: [
            // Apply fill operation (will be handled by edit coordinator)
            ({ context }) => {
              console.log('Applying fill operation:', context.fillHandle);
            },
            assign({
              fillHandle: null
            })
          ]
        },
        
        FILL_CANCEL: {
          target: 'idle',
          actions: assign({
            fillHandle: null
          })
        }
      }
    }
  }
});