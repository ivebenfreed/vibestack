import type { 
  TableRow, 
  Column, 
  RenderState, 
  RendererOptions, 
  CellRef, 
  ViewportInfo,
  OptimisticOperation,
  SortConfig 
} from '../types';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import { CellRenderingPipeline } from './CellRenderingPipeline';
import { VirtualGridManager } from './VirtualGridManager';
import { ColumnManager } from './ColumnManager';
import { DOMStructureManager } from './DOMStructureManager';
import { SelectionManager } from './SelectionManager';
import { EventDelegationSystem, type EventCallbacks } from './EventDelegationSystem';
import { RowRenderingEngine } from './RowRenderingEngine';
import { HeaderRenderer } from './HeaderRenderer';

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
// ATOMIC TABLE RENDERER
// ====================================

export class AtomicTableRenderer {
  private virtualGrid: VirtualGridManager;
  private columnManager: ColumnManager;
  private domManager: DOMStructureManager;
  private selectionManager: SelectionManager;
  private eventSystem: EventDelegationSystem;
  private rowRenderingEngine: RowRenderingEngine;
  private headerRenderer: HeaderRenderer;
  private options: RendererOptions;
  
  // Performance tracking
  private renderStartTime = 0;
  private lastRenderTime = 0;
  private frameId = 0;
  private lastDimensions = { height: 0, width: 0 };
  private canvasInitialized = false; // Track canvas overlay initialization
  private isFirstRender = true; // Track if this is the first render
  
  // State caches
  private lastRenderState: RenderState | null = null;
  
  // External managers
  private dimensionManager: ColumnDimensionManager | null = null;
  private coordinateManager: any = null; // VibeGridXCoordinateManager
  private rowHeight = 40; // Default row height
  
  // Batch update queue
  private updateQueue = new Set<string>();
  private batchTimeoutId = 0;
  
  // Legacy event handlers removed - now handled by EventDelegationSystem
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.dimensionManager = options.dimensionManager || null;
    this.coordinateManager = options.coordinateManager || null;
    
    // Initialize managers
    this.columnManager = new ColumnManager({
      columns: options.columns,
      enableSelectionColumn: options.enableSelectionColumn || false,
      columnVisibility: options.columnVisibility,
      columnWidths: options.columnWidths
    });
    
    this.domManager = new DOMStructureManager(options.container);
    
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
    
    this.virtualGrid = new VirtualGridManager(initialViewport);
    
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

    this.eventSystem = new EventDelegationSystem({
      domManager: this.domManager,
      virtualGrid: this.virtualGrid,
      columnManager: this.columnManager,
      callbacks: eventCallbacks
    });
    
    // Initialize row rendering engine
    this.rowRenderingEngine = new RowRenderingEngine({
      virtualGrid: this.virtualGrid,
      columnManager: this.columnManager,
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      rowHeight: this.rowHeight,
      enableSelectionColumn: options.enableSelectionColumn || false
    });
    
