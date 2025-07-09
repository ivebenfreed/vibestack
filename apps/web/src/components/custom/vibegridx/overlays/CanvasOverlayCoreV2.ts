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
  
  private forwardEventToDOM(eventType: string, canvasPos: { x: number; y: number } | null, originalEvent: MouseEvent): void {
    if (!canvasPos) return;
    
    // Get the viewport element to calculate absolute position
    const viewportElement = this.container.closest('.vibegridx-viewport');
    if (!viewportElement) return;
    
    const viewportRect = viewportElement.getBoundingClientRect();
    
    // Calculate absolute screen position
    const absoluteX = viewportRect.left + canvasPos.x;
    const absoluteY = viewportRect.top + canvasPos.y;
    
    // Temporarily hide the canvas to find the element underneath
    const originalPointerEvents = this.container.style.pointerEvents;
    const originalCanvasPointerEvents = this.stage.content.style.pointerEvents;
    
    this.container.style.pointerEvents = 'none';
    this.stage.content.style.pointerEvents = 'none';
    
    // Find the DOM element at this position
    const elementBelow = document.elementFromPoint(absoluteX, absoluteY);
    
    // Debug: Check if there are any cells in the DOM
    const bodyElement = this.container.closest('.vibegridx-body');
    const allCells = bodyElement?.querySelectorAll('.vibegridx-cell');
    console.log('DOM Structure Debug:', {
      bodyElement,
      cellCount: allCells?.length,
      firstCell: allCells?.[0],
      firstCellRect: allCells?.[0]?.getBoundingClientRect()
    });
    
    // Restore canvas pointer events
    this.container.style.pointerEvents = originalPointerEvents;
    this.stage.content.style.pointerEvents = originalCanvasPointerEvents;
    
    console.log('CanvasOverlayCoreV2.forwardEventToDOM:', {
      eventType,
      canvasPos,
      absolutePos: { x: absoluteX, y: absoluteY },
      elementBelow,
      elementClass: elementBelow?.className,
      elementTagName: elementBelow?.tagName,
      isCell: elementBelow?.classList.contains('vibegridx-cell'),
      viewportRect,
      containerRect: this.container.getBoundingClientRect()
    });
    
    // If we found a cell element, dispatch the event to it
    if (elementBelow && elementBelow.classList.contains('vibegridx-cell')) {
      const syntheticEvent = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        clientX: absoluteX,
        clientY: absoluteY,
        ctrlKey: originalEvent.ctrlKey,
        shiftKey: originalEvent.shiftKey,
        altKey: originalEvent.altKey,
        metaKey: originalEvent.metaKey,
        button: originalEvent.button,
        buttons: originalEvent.buttons
      });
      
      console.log('CanvasOverlayCoreV2: Dispatching synthetic event to DOM cell');
      elementBelow.dispatchEvent(syntheticEvent);
    }
  }

  private initializeStage(): void {
    // Get viewport dimensions
    const viewportElement = this.container.closest('.vibegridx-viewport');
    const viewportWidth = viewportElement?.clientWidth || 800;
    const viewportHeight = viewportElement?.clientHeight || 600;
    
    // Size canvas to match visible range with buffer
    const bufferRows = 10;
    const width = viewportWidth;
    const height = viewportHeight + (this.config.cellHeight * bufferRows);
    
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
      listening: true,
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
    
    // Enable pointer events on the stage for interaction
    this.stage.content.style.pointerEvents = 'auto';
    
    // Position canvas at the top initially
    this.container.style.top = '0px';
    
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

  // Update editing cell
  updateEditingCell(editingCell: CellRef | null): void {
    this.renderer.updateEditingCell(editingCell);
  }

  // Update viewport (called on scroll)
  updateViewport(viewport: ViewportInfo): void {
    console.log('CanvasOverlayCoreV2.updateViewport:', viewport);
    
    // Get total rows from data mappings
    const expandedViewport = this.expandViewportWithBuffer(viewport);
    
    // Update renderer
    this.renderer.updateViewport(expandedViewport);
    
    // Reposition canvas if needed
    this.repositionCanvasIfNeeded(expandedViewport);
    
    // Log current context for debugging
    const currentContext = this.overlayMachine.getSnapshot().context;
    console.log('CanvasOverlayCoreV2: Current context after viewport update:', {
      selectedCells: currentContext.selectedCells.size,
      viewport: currentContext.viewport,
      shapesVisible: currentContext.shapesVisible
    });
    
    // If we have selections but no viewport, that's the problem
    if (currentContext.selectedCells.size > 0 && !currentContext.viewport) {
      console.warn('CanvasOverlayCoreV2: Have selections but no viewport - this will prevent rendering');
    }
  }
  
  private expandViewportWithBuffer(viewport: ViewportInfo): ViewportInfo {
    const bufferRows = 5;
    const totalRows = 1000; // This should come from actual data
    
    const canAddTopBuffer = viewport.start > 0;
    const canAddBottomBuffer = viewport.end < totalRows;
    
    return {
      ...viewport,
      start: canAddTopBuffer ? Math.max(0, viewport.start - bufferRows) : viewport.start,
      end: canAddBottomBuffer ? Math.min(totalRows, viewport.end + bufferRows) : viewport.end
    };
  }
  
  private repositionCanvasIfNeeded(viewport: ViewportInfo): void {
    // Calculate the Y position for the canvas based on visible range
    const canvasTop = viewport.start * this.config.cellHeight;
    
    // Get current scroll position from container's parent (viewport)
    const viewportElement = this.container.closest('.vibegridx-viewport') as HTMLElement;
    if (!viewportElement) return;
    
    const scrollTop = viewportElement.scrollTop;
    
    // Position canvas to align with visible content
    this.container.style.top = `${canvasTop}px`;
    
    // Ensure canvas is properly sized
    const requiredHeight = (viewport.end - viewport.start) * this.config.cellHeight;
    if (this.stage.height() < requiredHeight) {
      this.stage.height(requiredHeight + this.config.cellHeight * 5); // Add buffer
    }
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