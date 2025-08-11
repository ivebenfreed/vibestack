// ====================================
// CLIPBOARD EVENT HANDLERS
// ====================================

import { overlayActions } from '../slices/overlay-slice';
import { calculateVisualPositions } from '../helpers/visual-position-helpers';

export const clipboardHandlers = {
  'CLIPBOARD_SET': {
    actions: [
      // Update clipboard state
      overlayActions.setClipboard,
      
      // Send to canvas for visual feedback
      ({ context, event }: any) => {
        if (context.actors.canvasActor && event.clipboardData && context.coordinateMapping && context.viewport) {
          // Extract cell keys from clipboard data for visual indicator
          const cellKeys = new Set(event.clipboardData.cells.map(
            (cell: any) => `${cell.rowId}:${cell.columnId}`
          ));
          
          // Calculate visual positions for clipboard cells
          const visualPositions = calculateVisualPositions(
            cellKeys,
            context.coordinateMapping,
            context.viewport,
            context.rowHeight
          );
          
          context.actors.canvasActor.send({
            type: 'UPDATE_CLIPBOARD_VISUAL',
            clipboardState: {
              copiedCells: cellKeys,
              isCut: event.clipboardData.isCut,
              visualPositions // Pass pre-calculated positions
            },
            viewport: context.viewport
          });
        }
      },
      
      ({ event }: any) => {
        if (event.clipboardData) {
          console.log('TableMachine: Clipboard data set', {
            cellCount: event.clipboardData.cells.length,
            bounds: event.clipboardData.bounds,
            columnIds: event.clipboardData.columnIds
          });
        }
      }
    ]
  },
  
  'CLIPBOARD_CLEAR': {
    actions: [
      // Clear clipboard state
      overlayActions.clearClipboard,
      
      // Clear visual feedback
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({
            type: 'UPDATE_CLIPBOARD_VISUAL',
            clipboardState: null,
            viewport: context.viewport
          });
          
          // Also send direct clipboard clear for DOM indicators
          context.actors.canvasActor.send({
            type: 'CLIPBOARD_CLEAR'
          });
        }
      },
      
      () => {
        console.log('TableMachine: Clipboard cleared');
      }
    ]
  },
  
  'PASTE_ERROR': {
    actions: [
      ({ context, event }: any) => {
        console.error('TableMachine: Paste error', event.message);
        
        // Notification is already shown by the keyboard handler that sends this event
        // Don't show duplicate notification here
      }
    ]
  },
  
  'PASTE_EXTERNAL': {
    actions: [
      ({ context, self, event }: any) => {
        console.log('TableMachine: Processing external paste', {
          clipboardText: event.clipboardText,
          targetRow: event.targetRowId,
          targetCol: event.targetColumnId
        });
        
        // Parse the clipboard text
        const lines = event.clipboardText.split('\n').filter((line: string) => line.length > 0);
        const rows = context.coordinateMapping?.rows || [];
        const cols = context.coordinateMapping?.columns || [];
        const updates: Array<{ rowId: string; columnId: string; field: string; value: any }> = [];
        
        for (let i = 0; i < lines.length; i++) {
          const rowIndex = event.targetRowIndex + i;
          if (rowIndex >= rows.length) break;
          
          const targetRow = rows[rowIndex];
          const values = lines[i].split('\t');
          
          for (let j = 0; j < values.length; j++) {
            const colIndex = event.targetColIndex + j;
            if (colIndex >= cols.length) break;
            
            const targetCol = cols[colIndex];
            const column = context.columns.find((c: any) => c.id === targetCol.columnId);
            
            if (column && !column.readOnly && column.editable !== false) {
              updates.push({
                rowId: targetRow.rowId,
                columnId: targetCol.columnId,
                field: column.field || targetCol.columnId,
                value: values[j]
              });
            }
          }
        }
        
        // Apply updates
        if (updates.length > 0) {
          console.log('TableMachine: Applying external paste updates', {
            updateCount: updates.length
          });
          
          if (context.onEntityUpdate) {
            for (const update of updates) {
              const updateData = { [update.field]: update.value };
              try {
                const result = context.onEntityUpdate(update.rowId, updateData);
                if (result instanceof Promise) {
                  result.catch((error: any) => {
                    console.error('TableMachine: External paste onEntityUpdate failed', { rowId: update.rowId, error });
                  });
                }
              } catch (error) {
                console.error('TableMachine: External paste onEntityUpdate threw error', { rowId: update.rowId, error });
              }
            }
          }
          
          // Clear clipboard visual feedback after successful external paste
          self.send({ type: 'CLIPBOARD_CLEAR' });
        }
      }
    ]
  }
};