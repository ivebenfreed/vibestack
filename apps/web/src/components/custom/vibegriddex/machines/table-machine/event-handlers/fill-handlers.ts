// ====================================
// FILL EVENT HANDLERS - Pure Actors Approach
// ====================================

import { emit } from 'xstate';
import { overlayActions } from '../slices/overlay-slice';

// ====================================
// FILL PATTERN DETECTION
// ====================================

interface FillPattern {
  type: 'copy' | 'series' | 'increment';
  values: Map<string, any[]>; // columnId -> values pattern
  increment?: number; // For numeric series
}

function calculateFillPattern(originalCells: Set<string>, fillCells: Set<string>, context: any): FillPattern | null {
  // Parse original cells to get column values
  const columnValues = new Map<string, any[]>();
  const columnTypes = new Map<string, string>();
  
  // Group original cells by column
  originalCells.forEach(cellKey => {
    const [rowId, columnId] = cellKey.split(':');
    const row = context.rows.find((r: any) => r.id === rowId);
    const column = context.columns.find((c: any) => c.id === columnId);
    
    if (row && column) {
      if (!columnValues.has(columnId)) {
        columnValues.set(columnId, []);
        columnTypes.set(columnId, column.cellType || 'text');
      }
      const field = column.field || columnId;
      const value = row.data[field];
      
      console.log('TableMachine: Extracting value for fill pattern', {
        cellKey,
        rowId,
        columnId,
        field,
        value,
        rowData: row.data
      });
      
      columnValues.get(columnId)!.push(value);
    }
  });
  
  // Detect pattern for each column
  const pattern: FillPattern = {
    type: 'copy',
    values: new Map()
  };
  
  columnValues.forEach((values, columnId) => {
    const columnType = columnTypes.get(columnId) || 'text';
    
    if (values.length === 0) return;
    
    // For single value, always copy
    if (values.length === 1) {
      pattern.values.set(columnId, values);
      return;
    }
    
    // Check for numeric series
    if (columnType === 'number' && values.every(v => typeof v === 'number')) {
      const numValues = values as number[];
      
      // Check for arithmetic progression
      if (numValues.length >= 2) {
        const diff = numValues[1] - numValues[0];
        let isArithmetic = true;
        
        for (let i = 2; i < numValues.length; i++) {
          if (numValues[i] - numValues[i-1] !== diff) {
            isArithmetic = false;
            break;
          }
        }
        
        if (isArithmetic && diff !== 0) {
          pattern.type = 'increment';
          pattern.increment = diff;
          pattern.values.set(columnId, numValues);
          return;
        }
      }
    }
    
    // Default to repeating the pattern
    pattern.values.set(columnId, values);
  });
  
  return pattern;
}

// ====================================
// FILL PATTERN APPLICATION
// ====================================

