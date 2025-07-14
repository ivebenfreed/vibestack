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
  private options: RendererOptions;
  
  // Performance tracking
  private renderStartTime = 0;
  private lastRenderTime = 0;
  private frameId = 0;
  private lastDimensions = { height: 0, width: 0 };
  private canvasInitialized = false; // Track canvas overlay initialization
  private isFirstRender = true; // Track if this is the first render
  
  // State caches
  private selectedCells = new Set<string>();
  private selectedRows = new Set<string>(); // For checkbox selection
  private editingCell: CellRef | null = null;
  private lastRenderState: RenderState | null = null;
  
  // External managers
  private dimensionManager: ColumnDimensionManager | null = null;
  private coordinateManager: any = null; // VibeGridXCoordinateManager
  private rowHeight = 40; // Default row height
  
  // Batch update queue
  private updateQueue = new Set<string>();
  private batchTimeoutId = 0;
  
  // Bound handlers for resize events
  private boundHandleResizeMove: (event: MouseEvent) => void;
  private boundHandleResizeEnd: (event: MouseEvent) => void;
  
  // Bound handlers for drag events
  private boundHandleDragMove: (event: MouseEvent) => void;
  private boundHandleDragEnd: (event: MouseEvent) => void;
  
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
    
    // Bind resize handlers before setting up event listeners
    this.boundHandleResizeMove = this.handleResizeMove.bind(this);
    this.boundHandleResizeEnd = this.handleResizeEnd.bind(this);
    
    // Bind drag handlers
    this.boundHandleDragMove = this.handleDragMove.bind(this);
    this.boundHandleDragEnd = this.handleDragEnd.bind(this);
    
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
      this.renderHeader(state);
      
      // Use requestAnimationFrame to defer dimension reading until after browser paint
      requestAnimationFrame(() => {
        this.updateViewport(state);
        this.renderVisibleRows(state);
        this.applyOptimisticOperations(state.optimisticOperations);
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
        this.renderHeader(this.lastRenderState);
        // Also re-render visible rows to update cell positions
        this.renderVisibleRows(this.lastRenderState);
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
        this.renderHeader(this.lastRenderState);
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
    const viewport = this.domManager.getElement('viewport');
    const header = this.domManager.getElement('header');
    const body = this.domManager.getElement('body');
    
    // Scroll handling with simple throttling
    let isScrolling = false;
    
    viewport.addEventListener('scroll', () => {
      // Always sync header immediately for smooth horizontal scrolling
      header.style.transform = `translateX(-${viewport.scrollLeft}px)`;
      
      // Prevent multiple simultaneous updates
      if (isScrolling) return;
      
      isScrolling = true;
      
      requestAnimationFrame(() => {
        const scrollTop = viewport.scrollTop;
        const viewportHeight = viewport.clientHeight;
        const viewportWidth = viewport.clientWidth;
        const scrollLeft = viewport.scrollLeft;
        
        // Use VirtualGridManager to calculate viewport
        const newViewport = this.virtualGrid.calculateViewportFromScroll(
          scrollTop, 
          viewportHeight, 
          viewportWidth,
          scrollLeft
        );
        
        // Update our own viewport and re-render visible rows immediately
        if (this.lastRenderState) {
          const hasViewportChanged = this.virtualGrid.updateViewport(newViewport, this.lastRenderState.rows.length);
          if (hasViewportChanged) {
            this.renderVisibleRows(this.lastRenderState);
            
            // Don't notify render.complete here - let the main render handle it
            // This prevents duplicate render events during scroll
          }
        }
        
        this.options.onScroll?.(newViewport);
        
        // Allow next update
        isScrolling = false;
      });
    });
    
    // Let native scrolling handle wheel events - it naturally bubbles at boundaries
    
    // Cell interaction handlers - REMOVED to prevent duplicate events
    // All mouse events are now handled at the VibeGridX level
    // body.addEventListener('click', this.handleCellClick.bind(this));
    body.addEventListener('dblclick', this.handleCellDoubleClick.bind(this));
    // body.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Header interaction handlers
    header.addEventListener('click', this.handleHeaderClick.bind(this));
    
    // Column drag handlers - only the mousedown on header, not global listeners
    // Global listeners will be added dynamically when drag/resize starts
    header.addEventListener('mousedown', this.handleHeaderMouseDown.bind(this));
    
    // Make viewport focusable but don't add keyboard listener here
    // Keyboard events are handled at the VibeGridX component level to avoid duplication
    viewport.tabIndex = 0;
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
    
    // NOTE: Coordinate manager updates removed - now handled by coordinate actor
    // The TableMachine receives coordinate mappings from the coordinate actor
    // and provides them to the renderer via render state. This eliminates
    // the "hackery" of direct method calls and follows proper XState patterns.
    
    // Skip column configuration updates in render - should use initialize() instead
    // Column visibility and order are set during initialization or via dedicated methods
    
    try {
      // STEP 1: Render header
      const headerOnlyStart = performance.now();
      this.renderHeader(state);
      const headerOnlyTime = performance.now() - headerOnlyStart;
      
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
        this.renderVisibleRows(state);
        const rowsTime = performance.now() - rowsStart;
        console.log('🎨 AtomicTableRenderer: Visible rows rendered synchronously');
        
        // STEP 4: Apply optimistic operations
        const optimisticStart = performance.now();
        this.applyOptimisticOperations(state.optimisticOperations);
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
          this.renderVisibleRows(state);
          this.applyOptimisticOperations(state.optimisticOperations);
          
          
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
    const rowElement = this.domManager.getRowElement(row.id);
    if (!rowElement) {
      return;
    }
    
    const startTime = performance.now();
    
    // Update row content
    this.renderRowCells(row, rowElement);
    
    // Update row state
    rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
    
    const duration = performance.now() - startTime;
    if (duration > RENDER_TARGETS.CELL_UPDATE * 10) { // Warn if row update is slow
      console.log(`AtomicTableRenderer: Slow row update ${row.id} took ${duration.toFixed(2)}ms`);
    }
  }

  // NEW: Update multiple rows (but not the entire table)
  updateRows(rows: TableRow[]): void {
    const startTime = performance.now();
    
    rows.forEach(row => {
      const rowElement = this.domManager.getRowElement(row.id);
      if (rowElement) {
        this.renderRowCells(row, rowElement);
        rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
      }
    });
    
    const duration = performance.now() - startTime;
    if (duration > RENDER_TARGETS.CELL_UPDATE * rows.length) { // Warn if updates are slow
      console.log(`AtomicTableRenderer: Slow batch update - ${rows.length} rows took ${duration.toFixed(2)}ms`);
    }
  }
  
  setEditingCell(cellRef: CellRef | null): void {
    const oldEditing = this.editingCell;
    this.editingCell = cellRef;
    
    // Update old editing cell
    if (oldEditing) {
      const oldElement = this.getCellElement(oldEditing.rowId, oldEditing.columnId);
      if (oldElement) {
        oldElement.classList.remove(CSS_CLASSES.EDITING);
        oldElement.contentEditable = 'false';
      }
    }
    
    // Update new editing cell
    if (cellRef) {
      const newElement = this.getCellElement(cellRef.rowId, cellRef.columnId);
      if (newElement) {
        newElement.classList.add(CSS_CLASSES.EDITING);
        newElement.contentEditable = 'true';
        newElement.focus();
      }
    }
  }
  
  setSelectedCells(selectedCells: Set<string>): void {
    // Remove old selections
    this.selectedCells.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const element = this.getCellElement(rowId, columnId);
      element?.classList.remove(CSS_CLASSES.SELECTED);
    });
    
    // Add new selections
    this.selectedCells = new Set(selectedCells);
    this.selectedCells.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const element = this.getCellElement(rowId, columnId);
      element?.classList.add(CSS_CLASSES.SELECTED);
    });
  }
  
  setSelectedRows(selectedRows: Set<string>): void {
    this.selectedRows = new Set(selectedRows);
    
    // Update all visible row checkboxes and row styles
    this.rowElements.forEach((rowElement, rowId) => {
      const isSelected = this.selectedRows.has(rowId);
      
      // Update checkbox
      const checkbox = rowElement.querySelector('.vibegridx-row-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = isSelected;
      }
      
      // Update row style
      if (isSelected) {
        rowElement.classList.add('vibegridx-row-selected');
      } else {
        rowElement.classList.remove('vibegridx-row-selected');
      }
    });
    
    // Update header checkbox state if selection column is enabled
    if (this.columnManager.isSelectionColumnEnabled() && this.lastRenderState) {
      const headerCheckbox = this.domManager.getElement('header').querySelector('.vibegridx-header-checkbox') as HTMLInputElement;
      if (headerCheckbox) {
        const allSelected = this.selectedRows.size === this.lastRenderState.rows.length && this.lastRenderState.rows.length > 0;
        const someSelected = this.selectedRows.size > 0 && this.selectedRows.size < this.lastRenderState.rows.length;
        
        headerCheckbox.checked = allSelected;
        headerCheckbox.indeterminate = someSelected;
      }
    }
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
  
  private renderHeader(state: RenderState): void {
    const headerStartTime = performance.now();
    if (!state.rows.length) return;
    
    // STEP 1: Column preparation
    const step1Start = performance.now();
    const columnsToRender = state.columns && state.columns.length > 0
      ? state.columns
      : this.columnManager.getVisibleColumns().length > 0 
        ? this.columnManager.getVisibleColumns() 
        : Object.keys(state.rows[0].data).map(key => ({
            id: key,
            name: key,
            field: key,
            type: 'text' as const,
            width: 120,
            sortable: true
          }));
    const step1Time = performance.now() - step1Start;
    
    
    // STEP 2: Width calculation
    const step2Start = performance.now();
    const totalWidth = this.getTotalColumnsWidth();
    this.domManager.getElement('header').style.width = `${totalWidth}px`;
    const step2Time = performance.now() - step2Start;
    
    // STEP 3: Sort lookup creation
    const step3Start = performance.now();
    const sortState = (state as any).sortBy || [];
    const sortLookup = new Map();
    sortState.forEach((sort: any, index: number) => {
      sortLookup.set(sort.field, { direction: sort.direction, index });
    });
    const step3Time = performance.now() - step3Start;
    
    // STEP 4: Column filtering and offset calculation
    const step4Start = performance.now();
    const dataColumns = columnsToRender.filter(col => col.id !== '__selection');
    const columnOffsets: number[] = [];
    let runningOffset = 48; // Start after selection column
    dataColumns.forEach((column, index) => {
      columnOffsets[index] = runningOffset;
      const width = this.columnManager.getColumnWidth(column.id);
      runningOffset += width;
    });
    const step4Time = performance.now() - step4Start;
    
    // STEP 5: Clear existing header
    const step5Start = performance.now();
    this.domManager.getElement('header').innerHTML = '';
    const step5Time = performance.now() - step5Start;
    
    // STEP 6: Create selection header
    const step6Start = performance.now();
    const allSelected = this.selectedRows.size === state.rows.length && state.rows.length > 0;
    const someSelected = this.selectedRows.size > 0 && this.selectedRows.size < state.rows.length;
    
    const selectionHeader = document.createElement('div');
    selectionHeader.className = 'vibegridx-header-cell vibegridx-selection-header';
    selectionHeader.setAttribute('data-column', '__selection');
    selectionHeader.style.cssText = 'width: 48px; min-width: 48px; max-width: 48px; position: sticky; left: 0; z-index: 10; background: var(--background);';
    
    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'vibegridx-checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'vibegridx-header-checkbox';
    checkbox.checked = allSelected;
    checkbox.indeterminate = someSelected;
    
    const checkboxCustom = document.createElement('span');
    checkboxCustom.className = 'vibegridx-checkbox-custom';
    
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxCustom);
    selectionHeader.appendChild(checkboxWrapper);
    this.domManager.getElement('header').appendChild(selectionHeader);
    const step6Time = performance.now() - step6Start;
    
    // STEP 7: Create fragment and data columns
    const step7Start = performance.now();
    const fragment = document.createDocumentFragment();
    const step7aTime = performance.now() - step7Start;
    
    const step7bStart = performance.now();
    dataColumns.forEach((column, index) => {
      const columnStartTime = performance.now();
      
      const width = this.columnManager.getColumnWidth(column.id);
      const field = column.field || column.id;
      const sortInfo = sortLookup.get(field);
      
      const headerCell = document.createElement('div');
      headerCell.className = `vibegridx-header-cell${column.sortable !== false ? ' vibegridx-sortable' : ''}${sortInfo ? (sortInfo.direction === 'asc' ? ' sort-asc' : ' sort-desc') : ''}`;
      headerCell.setAttribute('data-column', column.id);
      headerCell.setAttribute('data-field', field);
      headerCell.style.cssText = `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
      
      const headerText = document.createElement('span');
      headerText.className = 'vibegridx-header-text';
      headerText.textContent = column.name || column.id;
      
      const sortIcon = document.createElement('span');
      sortIcon.className = 'vibegridx-sort-icon';
      sortIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${sortInfo?.direction === 'asc' ? '1' : '0.3'}"/><path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${sortInfo?.direction === 'desc' ? '1' : '0.3'}"/></svg>`;
      
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'vibegridx-resize-handle';
      resizeHandle.setAttribute('data-column', column.id);
      
      headerCell.appendChild(headerText);
      headerCell.appendChild(sortIcon);
      headerCell.appendChild(resizeHandle);
      fragment.appendChild(headerCell);
      
      const columnTime = performance.now() - columnStartTime;
      if (columnTime > 1) {
        console.log(`🐌 SLOW column creation: ${column.id} took ${columnTime.toFixed(2)}ms`);
      }
    });
    const step7bTime = performance.now() - step7bStart;
    
    // STEP 8: Append fragment to header
    const step8Start = performance.now();
    this.domManager.getElement('header').appendChild(fragment);
    const step8Time = performance.now() - step8Start;
    
    const totalHeaderTime = performance.now() - headerStartTime;
    
  }
  
  private renderVisibleRows(state: RenderState): void {
    const visibleRange = this.virtualGrid.getVisibleRange();
    console.log('🎨 AtomicTableRenderer: renderVisibleRows', {
      visibleRange,
      stateRowsLength: state.rows.length,
      sliceResult: state.rows.slice(visibleRange.start, visibleRange.end).length
    });
    const visibleRows = state.rows.slice(visibleRange.start, visibleRange.end);
    
    
    // Calculate dimensions
    const totalHeight = this.virtualGrid.getTotalHeight();
    const totalWidth = this.getTotalColumnsWidth();
    
    // PERFORMANCE FIX: Batch DOM style updates and remove nested RAF
    // Set virtual dimensions and viewport overflow together
    this.domManager.getElement('body').style.height = `${totalHeight}px`;
    this.domManager.getElement('body').style.width = `${totalWidth}px`;
    
    // Synchronously handle viewport overflow (no need for RAF)
    const maxScroll = totalHeight - this.domManager.getElement('viewport').clientHeight;
    if (maxScroll > 0) {
      this.domManager.getElement('viewport').style.overflowY = 'scroll';
    }
    
    // Only log when dimensions actually change
    if (totalHeight !== this.lastDimensions.height || totalWidth !== this.lastDimensions.width) {
      // PERFORMANCE: Removed expensive console.log
      this.lastDimensions = { height: totalHeight, width: totalWidth };
    }
    
    // Canvas overlay is already created in initializeDOM, no need to update its size
    // It will use viewport-based sizing instead of full scrollable area
    
    // PERFORMANCE DEBUG: Check if we have a fallback that's causing all rows to render
    let rowsToRender = visibleRows;
    if (visibleRows.length === 0 && state.rows.length > 0) {
      console.warn('PERFORMANCE ISSUE: visibleRows is empty! This will cause no rows to render.');
      console.warn('Total rows in state:', state.rows.length);
      console.warn('Visible range:', visibleRange);
      console.warn('VirtualGrid metrics:', this.virtualGrid.getMetrics());
      console.warn('Using fallback to render first 20 rows to prevent blank grid');
      
      // Emergency fallback to prevent blank grid
      rowsToRender = state.rows.slice(0, Math.min(20, state.rows.length));
      console.warn('Fallback rows count:', rowsToRender.length);
    }
    
    // Clear existing rows that are no longer visible
    this.rowElements.forEach((element, rowId) => {
      if (!rowsToRender.find(row => row.id === rowId)) {
        element.remove();
        this.rowElements.delete(rowId);
      }
    });
    
    // PERFORMANCE FIX: Batch new row creation to reduce DOM manipulation
    const fragment = document.createDocumentFragment();
    const newRowElements: Array<{ element: HTMLElement; rowId: string }> = [];
    
    // Pre-create new rows in fragment (batched DOM insertion)
    rowsToRender.forEach((row, index) => {
      const absoluteIndex = visibleRange.start + index;
      
      
      let rowElement = this.domManager.getRowElement(row.id);
      if (!rowElement) {
        rowElement = document.createElement('div');
        rowElement.className = CSS_CLASSES.ROW;
        rowElement.dataset.rowId = row.id;
        newRowElements.push({ element: rowElement, rowId: row.id });
        fragment.appendChild(rowElement);
      }
      
      // Position and update row content
      this.updateRowElement(row, rowElement, absoluteIndex);
    });
    
    // Single DOM append for all new rows
    if (newRowElements.length > 0) {
      this.domManager.getElement('body').appendChild(fragment);
      
      // Register new elements
      newRowElements.forEach(({ element, rowId }) => {
        this.rowElements.set(rowId, element);
      });
    }
  }
  
  private updateRowElement(row: TableRow, rowElement: HTMLElement, index: number): void {
    // Position row
    const top = this.virtualGrid.getRowTop(index);
    rowElement.style.position = 'absolute';
    rowElement.style.top = `${top}px`;
    rowElement.style.left = '0px';
    
    // Calculate total width from columns
    const totalWidth = this.getTotalColumnsWidth();
    rowElement.style.width = `${totalWidth}px`;
    rowElement.style.height = `${this.virtualGrid.getRowHeight()}px`;
    
    
    // Update row content
    this.renderRowCells(row, rowElement);
  }
  
  private renderRow(row: TableRow, index: number): void {
    let rowElement = this.domManager.getRowElement(row.id);
    
    if (!rowElement) {
      rowElement = document.createElement('div');
      rowElement.className = CSS_CLASSES.ROW;
      rowElement.dataset.rowId = row.id;
      this.domManager.getElement('body').appendChild(rowElement);
      this.rowElements.set(row.id, rowElement);
    }
    
    // Use optimized update method
    this.updateRowElement(row, rowElement, index);
    
    // Apply row state styling
    rowElement.style.borderBottom = '1px solid var(--border)';
    rowElement.style.boxSizing = 'border-box';
    rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
  }
  
  private renderRowCells(row: TableRow, rowElement: HTMLElement): void {
    // PERFORMANCE FIX: Use DOM elements instead of innerHTML for massive performance boost
    
    
    // IMPORTANT: Use columns from render state if available to ensure correct order
    const stateColumns = this.lastRenderState?.columns;
    const columnsToRender = stateColumns && stateColumns.length > 0
      ? stateColumns.filter(col => col.id !== '__selection')
      : this.columnManager.getVisibleColumns().length > 0 
        ? this.columnManager.getDataColumns()
        : Object.keys(row.data).map(key => ({
            id: key,
            name: key,
            field: key,
            type: 'text' as const,
            width: 120
          }));
    
    
    // Clear existing content efficiently
    rowElement.textContent = '';
    
    // Create document fragment for batched insertion
    const fragment = document.createDocumentFragment();
    
    // Add selection checkbox cell (always included)
    {
      const cellKey = `${row.id}:__selection`;
      const isRowSelected = this.selectedRows.has(row.id);
      
      const cell = document.createElement('div');
      cell.className = 'vibegridx-cell vibegridx-selection-cell';
      cell.setAttribute('data-row-id', row.id);
      cell.setAttribute('data-column-id', '__selection');
      cell.setAttribute('data-cell-key', cellKey);
      cell.setAttribute('role', 'gridcell');
      
      // Style selection cell
      Object.assign(cell.style, {
        position: 'absolute',
        left: '0',
        width: '48px',
        height: `${this.rowHeight}px`,
        borderRight: '1px solid var(--border)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: '5',
        background: 'var(--background)'
      });
      
      // Create checkbox wrapper
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      
      const label = document.createElement('label');
      label.className = 'vibegridx-checkbox-wrapper';
      label.setAttribute('data-row-id', row.id);
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'vibegridx-row-checkbox';
      checkbox.setAttribute('data-row-id', row.id);
      checkbox.checked = isRowSelected;
      
      const span = document.createElement('span');
      span.className = 'vibegridx-checkbox-custom';
      
      label.appendChild(checkbox);
      label.appendChild(span);
      wrapper.appendChild(label);
      cell.appendChild(wrapper);
      fragment.appendChild(cell);
      
      this.cellElements.set(cellKey, cell);
    }
    
    // Add data cells
    columnsToRender.forEach((column, index) => {
      const cellKey = `${row.id}:${column.id}`;
      const value = row.data[column.field || column.id];
      const width = this.columnManager.getColumnWidth(column.id);
      
      // Calculate offset based on columns being rendered, not internal state
      let calculatedOffset = 48; // Start after selection column
      for (let i = 0; i < index; i++) {
        const prevColumn = columnsToRender[i];
        const prevWidth = this.columnManager.getColumnWidth(prevColumn.id);
        calculatedOffset += prevWidth;
      }
      const xOffset = calculatedOffset;
      
      
      
      // Create cell element
      const cell = document.createElement('div');
      cell.className = CSS_CLASSES.CELL;
      cell.setAttribute('data-row-id', row.id);
      cell.setAttribute('data-column-id', column.id);
      cell.setAttribute('data-cell-key', cellKey);
      cell.setAttribute('role', 'gridcell');
      
      // Apply state classes
      const isSelected = this.selectedCells.has(cellKey);
      const isEditing = this.editingCell?.rowId === row.id && this.editingCell?.columnId === column.id;
      const isDirty = row.metadata.isDirty || false;
      
      if (isSelected) cell.classList.add(CSS_CLASSES.SELECTED);
      if (isEditing) cell.classList.add(CSS_CLASSES.EDITING);
      if (isDirty) cell.classList.add(CSS_CLASSES.DIRTY);
      
      // Style cell
      Object.assign(cell.style, {
        position: 'absolute',
        left: `${xOffset}px`,
        width: `${width}px`,
        height: `${this.rowHeight}px`,
        borderRight: '1px solid var(--border)',
        boxSizing: 'border-box',
        overflow: 'hidden'
      });
      
      // Create content using CellRenderingPipeline
      const content = CellRenderingPipeline.createCellContent(value, column, row.data);
      cell.appendChild(content);
      fragment.appendChild(cell);
      
      this.cellElements.set(cellKey, cell);
    });
    
    // Single DOM insertion
    rowElement.appendChild(fragment);
    
    // PERFORMANCE FIX: Event listeners are now handled via event delegation in the renderer
    // No need to add individual listeners to each checkbox - parent container handles all events
  }
  
  private lastSelectedRowId: string | null = null;
  
  // REMOVED: updateSelections - handled by Canvas Overlay Manager
  
  private applyOptimisticOperations(operations: Map<string, OptimisticOperation> | undefined): void {
    if (!operations || operations.size === 0) {
      return;
    }
    
    operations.forEach(operation => {
      const cellElement = this.getCellElement(operation.entityId, operation.field);
      if (cellElement) {
        cellElement.classList.add(CSS_CLASSES.OPTIMISTIC);
        
        // Visual feedback for optimistic updates
        cellElement.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        cellElement.style.borderLeft = '3px solid rgb(59, 130, 246)';
      }
    });
  }
  
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
  // EVENT HANDLERS
  // ====================================
  
  private handleCellClick(event: MouseEvent): void {
    const cellElement = (event.target as Element).closest(`.${CSS_CLASSES.CELL}`) as HTMLElement;
    
    if (!cellElement) return;
    
    const rowId = cellElement.dataset.rowId!;
    const columnId = cellElement.dataset.columnId!;
    
    // Get the row element to find its position
    const rowElement = cellElement.closest(`.${CSS_CLASSES.ROW}`) as HTMLElement;
    const rowTop = rowElement ? parseInt(rowElement.style.top || '0', 10) : -1;
    const rowIndex = rowTop >= 0 ? Math.floor(rowTop / 40) : -1; // 40px row height
    
    console.log('[AtomicTableRenderer] Cell clicked:', {
      rowId,
      columnId,
      element: cellElement,
      cellText: cellElement.textContent?.trim(),
      rowElement,
      rowTop,
      calculatedRowIndex: rowIndex,
      viewport: {
        scrollTop: this.domManager.getElement('viewport').scrollTop,
        visibleRange: this.virtualGrid.getVisibleRange()
      }
    });
    
    // Ensure viewport has focus for keyboard events
    this.domManager.getElement('viewport').focus();
    
    this.options.onCellClick?.(rowId, columnId, event);
  }
  
  private handleCellDoubleClick(event: MouseEvent): void {
    const cellElement = (event.target as Element).closest(`.${CSS_CLASSES.CELL}`) as HTMLElement;
    if (!cellElement) return;
    
    const rowId = cellElement.dataset.rowId!;
    const columnId = cellElement.dataset.columnId!;
    
    this.options.onCellDoubleClick?.(rowId, columnId, event);
  }
  
  private handleMouseDown(event: MouseEvent): void {
    // Prevent text selection during drag
    event.preventDefault();
    
    // Let parent component handle drag selection through proper event flow
    // The renderer should only be responsible for rendering, not selection logic
  }
  
  // Column drag state
  private dragState: {
    isDragging: boolean;
    draggedColumnId: string | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    dragPreview: HTMLElement | null;
    dropIndicator: HTMLElement | null;
  } = {
    isDragging: false,
    draggedColumnId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    dragPreview: null,
    dropIndicator: null
  };

  // Resize state tracking (preview handled by overlay)
  private isResizing: boolean = false;
  
  private handleHeaderMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    const sortIcon = target.closest('.vibegridx-sort-icon');
    const resizeHandle = target.closest('.vibegridx-resize-handle');
    
    // Handle resize
    if (resizeHandle) {
      event.preventDefault();
      const columnId = (resizeHandle as HTMLElement).dataset.column;
      
      if (columnId) {
        const currentWidth = this.columnManager.getColumnWidth(columnId);
        
        // Send resize start event to XState
        this.options.onColumnResizeStart?.(columnId, event.clientX, currentWidth);
        
        // Set resizing state
        this.isResizing = true;
        
        // Add resizing class to container
        this.domManager.getElement('container').classList.add('vibegridx-resizing');
        
        // Add global mouse event listeners using bound handlers
        document.addEventListener('mousemove', this.boundHandleResizeMove);
        document.addEventListener('mouseup', this.boundHandleResizeEnd);
      }
      return;
    }
    
    // Don't start drag if clicking on sort icon or selection column
    if (headerCell && !sortIcon && !resizeHandle) {
      event.preventDefault();
      
      const columnId = headerCell.dataset.column;
      
      // Don't allow dragging the selection column
      if (columnId === '__selection') {
        return;
      }
      
      if (columnId) {
        // Calculate offset from click position to header cell position
        const headerRect = headerCell.getBoundingClientRect();
        const offsetX = event.clientX - headerRect.left;
        const offsetY = event.clientY - headerRect.top;
        
        // Create drag preview
        const columnText = headerCell.querySelector('.vibegridx-header-text')?.textContent || columnId;
        const dragPreview = document.createElement('div');
        dragPreview.className = 'vibegridx-drag-preview';
        dragPreview.textContent = columnText;
        // Position preview so text stays under cursor
        dragPreview.style.left = `${event.clientX - offsetX}px`;
        dragPreview.style.top = `${event.clientY - offsetY}px`;
        document.body.appendChild(dragPreview);
        
        // Create drop indicator
        const dropIndicator = document.createElement('div');
        dropIndicator.className = 'vibegridx-drop-indicator';
        // Append to header so it scrolls with columns
        this.domManager.getElement('header').appendChild(dropIndicator);
        
        this.dragState = {
          isDragging: true,
          draggedColumnId: columnId,
          startX: event.clientX,
          startY: event.clientY,
          offsetX,
          offsetY,
          dragPreview,
          dropIndicator
        };
        
        // Add dragging class to header cell
        headerCell.classList.add('vibegridx-dragging');
        
        // Add drag event listeners
        document.addEventListener('mousemove', this.boundHandleDragMove);
        document.addEventListener('mouseup', this.boundHandleDragEnd);
        
        // Notify parent component
        this.options.onColumnDragStart?.(columnId, event.clientX, event.clientY);
      }
    }
  }
  

  private handleDragMove(event: MouseEvent): void {
    // Skip if we're resizing
    if (this.isResizing) return;
    
    if (!this.dragState.isDragging || !this.dragState.dragPreview) return;
    
    event.preventDefault();
    
    // Update drag preview position maintaining the offset
    this.dragState.dragPreview.style.left = `${event.clientX - this.dragState.offsetX}px`;
    this.dragState.dragPreview.style.top = `${event.clientY - this.dragState.offsetY}px`;
    
    // Calculate drop position and update displacement
    const headerRect = this.domManager.getElement('header').getBoundingClientRect();
    const headerViewportRect = this.domManager.getElement('headerViewport').getBoundingClientRect();
    
    // Since the header is transformed, we need to calculate the position differently
    // The header's getBoundingClientRect() gives us the transformed position
    // We need to get the mouse position relative to the header viewport, then add scroll
    const relativeToViewport = event.clientX - headerViewportRect.left;
    const relativeX = relativeToViewport + this.domManager.getElement('viewport').scrollLeft;
    
    // Find target position and update column displacement
    let targetIndex = 0;
    let accumulatedWidth = 48; // Start after selection column (48px)
    let dropX = 48; // Initial drop position after selection column
    
    // Clear all displacement classes
    this.domManager.getElement('header').querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
      htmlCell.style.removeProperty('--drag-offset');
    });
    
    // Find current position of dragged column (excluding selection column)
    const dataColumns = this.columnManager.getDataColumns();
    const draggedIndex = dataColumns.findIndex(col => col.id === this.dragState.draggedColumnId);
    
    // Find where the mouse is in relation to columns
    let foundColumn = false;
    for (let i = 0; i < dataColumns.length; i++) {
      const column = dataColumns[i];
      const columnWidth = this.columnManager.getColumnWidth(column.id);
      const columnStart = accumulatedWidth;
      const columnEnd = accumulatedWidth + columnWidth;
      
      // Check if mouse is within this column's bounds
      if (relativeX >= columnStart && relativeX < columnEnd) {
        // Determine if we're in the left or right half of the column
        const columnMidPoint = columnStart + columnWidth / 2;
        
        if (relativeX < columnMidPoint) {
          // Mouse is in left half - drop before this column
          targetIndex = i;
          dropX = columnStart;
        } else {
          // Mouse is in right half - drop after this column
          targetIndex = i + 1;
          dropX = columnEnd;
        }
        
        foundColumn = true;
        break;
      }
      
      accumulatedWidth += columnWidth;
    }
    
    // Handle case where mouse is beyond all columns
    if (!foundColumn) {
      // Mouse is past all columns
      targetIndex = dataColumns.length;
      dropX = accumulatedWidth;
    }
    
    // Get the width of the dragged column
    const draggedColumn = dataColumns[draggedIndex];
    const draggedWidth = this.columnManager.getColumnWidth(draggedColumn.id);
    
    // Adjust target index to account for removing the dragged column
    let adjustedTargetIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      adjustedTargetIndex = targetIndex - 1;
    }
    
    // Apply displacement classes with proper offset (only to data columns, not selection column)
    dataColumns.forEach((column, index) => {
      const cell = this.domManager.getElement('header').querySelector(`[data-column="${column.id}"]`) as HTMLElement;
      if (cell && column.id !== this.dragState.draggedColumnId) {
        // Moving right: columns between old and new position shift left
        if (draggedIndex < adjustedTargetIndex && index > draggedIndex && index <= adjustedTargetIndex) {
          cell.classList.add('vibegridx-will-move-left');
          cell.style.setProperty('--drag-offset', `-${draggedWidth}px`);
        } 
        // Moving left: columns between new and old position shift right
        else if (draggedIndex > targetIndex && index >= targetIndex && index < draggedIndex) {
          cell.classList.add('vibegridx-will-move-right');
          cell.style.setProperty('--drag-offset', `${draggedWidth}px`);
        }
      }
    });
    
    // Update drop indicator position
    if (this.dragState.dropIndicator) {
      this.dragState.dropIndicator.style.left = `${dropX}px`;
    }
    
    // Don't send drag move events to XState - visual feedback is handled entirely in DOM
    // this.options.onColumnDragMove?.(event.clientX, event.clientY);
  }
  
  private handleDragEnd(event: MouseEvent): void {
    // Skip if we're resizing
    if (this.isResizing) return;
    
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    // Remove drag preview
    if (this.dragState.dragPreview) {
      this.dragState.dragPreview.remove();
    }
    
    // Remove drop indicator
    if (this.dragState.dropIndicator) {
      this.dragState.dropIndicator.remove();
    }
    
    // Remove all displacement classes
    this.domManager.getElement('header').querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-dragging');
      htmlCell.style.removeProperty('--drag-offset');
    });
    
    // Calculate target index based on mouse position
    const headerRect = this.domManager.getElement('header').getBoundingClientRect();
    const headerViewportRect = this.domManager.getElement('headerViewport').getBoundingClientRect();
    
    // Same calculation as in handleDragMove
    const relativeToViewport = event.clientX - headerViewportRect.left;
    const relativeX = relativeToViewport + this.domManager.getElement('viewport').scrollLeft;
    
    // Find target column index, excluding selection column
    let targetIndex = 0;
    let accumulatedWidth = 48; // Start with selection column width
    
    // Get data columns only (excluding selection column)
    const dataColumns = this.columnManager.getDataColumns();
    
    for (let i = 0; i < dataColumns.length; i++) {
      const columnWidth = this.columnManager.getColumnWidth(dataColumns[i].id);
      if (relativeX > accumulatedWidth + columnWidth / 2) {
        targetIndex = i + 1;
      }
      accumulatedWidth += columnWidth;
    }
    
    // Reset drag state
    this.dragState = {
      isDragging: false,
      draggedColumnId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      dragPreview: null,
      dropIndicator: null
    };
    
    // Remove drag event listeners
    document.removeEventListener('mousemove', this.boundHandleDragMove);
    document.removeEventListener('mouseup', this.boundHandleDragEnd);
    
    // Notify parent component
    this.options.onColumnDragEnd?.(targetIndex);
  }
  
  private handleHeaderClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    const resizeHandle = target.closest('.vibegridx-resize-handle');
    
    // Don't process clicks on resize handles or if no header cell found
    if (!headerCell || resizeHandle) return;
    
    const columnId = headerCell.dataset.column;
    
    // Skip selection column
    if (columnId === '__selection') return;
    
    // Check if column is sortable
    if (headerCell.classList.contains('vibegridx-sortable') && columnId) {
      // Handle column click for sorting
      console.log('[AtomicTableRenderer] Column header clicked for sorting:', columnId);
      this.options.onColumnClick?.(columnId, event);
    }
  }

  // Column resize handlers - Defined as regular methods and bound in constructor
  private handleResizeMove(event: MouseEvent): void {
    console.log('[AtomicTableRenderer] handleResizeMove called', {
      clientX: event.clientX,
      isResizing: this.isResizing
    });
    
    if (!this.isResizing) {
      console.warn('[AtomicTableRenderer] Not in resizing state, skipping');
      return;
    }
    
    // Send move event to XState which will handle throttling
    this.options.onColumnResizeMove?.(event.clientX);
  }

  private handleResizeEnd(event: MouseEvent): void {
    console.log('[AtomicTableRenderer] handleResizeEnd called');
    
    // Clear resizing state
    this.isResizing = false;
    
    // Remove resizing class
    this.domManager.getElement('container').classList.remove('vibegridx-resizing');
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.boundHandleResizeMove);
    document.removeEventListener('mouseup', this.boundHandleResizeEnd);
    
    // Send end event to XState
    this.options.onColumnResizeEnd?.();
  }

  
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
        rows: this.rowElements.size,
        cells: this.cellElements.size
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
    
    this.rowElements.clear();
    this.cellElements.clear();
    this.selectedCells.clear();
    this.updateQueue.clear();
    
    this.domManager.getElement('container').innerHTML = '';
  }
}