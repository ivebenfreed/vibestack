import Konva from 'konva';
import type { ViewportInfo, Column } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { CoordinateSystem } from './CoordinateSystem';
import { ViewportOptimizer } from './ViewportOptimizer';

// ====================================
// SELECTION LAYER MANAGER
// ====================================

export class SelectionLayer {
  private layer: Konva.Layer;
  private selectionGroup: Konva.Group;
  private config: OverlayConfig;
  private coordinateSystem: CoordinateSystem;
  private viewportOptimizer: ViewportOptimizer;
  private dimensionManager: any; // ColumnDimensionManager
  private columns: Column[] = [];
  
  // Shape pools for performance
  private cellShapePool: Konva.Rect[] = [];
  private borderShapePool: Konva.Rect[] = [];
  private activeShapes = new Map<string, { cell: Konva.Rect; border: Konva.Rect }>();
  
  // Fill handle
  private fillHandle: Konva.Rect | null = null;
  private fillPreviewShapes: Konva.Rect[] = [];
  private originalSelection: Set<string> = new Set();
  private selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private fillDragDirection: 'vertical' | 'horizontal' | null = null;
  
  // Copy/Cut indicator
  private copyIndicator: Konva.Rect | null = null;
  private isCutMode: boolean = false;
  
  // Drag selection preview
  private dragSelectionPreview: Konva.Rect | null = null;
  
  // Callbacks
  public onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;

  constructor(layer: Konva.Layer, config: OverlayConfig, coordinateSystem: CoordinateSystem, dimensionManager?: any) {
    this.layer = layer;
    this.config = config;
    this.coordinateSystem = coordinateSystem;
    this.dimensionManager = dimensionManager;
    this.viewportOptimizer = new ViewportOptimizer(config);
    
    this.selectionGroup = new Konva.Group({
      name: 'selection-group'
    });
    
    this.layer.add(this.selectionGroup);
    this.initializeShapePools();
    this.initializeFillHandle();
    this.initializeCopyIndicator();
    this.initializeDragPreview();
  }

  private initializeShapePools(): void {
    const poolSize = Math.min(this.config.maxSelectableCells, 1000);
    
    for (let i = 0; i < poolSize; i++) {
      // Cell background shapes
      const cellShape = new Konva.Rect({
        width: this.config.cellWidth,
        height: this.config.cellHeight,
        fill: this.config.selectionColor,
        opacity: 0.2,
        visible: false,
        listening: false
      });
      
      // Border shapes
      const borderShape = new Konva.Rect({
        width: this.config.cellWidth - 1,
        height: this.config.cellHeight - 1,
        stroke: this.config.selectionBorderColor,
        strokeWidth: this.config.borderWidth,
        fill: 'transparent',
        visible: false,
        listening: false
      });
      
      this.cellShapePool.push(cellShape);
      this.borderShapePool.push(borderShape);
      
      this.selectionGroup.add(cellShape);
      this.selectionGroup.add(borderShape);
    }
  }

