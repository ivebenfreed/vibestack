import Konva from 'konva';
import type { ViewportInfo } from '../types';
// OverlayMachineActor removed - using direct canvas actor approach
import type { CoordinateMapping } from '../machines/table-machine/slices/dimensions-slice';
import type { VisualCellPosition } from './OverlayTypes';

// ====================================
// FILL HANDLE LAYER - Modular Implementation
// ====================================

export interface FillHandleConfig {
  cellHeight: number;
  selectionBorderColor: string;
}

export interface FillHandleCallbacks {
  onFillStart: (direction: 'vertical' | 'horizontal') => void;
  onFillPreview: (previewCells: Set<string>) => void;
  onFillComplete: (fillCells: Set<string>) => void;
  onFillCancel: () => void;
  getSelectedCells: () => Set<string>;
  getViewport: () => ViewportInfo | null;
}

export class FillHandleLayer {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private fillHandleLayer: Konva.Layer; // Dedicated interactive layer
  private config: FillHandleConfig;
  private callbacks: FillHandleCallbacks;
  private coordinateMapping: CoordinateMapping | null = null;
  
  // Fill handle state
  private activeFillHandle: Konva.Rect | null = null;
  private activeFillPreviewShapes: Konva.Rect[] = [];
  
  // Visual settings
  private originalSize = 10;
  
  constructor(
    stage: Konva.Stage,
    coordinateProvider: any, // CanvasOverlay that provides coordinate mapping
    config: FillHandleConfig,
    callbacks: FillHandleCallbacks
  ) {
    this.stage = stage;
    this.coordinateMapping = coordinateProvider.getCoordinateMapping();
    this.config = config;
    this.callbacks = callbacks;
    
    // Create main layer for preview shapes
    this.layer = new Konva.Layer({
      name: 'fill-preview-layer',
      listening: false
    });
    stage.add(this.layer);
    
    
    // Create dedicated interactive layer for specialized controls
    this.fillHandleLayer = new Konva.Layer({
      name: 'interactive-controls-layer',
      listening: true // Enable events for interactive controls only
    });
    this.stage.add(this.fillHandleLayer);
    this.fillHandleLayer.moveToTop(); // Above visual-only layers
    
    
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  /**
   * Update coordinate mapping when it changes
   */
  updateCoordinateMapping(mapping: CoordinateMapping): void {
    this.coordinateMapping = mapping;
  }
  
  // setMachine removed - using direct canvas actor approach
  
  /**
   * Render fill handle using pre-calculated visual positions (pure actors approach)
   */
  renderFillHandleWithVisualPositions(visualCells: VisualCellPosition[], selectedRows?: Set<string>): void {
    if (visualCells.length === 0) {
      this.hideFillHandle();
      return;
    }
    
    // Calculate bounds from visual positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cell of visualCells) {
      const cellRight = cell.x + cell.width;
      const cellBottom = cell.y + cell.height;
      
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cellRight);
      maxY = Math.max(maxY, cellBottom);
    }
    
    if (minX === Infinity) {
      this.hideFillHandle();
      return;
    }
    
    // Check if this is a complete row selection
    const isCompleteRowSelection = this.isCompleteRowSelection(visualCells, selectedRows);
    
    let handleX: number;
    let handleY: number;
    
    if (isCompleteRowSelection) {
      // Position fill handle in checkbox column for row selections
      const CHECKBOX_COLUMN_WIDTH = 48; // Standard checkbox column width
      handleX = CHECKBOX_COLUMN_WIDTH - 5; // Position near right edge of checkbox column
      handleY = maxY; // Still at bottom of selection
      
      console.log('FillHandleLayer: Positioning fill handle in checkbox column for row selection', {
        handleX,
        handleY,
        selectedRowsCount: selectedRows?.size || 0
      });
    } else {
      // Use existing logic - bottom-right of cell selection
      handleX = maxX;
      handleY = maxY;
      
      console.log('FillHandleLayer: Positioning fill handle at bottom-right for cell selection', {
        handleX,
        handleY,
        bounds: { minX, minY, maxX, maxY }
      });
    }
    
    // Create or update fill handle
    if (!this.activeFillHandle) {
      this.createFillHandle(handleX, handleY);
    } else {
      this.updateFillHandlePosition(handleX, handleY);
    }
    
