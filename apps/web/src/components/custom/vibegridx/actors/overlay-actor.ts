// ====================================
// OVERLAY ACTOR - Pure Actor for Canvas Overlay Operations
// ====================================

import { fromPromise } from 'xstate';
import type { ViewportInfo, CellRef } from '../types';

// ====================================
// CALCULATION HELPERS
// ====================================

const calculateSelectionBounds = (selectedCells: Set<string>, coordinateMapping: any) => {
  if (!selectedCells.size || !coordinateMapping) {
    return null;
  }
  
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const cellKey of selectedCells) {
    const [rowId, columnId] = cellKey.split(':');
    
    // Find row and column in coordinate mapping
    const rowData = coordinateMapping.rows?.find((r: any) => r.rowId === rowId);
    const colData = coordinateMapping.columns?.find((c: any) => c.columnId === columnId);
    
    if (rowData && colData) {
      const x = colData.offset || 0;
      const y = rowData.sortedIndex * 40; // Assuming 40px row height
      const width = colData.width || 120;
      const height = 40;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }
  }
  
  return minX !== Infinity ? { minX, minY, maxX, maxY } : null;
};

const calculateFillPreview = (
  originalSelection: Set<string>,
  direction: 'vertical' | 'horizontal',
  extent: number,
  coordinateMapping: any
) => {
  const previewCells = new Set<string>();
  
  if (!coordinateMapping || !originalSelection.size) {
    return previewCells;
  }
  
  // Get bounds of original selection
  const bounds = calculateSelectionBounds(originalSelection, coordinateMapping);
  if (!bounds) return previewCells;
  
  // Generate preview cells based on direction and extent
  for (const cellKey of originalSelection) {
    const [rowId, columnId] = cellKey.split(':');
    const rowData = coordinateMapping.rows?.find((r: any) => r.rowId === rowId);
    const colData = coordinateMapping.columns?.find((c: any) => c.columnId === columnId);
    
    if (rowData && colData) {
      if (direction === 'vertical') {
        // Extend vertically
        for (let i = 1; i <= extent; i++) {
          const newRowIndex = rowData.sortedIndex + i;
          const newRowData = coordinateMapping.rows?.find((r: any) => r.sortedIndex === newRowIndex);
          if (newRowData) {
            previewCells.add(`${newRowData.rowId}:${columnId}`);
          }
        }
      } else {
        // Extend horizontally
        for (let i = 1; i <= extent; i++) {
          const newColIndex = coordinateMapping.columns?.findIndex((c: any) => c.columnId === columnId) + i;
          const newColData = coordinateMapping.columns?.[newColIndex];
          if (newColData) {
            previewCells.add(`${rowId}:${newColData.columnId}`);
          }
        }
      }
    }
  }
  
  return previewCells;
};

// ====================================
// ASYNC OPERATIONS
// ====================================

const performSelectionUpdate = fromPromise(async ({ input }: {
  input: { 
    selectedCells: Set<string>; 
    coordinateMapping: any; 
    viewport: ViewportInfo | null 
  }
}) => {
  const { selectedCells, coordinateMapping, viewport } = input;
  
  console.log('OverlayActor: Updating selection', {
    cellCount: selectedCells.size,
    hasCoordinateMapping: !!coordinateMapping,
    hasViewport: !!viewport
  });
  
  // Calculate selection bounds
  const bounds = calculateSelectionBounds(selectedCells, coordinateMapping);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    success: true,
    selectedCells: Array.from(selectedCells),
    bounds,
    timestamp: Date.now()
  };
});

const performFillOperation = fromPromise(async ({ input }: {
  input: { 
    originalSelection: Set<string>; 
    direction: 'vertical' | 'horizontal'; 
    extent: number; 
    coordinateMapping: any 
  }
}) => {
  const { originalSelection, direction, extent, coordinateMapping } = input;
  
  console.log('OverlayActor: Performing fill operation', {
    originalCells: originalSelection.size,
    direction,
    extent
  });
  
  // Calculate fill preview
  const previewCells = calculateFillPreview(originalSelection, direction, extent, coordinateMapping);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return {
    success: true,
    originalSelection: Array.from(originalSelection),
    previewCells: Array.from(previewCells),
    direction,
    extent,
    timestamp: Date.now()
  };
});

const performClipboardOperation = fromPromise(async ({ input }: {
  input: { 
    operation: 'copy' | 'cut' | 'paste' | 'clear'; 
    cells: Set<string>; 
    target?: string 
  }
}) => {
  const { operation, cells, target } = input;
  
  console.log('OverlayActor: Performing clipboard operation', {
    operation,
    cellCount: cells.size,
    target
  });
  
  // Simulate clipboard processing
  await new Promise(resolve => setTimeout(resolve, 25));
  
  return {
    success: true,
    operation,
    cells: Array.from(cells),
    target,
    timestamp: Date.now()
  };
});

const performViewportUpdate = fromPromise(async ({ input }: {
  input: { 
    viewport: ViewportInfo; 
    selectedCells: Set<string>; 
    coordinateMapping: any 
  }
}) => {
  const { viewport, selectedCells, coordinateMapping } = input;
  
  console.log('OverlayActor: Updating viewport', {
    scrollTop: viewport.scrollTop,
    scrollLeft: viewport.scrollLeft,
    selectedCells: selectedCells.size
  });
  
  // Recalculate visible selections based on new viewport
  const visibleCells = new Set<string>();
  
  for (const cellKey of selectedCells) {
    const [rowId] = cellKey.split(':');
    const rowData = coordinateMapping?.rows?.find((r: any) => r.rowId === rowId);
    
    if (rowData) {
      const rowIndex = rowData.sortedIndex;
      if (rowIndex >= viewport.start && rowIndex <= viewport.end) {
        visibleCells.add(cellKey);
      }
    }
  }
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 5));
  
  return {
    success: true,
    viewport,
    visibleCells: Array.from(visibleCells),
    timestamp: Date.now()
  };
});

// ====================================
// PURE OVERLAY ACTOR
// ====================================

export const overlayActor = fromPromise(async ({ input }: {
  input: { 
    type: string;
    [key: string]: any;
  }
}) => {
  const { type } = input;
  
  console.log('OverlayActor: Processing operation', { type, input });
  
  switch (type) {
    case 'UPDATE_SELECTION':
      return await performSelectionUpdate({ input });
      
    case 'FILL_OPERATION':
      return await performFillOperation({ input });
      
    case 'CLIPBOARD_OPERATION':
      return await performClipboardOperation({ input });
      
    case 'VIEWPORT_UPDATE':
      return await performViewportUpdate({ input });
      
    case 'CALCULATE_BOUNDS':
      const bounds = calculateSelectionBounds(input.selectedCells, input.coordinateMapping);
      return { success: true, bounds };
      
    case 'CALCULATE_FILL_PREVIEW':
      const previewCells = calculateFillPreview(
        input.originalSelection,
        input.direction,
        input.extent,
        input.coordinateMapping
      );
      return { success: true, previewCells: Array.from(previewCells) };
      
    default:
      console.warn('OverlayActor: Unknown operation type', { type });
      return { success: false, error: `Unknown operation: ${type}` };
  }
});