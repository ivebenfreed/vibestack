import Konva from 'konva';
import type { ColumnResizeState, ViewportInfo } from '../types';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// COLUMN RESIZE OVERLAY
// ====================================

export interface ColumnResizeOverlayConfig {
  cellHeight: number;
  headerHeight: number;
  resizeLineColor?: string;
  resizeLineWidth?: number;
  resizeLineOpacity?: number;
  resizeLineConstrainedColor?: string;
}

export class ColumnResizeOverlay {
  private layer: Konva.Layer;
  private config: ColumnResizeOverlayConfig;
  private dimensionManager: ColumnDimensionManager;
  
  // Resize preview elements
  private resizeLine: Konva.Line | null = null;
  
  // Current state
  private resizeState: ColumnResizeState | null = null;
  private currentViewport: ViewportInfo | null = null;
  
  constructor(
    layer: Konva.Layer,
    dimensionManager: ColumnDimensionManager,
    config: ColumnResizeOverlayConfig
  ) {
    this.layer = layer;
    this.dimensionManager = dimensionManager;
    this.config = {
      resizeLineColor: '#3b82f6',
      resizeLineWidth: 3,
      resizeLineOpacity: 0.8,
      resizeLineConstrainedColor: '#ef4444', // Red color when at min/max
      ...config
    };
  }
  
  /**
   * Update the viewport information
   */
  updateViewport(viewport: ViewportInfo): void {
    this.currentViewport = viewport;
    // Re-render if we have an active resize
    if (this.resizeState && this.resizeLine) {
      this.updateResizePreview(this.resizeState);
    }
  }
  
  /**
   * Update the resize preview based on current resize state
   */
  updateResizePreview(resizeState: ColumnResizeState | null): void {
    if (!resizeState || !resizeState.isResizing || !resizeState.resizingColumnId) {
      this.clear();
      return;
    }
    
    this.resizeState = resizeState;
    
    // Get column info
    const columnIndex = this.dimensionManager.getColumnIndex(resizeState.resizingColumnId);
    if (columnIndex === -1) {
      console.warn('[ColumnResizeOverlay] Column not found:', resizeState.resizingColumnId);
      return;
    }
    
    const columnX = this.dimensionManager.getColumnX(columnIndex);
    // Account for horizontal scroll - the canvas is transformed, so we need to compensate
    const scrollLeft = this.currentViewport?.scrollLeft || 0;
    const previewX = columnX + resizeState.previewWidth - scrollLeft;
    
    // Check if we're at a constraint
    const column = this.dimensionManager.getColumnByIndex(columnIndex);
    const minWidth = column?.minWidth || 50;
    const maxWidth = column?.maxWidth || 500;
    const isAtConstraint = resizeState.previewWidth <= minWidth || resizeState.previewWidth >= maxWidth;
    
    console.log('[ColumnResizeOverlay] Updating resize preview', {
      columnId: resizeState.resizingColumnId,
      columnIndex,
      columnX,
      previewWidth: resizeState.previewWidth,
      scrollLeft,
      previewX,
      isAtConstraint,
      minWidth,
      maxWidth
    });
    
    // Determine line color based on constraint
    const lineColor = isAtConstraint ? this.config.resizeLineConstrainedColor : this.config.resizeLineColor;
    
    // Create or update resize line
    if (!this.resizeLine) {
      this.resizeLine = new Konva.Line({
        points: [previewX, 0, previewX, 2000], // Tall enough to cover viewport
        stroke: lineColor,
        strokeWidth: this.config.resizeLineWidth,
        opacity: this.config.resizeLineOpacity,
        shadowColor: lineColor,
        shadowBlur: 6,
        shadowOpacity: 0.5,
        listening: false
      });
      
      this.layer.add(this.resizeLine);
    } else {
      // Update position and color
      this.resizeLine.points([previewX, 0, previewX, 2000]);
      this.resizeLine.stroke(lineColor);
      this.resizeLine.shadowColor(lineColor);
    }
    
    this.layer.batchDraw();
  }
  
  /**
   * Clear the resize preview
   */
  clear(): void {
    if (this.resizeLine) {
      this.resizeLine.destroy();
      this.resizeLine = null;
    }
    
    this.resizeState = null;
    
    this.layer.batchDraw();
  }
  
  /**
   * Destroy the overlay
   */
  destroy(): void {
    this.clear();
  }
}