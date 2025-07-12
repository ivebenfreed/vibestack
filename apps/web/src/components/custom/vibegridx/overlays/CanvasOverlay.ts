import Konva from 'konva';
import { createActor } from 'xstate';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig, VisualCellPosition } from './OverlayTypes';
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
      
      // Also initialize our own viewport transform immediately
      this.updateViewport(initialViewport);
    }
  }
  
  private initializeStage(): void {
    const viewportElement = this.container.closest('.vibegridx-viewport');
    // Use the container's own dimensions which should be 100% of parent
    const width = this.container.offsetWidth || viewportElement?.clientWidth || 800;
    const height = this.container.offsetHeight || viewportElement?.clientHeight || 600;
    
    console.log('CanvasOverlay.initializeStage:', {
      containerParent: this.container.parentElement?.className,
      useFixedPositioning: this.config.useFixedPositioning,
      containerDimensions: {
        offsetWidth: this.container.offsetWidth,
        offsetHeight: this.container.offsetHeight,
        clientWidth: this.container.clientWidth,
        clientHeight: this.container.clientHeight
      },
      viewportDimensions: viewportElement ? {
        offsetWidth: viewportElement.offsetWidth,
        offsetHeight: viewportElement.offsetHeight,
        scrollWidth: viewportElement.scrollWidth,
        scrollHeight: viewportElement.scrollHeight
      } : null,
      computedWidth: width,
      computedHeight: height
    });
    
    // Configure container based on positioning mode
    if (this.config.useFixedPositioning) {
      // For fixed positioning, container should fill its portal parent
      this.container.style.overflow = 'hidden';
      this.container.style.position = 'relative';
      this.container.style.width = '100%';
      this.container.style.height = '100%';
    } else {
      // Legacy behavior for backward compatibility
      this.container.style.overflow = 'hidden';
    }
    
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
    
    // Create and add the main layer NOW, after stage is created
    this.layer = new Konva.Layer({ name: 'main-layer' });
    this.stage.add(this.layer);
    
    // DEBUG: Add a semi-transparent background to visualize canvas bounds
    const debugColor = this.config.useFixedPositioning ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';
    const debugBackground = new Konva.Rect({
      x: 0,
      y: 0,
      width: width,
      height: height,
      fill: debugColor, // Green for portal mode, red for legacy
      listening: false
    });
    this.layer.add(debugBackground);
    // Store reference so we can update it when viewport changes
    (this as any).debugBackground = debugBackground;
    
    // Configure pointer events based on positioning mode
    if (this.config.useFixedPositioning) {
      // In portal mode, canvas should not block cell clicks by default
      // Only enable pointer events on specific interactive elements
      this.stage.content.style.pointerEvents = 'none';
      this.container.style.pointerEvents = 'none';
      
      // Interactive elements will override this with pointer-events: auto
      this.stage.listening(false); // Disable global stage listening by default
    } else {
      // Legacy behavior
      this.stage.content.style.pointerEvents = 'auto';
      this.container.style.pointerEvents = 'none';
    }
    
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
      console.log('CanvasOverlay: Updating selection with coordinate mapping from overlay machine', {
        selectedCells: context.selectedCells.size,
        hasCoordinateMapping: !!context.coordinateMapping,
        coordinateVersion: context.coordinateMapping?.version
      });
      
      // Pass coordinate mapping directly to selection overlay - no coordinate manager needed!
      this.selectionOverlay.updateSelectionWithMapping(
        context.selectedCells, 
        context.viewport, 
        context.coordinateMapping
      );
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
  
  /**
   * Update coordinate mapping from coordinate actor (event-driven approach)
   * This replaces direct coordinate manager updates
   */
  updateCoordinates(mapping: any): void {
    console.log('CanvasOverlay: Received coordinate mapping update:', {
      version: mapping.version,
      rowCount: mapping.rows?.length || 0,
      columnCount: mapping.columns?.length || 0
    });
    
    // Update legacy coordinate manager for now (will remove this)
    if (this.coordinateManager && mapping) {
      if (mapping.rows && mapping.rows.length > 0) {
        // Transform coordinate mapping format to coordinate manager format
        const transformedRows = mapping.rows.map((row: any) => ({
          id: row.rowId, // Transform rowId to id
          data: {} // Minimal data object for coordinate manager
        }));
        this.coordinateManager.updateRows(transformedRows, mapping.sortBy || []);
        console.log('CanvasOverlay: Updated coordinate manager rows', {
          originalCount: mapping.rows.length,
          transformedCount: transformedRows.length
        });
      }
      if (mapping.columns && mapping.columns.length > 0) {
        // Transform coordinate mapping format to coordinate manager format  
        const transformedColumns = mapping.columns.map((col: any) => ({
          id: col.columnId, // Transform columnId to id
          name: col.columnId,
          field: col.columnId,
          width: col.width || 120
        }));
        this.coordinateManager.updateColumns(transformedColumns);
        console.log('CanvasOverlay: Updated coordinate manager columns', {
          originalCount: mapping.columns.length,
          transformedCount: transformedColumns.length
        });
      }
      console.log('CanvasOverlay: Updated coordinate manager with transformed mapping');
    }
    
    // Force overlay updates with new coordinates
    // Get current context from machine to update overlays
    if (this.machine) {
      const context = this.machine.getSnapshot().context;
      this.updateAllOverlays(context);
    }
  }
  
  // DEPRECATED: Remove direct data mapping updates
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    console.warn('CanvasOverlay.updateDataMappings is deprecated - coordinate updates should go through coordinator actor');
  }
  
  updateSelection(selectedCells: Set<string>): void {
    this.machine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }
  
  updateSelectionVisual(visualCells: VisualCellPosition[]): void {
    // Update selection overlay with pre-calculated visual positions
    this.selectionOverlay.updateWithVisualPositions(visualCells);
    
    // Redraw the layer
    this.layer.batchDraw();
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
    // Transform with scroll to keep canvas positioned relative to table content
    this.container.style.transform = `translate(${viewport.scrollLeft || 0}px, ${viewport.scrollTop}px)`;
    
    console.log('CanvasOverlay.updateViewport with transform:', {
      scrollTop: viewport.scrollTop,
      scrollLeft: viewport.scrollLeft || 0,
      transform: `translate(${viewport.scrollLeft || 0}px, ${viewport.scrollTop}px)`
    });
    
    // Get actual viewport element dimensions (not from viewport parameter which may be wrong)
    const viewportElement = this.container.closest('.vibegridx-viewport') as HTMLElement;
    const actualWidth = viewportElement?.clientWidth || viewport.width;
    const actualHeight = viewportElement?.clientHeight || viewport.height;
    
    // Ensure stage covers the viewport
    this.stage.size({
      width: actualWidth,
      height: actualHeight
    });
    
    // Update container size to match viewport
    this.container.style.width = actualWidth + 'px';
    this.container.style.height = actualHeight + 'px';
    
    // DEBUG: Update the background rectangle to match new size
    if ((this as any).debugBackground) {
      (this as any).debugBackground.size({
        width: actualWidth,
        height: actualHeight
      });
      this.layer.batchDraw();
    }
    
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