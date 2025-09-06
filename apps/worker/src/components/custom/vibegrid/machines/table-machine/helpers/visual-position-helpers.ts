// ====================================
// VISUAL POSITION HELPERS
// ====================================

import type { ViewportInfo } from '../../../types';
import type { VisualCellPosition } from '../../../overlays/OverlayTypes';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/machines/table-machine/helpers/visual-position-helpers.ts');

/**
 * Calculate visual positions for selected cells based on viewport
 */
export const calculateVisualPositions = (
  selectedCells: Set<string>,
  coordinateMapping: any,
  viewport: ViewportInfo | null,
  rowHeight: number
): VisualCellPosition[] => {
  log.info('calculateVisualPositions:', {
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
      log.info('Coordinate mapping structure:', {
        rowsCount: coordinateMapping.rows?.length,
        firstRow: coordinateMapping.rows?.[0],
        columnsCount: coordinateMapping.columns?.length,
        firstColumn: coordinateMapping.columns?.[0]
      });
    }
    
    // Find row in coordinate mapping
    const rowData = coordinateMapping.rows.find((r: any) => r.rowId === rowId);
    if (!rowData) {
      log.info('Row not found in coordinate mapping:', rowId);
      continue;
    }
    
    // Find column in coordinate mapping
    const colData = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
    if (!colData) {
      log.info('Column not found in coordinate mapping:', {
        searchingFor: columnId,
        availableColumns: coordinateMapping.columns.map((c: any) => ({ id: c.columnId, offset: c.offset }))
      });
      continue;
    }
    
    // Debug: Log what we found
    log.info('Column found in coordinate mapping:', {
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
    log.info('Row found:', { rowId, absoluteRowIndex, viewport });
    
    // Allow rendering selections even when scrolled off-screen
    // Canvas transform will handle positioning correctly
    log.info('Row position calculation (allowing off-screen):', { 
      absoluteRowIndex, 
      viewportStart: viewport.start, 
      viewportEnd: viewport.end,
      isInViewport: absoluteRowIndex >= viewport.start && absoluteRowIndex <= viewport.end
    });
    
    // Calculate absolute position WITHOUT scroll compensation
    // The canvas container handles scroll positioning via CSS transforms
    // Overlays must use absolute coordinates to align properly with DOM cells
    const baseY = absoluteRowIndex * rowHeight;
    const baseX = colData.offset;
    
    log.info('calculateVisualPositions: Cell position calculation (absolute positioning)', {
      cellKey,
      absoluteRowIndex,
      baseY: baseY,
      baseX: baseX,
      rowHeight,
      columnWidth: colData.width,
      viewportScrollTop: viewport.scrollTop,
      viewportScrollLeft: viewport.scrollLeft,
      note: 'Using absolute coordinates - canvas transform handles scroll positioning'
    });
    
    visualPositions.push({
      cellKey,
      x: baseX,
      y: baseY,
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