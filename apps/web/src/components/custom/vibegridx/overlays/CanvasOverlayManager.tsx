import React from 'react';
import Konva from 'konva';
import type { CellRef, SelectionRange, ViewportInfo } from '../types';

// ====================================
// OVERLAY CONFIGURATION
// ====================================

interface OverlayConfig {
  cellWidth: number;
  cellHeight: number;
  borderWidth: number;
  
  // Colors
  selectionColor: string;
  selectionBorderColor: string;
  editingColor: string;
  editingBorderColor: string;
  dragIndicatorColor: string;
  
  // Animation
  enableAnimations: boolean;
  animationDuration: number;
  
  // Performance
  enableLayerCaching: boolean;
  maxSelectableCells: number;
}

interface OverlayState {
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  selectionRanges: SelectionRange[];
  draggedItem: any | null;
  dropTarget: any | null;
  viewport: ViewportInfo;
}

// ====================================
// LAYER MANAGERS
// ====================================

class SelectionLayerManager {
  private layer: Konva.Layer;
  private selectionGroup: Konva.Group;
  private config: OverlayConfig;
  
  // Shape pools for performance
  private cellShapePool: Konva.Rect[] = [];
  private borderShapePool: Konva.Rect[] = [];
  private activeShapes = new Map<string, { cell: Konva.Rect; border: Konva.Rect }>();
  
  // Fill handle
  private fillHandle: Konva.Rect | null = null;
  private fillPreviewShapes: Konva.Rect[] = [];
  private originalSelection: Set<string> = new Set();
  private selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  
  // Copy/Cut indicator
  private copyIndicator: Konva.Rect | null = null;
  private isCutMode: boolean = false;
  
  // Callback for selection updates
  public onSelectionUpdate?: (cells: Set<string>) => void;
  
  constructor(layer: Konva.Layer, config: OverlayConfig) {
    this.layer = layer;
    this.config = config;
    
    this.selectionGroup = new Konva.Group({
      name: 'selection-group'
    });
    
    this.layer.add(this.selectionGroup);
    this.initializeShapePools();
    this.initializeFillHandle();
    this.initializeCopyIndicator();
  }
  
