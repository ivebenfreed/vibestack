import Konva from 'konva';
import type { ColumnDragState } from '../types';
import type { CoordinateMapping, ColumnCoordinate } from '../machines/table-machine/slices/dimensions-slice';

// ====================================
// COLUMN DRAG OVERLAY
// ====================================

export interface ColumnDragOverlayConfig {
  cellHeight: number;
  headerHeight: number;
  dragOpacity?: number;
  dropIndicatorColor?: string;
  dropIndicatorWidth?: number;
  previewColor?: string;
  previewBorderColor?: string;
}

export class ColumnDragOverlay {
  private layer: Konva.Layer;
  private config: ColumnDragOverlayConfig;
  private coordinateMapping: CoordinateMapping | null = null;
  
  // Drag preview elements
  private columnPreview: Konva.Group | null = null;
  private dropIndicator: Konva.Line | null = null;
  
  // Current state
  private dragState: ColumnDragState | null = null;
  private dropIndex: number = -1;
  
  constructor(
    layer: Konva.Layer,
    config: ColumnDragOverlayConfig
  ) {
    this.layer = layer;
    this.config = {
      dragOpacity: 0.8,
      dropIndicatorColor: '#3b82f6',
      dropIndicatorWidth: 4,
      previewColor: 'rgba(255, 255, 255, 0.95)',
      previewBorderColor: 'rgba(59, 130, 246, 0.5)',
      ...config
    };
  }
  
  /**
   * Update coordinate mapping
   */
  updateCoordinateMapping(coordinateMapping: CoordinateMapping): void {
    this.coordinateMapping = coordinateMapping;
  }
  
  /**
   * Update the drag preview based on current drag state
   */
  updateDragPreview(dragState: ColumnDragState, mouseX: number, mouseY: number): void {
    if (!dragState.isDragging || !dragState.draggedColumnId) {
      this.clear();
      return;
    }
    
    this.dragState = dragState;
    
    if (!this.coordinateMapping) {
      console.warn('[ColumnDragOverlay] No coordinate mapping available');
      return;
    }
    
    // Get column info from coordinate mapping
    const column = this.coordinateMapping.columns.find(col => col.columnId === dragState.draggedColumnId);
    if (!column) {
      console.warn('[ColumnDragOverlay] Column not found in coordinate mapping:', dragState.draggedColumnId);
      return;
    }
    
    const columnIndex = column.index;
    const columnWidth = column.width;
    const columnX = column.offset;
    
    // Create or update preview
    if (!this.columnPreview) {
      this.columnPreview = new Konva.Group({
        x: mouseX - columnWidth / 2,
        y: 0,
        opacity: this.config.dragOpacity,
        listening: false
      });
      
      // Background with enhanced styling
      const bg = new Konva.Rect({
        x: 0,
        y: 0,
        width: columnWidth,
        height: this.config.headerHeight,
        fill: this.config.previewColor,
        stroke: this.config.previewBorderColor,
        strokeWidth: 2,
        cornerRadius: 6,
        shadowColor: 'rgba(0, 0, 0, 0.15)',
        shadowBlur: 20,
        shadowOpacity: 0.3,
        shadowOffsetX: 0,
        shadowOffsetY: 4
      });
      
      // Add column name text
      const columnName = dragState.draggedColumnId;
      const text = new Konva.Text({
        x: 10,
        y: this.config.headerHeight / 2 - 6,
        text: columnName,
        fontSize: 12,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontStyle: '600',
        fill: '#1f2937',
        width: columnWidth - 20,
        ellipsis: true
      });
      
      this.columnPreview.add(bg);
      this.columnPreview.add(text);
      this.layer.add(this.columnPreview);
    } else {
      // Update position to follow mouse
      this.columnPreview.x(mouseX - columnWidth / 2);
    }
    
    // Update drop indicator
    this.updateDropIndicator(mouseX);
    
    this.layer.batchDraw();
  }
  
  /**
   * Update the drop indicator position based on mouse position
   */
  private updateDropIndicator(mouseX: number): void {
    if (!this.dragState || !this.dragState.isDragging || !this.coordinateMapping) return;
    
    // Find which column index the mouse is over
    const targetColumn = this.coordinateMapping.columns.find(
      col => mouseX >= col.offset && mouseX < col.offset + col.width
    );
    const targetIndex = targetColumn ? targetColumn.index : this.coordinateMapping.columns.length;
    
    if (targetIndex === this.dropIndex) return; // No change
    
    this.dropIndex = targetIndex;
    
    // Remove existing indicator
    if (this.dropIndicator) {
      this.dropIndicator.destroy();
      this.dropIndicator = null;
    }
    
    // Don't show indicator if dropping at same position
    if (targetIndex === this.dragState.draggedColumnIndex || 
        targetIndex === this.dragState.draggedColumnIndex + 1) {
      return;
    }
    
    // Calculate drop position
    let dropX: number;
    if (targetIndex <= this.dragState.draggedColumnIndex) {
      // Dropping to the left
      const targetCol = this.coordinateMapping.columns.find(col => col.index === targetIndex);
      dropX = targetCol ? targetCol.offset : 0;
    } else {
      // Dropping to the right
      if (targetIndex >= this.coordinateMapping.columns.length) {
        const lastCol = this.coordinateMapping.columns[this.coordinateMapping.columns.length - 1];
        dropX = lastCol ? lastCol.offset + lastCol.width : 0;
      } else {
        const targetCol = this.coordinateMapping.columns.find(col => col.index === targetIndex);
        dropX = targetCol ? targetCol.offset : 0;
      }
    }
    
    // Create drop indicator with enhanced visual
    this.dropIndicator = new Konva.Line({
      points: [dropX, 0, dropX, this.config.headerHeight],
      stroke: this.config.dropIndicatorColor,
      strokeWidth: this.config.dropIndicatorWidth,
      shadowColor: this.config.dropIndicatorColor,
      shadowBlur: 8,
      shadowOpacity: 0.5,
      listening: false
    });
    
    this.layer.add(this.dropIndicator);
  }
  
  /**
   * Get the current drop index based on mouse position
   */
  getDropIndex(mouseX: number): number {
    if (!this.dragState || !this.dragState.isDragging || !this.coordinateMapping) return -1;
    
    // Find which column index the mouse is over
    const targetColumn = this.coordinateMapping.columns.find(
      col => mouseX >= col.offset && mouseX < col.offset + col.width
    );
    const targetIndex = targetColumn ? targetColumn.index : this.coordinateMapping.columns.length;
    
    // Adjust for dragging to the right
    if (targetIndex > this.dragState.draggedColumnIndex) {
      return targetIndex - 1;
    }
    
    return targetIndex;
  }
  
  /**
   * Clear all drag preview elements
   */
  clear(): void {
    if (this.columnPreview) {
      this.columnPreview.destroy();
      this.columnPreview = null;
    }
    
    if (this.dropIndicator) {
      this.dropIndicator.destroy();
      this.dropIndicator = null;
    }
    
    this.dragState = null;
    this.dropIndex = -1;
    
    this.layer.batchDraw();
  }
  
  /**
   * Destroy the overlay
   */
  destroy(): void {
    this.clear();
  }
}