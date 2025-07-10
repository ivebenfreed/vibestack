import Konva from 'konva';
import type { ViewportInfo } from '../types';
import type { OverlayMachineActor } from '../machines/overlay-machine';
import { CoordinateSystem } from './CoordinateSystem';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// FILL HANDLE LAYER - Modular Implementation
// ====================================

export interface FillHandleConfig {
  cellHeight: number;
  dimensionManager: ColumnDimensionManager;
  selectionBorderColor: string;
}

export class FillHandleLayer {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private fillHandleLayer: Konva.Layer; // Dedicated interactive layer
  private machine: OverlayMachineActor | null = null;
  private config: FillHandleConfig;
  private coordinateSystem: CoordinateSystem;
  
  // Fill handle state
  private activeFillHandle: Konva.Rect | null = null;
  private activeFillPreviewShapes: Konva.Rect[] = [];
  
  // Visual settings
  private originalSize = 10;
  
  constructor(
    stage: Konva.Stage,
    coordinateSystem: CoordinateSystem,
    config: FillHandleConfig
  ) {
    this.stage = stage;
    this.coordinateSystem = coordinateSystem;
    this.config = config;
    
    // Create main layer for preview shapes
    this.layer = new Konva.Layer({
      name: 'fill-preview-layer',
      listening: false
    });
    stage.add(this.layer);
    
    
    // Create dedicated interactive layer for specialized controls
    this.fillHandleLayer = new Konva.Layer({
      name: 'interactive-controls-layer',
      listening: true, // Enable events for interactive controls only
      hitGraphEnabled: true // Enable hit detection
    });
    this.stage.add(this.fillHandleLayer);
    this.fillHandleLayer.moveToTop(); // Above visual-only layers
    
    // Test if events work at all on this layer
    this.fillHandleLayer.on('click', () => {
      console.log('FillHandleLayer: Interactive layer click detected!');
    });
    
    this.fillHandleLayer.on('mousemove', () => {
      console.log('FillHandleLayer: Interactive layer mousemove detected!');
    });
    
    console.log('FillHandleLayer: Hybrid architecture - DOM for cells, Konva for controls');
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  setMachine(machine: OverlayMachineActor): void {
    this.machine = machine;
  }
  
  renderFillHandle(selectedCells: Set<string>, viewport: ViewportInfo): void {
    console.log('FillHandleLayer.renderFillHandle:', selectedCells.size, 'cells');
    
    if (selectedCells.size === 0) {
      console.log('FillHandleLayer: No selected cells, hiding fill handle');
      this.hideFillHandle();
      return;
    }
    
    // Calculate selection bounds
    const bounds = this.getSelectionBounds(selectedCells, viewport);
    console.log('FillHandleLayer: Selection bounds calculated:', bounds);
    
    if (!bounds) {
      console.log('FillHandleLayer: No valid bounds, hiding fill handle');
      this.hideFillHandle();
      return;
    }
    
    // Calculate fill handle position (bottom-right corner of selection)
    const handleX = bounds.maxX - 5;
    const handleY = bounds.maxY - 5;
    
    console.log('FillHandleLayer: Fill handle position calculated:', { handleX, handleY, bounds });
    
    // Check if handle is within viewport
    const isWithinViewport = handleY >= -10 && handleY <= viewport.height + 10 &&
                             handleX >= -10 && handleX <= viewport.width + 10;
    
    console.log('FillHandleLayer: Viewport check:', { 
      isWithinViewport, 
      handleY, 
      handleX,
      viewport: { height: viewport.height, width: viewport.width }
    });
    
    if (!isWithinViewport) {
      console.log('FillHandleLayer: Fill handle outside viewport, hiding');
      this.hideFillHandle();
      return;
    }
    
    // Create or update fill handle
    if (!this.activeFillHandle) {
      console.log('FillHandleLayer: Creating new fill handle');
      this.createFillHandle(bounds.maxX, bounds.maxY);
    } else {
      console.log('FillHandleLayer: Updating existing fill handle position');
      this.updateFillHandlePosition(bounds.maxX, bounds.maxY);
    }
  }
  
  renderFillPreview(previewCells: Set<string>, viewport: ViewportInfo): void {
    console.log('FillHandleLayer.renderFillPreview:', previewCells.size, 'cells');
    
    // Clear existing preview
    this.clearFillPreview();
    
    if (previewCells.size === 0) return;
    
    // Create shapes for preview
    let configuredShapes = 0;
    for (const cellKey of previewCells) {
      
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) {
        console.warn('FillHandleLayer: Failed to parse cell key', cellKey);
        continue;
      }
      
      const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
      console.log('FillHandleLayer: Position for', cellKey, position);
      
      // Debug coordinate system mappings if position is null
      if (!position) {
        const dimensions = this.coordinateSystem.getDimensions();
        const mappings = this.coordinateSystem.hasMappings(parsed.rowId, parsed.columnId);
        const allMappedIds = this.coordinateSystem.getAllMappedIds();
        console.log('FillHandleLayer: Coordinate system debug for', cellKey, {
          rowId: parsed.rowId,
          columnId: parsed.columnId,
          systemDimensions: dimensions,
          hasRowMapping: mappings.hasRow,
          hasColumnMapping: mappings.hasColumn,
          allRowIds: allMappedIds.rowIds.slice(0, 5), // First 5 for debugging
          totalMappedRows: allMappedIds.rowIds.length
        });
      }
      
      if (position) {
        const columnWidth = this.config.dimensionManager.getColumnWidth(parsed.columnId);
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
        console.log('FillHandleLayer: Created preview shape', {
          position,
          columnWidth,
          visible: shape.visible(),
          opacity: shape.opacity()
        });
      } else {
        console.warn('FillHandleLayer: No position for cell', cellKey);
      }
    }
    
    console.log('FillHandleLayer: Preview render complete', {
      totalCells: previewCells.size,
      configuredShapes,
      activeShapes: this.activeFillPreviewShapes.length
    });
    
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
    
    console.log('FillHandleLayer: Calculating vertical-only fill', {
      dragPos,
      selectionBounds,
      dragDeltaY,
      cellHeight: this.config.cellHeight
    });
    
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
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (parsed) {
        selectedColumns.add(parsed.columnId);
      }
    });
    
    // Get all available row IDs from the coordinate system
    const allMappedIds = this.coordinateSystem.getAllMappedIds();
    const allRowIds = allMappedIds.rowIds;
    
    if (allRowIds.length === 0) {
      console.warn('FillHandleLayer: No row mappings available in coordinate system');
      return new Set(selectedCells);
    }
    
    // Find bottom-most row index in the selection
    let maxRowIndex = -1;
    selectedCells.forEach(cellKey => {
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (parsed) {
        const rowIndex = allRowIds.indexOf(parsed.rowId);
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
    
    console.log('FillHandleLayer: Vertical fill result', {
      originalCells: selectedCells.size,
      selectedColumns: Array.from(selectedColumns),
      maxRowIndex,
      additionalRows,
      totalRowsAvailable: allRowIds.length,
      totalPreviewCells: previewCells.size,
      sampleRowIds: allRowIds.slice(0, 5) // Show first 5 for debugging
    });
    
    return previewCells;
  }
  
  // ====================================
  // PRIVATE IMPLEMENTATION
  // ====================================
  
  private createFillHandle(x: number, y: number): void {
    console.log('FillHandleLayer: Creating fill handle with hover effects at', { x, y });
    
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
    
    console.log('FillHandleLayer: Fill handle created (visual only)');
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
      console.log('FillHandleLayer: Updated DOM interceptor position', { x, y });
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
      
      console.log('FillHandleLayer: Fill handle mouseenter - increasing size');
      
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
      
      console.log('FillHandleLayer: Fill handle mouseleave - restoring size');
      
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
      console.log('FillHandleLayer: Fill drag started');
      this.machine.send({ type: 'FILL_START', direction: 'vertical' });
    });
    
    // Drag move - show preview
    this.activeFillHandle.on('dragmove', () => {
      if (!this.activeFillHandle) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const context = this.machine.getSnapshot().context;
      if (!context.viewport) return;
      
      // Calculate and render fill preview
      const previewCells = this.calculateFillPreviewCells(
        pos,
        context.selectedCells,
        context.viewport
      );
      
      this.renderFillPreview(previewCells, context.viewport);
    });
    
    // Drag end - complete fill
    this.activeFillHandle.on('dragend', () => {
      console.log('FillHandleLayer: Fill drag ended');
      
      if (!this.activeFillHandle) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const context = this.machine.getSnapshot().context;
      if (!context.viewport) return;
      
      // Calculate final fill cells
      const fillCells = this.calculateFillPreviewCells(
        pos,
        context.selectedCells,
        context.viewport
      );
      
      // Clear preview and complete fill
      this.clearFillPreview();
      if (this.machine) {
        this.machine.send({ type: 'FILL_COMPLETE', fillCells });
      }
      
      // Restore cursor
      this.stage.content.style.cursor = 'default';
    });
  }

  private getSelectionBounds(selectedCells: Set<string>, viewport: ViewportInfo) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cellKey of selectedCells) {
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) continue;
      
      const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
      if (position) {
        const columnWidth = this.config.dimensionManager.getColumnWidth(parsed.columnId);
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
    
    // Add hover effects
    interceptor.addEventListener('mouseenter', () => {
      console.log('FillHandleLayer: Fill handle hover started');
      interceptor.style.cursor = 'ns-resize';
      this.enlargeFillHandle();
    });
    
    interceptor.addEventListener('mouseleave', () => {
      console.log('FillHandleLayer: Fill handle hover ended');
      interceptor.style.cursor = 'crosshair';
      this.shrinkFillHandle();
    });
    
    // Add drag functionality
    let isDragging = false;
    let startY = 0;
    
    interceptor.addEventListener('mousedown', (e) => {
      console.log('FillHandleLayer: Fill handle drag started');
      e.stopPropagation();
      e.preventDefault();
      
      isDragging = true;
      startY = e.clientY;
      
      // Start fill operation
      this.machine.send({ type: 'FILL_START', direction: 'vertical' });
    });
    
    // Global mouse events for dragging
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = e.clientY - startY;
      console.log('FillHandleLayer: Fill handle dragging', { deltaY, clientY: e.clientY, startY });
      
      // Convert screen coordinates to canvas coordinates
      const canvasContainer = this.stage.container();
      const containerRect = canvasContainer.getBoundingClientRect();
      const canvasX = e.clientX - containerRect.left;
      const canvasY = e.clientY - containerRect.top;
      
      console.log('FillHandleLayer: Converted coordinates', { 
        screen: { x: e.clientX, y: e.clientY },
        canvas: { x: canvasX, y: canvasY },
        containerRect
      });
      
      // Calculate fill preview
      const context = this.machine.getSnapshot().context;
      if (context.viewport && context.selectedCells.size > 0) {
        const previewCells = this.calculateFillPreviewCells(
          { x: canvasX, y: canvasY },
          context.selectedCells,
          context.viewport
        );
        console.log('FillHandleLayer: Preview cells calculated', { previewCells: previewCells.size });
        this.renderFillPreview(previewCells, context.viewport);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      
      console.log('FillHandleLayer: Fill handle drag ended');
      isDragging = false;
      
      // Convert screen coordinates to canvas coordinates
      const canvasContainer = this.stage.container();
      const containerRect = canvasContainer.getBoundingClientRect();
      const canvasX = e.clientX - containerRect.left;
      const canvasY = e.clientY - containerRect.top;
      
      // Complete fill operation
      const context = this.machine.getSnapshot().context;
      if (context.viewport && context.selectedCells.size > 0) {
        const fillCells = this.calculateFillPreviewCells(
          { x: canvasX, y: canvasY },
          context.selectedCells,
          context.viewport
        );
        
        console.log('FillHandleLayer: Final fill cells', { fillCells: fillCells.size });
        this.clearFillPreview();
        if (this.machine) {
        this.machine.send({ type: 'FILL_COMPLETE', fillCells });
      }
      }
      
      // Remove global listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add global listeners when drag starts
    interceptor.addEventListener('mousedown', () => {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
    
    // Add to canvas container, not document body
    const canvasContainer = this.stage.container();
    canvasContainer.style.position = 'relative'; // Ensure it can contain absolute children
    canvasContainer.appendChild(interceptor);
    
    // Store reference for cleanup
    (this.activeFillHandle as any)._domInterceptor = interceptor;
    
    console.log('FillHandleLayer: DOM event interceptor created', { x, y, width, height });
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
    
    console.log('FillHandleLayer: Fill handle cleaned up');
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
    
    console.log('FillHandleLayer: Destroyed');
  }
}