  private initializeShapePools(): void {
    // Pre-create shapes for better performance
    const poolSize = Math.min(this.config.maxSelectableCells, 1000);
    
    for (let i = 0; i < poolSize; i++) {
      // Cell background shapes
      const cellShape = new Konva.Rect({
        width: this.config.cellWidth,
        height: this.config.cellHeight,
        fill: this.config.selectionColor,
        opacity: 0.3,
        visible: false,
        listening: false
      });
      
      // Border shapes
      const borderShape = new Konva.Rect({
        width: this.config.cellWidth,
        height: this.config.cellHeight,
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
    // Create fill handle (small square at bottom-right of selection)
    this.fillHandle = new Konva.Rect({
      width: 8,
      height: 8,
      fill: this.config.selectionBorderColor,
      stroke: 'white',
      strokeWidth: 1,
      visible: false,
      listening: true,
      draggable: true,
      cornerRadius: 1
    });
    
    // Create fill preview shapes
    for (let i = 0; i < 50; i++) {
      const previewShape = new Konva.Rect({
        width: this.config.cellWidth,
        height: this.config.cellHeight,
        fill: this.config.selectionColor,
        opacity: 0.2,
        stroke: this.config.selectionBorderColor,
        strokeWidth: 1,
        visible: false,
        listening: false,
        dash: [5, 5]
      });
      this.fillPreviewShapes.push(previewShape);
      this.selectionGroup.add(previewShape);
    }
    
    // Add drag event handlers
    this.fillHandle.on('dragstart', (e) => {
      e.cancelBubble = true;
      // Store original selection
      this.originalSelection = new Set(this.activeShapes.keys());
      this.calculateSelectionBounds();
    });
    
    this.fillHandle.on('dragmove', (e) => {
      e.cancelBubble = true;
      this.updateFillPreview();
    });
    
    this.fillHandle.on('dragend', (e) => {
      e.cancelBubble = true;
      // Apply the fill (mock for now - just expand selection)
      this.applyFillPreview();
      // Clear preview
      this.hideFillPreview();
      // Reset position of handle
      this.updateFillHandlePosition();
    });
    
    this.selectionGroup.add(this.fillHandle);
  }
  
  updateSelection(selectedCells: Set<string>, viewport: ViewportInfo): void {
    console.log('SelectionLayerManager.updateSelection:', { 
      selectedCells: selectedCells.size, 
      viewport,
      cellKeys: Array.from(selectedCells)
    });
    
    // Hide all currently active shapes
    this.activeShapes.forEach(shapes => {
      shapes.cell.visible(false);
      shapes.border.visible(false);
    });
    
    // Return shapes to pool
    this.activeShapes.clear();
    
    // Hide fill handle if no selection
    if (selectedCells.size === 0 && this.fillHandle) {
      this.fillHandle.visible(false);
    }
    
    // Show shapes for selected cells that are visible
    let shapeIndex = 0;
    let foundPositions = 0;
    
    for (const cellKey of selectedCells) {
      if (shapeIndex >= this.cellShapePool.length) break;
      
      const [rowId, columnId] = cellKey.split(':');
      const position = this.getCellPosition(rowId, columnId, viewport);
      
      console.log('Cell position for', cellKey, ':', position);
      
      if (position) {
        foundPositions++;
        const cellShape = this.cellShapePool[shapeIndex];
        const borderShape = this.borderShapePool[shapeIndex];
        
        // Update positions
        cellShape.position(position);
        borderShape.position(position);
        
        // Show shapes
        cellShape.visible(true);
        borderShape.visible(true);
        
        // Track active shapes
        this.activeShapes.set(cellKey, {
          cell: cellShape,
          border: borderShape
        });
        
        shapeIndex++;
      }
    }
    
    // Update fill handle position and selection bounds
    this.calculateSelectionBounds();
    this.updateFillHandlePosition();
    
    console.log('SelectionLayerManager: Drawing layer with', foundPositions, 'visible cells');
    
    // Debug: Check if stage and container are visible
    const konvaContainer = this.layer.getStage()?.container();
    if (konvaContainer) {
      const rect = konvaContainer.getBoundingClientRect();
      console.log('Konva container visibility:', {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        position: { top: rect.top, left: rect.left }
      });
    }
    
    this.layer.batchDraw();
  }
  
  private updateFillHandlePosition(): void {
    if (!this.fillHandle || this.activeShapes.size === 0) {
      if (this.fillHandle) {
        this.fillHandle.visible(false);
      }
      return;
    }
    
    // Find the bottom-right most cell
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    this.activeShapes.forEach((shapes) => {
      const x = shapes.border.x();
      const y = shapes.border.y();
      const width = shapes.border.width();
      const height = shapes.border.height();
      
      const rightX = x + width;
      const bottomY = y + height;
      
      if (rightX > maxX || (rightX === maxX && bottomY > maxY)) {
        maxX = rightX;
        maxY = bottomY;
      }
    });
    
    // Position fill handle at bottom-right corner
    if (maxX !== -Infinity && maxY !== -Infinity) {
      this.fillHandle.position({
        x: maxX - 4, // Center the 8px handle on the corner
        y: maxY - 4
      });
      this.fillHandle.visible(true);
      
      // Make sure fill handle is on top
      this.fillHandle.moveToTop();
    }
  }
  
  private calculateSelectionBounds(): void {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    this.activeShapes.forEach((shapes) => {
      const x = shapes.border.x();
      const y = shapes.border.y();
      const width = shapes.border.width();
      const height = shapes.border.height();
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    this.selectionBounds = { minX, minY, maxX, maxY };
  }
  
  private updateFillPreview(): void {
    if (!this.fillHandle || !this.selectionBounds) return;
    
    // Get current fill handle position
    const handleX = this.fillHandle.x() + 4; // Center of handle
    const handleY = this.fillHandle.y() + 4;
    
    // Calculate fill direction and distance
    const deltaX = handleX - this.selectionBounds.maxX + 4;
    const deltaY = handleY - this.selectionBounds.maxY + 4;
    
    // Hide all preview shapes first
    this.hideFillPreview();
    
    let previewIndex = 0;
    
    // Fill right
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
      const cols = Math.ceil(deltaX / this.config.cellWidth);
      for (let col = 0; col < cols && previewIndex < this.fillPreviewShapes.length; col++) {
        const x = this.selectionBounds.maxX + col * this.config.cellWidth;
        for (let y = this.selectionBounds.minY; y < this.selectionBounds.maxY && previewIndex < this.fillPreviewShapes.length; y += this.config.cellHeight) {
          const shape = this.fillPreviewShapes[previewIndex++];
          shape.position({ x, y });
          shape.visible(true);
        }
      }
    }
    // Fill down
    else if (deltaY > 0) {
      const rows = Math.ceil(deltaY / this.config.cellHeight);
      for (let row = 0; row < rows && previewIndex < this.fillPreviewShapes.length; row++) {
        const y = this.selectionBounds.maxY + row * this.config.cellHeight;
        for (let x = this.selectionBounds.minX; x < this.selectionBounds.maxX && previewIndex < this.fillPreviewShapes.length; x += this.config.cellWidth) {
          const shape = this.fillPreviewShapes[previewIndex++];
          shape.position({ x, y });
          shape.visible(true);
        }
      }
    }
    // Fill left
    else if (deltaX < 0) {
      const cols = Math.ceil(Math.abs(deltaX) / this.config.cellWidth);
      for (let col = 1; col <= cols && previewIndex < this.fillPreviewShapes.length; col++) {
        const x = this.selectionBounds.minX - col * this.config.cellWidth;
        for (let y = this.selectionBounds.minY; y < this.selectionBounds.maxY && previewIndex < this.fillPreviewShapes.length; y += this.config.cellHeight) {
          const shape = this.fillPreviewShapes[previewIndex++];
          shape.position({ x, y });
          shape.visible(true);
        }
      }
    }
    // Fill up
    else if (deltaY < 0) {
      const rows = Math.ceil(Math.abs(deltaY) / this.config.cellHeight);
      for (let row = 1; row <= rows && previewIndex < this.fillPreviewShapes.length; row++) {
        const y = this.selectionBounds.minY - row * this.config.cellHeight;
        for (let x = this.selectionBounds.minX; x < this.selectionBounds.maxX && previewIndex < this.fillPreviewShapes.length; x += this.config.cellWidth) {
          const shape = this.fillPreviewShapes[previewIndex++];
          shape.position({ x, y });
          shape.visible(true);
        }
      }
    }
    
    this.layer.batchDraw();
  }
  
  private hideFillPreview(): void {
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    this.layer.batchDraw();
  }
  
  private applyFillPreview(): void {
    // Collect visible preview shapes positions
    const newSelection = new Set(this.originalSelection);
    
    this.fillPreviewShapes.forEach(shape => {
      if (shape.visible()) {
        // Mock: Add cells in preview to selection
        // In real implementation, would calculate actual cell IDs
        const x = shape.x();
        const y = shape.y();
        // For now, just expand the selection visually
      }
    });
    
    // Update the actual selection with preview cells
    if (this.onSelectionUpdate) {
      // Mock: just keep original selection + some dummy cells
      this.onSelectionUpdate(newSelection);
    }
  }
  
  private initializeCopyIndicator(): void {
    // Create dotted line indicator for copy/cut
    this.copyIndicator = new Konva.Rect({
      stroke: '#000',
      strokeWidth: 2,
      dash: [8, 4],
      fill: 'transparent',
      visible: false,
      listening: false
    });
    this.selectionGroup.add(this.copyIndicator);
  }
  
  public showCopyIndicator(isCut: boolean = false): void {
    if (!this.copyIndicator || !this.selectionBounds) return;
    
    this.isCutMode = isCut;
    
    // Position around current selection
    this.copyIndicator.position({
      x: this.selectionBounds.minX - 2,
      y: this.selectionBounds.minY - 2
    });
    this.copyIndicator.size({
      width: this.selectionBounds.maxX - this.selectionBounds.minX + 4,
      height: this.selectionBounds.maxY - this.selectionBounds.minY + 4
    });
    
    // Different style for cut
    if (isCut) {
      this.copyIndicator.stroke('#999');
      this.copyIndicator.dash([4, 4]);
      // Make selection semi-transparent for cut
      this.activeShapes.forEach(shapes => {
        shapes.cell.opacity(0.5);
      });
    } else {
      this.copyIndicator.stroke('#000');
      this.copyIndicator.dash([8, 4]);
    }
    
    this.copyIndicator.visible(true);
    this.layer.batchDraw();
  }
  
  public hideCopyIndicator(): void {
    if (this.copyIndicator) {
      this.copyIndicator.visible(false);
      // Restore opacity
      this.activeShapes.forEach(shapes => {
        shapes.cell.opacity(0.3);
      });
      this.layer.batchDraw();
    }
  }
  
  public showDragSelectionPreview(x: number, y: number, width: number, height: number): void {
    // Hide current selection temporarily
    this.activeShapes.forEach(shapes => {
      shapes.cell.visible(false);
      shapes.border.visible(false);
    });
    
    // First, hide ALL preview shapes to avoid double highlighting
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    
    // Show preview shapes in the drag area
    const cols = Math.ceil(width / this.config.cellWidth);
    const rows = Math.ceil(height / this.config.cellHeight);
    let shapeIndex = 0;
    
    for (let row = 0; row < rows && shapeIndex < this.fillPreviewShapes.length; row++) {
      for (let col = 0; col < cols && shapeIndex < this.fillPreviewShapes.length; col++) {
        const shape = this.fillPreviewShapes[shapeIndex++];
        shape.position({
          x: x + col * this.config.cellWidth,
          y: y + row * this.config.cellHeight
        });
        shape.visible(true);
      }
    }
    
    this.layer.batchDraw();
  }
  
  public hideDragSelectionPreview(): void {
    // Hide all preview shapes
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    
    // Restore original selection
    this.activeShapes.forEach(shapes => {
      shapes.cell.visible(true);
      shapes.border.visible(true);
    });
    
    this.layer.batchDraw();
  }
  
  public applyDragSelection(x: number, y: number, width: number, height: number): void {
    // Convert the drag preview to actual selection
    // For now, just keep showing the preview shapes as if they were selected
    // In a real implementation, this would update the actual selection state
    
    // Hide current selection
    this.activeShapes.forEach(shapes => {
      shapes.cell.visible(false);
      shapes.border.visible(false);
    });
    this.activeShapes.clear();
    
    // Convert preview shapes to look like regular selection
    const cols = Math.ceil(width / this.config.cellWidth);
    const rows = Math.ceil(height / this.config.cellHeight);
    let shapeIndex = 0;
    
    // First hide all preview shapes
    this.fillPreviewShapes.forEach(shape => shape.visible(false));
    
    // Then show and style the ones we need
    for (let row = 0; row < rows && shapeIndex < this.cellShapePool.length; row++) {
      for (let col = 0; col < cols && shapeIndex < this.cellShapePool.length; col++) {
        const cellShape = this.cellShapePool[shapeIndex];
        const borderShape = this.borderShapePool[shapeIndex];
        
        const posX = x + col * this.config.cellWidth;
        const posY = y + row * this.config.cellHeight;
        
        cellShape.position({ x: posX, y: posY });
        borderShape.position({ x: posX, y: posY });
        
        cellShape.visible(true);
        borderShape.visible(true);
        
        // Mock cell key for tracking
        const mockKey = `drag-${row}-${col}`;
        this.activeShapes.set(mockKey, {
          cell: cellShape,
          border: borderShape
        });
        
        shapeIndex++;
      }
    }
    
    // Update bounds for other features (fill handle, copy indicator)
    this.calculateSelectionBounds();
    this.updateFillHandlePosition();
    
    this.layer.batchDraw();
  }
  
  updateEditingCell(editingCell: CellRef | null, viewport: ViewportInfo): void {
    // Remove existing editing indicator
    const existingIndicator = this.selectionGroup.findOne('.editing-indicator');
    if (existingIndicator) {
      existingIndicator.destroy();
    }
    
    if (editingCell) {
      const position = this.getCellPosition(editingCell.rowId, editingCell.columnId, viewport);
      
      if (position && this.isCellInViewport(position, viewport)) {
        const editingIndicator = new Konva.Rect({
          x: position.x,
          y: position.y,
          width: this.config.cellWidth,
          height: this.config.cellHeight,
          stroke: this.config.editingBorderColor,
          strokeWidth: this.config.borderWidth * 2,
          fill: this.config.editingColor,
          opacity: 0.1,
          name: 'editing-indicator'
        });
        
        this.selectionGroup.add(editingIndicator);
        
        // Animate if enabled
        if (this.config.enableAnimations) {
          editingIndicator.to({
            scaleX: 1.02,
            scaleY: 1.02,
            duration: this.config.animationDuration / 1000,
            easing: Konva.Easings.EaseInOut
          });
        }
      }
    }
    
    this.layer.batchDraw();
  }
  
  private getCellPosition(rowId: string, columnId: string, viewport: ViewportInfo): { x: number; y: number } | null {
    // We need to get the actual DOM element to find its position
    const cellElement = document.querySelector(`[data-row-id="${rowId}"][data-column-id="${columnId}"]`) as HTMLElement;
    
    if (!cellElement) {
      // Expected when cell is not rendered due to virtual scrolling
      return null;
    }
    
    // Since the canvas is now inside the scrollable container,
    // we just need the position relative to the body element
    const bodyElement = cellElement.closest('.vibegridx-body');
    if (!bodyElement) {
      return null;
    }
    
    const bodyRect = bodyElement.getBoundingClientRect();
    const cellRect = cellElement.getBoundingClientRect();
    
    // Simple relative position - no scroll adjustment needed
    return {
      x: cellRect.left - bodyRect.left,
      y: cellRect.top - bodyRect.top
    };
  }
  
  private isCellInViewport(position: { x: number; y: number }, viewport: ViewportInfo): boolean {
    return position.y >= -this.config.cellHeight && 
           position.y <= viewport.height + this.config.cellHeight;
  }
}

class DragLayerManager {
  private layer: Konva.Layer;
  private dragGroup: Konva.Group;
  private config: OverlayConfig;
  
  private dragIndicator: Konva.Group | null = null;
  private dropTarget: Konva.Rect | null = null;
  
  constructor(layer: Konva.Layer, config: OverlayConfig) {
    this.layer = layer;
    this.config = config;
    
    this.dragGroup = new Konva.Group({
      name: 'drag-group'
    });
    
    this.layer.add(this.dragGroup);
  }
  
  showDragIndicator(item: any, position: { x: number; y: number }): void {
    this.hideDragIndicator();
    
    this.dragIndicator = new Konva.Group({
      x: position.x,
      y: position.y,
      draggable: false
    });
    
    // Create drag visual
    const background = new Konva.Rect({
      width: this.config.cellWidth * 2,
      height: this.config.cellHeight,
      fill: this.config.dragIndicatorColor,
      opacity: 0.8,
      cornerRadius: 4,
      shadowColor: 'black',
      shadowBlur: 10,
      shadowOffset: { x: 2, y: 2 },
      shadowOpacity: 0.3
    });
    
    const text = new Konva.Text({
      x: 8,
      y: this.config.cellHeight / 2 - 8,
      text: `Moving ${item?.type || 'item'}`,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: 'white'
    });
    
    this.dragIndicator.add(background);
    this.dragIndicator.add(text);
    this.dragGroup.add(this.dragIndicator);
    
    this.layer.batchDraw();
  }
  
  updateDragPosition(position: { x: number; y: number }): void {
    if (this.dragIndicator) {
      this.dragIndicator.position(position);
      this.layer.batchDraw();
    }
  }
  
  showDropTarget(target: any, position: { x: number; y: number }): void {
    this.hideDropTarget();
    
    this.dropTarget = new Konva.Rect({
      x: position.x,
      y: position.y,
      width: this.config.cellWidth,
      height: 4,
      fill: target.valid ? '#10b981' : '#ef4444',
      opacity: 0.8,
      cornerRadius: 2
    });
    
    this.dragGroup.add(this.dropTarget);
    this.layer.batchDraw();
  }
  
  hideDropTarget(): void {
    if (this.dropTarget) {
      this.dropTarget.destroy();
      this.dropTarget = null;
      this.layer.batchDraw();
    }
  }
  
  hideDragIndicator(): void {
    if (this.dragIndicator) {
      this.dragIndicator.destroy();
      this.dragIndicator = null;
      this.layer.batchDraw();
    }
  }
}

// ====================================
// MAIN CANVAS OVERLAY MANAGER
// ====================================

export class CanvasOverlayManager {
  public stage: Konva.Stage; // Made public so VibeGridX can access it
  private container: HTMLElement;
  private config: OverlayConfig;
  
  // Layers
  private backgroundLayer: Konva.Layer;
  private selectionLayer: Konva.Layer;
  private dragLayer: Konva.Layer;
  private overlayLayer: Konva.Layer;
  
  // Layer managers
  public selectionManager: SelectionLayerManager; // Made public for keyboard shortcuts
  private dragManager: DragLayerManager;
  
  // State
  private state: OverlayState;
  
  // Performance tracking
  private frameId = 0;
  private lastDrawTime = 0;
  private drawCount = 0;
  
  // Drag selection state
  private isDragging = false;
  private dragStartPos: { x: number; y: number } | null = null;
  private dragStartCell: { x: number; y: number } | null = null;
  
  // Debug background rect
  private debugBackground?: Konva.Rect;
  
  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    
    this.config = {
      cellWidth: 120,
      cellHeight: 40,
      borderWidth: 2,
      selectionColor: '#3b82f6',
      selectionBorderColor: '#1d4ed8',
      editingColor: '#10b981',
      editingBorderColor: '#059669',
      dragIndicatorColor: '#6366f1',
      enableAnimations: true,
      animationDuration: 200,
      enableLayerCaching: true,
      maxSelectableCells: 1000,
      ...config
    };
    
    this.state = {
      selectedCells: new Set(),
      editingCell: null,
      selectionRanges: [],
      draggedItem: null,
      dropTarget: null,
      viewport: {
        start: 0,
        end: 0,
        height: 400,
        scrollTop: 0,
        itemHeight: this.config.cellHeight
      }
    };
    
    this.initializeStage();
    this.createLayers();
    this.initializeManagers();
  }
  
  // ====================================
  // INITIALIZATION
  // ====================================
  
  private initializeStage(): void {
    // Get the container dimensions
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    
    console.log('CanvasOverlayManager: Initializing Konva stage', { width, height, container: this.container });
    
    // Initialize stage with viewport dimensions only
    this.stage = new Konva.Stage({
      container: this.container,
      width,
      height,
      listening: true // Enable event listening
    });
    
    // Defer heavy initialization to next frame to avoid blocking
    requestAnimationFrame(() => {
      // Add a background rect for debugging visibility
      const debugBackground = new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: 'rgba(0, 0, 0, 0)', // Transparent background
        listening: false
      });
      
      const debugLayer = new Konva.Layer();
      debugLayer.add(debugBackground);
      this.stage.add(debugLayer);
      
      console.log('CanvasOverlayManager: Stage initialized with debug background');
      
      // Store debug background reference for resize
      this.debugBackground = debugBackground;
    });
    
    // Keep canvas interactive - we'll handle event forwarding
    const konvaContainer = this.container.querySelector('.konvajs-content');
    if (konvaContainer) {
      (konvaContainer as HTMLElement).style.pointerEvents = 'auto';
    }
    
    // Set up event forwarding from Konva to the table underneath
    this.setupEventForwarding();
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const newWidth = this.container.clientWidth || 800;
      const newHeight = this.container.clientHeight || 600;
      
      console.log('CanvasOverlayManager: Resizing stage', { newWidth, newHeight });
      
      // Resize stage to viewport size
      this.stage.width(newWidth);
      this.stage.height(newHeight);
      
      // Update debug background if it exists
      if (this.debugBackground) {
        this.debugBackground.width(newWidth);
        this.debugBackground.height(newHeight);
      }
      
      this.stage.batchDraw();
    });
    
