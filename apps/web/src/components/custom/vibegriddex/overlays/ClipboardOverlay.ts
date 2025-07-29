import Konva from 'konva';
import type { ViewportInfo } from '../types';
import type { CoordinateMapping } from '../machines/table-machine/slices/dimensions-slice';

// ====================================
// CLIPBOARD OVERLAY
// ====================================

export interface ClipboardOverlayConfig {
  cellHeight: number;
  copyColor?: string;
  cutColor?: string;
}

export class ClipboardOverlay {
  private layer: Konva.Layer;
  private coordinateMapping: CoordinateMapping | null = null;
  private config: ClipboardOverlayConfig;
  
  // Clipboard indicator
  private indicator: Konva.Rect | null = null;
  
  constructor(
    layer: Konva.Layer,
    coordinateProvider: any, // CanvasOverlay that provides coordinate mapping
    config: ClipboardOverlayConfig
  ) {
    this.layer = layer;
    this.coordinateMapping = coordinateProvider.getCoordinateMapping();
    this.config = {
      copyColor: '#10b981',
      cutColor: '#ef4444',
      ...config
    };
  }
  
  /**
   * Update coordinate mapping when it changes
   */
  updateCoordinateMapping(mapping: CoordinateMapping): void {
    this.coordinateMapping = mapping;
  }
  
  updateIndicator(
    clipboardState: { copiedCells: Set<string>; isCut: boolean } | null,
    viewport: ViewportInfo | null
  ): void {
    console.log('ClipboardOverlay: updateIndicator called', {
      hasClipboardState: !!clipboardState,
      hasViewport: !!viewport,
      cellCount: clipboardState?.copiedCells.size || 0
    });
    
    if (!clipboardState || !viewport || clipboardState.copiedCells.size === 0) {
      this.clear();
      return;
    }
    
    // Calculate bounds of copied cells
    const bounds = this.calculateBounds(clipboardState.copiedCells, viewport);
    if (!bounds) {
      console.warn('ClipboardOverlay: No bounds calculated, clearing');
      this.clear();
      return;
    }
    
    // Validate bounds
    if (!isFinite(bounds.minX) || !isFinite(bounds.minY) || 
        !isFinite(bounds.maxX) || !isFinite(bounds.maxY)) {
      console.error('ClipboardOverlay: Invalid bounds calculated', { bounds });
      this.clear();
      return;
    }
    
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    if (width <= 0 || height <= 0) {
      console.warn('ClipboardOverlay: Invalid dimensions', { width, height });
      this.clear();
      return;
    }
    
    // Create or update indicator
    if (!this.indicator) {
      this.indicator = new Konva.Rect({
        strokeWidth: 2,
        dash: [5, 5],
        fill: 'transparent',
        listening: false
      });
      this.layer.add(this.indicator);
    }
    
    // Update properties
    this.indicator.position({ x: bounds.minX, y: bounds.minY });
    this.indicator.size({ width, height });
    this.indicator.stroke(clipboardState.isCut ? this.config.cutColor! : this.config.copyColor!);
    
    console.log('ClipboardOverlay: Indicator updated', {
      position: { x: bounds.minX, y: bounds.minY },
      size: { width, height },
      stroke: clipboardState.isCut ? this.config.cutColor : this.config.copyColor
    });
    
    this.layer.batchDraw();
  }
  
  private calculateBounds(
    cells: Set<string>,
    viewport: ViewportInfo
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasVisibleCells = false;
    
    console.log('ClipboardOverlay: calculateBounds called', {
      cellCount: cells.size,
      viewport: { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    });
    
    for (const cellKey of cells) {
      const position = this.getPositionForCell(cellKey, viewport);
      if (!position) {
        console.log('ClipboardOverlay: No position for cell', { cellKey });
        continue;
      }
      
      const [rowId, columnId] = cellKey.split(':');
      if (!this.coordinateMapping || !rowId || !columnId) continue;
      
      // Find column in coordinate mapping
      const colData = this.coordinateMapping.columns.find((c: any) => c.columnId === columnId);
      if (!colData) continue;
      
      const columnWidth = colData.width;
      const width = columnWidth || 100;
      const height = this.config.cellHeight;
      
      console.log('ClipboardOverlay: Cell position found', {
        cellKey,
        position,
        width,
        height
      });
      
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + width);
      maxY = Math.max(maxY, position.y + height);
      hasVisibleCells = true;
    }
    
    const bounds = hasVisibleCells ? { minX, minY, maxX, maxY } : null;
    console.log('ClipboardOverlay: Calculated bounds', { bounds, hasVisibleCells });
    
    return bounds;
  }
  
  private getPositionForCell(cellKey: string, viewport: ViewportInfo): { x: number; y: number } | null {
    const [rowId, columnId] = cellKey.split(':');
    if (!this.coordinateMapping || !rowId || !columnId) {
      console.warn('ClipboardOverlay: Failed to parse cell key or no coordinate mapping', { cellKey });
      return null;
    }
    
    // Find row and column in coordinate mapping
    const rowIndex = this.coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
    const colData = this.coordinateMapping.columns.find((c: any) => c.columnId === columnId);
    
    if (rowIndex === -1 || !colData) {
      return null;
    }
    
    // Calculate position using coordinate mapping
    const position = {
      x: colData.offset || 0,
      y: rowIndex * this.config.cellHeight
    };
    
    console.log('ClipboardOverlay: getPositionForCell', {
      cellKey,
      rowId,
      columnId,
      position,
      viewport: { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }
    });
    
    return position;
  }
  
  updateIndicatorWithVisualPositions(
    visualPositions: Array<{ x: number; y: number; width: number; height: number }>,
    isCut: boolean
  ): void {
    console.log('ClipboardOverlay: updateIndicatorWithVisualPositions', {
      positionCount: visualPositions.length,
      isCut
    });
    
    if (!visualPositions || visualPositions.length === 0) {
      this.clear();
      return;
    }
    
    // Calculate bounds from visual positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const pos of visualPositions) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Create or update indicator
    if (!this.indicator) {
      this.indicator = new Konva.Rect({
        strokeWidth: 2,
        dash: [5, 5],
        fill: 'transparent',
        listening: false
      });
      this.layer.add(this.indicator);
    }
    
    // Update properties
    this.indicator.position({ x: minX, y: minY });
    this.indicator.size({ width, height });
    this.indicator.stroke(isCut ? this.config.cutColor! : this.config.copyColor!);
    
    this.layer.batchDraw();
  }
  
  clear(): void {
    if (this.indicator) {
      this.indicator.destroy();
      this.indicator = null;
      this.layer.batchDraw();
    }
  }
  
  destroy(): void {
    this.clear();
  }
}