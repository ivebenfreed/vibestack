import Konva from 'konva';
import type { CellRef, ViewportInfo } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { CoordinateSystem } from './CoordinateSystem';

// ====================================
// EDITING LAYER MANAGER
// ====================================

export class EditingLayer {
  private layer: Konva.Layer;
  private editingGroup: Konva.Group;
  private config: OverlayConfig;
  private coordinateSystem: CoordinateSystem;
  
  // Editing indicator shapes
  private editingBorder: Konva.Rect | null = null;
  private editingBackground: Konva.Rect | null = null;
  
  // Current editing cell
  private currentEditingCell: CellRef | null = null;

  constructor(
    layer: Konva.Layer, 
    config: OverlayConfig, 
    coordinateSystem: CoordinateSystem
  ) {
    this.layer = layer;
    this.config = config;
    this.coordinateSystem = coordinateSystem;
    
    this.editingGroup = new Konva.Group({
      name: 'editing-group'
    });
    
    this.layer.add(this.editingGroup);
    this.initializeEditingShapes();
  }

  private initializeEditingShapes(): void {
    // Background for editing cell
    this.editingBackground = new Konva.Rect({
      width: this.config.cellWidth,
      height: this.config.cellHeight,
      fill: this.config.editingColor,
      opacity: 0.1,
      visible: false,
      listening: false
    });
    
    // Border for editing cell
    this.editingBorder = new Konva.Rect({
      width: this.config.cellWidth - 1,
      height: this.config.cellHeight - 1,
      stroke: this.config.editingBorderColor,
      strokeWidth: this.config.borderWidth + 1,
      fill: 'transparent',
      visible: false,
      listening: false
    });
    
    this.editingGroup.add(this.editingBackground);
    this.editingGroup.add(this.editingBorder);
  }

  updateEditingCell(editingCell: CellRef | null, viewport: ViewportInfo): void {
    this.currentEditingCell = editingCell;
    
    if (!editingCell || !this.editingBorder || !this.editingBackground) {
      this.hideEditingIndicator();
      return;
    }
    
    // Get position of editing cell
    const position = this.coordinateSystem.getCellPositionByIds(
      editingCell.rowId, 
      editingCell.columnId, 
      viewport
    );
    
    if (!position || !this.coordinateSystem.isCellVisible(position.row, position.column, viewport)) {
      this.hideEditingIndicator();
      return;
    }
    
    // Update positions
    this.editingBackground.position({ x: position.x, y: position.y });
    this.editingBorder.position({ x: position.x, y: position.y });
    
    // Show indicators
    this.editingBackground.visible(true);
    this.editingBorder.visible(true);
    
    // Add pulse animation if enabled
    if (this.config.enableAnimations) {
      this.animateEditingStart();
    }
    
    this.layer.batchDraw();
  }

  private animateEditingStart(): void {
    if (!this.editingBorder) return;
    
    // Pulse animation
    const anim = new Konva.Animation((frame) => {
      if (!frame || !this.editingBorder) return;
      
      const scale = 1 + Math.sin(frame.time * 0.005) * 0.02;
      this.editingBorder.scaleX(scale);
      this.editingBorder.scaleY(scale);
    }, this.layer);
    
    anim.start();
    
    // Stop after a short duration
    setTimeout(() => {
      anim.stop();
      if (this.editingBorder) {
        this.editingBorder.scaleX(1);
        this.editingBorder.scaleY(1);
      }
      this.layer.batchDraw();
    }, 500);
  }

  private hideEditingIndicator(): void {
    if (this.editingBackground) {
      this.editingBackground.visible(false);
    }
    
    if (this.editingBorder) {
      this.editingBorder.visible(false);
    }
    
    this.layer.batchDraw();
  }

  // Check if a specific cell is being edited
  isEditing(rowId: string, columnId: string): boolean {
    return this.currentEditingCell?.rowId === rowId && 
           this.currentEditingCell?.columnId === columnId;
  }

  // Get current editing cell
  getEditingCell(): CellRef | null {
    return this.currentEditingCell;
  }

  // Clear editing state
  clear(): void {
    this.currentEditingCell = null;
    this.hideEditingIndicator();
  }

  // Destroy the layer
  destroy(): void {
    this.clear();
    this.editingGroup.destroy();
  }
}