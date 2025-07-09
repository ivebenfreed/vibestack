import Konva from 'konva';
import type { CellRef, ViewportInfo, Column } from '../types';
import type { OverlayConfig } from './OverlayTypes';
import { DEFAULT_CONFIG } from './OverlayTypes';
import { CoordinateSystem } from './CoordinateSystem';
import { SelectionLayer } from './SelectionLayer';
import { DragSelectionLayer } from './DragSelectionLayer';
import { EditingLayer } from './EditingLayer';
import { EventDelegator } from './EventDelegator';

// ====================================
// CANVAS OVERLAY CORE
// ====================================

export class CanvasOverlayCore {
  private container: HTMLElement;
  private stage: Konva.Stage;
  private config: OverlayConfig;
  
  // Coordinate system
  private coordinateSystem: CoordinateSystem;
  
  // Event delegation
  private eventDelegator: EventDelegator | null = null;
  
  // Layers
  private backgroundLayer: Konva.Layer;
  private selectionLayer: Konva.Layer;
  private editingLayer: Konva.Layer;
  
  // Layer managers
  private selectionManager: SelectionLayer;
  private dragSelectionManager: DragSelectionLayer;
  private editingManager: EditingLayer;
  
  // State
  private selectedCells: Set<string> = new Set();
  private editingCell: CellRef | null = null;
  private viewport: ViewportInfo;
  private columns: Column[] = [];
  
  // Viewport tracking for optimization
  private viewportDimensions: { width: number; height: number } = { width: 800, height: 600 };
  private lastScrollPosition: { x: number; y: number } = { x: 0, y: 0 };
  private scrollUpdateTimer: number = 0;
  private visibleRange: { start: number; end: number } = { start: 0, end: 50 };
  
  // Callbacks
  public onSelectionChange?: (selectedCells: Set<string>) => void;
  public onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize coordinate system with dimension manager if provided
    this.coordinateSystem = new CoordinateSystem(this.config, this.config.dimensionManager);
    
    // Set columns if provided
    if (this.config.columns) {
      this.columns = this.config.columns;
      this.coordinateSystem.columns = this.config.columns;
    }
    
    // Default viewport
    this.viewport = {
      start: 0,
      end: 50,
      height: 600,
      width: 800,
      scrollTop: 0,
      itemHeight: this.config.cellHeight
    };
    
    // Initialize stage and layers
    this.initializeStage();
    this.createLayers();
    this.initializeManagers();
    this.setupEventDelegation();
    this.setupResizeObserver();
    
