import Konva from 'konva';
import { createActor } from 'xstate';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig, VisualCellPosition } from './OverlayTypes';
import { DEFAULT_CONFIG } from './OverlayTypes';
// overlayMachine removed - using direct canvas actor approach
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
  
  // Machine removed - using direct canvas actor approach
  
  // Direct reference to coordinate manager
  private coordinateManager: VibeGridXCoordinateManager | null = null;
  
  // Stored coordinate mapping for lazy processing
  private coordinateMapping: any = null;
  
  // Feature overlays - LAZY LOADED
  private fillHandleLayer: FillHandleLayer | null = null;
  private selectionOverlay: SelectionOverlay | null = null;
  private clipboardOverlay: ClipboardOverlay | null = null;
  private dragPreviewOverlay: DragPreviewOverlay | null = null;
  private columnDragOverlay: ColumnDragOverlay | null = null;
  private columnResizeOverlay: ColumnResizeOverlay | null = null;
  private selectionColumnOverlay: SelectionColumnOverlay | null = null;
  
  // Callbacks for parent communication (pure actors approach)
  public onSelectionChange?: (selectedCells: Set<string>) => void;
  public onFillStart?: (direction: 'vertical' | 'horizontal') => void;
  public onFillPreview?: (previewCells: Set<string>) => void;
  public onFillComplete?: (fillCells: Set<string>) => void;
  public onFillCancel?: () => void;
  public onCopy?: (cells: Set<string>) => void;
  public onCut?: (cells: Set<string>) => void;
  public onPaste?: () => void;
  public onClearClipboard?: () => void;
  
  // State access for overlays (passed from table machine)
  private currentSelectedCells: Set<string> = new Set();
  private currentViewport: ViewportInfo | null = null;

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // PERFORMANCE: Defer everything except storing references
    // Stage will be initialized on first use
    
    // Coordinate manager from config or will be set via setCoordinateManager method
    this.coordinateManager = this.config.coordinateManager || null;
    
    // PERFORMANCE FIX: Don't create anything until needed
  }
  
  // Lazy stage initialization
  private ensureStageInitialized(): void {
    if (!this.stage) {
      console.log('CanvasOverlay: Lazily initializing stage');
      this.initializeStage();
    }
  }
  
  // LAZY OVERLAY GETTERS - Create overlays only when needed
  private getSelectionOverlay(): SelectionOverlay {
    if (!this.selectionOverlay) {
      console.log('CanvasOverlay: Lazily creating SelectionOverlay');
      
      // Ensure stage exists
      this.ensureStageInitialized();
      
      // PERFORMANCE: Enable listening when we first need selection
      if (!this.stage.listening()) {
        console.log('CanvasOverlay: Enabling stage listening for selection');
        this.stage.listening(true);
        this.layer.listening(true);
      }
      
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
    }
    return this.selectionOverlay;
  }
  
  private getFillHandleLayer(): FillHandleLayer {
    if (!this.fillHandleLayer) {
      console.log('CanvasOverlay: Lazily creating FillHandleLayer');
      this.ensureStageInitialized();
      this.fillHandleLayer = new FillHandleLayer(
        this.stage,
        this, // Pass canvas overlay reference as coordinate provider
        {
          cellHeight: this.config.cellHeight,
          dimensionManager: this.config.dimensionManager as ColumnDimensionManager,
          selectionBorderColor: this.config.selectionBorderColor
        },
        {
          onFillStart: (direction) => this.onFillStart?.(direction),
          onFillPreview: (previewCells) => this.onFillPreview?.(previewCells),
          onFillComplete: (fillCells) => this.onFillComplete?.(fillCells),
          onFillCancel: () => this.onFillCancel?.(),
          getSelectedCells: () => this.currentSelectedCells,
          getViewport: () => this.currentViewport
        }
      );
    }
    return this.fillHandleLayer;
  }
  
  private getClipboardOverlay(): ClipboardOverlay {
    if (!this.clipboardOverlay) {
      console.log('CanvasOverlay: Lazily creating ClipboardOverlay');
      this.ensureStageInitialized();
      this.clipboardOverlay = new ClipboardOverlay(
        this.layer,
        this, // Pass self as coordinate provider
        {
          cellHeight: this.config.cellHeight,
          dimensionManager: this.config.dimensionManager as ColumnDimensionManager
        }
      );
    }
    return this.clipboardOverlay;
  }
  
  private getDragPreviewOverlay(): DragPreviewOverlay {
    if (!this.dragPreviewOverlay) {
      console.log('CanvasOverlay: Lazily creating DragPreviewOverlay');
      this.ensureStageInitialized();
      this.dragPreviewOverlay = new DragPreviewOverlay(
        this.layer,
        {
          selectionColor: this.config.selectionColor,
          selectionBorderColor: this.config.selectionBorderColor,
          cellWidth: this.config.cellWidth,
          cellHeight: this.config.cellHeight
        }
      );
    }
    return this.dragPreviewOverlay;
  }
  
  private getColumnDragOverlay(): ColumnDragOverlay {
    if (!this.columnDragOverlay) {
      console.log('CanvasOverlay: Lazily creating ColumnDragOverlay');
      this.ensureStageInitialized();
      this.columnDragOverlay = new ColumnDragOverlay(
        this.layer,
        this.config.dimensionManager as ColumnDimensionManager,
        {
          cellHeight: this.config.cellHeight,
          headerHeight: 40 // Standard header height
        }
      );
    }
    return this.columnDragOverlay;
  }
  
  private getColumnResizeOverlay(): ColumnResizeOverlay {
    if (!this.columnResizeOverlay) {
      console.log('CanvasOverlay: Lazily creating ColumnResizeOverlay');
      this.ensureStageInitialized();
      this.columnResizeOverlay = new ColumnResizeOverlay(
        this.layer,
        this.config.dimensionManager as ColumnDimensionManager,
        {
          cellHeight: this.config.cellHeight,
          headerHeight: 40 // Standard header height
        }
      );
    }
    return this.columnResizeOverlay;
  }
  
  private initializeStage(): void {
    // PERFORMANCE: Minimal initialization - just basics
    const width = this.container.offsetWidth || 800;
    const height = this.container.offsetHeight || 600;
    
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
    
    // PERFORMANCE FIX: Use stable container ID to prevent initialization failures
    if (!this.container.id) {
      // Simple ID generation without DOM queries
      this.container.id = `vibegridx-canvas-${Math.random().toString(36).substring(2, 9)}`;
    }
    
    this.stage = new Konva.Stage({
      container: this.container.id,
      width,
      height,
      listening: false // PERFORMANCE: Start with listening off
    });
    
    // Create and add the main layer NOW, after stage is created
    this.layer = new Konva.Layer({ 
      name: 'main-layer',
      listening: false // PERFORMANCE: Start with listening off
    });
    this.stage.add(this.layer);
    
    // PERFORMANCE: Skip debug background unless explicitly enabled
    if ((window as any).__VIBEGRIDX_DEBUG_CANVAS) {
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
    }
    
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
    
    // PERFORMANCE: Skip initial draw - let first selection trigger it
    // this.layer.draw();
  }
  
  // Machine subscription removed - viewport updates come via canvas actor directly
  
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
      this.getSelectionOverlay().updateSelectionWithMapping(
        context.selectedCells, 
        context.viewport, 
        context.coordinateMapping
      );
    }
    
    // Update fill handle
    if (context.shapesVisible.fillHandle && context.selectedCells.size > 0 && context.viewport) {
      this.getFillHandleLayer().renderFillHandle(context.selectedCells, context.viewport);
    } else {
      this.getFillHandleLayer().hideFillHandle();
    }
    
    // Update fill preview
    if (context.shapesVisible.fillPreview && context.fillState?.previewCells.size) {
      this.getFillHandleLayer().renderFillPreview(context.fillState.previewCells, context.viewport!);
    } else {
      this.getFillHandleLayer().clearFillPreview();
    }
    
    // Update clipboard indicator
    this.getClipboardOverlay().updateIndicator(
      context.shapesVisible.copyIndicator ? context.clipboardState : null,
      context.viewport
    );
    
    // Update drag preview
    this.getDragPreviewOverlay().updatePreview(
      context.shapesVisible.dragPreview ? context.dragState : null,
      context.viewport
    );
  }
  
  // Machine listeners removed - events come via canvas actor directly
  
  
  
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
    
    // PERFORMANCE: Store mapping for later use, don't process now
    this.coordinateMapping = mapping;
    
    // Legacy coordinate manager update will happen when actually needed
  }
  
  // DEPRECATED: Remove direct data mapping updates
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    console.warn('CanvasOverlay.updateDataMappings is deprecated - coordinate updates should go through coordinator actor');
  }
  
  updateSelection(selectedCells: Set<string>): void {
    // Store current selection for overlay access
    this.currentSelectedCells = selectedCells;
    console.log('CanvasOverlay: updateSelection called directly', { cellCount: selectedCells.size });
  }
  
  updateSelectionVisual(visualCells: VisualCellPosition[]): void {
    // Update selection overlay with pre-calculated visual positions
    this.getSelectionOverlay().updateWithVisualPositions(visualCells);
    
    // Redraw the layer
    this.layer.batchDraw();
  }
  
  updateColumnDrag(dragState: ColumnDragState | null, mouseX: number, mouseY: number): void {
    if (dragState && dragState.isDragging) {
      this.getColumnDragOverlay().updateDragPreview(dragState, mouseX, mouseY);
    } else {
      this.getColumnDragOverlay().clear();
    }
  }
  
  updateColumnResize(resizeState: ColumnResizeState | null): void {
    this.getColumnResizeOverlay().updateResizePreview(resizeState);
  }
  
  getColumnDropIndex(mouseX: number): number {
    return this.getColumnDragOverlay().getDropIndex(mouseX);
  }
  
  updateSelectionColumn(params: {
    selectedRows: Set<string>;
    visibleRowIds: string[];
    allRowIds: string[];
  }): void {
    if (this.selectionColumnOverlay) {
      const viewport = this.currentViewport;
      this.selectionColumnOverlay.update({
        selectedRows: params.selectedRows,
        visibleRowIds: params.visibleRowIds,
        allRowIds: params.allRowIds,
        viewport
      });
    }
  }
  
  updateViewport(viewport: ViewportInfo): void {
    // Store viewport for overlay access
    this.currentViewport = viewport;
    
    // Canvas MUST move with scroll to stay aligned with table content
    this.container.style.transform = `translate(${viewport.scrollLeft || 0}px, ${viewport.scrollTop}px)`;
    
    // PERFORMANCE: Skip all stage operations if stage doesn't exist yet
    if (!this.stage) {
      return;
    }
    
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
    
    // Update resize overlay with viewport info only if it exists
    if (this.columnResizeOverlay) {
      this.columnResizeOverlay.updateViewport(viewport);
    }
  }
  
  // Event handlers for overlay interactions (pure actors approach)
  get overlayRenderer() {
    return {
      handleCopy: (cells: Set<string>) => {
        this.onCopy?.(cells);
      },
      handleCut: (cells: Set<string>) => {
        this.onCut?.(cells);
      },
      handlePaste: () => {
        this.onPaste?.();
      },
      cancelFill: () => {
        this.onFillCancel?.();
      }
    };
  }
  
  showCopyIndicator(isCut: boolean): void {
    // Use current selected cells from state
    const selectedCells = this.currentSelectedCells;
    if (isCut) {
      this.onCut?.(selectedCells);
    } else {
      this.onCopy?.(selectedCells);
    }
  }
  
  hideCopyIndicator(): void {
    this.onClearClipboard?.();
  }
  
  hasClipboardOutline(): boolean {
    // This should be determined by the parent component passing clipboard state
    // For now, return false until parent provides this information
    return false;
  }
  
  hasFillOperation(): boolean {
    // This should be determined by the parent component passing fill state
    // For now, return false until parent provides this information
    return false;
  }
  
  destroy(): void {
    // Destroy feature overlays only if they were created
    if (this.selectionOverlay) this.selectionOverlay.destroy();
    if (this.clipboardOverlay) this.clipboardOverlay.destroy();
    if (this.dragPreviewOverlay) this.dragPreviewOverlay.destroy();
    if (this.columnDragOverlay) this.columnDragOverlay.destroy();
    if (this.columnResizeOverlay) this.columnResizeOverlay.destroy();
    if (this.selectionColumnOverlay) this.selectionColumnOverlay.destroy();
    
    // Destroy layers
    if (this.fillHandleLayer) this.fillHandleLayer.destroy();
    this.layer.destroy();
    this.stage.destroy();
    
    console.log('CanvasOverlay: Destroyed');
  }
}