function applyFillPattern(pattern: FillPattern, fillCells: Set<string>, context: any): void {
  if (!context.onEntityUpdate) {
    console.error('TableMachine: Cannot apply fill - no update handler');
    return;
  }
  
  // Group fill cells by row for batch updates
  const updatesByRow = new Map<string, Record<string, any>>();
  
  // Calculate starting indices for pattern continuation
  const patternIndices = new Map<string, number>();
  pattern.values.forEach((values, columnId) => {
    patternIndices.set(columnId, 0);
  });
  
  // Sort fill cells to ensure consistent pattern application
  const sortedFillCells = Array.from(fillCells).sort((a, b) => {
    const [rowIdA, colIdA] = a.split(':');
    const [rowIdB, colIdB] = b.split(':');
    
    // Sort by row index first, then column
    const rowIndexA = context.allRowIds.indexOf(rowIdA);
    const rowIndexB = context.allRowIds.indexOf(rowIdB);
    
    if (rowIndexA !== rowIndexB) {
      return rowIndexA - rowIndexB;
    }
    return colIdA.localeCompare(colIdB);
  });
  
  // Get original cells for exclusion
  const originalCells = context.fillState?.originalSelection || new Set();
  
  // Apply pattern to each fill cell (excluding original selection)
  sortedFillCells.forEach(cellKey => {
    // Skip if this is an original cell
    if (originalCells.has(cellKey)) {
      console.log('TableMachine: Skipping original cell', cellKey);
      return;
    }
    
    const [rowId, columnId] = cellKey.split(':');
    const column = context.columns.find((c: any) => c.id === columnId);
    
    if (!column || !pattern.values.has(columnId)) return;
    
    const values = pattern.values.get(columnId)!;
    const patternIndex = patternIndices.get(columnId) || 0;
    
    let fillValue: any;
    
    if (pattern.type === 'increment' && pattern.increment) {
      // Calculate next value in series
      const lastValue = values[values.length - 1];
      const stepsFromLast = Math.floor(patternIndex / values.length) + 1;
      fillValue = lastValue + (pattern.increment * stepsFromLast);
    } else {
      // Repeat pattern
      fillValue = values[patternIndex % values.length];
    }
    
    console.log('TableMachine: Fill cell', {
      cellKey,
      rowId,
      columnId,
      field: column.field,
      patternIndex,
      fillValue,
      patternType: pattern.type
    });
    
    // Add to batch update
    if (!updatesByRow.has(rowId)) {
      updatesByRow.set(rowId, {});
    }
    updatesByRow.get(rowId)![column.field || columnId] = fillValue;
    
    // Increment pattern index for this column
    patternIndices.set(columnId, patternIndex + 1);
  });
  
  // Apply batch updates - use batch operation if available
  if (updatesByRow.size > 0) {
    const batchUpdates = Array.from(updatesByRow.entries()).map(([rowId, updates]) => ({
      id: rowId,
      updates
    }));
    
    console.log('TableMachine: Applying batch fill updates', { 
      updateCount: batchUpdates.length,
      updates: batchUpdates 
    });
    
    // Check if context has a batch update function
    if (context.onBatchEntityUpdate && typeof context.onBatchEntityUpdate === 'function') {
      // Use batch update for better performance
      try {
        const result = context.onBatchEntityUpdate(batchUpdates);
        if (result instanceof Promise) {
          result.catch((error: any) => {
            console.error('TableMachine: Batch fill update failed', { error });
          });
        }
      } catch (error) {
        console.error('TableMachine: Batch fill update threw error', { error });
      }
    } else {
      // Fall back to individual updates
      updatesByRow.forEach((updates, rowId) => {
        console.log('TableMachine: Applying individual fill update', { rowId, updates });
        
        try {
          const result = context.onEntityUpdate(rowId, updates);
          if (result instanceof Promise) {
            result.catch((error: any) => {
              console.error('TableMachine: Fill update failed', { rowId, error });
            });
          }
        } catch (error) {
          console.error('TableMachine: Fill update threw error', { rowId, error });
        }
      });
    }
  }
  
  // Show success notification
  if (context.onNotification) {
    const updateCount = updatesByRow.size;
    const cellCount = fillCells.size - originalCells.size;
    if (cellCount > 0) {
      context.onNotification(
        `Filled ${cellCount} cells in ${updateCount} rows`, 
        'success'
      );
    }
  }
}

