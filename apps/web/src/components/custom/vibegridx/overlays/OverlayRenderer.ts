import Konva from 'konva';
import type { ViewportInfo, Column } from '../types';
import type { OverlayContext, OverlayMachineActor } from '../machines/overlay-machine';
import { ShapePoolManager } from './ShapePoolManager';
import { CoordinateSystem } from './CoordinateSystem';
import { ViewportOptimizer } from './ViewportOptimizer';
import { FillHandleLayer } from './FillHandleLayer';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import type { RowDimensionManager } from '../dimensions/RowDimensionManager';
import { areSetsEqual, getCellsInRange, getSelectionBounds, calculateFillCells, createCellKey } from './OverlayUtils';

// ====================================
// UNIFIED OVERLAY RENDERER
// ====================================

export interface OverlayRendererConfig {
  dimensionManager: ColumnDimensionManager;
  rowDimensionManager?: RowDimensionManager;
  columns: Column[];
  cellWidth: number;
  cellHeight: number;
  selectionColor: string;
  selectionBorderColor: string;
  editingColor: string;
  editingBorderColor: string;
  borderWidth: number;
  enableAnimations: boolean;
  animationDuration: number;
}

export class OverlayRenderer {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private machine: OverlayMachineActor;
  private config: OverlayRendererConfig;
  
  // Subsystems
  private shapePool: ShapePoolManager;
  private coordinateSystem: CoordinateSystem;
  private viewportOptimizer: ViewportOptimizer;
  private fillHandleLayer: FillHandleLayer;
  
  // Shape references
  private activeSelectionShapes: Map<string, { cell: Konva.Rect; border: Konva.Rect }> = new Map();
  private activeDragPreview: Konva.Rect | null = null;
  private activeEditingShapes: { background: Konva.Rect; border: Konva.Rect } | null = null;
  private activeCopyIndicator: Konva.Rect | null = null;
  
  // Performance tracking
  private renderCount = 0;
  private lastRenderTime = 0;
  private renderThrottleTimer: number | null = null;
  
  // Removed DOM overlay - using existing DOM event system
  
  // State tracking for selective updates
  private previousState: {
    selectedCells: Set<string>;
    editingCell: CellRef | null;
    isDragging: boolean;
    dragCurrentCell: { row: number; column: number } | null;
    isFilling: boolean;
    fillPreviewCells: Set<string>;
    viewport: ViewportInfo | null;
    clipboardState: { copiedCells: Set<string>; isCut: boolean } | null;
  } | null = null;
  
  // Dirty regions for optimized rendering
  private dirtyRegions: Set<'selection' | 'editing' | 'drag' | 'fill' | 'clipboard'> = new Set();
  private pendingRender = false;
  
  constructor(
    stage: Konva.Stage,
    machine: OverlayMachineActor,
    config: OverlayRendererConfig
  ) {
    this.stage = stage;
    this.machine = machine;
    this.config = config;
    
    // Create main layer - disable listening so only fill handle gets hover events
    this.layer = new Konva.Layer({
      name: 'overlay-layer',
      listening: false
    });
    this.stage.add(this.layer);
    
    // Initialize subsystems
    this.coordinateSystem = new CoordinateSystem(
      { cellWidth: config.cellWidth, cellHeight: config.cellHeight } as any,
      config.dimensionManager
    );
    this.coordinateSystem.columns = config.columns;
    
    this.viewportOptimizer = new ViewportOptimizer({
      cellWidth: config.cellWidth,
      cellHeight: config.cellHeight,
      maxSelectableCells: 1000
    } as any);
    
    
    this.shapePool = new ShapePoolManager(this.layer, {
      cellWidth: config.cellWidth,
      cellHeight: config.cellHeight,
      selectionColor: config.selectionColor,
      selectionBorderColor: config.selectionBorderColor,
      editingColor: config.editingColor,
      editingBorderColor: config.editingBorderColor,
      borderWidth: config.borderWidth
    });
    
    // Initialize fill handle layer
    this.fillHandleLayer = new FillHandleLayer(
      this.layer,
      this.machine,
      {
        cellHeight: config.cellHeight,
        dimensionManager: config.dimensionManager,
        selectionBorderColor: config.selectionBorderColor
      },
      this.coordinateSystem,
      this.shapePool
    );
    
    // Subscribe to machine state changes
    this.setupMachineSubscription();
    
    // Event handlers disabled - DOM handles all interactions
    // this.setupEventHandlers();
  }
  
  private setupMachineSubscription(): void {
    // Subscribe to state changes with selective updates
    this.machine.subscribe((snapshot) => {
      const context = snapshot.context;
      
      // Check what actually changed to minimize renders
      const changes = this.detectStateChanges(context);
      
      if (changes.size > 0) {
        // Change detection logging disabled - too verbose during scrolling
        
        // Add changed regions to dirty set
        changes.forEach(change => this.dirtyRegions.add(change));
        
        // Request render with RAF throttling
        this.requestRender();
      }
    });
  }
  
