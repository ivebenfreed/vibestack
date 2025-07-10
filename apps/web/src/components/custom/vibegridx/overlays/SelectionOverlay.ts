import Konva from 'konva';
import type { ViewportInfo } from '../types';
import { CoordinateSystem } from './CoordinateSystem';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// SELECTION OVERLAY
// ====================================

export interface SelectionOverlayConfig {
  selectionColor: string;
  selectionBorderColor: string;
  borderWidth: number;
  cellHeight: number;
  dimensionManager?: ColumnDimensionManager;
}

export class SelectionOverlay {
  private layer: Konva.Layer;
  private coordinateSystem: CoordinateSystem;
  private config: SelectionOverlayConfig;
  
  // Selection shapes
  private selectionShapes = new Map<string, { rect: Konva.Rect; border: Konva.Rect }>();
  
  // Track previous state to avoid unnecessary updates
  private lastSelectedCells = new Set<string>();
  
  constructor(
    layer: Konva.Layer,
    coordinateSystem: CoordinateSystem,
    config: SelectionOverlayConfig
  ) {
    this.layer = layer;
    this.coordinateSystem = coordinateSystem;
    this.config = config;
  }
  
  updateSelection(selectedCells: Set<string>, viewport: ViewportInfo | null): void {
    // Quick check if anything changed
    const selectionChanged = !this.areSetsEqual(this.lastSelectedCells, selectedCells);
    
    if (!selectionChanged && viewport) {
      // No change in selection, skip update
      return;
    }
    
    
    if (!viewport) {
      this.clear();
      return;
    }
    
    // Remove shapes for deselected cells
    for (const [cellKey, shapes] of this.selectionShapes) {
      if (!selectedCells.has(cellKey)) {
        shapes.rect.destroy();
        shapes.border.destroy();
        this.selectionShapes.delete(cellKey);
      }
    }
    
    // Add/update shapes for selected cells
    for (const cellKey of selectedCells) {
      this.renderCell(cellKey, viewport);
    }
    
    this.layer.batchDraw();
    
    // Update last state
    this.lastSelectedCells = new Set(selectedCells);
  }
  
  private areSetsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
  
  private renderCell(cellKey: string, viewport: ViewportInfo): void {
    const position = this.getPositionForCell(cellKey, viewport);
    // Only log if position is null for debugging
    if (!position) {
      console.log('SelectionOverlay.renderCell: No position for', cellKey);
    }
    if (!position) return;
    
    const parsed = this.coordinateSystem.parseCellKey(cellKey);
    if (!parsed) return;
    
    // Get or create shapes
    let shapes = this.selectionShapes.get(cellKey);
    if (!shapes) {
      const rect = new Konva.Rect({
        fill: this.config.selectionColor,
        opacity: 0.1,
        listening: false
      });
      
      const border = new Konva.Rect({
        stroke: this.config.selectionBorderColor,
        strokeWidth: this.config.borderWidth,
        fill: 'transparent',
        listening: false
      });
      
      this.layer.add(rect);
      this.layer.add(border);
      
      shapes = { rect, border };
      this.selectionShapes.set(cellKey, shapes);
    }
    
    // Update position and size
    const width = this.config.dimensionManager?.getColumnWidth(parsed.columnId) || 100;
    const height = this.config.cellHeight;
    
    shapes.rect.position(position);
    shapes.rect.size({ width, height });
    
    shapes.border.position(position);
    shapes.border.size({ width, height });
  }
  
  private getPositionForCell(cellKey: string, viewport: ViewportInfo): { x: number; y: number } | null {
    const parsed = this.coordinateSystem.parseCellKey(cellKey);
    if (!parsed) return null;
    
    return this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
  }
  
  clear(): void {
    for (const shapes of this.selectionShapes.values()) {
      shapes.rect.destroy();
      shapes.border.destroy();
    }
    this.selectionShapes.clear();
    this.layer.batchDraw();
  }
  
  destroy(): void {
    this.clear();
  }
}