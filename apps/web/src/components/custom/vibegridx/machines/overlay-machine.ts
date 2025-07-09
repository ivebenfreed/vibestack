import { createMachine, assign, createActor, fromPromise, emit, enqueueActions } from 'xstate';
import type { CellRef, ViewportInfo } from '../types';
import { getCellsInRange, parseCellKey, createCellKey } from '../overlays/OverlayUtils';

// ====================================
// TYPES
// ====================================

export interface OverlayContext {
  // Viewport information
  viewport: ViewportInfo | null;
  
  // Selection state
  selectedCells: Set<string>;
  selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  anchorCell: { key: string; row: number; column: number } | null; // For shift-click range selection
  
  // Editing state
  editingCell: CellRef | null;
  
  // Drag state
  dragState: {
    isDragging: boolean;
    startPos: { x: number; y: number } | null;
    startCell: { row: number; column: number } | null;
    currentPos: { x: number; y: number } | null;
    currentCell: { row: number; column: number } | null;
  } | null;
  
  // Fill state
  fillState: {
    isActive: boolean;
    direction: 'vertical' | 'horizontal' | null;
    originalSelection: Set<string>;
    previewCells: Set<string>;
  } | null;
  
  // Clipboard state
  clipboardState: {
    copiedCells: Set<string>;
    isCut: boolean;
  } | null;
  
  // Shape visibility flags
  shapesVisible: {
    selection: boolean;
    editing: boolean;
    dragPreview: boolean;
    fillHandle: boolean;
    fillPreview: boolean;
    copyIndicator: boolean;
  };
  
  // Performance metrics
  lastRenderTime: number;
  renderCount: number;
}

export type OverlayEvent =
  | { type: 'VIEWPORT_UPDATE'; viewport: ViewportInfo }
  | { type: 'CELL_CLICK'; cellKey: string; ctrlKey: boolean; shiftKey: boolean; row: number; column: number }
  | { type: 'RANGE_SELECT'; cells: Set<string>; anchorKey: string; anchorRow: number; anchorColumn: number }
  | { type: 'SELECTION_UPDATE'; cells: Set<string> }
  | { type: 'DRAG_START'; startPos: { x: number; y: number }; startCell: { row: number; column: number } }
  | { type: 'DRAG_MOVE'; currentPos: { x: number; y: number }; currentCell: { row: number; column: number } }
  | { type: 'DRAG_END'; cells: Set<string> }
  | { type: 'DRAG_CANCEL' }
  | { type: 'EDIT_START'; cell: CellRef }
  | { type: 'EDIT_END' }
  | { type: 'EDIT_CANCEL' }
  | { type: 'FILL_START'; direction: 'vertical' | 'horizontal' }
  | { type: 'FILL_DRAG'; previewCells: Set<string> }
  | { type: 'FILL_COMPLETE'; fillCells: Set<string> }
  | { type: 'FILL_CANCEL' }
  | { type: 'COPY'; cells: Set<string> }
  | { type: 'CUT'; cells: Set<string> }
  | { type: 'PASTE' }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'RENDER_COMPLETE'; duration: number };

// ====================================
// MACHINE DEFINITION
// ====================================

