import Konva from 'konva';
import type { ViewportInfo } from '../types';

// ====================================
// DRAG PREVIEW OVERLAY
// ====================================

export interface DragPreviewOverlayConfig {
  selectionColor: string;
  selectionBorderColor: string;
  cellWidth: number;
  cellHeight: number;
  opacity?: number;
}

export interface DragState {
  isDragging: boolean;
  startCell: { row: number; column: number } | null;
  currentCell: { row: number; column: number } | null;
}

export class DragPreviewOverlay {
  private layer: Konva.Layer;
  private config: DragPreviewOverlayConfig;
  
  // Drag preview shape
  private preview: Konva.Rect | null = null;
  
  constructor(
    layer: Konva.Layer,
    config: DragPreviewOverlayConfig
  ) {
    this.layer = layer;
    this.config = {
      opacity: 0.3,
      ...config
    };
  }
  
  updatePreview(dragState: DragState | null, viewport: ViewportInfo | null): void {
    if (!dragState?.isDragging || !dragState.startCell || !dragState.currentCell || !viewport) {
      this.clear();
      return;
    }
    
    // Calculate bounds
    const bounds = this.calculateDragBounds(dragState);
    
    // Create or update preview
    if (!this.preview) {
      this.preview = new Konva.Rect({
        fill: this.config.selectionColor,
        opacity: this.config.opacity,
        stroke: this.config.selectionBorderColor,
        strokeWidth: 2,
        listening: false
      });
      this.layer.add(this.preview);
    }
    
    // Update position and size
    this.preview.position({ x: bounds.x, y: bounds.y });
    this.preview.size({ width: bounds.width, height: bounds.height });
    
    this.layer.batchDraw();
  }
  
  private calculateDragBounds(dragState: DragState): { x: number; y: number; width: number; height: number } {
    const minRow = Math.min(dragState.startCell!.row, dragState.currentCell!.row);
    const maxRow = Math.max(dragState.startCell!.row, dragState.currentCell!.row);
    const minCol = Math.min(dragState.startCell!.column, dragState.currentCell!.column);
    const maxCol = Math.max(dragState.startCell!.column, dragState.currentCell!.column);
    
    return {
      x: minCol * this.config.cellWidth,
      y: minRow * this.config.cellHeight,
      width: (maxCol - minCol + 1) * this.config.cellWidth,
      height: (maxRow - minRow + 1) * this.config.cellHeight
    };
  }
  
  clear(): void {
    if (this.preview) {
      this.preview.destroy();
      this.preview = null;
      this.layer.batchDraw();
    }
  }
  
  destroy(): void {
    this.clear();
  }
}