    // Initialize header renderer
    this.headerRenderer = new HeaderRenderer({
      columnManager: this.columnManager,
      domManager: this.domManager,
      selectionManager: this.selectionManager,
      enableSelectionColumn: options.enableSelectionColumn || false,
      getTotalColumnsWidth: () => this.getTotalColumnsWidth()
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
    const canvasContainer = this.domManager.getElement('canvasContainer');
    if (canvasContainer && this.options.onStateChange && !this.canvasInitialized) {
      console.log('🔧 AtomicTableRenderer: Emitting canvas.container.ready event post-render');
      this.options.onStateChange({
        type: 'canvas.container.ready',
        container: canvasContainer
      });
      this.canvasInitialized = true;
    }
  }
  
  // Set or update columns
  setColumns(columns: Column[]): void {
    this.columnManager.setColumns(columns);
    // Dimension manager will be set separately via setDimensionManager
  }

  // Set or update column visibility
  setColumnVisibility(visibility: Record<string, boolean>): void {
    this.columnManager.setColumnVisibility(visibility);
    
    // Update dimensions without triggering full re-render to avoid infinite loop
    this.updateHeaderDimensions();
  }
  
  // Initialize renderer with complete configuration - single render
  initialize(state: RenderState): void {
    // Initialize with render state
    
    try {
      // Set all configuration at once without triggering updates
      if (state.columnVisibility) {
        this.columnManager.setColumnVisibility(state.columnVisibility);
      }
      
      if (state.columnOrder && state.columnOrder.length > 0) {
        this.columnManager.setColumnOrder(state.columnOrder);
      }
      
      if (state.columns && state.columns.length > 0) {
        this.columnManager.setColumns(state.columns);
      }
      
      // Update virtual grid with row count first
      this.virtualGrid.setRowCount(state.rows.length);
      
      // NOTE: Coordinate manager updates removed - now handled by coordinate actor
      // The TableMachine receives coordinate mappings from the coordinate actor
      // and provides them to the renderer via render state. This eliminates
      // the "hackery" of direct method calls and follows proper XState patterns.
      
      // Direct render without column reconfiguration
      this.renderDirectly(state);
    } catch (error) {
      console.error('[AtomicTableRenderer] Initialize error:', error);
    }
  }
  
  // Direct render without column configuration updates
  private renderDirectly(state: RenderState): void {
    this.lastRenderState = state;
    
    try {
      // Batch all DOM writes together before reading dimensions
      this.headerRenderer.renderHeader(state);
      
      // Use requestAnimationFrame to defer dimension reading until after browser paint
      requestAnimationFrame(() => {
        this.updateViewport(state);
        this.rowRenderingEngine.renderVisibleRows(state);
        this.rowRenderingEngine.applyOptimisticOperations(state.optimisticOperations);
      });
    } catch (error) {
      console.error('[AtomicTableRenderer] Render error:', error);
    }
  }
  
  setColumnOrder(order: string[]): void {
    console.log('[AtomicTableRenderer] Setting column order:', order);
    this.columnManager.setColumnOrder(order);
    this.updateHeaderDimensions();
  }

  private getLastRenderState(): RenderState | null {
    return this.lastRenderState;
  }

  // Update header dimensions without full re-render
  private updateHeaderDimensions(): void {
    if (this.columnManager.getVisibleColumns().length > 0) {
      const totalWidth = this.getTotalColumnsWidth();
      this.domManager.getElement('header').style.width = `${totalWidth}px`;
      
      // Update dimension manager with visible columns
      if (this.dimensionManager) {
        this.dimensionManager.setColumns(this.columnManager.getVisibleColumns());
      }
      
      // Re-render header content to show/hide columns
      if (this.lastRenderState) {
        this.headerRenderer.renderHeader(this.lastRenderState);
        // Also re-render visible rows to update cell positions
        this.rowRenderingEngine.renderVisibleRows(this.lastRenderState);
      }
    }
  }
  
  
  // Set dimension manager (called by parent component)
  setDimensionManager(manager: ColumnDimensionManager): void {
    this.dimensionManager = manager;
    
    // If this is a coordinate manager, sync visible columns
    if (manager && typeof manager.getColumnIds === 'function') {
      const coordinateColumnIds = manager.getColumnIds();
      console.log('AtomicTableRenderer: Syncing visible columns with coordinate manager', {
        coordinateManagerColumns: coordinateColumnIds,
        rendererColumns: this.columnManager.getVisibleColumns().map(c => c.id)
      });
      
      // Update column order to match coordinate manager
      this.columnManager.setColumnOrder(coordinateColumnIds);
      
      console.log('AtomicTableRenderer: Updated visible columns', {
        newVisibleColumns: this.columnManager.getVisibleColumns().map(c => c.id)
      });
    }
    
    // Subscribe to dimension changes
    manager.subscribe?.((event) => {
      // Handle dimension changes - could trigger re-render of affected cells
      console.log('AtomicTableRenderer: Column dimension changed', event);
      
      // Re-render header to reflect new widths
      if (this.lastRenderState) {
        this.headerRenderer.renderHeader(this.lastRenderState);
      }
    });
  }
  
  // Get total width of all visible columns using table machine context
  private getTotalColumnsWidth(): number {
    // Use render state column widths if available (from table machine context)
    if (this.lastRenderState && this.lastRenderState.columnWidths) {
      let totalWidth = 0;
      
      // Selection column is always included
      totalWidth += 48; // Fixed width for selection column
      
      this.columnManager.getVisibleColumns().forEach(column => {
        totalWidth += this.lastRenderState.columnWidths[column.id] || column.width || 120;
      });
      
      return totalWidth;
    }
    
    // Fallback: calculate from column definitions
    let totalWidth = 0;
    
    // Selection column is always included
    totalWidth += 48; // Fixed width for selection column
    
    this.columnManager.getVisibleColumns().forEach(column => {
      totalWidth += this.columnManager.getColumnWidth(column.id);
    });
    
    console.log('AtomicTableRenderer: Total width calculation:', {
      totalWidth,
      visibleColumns: this.columnManager.getVisibleColumns().length,
      hasRenderState: !!this.lastRenderState,
      hasColumnWidths: !!(this.lastRenderState?.columnWidths),
      columnWidths: this.columnManager.getColumnWidths()
    });
    
    return totalWidth;
  }
  
  // Get column offset position for visible columns only using table machine context
  private getColumnOffset(columnId: string): number {
    // Use render state column offsets if available (from table machine context)
    if (this.lastRenderState && this.lastRenderState.columnOffsets && this.lastRenderState.columnOffsets[columnId] !== undefined) {
      return this.lastRenderState.columnOffsets[columnId];
    }
    
    // Fallback: calculate offset based on visible columns that come before this column
    let offset = 0;
    
    // Selection column is always included and goes first
    offset += 48; // Fixed width for selection column
    
    for (const column of this.columnManager.getVisibleColumns()) {
      if (column.id === columnId) {
        break;
      }
      const width = (this.lastRenderState?.columnWidths?.[column.id]) || this.columnManager.getColumnWidth(column.id);
      offset += width;
    }
    
    return offset;
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
    
    // Clear update queue
    this.updateQueue.clear();
    
    // Cancel any pending batch timeouts
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = 0;
    }
    
    // Cancel any pending animation frames
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }
  