    console.log('CanvasOverlayCore initialized');
  }

  private initializeStage(): void {
    // Get viewport dimensions instead of full scrollable area
    const viewportElement = this.container.closest('.vibegridx-viewport');
    const viewportWidth = viewportElement?.clientWidth || 800;
    const viewportHeight = viewportElement?.clientHeight || 600;
    
    // Size canvas to match visible range with buffer
    // Buffer of 5 rows on each side (10 total) for smooth scrolling
    const bufferRows = 10;
    const width = viewportWidth;
    const height = viewportHeight + (this.config.cellHeight * bufferRows);
    
    console.log('CanvasOverlayCore: Initializing synced canvas', { 
      viewportWidth,
      viewportHeight,
      canvasWidth: width,
      canvasHeight: height,
      bufferRows,
      container: this.container.className
    });
    
    this.stage = new Konva.Stage({
      container: this.container,
      width,
      height,
      listening: true,
      preventDefault: false  // Allow wheel events to pass through naturally
    });
    
    // Store viewport info for repositioning
    this.viewportDimensions = { width: viewportWidth, height: viewportHeight };
    
    // Position canvas at the top initially
    // Will be repositioned properly when viewport is updated
    this.container.style.top = '0px';
  }

  private createLayers(): void {
    // Background layer (for debug or future use)
    this.backgroundLayer = new Konva.Layer({
      name: 'background-layer',
      preventDefault: false
    });
    
    // Selection layer
    this.selectionLayer = new Konva.Layer({
      name: 'selection-layer',
      preventDefault: false
    });
    
    // Editing layer
    this.editingLayer = new Konva.Layer({
      name: 'editing-layer',
      preventDefault: false
    });
    
    // Add layers to stage
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.selectionLayer);
    this.stage.add(this.editingLayer);
  }

  private initializeManagers(): void {
    // Initialize selection manager with dimension manager
    this.selectionManager = new SelectionLayer(
      this.selectionLayer,
      this.config,
      this.coordinateSystem,
      this.config.dimensionManager
    );
    
    // Pass columns to selection manager
    if (this.columns.length > 0) {
      this.selectionManager.columns = this.columns;
    }
    
    // Initialize drag selection manager with dimension manager
    this.dragSelectionManager = new DragSelectionLayer(
      this.stage,
      this.config,
      this.coordinateSystem,
      this.config.dimensionManager
    );
    
    // Pass columns to drag selection manager
    if (this.columns.length > 0) {
      this.dragSelectionManager.columns = this.columns;
    }
    
    // Initialize editing manager
    this.editingManager = new EditingLayer(
      this.editingLayer,
      this.config,
      this.coordinateSystem
    );
    
    // Set up callbacks
    this.dragSelectionManager.onSelectionComplete = (cells) => {
      this.updateSelection(cells);
      if (this.onSelectionChange) {
        this.onSelectionChange(cells);
      }
    };
    
    this.dragSelectionManager.onSelectionPreview = (x, y, width, height) => {
      this.selectionManager.showDragSelectionPreview(x, y, width, height);
    };
  }
  
  private setupEventDelegation(): void {
    // Event delegator temporarily disabled - it was interfering with scroll
    // TODO: Re-implement without blocking wheel events
    
    // Set up fill handle callback
    this.selectionManager.onFillComplete = (originalCells, fillCells) => {
      if (this.onFillComplete) {
        this.onFillComplete(originalCells, fillCells);
      }
    };
  }

  private setupResizeObserver(): void {
    const resizeObserver = new ResizeObserver(() => {
      const newWidth = this.container.offsetWidth || 800;
      const newHeight = this.container.offsetHeight || 600;
      
      if (newWidth !== this.stage.width() || newHeight !== this.stage.height()) {
        console.log('CanvasOverlayCore: Resizing stage', { newWidth, newHeight });
        
        this.stage.setSize({
          width: newWidth,
          height: newHeight
        });
        
        // Update viewport
        this.viewport = {
          ...this.viewport,
          width: newWidth,
          height: newHeight
        };
        
        // Redraw with new dimensions
        this.refresh();
      }
    });
    
    resizeObserver.observe(this.container);
  }

  // ====================================
  // PUBLIC API
  // ====================================

  // Update data mappings
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    this.coordinateSystem.updateMappings(rowIds, columnIds);
  }

  // Columns are now passed during initialization via config.dimensionManager

  // Update selection
  updateSelection(selectedCells: Set<string>): void {
    this.selectedCells = selectedCells;
    this.selectionManager.updateSelection(selectedCells, this.viewport);
    
    // Hide drag preview when selection is updated
    this.selectionManager.hideDragSelectionPreview();
  }

  // Update editing cell
  updateEditingCell(editingCell: CellRef | null): void {
    this.editingCell = editingCell;
    this.editingManager.updateEditingCell(editingCell, this.viewport);
  }

  // Update viewport (called on scroll)
  updateViewport(viewport: ViewportInfo): void {
    // Get total rows from coordinate system
    const { rowCount } = this.coordinateSystem.getDimensions();
    
    // Expand viewport to include buffer rows for 1:1 sync with virtual grid
    // Only add buffer if we're not at the edges
    const bufferRows = 5;
    const canAddTopBuffer = viewport.start > 0;
    const canAddBottomBuffer = viewport.end < rowCount;
    
    const expandedViewport: ViewportInfo = {
      ...viewport,
      start: canAddTopBuffer ? Math.max(0, viewport.start - bufferRows) : viewport.start,
      end: canAddBottomBuffer ? Math.min(rowCount, viewport.end + bufferRows) : viewport.end
    };
    
    console.log('CanvasOverlayCore.updateViewport:', {
      rowCount,
      originalViewport: { start: viewport.start, end: viewport.end },
      expandedViewport: { start: expandedViewport.start, end: expandedViewport.end },
      canAddTopBuffer,
      canAddBottomBuffer
    });
    
    this.viewport = expandedViewport;
    
    // Check if we need to reposition the canvas
    this.repositionCanvasIfNeeded(expandedViewport);
    
    // Update all layers with expanded viewport
    this.selectionManager.updateSelection(this.selectedCells, expandedViewport);
    this.editingManager.updateEditingCell(this.editingCell, expandedViewport);
    this.dragSelectionManager.updateViewport(expandedViewport);
  }
  
  private repositionCanvasIfNeeded(viewport: ViewportInfo): void {
    // Cancel any pending scroll update
    if (this.scrollUpdateTimer) {
      cancelAnimationFrame(this.scrollUpdateTimer);
    }
    
    // Throttle repositioning for performance
    this.scrollUpdateTimer = requestAnimationFrame(() => {
      // Sync with virtual grid visible range
      const hasRangeChanged = viewport.start !== this.visibleRange.start || 
                              viewport.end !== this.visibleRange.end;
      
      if (hasRangeChanged) {
        console.log('CanvasOverlayCore: Syncing with virtual grid (expanded)', {
          oldRange: this.visibleRange,
          newRange: { start: viewport.start, end: viewport.end },
          scrollTop: viewport.scrollTop
        });
        
        // Update visible range
        this.visibleRange = { start: viewport.start, end: viewport.end };
        
        // Calculate canvas position based on visible range
        // Viewport already includes buffer rows, so use it directly
        const canvasStartRow = viewport.start;
        const newTop = canvasStartRow * this.config.cellHeight;
        
        // Update canvas container position
        this.container.style.top = `${newTop}px`;
        
        // Resize canvas if needed to cover the expanded range
        const canvasRows = viewport.end - viewport.start;
        const newHeight = canvasRows * this.config.cellHeight;
        
        if (Math.abs(this.stage.height() - newHeight) > this.config.cellHeight) {
          this.stage.height(newHeight);
        }
        
        // Update last position
        this.lastScrollPosition.y = newTop;
        
        // Force redraw all layers at their new positions
        this.selectionManager.updateSelection(this.selectedCells, viewport);
        this.stage.batchDraw();
      }
    });
  }

  // Show copy/cut indicator
  showCopyIndicator(isCut: boolean): void {
    this.selectionManager.showCopyIndicator(isCut);
  }

  // Hide copy/cut indicator
  hideCopyIndicator(): void {
    this.selectionManager.hideCopyIndicator();
  }

  // Clear all overlays
  clear(): void {
    this.selectedCells.clear();
    this.editingCell = null;
    this.selectionManager.clear();
    this.editingManager.clear();
  }

  // Refresh all layers
  refresh(): void {
    this.selectionManager.updateSelection(this.selectedCells, this.viewport);
    this.editingManager.updateEditingCell(this.editingCell, this.viewport);
    this.stage.batchDraw();
  }

  // Get performance metrics
  getPerformanceMetrics() {
    const selectionMetrics = this.selectionManager.getPerformanceMetrics();
    
    return {
      layerCount: this.stage.children.length,
      nodeCount: this.stage.find('*').length,
      selectedCells: this.selectedCells.size,
      stageSize: {
        width: this.stage.width(),
        height: this.stage.height()
      },
      viewport: {
        ...selectionMetrics,
        lastViewport: this.viewport
      }
    };
  }

  // Destroy the overlay
  destroy(): void {
    this.clear();
    this.selectionManager.destroy();
    this.editingManager.destroy();
    // Only destroy if initialized
    if (this.eventDelegator) {
      this.eventDelegator.destroy();
    }
    this.stage.destroy();
  }
}