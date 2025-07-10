import Konva from 'konva';
import { createActor } from 'xstate';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { DEFAULT_CONFIG } from './OverlayTypes';
import { overlayMachine, type OverlayMachineActor } from '../machines/overlay-machine';
import { CoordinateSystem } from './CoordinateSystem';
import { FillHandleLayer } from './FillHandleLayer';
import { SelectionOverlay } from './SelectionOverlay';
import { ClipboardOverlay } from './ClipboardOverlay';
import { DragPreviewOverlay } from './DragPreviewOverlay';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import type { RowDimensionManager } from '../dimensions/RowDimensionManager';

// ====================================
// SIMPLIFIED CANVAS OVERLAY
// ====================================

export class CanvasOverlay {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private config: OverlayConfig;
  
  // XState machine
  private machine: OverlayMachineActor;
  
  // Coordinate system
  private coordinateSystem: CoordinateSystem;
  
  // Feature overlays
  private fillHandleLayer: FillHandleLayer;
  private selectionOverlay: SelectionOverlay;
  private clipboardOverlay: ClipboardOverlay;
  private dragPreviewOverlay: DragPreviewOverlay;
  
  // Callbacks
  public onSelectionChange?: (selectedCells: Set<string>) => void;
  public onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize Konva stage
    this.initializeStage();
    
    // Create main layer
    this.layer = new Konva.Layer({ name: 'main-layer' });
    this.stage.add(this.layer);
    
    // Initialize coordinate system
    this.coordinateSystem = new CoordinateSystem(
      { cellWidth: this.config.cellWidth, cellHeight: this.config.cellHeight } as any,
      this.config.dimensionManager as ColumnDimensionManager
    );
    // CRITICAL: Set columns on coordinate system
    if (this.config.columns) {
      this.coordinateSystem.columns = this.config.columns;
      console.log('CanvasOverlay: Set columns on coordinate system', this.config.columns.length);
    }
    
    // Initialize feature overlays
    this.fillHandleLayer = new FillHandleLayer(
      this.stage,
      this.coordinateSystem,
      {
        cellHeight: this.config.cellHeight,
        dimensionManager: this.config.dimensionManager as ColumnDimensionManager,
        selectionBorderColor: this.config.selectionBorderColor
      }
    );
    
    this.selectionOverlay = new SelectionOverlay(
      this.layer,
      this.coordinateSystem,
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
      this.coordinateSystem,
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
    
    // Use provided machine or create new one
    if (this.config.overlayActor) {
      this.machine = this.config.overlayActor;
      console.log('CanvasOverlay: Using provided overlay machine');
    } else {
      this.machine = createActor(overlayMachine);
      this.machine.start();
      console.log('CanvasOverlay: Created new overlay machine');
    }
    
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
    }
  }
  
  private initializeStage(): void {
    const viewportElement = this.container.closest('.vibegridx-viewport');
    const width = viewportElement?.clientWidth || 800;
    const height = viewportElement?.clientHeight || 600;
    
    this.stage = new Konva.Stage({
      container: this.container,
      width,
      height,
      listening: true
    });
    
    // Enable pointer events for interactive overlays
    this.stage.content.style.pointerEvents = 'auto';
    this.container.style.pointerEvents = 'none';
  }
  
  private setupMachineSubscription(): void {
    // Subscribe to machine state and update all overlays
    // XState doesn't provide selective subscriptions, so we update everything
    this.machine.subscribe((snapshot) => {
      const context = snapshot.context;
      
      
      // Always update all overlays - let each overlay decide if it needs to re-render
      this.updateAllOverlays(context);
    });
  }
  
  private updateAllOverlays(context: any): void {
    // Update selection
    this.selectionOverlay.updateSelection(context.selectedCells, context.viewport);
    
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
  
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    console.log('CanvasOverlay.updateDataMappings:', {
      rowCount: rowIds.length,
      columnCount: columnIds.length
    });
    this.coordinateSystem.updateMappings(rowIds, columnIds);
  }
  
  updateSelection(selectedCells: Set<string>): void {
    this.machine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }
  
  updateViewport(viewport: ViewportInfo): void {
    // Update canvas position to follow scroll
    const actualScrollTop = document.querySelector('.vibegridx-viewport')?.scrollTop || 0;
    this.container.style.top = `${actualScrollTop}px`;
    
    this.machine.send({ type: 'VIEWPORT_UPDATE', viewport });
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
  
  destroy(): void {
    // Only stop machine if we created it
    if (!this.config.overlayActor) {
      this.machine.stop();
    }
    
    // Destroy feature overlays
    this.selectionOverlay.destroy();
    this.clipboardOverlay.destroy();
    this.dragPreviewOverlay.destroy();
    
    // Destroy layers
    this.fillHandleLayer.destroy();
    this.layer.destroy();
    this.stage.destroy();
  }
}