export const overlayMachine = createMachine({
  id: 'overlay',
  types: {} as {
    context: OverlayContext;
    events: OverlayEvent;
  },
  context: {
    viewport: null,
    selectedCells: new Set(),
    selectionBounds: null,
    anchorCell: null,
    editingCell: null,
    dragState: null,
    fillState: null,
    clipboardState: null,
    shapesVisible: {
      selection: true,
      editing: true,
      dragPreview: false, // Only show when actively dragging
      fillHandle: false,  // Only show when selection exists
      fillPreview: false, // Only show when filling
      copyIndicator: false // Only show when copying
    },
    lastRenderTime: 0,
    renderCount: 0
  },
  type: 'parallel',
  states: {
    // Selection management
    selection: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            CELL_CLICK: {
              actions: ['handleCellClick', 'emitSelectionChange']
            },
            RANGE_SELECT: {
              actions: ['handleRangeSelect', 'emitSelectionChange']
            },
            SELECTION_UPDATE: {
              actions: ['updateSelection', 'calculateSelectionBounds']
            },
            FILL_START: {
              target: 'filling',
              actions: ['initializeFillState', 'enableFillPreview']
            },
            DRAG_START: {
              target: 'dragging',
              actions: ['initializeDragState', 'enableDragPreview']
            }
          }
        },
        dragging: {
          on: {
            DRAG_MOVE: {
              actions: 'updateDragState'
            },
            DRAG_END: {
              target: 'idle',
              actions: ['completeDragSelection', 'clearDragState', 'disableDragPreview', 'emitSelectionChange']
            },
            DRAG_CANCEL: {
              target: 'idle',
              actions: ['clearDragState', 'disableDragPreview']
            }
          }
        },
        filling: {
          on: {
            FILL_DRAG: {
              actions: 'updateFillPreview'
            },
            FILL_COMPLETE: {
              target: 'idle',
              actions: ['applyFill', 'clearFillState', 'emitFillComplete']
            },
            FILL_CANCEL: {
              target: 'idle',
              actions: 'clearFillState'
            }
          }
        }
      }
    },
    
    // Editing management
    editing: {
      initial: 'none',
      states: {
        none: {
          on: {
            EDIT_START: {
              target: 'active',
              actions: 'setEditingCell'
            }
          }
        },
        active: {
          on: {
            EDIT_END: {
              target: 'none',
              actions: ['clearEditingCell', 'emitEditComplete']
            },
            EDIT_CANCEL: {
              target: 'none',
              actions: 'clearEditingCell'
            }
          }
        }
      }
    },
    
    // Clipboard management
    clipboard: {
      initial: 'empty',
      states: {
        empty: {
          on: {
            COPY: {
              target: 'copied',
              actions: 'copyToClipboard'
            },
            CUT: {
              target: 'cut',
              actions: 'cutToClipboard'
            }
          }
        },
        copied: {
          on: {
            PASTE: {
              actions: ['pasteFromClipboard', 'emitPasteComplete']
            },
            CLEAR_CLIPBOARD: {
              target: 'empty',
              actions: 'clearClipboard'
            },
            COPY: {
              actions: 'copyToClipboard'
            },
            CUT: {
              target: 'cut',
              actions: 'cutToClipboard'
            }
          }
        },
        cut: {
          on: {
            PASTE: {
              target: 'empty',
              actions: ['pasteFromClipboard', 'clearCutCells', 'emitPasteComplete']
            },
            CLEAR_CLIPBOARD: {
              target: 'empty',
              actions: 'clearClipboard'
            },
            COPY: {
              target: 'copied',
              actions: 'copyToClipboard'
            },
            CUT: {
              actions: 'cutToClipboard'
            }
          }
        }
      }
    },
    
    // Viewport tracking
    viewport: {
      on: {
        VIEWPORT_UPDATE: {
          actions: 'updateViewport'
        }
      }
    },
    
    // Render tracking
    rendering: {
      on: {
        RENDER_COMPLETE: {
          actions: 'updateRenderMetrics'
        }
      }
    }
  }
}, {
  actions: {
    // Selection actions
    handleCellClick: assign({
      selectedCells: ({ context, event }, params) => {
        if (event.type !== 'CELL_CLICK') return context.selectedCells;
        
        const newSelection = new Set<string>();
        
        if (event.ctrlKey) {
          // Toggle selection - keep existing selections
          context.selectedCells.forEach(cell => newSelection.add(cell));
          
          if (newSelection.has(event.cellKey)) {
            newSelection.delete(event.cellKey);
          } else {
            newSelection.add(event.cellKey);
          }
        } else if (event.shiftKey) {
          // Shift-click is handled by RANGE_SELECT event from renderer
          // This shouldn't happen, but just in case...
          newSelection.add(event.cellKey);
        } else {
          // Single selection - clear and select only this cell
          newSelection.add(event.cellKey);
        }
        
        return newSelection;
      },
      anchorCell: ({ context, event }) => {
        if (event.type !== 'CELL_CLICK') return context.anchorCell;
        
        // Update anchor cell when not using shift (new selection start)
        if (!event.shiftKey) {
          return {
            key: event.cellKey,
            row: event.row,
            column: event.column
          };
        }
        
        // Keep existing anchor when shift-clicking
        return context.anchorCell;
      },
      shapesVisible: ({ context, event }) => {
        if (event.type !== 'CELL_CLICK') return context.shapesVisible;
        
        // Determine if there will be a selection after this click
        let willHaveSelection = false;
        
        if (event.ctrlKey) {
          // Toggle - will have selection unless we're removing the last cell
          const wouldRemove = context.selectedCells.has(event.cellKey);
          willHaveSelection = wouldRemove ? context.selectedCells.size > 1 : true;
        } else if (event.shiftKey && context.anchorCell) {
          // Range selection - will always have at least one cell
          willHaveSelection = true;
        } else {
          // Single selection - will always have exactly one cell
          willHaveSelection = true;
        }
        
        console.log('OverlayMachine: Setting fillHandle visibility', {
          willHaveSelection,
          currentShapesVisible: context.shapesVisible
        });
        
        return {
          ...context.shapesVisible,
          fillHandle: willHaveSelection
        };
      }
    }),
    
    handleRangeSelect: assign({
      selectedCells: ({ event }) => {
        if (event.type !== 'RANGE_SELECT') return new Set();
        return event.cells;
      },
      anchorCell: ({ event }) => {
        if (event.type !== 'RANGE_SELECT') return null;
        return {
          key: event.anchorKey,
          row: event.anchorRow,
          column: event.anchorColumn
        };
      },
      shapesVisible: ({ context }) => ({
        ...context.shapesVisible,
        fillHandle: true // Always show fill handle after range selection
      })
    }),
    
    updateSelection: assign({
      selectedCells: ({ event }) => 
        event.type === 'SELECTION_UPDATE' ? event.cells : new Set(),
      anchorCell: ({ event }) => {
        if (event.type !== 'SELECTION_UPDATE') return null;
        
        // Set the first cell as anchor when selection is updated externally
        // Since we don't have row/column info here, we can't properly set the anchor
        // This would need to be enhanced to pass row/column data with the update
        return null;
      },
      shapesVisible: ({ context, event }) => {
        if (event.type !== 'SELECTION_UPDATE') return context.shapesVisible;
        
        return {
          ...context.shapesVisible,
          fillHandle: event.cells.size > 0
        };
      }
    }),
    
    calculateSelectionBounds: assign({
      selectionBounds: ({ context }) => {
        if (context.selectedCells.size === 0 || !context.viewport) return null;
        
        // Parse cell keys to find bounds
        let minRow = Infinity, maxRow = -Infinity;
        let minCol = Infinity, maxCol = -Infinity;
        
        // Extract row and column indices from cell keys
        context.selectedCells.forEach(cellKey => {
          // Cell key format is "rowId:columnId"
          // For now, assume rowId and columnId are numeric strings
          const [rowIdStr, colIdStr] = cellKey.split(':');
          
          // Try to parse as numbers for bounds calculation
          // This is a simplified approach - real implementation would use the coordinate system
          const rowNum = parseInt(rowIdStr, 10);
          const colNum = parseInt(colIdStr, 10);
          
          if (!isNaN(rowNum)) {
            minRow = Math.min(minRow, rowNum);
            maxRow = Math.max(maxRow, rowNum);
          }
          
          if (!isNaN(colNum)) {
            minCol = Math.min(minCol, colNum);
            maxCol = Math.max(maxCol, colNum);
          }
        });
        
        // If we couldn't parse any valid bounds, return null
        if (minRow === Infinity || minCol === Infinity) {
          return null;
        }
        
        // Calculate approximate bounds
        // Note: This is still a placeholder - actual implementation should use
        // the coordinate system to get exact pixel positions
        const cellWidth = 100; // Default cell width
        const cellHeight = 40; // Default cell height
        
        return {
          minX: minCol * cellWidth,
          minY: minRow * cellHeight,
          maxX: (maxCol + 1) * cellWidth,
          maxY: (maxRow + 1) * cellHeight
        };
      }
    }),
    
    // Drag actions
    initializeDragState: assign({
      dragState: ({ event }) => {
        if (event.type !== 'DRAG_START') return null;
        
        return {
          isDragging: true,
          startPos: event.startPos,
          startCell: event.startCell,
          currentPos: event.startPos,
          currentCell: event.startCell
        };
      }
    }),
    
    updateDragState: assign({
      dragState: ({ context, event }) => {
        if (event.type !== 'DRAG_MOVE' || !context.dragState) return context.dragState;
        
        return {
          ...context.dragState,
          currentPos: event.currentPos,
          currentCell: event.currentCell
        };
      }
    }),
    
    completeDragSelection: assign({
      selectedCells: ({ event }) => 
        event.type === 'DRAG_END' ? event.cells : new Set(),
      anchorCell: ({ event }) => {
        if (event.type !== 'DRAG_END') return null;
        
        // Set the first cell as anchor after drag selection
        // Since we don't have row/column info here, we can't properly set the anchor
        // This would need to be enhanced to pass row/column data with the drag end
        return null;
      },
      shapesVisible: ({ context, event }) => {
        if (event.type !== 'DRAG_END') return context.shapesVisible;
        
        return {
          ...context.shapesVisible,
          fillHandle: event.cells.size > 0
        };
      }
    }),
    
    clearDragState: assign({
      dragState: null
    }),
    
    enableDragPreview: assign({
      shapesVisible: ({ context }) => ({
        ...context.shapesVisible,
        dragPreview: true
      })
    }),
    
    disableDragPreview: assign({
      shapesVisible: ({ context }) => ({
        ...context.shapesVisible,
        dragPreview: false
      })
    }),
    
    // Fill actions
    initializeFillState: assign({
      fillState: ({ context, event }) => {
        if (event.type !== 'FILL_START') return context.fillState;
        
        console.log('OverlayMachine: Initializing fill state', {
          event,
          selectedCells: context.selectedCells.size,
          direction: event.direction
        });
        
        return {
          isActive: true,
          direction: event.direction,
          originalSelection: new Set(context.selectedCells),
          previewCells: new Set()
        };
      }
    }),
    
    enableFillPreview: assign({
      shapesVisible: ({ context }) => {
        console.log('OverlayMachine: Enabling fill preview', {
          currentShapesVisible: context.shapesVisible,
          fillPreview: true
        });
        
        return {
          ...context.shapesVisible,
          fillPreview: true
        };
      }
    }),
    
    updateFillPreview: assign({
      fillState: ({ context, event }) => {
        if (event.type !== 'FILL_DRAG' || !context.fillState) {
          console.log('OverlayMachine: Fill drag ignored', {
            eventType: event.type,
            hasFillState: !!context.fillState,
            context: context.fillState
          });
          return context.fillState;
        }
        
        console.log('OverlayMachine: Updating fill preview', {
          event,
          previewCells: event.previewCells.size,
          currentFillState: context.fillState
        });
        
        return {
          ...context.fillState,
          previewCells: event.previewCells
        };
      }
    }),
    
    applyFill: assign({
      selectedCells: ({ context, event }) => {
        if (event.type !== 'FILL_COMPLETE') return context.selectedCells;
        
        // Add fill cells to selection
        const newSelection = new Set(context.selectedCells);
        event.fillCells.forEach(cell => newSelection.add(cell));
        return newSelection;
      }
    }),
    
    clearFillState: assign({
      fillState: null,
      shapesVisible: ({ context }) => ({
        ...context.shapesVisible,
        fillPreview: false
      })
    }),
    
    // Edit actions
    setEditingCell: assign({
      editingCell: ({ event }) => 
        event.type === 'EDIT_START' ? event.cell : null
    }),
    
    clearEditingCell: assign({
      editingCell: null
    }),
    
    // Clipboard actions
    copyToClipboard: assign({
      clipboardState: ({ context, event }) => {
        if (event.type !== 'COPY') return context.clipboardState;
        
        return {
          copiedCells: new Set(event.cells),
          isCut: false
        };
      }
    }),
    
    cutToClipboard: assign({
      clipboardState: ({ context, event }) => {
        if (event.type !== 'CUT') return context.clipboardState;
        
        return {
          copiedCells: new Set(event.cells),
          isCut: true
        };
      }
    }),
    
    clearClipboard: assign({
      clipboardState: null
    }),
    
    // Viewport actions
    updateViewport: assign({
      viewport: ({ event }) => 
        event.type === 'VIEWPORT_UPDATE' ? event.viewport : null
    }),
    
    // Render metrics
    updateRenderMetrics: assign({
      lastRenderTime: ({ event }) => 
        event.type === 'RENDER_COMPLETE' ? event.duration : 0
      // Removed renderCount increment to prevent infinite loop
    }),
    
    // Event emitters
    emitSelectionChange: emit(({ context }) => ({
      type: 'overlay.selection.changed',
      selectedCells: context.selectedCells
    })),
    
    emitFillComplete: emit(({ context }) => ({
      type: 'overlay.fill.completed',
      fillState: context.fillState
    })),
    
    emitEditComplete: emit(() => ({
      type: 'overlay.edit.completed'
    })),
    
    emitPasteComplete: emit(() => ({
      type: 'overlay.paste.completed'
    })),
    
    // Placeholder actions
    pasteFromClipboard: () => {
      console.log('Paste action - would be implemented with actual paste logic');
    },
    
    clearCutCells: () => {
      console.log('Clear cut cells - would be implemented');
    }
  }
});

// ====================================
// MACHINE ACTOR TYPE
// ====================================

export type OverlayMachineActor = ReturnType<typeof createActor<typeof overlayMachine>>;