  // ====================================
  // SORTING HELPERS
  // ====================================
  
  private applySorting(rows: TableRow[], sortBy: SortConfig[]): TableRow[] {
    if (sortBy.length === 0) return rows;
    
    return [...rows].sort((a, b) => {
      for (const sort of sortBy) {
        const aValue = a.data[sort.field];
        const bValue = b.data[sort.field];
        
        if (aValue === bValue) continue;
        
        let comparison = 0;
        
        if (aValue == null && bValue == null) {
          comparison = 0;
        } else if (aValue == null) {
          comparison = 1; // null values go to the end
        } else if (bValue == null) {
          comparison = -1;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return sort.direction === 'desc' ? -comparison : comparison;
      }
      
      return 0;
    });
  }
  
  // ====================================
  // PUBLIC RENDERING API
  // ====================================
  
  render(state: RenderState): void {
    
    this.renderStartTime = performance.now();
    
    // Update column widths from render state
    if (state.columnWidths) {
      this.columnManager.setColumnWidths(state.columnWidths);
    }
    
    // Rows are already pre-sorted by render state extractor
    this.lastRenderState = state;
    
    // Update columns if provided in state
    if (state.columns && state.columns.length > 0) {
      this.setColumns(state.columns);
    }
    
    // Update column widths if provided
    if (state.columnWidths) {
      this.columnManager.setColumnWidths(state.columnWidths);
    }
    
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
    
    try {
      // STEP 1: Render header
      const headerOnlyStart = performance.now();
      const headerMetrics = this.headerRenderer.renderHeader(state);
      const headerOnlyTime = headerMetrics.renderTime;
      
      // Check if this is the first render
      if (this.isFirstRender) {
        console.log('🎨 AtomicTableRenderer: First render - executing synchronously');
        this.isFirstRender = false;
        
        // CRITICAL: Set row count BEFORE updating viewport
        this.virtualGrid.setRowCount(state.rows.length);
        
        // STEP 2: Update viewport
        const viewportStart = performance.now();
        this.updateViewport(state);
        const viewportTime = performance.now() - viewportStart;
        
        // Log viewport info for debugging
        console.log('🎨 AtomicTableRenderer: First render viewport info AFTER updateViewport', {
          visibleRange: this.virtualGrid.getVisibleRange(),
          metrics: this.virtualGrid.getMetrics()
        });
        
        // STEP 3: Render visible rows
        console.log('🎨 AtomicTableRenderer: About to render visible rows synchronously');
        const rowsStart = performance.now();
        const metrics = this.rowRenderingEngine.renderVisibleRows(state);
        const rowsTime = performance.now() - rowsStart;
        console.log('🎨 AtomicTableRenderer: Visible rows rendered synchronously', metrics);
        
        // STEP 4: Apply optimistic operations
        const optimisticStart = performance.now();
        this.rowRenderingEngine.applyOptimisticOperations(state.optimisticOperations);
        const optimisticTime = performance.now() - optimisticStart;
        
        
        // Performance timing
        this.lastRenderTime = performance.now() - this.renderStartTime;
        
        console.log('🔍 RENDER PIPELINE BREAKDOWN:', {
          'Header only': `${headerOnlyTime.toFixed(2)}ms`,
          'Viewport update': `${viewportTime.toFixed(2)}ms`,
          'Visible rows': `${rowsTime.toFixed(2)}ms`, 
          'Optimistic ops': `${optimisticTime.toFixed(2)}ms`,
          'TOTAL': `${this.lastRenderTime.toFixed(2)}ms`
        });
        
        console.log('🎨 AtomicTableRenderer: First render complete synchronously', {
          renderTime: this.lastRenderTime,
          rowCount: state.rows.length,
          timestamp: performance.now()
        });
        
        // Notify completion
        this.options.onStateChange?.({
          type: 'render.complete',
          renderTime: this.lastRenderTime,
          rowCount: state.rows.length,
          visibleRange: this.virtualGrid.getVisibleRange()
        });
        
        // Send viewport update for canvas overlay
        const initialViewport: ViewportInfo = {
          start: this.virtualGrid.getVisibleRange().start,
          end: this.virtualGrid.getVisibleRange().end,
          height: this.domManager.getElement('viewport').clientHeight,
          width: this.domManager.getElement('viewport').clientWidth,
          scrollTop: this.domManager.getElement('viewport').scrollTop,
          scrollLeft: this.domManager.getElement('viewport').scrollLeft,
          itemHeight: this.virtualGrid.getRowHeight()
        };
        
        this.options.onScroll?.(initialViewport);
      } else {
        // Subsequent renders: use RAF for better performance
        requestAnimationFrame(() => {
          // Batch all operations in single frame for better performance
          this.updateViewport(state);
          this.rowRenderingEngine.renderVisibleRows(state);
          this.rowRenderingEngine.applyOptimisticOperations(state.optimisticOperations);
          
          
          // Performance timing
          this.lastRenderTime = performance.now() - this.renderStartTime;
          
          // Notify completion
          this.options.onStateChange?.({
            type: 'render.complete',
            renderTime: this.lastRenderTime,
            rowCount: state.rows.length,
            visibleRange: this.virtualGrid.getVisibleRange()
          });
          
          // Send viewport update for canvas overlay
          const viewport: ViewportInfo = {
            start: this.virtualGrid.getVisibleRange().start,
            end: this.virtualGrid.getVisibleRange().end,
            height: this.domManager.getElement('viewport').clientHeight,
            width: this.domManager.getElement('viewport').clientWidth,
            scrollTop: this.domManager.getElement('viewport').scrollTop,
            scrollLeft: this.domManager.getElement('viewport').scrollLeft,
            itemHeight: this.virtualGrid.getRowHeight()
          };
          
          this.options.onScroll?.(viewport);
        });
      }
      
    } finally {
      // CORRECTED: This measures the entire render pipeline, not just header
      const totalRenderTime = performance.now() - this.renderStartTime;
      if (totalRenderTime > 10) {
        console.log(`AtomicTableRenderer: Total render pipeline took ${totalRenderTime.toFixed(2)}ms`);
      }
    }
  }
  
  updateCell(rowId: string, columnId: string, value: any, column: Column): void {
    const cellKey = `${rowId}:${columnId}`;
    this.updateQueue.add(cellKey);
    
    // Batch updates for performance
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }
    
    this.batchTimeoutId = window.setTimeout(() => {
      this.processBatchUpdates();
    }, 0);
  }

