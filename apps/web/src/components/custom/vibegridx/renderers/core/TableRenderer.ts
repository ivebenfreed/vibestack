import type { 
  TableRow, 
  Column, 
  RenderState, 
  RendererOptions, 
  CellRef, 
  ViewportInfo,
  OptimisticOperation,
  SortConfig 
} from '../../types';
import type { ColumnDimensionManager } from '../../dimensions/ColumnDimensionManager';
import { CellPipeline } from '../engines/CellPipeline';
import { VirtualScrollManager } from '../managers/VirtualScrollManager';
import { ColumnManager } from '../managers/ColumnManager';
import { DOMSystem } from '../systems/DOMSystem';
import { SelectionManager } from '../managers/SelectionManager';
import { EventSystem, type EventCallbacks } from '../systems/EventSystem';
import { RowEngine } from '../engines/RowEngine';
import { HeaderEngine } from '../engines/HeaderEngine';
import { PerformanceSystem } from '../systems/PerformanceSystem';
import { RenderPipeline } from './RenderPipeline';
import { StateManager } from '../managers/StateManager';

// ====================================
// PERFORMANCE CONSTANTS
// ====================================

const RENDER_TARGETS = {
  INITIAL_RENDER: 70, // ms
  CELL_UPDATE: 0.5,   // ms  
  SCROLL_FPS: 60,     // fps
  BATCH_SIZE: 100     // cells per batch
} as const;

const CSS_CLASSES = {
  TABLE: 'vibegridx-table',
  HEADER: 'vibegridx-header',
  BODY: 'vibegridx-body',
  ROW: 'vibegridx-row',
  CELL: 'vibegridx-cell',
  SELECTED: 'vibegridx-selected',
  EDITING: 'vibegridx-editing',
  DIRTY: 'vibegridx-dirty',
  OPTIMISTIC: 'vibegridx-optimistic'
} as const;

// NOTE: CellRendererFactory removed - now using modular CellRendererRegistry
// This provides better type safety, extensibility, and consistent formatting

// ====================================
// TABLE RENDERER
// ====================================

export class TableRenderer {
  private virtualGrid: VirtualScrollManager;
  private columnManager: ColumnManager;
  private domManager: DOMSystem;
  private selectionManager: SelectionManager;
  private eventSystem: EventSystem;
  private rowRenderingEngine: RowEngine;
  private headerRenderer: HeaderEngine;
  private performanceMonitor: PerformanceSystem;
  private renderOrchestrator: RenderPipeline;
  private stateManager: StateManager;
  private options: RendererOptions;
  
  // State tracking
  private lastDimensions = { height: 0, width: 0 };
  
  // External managers
  private coordinateManager: any = null; // VibeGridXCoordinateManager
  private rowHeight = 40; // Default row height
  
  // Legacy event handlers removed - now handled by EventDelegationSystem
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.coordinateManager = options.coordinateManager || null;
    
    // Initialize managers
    this.columnManager = new ColumnManager({
      columns: options.columns,
      enableSelectionColumn: options.enableSelectionColumn || false,
      columnVisibility: options.columnVisibility,
      columnWidths: options.columnWidths
    });
    
    this.domManager = new DOMSystem(options.container);
    
    // Initialize selection manager with DOM dependencies
    this.selectionManager = new SelectionManager({
      getCellElement: (rowId: string, columnId: string) => this.getCellElement(rowId, columnId),
      forEachRowElement: (callback) => this.domManager.forEachRowElement(callback),
      getHeaderElement: () => this.domManager.getElement('header'),
      isSelectionColumnEnabled: () => this.columnManager.isSelectionColumnEnabled()
    });
    
    // Use configured row height or default
    this.rowHeight = options.cellHeight || 40;
    
    // PERFORMANCE FIX: Use proper initial viewport instead of hardcoded values
    // Create a minimal initial viewport - will be properly updated on first render
    const initialViewport = options.initialViewport || {
      start: 0,
      end: 0, // Don't try to guess - will be calculated properly in updateViewport
      height: 0,
      width: 0,
      scrollTop: 0,
      scrollLeft: 0,
      itemHeight: this.rowHeight
    };
    
