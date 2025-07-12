// ====================================
// VISUAL POSITION HELPERS
// ====================================

import type { ViewportInfo } from '../../../types';
import type { VisualCellPosition } from '../../../overlays/OverlayTypes';

/**
 * Calculate visual positions for selected cells based on viewport
 */
export const calculateVisualPositions = (
  selectedCells: Set<string>,
  coordinateMapping: any,
  viewport: ViewportInfo | null,
  rowHeight: number
): VisualCellPosition[] => {
  console.log('calculateVisualPositions:', {
    selectedCells: Array.from(selectedCells),
    hasCoordinateMapping: !!coordinateMapping,
    viewport,
    rowHeight
  });
  
  if (!viewport || !coordinateMapping) return [];
  
  const visualPositions: VisualCellPosition[] = [];
  
  for (const cellKey of selectedCells) {
    const [rowId, columnId] = cellKey.split(':');
    
    // Debug coordinate mapping structure
    if (selectedCells.size === 1) { // Only log once
      console.log('Coordinate mapping structure:', {
        rowsCount: coordinateMapping.rows?.length,
        firstRow: coordinateMapping.rows?.[0],
        columnsCount: coordinateMapping.columns?.length,
        firstColumn: coordinateMapping.columns?.[0]
      });
    }
    
    // Find row in coordinate mapping
    const rowData = coordinateMapping.rows.find((r: any) => r.rowId === rowId);
    if (!rowData) {
      console.log('Row not found in coordinate mapping:', rowId);
      continue;
    }
    
    // Find column in coordinate mapping
    const colData = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
    if (!colData) {
      console.log('Column not found in coordinate mapping:', columnId);
      continue;
    }
    
    const absoluteRowIndex = rowData.sortedIndex;
    console.log('Row found:', { rowId, absoluteRowIndex, viewport });
    
    // Check if row is in viewport
    if (absoluteRowIndex < viewport.start || absoluteRowIndex > viewport.end) {
      console.log('Row outside viewport:', { absoluteRowIndex, viewportStart: viewport.start, viewportEnd: viewport.end });
      continue;
    }
    
    // Calculate VIEWPORT-RELATIVE position since canvas moves with CSS transform
    // Convert absolute row index to viewport-relative position
    const viewportRelativeRowIndex = absoluteRowIndex - viewport.start;
    const viewportRelativeY = viewportRelativeRowIndex * rowHeight;
    const viewportRelativeX = colData.offset;
    
    console.log('calculateVisualPositions: Cell position calculation', {
      cellKey,
      absoluteRowIndex,
      viewportStart: viewport.start,
      viewportRelativeRowIndex,
      viewportRelativeY,
      columnOffset: colData.offset,
      viewportRelativeX
    });
    
    visualPositions.push({
      cellKey,
      x: viewportRelativeX,
      y: viewportRelativeY,
      width: colData.width,
      height: rowHeight
    });
  }
  
  return visualPositions;
};

/**
 * Create viewport info from scroll event
 */
export const createViewportFromScroll = (event: any): ViewportInfo => ({
  start: Math.floor(event.scrollTop / event.itemHeight),
  end: Math.floor(event.scrollTop / event.itemHeight) + Math.ceil(event.containerHeight / event.itemHeight) + event.bufferSize,
  height: event.containerHeight,
  width: event.containerWidth || 0,
  scrollTop: event.scrollTop,
  scrollLeft: event.scrollLeft || 0,
  itemHeight: event.itemHeight
});