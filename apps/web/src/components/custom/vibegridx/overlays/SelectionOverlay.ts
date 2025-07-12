import Konva from 'konva';
import type { ViewportInfo } from '../types';
import type { CoordinateProvider } from './CoordinateProvider';
import { CoordinateHelper } from './CoordinateProvider';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import type { VisualCellPosition } from './OverlayTypes';

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
  private coordinateHelper: CoordinateHelper;
  private config: SelectionOverlayConfig;
  
  // Selection shapes
  private selectionShapes = new Map<string, { rect: Konva.Rect; border: Konva.Rect }>();
  
  // Track previous state to avoid unnecessary updates
  private lastSelectedCells = new Set<string>();
  
  constructor(
    layer: Konva.Layer,
    coordinateProvider: CoordinateProvider,
    config: SelectionOverlayConfig
  ) {
    this.layer = layer;
    this.coordinateHelper = new CoordinateHelper(coordinateProvider);
    this.config = config;
    
    // Initial layer setup complete
    console.log('SelectionOverlay: Created', {
      layer: this.layer,
      config: this.config
    });
  }
  
  /**
   * Update selection using coordinate mapping directly (pure XState approach)
   */
  updateSelectionWithMapping(selectedCells: Set<string>, viewport: ViewportInfo | null, coordinateMapping: any): void {
    console.log('SelectionOverlay.updateSelectionWithMapping called', {
      selectedCells: selectedCells.size,
      viewport: !!viewport,
      hasCoordinateMapping: !!coordinateMapping,
      coordinateVersion: coordinateMapping?.version
    });

    if (selectedCells.size === 0) {
      this.clearSelection();
      return;
    }

    if (!viewport || !coordinateMapping) {
      console.warn('SelectionOverlay: Missing viewport or coordinate mapping for selection render', {
        hasViewport: !!viewport,
        hasCoordinateMapping: !!coordinateMapping
      });
      return;
    }

    // Calculate visible selected cells using coordinate mapping directly
    const visibleCells = new Set<string>();
    for (const cellKey of selectedCells) {
      const [rowId, columnId] = cellKey.split(':');
      
      // Find row and column in coordinate mapping
      const rowIndex = coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
      const colIndex = coordinateMapping.columns.findIndex((c: any) => c.columnId === columnId);
      
      console.log('SelectionOverlay: Checking cell visibility', {
        cellKey,
        rowId,
        columnId,
        rowIndex,
        colIndex,
        viewport: {
          start: viewport.start,
          end: viewport.end
        },
        isInViewport: rowIndex >= viewport.start && rowIndex <= viewport.end,
        isValidIndices: rowIndex !== -1 && colIndex !== -1
      });
      
      // Check if cell is in viewport
      if (rowIndex >= viewport.start && rowIndex <= viewport.end && rowIndex !== -1 && colIndex !== -1) {
        visibleCells.add(cellKey);
      }
    }

    console.log('SelectionOverlay: Visible cells calculated', {
      totalSelected: selectedCells.size,
      visibleCount: visibleCells.size,
      viewport: {
        start: viewport.start,
        end: viewport.end
      }
    });

    // Remove shapes for deselected cells or cells outside viewport
    for (const [cellKey, shapes] of this.selectionShapes) {
      if (!selectedCells.has(cellKey) || !visibleCells.has(cellKey)) {
        shapes.rect.destroy();
        shapes.border.destroy();
        this.selectionShapes.delete(cellKey);
      }
    }

    // Add/update shapes for visible selected cells
    let renderedCount = 0;
    for (const cellKey of visibleCells) {
      if (!this.selectionShapes.has(cellKey)) {
        const [rowId, columnId] = cellKey.split(':');
        
        // Calculate position using coordinate mapping
        const rowIndex = coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
        const colData = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
        
        if (rowIndex !== -1 && colData) {
          const x = colData.offset || 0;
          // Use visual row position directly (already adjusted by TableMachine)
          const y = rowIndex * this.config.cellHeight;
          const width = colData.width || 120;
          const height = this.config.cellHeight;

          // Create selection shapes (using same pattern as existing code)
          const rect = new Konva.Rect({
            x,
            y,
            width,
            height,
            fill: this.config.selectionColor || '#3b82f6',
            opacity: 0.2,
            listening: false
          });
          
          const border = new Konva.Rect({
            x,
            y,
            width,
            height,
            stroke: this.config.selectionBorderColor || '#1d4ed8',
            strokeWidth: this.config.borderWidth || 2,
            fill: 'transparent',
            listening: false
          });
          
          this.layer.add(rect);
          this.layer.add(border);
          
          this.selectionShapes.set(cellKey, { rect, border });
          renderedCount++;
          
          console.log('SelectionOverlay: Created selection shape for cell', {
            cellKey,
            position: { x, y, width, height },
            rowIndex,
            columnId: colData.columnId
          });
        }
      }
    }

    console.log('SelectionOverlay: Render summary', {
      totalSelected: selectedCells.size,
      visibleCells: visibleCells.size,
      rendered: renderedCount,
      shapeCount: this.selectionShapes.size
    });

    this.layer.batchDraw();
  }

  /**
   * Legacy method that uses coordinate manager (will be removed)
   */
  updateSelection(selectedCells: Set<string>, viewport: ViewportInfo | null): void {
    // Always update when viewport changes, even if selection hasn't
    // This ensures cells become visible when scrolling
    
    console.log('SelectionOverlay.updateSelection called', {
      selectedCells: selectedCells.size,
      viewport: !!viewport,
      viewportDetails: viewport,
      layer: this.layer,
      stage: this.layer.getStage()
    });
    
    if (!viewport) {
      this.clear();
      return;
    }
    
    // Get visible cells from the coordinate helper
    const visibleCells = this.coordinateHelper.getVisibleCells(selectedCells, viewport);
    
    console.log('SelectionOverlay: Visible cells', {
      totalSelected: selectedCells.size,
      visibleCount: visibleCells.size,
      viewport: {
        start: viewport.start,
        end: viewport.end,
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft
      }
    });
    
    // Remove shapes for deselected cells or cells outside viewport
    for (const [cellKey, shapes] of this.selectionShapes) {
      if (!selectedCells.has(cellKey) || !visibleCells.has(cellKey)) {
        // Cell is no longer selected or not visible
        shapes.rect.destroy();
        shapes.border.destroy();
        this.selectionShapes.delete(cellKey);
      }
    }
    
    // Add/update shapes for visible selected cells only
    let renderedCount = 0;
    
    for (const [cellKey, position] of visibleCells) {
      const rendered = this.renderCellAtPosition(cellKey, position, viewport);
      if (rendered) {
        renderedCount++;
      }
    }
    
    console.log('SelectionOverlay: Render summary', {
      totalSelected: selectedCells.size,
      visibleCells: visibleCells.size,
      rendered: renderedCount,
      shapeCount: this.selectionShapes.size
    });
    
    // Batch draw to update the canvas
    console.log('SelectionOverlay: About to batchDraw', {
      layerChildren: this.layer.children.length,
      hasStage: !!this.layer.getStage()
    });
    
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
  
  private renderCellAtPosition(cellKey: string, position: { x: number; y: number }, viewport: ViewportInfo): boolean {
    const parsed = this.coordinateHelper.parseCellKey(cellKey);
    if (!parsed) {
      return false;
    }
    
    // Get or create shapes
    let shapes = this.selectionShapes.get(cellKey);
    if (!shapes) {
      const rect = new Konva.Rect({
        fill: this.config.selectionColor || 'blue',
        opacity: 0.2, // Lower opacity for cleaner look
        listening: false
      });
      
      const border = new Konva.Rect({
        stroke: this.config.selectionBorderColor || 'red',
        strokeWidth: this.config.borderWidth || 2,
        fill: 'transparent',
        listening: false
      });
      
      this.layer.add(rect);
      this.layer.add(border);
      
      shapes = { rect, border };
      this.selectionShapes.set(cellKey, shapes);
    }
    
    // Update position and size
    const width = this.coordinateHelper.getColumnWidth(parsed.columnId);
    const height = this.coordinateHelper.getRowHeight();
    
    console.log('SelectionOverlay: Rendering cell at calculated position', {
      cellKey,
      position,
      width,
      height
    });
    
    shapes.rect.position(position);
    shapes.rect.size({ width, height });
    
    // Adjust border position to account for stroke width
    const borderOffset = this.config.borderWidth / 2;
    shapes.border.position({ 
      x: position.x + borderOffset, 
      y: position.y + borderOffset 
    });
    shapes.border.size({ 
      width: width - this.config.borderWidth, 
      height: height - this.config.borderWidth 
    });
    
    // Force shapes to front
    shapes.rect.moveToTop();
    shapes.border.moveToTop();
    
    return true;
  }
  
  
  private getPositionForCell(cellKey: string, viewport: ViewportInfo): { x: number; y: number } | null {
    const parsed = this.coordinateHelper.parseCellKey(cellKey);
    if (!parsed) {
      console.log('SelectionOverlay.getPositionForCell: Failed to parse key', cellKey);
      return null;
    }
    
    const position = this.coordinateHelper.getCellPositionWithViewport(parsed.rowId, parsed.columnId, viewport);
    
    // Only log failures if we expected to find a position
    if (!position && viewport) {
      // This is normal during initialization - coordinate manager may not be ready
    }
    
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
  
  /**
   * Update selection with pre-calculated visual positions (stateless approach)
   */
  updateWithVisualPositions(visualCells: VisualCellPosition[]): void {
    console.log('SelectionOverlay.updateWithVisualPositions called', {
      cellCount: visualCells.length
    });
    
    // Build a set of current cell keys for efficient lookup
    const currentCellKeys = new Set(visualCells.map(vc => vc.cellKey));
    
    // Remove shapes for cells no longer selected
    for (const [cellKey, shapes] of this.selectionShapes) {
      if (!currentCellKeys.has(cellKey)) {
        shapes.rect.destroy();
        shapes.border.destroy();
        this.selectionShapes.delete(cellKey);
      }
    }
    
    // Add/update shapes for each visual cell
    for (const visualCell of visualCells) {
      // DEBUG: Log the visual position being drawn
      console.log('SelectionOverlay: Drawing cell at position', {
        cellKey: visualCell.cellKey,
        x: visualCell.x,
        y: visualCell.y,
        width: visualCell.width,
        height: visualCell.height
      });
      
      let shapes = this.selectionShapes.get(visualCell.cellKey);
      
      if (!shapes) {
        // Create new shapes
        const rect = new Konva.Rect({
          x: visualCell.x,
          y: visualCell.y,
          width: visualCell.width,
          height: visualCell.height,
          fill: this.config.selectionColor || '#3b82f6',
          opacity: 0.2,
          listening: false
        });
        
        const border = new Konva.Rect({
          x: visualCell.x,
          y: visualCell.y,
          width: visualCell.width,
          height: visualCell.height,
          stroke: this.config.selectionBorderColor || '#1d4ed8',
          strokeWidth: this.config.borderWidth || 2,
          fill: 'transparent',
          listening: false
        });
        
        this.layer.add(rect);
        this.layer.add(border);
        
        shapes = { rect, border };
        this.selectionShapes.set(visualCell.cellKey, shapes);
      } else {
        // Update existing shapes position and size
        shapes.rect.position({ x: visualCell.x, y: visualCell.y });
        shapes.rect.size({ width: visualCell.width, height: visualCell.height });
        
        shapes.border.position({ x: visualCell.x, y: visualCell.y });
        shapes.border.size({ width: visualCell.width, height: visualCell.height });
      }
    }
    
    console.log('SelectionOverlay: Updated with visual positions', {
      totalShapes: this.selectionShapes.size,
      visualCells: visualCells.length
    });
    
    this.layer.batchDraw();
  }
}