    this.virtualGrid = new VirtualScrollManager(initialViewport);
    
    // Initialize event delegation system
    const eventCallbacks: EventCallbacks = {
      onCellClick: options.onCellClick,
      onCellDoubleClick: options.onCellDoubleClick,
      onHeaderClick: options.onColumnClick,
      onColumnResizeStart: options.onColumnResizeStart,
      onColumnResizeMove: options.onColumnResizeMove,
      onColumnResizeEnd: options.onColumnResizeEnd,
      onColumnDragStart: options.onColumnDragStart,
      onColumnDragMove: options.onColumnDragMove,
      onColumnDragEnd: options.onColumnDragEnd,
      onScroll: (viewport: ViewportInfo) => {
        // Update virtual grid and re-render if needed
        if (this.lastRenderState) {
          const hasViewportChanged = this.virtualGrid.updateViewport(viewport, this.lastRenderState.rows.length);
          if (hasViewportChanged) {
            this.rowRenderingEngine.renderVisibleRows(this.lastRenderState);
          }
        }
        options.onScroll?.(viewport);
      }
    };

    this.eventSystem = new EventSystem({
      domManager: this.domManager,
      virtualGrid: this.virtualGrid,
      columnManager: this.columnManager,
      callbacks: eventCallbacks
    });
    
    // Initialize row rendering engine
    this.rowRenderingEngine = new RowEngine({
      virtualGrid: this.virtualGrid,
      columnManager: this.columnManager,
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      rowHeight: this.rowHeight,
      enableSelectionColumn: options.enableSelectionColumn || false
    });
    
    // Initialize header renderer
    this.headerRenderer = new HeaderEngine({
      columnManager: this.columnManager,
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      enableSelectionColumn: options.enableSelectionColumn || false,
      getTotalColumnsWidth: () => this.getTotalColumnsWidth()
    });
    
    // Initialize performance monitor
    this.performanceMonitor = new PerformanceSystem(
      {
        initialRender: RENDER_TARGETS.INITIAL_RENDER,
        cellUpdate: RENDER_TARGETS.CELL_UPDATE,
        scrollFPS: RENDER_TARGETS.SCROLL_FPS,
        batchSize: RENDER_TARGETS.BATCH_SIZE
      },
      (event) => {
        // Forward performance events to parent
        if (event.type === 'render.complete') {
          options.onStateChange?.({
            type: 'render.complete',
            renderTime: event.duration,
            rowCount: event.details?.rowCount || 0,
            visibleRange: this.virtualGrid.getVisibleRange()
          });
        }
      }
    );
    
    // Initialize render orchestrator
    this.renderOrchestrator = new RenderPipeline({
      virtualGrid: this.virtualGrid,
      columnManager: this.columnManager,
      domManager: this.domManager,
      headerRenderer: this.headerRenderer,
      rowRenderingEngine: this.rowRenderingEngine,
      performanceMonitor: this.performanceMonitor,
      rowHeight: this.rowHeight,
      onScroll: options.onScroll
    });
    
    // Initialize state manager
    this.stateManager = new StateManager({
      columnManager: this.columnManager,
      virtualGrid: this.virtualGrid,
      selectionManager: this.selectionManager,
      headerRenderer: this.headerRenderer,
      rowRenderingEngine: this.rowRenderingEngine,
      performanceMonitor: this.performanceMonitor,
      renderOrchestrator: this.renderOrchestrator,
      domManager: this.domManager,
      options
    });
    
    // Event handlers now managed by EventDelegationSystem
    
