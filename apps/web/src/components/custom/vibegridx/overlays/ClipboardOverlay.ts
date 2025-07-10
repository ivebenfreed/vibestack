import Konva from 'konva';
import type { ViewportInfo } from '../types';
import { CoordinateSystem } from './CoordinateSystem';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// CLIPBOARD OVERLAY
// ====================================

export interface ClipboardOverlayConfig {
  cellHeight: number;
  dimensionManager?: ColumnDimensionManager;
  copyColor?: string;
  cutColor?: string;
}

export class ClipboardOverlay {
  private layer: Konva.Layer;
  private coordinateSystem: CoordinateSystem;
  private config: ClipboardOverlayConfig;
  
  // Clipboard indicator
  private indicator: Konva.Rect | null = null;
  
  constructor(
    layer: Konva.Layer,
    coordinateSystem: CoordinateSystem,
    config: ClipboardOverlayConfig
  ) {
    this.layer = layer;
    this.coordinateSystem = coordinateSystem;
    this.config = {
      copyColor: '#10b981',
      cutColor: '#ef4444',
      ...config
    };
  }
  
  updateIndicator(
    clipboardState: { copiedCells: Set<string>; isCut: boolean } | null,
    viewport: ViewportInfo | null
  ): void {
    if (!clipboardState || !viewport || clipboardState.copiedCells.size === 0) {
      this.clear();
      return;
    }
    
    // Calculate bounds of copied cells
    const bounds = this.calculateBounds(clipboardState.copiedCells, viewport);
    if (!bounds) {
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
    this.indicator.size({ width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY });
    this.indicator.stroke(clipboardState.isCut ? this.config.cutColor! : this.config.copyColor!);
    
    this.layer.batchDraw();
  }
  
  private calculateBounds(
    cells: Set<string>,
    viewport: ViewportInfo
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasVisibleCells = false;
    
    for (const cellKey of cells) {
      const position = this.getPositionForCell(cellKey, viewport);
      if (!position) continue;
      
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) continue;
      
      const width = this.config.dimensionManager?.getColumnWidth(parsed.columnId) || 100;
      const height = this.config.cellHeight;
      
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + width);
      maxY = Math.max(maxY, position.y + height);
      hasVisibleCells = true;
    }
    
    return hasVisibleCells ? { minX, minY, maxX, maxY } : null;
  }
  
  private getPositionForCell(cellKey: string, viewport: ViewportInfo): { x: number; y: number } | null {
    const parsed = this.coordinateSystem.parseCellKey(cellKey);
    if (!parsed) return null;
    
    return this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
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