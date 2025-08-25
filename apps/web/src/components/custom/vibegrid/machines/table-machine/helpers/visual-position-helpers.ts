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
      console.log('Column not found in coordinate mapping:', {
        searchingFor: columnId,
        availableColumns: coordinateMapping.columns.map((c: any) => ({ id: c.columnId, offset: c.offset }))
      });
      continue;
    }
    
    // Debug: Log what we found
    console.log('Column found in coordinate mapping:', {
      columnId,
      colData,
      allColumnsWithOffsets: coordinateMapping.columns.map((c: any) => ({ 
        id: c.columnId, 
        index: c.index,
        offset: c.offset,
        width: c.width 
      }))
    });
    
    const absoluteRowIndex = rowData.sortedIndex;
    console.log('Row found:', { rowId, absoluteRowIndex, viewport });
    
    // Allow rendering selections even when scrolled off-screen
    // Canvas transform will handle positioning correctly
    console.log('Row position calculation (allowing off-screen):', { 
      absoluteRowIndex, 
      viewportStart: viewport.start, 
      viewportEnd: viewport.end,
      isInViewport: absoluteRowIndex >= viewport.start && absoluteRowIndex <= viewport.end
    });
    
    // Calculate position compensated for canvas scroll transform
    // Canvas moves down with scroll, so selection position must move up to stay aligned
    const baseY = absoluteRowIndex * rowHeight;
    const baseX = colData.offset;
    
    // Subtract scroll offset to compensate for canvas movement
    const scrollCompensatedY = baseY - (viewport.scrollTop || 0);
    const scrollCompensatedX = baseX - (viewport.scrollLeft || 0);
    
    console.log('calculateVisualPositions: Cell position calculation', {
      cellKey,
      absoluteRowIndex,
      baseY,
      baseX,
      scrollCompensatedY,
      scrollCompensatedX,
      viewportScrollTop: viewport.scrollTop,
      viewportScrollLeft: viewport.scrollLeft
    });
    
    visualPositions.push({
      cellKey,
      x: scrollCompensatedX,
      y: scrollCompensatedY,
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