export const fillHandlers = {
  'FILL_CELLS_CALCULATED': {
    actions: [
      // Apply the fill data to the actual cells
      ({ context, event }: any) => {
        const fillCells = event.fillCells;
        if (!fillCells || fillCells.size === 0) {
          console.log('TableMachine: No fill cells calculated');
          return;
        }
        
        const originalSelection = context.fillState?.originalSelection || context.selectedCells;
        
        if (originalSelection.size === 0) {
          console.log('TableMachine: No original selection for fill');
          return;
        }
        
        // Calculate the fill pattern
        const fillPattern = calculateFillPattern(originalSelection, fillCells, context);
        
        if (!fillPattern) {
          console.log('TableMachine: Could not determine fill pattern');
          return;
        }
        
        console.log('TableMachine: Fill operation completing with calculated cells', {
          originalCells: originalSelection.size,
          fillCells: fillCells.size,
          pattern: fillPattern,
          originalCellsArray: Array.from(originalSelection),
          fillCellsArray: Array.from(fillCells)
        });
        
        // Apply the pattern to fill cells
        applyFillPattern(fillPattern, fillCells, context);
      },

      // Clear fill preview from canvas
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({ type: 'CLEAR_FILL_PREVIEW' });
        }
      },

      // Complete the fill operation in overlay state
      overlayActions.completeFill,

      // Emit fill complete event
      emit(({ context, event }: any) => ({
        type: 'vibegridx.fill.complete',
        originalCells: context.fillState?.originalSelection || context.selectedCells,
        fillCells: event.fillCells
      }))
    ]
  },
  
  'FILL_START': {
    actions: [
      // Update overlay state to start fill
      overlayActions.startFill,
      
      // Log fill start
      ({ event }: any) => {
        console.log('TableMachine: Fill operation started', {
          direction: event.direction
        });
      },

      // Emit fill start event
      emit(({ context, event }: any) => ({
        type: 'vibegridx.fill.start',
        originalCells: context.selectedCells,
        direction: event.direction
      }))
    ]
  },

  'FILL_MOVE': {
    actions: [
      ({ context, event }: any) => {
        if (!context.actors.canvasActor || !context.viewport) return;
        
        // Get the fill handle layer from canvas to calculate preview cells
        context.actors.canvasActor.send({
          type: 'CALCULATE_FILL_PREVIEW',
          dragPos: { x: event.x, y: event.y },
          selectedCells: context.selectedCells,
          viewport: context.viewport
        });
      }
    ]
  },

  'FILL_PREVIEW': {
    actions: [
      // Update overlay state with preview cells
      overlayActions.updateFillPreview,
      
      // Log preview update
      ({ event }: any) => {
        console.log('TableMachine: Fill preview updated', {
          previewCellsCount: event.previewCells.size
        });
      },

      // Send fill preview to canvas actor for visual rendering
      ({ context, event }: any) => {
        if (context.actors.canvasActor && context.viewport) {
          context.actors.canvasActor.send({
            type: 'RENDER_FILL_PREVIEW',
            previewCells: event.previewCells,
            viewport: context.viewport
          });
        }
      }
    ]
  },

  'FILL_COMPLETE': {
    actions: [
      // Clear fill preview from canvas
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({ type: 'CLEAR_FILL_PREVIEW' });
        }
      },
      
      // Apply the fill data to the actual cells
      ({ context, event }: any) => {
        // If we have coordinates, we need to calculate the fill cells first
        if (event.x !== undefined && event.y !== undefined && context.actors.canvasActor) {
          // Request the canvas to calculate final fill cells
          context.actors.canvasActor.send({
            type: 'CALCULATE_FILL_COMPLETE',
            dragPos: { x: event.x, y: event.y },
            selectedCells: context.selectedCells,
            viewport: context.viewport
          });
          return;
        }
        
        // If we already have fillCells (from the canvas calculation), apply them
        const fillCells = event.fillCells;
        if (!fillCells) return;
        
        const originalSelection = context.fillState?.originalSelection || new Set();
        
        if (fillCells.size === 0 || originalSelection.size === 0) {
          console.log('TableMachine: Fill operation cancelled - no cells to fill', {
            fillCellsSize: fillCells.size,
            originalSelectionSize: originalSelection.size,
            fillCells: Array.from(fillCells),
            originalSelection: Array.from(originalSelection)
          });
          return;
        }
        
        // Calculate the fill pattern
        const fillPattern = calculateFillPattern(originalSelection, fillCells, context);
        
        if (!fillPattern) {
          console.log('TableMachine: Could not determine fill pattern');
          return;
        }
        
        console.log('TableMachine: Fill operation completed', {
          originalCells: originalSelection.size,
          fillCells: fillCells.size,
          pattern: fillPattern
        });
        
        // Apply the pattern to fill cells
        applyFillPattern(fillPattern, fillCells, context);
      },

      // Emit fill complete event
      emit(({ context, event }: any) => ({
        type: 'vibegridx.fill.complete',
        originalCells: context.fillState?.originalSelection || new Set(),
        fillCells: event.fillCells
      }))
    ]
  },

  'FILL_CANCEL': {
    actions: [
      // Cancel the fill operation in overlay state
      overlayActions.cancelFill,
      
      // Clear fill preview from canvas
      ({ context }: any) => {
        if (context.actors.canvasActor) {
          context.actors.canvasActor.send({ type: 'CLEAR_FILL_PREVIEW' });
        }
      },
      
      ({ context }: any) => {
        console.log('TableMachine: Fill operation cancelled');
      }
    ]
  }
};