  // NEW: Update a single row without full table re-render
  updateRow(row: TableRow): void {
    this.rowRenderingEngine.updateRow(row, this.lastRenderState);
  }

  // NEW: Update multiple rows (but not the entire table)
  updateRows(rows: TableRow[]): void {
    this.rowRenderingEngine.updateRows(rows, this.lastRenderState);
  }
  
  setEditingCell(cellRef: CellRef | null): void {
    this.selectionManager.setEditingCell(cellRef);
  }
  
  setSelectedCells(selectedCells: Set<string>): void {
    this.selectionManager.setSelectedCells(selectedCells);
  }
  
  setSelectedRows(selectedRows: Set<string>): void {
    const allRows = this.lastRenderState ? this.lastRenderState.rows : [];
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
    const allRows = this.lastRenderState ? this.lastRenderState.rows : [];
    return this.selectionManager.toggleRowSelection(rowId, allRows);
  }
  
  selectAllRows(): void {
    const allRows = this.lastRenderState ? this.lastRenderState.rows : [];
    this.selectionManager.selectAllRows(allRows);
  }
  
  clearAllSelections(): void {
    const allRows = this.lastRenderState ? this.lastRenderState.rows : [];
    this.selectionManager.clearAllSelections(allRows);
  }
  
  getSelectionStats() {
    return this.selectionManager.getSelectionStats();
  }
  