  private initializeFillHandle(): void {
    this.fillHandle = new Konva.Rect({
      width: 10,
      height: 10,
      fill: this.config.selectionBorderColor,
      stroke: 'white',
      strokeWidth: 2,
      visible: false,
      draggable: true,
      cornerRadius: 2,
      preventDefault: false,  // Allow wheel events to pass through
      shadowColor: 'black',
      shadowBlur: 3,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 0.4,
      dragBoundFunc: (pos) => {
        if (!this.selectionBounds) {
          return { x: pos.x, y: pos.y };
        }
        
        const startX = this.selectionBounds.maxX - 5;
        const startY = this.selectionBounds.maxY - 5;
        
        // Determine drag direction on first significant movement
        if (!this.fillDragDirection) {
          const deltaX = Math.abs(pos.x - startX);
          const deltaY = Math.abs(pos.y - startY);
          
          // Set direction based on initial movement (threshold of 10 pixels)
          if (deltaX > 10 || deltaY > 10) {
            this.fillDragDirection = deltaY > deltaX ? 'vertical' : 'horizontal';
          }
        }
        
        // Constrain based on established direction
        if (this.fillDragDirection === 'vertical') {
          // Vertical drag - keep X fixed, snap Y to cell boundaries
          return {
            x: startX,
            y: Math.round(pos.y / this.config.cellHeight) * this.config.cellHeight - 5
          };
        } else if (this.fillDragDirection === 'horizontal') {
          // Horizontal drag - keep Y fixed, snap X to cell boundaries
          return {
            x: Math.round(pos.x / this.config.cellWidth) * this.config.cellWidth - 5,
            y: startY
          };
        } else {
          // No direction set yet, snap to nearest cell edge
          return {
            x: Math.round(pos.x / this.config.cellWidth) * this.config.cellWidth - 5,
            y: Math.round(pos.y / this.config.cellHeight) * this.config.cellHeight - 5
          };
        }
      }
    });
    
    // Add hover effects
    this.fillHandle.on('mouseenter', () => {
      if (this.fillHandle) {
        this.fillHandle.scale({ x: 1.2, y: 1.2 });
        document.body.style.cursor = 'crosshair';
        this.layer.batchDraw();
      }
    });
    
    this.fillHandle.on('mouseleave', () => {
      if (this.fillHandle && !this.fillHandle.isDragging()) {
        this.fillHandle.scale({ x: 1, y: 1 });
        document.body.style.cursor = 'default';
        this.layer.batchDraw();
      }
    });
    
    // Also handle drag cancel (ESC key)
    this.fillHandle.on('dragcancel', () => {
      this.hideFillPreview();
      
      // Reset handle to original position
      if (this.fillHandle && this.selectionBounds) {
        this.fillHandle.position({
          x: this.selectionBounds.maxX - 5,
          y: this.selectionBounds.maxY - 5
        });
        this.fillHandle.scale({ x: 1, y: 1 });
      }
      
      document.body.style.cursor = 'default';
      this.fillDragDirection = null;
      this.layer.batchDraw();
    });
    
    this.fillHandle.on('dragstart', () => {
      this.fillDragDirection = null; // Reset direction
      this.startFillPreview();
      document.body.style.cursor = 'crosshair';
    });
    
    this.fillHandle.on('dragmove', () => {
      this.updateFillPreview();
    });
    
    this.fillHandle.on('dragend', () => {
      // Only apply if we actually dragged somewhere
      const dragPos = this.fillHandle!.position();
      const startX = this.selectionBounds!.maxX - 5;
      const startY = this.selectionBounds!.maxY - 5;
      const distance = Math.sqrt(Math.pow(dragPos.x - startX, 2) + Math.pow(dragPos.y - startY, 2));
      
      if (distance > 20) { // Only fill if dragged far enough
        this.applyFillPreview();
      }
      
      this.hideFillPreview();
      
      // Reset handle to original position
      if (this.fillHandle && this.selectionBounds) {
        this.fillHandle.position({
          x: this.selectionBounds.maxX - 5,
          y: this.selectionBounds.maxY - 5
        });
        this.fillHandle.scale({ x: 1, y: 1 });
      }
      
      document.body.style.cursor = 'default';
      this.fillDragDirection = null; // Reset direction
      this.layer.batchDraw();
    });
    
    this.selectionGroup.add(this.fillHandle);
  }

  private initializeCopyIndicator(): void {
    this.copyIndicator = new Konva.Rect({
      stroke: '#6366f1',
      strokeWidth: 2,
      dash: [5, 5],
      fill: 'transparent',
      visible: false,
      listening: false
    });
    
    this.selectionGroup.add(this.copyIndicator);
  }

  private initializeDragPreview(): void {
    this.dragSelectionPreview = new Konva.Rect({
      fill: this.config.selectionColor,
      opacity: 0.1,
      stroke: this.config.selectionBorderColor,
      strokeWidth: 1,
      visible: false,
      listening: false
    });
    
    this.selectionGroup.add(this.dragSelectionPreview);
  }
  
  // Columns are now managed by dimensionManager passed during initialization
  
  // Get column width by ID
  private getColumnWidth(columnId: string): number {
    return this.dimensionManager?.getColumnWidth(columnId) || this.config.cellWidth;
  }
  
