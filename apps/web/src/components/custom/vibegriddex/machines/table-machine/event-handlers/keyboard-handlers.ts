// ====================================
// KEYBOARD EVENT HANDLERS
// ====================================

import { sendTo, assign } from 'xstate';
import { selectionActions } from '../slices/selection-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

// Helper function to parse external clipboard data
function parseExternalClipboard(text: string, startRow: number, startCol: number) {
  const lines = text.split('\n').filter(line => line.length > 0);
  return { lines };
}

export const keyboardHandlers = {
  'keyboard.arrow': {
    guard: ({ context }) => {
      // Don't process arrow keys when editing a cell - let the input handle them
      return !context.editingCell;
    },
    actions: [
      // Update selection based on arrow key
      selectionActions.moveSelection,
      
      // Send visual update to canvas
      ({ context, self }) => {
        const visualPositions = calculateVisualPositions(
          context.selectedCells,
          context.coordinateMapping,
          context.viewport,
          context.rowHeight
        );
        
        if (context.actors.canvasActor && visualPositions.length > 0) {
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'UPDATE_SELECTION_VISUAL',
              visualCells: visualPositions
            }
          });
          
          // Also update fill handle position
          self.send({
            type: 'FORWARD_TO_CANVAS',
            event: {
              type: 'RENDER_FILL_HANDLE',
              visualCells: visualPositions,
              viewport: context.viewport
            }
          });
        }
      },
      
      ({ event }) => {
        console.log('TableMachine: Arrow key navigation', {
          direction: event.direction,
          extend: event.extend
        });
      }
    ]
  },
  
  'keyboard.copy': {
    guard: ({ context }) => {
      // Don't process copy when editing a cell - let the input handle Ctrl+C
      return !context.editingCell;
    },
    actions: [
      // Build rich clipboard data
      ({ context, self }) => {
        if (context.selectedCells.size === 0) {
          console.log('TableMachine: No cells selected for copy');
          return;
        }

        // Build clipboard data structure
        const cells: any[] = [];
        const columnIds = new Set<string>();
        const columnTypes: Record<string, string> = {};
        let minRow = Infinity, maxRow = -Infinity;
        let minCol = Infinity, maxCol = -Infinity;

        // Process selected cells
        for (const cellKey of context.selectedCells) {
          const [rowId, columnId] = cellKey.split(':');
          const row = context.entities.find(e => e.id === rowId);
          const column = context.columns.find(c => c.id === columnId);
          
          if (!row || !column) continue;

          // Get row and column indices from coordinate mapping
          const rowData = context.coordinateMapping?.rows.find(r => r.rowId === rowId);
          const colData = context.coordinateMapping?.columns.find(c => c.columnId === columnId);
          
          if (!rowData || !colData) continue;

          const rowIndex = rowData.sortedIndex;
          const columnIndex = colData.index;

          // Track bounds
          minRow = Math.min(minRow, rowIndex);
          maxRow = Math.max(maxRow, rowIndex);
          minCol = Math.min(minCol, columnIndex);
          maxCol = Math.max(maxCol, columnIndex);

          // Build cell data
          const field = column.field || columnId;
          const value = row[field];
          let displayValue = value;

          // Handle special column types
          if (column.cellType?.startsWith('relationship')) {
            const resolver = context.relationshipResolvers?.[columnId];
            if (resolver && value != null) {
              displayValue = resolver(value);
            }
          } else if (column.cellType === 'enum' && column.options) {
            const option = column.options.find(opt => 
              typeof opt === 'string' ? opt === value : opt.value === value
            );
            displayValue = typeof option === 'string' ? option : option?.label || value;
          }

          cells.push({
            rowId,
            columnId,
            value,
            displayValue: String(displayValue || ''),
            rowIndex,
            columnIndex,
            field
          });

          columnIds.add(columnId);
          columnTypes[columnId] = column.cellType || 'text';
        }

        // Create clipboard data
        const clipboardData: any = {
          cells,
          bounds: {
            startRow: minRow,
            startCol: minCol,
            endRow: maxRow,
            endCol: maxCol,
            rowCount: maxRow - minRow + 1,
            colCount: maxCol - minCol + 1
          },
          columnIds: Array.from(columnIds).sort((a, b) => {
            const aCol = context.coordinateMapping?.columns.find(c => c.columnId === a);
            const bCol = context.coordinateMapping?.columns.find(c => c.columnId === b);
            return (aCol?.index || 0) - (bCol?.index || 0);
          }),
          columnTypes,
          timestamp: Date.now(),
          isCut: false
        };

        // Send event to update clipboard state
        self.send({
          type: 'CLIPBOARD_SET',
          clipboardData
        });

        // Also copy to system clipboard as tab-delimited text
        const sortedCells = cells.sort((a, b) => {
          if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
          return a.columnIndex - b.columnIndex;
        });

        // Build tab-delimited text
        let clipboardText = '';
        let currentRow = minRow;
        
        for (const cell of sortedCells) {
          // Add newlines for row changes
          while (currentRow < cell.rowIndex) {
            clipboardText += '\n';
            currentRow++;
          }
          
          // Add tabs for column gaps (if any)
          if (cell.rowIndex === currentRow && cell.columnIndex > minCol) {
            const prevCell = sortedCells[sortedCells.indexOf(cell) - 1];
            if (prevCell && prevCell.rowIndex === currentRow) {
              const colGap = cell.columnIndex - prevCell.columnIndex - 1;
              clipboardText += '\t'.repeat(colGap + 1);
            } else {
              clipboardText += '\t'.repeat(cell.columnIndex - minCol);
            }
          }
          
          clipboardText += cell.displayValue;
        }

        // Copy to system clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(clipboardText)
            .then(() => {
              console.log('TableMachine: Copied to clipboard', {
                cellCount: cells.length,
                bounds: clipboardData.bounds,
                text: clipboardText
              });
            })
            .catch(err => {
              console.error('TableMachine: Failed to copy to clipboard', err);
            });
        }
      }
    ]
  },
  
  'keyboard.paste': {
    guard: ({ context }) => {
      // Don't process paste when editing a cell - let the input handle Ctrl+V
      return !context.editingCell;
    },
    actions: [
      // Handle paste operation with column validation
      ({ context, self, event }) => {
        // Check if we have internal clipboard data
        const internalClipboard = context.clipboardState;
        
        // Check if we have selected cells to paste to
        if (context.selectedCells.size === 0) {
          console.log('TableMachine: No target cells selected for paste');
          return;
        }

        // Get the first selected cell as paste anchor
        const firstCellKey = Array.from(context.selectedCells)[0];
        const [targetRowId, targetColumnId] = firstCellKey.split(':');
        
        // Get target row and column indices
        const targetRowData = context.coordinateMapping?.rows.find(r => r.rowId === targetRowId);
        const targetColData = context.coordinateMapping?.columns.find(c => c.columnId === targetColumnId);
        
        if (!targetRowData || !targetColData) {
          console.error('TableMachine: Could not find target cell coordinates');
          return;
        }

        let pasteData: any;

        // Try internal clipboard first
        if (internalClipboard && internalClipboard.cells.length > 0) {
          // Validate column compatibility
          const firstCopiedColumnId = internalClipboard.columnIds[0];
          
          // Check if paste starts in compatible column
          if (firstCopiedColumnId !== targetColumnId) {
            // Check column type compatibility
            const sourceType = internalClipboard.columnTypes[firstCopiedColumnId];
            const targetColumn = context.columns.find(c => c.id === targetColumnId);
            const targetType = targetColumn?.cellType || 'text';
            
            if (sourceType !== targetType) {
              console.error('TableMachine: Cannot paste - column types do not match', {
                source: { id: firstCopiedColumnId, type: sourceType },
                target: { id: targetColumnId, type: targetType }
              });
              
              // Send notification to user
              if (context.onNotification) {
                context.onNotification('Cannot paste: Column types do not match. Paste must start in a column with the same type.', 'error');
              }
              
              // Emit error event for UI feedback
              self.send({
                type: 'PASTE_ERROR',
                message: 'Cannot paste: Column types do not match. Paste must start in a column with the same type.'
              });
              return;
            }
          }
          
          pasteData = internalClipboard;
        } else {
          // Try external clipboard - need to handle async operation differently
          navigator.clipboard.readText()
            .then(clipboardText => {
              if (!clipboardText) {
                console.log('TableMachine: No clipboard data available');
                return;
              }
              
              // Parse external clipboard data (tab-delimited)
              const externalPasteData = parseExternalClipboard(clipboardText, targetRowData.sortedIndex, targetColData.index);
              
              // Process external paste in a separate event
              self.send({
                type: 'PASTE_EXTERNAL',
                clipboardText,
                targetRowId,
                targetColumnId,
                targetRowIndex: targetRowData.sortedIndex,
                targetColIndex: targetColData.index
              });
            })
            .catch(err => {
              console.error('TableMachine: Failed to read clipboard', err);
            });
          
          // Exit early for external paste - will be handled by PASTE_EXTERNAL event
          return;
        }

        // Calculate paste targets for internal paste
        const updates: Array<{ rowId: string; columnId: string; field: string; value: any }> = [];
        
        // Process internal paste with rich data
        if (pasteData) {
          const sourceStartRow = pasteData.bounds.startRow;
          const sourceStartCol = pasteData.bounds.startCol;
          const rows = context.coordinateMapping?.rows || [];
          const cols = context.coordinateMapping?.columns || [];
          
          for (const cell of pasteData.cells) {
            // Calculate target position based on relative offset
            const rowOffset = cell.rowIndex - sourceStartRow;
            const colOffset = cell.columnIndex - sourceStartCol;
            
            const targetRowIndex = targetRowData.sortedIndex + rowOffset;
            const targetColIndex = targetColData.index + colOffset;
            
            // Check bounds
            if (targetRowIndex >= rows.length || targetColIndex >= cols.length) {
              continue;
            }
            
            const targetRow = rows[targetRowIndex];
            const targetCol = cols[targetColIndex];
            const column = context.columns.find(c => c.id === targetCol.columnId);
            
            // Validate column is editable
            if (column && !column.readOnly && column.editable !== false) {
              // Additional type checking for internal paste
              const sourceColumnId = cell.columnId;
              const sourceType = pasteData.columnTypes[sourceColumnId];
              const targetType = column.cellType || 'text';
              
              // Allow paste if same column or same type
              if (sourceColumnId === targetCol.columnId || sourceType === targetType) {
                updates.push({
                  rowId: targetRow.rowId,
                  columnId: targetCol.columnId,
                  field: column.field || targetCol.columnId,
                  value: cell.value
                });
              }
            }
          }
        }

        // Apply updates
        if (updates.length > 0) {
          console.log('TableMachine: Applying internal paste updates', {
            updateCount: updates.length
          });
          
          // Apply updates using batch operation if available
          if (context.onBatchEntityUpdate && typeof context.onBatchEntityUpdate === 'function') {
            console.log('TableMachine: Using batch update for paste operations');
            
            // Group updates by row for batch operation
            const updatesByRow = new Map<string, Record<string, any>>();
            for (const update of updates) {
              if (!updatesByRow.has(update.rowId)) {
                updatesByRow.set(update.rowId, {});
              }
              updatesByRow.get(update.rowId)![update.field] = update.value;
            }
            
            // Convert to batch update format
            const batchUpdates = Array.from(updatesByRow.entries()).map(([rowId, updates]) => ({
              id: rowId,
              updates
            }));
            
            try {
              const result = context.onBatchEntityUpdate(batchUpdates);
              if (result instanceof Promise) {
                result.catch((error: any) => {
                  console.error('TableMachine: Batch paste update failed', { error });
                });
              }
            } catch (error) {
              console.error('TableMachine: Batch paste update threw error', { error });
            }
          } else if (context.onEntityUpdate) {
            // Fall back to individual updates
            console.log('TableMachine: Using individual updates for paste operations');
            
            for (const update of updates) {
              const updateData = { [update.field]: update.value };
              console.log('TableMachine: Updating via onEntityUpdate', {
                rowId: update.rowId,
                field: update.field,
                value: update.value
              });
              
              try {
                const result = context.onEntityUpdate(update.rowId, updateData);
                if (result instanceof Promise) {
                  result.catch((error: any) => {
                    console.error('TableMachine: onEntityUpdate failed', { rowId: update.rowId, error });
                  });
                }
              } catch (error) {
                console.error('TableMachine: onEntityUpdate threw error', { rowId: update.rowId, error });
              }
            }
          } else {
            console.error('TableMachine: No update mechanism available (onEntityUpdate not provided)');
          }
          
          // Clear clipboard visual feedback after successful paste
          self.send({ type: 'CLIPBOARD_CLEAR' });
          
          // Also clear if it was a cut operation
          if (pasteData && pasteData.isCut) {
            // Already cleared above
          }
        } else {
          console.log('TableMachine: No valid paste targets found');
        }
      }
    ]
  },
  
  'keyboard.delete': {
    guard: ({ context }) => {
      // Don't process delete when in editing mode
      return !context.editingCell;
    },
    actions: [
      // TODO: Delete functionality not implemented
      // editCoordinator was supposed to handle this but was never created
      // Need to implement cell deletion logic
      
      ({ context }) => {
        console.log('TableMachine: Delete operation', {
          cellCount: context.selectedCells.size
        });
      }
    ]
  },
  
  'keyboard.enter': {
    actions: [
      ({ context, event, self }) => {
        if (context.editingCell) {
          // If editing, commit the edit and handle navigation if desired
          self.send({ 
            type: 'edit.commit',
            value: context.editValue // Use current edit value
          });
          
          // Navigate after committing if not Shift+Enter
          if (!event.shift) {
            self.send({
              type: 'keyboard.arrow',
              direction: 'down'
            });
          } else {
            self.send({
              type: 'keyboard.arrow',
              direction: 'up'
            });
          }
        } else {
          // If not editing, start editing the active cell
          const activeCell = context.activeCell;
          if (activeCell) {
            self.send({
              type: 'edit.cell.start',
              rowId: activeCell.rowId,
              columnId: activeCell.columnId
            });
          }
        }
      }
    ]
  },
  
  'keyboard.tab': {
    guard: ({ context }) => {
      // Don't process tab when editing a cell - let the input handle tab navigation
      return !context.editingCell;
    },
    actions: [
      ({ context, event, self }) => {
        // Tab navigation
        if (event.shift) {
          // Shift+Tab: Move left
          self.send({
            type: 'keyboard.arrow',
            direction: 'left'
          });
        } else {
          // Tab: Move right
          self.send({
            type: 'keyboard.arrow',
            direction: 'right'
          });
        }
      }
    ]
  },
  
  'keyboard.escape': {
    actions: [
      ({ context, self }) => {
        if (context.editingCell) {
          // If editing, cancel the edit
          self.send({ type: 'edit.cancel' });
          console.log('TableMachine: Escape - cancelled editing');
        } else {
          // If not editing, clear selection and clipboard
          self.send({ type: 'selection.clear' });
          self.send({ type: 'CLIPBOARD_CLEAR' });
          console.log('TableMachine: Escape - cleared selection and clipboard');
        }
      }
    ]
  }
};