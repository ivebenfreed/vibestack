import Konva from 'konva';
import type { VisualCellPosition } from './OverlayTypes';

// ====================================
// EDITING CANVAS OVERLAY
// ====================================
// Shows a darker border around the cell being edited

export class EditingCanvasOverlay {
  private layer: Konva.Layer;
  private editingRect: Konva.Rect | null = null;
  private editingStroke: Konva.Rect | null = null;
  
  constructor(layer: Konva.Layer) {
    this.layer = layer;
  }
  
  /**
   * Show editing indicator for a single cell
   */
  public show(position: VisualCellPosition): void {
    this.clear();
    
    // Create outer stroke (darker blue)
    this.editingStroke = new Konva.Rect({
      x: position.x - 1,
      y: position.y - 1,
      width: position.width + 2,
      height: position.height + 2,
      stroke: 'rgb(30, 64, 175)', // Darker blue (blue-800)
      strokeWidth: 2,
      fill: 'transparent',
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      hitStrokeWidth: 0
    });
    
    // Add a subtle inner shadow effect
    this.editingRect = new Konva.Rect({
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      stroke: 'rgba(30, 64, 175, 0.2)', // Semi-transparent darker blue
      strokeWidth: 1,
      fill: 'transparent',
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      hitStrokeWidth: 0
    });
    
    this.layer.add(this.editingStroke);
    this.layer.add(this.editingRect);
    this.layer.batchDraw();
  }
  
  /**
   * Hide editing indicator
   */
  public hide(): void {
    this.clear();
    this.layer.batchDraw();
  }
  
  /**
   * Clear all editing shapes
   */
  private clear(): void {
    if (this.editingRect) {
      this.editingRect.destroy();
      this.editingRect = null;
    }
    if (this.editingStroke) {
      this.editingStroke.destroy();
      this.editingStroke = null;
    }
  }
  
  /**
   * Update position (for scrolling)
   */
  public updatePosition(position: VisualCellPosition): void {
    if (this.editingStroke && this.editingRect) {
      this.editingStroke.position({
        x: position.x - 1,
        y: position.y - 1
      });
      this.editingRect.position({
        x: position.x,
        y: position.y
      });
      this.layer.batchDraw();
    }
  }
  
  /**
   * Destroy the overlay
   */
  public destroy(): void {
    this.clear();
  }
}