  private detectStateChanges(context: OverlayContext): Set<'selection' | 'editing' | 'drag' | 'fill' | 'clipboard'> {
    const changes = new Set<'selection' | 'editing' | 'drag' | 'fill' | 'clipboard'>();
    
    if (!this.previousState) {
      // First render - everything is dirty
      changes.add('selection');
      changes.add('editing');
      changes.add('drag');
      changes.add('fill');
      changes.add('clipboard');
    } else {
      // Check selection changes
      if (!areSetsEqual(context.selectedCells, this.previousState.selectedCells)) {
        changes.add('selection');
        changes.add('fill'); // Fill handle depends on selection
      }
      
      // Check editing changes
      if (context.editingCell !== this.previousState.editingCell) {
        changes.add('editing');
      }
      
      // Check drag state changes
      const isDragging = context.dragState?.isDragging ?? false;
      const currentDragCell = context.dragState?.currentCell || null;
      
      if (isDragging !== this.previousState.isDragging) {
        changes.add('drag');
      } else if (isDragging && currentDragCell) {
        // Check if drag cell changed
        const prevDragCell = this.previousState.dragCurrentCell;
        if (!prevDragCell || 
            currentDragCell.row !== prevDragCell.row ||
            currentDragCell.column !== prevDragCell.column) {
          changes.add('drag');
        }
      }
      
      // Check fill state changes
      const isFilling = context.fillState?.isActive ?? false;
      if (isFilling !== this.previousState.isFilling) {
        changes.add('fill');
      } else if (isFilling && context.fillState) {
        // Check if preview cells changed
        if (!areSetsEqual(context.fillState.previewCells, this.previousState.fillPreviewCells)) {
          changes.add('fill');
        }
      }
      
      // Check clipboard changes
      const prevClipboard = this.previousState.clipboardState;
      const currClipboard = context.clipboardState;
      
      if ((currClipboard && !prevClipboard) || 
          (!currClipboard && prevClipboard) ||
          (currClipboard && prevClipboard && 
           (currClipboard.isCut !== prevClipboard.isCut ||
            !areSetsEqual(currClipboard.copiedCells, prevClipboard.copiedCells)))) {
        changes.add('clipboard');
      }
      
      // Check viewport changes
      if (context.viewport !== this.previousState.viewport) {
        // Viewport change affects all visible elements
        if (context.selectedCells.size > 0) changes.add('selection');
        if (context.editingCell) changes.add('editing');
        if (isDragging) changes.add('drag');
        if (isFilling) changes.add('fill');
        if (context.clipboardState) changes.add('clipboard');
      }
    }
    
    // Update previous state
    this.previousState = {
      selectedCells: new Set(context.selectedCells),
      editingCell: context.editingCell,
      isDragging: context.dragState?.isDragging ?? false,
      dragCurrentCell: context.dragState?.currentCell ? 
        { row: context.dragState.currentCell.row, column: context.dragState.currentCell.column } : 
        null,
      isFilling: context.fillState?.isActive ?? false,
      fillPreviewCells: context.fillState?.previewCells ? new Set(context.fillState.previewCells) : new Set(),
      viewport: context.viewport,
      clipboardState: context.clipboardState ? {
        copiedCells: new Set(context.clipboardState.copiedCells),
        isCut: context.clipboardState.isCut
      } : null
    };
    
    return changes;
  }
  
  private requestRender(): void {
    if (this.pendingRender) return;
    
    this.pendingRender = true;
    
    // Use requestAnimationFrame for throttling
    if (this.renderThrottleTimer) {
      cancelAnimationFrame(this.renderThrottleTimer);
    }
    
    this.renderThrottleTimer = requestAnimationFrame(() => {
      this.pendingRender = false;
      this.renderThrottleTimer = null;
      
      // Render only dirty regions
      this.renderDirtyRegions();
      
      // Clear dirty regions after render
      this.dirtyRegions.clear();
    });
  }
  