    // Force redraw to ensure fill handle is visible
    this.fillHandleLayer.batchDraw();
  }
  
  /**
   * @deprecated Use renderFillHandleWithVisualPositions instead
   */
  renderFillHandle(selectedCells: Set<string>, viewport: ViewportInfo): void {
    if (selectedCells.size === 0) {
      this.hideFillHandle();
      return;
    }
    
    // Calculate selection bounds
    const bounds = this.getSelectionBounds(selectedCells, viewport);
    
    if (!bounds) {
      this.hideFillHandle();
      return;
    }
    
    // Calculate fill handle position (bottom-right corner of selection)
    const handleX = bounds.maxX - 5;
    const handleY = bounds.maxY - 5;
    
    // Check if handle is within viewport
    const isWithinViewport = handleY >= -10 && handleY <= viewport.height + 10 &&
                             handleX >= -10 && handleX <= viewport.width + 10;
    
    if (!isWithinViewport) {
      this.hideFillHandle();
      return;
    }
    
    // Create or update fill handle
    if (!this.activeFillHandle) {
      this.createFillHandle(bounds.maxX, bounds.maxY);
    } else {
      this.updateFillHandlePosition(bounds.maxX, bounds.maxY);
    }
  }
  
  renderFillPreview(previewCells: Set<string>, viewport: ViewportInfo): void {
    
    // Clear existing preview
    this.clearFillPreview();
    
    if (previewCells.size === 0) return;
    
    // Create shapes for preview
    let configuredShapes = 0;
    for (const cellKey of previewCells) {
      
      const [rowId, columnId] = cellKey.split(':');
      if (!this.coordinateMapping) {
        console.warn('FillHandleLayer: No coordinate mapping available');
        continue;
      }
      
      // Find row and column in coordinate mapping
      const rowIndex = this.coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
      const colData = this.coordinateMapping.columns.find((c: any) => c.columnId === columnId);
      
      if (rowIndex === -1 || !colData) {
        continue;
      }
      
      // Calculate position using coordinate mapping
      const position = {
        x: colData.offset || 0,
        y: rowIndex * this.config.cellHeight
      };
      
      const columnWidth = colData.width || 100;
        // Create preview shape
        const shape = new Konva.Rect({
          x: position.x,
          y: position.y,
          width: columnWidth - 1,
          height: this.config.cellHeight - 1,
          fill: this.config.selectionBorderColor,
          opacity: 0.3,
          stroke: this.config.selectionBorderColor,
          strokeWidth: 1,
          dash: [3, 3],
          visible: true
        });
        
        this.layer.add(shape);
        this.activeFillPreviewShapes.push(shape);
        configuredShapes++;
      }
    }
    
    
    this.layer.batchDraw();
  }
  
  clearFillPreview(): void {
    if (this.activeFillPreviewShapes.length > 0) {
      // Destroy all preview shapes
      this.activeFillPreviewShapes.forEach(shape => shape.destroy());
      this.activeFillPreviewShapes = [];
      this.layer.batchDraw();
    }
  }
  
  hideFillHandle(): void {
    if (this.activeFillHandle) {
      this.cleanupFillHandle();
      this.activeFillHandle = null;
    }
  }
  
  // ====================================
  // FILL CALCULATION - VERTICAL ONLY
  // ====================================
  
  calculateFillPreviewCells(
    dragPos: { x: number; y: number },
    selectedCells: Set<string>,
    viewport: ViewportInfo
  ): Set<string> {
    if (selectedCells.size === 0) return new Set();
    
    // Get selection bounds
    const selectionBounds = this.getSelectionBounds(selectedCells, viewport);
    if (!selectionBounds) return new Set(selectedCells);
    
    // Calculate drag delta relative to selection bottom (VERTICAL ONLY)
    const dragDeltaY = dragPos.y - selectionBounds.maxY;
    
    
    // Only proceed if dragging down and more than 5 pixels
    if (dragDeltaY <= 5) {
      return new Set(selectedCells);
    }
    
    // Calculate additional rows to fill
    const additionalRows = Math.floor(dragDeltaY / this.config.cellHeight);
    if (additionalRows <= 0) {
      return new Set(selectedCells);
    }
    
    // Start with original selection
    const previewCells = new Set(selectedCells);
    
    // Get all selected columns for vertical fill
    const selectedColumns = new Set<string>();
    selectedCells.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      if (columnId) {
        selectedColumns.add(columnId);
      }
    });
    
    // Get all available row IDs from the coordinate mapping
    const allRowIds = this.coordinateMapping?.rows.map((r: any) => r.rowId) || [];
    
    if (allRowIds.length === 0) {
      console.warn('FillHandleLayer: No row mappings available in coordinate system');
      return new Set(selectedCells);
    }
    
    // Find bottom-most row index in the selection
    let maxRowIndex = -1;
    selectedCells.forEach(cellKey => {
      const [rowId] = cellKey.split(':');
      if (rowId) {
        const rowIndex = allRowIds.indexOf(rowId);
        if (rowIndex !== -1) {
          maxRowIndex = Math.max(maxRowIndex, rowIndex);
        }
      }
    });
    
    if (maxRowIndex === -1) {
      console.warn('FillHandleLayer: Could not determine max row index from mappings');
      return new Set(selectedCells);
    }
    
    // Add fill cells vertically for each selected column using actual row IDs
    for (let rowOffset = 1; rowOffset <= additionalRows; rowOffset++) {
      const fillRowIndex = maxRowIndex + rowOffset;
      
      // Check if we have a row ID at this index
      if (fillRowIndex < allRowIds.length) {
        const fillRowId = allRowIds[fillRowIndex];
        
        selectedColumns.forEach(columnId => {
          const fillCellKey = `${fillRowId}:${columnId}`;
          previewCells.add(fillCellKey);
        });
      }
    }
    
    
    return previewCells;
  }
  
  // ====================================
  // ROW SELECTION DETECTION
  // ====================================
  
  /**
   * Determine if the visual cells represent a complete row selection
   */
  private isCompleteRowSelection(visualCells: VisualCellPosition[], selectedRows?: Set<string>): boolean {
    if (!selectedRows || selectedRows.size === 0) {
      return false;
    }
    
    // Extract unique row IDs from visual cells
    const visualRowIds = new Set<string>();
    visualCells.forEach(cell => {
      // Parse cell key format: "rowId:columnId"
      const parts = cell.cellKey.split(':');
      if (parts.length >= 2) {
        visualRowIds.add(parts[0]);
      }
    });
    
    // Check if all visual rows are in selectedRows
    for (const rowId of visualRowIds) {
      if (!selectedRows.has(rowId)) {
        return false; // This row is not selected, so it's partial cell selection
      }
    }
    
    // All visual rows are in selectedRows, this is a complete row selection
    return visualRowIds.size > 0;
  }

  // ====================================
  // PRIVATE IMPLEMENTATION
  // ====================================
  
  private createFillHandle(x: number, y: number): void {
    console.log('FillHandleLayer: Creating fill handle at', { x, y });
    
    // Create fill handle with Konva events enabled
    this.activeFillHandle = new Konva.Rect({
      x: x - 5,
      y: y - 5,
      width: this.originalSize,
      height: this.originalSize,
      fill: this.config.selectionBorderColor,
      stroke: 'white',
      strokeWidth: 2,
      draggable: true, // Enable dragging for fill functionality
      cornerRadius: 2,
      shadowColor: 'black',
      shadowBlur: 3,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 0.4,
      listening: true, // Enable events for fill handle only
      name: 'fill-handle'
    });
    
    // CRITICAL: Add DOM event interceptor to prevent cell selection on fill handle
    this.setupDOMEventInterceptor(x - 5, y - 5, this.originalSize, this.originalSize);
    
    // Constrain dragging to vertical only
    this.activeFillHandle.dragBoundFunc(function(pos) {
      return {
        x: this.absolutePosition().x,
        y: pos.y
      };
    });
    
    // Set up hover and drag events
    this.setupHoverEffects();
    this.setupDragEvents();
    
    // Add to interactive layer
    this.fillHandleLayer.add(this.activeFillHandle);
    this.activeFillHandle.moveToTop();
    
    this.fillHandleLayer.batchDraw();
    
  }
  
  private updateFillHandlePosition(x: number, y: number): void {
    if (!this.activeFillHandle) return;
    
    const handleX = x - 5;
    const handleY = y - 5;
    
    this.activeFillHandle.position({ x: handleX, y: handleY });
    this.activeFillHandle.visible(true);
    
    // Update DOM interceptor position as well
    this.updateDOMInterceptorPosition(handleX, handleY);
    
    this.fillHandleLayer.batchDraw();
  }
  
  private updateDOMInterceptorPosition(x: number, y: number): void {
    const interceptor = (this.activeFillHandle as any)?._domInterceptor;
    if (interceptor) {
      interceptor.style.left = `${x}px`;
      interceptor.style.top = `${y}px`;
      // Position updated silently - too frequent to log
    }
  }
  
  private enlargeFillHandle(): void {
    if (!this.activeFillHandle) return;
    
    const hoverSize = 16;
    const currentPos = this.activeFillHandle.position();
    const sizeDiff = (hoverSize - this.originalSize) / 2;
    
    this.activeFillHandle.setAttrs({
      width: hoverSize,
      height: hoverSize,
      x: currentPos.x - sizeDiff,
      y: currentPos.y - sizeDiff,
      shadowBlur: 5,
      shadowOpacity: 0.6
    });
    
    this.fillHandleLayer.batchDraw();
  }
  
  private shrinkFillHandle(): void {
    if (!this.activeFillHandle) return;
    
    const currentPos = this.activeFillHandle.position();
    const hoverSize = 16;
    const sizeDiff = (hoverSize - this.originalSize) / 2;
    
    this.activeFillHandle.setAttrs({
      width: this.originalSize,
      height: this.originalSize,
      x: currentPos.x + sizeDiff,
      y: currentPos.y + sizeDiff,
      shadowBlur: 3,
      shadowOpacity: 0.4
    });
    
    this.fillHandleLayer.batchDraw();
  }
  
  private setupHoverEffects(): void {
    if (!this.activeFillHandle) return;
    
    const hoverSize = 16;
    
    // Mouseenter - increase size and change cursor
    this.activeFillHandle.on('mouseenter', () => {
      if (!this.activeFillHandle) return;
      
      
      const currentPos = this.activeFillHandle.position();
      const sizeDiff = (hoverSize - this.originalSize) / 2;
      
      this.activeFillHandle.setAttrs({
        width: hoverSize,
        height: hoverSize,
        x: currentPos.x - sizeDiff,
        y: currentPos.y - sizeDiff,
        shadowBlur: 5,
        shadowOpacity: 0.6
      });
      
      // Change cursor using CSS
      this.stage.content.style.cursor = 'ns-resize';
      
      this.fillHandleLayer.batchDraw();
    });
    
    // Mouseleave - restore original size and cursor
    this.activeFillHandle.on('mouseleave', () => {
      if (!this.activeFillHandle) return;
      
      
      const currentPos = this.activeFillHandle.position();
      const sizeDiff = (hoverSize - this.originalSize) / 2;
      
      this.activeFillHandle.setAttrs({
        width: this.originalSize,
        height: this.originalSize,
        x: currentPos.x + sizeDiff,
        y: currentPos.y + sizeDiff,
        shadowBlur: 3,
        shadowOpacity: 0.4
      });
      
      // Restore default cursor
      this.stage.content.style.cursor = 'default';
      
      this.fillHandleLayer.batchDraw();
    });
  }
  
  
  private setupDragEvents(): void {
    if (!this.activeFillHandle) return;
    
    // Drag start
    this.activeFillHandle.on('dragstart', () => {
      this.callbacks.onFillStart('vertical');
    });
    
    // Drag move - show preview
    this.activeFillHandle.on('dragmove', () => {
      if (!this.activeFillHandle) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const selectedCells = this.callbacks.getSelectedCells();
      const viewport = this.callbacks.getViewport();
      if (!viewport) return;
      
      // Calculate and render fill preview
      const previewCells = this.calculateFillPreviewCells(
        pos,
        selectedCells,
        viewport
      );
      
      this.renderFillPreview(previewCells, viewport);
      this.callbacks.onFillPreview(previewCells);
    });
    
    // Drag end - complete fill
    this.activeFillHandle.on('dragend', () => {
      if (!this.activeFillHandle) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const selectedCells = this.callbacks.getSelectedCells();
      const viewport = this.callbacks.getViewport();
      if (!viewport) return;
      
      // Calculate final fill cells
      const fillCells = this.calculateFillPreviewCells(
        pos,
        selectedCells,
        viewport
      );
      
      // Clear preview and complete fill
      this.clearFillPreview();
      this.callbacks.onFillComplete(fillCells);
      
      // Restore cursor
      this.stage.content.style.cursor = 'default';
    });
  }

  private getSelectionBounds(selectedCells: Set<string>, viewport: ViewportInfo) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cellKey of selectedCells) {
      const [rowId, columnId] = cellKey.split(':');
      if (!this.coordinateMapping || !rowId || !columnId) continue;
      
      // Find row and column in coordinate mapping
      const rowIndex = this.coordinateMapping.rows.findIndex((r: any) => r.rowId === rowId);
      const colData = this.coordinateMapping.columns.find((c: any) => c.columnId === columnId);
      
      if (rowIndex !== -1 && colData) {
        const position = {
          x: colData.offset || 0,
          y: rowIndex * this.config.cellHeight
        };
        const columnWidth = colData.width || 100;
        const cellRight = position.x + columnWidth;
        const cellBottom = position.y + this.config.cellHeight;
        
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, cellRight);
        maxY = Math.max(maxY, cellBottom);
      }
    }
    
    if (minX === Infinity) return null;
    
    return { minX, minY, maxX, maxY };
  }
  
  private setupDOMEventInterceptor(x: number, y: number, width: number, height: number): void {
    const viewportElement = document.querySelector('.vibegridx-viewport');
    if (!viewportElement) return;
    
    // Create interceptor positioned relative to the viewport, not document
    const interceptor = document.createElement('div');
    interceptor.style.position = 'absolute';
    interceptor.style.left = `${x}px`; // Relative to canvas container
    interceptor.style.top = `${y}px`;  // Relative to canvas container
    interceptor.style.width = `${width}px`;
    interceptor.style.height = `${height}px`;
    interceptor.style.zIndex = '10'; // Above canvas but below modals
    interceptor.style.backgroundColor = 'transparent'; // Invisible in production
    interceptor.style.pointerEvents = 'all';
    interceptor.style.cursor = 'crosshair';
    interceptor.setAttribute('data-fill-handle-interceptor', 'true');
    interceptor.className = 'vibegridx-fill-handle'; // Add the class that EventDelegationManager looks for
    
    // Add hover effects
    interceptor.addEventListener('mouseenter', () => {
      interceptor.style.cursor = 'ns-resize';
      this.enlargeFillHandle();
    });
    
    interceptor.addEventListener('mouseleave', () => {
      interceptor.style.cursor = 'crosshair';
      this.shrinkFillHandle();
    });
    
    // Remove our custom event handling - EventDelegationManager will handle it
    // We just need the visual DOM element with the right class
    
    // Add to canvas container, not document body
    const canvasContainer = this.stage.container();
    canvasContainer.style.position = 'relative'; // Ensure it can contain absolute children
    canvasContainer.appendChild(interceptor);
    
    // Store reference for cleanup
    (this.activeFillHandle as any)._domInterceptor = interceptor;
    
  }

  private cleanupFillHandle(): void {
    if (!this.activeFillHandle) return;
    
    // Remove DOM interceptor
    const interceptor = (this.activeFillHandle as any)._domInterceptor;
    if (interceptor && interceptor.parentNode) {
      interceptor.parentNode.removeChild(interceptor);
    }
    
    // Remove all event listeners
    this.activeFillHandle.off('mouseenter');
    this.activeFillHandle.off('mouseleave');
    this.activeFillHandle.off('dragstart');
    this.activeFillHandle.off('dragmove');
    this.activeFillHandle.off('dragend');
    
    // Restore default cursor
    this.stage.content.style.cursor = 'default';
    
    // Destroy the visual shape
    this.activeFillHandle.destroy();
    
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  destroy(): void {
    this.hideFillHandle();
    this.clearFillPreview();
    
    // Clean up the dedicated interactive layer
    if (this.fillHandleLayer) {
      this.fillHandleLayer.destroy();
    }
    
  }
}