    // DOM is already initialized by DOMStructureManager
    this.setupEventListeners();
  }
  
  // ====================================
  // INITIALIZATION
  // ====================================
  
  // DOM is now handled by DOMStructureManager
  
  // Initialize canvas overlay post-render (non-blocking)
  initializeCanvasPostRender(): void {
    this.stateManager.initializeCanvasPostRender();
  }
  
  // Set or update columns
  setColumns(columns: Column[]): void {
    this.stateManager.setColumns(columns);
  }

  // Set or update column visibility
  setColumnVisibility(visibility: Record<string, boolean>): void {
    this.stateManager.setColumnVisibility(visibility);
  }
  
  // Initialize renderer with complete configuration - single render
  initialize(state: RenderState): void {
    this.stateManager.initialize(state);
  }
  
  setColumnOrder(order: string[]): void {
    this.stateManager.setColumnOrder(order);
  }
  
  
  // Set dimension manager (called by parent component)
  setDimensionManager(manager: ColumnDimensionManager): void {
    this.stateManager.setDimensionManager(manager);
  }
  
  // Get total width of all visible columns using table machine context
  private getTotalColumnsWidth(): number {
    return this.columnManager.getTotalColumnsWidth(this.stateManager.getLastRenderState()?.columnWidths);
  }
  
  // Get column offset position for visible columns only using table machine context
  private getColumnOffset(columnId: string): number {
    const lastRenderState = this.stateManager.getLastRenderState();
    return this.columnManager.getColumnOffset(
      columnId,
      lastRenderState?.columnOffsets,
      lastRenderState?.columnWidths
    );
  }
  
  private setupEventListeners() {
    // Setup event delegation system
    this.eventSystem.setupEventListeners();
    
    // Make viewport focusable for keyboard events (handled at component level)
    const viewport = this.domManager.getElement('viewport');
    viewport.tabIndex = 0;
  }
  
  cleanup(): void {
    // Cleanup event delegation system
    this.eventSystem.cleanup();
    
    // Cleanup state manager
    this.stateManager.cleanup();
    
    // Cancel performance monitoring
    this.performanceMonitor.cancelFrameTracking();
  }
  
  
  // ====================================
  // PUBLIC RENDERING API
  // ====================================
  
  render(state: RenderState): void {
    // Rows are already pre-sorted by render state extractor
    this.stateManager.setLastRenderState(state);
    
    // Sync selection state from render state to SelectionManager
    this.selectionManager.setSelectedCells(state.selectedCells);
    this.selectionManager.setEditingCell(state.editingCell);
    
    // Note: selectedRows is not in RenderState - it's managed separately by setSelectedRows calls
    
    // NOTE: Coordinate manager updates removed - now handled by coordinate actor
    // The TableMachine receives coordinate mappings from the coordinate actor
    // and provides them to the renderer via render state. This eliminates
    // the "hackery" of direct method calls and follows proper XState patterns.
    
    // Skip column configuration updates in render - should use initialize() instead
    // Column visibility and order are set during initialization or via dedicated methods
    
    // Delegate to render orchestrator
    this.renderOrchestrator.render(state);
  }
  
  updateCell(rowId: string, columnId: string, value: any, column: Column): void {
    this.stateManager.queueCellUpdate(rowId, columnId, value);
  }

  // Update a single row without full table re-render
  updateRow(rowId: string, entity: any, columns?: Column[], relationshipResolvers?: Record<string, (id: string | string[]) => string>): void {
    // Convert entity to TableRow format
    const row: TableRow = {
      id: entity.id,
      data: entity,
      metadata: {
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        version: 1,
        isNew: false,
        isDirty: false
      }
    };
    
    // Update the row using the engine
    this.rowRenderingEngine.updateRow(row, this.stateManager.getLastRenderState(), columns, relationshipResolvers);
  }
  
  // Get row element for direct manipulation
  getRowElement(rowId: string): HTMLElement | null {
    return this.domManager.getRowElement(rowId);
  }
  
  // Render row cells (for fallback in renderer-actor)
  renderRowCells(row: TableRow, rowElement: HTMLElement, columns: Column[], relationshipResolvers?: Record<string, (id: string | string[]) => string>): void {
    this.rowRenderingEngine.renderRowCells(row, rowElement, columns, relationshipResolvers);
  }
  
  // Remove a row from the DOM
  removeRow(rowId: string): void {
    const rowElement = this.domManager.getRowElement(rowId);
    if (rowElement) {
      rowElement.remove();
      this.domManager.removeRowElement(rowId);
    }
  }

  // NEW: Update multiple rows (but not the entire table)
  updateRows(rows: TableRow[]): void {
    this.rowRenderingEngine.updateRows(rows, this.stateManager.getLastRenderState());
  }
  
  setEditingCell(cellRef: CellRef | null): void {
    this.selectionManager.setEditingCell(cellRef);
  }
  
  setSelectedCells(selectedCells: Set<string>): void {
    this.selectionManager.setSelectedCells(selectedCells);
  }
  
  setSelectedRows(selectedRows: Set<string>): void {
    const lastRenderState = this.stateManager.getLastRenderState();
    const allRows = lastRenderState ? lastRenderState.rows : [];
    this.selectionManager.setSelectedRows(selectedRows, allRows);
    
    // Update header checkbox state
    this.headerRenderer.updateHeaderCheckbox(allRows.length, selectedRows.size);
  }
  
  // ====================================
  // SELECTION API
  // ====================================
  
  getSelectedCells(): Set<string> {
    return this.selectionManager.getSelectedCells();
  }
  
  getSelectedRows(): Set<string> {
    return this.selectionManager.getSelectedRows();
  }
  
  getEditingCell(): CellRef | null {
    return this.selectionManager.getEditingCell();
  }
  
  isCellSelected(rowId: string, columnId: string): boolean {
    return this.selectionManager.isCellSelected(rowId, columnId);
  }
  
  isRowSelected(rowId: string): boolean {
    return this.selectionManager.isRowSelected(rowId);
  }
  
  isCellEditing(rowId: string, columnId: string): boolean {
    return this.selectionManager.isCellEditing(rowId, columnId);
  }
  
  toggleCellSelection(rowId: string, columnId: string): boolean {
    return this.selectionManager.toggleCellSelection(rowId, columnId);
  }
  
  toggleRowSelection(rowId: string): boolean {
    const lastRenderState = this.stateManager.getLastRenderState();
    const allRows = lastRenderState ? lastRenderState.rows : [];
    return this.selectionManager.toggleRowSelection(rowId, allRows);
  }
  
  selectAllRows(): void {
    const lastRenderState = this.stateManager.getLastRenderState();
    const allRows = lastRenderState ? lastRenderState.rows : [];
    this.selectionManager.selectAllRows(allRows);
  }
  
  clearAllSelections(): void {
    const lastRenderState = this.stateManager.getLastRenderState();
    const allRows = lastRenderState ? lastRenderState.rows : [];
    this.selectionManager.clearAllSelections(allRows);
  }
  
  getSelectionStats() {
    return this.selectionManager.getSelectionStats();
  }
  
  // ====================================
  // PRIVATE RENDERING METHODS
  // ====================================
  
  // Header rendering is now handled by HeaderRenderer
  
  // Row rendering is now handled by RowRenderingEngine
  
  // Individual row rendering methods removed - now handled by RowRenderingEngine
  
  // Cell rendering methods removed - now handled by RowRenderingEngine
  
  private lastSelectedRowId: string | null = null;
  
  // REMOVED: updateSelections - handled by Canvas Overlay Manager
  // REMOVED: renderRowCells - handled by RowRenderingEngine
  // REMOVED: applyOptimisticOperations - handled by RowRenderingEngine
  // REMOVED: processBatchUpdates - handled by RendererStateManager
  
  // ====================================
  // LEGACY EVENT HANDLERS (MOVED TO EventDelegationSystem)
  // These methods are kept for compatibility but are no longer used
  // ====================================
  
  // Event handling is now managed by EventDelegationSystem
  // All event handlers have been extracted to the delegation system
  
  // ====================================
  // FAST CELL RENDERING
  // ====================================
  
  // Legacy cell double click handler removed - now handled by EventDelegationSystem
  
  // Legacy mouse down handler removed - now handled by EventDelegationSystem
  
  // Legacy drag and resize state removed - now handled by EventDelegationSystem
  
  // Legacy header mouse down handler removed - now handled by EventDelegationSystem
  

  // Legacy drag move handler removed - now handled by EventDelegationSystem
  
  // Legacy drag end handler removed - now handled by EventDelegationSystem
  
  // Legacy header click handler removed - now handled by EventDelegationSystem

  // Legacy resize move handler removed - now handled by EventDelegationSystem

  // Legacy resize end handler removed - now handled by EventDelegationSystem

  
  // ====================================
  // FAST CELL RENDERING
  // ====================================
  
  private renderValueFast(value: any, column: Column, rowData?: any): string {
    return CellPipeline.renderValue(value, column, rowData);
  }

  // ====================================
  // UTILITY METHODS
  // ====================================
  
  private getCellElement(rowId: string, columnId: string): HTMLElement | null {
    return this.domManager.getElement('body').querySelector(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
    ) as HTMLElement;
  }
  
  getPerformanceMetrics() {
    const metrics = this.performanceMonitor.getMetrics();
    return {
      ...metrics,
      visibleRows: this.virtualGrid.getVisibleRange(),
      cacheSize: {
        rows: this.domManager.getCacheMetrics().rowElements,
        cells: this.domManager.getCacheMetrics().cellElements
      },
      updateQueueSize: this.stateManager.getUpdateQueueSize()
    };
  }
  
  // Update a single column width
  updateColumnWidth(columnId: string, width: number): void {
    // Get layout information from ColumnManager
    const layoutInfo = this.columnManager.updateColumnWidthAndCalculateLayout(columnId, width);
    if (!layoutInfo) return;
    
    const { totalWidth, columnOffsets, columnWidths, visibleColumns } = layoutInfo;
    
    // Update the header cell width
    const headerCell = this.domManager.getElement('header').querySelector(`[data-column="${columnId}"]`) as HTMLElement;
    if (headerCell) {
      headerCell.style.width = `${width}px`;
      headerCell.style.minWidth = `${width}px`;
      headerCell.style.maxWidth = `${width}px`;
      // Force flex-shrink to prevent overlapping
      headerCell.style.flexShrink = '0';
    }
    
    // Update all cells - both width and position
    visibleColumns.forEach(col => {
      const cells = this.domManager.getElement('body').querySelectorAll(`[data-column-id="${col.id}"]`) as NodeListOf<HTMLElement>;
      const colWidth = columnWidths[col.id] || this.columnManager.getColumnWidth(col.id);
      const colOffset = columnOffsets[col.id];
      
      cells.forEach(cell => {
        cell.style.width = `${colWidth}px`;
        cell.style.left = `${colOffset}px`;
      });
    });
    
    // Update header total width
    this.domManager.getElement('header').style.width = `${totalWidth}px`;
    
    // Force layout recalculation
    this.domManager.getElement('header').offsetHeight; // Force reflow
    
    // Update body spacer if needed
    if (this.domManager.getElement('body').firstElementChild) {
      const spacer = this.domManager.getElement('body').firstElementChild as HTMLElement;
      if (spacer.classList.contains('vibegridx-virtual-spacer')) {
        spacer.style.width = `${totalWidth}px`;
      }
    }
    
    // Update all visible rows to match the new total width
    const rows = this.domManager.getElement('body').querySelectorAll('.vibegridx-row') as NodeListOf<HTMLElement>;
    rows.forEach(row => {
      row.style.width = `${totalWidth}px`;
    });
  }
  
  destroy(): void {
    this.performanceMonitor.cancelFrameTracking();
    
    this.stateManager.cleanup();
    this.domManager.clearAllCaches();
    this.selectionManager.clearAllSelections();
    
    this.domManager.getElement('container').innerHTML = '';
  }
}