  private setupEventHandlers(): void {
    let mouseDownPos: { x: number; y: number } | null = null;
    let mouseDownCell: { row: number; column: number } | null = null;
    const DRAG_THRESHOLD = 5; // pixels
    
    // Mouse down - store start position and immediately show selection
    this.stage.on('mousedown', (e) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      const viewport = this.machine.getSnapshot().context.viewport;
      if (!viewport) return;
      
      // Since we're not transforming the layer, mouse position needs scroll adjustment
      // to get the absolute position in the document
      const adjustedY = pos.y + (viewport.scrollTop || 0);
      
      console.log('OverlayRenderer.mousedown: Position adjustment', {
        mouseY: pos.y,
        scrollTop: viewport.scrollTop,
        adjustedY
      });
      
      const cellPos = this.coordinateSystem.viewportToCell(pos.x, adjustedY, viewport);
      if (!cellPos) {
        console.warn('OverlayRenderer.mousedown: No cell found at position');
        return;
      }
      
      // Store start position for potential drag
      mouseDownPos = pos;
      mouseDownCell = { row: cellPos.row, column: cellPos.column };
      
      // Immediately show selection for instant feedback
      const { rowId, columnId } = this.coordinateSystem.cellIndicesToIds(cellPos.row, cellPos.column);
      if (rowId && columnId) {
        const cellKey = `${rowId}:${columnId}`;
        
        // Handle shift-click with range selection
        if (e.evt.shiftKey) {
          const context = this.machine.getSnapshot().context;
          if (context.anchorCell) {
            // Calculate full range selection
            console.log('OverlayRenderer: Shift-click range selection', {
              anchor: context.anchorCell,
              clicked: { row: cellPos.row, column: cellPos.column },
              cellKey
            });
            
            const rangeCells = getCellsInRange(
              context.anchorCell.row,
              context.anchorCell.column,
              cellPos.row,
              cellPos.column,
              (row, col) => {
                const ids = this.coordinateSystem.cellIndicesToIds(row, col);
                const key = ids.rowId && ids.columnId ? createCellKey(ids.rowId, ids.columnId) : null;
                if (key) {
                  console.log('OverlayRenderer: Generated cell key', { row, col, key, ids });
                }
                return key;
              }
            );
            
            console.log('OverlayRenderer: Range cells generated', {
              count: rangeCells.size,
              cells: Array.from(rangeCells)
            });
            
            this.machine.send({
              type: 'RANGE_SELECT',
              cells: rangeCells,
              anchorKey: context.anchorCell.key,
              anchorRow: context.anchorCell.row,
              anchorColumn: context.anchorCell.column
            });
            return;
          }
        }
        
        // Normal click or ctrl-click
        this.machine.send({
          type: 'CELL_CLICK',
          cellKey,
          ctrlKey: e.evt.ctrlKey,
          shiftKey: e.evt.shiftKey,
          row: cellPos.row,
          column: cellPos.column
        });
      }
    });
    