    // Observe the container
    resizeObserver.observe(this.container);
  }
  
  private setupEventForwarding(): void {
    // Handle mousedown for drag selection
    this.stage.on('mousedown', (e) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const shape = e.target;
      if (shape && shape !== this.stage && shape.attrs && shape.attrs.listening) {
        return; // Don't start drag on interactive elements
      }
      
      // Start drag selection
      this.isDragging = true;
      this.dragStartPos = pos;
      
      // Calculate starting cell
      this.dragStartCell = {
        x: Math.floor(pos.x / this.config.cellWidth),
        y: Math.floor(pos.y / this.config.cellHeight)
      };
    });
    
    // Handle mousemove for drag selection
    this.stage.on('mousemove', (e) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      if (this.isDragging && this.dragStartPos && this.dragStartCell) {
        // Calculate current cell
        const currentCell = {
          x: Math.floor(pos.x / this.config.cellWidth),
          y: Math.floor(pos.y / this.config.cellHeight)
        };
        
        // Update selection preview using the selection manager
        const minX = Math.min(this.dragStartCell.x, currentCell.x);
        const maxX = Math.max(this.dragStartCell.x, currentCell.x);
        const minY = Math.min(this.dragStartCell.y, currentCell.y);
        const maxY = Math.max(this.dragStartCell.y, currentCell.y);
        
        // Create preview selection
        this.selectionManager.showDragSelectionPreview(
          minX * this.config.cellWidth,
          minY * this.config.cellHeight,
          (maxX - minX + 1) * this.config.cellWidth,
          (maxY - minY + 1) * this.config.cellHeight
        );
      } else {
        // Update cursor based on what we're hovering over
        const shape = e.target;
        if (shape && shape !== this.stage && shape.attrs && shape.attrs.draggable) {
          this.container.style.cursor = 'crosshair';
        } else {
          this.container.style.cursor = 'default';
        }
      }
    });
    
    // Handle mouseup for drag selection and clicks
    this.stage.on('mouseup', (e) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      if (this.isDragging && this.dragStartPos) {
        // Check if it was actually a drag (moved more than 5 pixels)
        const dragDistance = Math.sqrt(
          Math.pow(pos.x - this.dragStartPos.x, 2) + 
          Math.pow(pos.y - this.dragStartPos.y, 2)
        );
        
        if (dragDistance > 5) {
          // It was a drag selection
          // Calculate the selected cell range
          const currentCell = {
            x: Math.floor(pos.x / this.config.cellWidth),
            y: Math.floor(pos.y / this.config.cellHeight)
          };
          
          const minX = Math.min(this.dragStartCell.x, currentCell.x);
          const maxX = Math.max(this.dragStartCell.x, currentCell.x);
          const minY = Math.min(this.dragStartCell.y, currentCell.y);
          const maxY = Math.max(this.dragStartCell.y, currentCell.y);
          
          console.log('Drag selection completed', {
            start: this.dragStartCell,
            end: currentCell,
            cells: `${(maxX - minX + 1) * (maxY - minY + 1)} cells`
          });
          
          // Apply the drag selection (convert preview to actual selection)
          this.selectionManager.applyDragSelection(
            minX * this.config.cellWidth,
            minY * this.config.cellHeight,
            (maxX - minX + 1) * this.config.cellWidth,
            (maxY - minY + 1) * this.config.cellHeight
          );
        } else {
          // It was a click, not a drag - forward to table
          const shape = e.target;
          if (shape && shape !== this.stage && shape.attrs && shape.attrs.listening) {
            return;
          }
          
          const canvasRect = this.container.getBoundingClientRect();
          const x = canvasRect.left + pos.x;
          const y = canvasRect.top + pos.y;
          
          const originalDisplay = this.container.style.display;
          this.container.style.display = 'none';
          const element = document.elementFromPoint(x, y);
          this.container.style.display = originalDisplay;
          
          if (element) {
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              screenX: x,
              screenY: y,
              ctrlKey: e.evt.ctrlKey,
              shiftKey: e.evt.shiftKey,
              altKey: e.evt.altKey,
              metaKey: e.evt.metaKey
            });
            element.dispatchEvent(clickEvent);
          }
        }
        
        // Reset drag state
        this.isDragging = false;
        this.dragStartPos = null;
        this.dragStartCell = null;
      }
    });
    
    
    // Forward keyboard events (if needed)
    this.stage.on('keydown', (e) => {
      // Forward to table for keyboard navigation
      const keyEvent = new KeyboardEvent('keydown', {
        key: e.evt.key,
        code: e.evt.code,
        ctrlKey: e.evt.ctrlKey,
        shiftKey: e.evt.shiftKey,
        altKey: e.evt.altKey,
        metaKey: e.evt.metaKey,
        bubbles: true
      });
      this.container.dispatchEvent(keyEvent);
    });
  }
  
  private createLayers(): void {
    // Background layer for grid lines, etc.
    this.backgroundLayer = new Konva.Layer({
      name: 'background-layer'
    });
    
    // Selection layer for cell selections
    this.selectionLayer = new Konva.Layer({
      name: 'selection-layer'
    });
    
    // Drag layer for drag indicators
    this.dragLayer = new Konva.Layer({
      name: 'drag-layer'
    });
    
    // Overlay layer for other UI elements
    this.overlayLayer = new Konva.Layer({
      name: 'overlay-layer'
    });
    
    // Add layers to stage
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.selectionLayer);
    this.stage.add(this.dragLayer);
    this.stage.add(this.overlayLayer);
    
    // Don't cache empty layers - they will be cached when content is added
    // Layer caching will be enabled when shapes are actually added to the layers
  }
  
  private initializeManagers(): void {
    this.selectionManager = new SelectionLayerManager(this.selectionLayer, this.config);
    this.dragManager = new DragLayerManager(this.dragLayer, this.config);
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  updateSelection(selectedCells: Set<string>): void {
    this.state.selectedCells = selectedCells;
    this.selectionManager.updateSelection(selectedCells, this.state.viewport);
  }
  
  updateEditingCell(editingCell: CellRef | null): void {
    this.state.editingCell = editingCell;
    this.selectionManager.updateEditingCell(editingCell, this.state.viewport);
  }
  
  updateViewport(viewport: ViewportInfo): void {
    this.state.viewport = viewport;
    
    // Update all layers based on new viewport
    this.selectionManager.updateSelection(this.state.selectedCells, viewport);
    this.selectionManager.updateEditingCell(this.state.editingCell, viewport);
  }
  
  updateDrag(draggedItem: any | null, mousePosition?: { x: number; y: number }): void {
    this.state.draggedItem = draggedItem;
    
    if (draggedItem && mousePosition) {
      this.dragManager.showDragIndicator(draggedItem, mousePosition);
    } else {
      this.dragManager.hideDragIndicator();
    }
  }
  
  updateDropTarget(dropTarget: any | null, position?: { x: number; y: number }): void {
    this.state.dropTarget = dropTarget;
    
    if (dropTarget && position) {
      this.dragManager.showDropTarget(dropTarget, position);
    } else {
      this.dragManager.hideDropTarget();
    }
  }
  
  updateMousePosition(position: { x: number; y: number }): void {
    if (this.state.draggedItem) {
      this.dragManager.updateDragPosition(position);
    }
  }
  
  // ====================================
  // FILL HANDLE OPERATIONS
  // ====================================
  
  handleFillDrag(startPos: { x: number; y: number }, endPos: { x: number; y: number }): void {
    // This will be called when the fill handle is dragged
    // For now, just log the positions
    console.log('Fill drag:', { startPos, endPos });
    
    // TODO: Calculate which cells to fill based on drag direction
    // TODO: Preview the fill operation
    // TODO: Execute the fill when drag ends
  }
  
  // ====================================
  // CONFIGURATION
  // ====================================
  
  updateConfig(config: Partial<OverlayConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recreate managers if necessary
    if (config.cellWidth || config.cellHeight || config.maxSelectableCells) {
      this.initializeManagers();
    }
  }
  
  // ====================================
  // PERFORMANCE
  // ====================================
  
  getPerformanceMetrics() {
    return {
      drawCount: this.drawCount,
      lastDrawTime: this.lastDrawTime,
      layerCount: this.stage.children.length,
      nodeCount: this.stage.find('*').length,
      stageSize: {
        width: this.stage.width(),
        height: this.stage.height()
      }
    };
  }
  
  optimizePerformance(): void {
    // Cache layers if not already cached and they have content
    if (this.config.enableLayerCaching) {
      // Only cache layers that have children (shapes)
      if (this.backgroundLayer.children.length > 0) {
        try {
          this.backgroundLayer.cache();
        } catch (error) {
          console.warn('Failed to cache background layer:', error);
        }
      }
      
      if (this.selectionLayer.children.length > 0) {
        try {
          this.selectionLayer.cache();
        } catch (error) {
          console.warn('Failed to cache selection layer:', error);
        }
      }
    }
    
    // Set hit graph to false for better performance
    this.stage.listening(false);
  }
  
  // ====================================
  // UTILITY METHODS
  // ====================================
  
  // Convert screen coordinates to cell coordinates
  screenToCell(x: number, y: number): { row: number; column: number } {
    const adjustedY = y + this.state.viewport.scrollTop;
    
    return {
      row: Math.floor(adjustedY / this.config.cellHeight),
      column: Math.floor(x / this.config.cellWidth)
    };
  }
  
  // Convert cell coordinates to screen coordinates
  cellToScreen(row: number, column: number): { x: number; y: number } {
    return {
      x: column * this.config.cellWidth,
      y: (row * this.config.cellHeight) - this.state.viewport.scrollTop
    };
  }
  
  // Check if cell is visible in current viewport
  isCellVisible(row: number, column: number): boolean {
    const position = this.cellToScreen(row, column);
    return position.y >= -this.config.cellHeight && 
           position.y <= this.state.viewport.height + this.config.cellHeight;
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  destroy(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    
    this.stage.destroy();
  }
}

// ====================================
// REACT COMPONENT
// ====================================

export const CanvasOverlay: React.FC<{
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  viewport: ViewportInfo;
  config?: Partial<OverlayConfig>;
  onManagerReady?: (manager: CanvasOverlayManager) => void;
}> = ({
  selectedCells,
  editingCell,
  viewport,
  config,
  onManagerReady
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const managerRef = React.useRef<CanvasOverlayManager | null>(null);
  
  // Initialize manager
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    managerRef.current = new CanvasOverlayManager(containerRef.current, config);
    onManagerReady?.(managerRef.current);
    
    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);
  
  // Update selection
  React.useEffect(() => {
    managerRef.current?.updateSelection(selectedCells);
  }, [selectedCells]);
  
  // Update editing cell
  React.useEffect(() => {
    managerRef.current?.updateEditingCell(editingCell);
  }, [editingCell]);
  
  // Update viewport
  React.useEffect(() => {
    managerRef.current?.updateViewport(viewport);
  }, [viewport]);
  
  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 100
      }}
    />
  );
};