  // ====================================
  // PRIVATE RENDERING METHODS
  // ====================================

  /**
   * Batch all DOM measurements to prevent layout thrashing.
   * The original updateViewport() method caused 42ms forced reflow by doing
   * 14 sequential DOM queries. This method consolidates them into a single pass.
   */
  private batchMeasureDOMElements() {
    return {
      viewport: {
        bounds: this.domManager.getElement('viewport').getBoundingClientRect(),
        client: {
          width: this.domManager.getElement('viewport').clientWidth,
          height: this.domManager.getElement('viewport').clientHeight
        },
        scroll: {
          top: this.domManager.getElement('viewport').scrollTop || 0,
          left: this.domManager.getElement('viewport').scrollLeft || 0
        },
        offset: {
          width: this.domManager.getElement('viewport').offsetWidth,
          height: this.domManager.getElement('viewport').offsetHeight
        }
      },
      container: {
        bounds: this.domManager.getElement('container').getBoundingClientRect(),
        client: {
          width: this.domManager.getElement('container').clientWidth,
          height: this.domManager.getElement('container').clientHeight
        }
      },
      table: {
        bounds: this.domManager.getElement('table').getBoundingClientRect(),
        client: {
          width: this.domManager.getElement('table').clientWidth,
          height: this.domManager.getElement('table').clientHeight
        }
      }
    };
  }
  
  private updateViewport(state: RenderState): void {
    // PERFORMANCE OPTIMIZATION: Batch all DOM measurements to prevent layout thrashing
    // The original code caused 42ms forced reflow by doing 14 sequential DOM queries
    const measurements = this.batchMeasureDOMElements();
    
    // Use cached measurements for calculations - but check container if viewport is 0
    let viewportHeight = measurements.viewport.client.height;
    let viewportWidth = measurements.viewport.client.width;
    
    // If viewport has no height yet, try container measurements
    if (!viewportHeight || viewportHeight === 0) {
      viewportHeight = measurements.container.client.height || 
                       measurements.table.client.height || 
                       600; // Ultimate fallback
      console.log('🎨 AtomicTableRenderer: Using container height as viewport had no height', {
        viewportHeight,
        containerHeight: measurements.container.client.height,
        tableHeight: measurements.table.client.height
      });
    }
    
    if (!viewportWidth || viewportWidth === 0) {
      viewportWidth = measurements.container.client.width || 
                      measurements.table.client.width || 
                      800; // Ultimate fallback
    }
    
    const scrollTop = measurements.viewport.scroll.top;
    const scrollLeft = measurements.viewport.scroll.left;
    
    // Debug log actual measurements
    console.log('🎨 AtomicTableRenderer: updateViewport measurements', {
      viewportHeight,
      viewportWidth,
      containerHeight: measurements.container.client.height,
      viewportClientHeight: measurements.viewport.client.height,
      tableHeight: measurements.table.client.height,
      scrollTop,
      rowHeight: this.rowHeight,
      expectedRows: Math.ceil(viewportHeight / this.rowHeight)
    });
    
    // Use VirtualGridManager to calculate viewport
    const currentViewport = this.virtualGrid.calculateViewportFromScroll(
      scrollTop,
      viewportHeight,
      viewportWidth,
      scrollLeft
    );
    
    this.virtualGrid.updateViewport(currentViewport, state.rows.length);
  }
  
  // Header rendering is now handled by HeaderRenderer
  
  // Row rendering is now handled by RowRenderingEngine
  
  // Individual row rendering methods removed - now handled by RowRenderingEngine
  
  // Cell rendering methods removed - now handled by RowRenderingEngine
  
  private lastSelectedRowId: string | null = null;
  
  // REMOVED: updateSelections - handled by Canvas Overlay Manager
  // REMOVED: renderRowCells - handled by RowRenderingEngine
  // REMOVED: applyOptimisticOperations - handled by RowRenderingEngine
  
