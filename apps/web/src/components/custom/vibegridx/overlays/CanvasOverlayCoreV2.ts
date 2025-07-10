import Konva from 'konva';
import { createActor } from 'xstate';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { DEFAULT_CONFIG } from './OverlayTypes';
import { overlayMachine, type OverlayMachineActor } from '../machines/overlay-machine';
import { OverlayRenderer } from './OverlayRenderer';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';

// ====================================
// CANVAS OVERLAY CORE V2 - XState Powered
// ====================================

export class CanvasOverlayCoreV2 {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private config: OverlayConfig;
  
  // XState machine and renderer
  private overlayMachine: OverlayMachineActor;
  private renderer: OverlayRenderer;
  
  // State
  private columns: Column[] = [];
  
  // Callbacks (for backward compatibility)
  public onSelectionChange?: (selectedCells: Set<string>) => void;
  public onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize stage
    this.initializeStage();
    
    // Use provided overlay actor or create a new one
    if (this.config.overlayActor) {
      this.overlayMachine = this.config.overlayActor;
      console.log('CanvasOverlayCoreV2: Using overlay actor from table machine');
    } else {
      this.overlayMachine = createActor(overlayMachine);
      this.overlayMachine.start();
      console.log('CanvasOverlayCoreV2: Created standalone overlay machine');
    }
    
    // Create renderer with machine
    this.renderer = new OverlayRenderer(
      this.stage,
      this.overlayMachine,
      {
        dimensionManager: this.config.dimensionManager as ColumnDimensionManager,
        rowDimensionManager: this.config.rowDimensionManager,
        columns: this.config.columns || [],
        cellWidth: this.config.cellWidth,
        cellHeight: this.config.cellHeight,
        selectionColor: this.config.selectionColor,
        selectionBorderColor: this.config.selectionBorderColor,
        editingColor: this.config.editingColor,
        editingBorderColor: this.config.editingBorderColor,
        borderWidth: this.config.borderWidth,
        enableAnimations: this.config.enableAnimations || false,
        animationDuration: this.config.animationDuration || 200
      }
    );
    
    // Send initial viewport to machine immediately
    const viewportElement = this.container.closest('.vibegridx-viewport');
    if (viewportElement) {
      const initialViewport = {
        start: 0,
        end: Math.ceil(viewportElement.clientHeight / this.config.cellHeight),
        height: viewportElement.clientHeight,
        width: viewportElement.clientWidth,
        scrollTop: 0,
        itemHeight: this.config.cellHeight
      };
      
      console.log('CanvasOverlayCoreV2: Sending initial viewport to machine:', initialViewport);
      this.overlayMachine.send({ type: 'VIEWPORT_UPDATE', viewport: initialViewport });
    }
    
    // Set up machine event listeners
    this.setupMachineListeners();
    
    // Set columns if provided
    if (this.config.columns) {
      this.columns = this.config.columns;
    }
    