    // Mouse move - check if we should start dragging
    this.stage.on('mousemove', () => {
      const context = this.machine.getSnapshot().context;
      const pos = this.stage.getPointerPosition();
      if (!pos || !context.viewport) return;
      
      if (context.dragState?.isDragging) {
        // Already dragging - update drag state
        // Since we're not transforming the layer, adjust Y for scroll
        const adjustedY = pos.y + (context.viewport.scrollTop || 0);
        const cellPos = this.coordinateSystem.viewportToCell(pos.x, adjustedY, context.viewport);
        if (!cellPos) return;
        
        this.machine.send({
          type: 'DRAG_MOVE',
          currentPos: pos,
          currentCell: { row: cellPos.row, column: cellPos.column }
        });
      } else if (mouseDownPos && mouseDownCell) {
        // Check if mouse moved enough to start drag
        const deltaX = Math.abs(pos.x - mouseDownPos.x);
        const deltaY = Math.abs(pos.y - mouseDownPos.y);
        
        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
          // Start drag
          this.machine.send({
            type: 'DRAG_START',
            startPos: mouseDownPos,
            startCell: mouseDownCell
          });
        }
      }
    });
    
    // Mouse up - complete drag or just clean up
    this.stage.on('mouseup', (e) => {
      const context = this.machine.getSnapshot().context;
      
      if (context.dragState?.isDragging) {
        // Complete drag selection
        const cells = this.calculateDragSelection(context);
        
        this.machine.send({
          type: 'DRAG_END',
          cells
        });
      }
      // No need to send CELL_CLICK here since we already sent it on mousedown
      
      // Reset mouse tracking
      mouseDownPos = null;
      mouseDownCell = null;
    });
    
    // Mouse leave - cancel drag
    this.stage.on('mouseleave', () => {
      const context = this.machine.getSnapshot().context;
      if (context.dragState?.isDragging) {
        this.machine.send({ type: 'DRAG_CANCEL' });
      }
      
      // Reset mouse tracking
      mouseDownPos = null;
      mouseDownCell = null;
    });
  }
  
  private renderDirtyRegions(): void {
    const startTime = performance.now();
    const context = this.machine.getSnapshot().context;
    
    console.log('OverlayRenderer.renderDirtyRegions:', {
      dirtyRegions: Array.from(this.dirtyRegions),
      hasViewport: !!context.viewport,
      selectedCells: context.selectedCells.size
    });
    
    // Only render if we have a viewport
    if (!context.viewport) {
      console.log('OverlayRenderer: No viewport, skipping render');
      return;
    }
    
    // Clear shapes for dirty regions only
    this.clearDirtyShapes();
    
    // Render only what changed
    if (this.dirtyRegions.has('selection')) {
      if (context.shapesVisible.selection && context.selectedCells.size > 0) {
        console.log('OverlayRenderer: Rendering selection for', context.selectedCells.size, 'cells');
        this.renderSelection(context.selectedCells, context.viewport);
      } else {
        this.clearSelectionShapes();
      }
    }
    
    if (this.dirtyRegions.has('editing')) {
      if (context.shapesVisible.editing && context.editingCell) {
        this.renderEditing(context.editingCell, context.viewport);
      } else {
        this.clearEditingShapes();
      }
    }
    
    if (this.dirtyRegions.has('drag')) {
      console.log('OverlayRenderer: Processing drag dirty region', {
        dragPreviewVisible: context.shapesVisible.dragPreview,
        isDragging: context.dragState?.isDragging,
        startCell: context.dragState?.startCell,
        currentCell: context.dragState?.currentCell
      });
      
      if (context.shapesVisible.dragPreview && context.dragState?.isDragging && 
          context.dragState.startCell && context.dragState.currentCell) {
        this.renderDragPreview(context.dragState, context.viewport);
      } else {
        this.clearDragPreview();
      }
    }
    
    // Always check fill handle visibility when selection changes
    if (this.dirtyRegions.has('fill') || this.dirtyRegions.has('selection')) {
      // Fill handle
      if (context.shapesVisible.fillHandle && context.selectedCells.size > 0) {
        console.log('OverlayRenderer: Rendering fill handle');
        this.renderFillHandle(context.selectionBounds);
      } else {
        // Always hide fill handle when conditions aren't met
        console.log('OverlayRenderer: Hiding fill handle (no selection or visibility off)');
        this.fillHandleLayer.hideFillHandle();
      }
      
      // Fill preview
      if (context.shapesVisible.fillPreview && context.fillState?.previewCells.size) {
        console.log('OverlayRenderer: Rendering fill preview');
        this.renderFillPreview(context.fillState.previewCells, context.viewport);
      } else {
        this.clearFillPreview();
      }
    }
    
    if (this.dirtyRegions.has('clipboard')) {
      if (context.shapesVisible.copyIndicator && context.clipboardState) {
        this.renderCopyIndicator(context.clipboardState, context.selectionBounds);
      } else {
        this.clearCopyIndicator();
      }
    }
    
    // Batch draw only if we had dirty regions
    if (this.dirtyRegions.size > 0) {
      this.layer.batchDraw();
    }
    
    this.lastRenderTime = performance.now() - startTime;
    this.renderCount++;
    
    console.log('OverlayRenderer: Render complete', {
      duration: this.lastRenderTime,
      dirtyRegions: this.dirtyRegions.size
    });
  }
  
  private clearDirtyShapes(): void {
    // Clear only shapes for dirty regions
    if (this.dirtyRegions.has('selection')) {
      this.clearSelectionShapes();
    }
    if (this.dirtyRegions.has('editing')) {
      this.clearEditingShapes();
    }
    if (this.dirtyRegions.has('drag')) {
      this.clearDragPreview();
    }
    if (this.dirtyRegions.has('fill')) {
      this.clearFillPreview();
    }
    if (this.dirtyRegions.has('clipboard')) {
      this.clearCopyIndicator();
    }
  }
  
  private clearSelectionShapes(): void {
    if (this.activeSelectionShapes.size > 0) {
      const cellShapes = Array.from(this.activeSelectionShapes.values()).map(s => s.cell);
      const borderShapes = Array.from(this.activeSelectionShapes.values()).map(s => s.border);
      
      this.shapePool.release('selection', cellShapes);
      this.shapePool.release('border', borderShapes);
      this.activeSelectionShapes.clear();
    }
  }
  
  private clearEditingShapes(): void {
    if (this.activeEditingShapes) {
      this.shapePool.release('editing', [this.activeEditingShapes.background]);
      this.shapePool.release('border', [this.activeEditingShapes.border]);
      this.activeEditingShapes = null;
    }
  }
  
  private clearDragPreview(): void {
    if (this.activeDragPreview) {
      this.shapePool.release('preview', [this.activeDragPreview]);
      this.activeDragPreview = null;
    }
  }
  
  private clearCopyIndicator(): void {
    if (this.activeCopyIndicator) {
      const anim = (this.activeCopyIndicator as any)._dashAnimation;
      if (anim) {
        anim.stop();
        delete (this.activeCopyIndicator as any)._dashAnimation;
      }
      this.shapePool.release('indicator', [this.activeCopyIndicator]);
      this.activeCopyIndicator = null;
    }
  }
  
  private renderSelection(selectedCells: Set<string>, viewport: ViewportInfo): void {
    console.log('OverlayRenderer.renderSelection: Debug info:', {
      selectedCells: Array.from(selectedCells),
      viewport: { start: viewport.start, end: viewport.end, height: viewport.height }
    });
    
    // Get visible cells
    const visibleCells = this.viewportOptimizer.getVisibleCellKeys(
      selectedCells,
      viewport,
      (cellKey) => {
        const parsed = this.coordinateSystem.parseCellKey(cellKey);
        if (!parsed) return null;
        const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
        console.log('OverlayRenderer.renderSelection: Cell position lookup:', {
          cellKey,
          rowId: parsed.rowId,
          columnId: parsed.columnId,
          position
        });
        return position ? { row: position.row, column: position.column } : null;
      }
    );
    
    console.log('OverlayRenderer.renderSelection: Visible cells after optimization:', Array.from(visibleCells));
    
    // Acquire shapes
    const cellShapes = this.shapePool.acquire<Konva.Rect>('selection', visibleCells.size);
    const borderShapes = this.shapePool.acquire<Konva.Rect>('border', visibleCells.size);
    
    // Render visible cells
    let index = 0;
    for (const cellKey of visibleCells) {
      if (index >= cellShapes.length) break;
      
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) continue;
      
      const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, viewport);
      
      // Debug position calculation - let's check if viewport.scrollTop matches actual DOM scroll
      const viewportElement = document.querySelector('.vibegridx-viewport') as HTMLElement;
      const actualScrollTop = viewportElement?.scrollTop || 0;
      
      console.log('OverlayRenderer.renderSelection: Position calculation DEBUG', {
        cellKey,
        viewport: { 
          scrollTop: viewport.scrollTop, 
          height: viewport.height,
          start: viewport.start,
          end: viewport.end
        },
        actualDOMScroll: actualScrollTop,
        scrollMismatch: Math.abs((viewport.scrollTop || 0) - actualScrollTop) > 5,
        position,
        rowCalculation: {
          parsedRowId: parsed.rowId,
          rowIndex: position?.row,
          expectedY: position?.row ? position.row * this.config.cellHeight : 'N/A',
          expectedYWithScroll: position?.row ? (position.row * this.config.cellHeight - actualScrollTop) : 'N/A'
        },
        boundsCheck: {
          minY: -this.config.cellHeight * 2,
          maxY: viewport.height + this.config.cellHeight * 2,
          passes: position && position.y >= -this.config.cellHeight * 2 && position.y <= viewport.height + this.config.cellHeight * 2
        }
      });
      
      if (position && position.y >= -this.config.cellHeight * 2 && 
          position.y <= viewport.height + this.config.cellHeight * 2) {
        const columnWidth = this.config.dimensionManager.getColumnWidth(parsed.columnId);
        
        console.log('OverlayRenderer.renderSelection: CONFIGURING SHAPES', {
          cellKey,
          position: { x: position.x, y: position.y },
          dimensions: { width: columnWidth, height: this.config.cellHeight },
          shapeInfo: {
            cellShape: { 
              id: cellShapes[index].id(),
              visible: cellShapes[index].visible(),
              listening: cellShapes[index].listening(),
              parent: cellShapes[index].getParent()?.name() || 'none'
            },
            borderShape: {
              id: borderShapes[index].id(), 
              visible: borderShapes[index].visible(),
              listening: borderShapes[index].listening(),
              parent: borderShapes[index].getParent()?.name() || 'none'
            }
          }
        });
        
        // Configure shapes
        this.shapePool.configureForCell(
          cellShapes[index],
          position.x,
          position.y,
          columnWidth,
          this.config.cellHeight
        );
        
        this.shapePool.configureForCell(
          borderShapes[index],
          position.x,
          position.y,
          columnWidth - 1,
          this.config.cellHeight - 1
        );
        
        console.log('OverlayRenderer.renderSelection: SHAPES CONFIGURED', {
          cellKey,
          cellShape: {
            x: cellShapes[index].x(),
            y: cellShapes[index].y(),
            width: cellShapes[index].width(),
            height: cellShapes[index].height(),
            visible: cellShapes[index].visible(),
            opacity: cellShapes[index].opacity(),
            fill: cellShapes[index].fill()
          },
          borderShape: {
            x: borderShapes[index].x(),
            y: borderShapes[index].y(),
            width: borderShapes[index].width(),
            height: borderShapes[index].height(),
            visible: borderShapes[index].visible(),
            opacity: borderShapes[index].opacity(),
            stroke: borderShapes[index].stroke()
          }
        });
        
        // Track active shapes
        this.activeSelectionShapes.set(cellKey, {
          cell: cellShapes[index],
          border: borderShapes[index]
        });
        
        index++;
      } else {
        console.log('OverlayRenderer.renderSelection: POSITION OUT OF BOUNDS', {
          cellKey,
          position,
          viewport: { height: viewport.height },
          bounds: {
            minY: -this.config.cellHeight * 2,
            maxY: viewport.height + this.config.cellHeight * 2
          },
          boundsCheck: position ? {
            yTooLow: position.y < -this.config.cellHeight * 2,
            yTooHigh: position.y > viewport.height + this.config.cellHeight * 2
          } : 'no position'
        });
      }
    }
    
    console.log('OverlayRenderer.renderSelection: RENDER COMPLETE', {
      totalCells: selectedCells.size,
      visibleCells: visibleCells.size,
      shapesConfigured: index,
      activeShapes: this.activeSelectionShapes.size,
      layerInfo: {
        layerName: this.layer.name(),
        layerVisible: this.layer.visible(),
        layerOpacity: this.layer.opacity(),
        children: this.layer.children.length,
        stage: this.stage.name()
      },
      canvasDebug: {
        stageSize: { width: this.stage.width(), height: this.stage.height() },
        stagePosition: { x: this.stage.x(), y: this.stage.y() },
        layerTransform: { 
          x: this.layer.x(), 
          y: this.layer.y(), 
          scaleX: this.layer.scaleX(), 
          scaleY: this.layer.scaleY() 
        },
        containerElement: {
          exists: !!this.stage.container(),
          position: this.stage.container()?.style.position || 'none',
          top: this.stage.container()?.style.top || 'none',
          left: this.stage.container()?.style.left || 'none',
          pointerEvents: this.stage.container()?.style.pointerEvents || 'none'
        }
      }
    });
    
    // Canvas positioning is now working correctly
    
    // Force layer redraw
    this.layer.batchDraw();
  }
  
  private renderEditing(editingCell: any, viewport: ViewportInfo): void {
    const position = this.coordinateSystem.getCellPositionByIds(
      editingCell.rowId,
      editingCell.columnId,
      viewport
    );
    
    if (!position) return;
    
    const [backgroundShape] = this.shapePool.acquire<Konva.Rect>('editing', 1);
    const [borderShape] = this.shapePool.acquire<Konva.Rect>('border', 1);
    
    const columnWidth = this.config.dimensionManager.getColumnWidth(editingCell.columnId);
    
    this.shapePool.configureForCell(
      backgroundShape,
      position.x,
      position.y,
      columnWidth,
      this.config.cellHeight
    );
    
    borderShape.stroke(this.config.editingBorderColor);
    borderShape.strokeWidth(this.config.borderWidth + 1);
    
    this.shapePool.configureForCell(
      borderShape,
      position.x,
      position.y,
      columnWidth - 1,
      this.config.cellHeight - 1
    );
    
    this.activeEditingShapes = { background: backgroundShape, border: borderShape };
  }
  
  private renderDragPreview(dragState: any, viewport: ViewportInfo): void {
    // Validate drag state structure - fix property names
    if (!dragState.startCell || !dragState.currentCell) {
      console.warn('OverlayRenderer: Invalid drag state for preview:', dragState);
      return;
    }
    
    // Use correct property names - should be .row and .column, not .x and .y
    const minRow = Math.min(dragState.startCell.row, dragState.currentCell.row);
    const maxRow = Math.max(dragState.startCell.row, dragState.currentCell.row);
    const minCol = Math.min(dragState.startCell.column, dragState.currentCell.column);
    const maxCol = Math.max(dragState.startCell.column, dragState.currentCell.column);
    
    const topLeft = this.coordinateSystem.cellToViewport(minRow, minCol, viewport);
    if (!topLeft || isNaN(topLeft.x) || isNaN(topLeft.y)) {
      console.warn('OverlayRenderer: Invalid coordinates for drag preview:', { minRow, minCol, topLeft });
      return;
    }
    
    const width = this.calculateColumnsWidth(minCol, maxCol);
    const height = (maxRow - minRow + 1) * this.config.cellHeight;
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      console.warn('OverlayRenderer: Invalid dimensions for drag preview:', { width, height });
      return;
    }
    
    const [preview] = this.shapePool.acquire<Konva.Rect>('preview', 1);
    this.shapePool.configureForCell(preview, topLeft.x, topLeft.y, width, height);
    
    this.activeDragPreview = preview;
  }
  
  private renderFillHandle(selectionBounds: any): void {
    const context = this.machine.getSnapshot().context;
    
    if (!context.selectedCells.size || !context.viewport) {
      this.fillHandleLayer.hideFillHandle();
      return;
    }
    
    // Delegate to FillHandleLayer
    this.fillHandleLayer.renderFillHandle(context.selectedCells, context.viewport);
  }
  
  private renderFillPreview(previewCells: Set<string>, viewport: ViewportInfo): void {
    // Delegate to FillHandleLayer
    this.fillHandleLayer.renderFillPreview(previewCells, viewport);
  }
  
  private renderCopyIndicator(clipboardState: any, selectionBounds: any): void {
    if (!clipboardState || !clipboardState.copiedCells || clipboardState.copiedCells.size === 0) return;
    
    const context = this.machine.getSnapshot().context;
    if (!context.viewport) return;
    
    // Calculate bounds from the copied cells
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cellKey of clipboardState.copiedCells) {
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) continue;
      
      const position = this.coordinateSystem.getCellPositionByIds(parsed.rowId, parsed.columnId, context.viewport);
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
    
    // Only render if we have valid bounds
    if (minX === Infinity) return;
    
    const [indicator] = this.shapePool.acquire<Konva.Rect>('indicator', 1);
    
    indicator.position({
      x: minX,
      y: minY
    });
    
    indicator.size({
      width: maxX - minX,
      height: maxY - minY
    });
    
    indicator.stroke(clipboardState.isCut ? '#ef4444' : '#6366f1');
    indicator.strokeWidth(2);
    indicator.dash([5, 5]);
    indicator.fill('transparent');
    indicator.visible(true);
    
    // Animate dash offset
    const anim = new Konva.Animation((frame) => {
      if (frame) {
        indicator.dashOffset(-frame.time / 50);
      }
    }, this.layer);
    
    anim.start();
    (indicator as any)._dashAnimation = anim;
    
    this.activeCopyIndicator = indicator;
  }
  
  private clearAllShapes(): void {
    // Release selection shapes
    if (this.activeSelectionShapes.size > 0) {
      const cellShapes = Array.from(this.activeSelectionShapes.values()).map(s => s.cell);
      const borderShapes = Array.from(this.activeSelectionShapes.values()).map(s => s.border);
      
      this.shapePool.release('selection', cellShapes);
      this.shapePool.release('border', borderShapes);
      this.activeSelectionShapes.clear();
    }
    
    // Release drag preview
    if (this.activeDragPreview) {
      this.shapePool.release('preview', [this.activeDragPreview]);
      this.activeDragPreview = null;
    }
    
    // Release editing shapes
    if (this.activeEditingShapes) {
      this.shapePool.release('editing', [this.activeEditingShapes.background]);
      this.shapePool.release('border', [this.activeEditingShapes.border]);
      this.activeEditingShapes = null;
    }
    
    // Clean up fill handle layer
    this.fillHandleLayer.hideFillHandle();
    this.fillHandleLayer.clearFillPreview();
    
    // Release copy indicator
    if (this.activeCopyIndicator) {
      const anim = (this.activeCopyIndicator as any)._dashAnimation;
      if (anim) {
        anim.stop();
        delete (this.activeCopyIndicator as any)._dashAnimation;
      }
      this.shapePool.release('indicator', [this.activeCopyIndicator]);
      this.activeCopyIndicator = null;
    }
  }
  
  private calculateDragSelection(context: OverlayContext): Set<string> {
    if (!context.dragState || !context.viewport) return new Set();
    
    const { startCell, currentCell } = context.dragState;
    if (!startCell || !currentCell) return new Set();
    
    console.log('OverlayRenderer.calculateDragSelection:', {
      startCell,
      currentCell
    });
    
    // Use utility to get all cells in range
    const selection = getCellsInRange(
      startCell.row,
      startCell.column,
      currentCell.row,
      currentCell.column,
      (row, col) => {
        const { rowId, columnId } = this.coordinateSystem.cellIndicesToIds(row, col);
        return rowId && columnId ? createCellKey(rowId, columnId) : null;
      }
    );
    
    console.log('OverlayRenderer.calculateDragSelection result:', Array.from(selection));
    return selection;
  }
  
  private calculateColumnsWidth(startCol: number, endCol: number): number {
    let totalWidth = 0;
    
    if (this.config.columns.length > 0) {
      for (let colIndex = startCol; colIndex <= endCol && colIndex < this.config.columns.length; colIndex++) {
        const column = this.config.columns[colIndex];
        if (column) {
          totalWidth += this.config.dimensionManager.getColumnWidth(column.id);
        }
      }
    } else {
      totalWidth = (endCol - startCol + 1) * this.config.cellWidth;
    }
    
    return totalWidth;
  }
  
  private calculateFillPreviewCells(
    dragPos: { x: number; y: number },
    selectedCells: Set<string>,
    viewport: ViewportInfo
  ): Set<string> {
    if (selectedCells.size === 0) return new Set();
    
    // Get the cell position at drag location
    // Adjust Y for scroll since we're not transforming the layer
    const adjustedY = dragPos.y + (viewport.scrollTop || 0);
    const dragCell = this.coordinateSystem.viewportToCell(dragPos.x, adjustedY, viewport);
    if (!dragCell) return new Set();
    
    // Get bounds of current selection
    const bounds = getSelectionBounds(selectedCells, (cellKey) => {
      const parsed = this.coordinateSystem.parseCellKey(cellKey);
      if (!parsed) return null;
      
      // Try to parse IDs as numbers for bounds calculation
      const rowNum = parseInt(parsed.rowId, 10);
      const colNum = parseInt(parsed.columnId, 10);
      
      if (isNaN(rowNum) || isNaN(colNum)) return null;
      
      return { row: rowNum, column: colNum };
    });
    
    if (!bounds) return new Set();
    
    // Calculate fill cells using utility
    return calculateFillCells(
      bounds,
      dragCell.row,
      dragCell.column,
      (row, col) => {
        const { rowId, columnId } = this.coordinateSystem.cellIndicesToIds(row, col);
        return rowId && columnId ? createCellKey(rowId, columnId) : null;
      }
    );
  }
  
  private clearFillPreview(): void {
    // Delegate to FillHandleLayer
    this.fillHandleLayer.clearFillPreview();
  }
  
  // Public API
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    this.coordinateSystem.updateMappings(rowIds, columnIds);
  }
  
  updateViewport(viewport: ViewportInfo): void {
    // Viewport update logging disabled - too verbose
    this.machine.send({ type: 'VIEWPORT_UPDATE', viewport });
  }
  
  updateSelection(selectedCells: Set<string>): void {
    console.log('OverlayRenderer.updateSelection:', selectedCells.size, 'cells');
    console.log('OverlayRenderer.updateSelection: Current machine context before update:', {
      selectedCells: this.machine.getSnapshot().context.selectedCells.size,
      viewport: this.machine.getSnapshot().context.viewport
    });
    this.machine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }
  
  // New method to update selection with DOM positions
  updateSelectionWithPositions(cellPositions: Map<string, { x: number; y: number; width: number; height: number }>): void {
    // Selection position update logging disabled - too verbose
    
    // Clear existing selection shapes
    this.shapePool.releaseAll('selection');
    this.shapePool.releaseAll('border');
    this.activeSelectionShapes.clear();
    
    // Get viewport bounds for filtering
    const viewportWidth = this.stage.width();
    const viewportHeight = this.stage.height();
    
    // Filter out cells that are completely outside viewport
    const visibleCells = new Map<string, { x: number; y: number; width: number; height: number }>();
    cellPositions.forEach((pos, cellKey) => {
      // Check if cell is at least partially visible
      if (pos.x < viewportWidth && pos.x + pos.width > 0 &&
          pos.y < viewportHeight && pos.y + pos.height > 0) {
        visibleCells.set(cellKey, pos);
      }
    });
    
    // Get shapes only for visible cells
    const cellShapes = this.shapePool.acquire<Konva.Rect>('selection', visibleCells.size);
    const borderShapes = this.shapePool.acquire<Konva.Rect>('border', visibleCells.size);
    
    // Render each visible cell using DOM positions
    let index = 0;
    visibleCells.forEach((pos, cellKey) => {
      if (index >= cellShapes.length) return;
      
      // Configure shapes with DOM positions
      const cellShape = cellShapes[index];
      const borderShape = borderShapes[index];
      
      cellShape.setAttrs({
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        fill: this.config.selectionColor,
        stroke: 'transparent',
        strokeWidth: 0
      });
      cellShape.visible(true);
      
      borderShape.setAttrs({
        x: pos.x,
        y: pos.y,
        width: pos.width - 1,
        height: pos.height - 1,
        fill: 'transparent',
        stroke: this.config.selectionBorderColor,
        strokeWidth: this.config.borderWidth
      });
      borderShape.visible(true);
      
      // Track active shapes
      this.activeSelectionShapes.set(cellKey, {
        cell: cellShape,
        border: borderShape
      });
      
      index++;
    });
    
    // Update layer
    this.layer.batchDraw();
  }
  
  updateEditingCell(cell: any): void {
    if (cell) {
      this.machine.send({ type: 'EDIT_START', cell });
    } else {
      this.machine.send({ type: 'EDIT_END' });
    }
  }
  
  handleCopy(cells: Set<string>): void {
    this.machine.send({ type: 'COPY', cells });
  }
  
  handleCut(cells: Set<string>): void {
    this.machine.send({ type: 'CUT', cells });
  }
  
  handlePaste(): void {
    this.machine.send({ type: 'PASTE' });
  }
  
  forceRedraw(): void {
    // Mark all regions as dirty to force a complete redraw
    this.dirtyRegions.add('selection');
    this.dirtyRegions.add('editing');
    this.dirtyRegions.add('drag');
    this.dirtyRegions.add('fill');
    this.dirtyRegions.add('clipboard');
    
    // Request immediate render
    this.requestRender();
  }
  
  getPerformanceMetrics() {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      shapePoolStats: this.shapePool.getStats(),
      viewportCacheStats: this.viewportOptimizer.getMetrics()
    };
  }
  
  // Cancel any active fill operation
  cancelFill(): void {
    console.log('OverlayRenderer.cancelFill: Canceling active fill operation');
    this.machine.send({ type: 'FILL_CANCEL' });
  }
  
  destroy(): void {
    if (this.renderThrottleTimer) {
      cancelAnimationFrame(this.renderThrottleTimer);
    }
    
    // Clean up fill handle layer
    this.fillHandleLayer.destroy();
    
    this.clearAllShapes();
    this.shapePool.destroy();
    this.layer.destroy();
  }
  
}