import Konva from 'konva';
import { createActor } from 'xstate';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { DEFAULT_CONFIG } from './OverlayTypes';
import { overlayMachine, type OverlayMachineActor } from '../machines/overlay-machine';
// ActorRef import removed - no longer needed
import type { VibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
import type { CoordinateProvider } from './CoordinateProvider';
import { FillHandleLayer } from './FillHandleLayer';
import { SelectionOverlay } from './SelectionOverlay';
import { ClipboardOverlay } from './ClipboardOverlay';
import { DragPreviewOverlay } from './DragPreviewOverlay';
import { ColumnDragOverlay } from './ColumnDragOverlay';
import { ColumnResizeOverlay } from './ColumnResizeOverlay';
import { SelectionColumnOverlay } from './SelectionColumnOverlay';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import type { RowDimensionManager } from '../dimensions/RowDimensionManager';
import type { ColumnDragState, ColumnResizeState } from '../types';

// ====================================
// SIMPLIFIED CANVAS OVERLAY
// ====================================

export class CanvasOverlay implements CoordinateProvider {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private config: OverlayConfig;
  
  // XState machine
  private machine: OverlayMachineActor;
  
  // Direct reference to coordinate manager
  private coordinateManager: VibeGridXCoordinateManager | null = null;
  
  // Feature overlays
  private fillHandleLayer: FillHandleLayer;
  private selectionOverlay: SelectionOverlay;
  private clipboardOverlay: ClipboardOverlay;
  private dragPreviewOverlay: DragPreviewOverlay;
  private columnDragOverlay: ColumnDragOverlay;
  private columnResizeOverlay: ColumnResizeOverlay;
  private selectionColumnOverlay: SelectionColumnOverlay | null = null;
  
  // Callbacks
  public onSelectionChange?: (selectedCells: Set<string>) => void;
  public onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize Konva stage
    this.initializeStage();
    
    // Create main layer - moved after stage initialization
    
    // Coordinate manager from config or will be set via setCoordinateManager method
    this.coordinateManager = this.config.coordinateManager || null;
    
    // Initialize feature overlays - they will get coordinate manager access via getter
    this.fillHandleLayer = new FillHandleLayer(
      this.stage,
      this, // Pass canvas overlay reference instead of coordinate system
      {
        cellHeight: this.config.cellHeight,
        dimensionManager: this.config.dimensionManager as ColumnDimensionManager,
        selectionBorderColor: this.config.selectionBorderColor
      }
    );
    
    this.selectionOverlay = new SelectionOverlay(
      this.layer,
      this, // Pass self as coordinate provider
      {
        selectionColor: this.config.selectionColor,
        selectionBorderColor: this.config.selectionBorderColor,
        borderWidth: this.config.borderWidth,
        cellHeight: this.config.cellHeight,
        dimensionManager: this.config.dimensionManager as ColumnDimensionManager
      }
    );
    
    this.clipboardOverlay = new ClipboardOverlay(
      this.layer,
      this, // Pass self as coordinate provider
      {
        cellHeight: this.config.cellHeight,
        dimensionManager: this.config.dimensionManager as ColumnDimensionManager
      }
    );
    
    this.dragPreviewOverlay = new DragPreviewOverlay(
      this.layer,
      {
        selectionColor: this.config.selectionColor,
        selectionBorderColor: this.config.selectionBorderColor,
        cellWidth: this.config.cellWidth,
        cellHeight: this.config.cellHeight
      }
    );
    
    this.columnDragOverlay = new ColumnDragOverlay(
      this.layer,
      this.config.dimensionManager as ColumnDimensionManager,
      {
        cellHeight: this.config.cellHeight,
        headerHeight: 40 // Standard header height
      }
    );
    
    this.columnResizeOverlay = new ColumnResizeOverlay(
      this.layer,
      this.config.dimensionManager as ColumnDimensionManager,
      {
        cellHeight: this.config.cellHeight,
        headerHeight: 40 // Standard header height
      }
    );
    
    // Initialize selection column overlay if enabled
    // DISABLED: DOM handles checkbox rendering, we don't need canvas overlay for selection column
    // The regular SelectionOverlay handles visual feedback for selected cells
    if (false && this.config.enableSelectionColumn) {
      this.selectionColumnOverlay = new SelectionColumnOverlay(
        this.layer,
        {
          cellHeight: this.config.cellHeight,
          headerHeight: 40
        },
        (event) => {
          // Dispatch events to the parent through window for now
          // TODO: Replace with proper event system
          (window as any).vibegridxDispatch?.(event);
        }
      );
    }
    
    // Always use the provided overlay actor (single source of truth)
    this.machine = this.config.overlayActor;
    console.log('CanvasOverlay: Using provided overlay actor from table machine');
    
    // Set machine reference in fill handle layer
    this.fillHandleLayer.setMachine(this.machine);
    
    // Subscribe to machine state changes
    this.setupMachineSubscription();
    
    // Set up machine event listeners
    this.setupMachineListeners();
    
    // Send initial viewport to machine if available
    const viewportElement = this.container.closest('.vibegridx-viewport');
    if (viewportElement) {
      const initialViewport: ViewportInfo = {
        start: 0,
        end: Math.ceil(viewportElement.clientHeight / this.config.cellHeight),
        height: viewportElement.clientHeight,
        width: viewportElement.clientWidth,
        scrollTop: 0,
        itemHeight: this.config.cellHeight
      };
      
      console.log('CanvasOverlay: Sending initial viewport', initialViewport);
      this.machine.send({ type: 'VIEWPORT_UPDATE', viewport: initialViewport });
      this.columnResizeOverlay.updateViewport(initialViewport);
    }
  }
  
  private initializeStage(): void {
    const viewportElement = this.container.closest('.vibegridx-viewport');
    // Use the container's own dimensions which should be 100% of parent
    const width = this.container.offsetWidth || viewportElement?.clientWidth || 800;
    const height = this.container.offsetHeight || viewportElement?.clientHeight || 600;
    
    // Ensure container doesn't extend scrollable area
    this.container.style.overflow = 'hidden';
    // Don't override the width/height since they're set to 100% in the renderer
    
    // Stage initialization with viewport dimensions
    
    // Ensure container has an ID for Konva
    if (!this.container.id) {
      this.container.id = 'vibegridx-canvas-' + Math.random().toString(36).substr(2, 9);
    }
    
    this.stage = new Konva.Stage({
      container: this.container.id,
      width,
      height,
      listening: true
    });
    
    // Stage created successfully
    
    // Check if Konva actually created the canvas
    // No longer need canvas checks - stage initialization is reliable
    
    // Create and add the main layer NOW, after stage is created
    this.layer = new Konva.Layer({ name: 'main-layer' });
    this.stage.add(this.layer);
    
    // Enable pointer events for interactive overlays
    this.stage.content.style.pointerEvents = 'auto';
    this.container.style.pointerEvents = 'none';
    
    // Force a draw to ensure canvas is properly initialized
    this.layer.draw();
  }
  
  private setupMachineSubscription(): void {
    // Subscribe to machine state and update all overlays
    // XState doesn't provide selective subscriptions, so we update everything
    this.machine.subscribe((snapshot) => {
      const context = snapshot.context;
      
      // Only log if there are actually selections or operations to render
      if (context.selectedCells.size > 0 || 
          context.shapesVisible.fillHandle || 
          context.shapesVisible.fillPreview || 
          context.shapesVisible.copyIndicator || 
          context.shapesVisible.dragPreview) {
        console.log('CanvasOverlay: Machine state changed', {
          selectedCells: context.selectedCells.size,
          viewport: context.viewport ? 'exists' : 'null'
        });
      }
      
      // Always update all overlays - let each overlay decide if it needs to re-render
      this.updateAllOverlays(context);
    });
  }
  
  private updateAllOverlays(context: any): void {
    // Skip all overlay updates during initialization if there are no selections and no active operations
    if (context.selectedCells.size === 0 && 
        !context.shapesVisible.fillHandle && 
        !context.shapesVisible.fillPreview && 
        !context.shapesVisible.copyIndicator && 
        !context.shapesVisible.dragPreview) {
      // Skip logging too during init
      return;
    }
    
    // Log viewport state for debugging only when there are selections
    if (!context.viewport && context.selectedCells.size > 0) {
      console.warn('CanvasOverlay: Trying to render selection but viewport is null', {
        selectedCells: context.selectedCells.size,
        viewport: context.viewport
      });
    }
    
    // Update selection only if there are selected cells
    if (context.selectedCells.size > 0) {
      this.selectionOverlay.updateSelection(context.selectedCells, context.viewport);
    }
    
    // Update fill handle
    if (context.shapesVisible.fillHandle && context.selectedCells.size > 0 && context.viewport) {
      this.fillHandleLayer.renderFillHandle(context.selectedCells, context.viewport);
    } else {
      this.fillHandleLayer.hideFillHandle();
    }
    
    // Update fill preview
    if (context.shapesVisible.fillPreview && context.fillState?.previewCells.size) {
      this.fillHandleLayer.renderFillPreview(context.fillState.previewCells, context.viewport!);
    } else {
      this.fillHandleLayer.clearFillPreview();
    }
    
    // Update clipboard indicator
    this.clipboardOverlay.updateIndicator(
      context.shapesVisible.copyIndicator ? context.clipboardState : null,
      context.viewport
    );
    
    // Update drag preview
    this.dragPreviewOverlay.updatePreview(
      context.shapesVisible.dragPreview ? context.dragState : null,
      context.viewport
    );
  }
  
  private setupMachineListeners(): void {
    // Listen for selection changes
    this.machine.on('overlay.selection.changed', (event) => {
      if (this.onSelectionChange) {
        this.onSelectionChange(event.selectedCells);
      }
    });
    
    // Listen for fill complete
    this.machine.on('overlay.fill.completed', (event) => {
      if (this.onFillComplete && event.fillState) {
        this.onFillComplete(event.fillState.originalSelection, event.fillState.previewCells);
      }
    });
  }
  
  
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  // Set the coordinate manager reference directly
  setCoordinateManager(manager: VibeGridXCoordinateManager): void {
    this.coordinateManager = manager;
    console.log('CanvasOverlay: Coordinate manager set');
  }
  
  // Get coordinate manager
  getCoordinateManager(): VibeGridXCoordinateManager | null {
    if (!this.coordinateManager) {
      console.warn('CanvasOverlay.getCoordinateManager: coordinateManager is null');
    }
    return this.coordinateManager;
  }
  
  // DEPRECATED: Remove direct data mapping updates
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    console.warn('CanvasOverlay.updateDataMappings is deprecated - coordinate updates should go through coordinator actor');
  }
  
  updateSelection(selectedCells: Set<string>): void {
    this.machine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }
  
  updateColumnDrag(dragState: ColumnDragState | null, mouseX: number, mouseY: number): void {
    if (dragState && dragState.isDragging) {
      this.columnDragOverlay.updateDragPreview(dragState, mouseX, mouseY);
    } else {
      this.columnDragOverlay.clear();
    }
  }
  
  updateColumnResize(resizeState: ColumnResizeState | null): void {
    this.columnResizeOverlay.updateResizePreview(resizeState);
  }
  
  getColumnDropIndex(mouseX: number): number {
    return this.columnDragOverlay.getDropIndex(mouseX);
  }
  
  updateSelectionColumn(params: {
    selectedRows: Set<string>;
    visibleRowIds: string[];
    allRowIds: string[];
  }): void {
    if (this.selectionColumnOverlay) {
      const viewport = this.machine.getSnapshot().context.viewport;
      this.selectionColumnOverlay.update({
        selectedRows: params.selectedRows,
        visibleRowIds: params.visibleRowIds,
        allRowIds: params.allRowIds,
        viewport
      });
    }
  }
  
  updateViewport(viewport: ViewportInfo): void {
    // Transform the container to follow the scroll position
    const scrollLeft = viewport.scrollLeft || 0;
    const scrollTop = viewport.scrollTop || 0;
    this.container.style.transform = `translate(${scrollLeft}px, ${scrollTop}px)`;
    
    
    // Get actual viewport element dimensions (not from viewport parameter which may be wrong)
    const viewportElement = this.container.closest('.vibegridx-viewport') as HTMLElement;
    const actualWidth = viewportElement?.clientWidth || viewport.width;
    const actualHeight = viewportElement?.clientHeight || viewport.height;
    
    // Ensure stage covers the viewport
    this.stage.size({
      width: actualWidth,
      height: actualHeight
    });
    
    // Update container size
    this.container.style.width = actualWidth + 'px';
    this.container.style.height = actualHeight + 'px';
    
    // Log viewport updates for debugging
    console.log('CanvasOverlay.updateViewport:', { 
      containerDimensions: {
        width: actualWidth,
        height: actualHeight
      },
      viewport: {
        start: viewport.start,
        end: viewport.end,
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft
      },
      containerFixed: true // No transform applied
    });
    
    this.machine.send({ type: 'VIEWPORT_UPDATE', viewport });
    
    // Update resize overlay with viewport info
    this.columnResizeOverlay.updateViewport(viewport);
  }
  
  // Expose methods for event handlers
  get overlayRenderer() {
    return {
      handleCopy: (cells: Set<string>) => {
        this.machine.send({ type: 'COPY', cells });
      },
      handleCut: (cells: Set<string>) => {
        this.machine.send({ type: 'CUT', cells });
      },
      handlePaste: () => {
        this.machine.send({ type: 'PASTE' });
      },
      cancelFill: () => {
        this.machine.send({ type: 'FILL_CANCEL' });
      }
    };
  }
  
  showCopyIndicator(isCut: boolean): void {
    const selectedCells = this.machine.getSnapshot().context.selectedCells;
    this.machine.send({
      type: isCut ? 'CUT' : 'COPY',
      cells: selectedCells
    });
  }
  
  hideCopyIndicator(): void {
    this.machine.send({ type: 'CLEAR_CLIPBOARD' });
  }
  
  hasClipboardOutline(): boolean {
    const snapshot = this.machine.getSnapshot();
    return snapshot.context.shapesVisible.copyIndicator && 
           snapshot.context.clipboardState !== null;
  }
  
  hasFillOperation(): boolean {
    const snapshot = this.machine.getSnapshot();
    return snapshot.context.fillState !== null || 
           snapshot.context.shapesVisible.fillPreview;
  }
  
  destroy(): void {
    // Only stop machine if we created it
    if (!this.config.overlayActor) {
      this.machine.stop();
    }
    
    // Destroy feature overlays
    this.selectionOverlay.destroy();
    this.clipboardOverlay.destroy();
    this.dragPreviewOverlay.destroy();
    this.columnDragOverlay.destroy();
    
    // Destroy layers
    this.fillHandleLayer.destroy();
    this.layer.destroy();
    this.stage.destroy();
  }
}