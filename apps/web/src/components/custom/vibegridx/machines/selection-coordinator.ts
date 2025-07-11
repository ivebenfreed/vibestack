import { setup, assign, fromPromise, sendParent } from 'xstate';
import type { 
  SelectionContext, 
  CellRef, 
  SelectionRange, 
  SelectionMode,
  TableEvents 
} from '../types';
import type { VibeGridXCoordinateManager, CoordinatePosition } from '../coordinates/VibeGridXCoordinateManager';

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
  direction: string,
  visibleRowIds: string[],
  columns: any[]
): CellRef => {
  const currentRowIndex = visibleRowIds.indexOf(current.rowId);
  const currentColIndex = columns.findIndex(col => col.id === current.columnId);
  
  if (currentRowIndex === -1 || currentColIndex === -1) {
    console.warn('moveCell: Current cell not found in visible rows/columns');
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
  allRowIds: string[]; // All row IDs for full column selection
  columns: any[];
  
  // Coordinate manager for reliable position tracking
  coordinateManager: VibeGridXCoordinateManager | null;
  
  // Logical position-based selection (stable across sorts)
  selectedPositions: Set<string>; // "rowIndex:columnIndex" format
  anchorPosition: CoordinatePosition | null;
  
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
  | { type: 'selection.drag.start'; startCell: CellRef }
  | { type: 'selection.drag.move'; currentCell: CellRef }
  | { type: 'selection.drag.end' }
  | { type: 'keyboard.arrow'; direction: 'up' | 'down' | 'left' | 'right'; extend?: boolean }
  | { type: 'keyboard.copy' }
  | { type: 'keyboard.paste' }
  // Internal events
  | { type: 'ENTITY_TYPE_CHANGED'; entityType: string }
  | { type: 'VISIBLE_ROWS_CHANGED'; rowIds: string[] }
  | { type: 'ALL_ROWS_CHANGED'; rowIds: string[] }
  | { type: 'COLUMNS_CHANGED'; columns: any[] }
  | { type: 'COORDINATE_MANAGER_SET'; coordinateManager: VibeGridXCoordinateManager }
  | { type: 'COORDINATE_MAPPING_CHANGED' }
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
        const cellRef = { rowId: event.rowId, columnId: event.columnId };
        
        // Only log selection changes for debugging special cases
        if (event.shiftKey || context.selectedCells.size > 50) {
          console.log('SelectionCoordinator: selectCell', {
            cellKey,
            shiftKey: event.shiftKey,
            currentSize: context.selectedCells.size
          });
        }
        
        if (event.shiftKey && context.anchor && context.coordinateManager) {
          // Range select using coordinate manager
          const rangeSelection = context.coordinateManager.calculateCellRange(
            context.anchor,
            cellRef
          );
          return rangeSelection;
        } else {
          // Single select
          const newSelection = new Set<string>();
          newSelection.add(cellKey);
          return newSelection;
        }
      },
      
      selectedPositions: ({ context, event }) => {
        if (event.type !== 'selection.cell.select' || !context.coordinateManager) {
          return context.selectedPositions;
        }
        
        const cellRef = { rowId: event.rowId, columnId: event.columnId };
        const position = context.coordinateManager.cellRefToPosition(cellRef);
        
        if (!position) return context.selectedPositions;
        
        if (event.shiftKey && context.anchorPosition) {
          // Range select using logical positions
          const range = context.coordinateManager.calculateLogicalRange(
            context.coordinateManager.positionToCellRef(context.anchorPosition)!,
            cellRef
          );
          
          const newPositions = new Set<string>();
          range.forEach(pos => {
            newPositions.add(`${pos.rowIndex}:${pos.columnIndex}`);
          });
          return newPositions;
        } else {
          // Single select
          const newPositions = new Set<string>();
          newPositions.add(`${position.rowIndex}:${position.columnIndex}`);
          return newPositions;
        }
      },
      
      activeCell: ({ context, event }) => 
        event.type === 'selection.cell.select' 
          ? { rowId: event.rowId, columnId: event.columnId } 
          : context.activeCell,
          
      anchor: ({ context, event }) => {
        if (event.type !== 'selection.cell.select') return context.anchor;
        
        // Keep anchor on shift+click, otherwise set new anchor
        return event.shiftKey ? context.anchor : {
          rowId: event.rowId,
          columnId: event.columnId
        };
      },
      
      anchorPosition: ({ context, event }) => {
        if (event.type !== 'selection.cell.select' || !context.coordinateManager) {
          return context.anchorPosition;
        }
        
        // Keep anchor position on shift+click, otherwise set new anchor position
        if (event.shiftKey) return context.anchorPosition;
        
        const cellRef = { rowId: event.rowId, columnId: event.columnId };
        return context.coordinateManager.cellRefToPosition(cellRef);
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
    
    // Column selection - DISABLED
    // Not practical for spreadsheet operations where copy/paste needs contiguous cells
    selectColumn: assign({
      selectedCells: ({ context }) => context.selectedCells,
      activeCell: ({ context }) => context.activeCell
    }),
    
    // Clear selection
    clearSelection: assign({
      selectedCells: new Set(),
      selectedPositions: new Set(),
      activeCell: null,
      anchor: null,
      anchorPosition: null,
      selectionRanges: []
    }),
    
    // Keyboard navigation
    moveSelection: assign(({ context, event }) => {
      if (event.type !== 'keyboard.arrow') return {};
      
      if (!context.activeCell || !context.coordinateManager) {
        console.warn('SelectionCoordinator: No active cell or coordinate manager for arrow navigation');
        return {};
      }
      
      const newCell = context.coordinateManager.moveCellRef(
        context.activeCell,
        event.direction
      );
      
      if (!newCell) return {};
      
      const cellKey = createCellKey(newCell.rowId, newCell.columnId);
      const newPosition = context.coordinateManager.cellRefToPosition(newCell);
      
      if (!newPosition) return {};
      
      if (event.extend) {
        // Extend selection (range selection)
        const anchor = context.anchor || context.activeCell;
        const anchorPosition = context.anchorPosition || context.coordinateManager.cellRefToPosition(context.activeCell);
        
        if (anchorPosition) {
          const rangeSelection = context.coordinateManager.calculateCellRange(anchor, newCell);
          const rangePositions = context.coordinateManager.calculateLogicalRange(anchor, newCell);
          const positionSet = new Set<string>();
          rangePositions.forEach(pos => {
            positionSet.add(`${pos.rowIndex}:${pos.columnIndex}`);
          });
          
          return {
            selectedCells: rangeSelection,
            selectedPositions: positionSet,
            activeCell: newCell,
            anchor,
            anchorPosition
          };
        }
      } else {
        // Move selection
        return {
          selectedCells: new Set([cellKey]),
          selectedPositions: new Set([`${newPosition.rowIndex}:${newPosition.columnIndex}`]),
          activeCell: newCell,
          anchor: newCell,
          anchorPosition: newPosition
        };
      }
      
      return {};
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
      visibleRowIds: ({ event }) => {
        if (event.type === 'VISIBLE_ROWS_CHANGED') {
          return event.rowIds;
        }
        return [];
      },
      
    }),
    
    updateColumns: assign({
      columns: ({ event }) => 
        event.type === 'COLUMNS_CHANGED' ? event.columns : []
    }),
    
    updateAllRows: assign({
      allRowIds: ({ event }) => {
        if (event.type === 'ALL_ROWS_CHANGED') {
          console.log('SelectionCoordinator: Received ALL_ROWS_CHANGED', {
            rowCount: event.rowIds.length,
            sampleRowIds: event.rowIds.slice(0, 3)
          });
          return event.rowIds;
        }
        return [];
      }
    }),
    
    // Coordinate manager actions
    setCoordinateManager: assign({
      coordinateManager: ({ event }) => {
        if (event.type === 'COORDINATE_MANAGER_SET') {
          console.log('SelectionCoordinator: Setting coordinate manager', {
            hasManager: !!event.coordinateManager,
            managerType: event.coordinateManager?.constructor?.name
          });
          return event.coordinateManager;
        }
        return null;
      }
    }),
    
    syncSelectionToPositions: assign({
      selectedPositions: ({ context }) => {
        if (!context.coordinateManager) return context.selectedPositions;
        
        // Convert current cell keys to logical positions
        return context.coordinateManager.cellKeysToPositions(context.selectedCells);
      }
    }),
    
    syncPositionsToSelection: assign({
      selectedCells: ({ context }) => {
        if (!context.coordinateManager) return context.selectedCells;
        
        // Convert logical positions back to current cell keys
        return context.coordinateManager.positionsToCellKeys(context.selectedPositions);
      },
      
      activeCell: ({ context }) => {
        if (!context.coordinateManager || !context.anchorPosition) return context.activeCell;
        
        // Convert anchor position back to cell ref
        return context.coordinateManager.positionToCellRef(context.anchorPosition);
      }
    })
  },
  
  guards: {
    hasSelection: ({ context }) => context.selectedCells.size > 0,
    hasActiveCell: ({ context }) => context.activeCell !== null,
    canNavigate: ({ context }) => {
      const canNav = context.activeCell !== null && 
        context.visibleRowIds.length > 0 && 
        context.columns.length > 0;
      
      if (!canNav) {
        console.log('SelectionCoordinator: Cannot navigate', {
          hasActiveCell: context.activeCell !== null,
          activeCell: context.activeCell,
          visibleRowIdsLength: context.visibleRowIds.length,
          columnsLength: context.columns.length
        });
      }
      
      return canNav;
    },
    isMultiCellSelection: ({ context }) => context.selectedCells.size > 1
  }
  
}).createMachine({
  id: 'selectionCoordinator',
  
  initial: 'idle',
  
  context: ({ input }) => ({
    entityType: input.entityType,
    visibleRowIds: input.visibleRowIds || [],
    allRowIds: input.allRowIds || [],
    columns: input.columns || [],
    coordinateManager: null,
    selectedCells: new Set(),
    selectedPositions: new Set(),
    activeCell: null,
    anchorPosition: null,
    selectionRanges: [],
    selectionMode: 'single' as SelectionMode,
    anchor: null,
    clipboard: null,
    fillHandle: null
  }),
  
  states: {
    idle: {
      entry: [
        ({ context }) => {
          console.log('SelectionCoordinator: Entering idle state', {
            entityType: context.entityType,
            hasCoordinateManager: !!context.coordinateManager,
            selectedCellsSize: context.selectedCells.size
          });
        }
      ],
      on: {
        // Selection events
        'selection.cell.select': {
          actions: ['selectCell', 
            // Debug logging
            ({ context, event }) => {
              console.log('SelectionCoordinator: selection.cell.select processed', {
                eventType: event.type,
                rowId: event.rowId,
                columnId: event.columnId,
                selectedCellsSize: context.selectedCells.size,
                contextKeys: Object.keys(context)
              });
            },
            // Emit selection change to parent (table machine) for overlay forwarding
            sendParent(({ context }) => {
              const parentEvent = {
                type: 'selection.state.changed',
                selectedCells: context.selectedCells,
                activeCell: context.activeCell
              };
              console.log('SelectionCoordinator: Sending to parent (table machine)', parentEvent);
              return parentEvent;
            })
          ]
        },
        
        'selection.range.select': {
          actions: ['selectRange',
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
        },
        
        'selection.row.select': {
          actions: ['selectRow',
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
        },
        
        // Column selection disabled
        // 'selection.column.select': {
        //   actions: 'selectColumn'
        // },
        
        'selection.clear': {
          actions: ['clearSelection',
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
        },
        
        // Drag selection events
        'selection.drag.start': {
          target: 'dragging',
          actions: assign({
            anchor: ({ event }) => event.startCell
          })
        },
        
        // Keyboard navigation
        'keyboard.arrow': {
          guard: 'canNavigate',
          actions: ['moveSelection', 
            ({ event }) => {
              console.log('SelectionCoordinator: Processing keyboard.arrow event', event);
            },
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
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
        
        ALL_ROWS_CHANGED: {
          actions: 'updateAllRows'
        },
        
        COLUMNS_CHANGED: {
          actions: 'updateColumns'
        },
        
        // Coordinate manager events
        COORDINATE_MANAGER_SET: {
          actions: [
            'setCoordinateManager', 
            'syncSelectionToPositions',
            ({ event, context }) => {
              console.log('SelectionCoordinator: COORDINATE_MANAGER_SET', {
                hasCoordinateManager: !!event.coordinateManager,
                coordinateManagerMethods: event.coordinateManager ? Object.getOwnPropertyNames(Object.getPrototypeOf(event.coordinateManager)) : [],
                contextHasManager: !!context.coordinateManager
              });
            }
          ]
        },
        
        COORDINATE_MAPPING_CHANGED: {
          actions: 'syncPositionsToSelection'
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
    
    dragging: {
      on: {
        'selection.drag.move': {
          actions: [
            assign({
              selectedCells: ({ context, event }) => {
                console.log('SelectionCoordinator: drag.move', {
                  hasCoordinateManager: !!context.coordinateManager,
                  hasAnchor: !!context.anchor,
                  anchor: context.anchor,
                  currentCell: event.currentCell
                });
                
                // Use coordinate manager to calculate range with sorted positions
                if (context.coordinateManager && context.anchor && event.currentCell) {
                  const range = context.coordinateManager.calculateCellRange(
                    context.anchor,
                    event.currentCell
                  );
                  console.log('SelectionCoordinator: Using coordinate manager, range size:', range.size);
                  return range;
                }
                // Fallback to old method if no coordinate manager
                console.log('SelectionCoordinator: Fallback to calculateRangeSelection');
                return calculateRangeSelection(
                  context.anchor!,
                  event.currentCell,
                  context.visibleRowIds,
                  context.columns
                );
              },
              activeCell: ({ event }) => event.currentCell
            }),
            // Send update to parent so overlay can render
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
        },
        
        'selection.drag.end': {
          target: 'idle',
          actions: [
            // Selection is already set during drag.move, just notify parent
            sendParent(({ context }) => ({
              type: 'selection.state.changed',
              selectedCells: context.selectedCells,
              activeCell: context.activeCell
            }))
          ]
        },
        
        'selection.clear': {
          target: 'idle',
          actions: 'clearSelection'
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