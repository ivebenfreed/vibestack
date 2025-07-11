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
    // Always update when viewport changes, even if selection hasn't
    // This ensures cells become visible when scrolling
    
    console.log('SelectionOverlay.updateSelection called', {
      selectedCells: selectedCells.size,
      viewport: !!viewport,
      viewportDetails: viewport,
      coordinateSystemRows: this.coordinateSystem.rowIndexMap.size,
      coordinateSystemColumns: this.coordinateSystem.columnIndexMap.size
    });
    
    if (!viewport) {
      this.clear();
      return;
    }
    
    // Remove shapes for deselected cells or cells outside viewport
    for (const [cellKey, shapes] of this.selectionShapes) {
      if (!selectedCells.has(cellKey)) {
        // Cell is no longer selected
        shapes.rect.destroy();
        shapes.border.destroy();
        this.selectionShapes.delete(cellKey);
      } else {
        // Check if selected cell is still in viewport
        const position = this.getPositionForCell(cellKey, viewport);
        if (!position) {
          // Cell is selected but not in viewport, hide it
          shapes.rect.visible(false);
          shapes.border.visible(false);
        }
      }
    }
    
    // Add/update shapes for selected cells
    let renderedCount = 0;
    let skippedCount = 0;
    
    for (const cellKey of selectedCells) {
      console.log('SelectionOverlay: Attempting to render cell', cellKey);
      const rendered = this.renderCell(cellKey, viewport);
      if (rendered) {
        renderedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log('SelectionOverlay: Render summary', {
      totalSelected: selectedCells.size,
      rendered: renderedCount,
      skipped: skippedCount,
      shapeCount: this.selectionShapes.size
    });
    
    // Only log render summary for large selections with issues (avoid scroll spam)
    if (selectedCells.size > 100 && skippedCount > 0) {
      console.log('SelectionOverlay: Render summary', {
        totalSelected: selectedCells.size,
        rendered: renderedCount,
        skipped: skippedCount
      });
    }
    
    // Batch draw to update the canvas
    
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
  
  private renderCell(cellKey: string, viewport: ViewportInfo): boolean {
    const position = this.getPositionForCell(cellKey, viewport);
    if (!position) {
      console.log('SelectionOverlay.renderCell: No position for cell', cellKey);
      // Cell is not in current viewport, skip rendering
      return false;
    }
    
    const parsed = this.coordinateSystem.parseCellKey(cellKey);
    if (!parsed) {
      console.log('SelectionOverlay.renderCell: Failed to parse cell key', cellKey);
      return false;
    }
    
    console.log('SelectionOverlay.renderCell: Rendering cell', {
      cellKey,
      position,
      parsed,
      viewport: {
        start: viewport.start,
        end: viewport.end,
        scrollTop: viewport.scrollTop,
        height: viewport.height
      },
      isInViewport: position.y >= viewport.scrollTop && position.y <= (viewport.scrollTop + viewport.height)
    });
    
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
    } else {
      // Make sure existing shapes are visible
      shapes.rect.visible(true);
      shapes.border.visible(true);
    }
    
    // Update position and size
    const width = this.config.dimensionManager?.getColumnWidth(parsed.columnId) || 100;
    const height = this.config.cellHeight;
    
    // Shape positioning working correctly
    
    shapes.rect.position(position);
    shapes.rect.size({ width, height });
    
    shapes.border.position(position);
    shapes.border.size({ width, height });
    
    return true;
  }
  
  private getPositionForCell(cellKey: string, viewport: ViewportInfo): { x: number; y: number } | null {
    const parsed = this.coordinateSystem.parseCellKey(cellKey);
    if (!parsed) {
      console.log('SelectionOverlay.getPositionForCell: Failed to parse key', cellKey);
      return null;
    }
    
    console.log('SelectionOverlay.getPositionForCell: Getting position for', {
      cellKey,
      rowId: parsed.rowId,
      columnId: parsed.columnId
    });
    
    const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
    
    console.log('SelectionOverlay.getPositionForCell: Got position', position);
    
    return position;
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