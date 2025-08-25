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
// ColumnDimensionManager removed - use coordinateMapping instead
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
    this.domManager = new DOMSystem(options.container);
    
    // Initialize selection manager with DOM dependencies
    this.selectionManager = new SelectionManager({
      getCellElement: (rowId: string, columnId: string) => this.getCellElement(rowId, columnId),
      forEachRowElement: (callback) => this.domManager.forEachRowElement(callback),
      getHeaderElement: () => this.domManager.getElement('header'),
      isSelectionColumnEnabled: () => true // Selection column is always enabled
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
        const lastRenderState = this.stateManager.getLastRenderState();
        if (lastRenderState) {
          const hasViewportChanged = this.virtualGrid.updateViewport(viewport, lastRenderState.rows.length);
          if (hasViewportChanged) {
            this.rowRenderingEngine.renderVisibleRows(lastRenderState);
          }
        }
        options.onScroll?.(viewport);
      }
    };

    this.eventSystem = new EventSystem({
      domManager: this.domManager,
      virtualGrid: this.virtualGrid,
      callbacks: eventCallbacks
    });
    
    // Initialize row rendering engine
    this.rowRenderingEngine = new RowEngine({
      virtualGrid: this.virtualGrid,
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      rowHeight: this.rowHeight,
      enableSelectionColumn: true // Selection column is always enabled
    });
    
    // Initialize header renderer
    this.headerRenderer = new HeaderEngine({
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      enableSelectionColumn: true, // Selection column is always enabled
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
      domManager: this.domManager,
      headerRenderer: this.headerRenderer,
      rowRenderingEngine: this.rowRenderingEngine,
      performanceMonitor: this.performanceMonitor,
      rowHeight: this.rowHeight,
      onScroll: options.onScroll
    });
    
    // Initialize state manager
    this.stateManager = new StateManager({
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
  
  // Set or update columns - DEPRECATED: Now handled by state machine coordinate mapping
  setColumns(columns: Column[]): void {
    console.warn('TableRenderer: setColumns is deprecated - column data comes from state machine coordinate mapping');
  }

  // Set or update column visibility - DEPRECATED: Now handled by state machine coordinate mapping
  setColumnVisibility(visibility: Record<string, boolean>): void {
    console.warn('TableRenderer: setColumnVisibility is deprecated - column visibility comes from state machine coordinate mapping');
  }
  
  // Initialize renderer with complete configuration - single render
  initialize(state: RenderState): void {
    this.stateManager.initialize(state);
  }
  
  setColumnOrder(order: string[]): void {
    console.warn('TableRenderer: setColumnOrder is deprecated - column order comes from state machine coordinate mapping');
  }
  
  
  // Dimension manager removed - use coordinateMapping from state machine
  
  // Get total width from STATE MACHINE coordinate mapping
  private getTotalColumnsWidth(): number {
    const lastRenderState = this.stateManager.getLastRenderState();
    if (!lastRenderState?.coordinateMapping) {
      throw new Error('TableRenderer: Missing coordinate mapping for total width calculation');
    }
    
    const coordinateColumns = lastRenderState.coordinateMapping.columns;
    // The coordinate mapping already includes the selection column width
    return coordinateColumns.reduce((sum: number, col: any) => sum + col.width, 0);
  }
  
  // Get column offset from STATE MACHINE coordinate mapping
  private getColumnOffset(columnId: string): number {
    const lastRenderState = this.stateManager.getLastRenderState();
    if (!lastRenderState?.coordinateMapping) {
      throw new Error('TableRenderer: Missing coordinate mapping for column offset calculation');
    }
    
    const coordinateColumn = lastRenderState.coordinateMapping.columns.find((c: any) => c.columnId === columnId);
    if (!coordinateColumn) {
      throw new Error(`TableRenderer: Column ${columnId} not found in coordinate mapping`);
    }
    
    return coordinateColumn.offset;
  }
  
  private setupEventListeners() {
    // Setup event delegation system
    this.eventSystem.setupEventListeners();
    
    // Focus management is now handled by EventDelegationManager on the container
    // No need to set tabIndex on viewport
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
  
  /**
   * Update a single row's DOM without full re-render
   */
  updateRow(rowId: string, newData: any, relationshipResolvers?: Record<string, (id: string | string[]) => string>): void {
    const lastRenderState = this.stateManager.getLastRenderState();
    if (!lastRenderState) {
      console.warn('TableRenderer: updateRow - no render state available');
      return;
    }
    
    console.log('🔧 TableRenderer: Updating single row', {
      rowId,
      hasRenderState: !!lastRenderState,
      newDataKeys: Object.keys(newData)
    });
    
    this.rowRenderingEngine.updateSingleRow(rowId, newData, lastRenderState, relationshipResolvers);
  }
  
  /**
   * Update a single cell's DOM without full re-render
   */
  updateCell(rowId: string, columnId: string, newValue: any, relationshipResolvers?: Record<string, (id: string | string[]) => string>): void {
    const lastRenderState = this.stateManager.getLastRenderState();
    if (!lastRenderState) {
      console.warn('TableRenderer: updateCell - no render state available');
      return;
    }
    
    // Find the column definition
    const column = lastRenderState.columns?.find(c => c.id === columnId);
    if (!column) {
      console.warn('TableRenderer: updateCell - column not found:', columnId);
      return;
    }
    
    console.log('🔧 TableRenderer: Updating single cell', {
      rowId,
      columnId,
      newValue,
      columnName: column.name
    });
    
    this.rowRenderingEngine.updateSingleCell(rowId, columnId, newValue, column, relationshipResolvers);
  }

  
  // Get row element for direct manipulation
  getRowElement(rowId: string): HTMLElement | null {
    return this.domManager.getRowElement(rowId);
  }
  
  
  // Remove a row from the DOM
  removeRow(rowId: string): void {
    const rowElement = this.domManager.getRowElement(rowId);
    if (rowElement) {
      rowElement.remove();
      this.domManager.removeRowElement(rowId);
    }
  }

  
  setEditingCell(cellRef: CellRef | null): void {
    this.selectionManager.setEditingCell(cellRef);
  }
  
  // ====================================
  // EDITING SYSTEM METHODS
  // ====================================
  
  
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
  
  // Update a single column width - DEPRECATED: Use state machine coordinate mapping
  updateColumnWidth(columnId: string, width: number): void {
    console.warn('TableRenderer: updateColumnWidth is deprecated - column updates should come from state machine');
    
    // Column width updates should now go through the state machine
    // which will recalculate coordinates and send them back to the renderer
    // The state machine will then call updateCoordinateMapping() with the new coordinates
  }
  // CRITICAL: Accept coordinate mapping updates from state machine
  updateCoordinateMapping(coordinateMapping: any, version: number): void {
    console.log('TableRenderer: Updating coordinate mapping from state machine:', {
      version,
      columnCount: coordinateMapping.columns.length,
      authoritative: true
    });
    
    // Store the coordinate mapping for use by internal methods
    this.stateManager.setCoordinateMapping(coordinateMapping, version);
    
    // Trigger re-render if needed to apply new coordinates
    const lastRenderState = this.stateManager.getLastRenderState();
    if (lastRenderState) {
      const updatedState = {
        ...lastRenderState,
        coordinateMapping,
        version: version
      };
      this.render(updatedState);
    }
  }

  destroy(): void {
    this.performanceMonitor.cancelFrameTracking();
    
    
    this.stateManager.cleanup();
    this.domManager.clearAllCaches();
    this.selectionManager.clearAllSelections();
    
    this.domManager.getElement('container').innerHTML = '';
  }
}