    console.log('CanvasOverlayCoreV2: Initialized with XState architecture');
  }
  
  // Event forwarding removed - DOM handles all events directly

  private initializeStage(): void {
    // Get viewport dimensions
    const viewportElement = this.container.closest('.vibegridx-viewport');
    const viewportWidth = viewportElement?.clientWidth || 800;
    const viewportHeight = viewportElement?.clientHeight || 600;
    
    // Canvas matches viewport size exactly
    const width = viewportWidth;
    const height = viewportHeight;
    
    console.log('CanvasOverlayCoreV2: Initializing stage', { 
      viewportWidth,
      viewportHeight,
      canvasWidth: width,
      canvasHeight: height,
      container: this.container,
      containerStyle: {
        position: this.container.style.position,
        pointerEvents: this.container.style.pointerEvents,
        zIndex: this.container.style.zIndex
      }
    });
    
    this.stage = new Konva.Stage({
      container: this.container,
      width,
      height,
      listening: true,  // Enable for hover effects only
      preventDefault: false
    });
    
    // Debug canvas element
    const canvasElement = this.stage.content;
    console.log('CanvasOverlayCoreV2: Canvas element created', {
      canvas: canvasElement,
      canvasStyle: {
        position: canvasElement.style.position,
        pointerEvents: canvasElement.style.pointerEvents,
        zIndex: canvasElement.style.zIndex
      }
    });
    
    // Enable pointer events only for hover effects (fill handle)
    // Click events will still go to DOM through event bubbling
    this.stage.content.style.pointerEvents = 'auto';
    this.stage.content.style.cursor = 'default';
    
    // Container allows events to bubble through to DOM
    this.container.style.pointerEvents = 'none';
    
    // Set canvas to be above cells but still allow click-through to cells
    this.stage.content.style.position = 'relative';
    
    // Initial position - will be updated on scroll
    this.container.style.top = '0px';
    this.container.style.left = '0px';
    
    // The canvas should handle overlay interactions directly, not forward to DOM
    // Let's see what's happening with the overlay machine selection
    console.log('CanvasOverlayCoreV2: Canvas overlay ready to handle interactions');
  }
  
  private setupMachineListeners(): void {
    // Listen for selection change events from the machine
    this.overlayMachine.on('overlay.selection.changed', (event) => {
      if (this.onSelectionChange) {
        this.onSelectionChange(event.selectedCells);
      }
    });
    
    // Listen for fill complete events
    this.overlayMachine.on('overlay.fill.completed', (event) => {
      if (this.onFillComplete && event.fillState) {
        this.onFillComplete(
          event.fillState.originalSelection,
          event.fillState.previewCells
        );
      }
    });
  }

  // ====================================
  // PUBLIC API (Backward Compatible)
  // ====================================

  // Update data mappings
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    this.renderer.updateDataMappings(rowIds, columnIds);
  }

  // Update selection - centralize through machine
  updateSelection(selectedCells: Set<string>): void {
    console.log('CanvasOverlayCoreV2.updateSelection:', selectedCells.size, 'cells');
    
    // Send selection update to machine instead of directly to renderer
    this.overlayMachine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }
  
  // New method: Update selection with DOM positions
  updateSelectionWithDOMPositions(cellElements: Map<string, DOMRect>): void {
    // Extract cell keys from the DOM elements
    const selectedCells = new Set<string>(cellElements.keys());
    
    // CRITICAL FIX: Ensure canvas is positioned correctly before selection rendering
    const actualScrollTop = document.querySelector('.vibegridx-viewport')?.scrollTop || 0;
    this.container.style.top = `${actualScrollTop}px`;
    
    console.log('CanvasOverlayCoreV2: Updating selection through machine for', selectedCells.size, 'cells');
    
    // Only send selection update to machine - let it handle positioning through coordinate system
    // This is more reliable than trying to manually convert DOM positions
    this.overlayMachine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
  }

  // Update editing cell
  updateEditingCell(editingCell: CellRef | null): void {
    this.renderer.updateEditingCell(editingCell);
  }

  // Update viewport (called on scroll)
  updateViewport(viewport: ViewportInfo): void {
    // CRITICAL FIX: Update canvas container position to follow scroll
    // The canvas needs to move with the viewport so shapes stay visible
    const actualScrollTop = document.querySelector('.vibegridx-viewport')?.scrollTop || 0;
    this.container.style.top = `${actualScrollTop}px`;
    
    console.log('CanvasOverlayCoreV2.updateViewport: Positioning canvas container', {
      viewport: { scrollTop: viewport.scrollTop },
      actualScrollTop,
      containerTop: this.container.style.top
    });
    
    // Send viewport update to machine ONLY - don't directly update renderer to avoid loops
    this.overlayMachine.send({ type: 'VIEWPORT_UPDATE', viewport });
  }
  
  private refreshDOMPositions(selectedCells: Set<string>): void {
    const cellElements = new Map<string, DOMRect>();
    
    selectedCells.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const cellElement = document.querySelector(
        `.vibegridx-cell[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      ) as HTMLElement;
      
      if (cellElement) {
        cellElements.set(cellKey, cellElement.getBoundingClientRect());
      } else {
        console.warn('CanvasOverlayCoreV2: Cell element not found for', cellKey, 'after scroll - may be outside viewport');
      }
    });
    
    if (cellElements.size > 0) {
      console.log('CanvasOverlayCoreV2: Refreshing DOM positions for', cellElements.size, 'cells after scroll');
      this.updateSelectionWithDOMPositions(cellElements);
    } else {
      console.log('CanvasOverlayCoreV2: No cell elements found after scroll - cells are outside virtual viewport, letting normal rendering handle it');
      // Don't clear selection visual when cells are outside viewport
      // The selection state is maintained in the machine, and the normal rendering flow
      // will handle positioning the shapes correctly using the coordinate system
      // 
      // Just trigger a normal selection update through the machine
      this.overlayMachine.send({ type: 'SELECTION_UPDATE', cells: selectedCells });
    }
  }
  
  private expandViewportWithBuffer(viewport: ViewportInfo): ViewportInfo {
    const bufferRows = 5;
    // Get actual row count from rowDimensionManager
    const totalRows = this.config.rowDimensionManager?.getRowCount() || 0;
    
    // The last valid row index is totalRows - 1
    const lastValidIndex = Math.max(0, totalRows - 1);
    
    const canAddTopBuffer = viewport.start > 0;
    const canAddBottomBuffer = viewport.end < lastValidIndex;
    
    return {
      ...viewport,
      start: canAddTopBuffer ? Math.max(0, viewport.start - bufferRows) : viewport.start,
      end: canAddBottomBuffer ? Math.min(lastValidIndex, viewport.end + bufferRows) : Math.min(viewport.end, lastValidIndex)
    };
  }
  
  private repositionCanvasIfNeeded(viewport: ViewportInfo): void {
    // Keep canvas viewport-sized but don't transform the layer
    const viewportElement = this.container.closest('.vibegridx-viewport') as HTMLElement;
    if (!viewportElement) return;
    
    // Canvas stays viewport-sized
    const canvasHeight = viewportElement.clientHeight;
    const canvasWidth = viewportElement.clientWidth;
    
    if (this.stage.height() !== canvasHeight) {
      this.stage.height(canvasHeight);
    }
    
    if (this.stage.width() !== canvasWidth) {
      this.stage.width(canvasWidth);
    }
    
    // Don't transform the layer - handle scrolling through coordinate calculations
    // This ensures consistency between mouse events and shape rendering
  }

  // Copy/Cut indicator methods (for backward compatibility)
  showCopyIndicator(isCut: boolean): void {
    const selectedCells = this.overlayMachine.getSnapshot().context.selectedCells;
    this.overlayMachine.send({
      type: isCut ? 'CUT' : 'COPY',
      cells: selectedCells
    });
  }

  hideCopyIndicator(): void {
    this.overlayMachine.send({ type: 'CLEAR_CLIPBOARD' });
  }

  // Refresh the overlay
  refresh(): void {
    // The renderer automatically refreshes on state changes
    // This is here for backward compatibility
  }

  // Expose renderer for compatibility with existing event handlers
  get overlayRenderer() {
    return this.renderer;
  }

  // Cancel any active fill operation
  cancelFill(): void {
    this.renderer.cancelFill();
  }

  // Performance metrics
  getPerformanceMetrics() {
    const machineMetrics = this.overlayMachine.getSnapshot().context;
    const rendererMetrics = this.renderer.getPerformanceMetrics();
    
    return {
      machineRenderCount: machineMetrics.renderCount,
      lastRenderTime: machineMetrics.lastRenderTime,
      ...rendererMetrics
    };
  }

  // Destroy
  destroy(): void {
    // Only stop the machine if we created it (not shared from table machine)
    if (!this.config.overlayActor) {
      this.overlayMachine.stop();
    }
    this.renderer.destroy();
    this.stage.destroy();
  }
}