  private processBatchUpdates(): void {
    const startTime = performance.now();
    
    this.updateQueue.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const element = this.getCellElement(rowId, columnId);
      
      if (element) {
        // Update cell content - would get actual value from state
        element.classList.add('vibegridx-updated');
        
        // Remove update indicator after animation
        setTimeout(() => {
          element.classList.remove('vibegridx-updated');
        }, 300);
      }
    });
    
    this.updateQueue.clear();
    this.batchTimeoutId = 0;
    
    const duration = performance.now() - startTime;
    if (duration > RENDER_TARGETS.CELL_UPDATE && this.updateQueue.size > 0) {
      console.warn(`Slow batch update: ${duration.toFixed(2)}ms for ${this.updateQueue.size} cells`);
    }
  }
  
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
    return CellRenderingPipeline.renderValue(value, column, rowData);
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
    return {
      lastRenderTime: this.lastRenderTime,
      visibleRows: this.virtualGrid.getVisibleRange(),
      cacheSize: {
        rows: this.domManager.getCacheMetrics().rowElements,
        cells: this.domManager.getCacheMetrics().cellElements
      },
      updateQueueSize: this.updateQueue.size
    };
  }
  
  // Update a single column width
  updateColumnWidth(columnId: string, width: number): void {
    console.log('[AtomicTableRenderer] Updating column width', { columnId, width });
    
    // Update our internal state
    this.columnManager.setColumnWidth(columnId, width);
    
    // Update the header cell width
    const headerCell = this.domManager.getElement('header').querySelector(`[data-column="${columnId}"]`) as HTMLElement;
    if (headerCell) {
      headerCell.style.width = `${width}px`;
      headerCell.style.minWidth = `${width}px`;
      headerCell.style.maxWidth = `${width}px`;
      // Force flex-shrink to prevent overlapping
      headerCell.style.flexShrink = '0';
    }
    
    // Find the column index to know which cells need position updates
    const columnIndex = this.columnManager.getVisibleColumnIndex(columnId);
    if (columnIndex === -1) return;
    
    // Calculate new offsets for all columns
    let currentOffset = 0;
    const columnOffsets: Record<string, number> = {};
    
    console.log('[AtomicTableRenderer] Calculating offsets:', {
      enableSelectionColumn: this.columnManager.isSelectionColumnEnabled(),
      startingOffset: currentOffset,
      visibleColumns: this.columnManager.getVisibleColumns().map(c => c.id)
    });
    
    // Handle selection column specially if it exists
    if (this.columnManager.isSelectionColumnEnabled()) {
      columnOffsets['__selection'] = 0;
      currentOffset = 48; // Selection column is always 48px wide
      console.log('[AtomicTableRenderer] Selection column found, positioned at 0, next offset: 48');
    } else {
      // If no selection column in visibleColumns but cells expect it, start at 48
      currentOffset = 48;
      console.log('[AtomicTableRenderer] No selection column in visibleColumns, but starting at 48 for cell compatibility');
    }
    
    // Position data columns
    this.columnManager.getVisibleColumns().forEach((col, index) => {
      if (col.id === '__selection') return; // Already handled
      
      columnOffsets[col.id] = currentOffset;
      const colWidth = this.columnManager.getColumnWidth(col.id);
      console.log(`[AtomicTableRenderer] Column ${col.id}: offset=${currentOffset}, width=${colWidth}`);
      currentOffset += colWidth;
    });
    
    // Update all cells - both width and position
    this.columnManager.getVisibleColumns().forEach((col, index) => {
      const cells = this.domManager.getElement('body').querySelectorAll(`[data-column-id="${col.id}"]`) as NodeListOf<HTMLElement>;
      const colWidth = this.columnManager.getColumnWidth(col.id);
      const colOffset = columnOffsets[col.id];
      
      cells.forEach(cell => {
        cell.style.width = `${colWidth}px`;
        cell.style.left = `${colOffset}px`;
      });
    });
    
    // Recalculate total width
    const totalWidth = currentOffset;
    
    // Update header total width
    this.domManager.getElement('header').style.width = `${totalWidth}px`;
    
    // Force layout recalculation
    this.domManager.getElement('header').offsetHeight; // Force reflow
    
    // Update body spacer height if needed
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
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }
    
    this.domManager.clearAllCaches();
    this.selectionManager.clearAllSelections();
    this.updateQueue.clear();
    
    this.domManager.getElement('container').innerHTML = '';
  }
}