  // Get column index from column map
  private getColumnIndex(columnId: string): number {
    for (let i = 0; i < this.columns.length; i++) {
      if (this.columns[i].id === columnId) {
        return i;
      }
    }
    return -1;
  }

  // Update selection with proper viewport handling
  updateSelection(selectedCells: Set<string>, viewport: ViewportInfo): void {
    const startTime = performance.now();
    
    console.log('SelectionLayer.updateSelection:', {
      selectedCells: Array.from(selectedCells),
      cellCount: selectedCells.size,
      viewport: { scrollTop: viewport.scrollTop, height: viewport.height, width: viewport.width }
    });
    
    // Debug coordinate system
    console.log('SelectionLayer: Coordinate system mappings:', {
      rowMapSize: this.coordinateSystem['rowIndexMap'].size,
      columnMapSize: this.coordinateSystem['columnIndexMap'].size,
      isInsideScrollContainer: this.coordinateSystem['isInsideScrollContainer']
    });
    
    // Hide all currently active shapes
    this.activeShapes.forEach((shapes) => {
      shapes.cell.visible(false);
      shapes.border.visible(false);
    });
    this.activeShapes.clear();

    // Hide fill handle if no selection
    if (selectedCells.size === 0 && this.fillHandle) {
      this.fillHandle.visible(false);
    }

    // Use viewport optimizer to filter visible cells
    console.log('SelectionLayer: Checking visible cells...');
    const visibleCells = this.viewportOptimizer.getVisibleCellKeys(
      selectedCells,
      viewport,
      (cellKey) => {
        const [rowId, columnId] = cellKey.split(':');
        const position = this.coordinateSystem.getCellPositionByIds(rowId, columnId, viewport);
        
        // Debug first cell
        if (selectedCells.size === 1) {
          console.log('SelectionLayer: Cell position lookup:', {
            cellKey,
            rowId,
            columnId,
            position,
            hasPosition: position !== null,
            viewport: { scrollTop: viewport.scrollTop, height: viewport.height }
          });
        }
        
        return position ? { row: position.row, column: position.column } : null;
      }
    );
    
    console.log('SelectionLayer: Visible cells result:', {
      totalSelected: selectedCells.size,
      visibleCount: visibleCells.size,
      visibleCells: Array.from(visibleCells)
    });
    
    // Show shapes for visible selected cells only
    let shapeIndex = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cellKey of visibleCells) {
      if (shapeIndex >= this.cellShapePool.length) break;
      
      const [rowId, columnId] = cellKey.split(':');
      const position = this.coordinateSystem.getCellPositionByIds(rowId, columnId, viewport);
      
      // Only render if position is within reasonable bounds
      if (position && position.y >= -this.config.cellHeight * 2 && position.y <= viewport.height + this.config.cellHeight * 2) {
        const cellShape = this.cellShapePool[shapeIndex];
        const borderShape = this.borderShapePool[shapeIndex];
        
        // Debug first cell position
        if (shapeIndex === 0) {
          console.log('SelectionLayer: First cell position:', {
            cellKey,
            position: { x: position.x, y: position.y },
            row: position.row,
            column: position.column,
            viewport: { scrollTop: viewport.scrollTop }
          });
        }
        
        // Get actual column width
        const columnWidth = this.getColumnWidth(columnId);
        const cellHeight = this.config.cellHeight;
        
        // Update positions and sizes
        cellShape.position({ x: position.x, y: position.y });
        cellShape.width(columnWidth);
        cellShape.height(cellHeight);
        
        borderShape.position({ x: position.x, y: position.y });
        borderShape.width(columnWidth - 1);
        borderShape.height(cellHeight - 1);
        
        // Show shapes
        cellShape.visible(true);
        borderShape.visible(true);
        
        // Track bounds for fill handle
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + columnWidth);
        maxY = Math.max(maxY, position.y + this.config.cellHeight);
        
        // Track active shapes
        this.activeShapes.set(cellKey, {
          cell: cellShape,
          border: borderShape
        });
        
        shapeIndex++;
      }
    }
    
    // Log performance metrics
    const renderTime = performance.now() - startTime;
    if (selectedCells.size > 100) {
      console.log(`SelectionLayer: Rendered ${visibleCells.size}/${selectedCells.size} cells in ${renderTime.toFixed(2)}ms`);
    }

    // Update fill handle position
    if (selectedCells.size > 0 && minX !== Infinity) {
      this.selectionBounds = { minX, minY, maxX, maxY };
      this.updateFillHandlePosition();
    }

    this.layer.batchDraw();
    console.log('SelectionLayer: Layer redrawn, active shapes:', this.activeShapes.size);
  }

  // Show drag selection preview
  showDragSelectionPreview(x: number, y: number, width: number, height: number): void {
    if (this.dragSelectionPreview) {
      this.dragSelectionPreview.position({ x, y });
      this.dragSelectionPreview.size({ width, height });
      this.dragSelectionPreview.visible(true);
      this.layer.batchDraw();
    }
  }

  hideDragSelectionPreview(): void {
    if (this.dragSelectionPreview) {
      this.dragSelectionPreview.visible(false);
      this.layer.batchDraw();
    }
  }

  // Copy/Cut indicator methods
  showCopyIndicator(isCut: boolean): void {
    this.isCutMode = isCut;
    
    if (this.copyIndicator && this.selectionBounds) {
      this.copyIndicator.position({
        x: this.selectionBounds.minX,
        y: this.selectionBounds.minY
      });
      
      this.copyIndicator.size({
        width: this.selectionBounds.maxX - this.selectionBounds.minX,
        height: this.selectionBounds.maxY - this.selectionBounds.minY
      });
      
      this.copyIndicator.stroke(isCut ? '#ef4444' : '#6366f1');
      this.copyIndicator.visible(true);
      
      // Animate the dash offset
      const anim = new Konva.Animation((frame) => {
        if (frame && this.copyIndicator) {
          this.copyIndicator.dashOffset(-frame.time / 50);
        }
      }, this.layer);
      
      anim.start();
      
      // Store animation reference for cleanup
      (this.copyIndicator as any)._dashAnimation = anim;
    }
    
    this.layer.batchDraw();
  }

  hideCopyIndicator(): void {
    if (this.copyIndicator) {
      this.copyIndicator.visible(false);
      
      // Stop animation
      const anim = (this.copyIndicator as any)._dashAnimation;
      if (anim) {
        anim.stop();
        delete (this.copyIndicator as any)._dashAnimation;
      }
    }
    
    this.layer.batchDraw();
  }

  // Fill handle methods
  private updateFillHandlePosition(): void {
    if (this.fillHandle && this.selectionBounds) {
      // Position fill handle at the bottom-right corner of selection
      const handleX = this.selectionBounds.maxX - 5;
      const handleY = this.selectionBounds.maxY - 5;
      
      this.fillHandle.position({
        x: handleX,
        y: handleY
      });
      this.fillHandle.visible(true);
      this.fillHandle.moveToTop(); // Ensure it's on top
      
      // Reset drag direction when handle is repositioned
      this.fillDragDirection = null;
      
      this.layer.batchDraw();
    }
  }

  private startFillPreview(): void {
    // Store original selection
    this.originalSelection = new Set(this.activeShapes.keys());
    
    // Create preview shapes if needed
    const neededShapes = this.config.maxSelectableCells - this.fillPreviewShapes.length;
    for (let i = 0; i < neededShapes && i < 100; i++) {
      const previewShape = new Konva.Rect({
        width: this.config.cellWidth - 1,
        height: this.config.cellHeight - 1,
        fill: this.config.selectionColor,
        opacity: 0.1,
        stroke: this.config.selectionBorderColor,
        strokeWidth: 1,
        dash: [3, 3],
        visible: false,
        listening: false
      });
      
      this.fillPreviewShapes.push(previewShape);
      this.selectionGroup.add(previewShape);
    }
  }

  private updateFillPreview(): void {
    if (!this.fillHandle || !this.selectionBounds) return;
    
    // Hide all preview shapes first
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    
    // Get current drag position
    const dragPos = this.fillHandle.position();
    const dragCellX = Math.round((dragPos.x + 5) / this.config.cellWidth);
    const dragCellY = Math.round((dragPos.y + 5) / this.config.cellHeight);
    
    // Calculate original selection bounds in cell coordinates
    const startCellX = Math.floor(this.selectionBounds.minX / this.config.cellWidth);
    const startCellY = Math.floor(this.selectionBounds.minY / this.config.cellHeight);
    const endCellX = Math.floor((this.selectionBounds.maxX - 1) / this.config.cellWidth);
    const endCellY = Math.floor((this.selectionBounds.maxY - 1) / this.config.cellHeight);
    
    let previewIndex = 0;
    
    // Only show preview if direction is established
    if (!this.fillDragDirection) {
      this.layer.batchDraw();
      return;
    }
    
    // Simple fill logic based on established direction
    if (this.fillDragDirection === 'vertical') {
      // Vertical fill - only show preview if we're beyond the selection
      if (dragCellY <= endCellY && dragCellY >= startCellY) {
        // Still within original selection, don't show preview
        this.layer.batchDraw();
        return;
      }
      
      // Fill rows between selection and drag position
      const fillStartY = dragCellY < startCellY ? dragCellY : endCellY + 1;
      const fillEndY = dragCellY < startCellY ? startCellY - 1 : dragCellY;
      
      for (let y = fillStartY; y <= fillEndY; y++) {
        // Fill all columns in the original selection range
        for (let x = startCellX; x <= endCellX; x++) {
          if (previewIndex < this.fillPreviewShapes.length) {
            const shape = this.fillPreviewShapes[previewIndex++];
            shape.position({
              x: x * this.config.cellWidth,
              y: y * this.config.cellHeight
            });
            shape.visible(true);
          }
        }
      }
    } else if (this.fillDragDirection === 'horizontal') {
      // Horizontal fill - only show preview if we're beyond the selection
      if (dragCellX <= endCellX && dragCellX >= startCellX) {
        // Still within original selection, don't show preview
        this.layer.batchDraw();
        return;
      }
      
      // Fill columns between selection and drag position
      const fillStartX = dragCellX < startCellX ? dragCellX : endCellX + 1;
      const fillEndX = dragCellX < startCellX ? startCellX - 1 : dragCellX;
      
      for (let x = fillStartX; x <= fillEndX; x++) {
        // Fill all rows in the original selection range
        for (let y = startCellY; y <= endCellY; y++) {
          if (previewIndex < this.fillPreviewShapes.length) {
            const shape = this.fillPreviewShapes[previewIndex++];
            shape.position({
              x: x * this.config.cellWidth,
              y: y * this.config.cellHeight
            });
            shape.visible(true);
          }
        }
      }
    }
    
    this.layer.batchDraw();
  }

  private applyFillPreview(): void {
    // Collect cells that should be filled
    const cellsToFill = new Set<string>();
    
    this.fillPreviewShapes.forEach(shape => {
      if (shape.visible()) {
        const pos = shape.position();
        const cellX = Math.floor(pos.x / this.config.cellWidth);
        const cellY = Math.floor(pos.y / this.config.cellHeight);
        
        // Need to convert cell indices to actual row/column IDs
        const ids = this.coordinateSystem.cellIndicesToIds(cellY, cellX);
        if (ids.rowId && ids.columnId) {
          cellsToFill.add(`${ids.rowId}:${ids.columnId}`);
        }
      }
    });
    
    // Notify about fill operation
    if (cellsToFill.size > 0 && this.onFillComplete) {
      this.onFillComplete(this.originalSelection, cellsToFill);
    }
  }

  private hideFillPreview(): void {
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    this.layer.batchDraw();
  }

  // Clear all selections
  clear(): void {
    this.activeShapes.forEach((shapes) => {
      shapes.cell.visible(false);
      shapes.border.visible(false);
    });
    this.activeShapes.clear();
    
    if (this.fillHandle) {
      this.fillHandle.visible(false);
    }
    
    this.hideCopyIndicator();
    this.hideDragSelectionPreview();
    
    this.layer.batchDraw();
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return this.viewportOptimizer.getMetrics();
  }
  
  // Destroy the layer
  destroy(): void {
    this.clear();
    this.cellShapePool = [];
    this.borderShapePool = [];
    this.selectionGroup.destroy();
  }
}