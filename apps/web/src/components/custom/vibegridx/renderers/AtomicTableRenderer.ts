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
import { 
  renderText, 
  renderNumber, 
  renderDate, 
  renderBoolean, 
  renderEnum,
  renderRelationship,
  type RelationshipData
} from './fast-renderers';

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
// VIRTUAL GRID MANAGER
// ====================================

class VirtualGridManager {
  private viewport: ViewportInfo;
  private totalRows: number;
  private rowHeight: number;
  private visibleRange: { start: number; end: number };
  
  constructor(initialViewport: ViewportInfo) {
    this.viewport = initialViewport;
    this.totalRows = 0;
    this.rowHeight = initialViewport.itemHeight;
    this.visibleRange = { start: 0, end: 0 };
  }
  
  updateViewport(viewport: ViewportInfo, totalRows: number): boolean {
    const oldRange = { ...this.visibleRange };
    
    this.viewport = viewport;
    this.totalRows = totalRows;
    this.rowHeight = viewport.itemHeight;
    
    // Calculate visible range with buffer
    const bufferRows = 5;
    
    // Always try to render a few extra rows for smooth scrolling
    // But ensure we don't go beyond the actual data
    this.visibleRange = {
      start: Math.max(0, viewport.start - bufferRows),
      end: Math.min(totalRows, viewport.end + bufferRows)
    };
    
    // Return true if range changed
    return oldRange.start !== this.visibleRange.start || 
           oldRange.end !== this.visibleRange.end;
  }
  
  isRowVisible(index: number): boolean {
    return index >= this.visibleRange.start && index < this.visibleRange.end;
  }
  
  getVisibleRange(): { start: number; end: number } {
    return { ...this.visibleRange };
  }
  
  getRowTop(index: number): number {
    // Since we use box-sizing: border-box, borders are included in row height
    return index * this.rowHeight;
  }
  
  getTotalHeight(): number {
    // Calculate base height for all rows
    const baseHeight = this.totalRows * this.rowHeight;
    
    // Add extra space at the bottom to ensure the last row is never cut off
    // This needs to be at least one row height to guarantee full visibility
    const bottomPadding = this.rowHeight;
    
    return Math.max(0, baseHeight + bottomPadding);
  }
  
  getRowHeight(): number {
    return this.rowHeight;
  }
}

// ====================================
// ATOMIC TABLE RENDERER
// ====================================

export class AtomicTableRenderer {
  private container: HTMLElement;
  private table: HTMLElement;
  private headerViewport: HTMLElement;
  private header: HTMLElement;
  private body: HTMLElement;
  private viewport: HTMLElement;
  
  private virtualGrid: VirtualGridManager;
  private options: RendererOptions;
  
  // Performance tracking
  private renderStartTime = 0;
  private lastRenderTime = 0;
  private frameId = 0;
  private lastDimensions = { height: 0, width: 0 };
  
  // State caches
  private rowElements = new Map<string, HTMLElement>();
  private cellElements = new Map<string, HTMLElement>(); // "rowId:columnId" -> element
  private selectedCells = new Set<string>();
  private selectedRows = new Set<string>(); // For checkbox selection
  private editingCell: CellRef | null = null;
  private lastRenderState: RenderState | null = null;
  
  // Column configuration
  private columns: Column[] = [];
  private columnVisibility: Record<string, boolean> = {};
  private visibleColumns: Column[] = [];
  private dimensionManager: ColumnDimensionManager | null = null;
  private coordinateManager: any = null; // VibeGridXCoordinateManager
  private rowHeight = 40; // Default row height
  private relationshipData: any = {}; // Relationship data for lookups
  private enableSelectionColumn = false; // Whether to show selection column
  
  // Batch update queue
  private updateQueue = new Set<string>();
  private batchTimeoutId = 0;
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.dimensionManager = options.dimensionManager || null;
    this.coordinateManager = options.coordinateManager || null;
    this.relationshipData = options.relationshipData || {};
    this.enableSelectionColumn = options.enableSelectionColumn || false;
    
    // Set columns if provided
    if (options.columns) {
      this.setColumns(options.columns);
    }
    
    // Use configured row height or default
    this.rowHeight = options.cellHeight || 40;
    
    this.virtualGrid = new VirtualGridManager({
      start: 0,
      end: 50,
      height: 400,
      scrollTop: 0,
      itemHeight: this.rowHeight
    });
    
    this.container = options.container;
    this.initializeDOM();
    this.setupEventListeners();
  }
  
  // ====================================
  // INITIALIZATION
  // ====================================
  
  private initializeDOM() {
    this.container.innerHTML = '';
    this.container.className = CSS_CLASSES.TABLE;
    
    // Create table structure
    this.table = document.createElement('div');
    this.table.className = 'vibegridx-table-wrapper';
    
    // Create header viewport for synchronized horizontal scrolling
    this.headerViewport = document.createElement('div');
    this.headerViewport.className = 'vibegridx-header-viewport';
    this.headerViewport.style.overflow = 'hidden';
    this.headerViewport.style.position = 'relative';
    
    this.header = document.createElement('div');
    this.header.className = CSS_CLASSES.HEADER;
    this.header.style.position = 'relative';
    this.header.style.whiteSpace = 'nowrap';
    
    this.headerViewport.appendChild(this.header);
    
    this.viewport = document.createElement('div');
    this.viewport.className = 'vibegridx-viewport';
    this.viewport.style.overflow = 'auto';
    this.viewport.style.position = 'relative';
    this.viewport.style.flex = '1';
    this.viewport.style.minHeight = '0';
    
    this.body = document.createElement('div');
    this.body.className = CSS_CLASSES.BODY;
    this.body.style.position = 'relative';
    
    // Create body first
    this.viewport.appendChild(this.body);
    
    // Pre-create canvas overlay container for immediate initialization
    const canvasOverlay = document.createElement('div');
    canvasOverlay.className = 'vibegridx-canvas-overlay-container';
    canvasOverlay.style.position = 'absolute';
    canvasOverlay.style.top = '0';
    canvasOverlay.style.left = '0';
    canvasOverlay.style.width = '100%';  // Cover the full content width
    canvasOverlay.style.height = '100%'; // Cover the full content height
    canvasOverlay.style.pointerEvents = 'none'; // Canvas is display only, DOM cells handle events
    canvasOverlay.style.zIndex = '100';  // Higher z-index to ensure it's on top
    this.body.appendChild(canvasOverlay);
    
    // Canvas overlay will be added to body after it has content
    this.table.appendChild(this.headerViewport);
    this.table.appendChild(this.viewport);
    this.container.appendChild(this.table);
    
    // Immediately notify parent that canvas container is ready
    if (this.options.onCanvasContainerReady) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.options.onCanvasContainerReady!(canvasOverlay);
      });
    }
  }
  
  // Set or update columns
  setColumns(columns: Column[]): void {
    this.columns = columns;
    this.updateVisibleColumns();
    // Dimension manager will be set separately via setDimensionManager
  }

  // Set or update column visibility
  setColumnVisibility(visibility: Record<string, boolean>): void {
    this.columnVisibility = visibility;
    this.updateVisibleColumns();
    
    // Update dimensions without triggering full re-render to avoid infinite loop
    this.updateHeaderDimensions();
  }
  
  // Initialize renderer with complete configuration - single render
  initialize(state: RenderState): void {
    // Initialize with render state
    
    try {
      // Set all configuration at once without triggering updates
      if (state.columnVisibility) {
        this.columnVisibility = state.columnVisibility;
      }
      
      if (state.columnOrder && state.columnOrder.length > 0) {
        this.applyColumnOrder(state.columnOrder);
      }
      
      if (state.columns && state.columns.length > 0) {
        this.columns = state.columns;
      }
      
      // Update virtual grid with row count first
      if (this.virtualGrid && typeof this.virtualGrid.setRowCount === 'function') {
        this.virtualGrid.setRowCount(state.rows.length);
      }
      
      // NOTE: Coordinate manager updates removed - now handled by coordinate actor
      // The TableMachine receives coordinate mappings from the coordinate actor
      // and provides them to the renderer via render state. This eliminates
      // the "hackery" of direct method calls and follows proper XState patterns.
      
      // Single update and direct render without column reconfiguration
      this.updateVisibleColumns();
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
  
  // Apply column order without triggering updates (for batch operations)
  private applyColumnOrder(order: string[]): void {
    const orderedColumns: Column[] = [];
    
    // First pass: add columns in the specified order
    for (const columnId of order) {
      const column = this.columns.find(c => c.id === columnId);
      if (column) {
        orderedColumns.push(column);
      }
    }
    
    // Second pass: add any remaining columns not in the order
    for (const column of this.columns) {
      if (!order.includes(column.id)) {
        orderedColumns.push(column);
      }
    }
    
    this.columns = orderedColumns;
  }
  
  setColumnOrder(order: string[]): void {
    console.log('[AtomicTableRenderer] Setting column order:', order);
    this.applyColumnOrder(order);
    this.updateVisibleColumns();
    this.updateHeaderDimensions();
  }

  private getLastRenderState(): RenderState | null {
    return this.lastRenderState;
  }
  
  // Update the list of visible columns based on visibility settings
  private updateVisibleColumns(): void {
    this.visibleColumns = this.columns.filter(column => {
      // Column is visible if not explicitly hidden
      return this.columnVisibility[column.id] !== false;
    });
  }

  // Update header dimensions without full re-render
  private updateHeaderDimensions(): void {
    if (this.header && this.visibleColumns.length > 0) {
      const totalWidth = this.getTotalColumnsWidth();
      this.header.style.width = `${totalWidth}px`;
      
      // Update dimension manager with visible columns
      if (this.dimensionManager) {
        this.dimensionManager.setColumns(this.visibleColumns);
      }
      
      // Re-render header content to show/hide columns
      if (this.lastRenderState) {
        this.renderHeader(this.lastRenderState);
        // Also re-render visible rows to update cell positions
        this.renderVisibleRows(this.lastRenderState);
      }
    }
  }
  
  // Set or update relationship data
  setRelationshipData(relationshipData: any): void {
    this.relationshipData = relationshipData || {};
    // Trigger re-render if we have existing data
    if (this.lastRenderState) {
      this.render(this.lastRenderState);
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
        rendererColumns: this.visibleColumns.map(c => c.id)
      });
      
      // Update renderer's visible columns to match coordinate manager
      this.visibleColumns = coordinateColumnIds.map(id => {
        return this.columns.find(col => col.id === id) || { id, name: id, field: id, width: 120 };
      }).filter(Boolean);
      
      console.log('AtomicTableRenderer: Updated visible columns', {
        newVisibleColumns: this.visibleColumns.map(c => c.id)
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
  
  // Get total width of all visible columns
  private getTotalColumnsWidth(): number {
    if (!this.dimensionManager) return 0;
    
    // Calculate total width based on visible columns only
    let totalWidth = 0;
    
    // Selection column is always included
    totalWidth += 48; // Fixed width for selection column
    
    this.visibleColumns.forEach(column => {
      totalWidth += this.dimensionManager?.getColumnWidth(column.id) || column.width || 120;
    });
    
    return totalWidth;
  }
  
  // Get column offset position for visible columns only
  private getColumnOffset(columnId: string): number {
    if (!this.dimensionManager) return 0;
    
    // Calculate offset based on visible columns that come before this column
    let offset = 0;
    
    // Selection column is always included and goes first
    offset += 48; // Fixed width for selection column
    
    for (const column of this.visibleColumns) {
      if (column.id === columnId) {
        break;
      }
      const columnWidth = this.dimensionManager.getColumnWidth(column.id) || column.width || 120;
      offset += columnWidth;
    }
    
    
    return offset;
  }
  
  private setupEventListeners() {
    // Scroll handling with simple throttling
    let isScrolling = false;
    
    this.viewport.addEventListener('scroll', () => {
      // Always sync header immediately for smooth horizontal scrolling
      this.header.style.transform = `translateX(-${this.viewport.scrollLeft}px)`;
      
      // Prevent multiple simultaneous updates
      if (isScrolling) return;
      
      isScrolling = true;
      
      requestAnimationFrame(() => {
        const rowHeight = this.virtualGrid.getRowHeight();
        const scrollTop = this.viewport.scrollTop;
        const viewportHeight = this.viewport.clientHeight;
        
        // Calculate visible rows more accurately
        const calculatedStart = Math.floor(scrollTop / rowHeight);
        // Calculate how many rows fit in viewport, ensuring we always show enough
        const visibleRowCount = Math.ceil(viewportHeight / rowHeight);
        // Add 1 extra row to ensure smooth scrolling and full visibility
        const calculatedEnd = calculatedStart + visibleRowCount + 1;
        
        // Cap to actual row count
        const cappedEnd = this.lastRenderState ? Math.min(calculatedEnd, this.lastRenderState.rows.length) : calculatedEnd;
        
        const newViewport: ViewportInfo = {
          start: calculatedStart,
          end: cappedEnd,
          height: viewportHeight,
          width: this.viewport.clientWidth,
          scrollTop: scrollTop,
          scrollLeft: this.viewport.scrollLeft,
          itemHeight: rowHeight
        };
        
        // Update our own viewport and re-render visible rows immediately
        if (this.lastRenderState) {
          const hasViewportChanged = this.virtualGrid.updateViewport(newViewport, this.lastRenderState.rows.length);
          if (hasViewportChanged) {
            this.renderVisibleRows(this.lastRenderState);
            
            // Don't notify render.complete here - let the main render handle it
            // This prevents duplicate render events during scroll
            // this.options.onStateChange?.({
            //   type: 'render.complete',
            //   renderTime: 0,
            //   rowCount: this.lastRenderState.rows.length,
            //   visibleRange: this.virtualGrid.getVisibleRange()
            // });
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
    // this.body.addEventListener('click', this.handleCellClick.bind(this));
    this.body.addEventListener('dblclick', this.handleCellDoubleClick.bind(this));
    // this.body.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Header interaction handlers
    this.header.addEventListener('click', this.handleHeaderClick.bind(this));
    
    // Column drag handlers
    this.header.addEventListener('mousedown', this.handleHeaderMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    
    // Make viewport focusable but don't add keyboard listener here
    // Keyboard events are handled at the VibeGridX component level to avoid duplication
    this.viewport.tabIndex = 0;
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
    console.log('[AtomicTableRenderer] render called with state version:', state.version);
    this.renderStartTime = performance.now();
    
    // Rows are already pre-sorted by render state extractor
    this.lastRenderState = state;
    
    // Update columns if provided in state
    if (state.columns && state.columns.length > 0) {
      this.setColumns(state.columns);
    }
    
    // NOTE: Coordinate manager updates removed - now handled by coordinate actor
    // The TableMachine receives coordinate mappings from the coordinate actor
    // and provides them to the renderer via render state. This eliminates
    // the "hackery" of direct method calls and follows proper XState patterns.
    
    // Skip column configuration updates in render - should use initialize() instead
    // Column visibility and order are set during initialization or via dedicated methods
    
    try {
      // Batch all DOM writes together before reading dimensions
      this.renderHeader(state);
      
      // Use requestAnimationFrame to defer dimension reading until after browser paint
      requestAnimationFrame(() => {
        this.updateViewport(state);
        this.renderVisibleRows(state);
        this.applyOptimisticOperations(state.optimisticOperations);
        
        // Move performance timing to RAF callback
        this.lastRenderTime = performance.now() - this.renderStartTime;
        
        if (this.lastRenderTime > RENDER_TARGETS.INITIAL_RENDER) {
          console.warn(`AtomicTableRenderer: Slow render: ${this.lastRenderTime.toFixed(2)}ms for ${state.rows.length} rows`);
        }
        
        // Notify that render is complete with performance metrics
        this.options.onStateChange?.({
          type: 'render.complete',
          renderTime: this.lastRenderTime,
          rowCount: state.rows.length,
          visibleRange: this.virtualGrid.getVisibleRange()
        });
        
        // Send initial viewport update to canvas overlay
        const initialViewport: ViewportInfo = {
          start: this.virtualGrid.getVisibleRange().start,
          end: this.virtualGrid.getVisibleRange().end,
          height: this.viewport.clientHeight,
          width: this.viewport.clientWidth,
          scrollTop: this.viewport.scrollTop,
          scrollLeft: this.viewport.scrollLeft,
          itemHeight: this.virtualGrid.getRowHeight()
        };
        
        console.log('AtomicTableRenderer: Sending initial viewport to canvas overlay:', initialViewport);
        // CRITICAL: Send initial viewport so overlay can render selections
        this.options.onScroll?.(initialViewport);
      });
      
    } finally {
      // Initial render phase timing (header only)
      const headerRenderTime = performance.now() - this.renderStartTime;
      if (headerRenderTime > 10) {
        console.warn(`AtomicTableRenderer: Header render phase took ${headerRenderTime.toFixed(2)}ms`);
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
    const rowElement = this.rowElements.get(row.id);
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
      console.warn(`AtomicTableRenderer: Slow row update ${row.id} took ${duration.toFixed(2)}ms`);
    }
  }

  // NEW: Update multiple rows (but not the entire table)
  updateRows(rows: TableRow[]): void {
    const startTime = performance.now();
    
    rows.forEach(row => {
      const rowElement = this.rowElements.get(row.id);
      if (rowElement) {
        this.renderRowCells(row, rowElement);
        rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
      }
    });
    
    const duration = performance.now() - startTime;
    if (duration > RENDER_TARGETS.CELL_UPDATE * rows.length) { // Warn if updates are slow
      console.warn(`AtomicTableRenderer: Slow batch update - ${rows.length} rows took ${duration.toFixed(2)}ms`);
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
    if (this.enableSelectionColumn && this.lastRenderState) {
      const headerCheckbox = this.header.querySelector('.vibegridx-header-checkbox') as HTMLInputElement;
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
  
  private updateViewport(state: RenderState): void {
    // Update virtual grid with current data
    const viewportHeight = this.viewport.clientHeight || 600;
    const scrollTop = this.viewport.scrollTop || 0;
    const itemHeight = this.rowHeight;
    
    // Calculate actual visible rows based on viewport
    const visibleRowCount = Math.ceil(viewportHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    // Add 1 extra row to ensure the last visible row is fully shown
    const endIndex = Math.min(startIndex + visibleRowCount + 1, state.rows.length);
    
    const currentViewport: ViewportInfo = {
      start: startIndex,
      end: endIndex,
      height: viewportHeight,
      width: this.viewport.clientWidth || 800,
      scrollTop: scrollTop,
      itemHeight: itemHeight
    };
    
    // Only log viewport changes if debugging is needed
    if (this.options.debug) {
      console.log('AtomicTableRenderer.updateViewport:', {
        currentViewport,
        visibleRowCount,
        rowCount: state.rows.length
      });
    }
    
    this.virtualGrid.updateViewport(currentViewport, state.rows.length);
  }
  
  private renderHeader(state: RenderState): void {
    if (!state.rows.length) return;
    
    // Use visible columns from configuration if available, otherwise generate from data
    const columnsToRender = this.visibleColumns.length > 0 
      ? this.visibleColumns 
      : Object.keys(state.rows[0].data).map(key => ({
          id: key,
          name: key,
          field: key,
          type: 'text' as const,
          width: 120,
          sortable: true
        }));
    
    
    // Calculate total width for header
    const totalWidth = this.getTotalColumnsWidth();
    this.header.style.width = `${totalWidth}px`;
    
    
    // Get current sort state from render state (if available)
    const sortState = (state as any).sortBy || [];
    
    // Build header HTML
    let headerHTML = '';
    
    // Add selection column header (always included)
    {
      const allSelected = this.selectedRows.size === state.rows.length && state.rows.length > 0;
      const someSelected = this.selectedRows.size > 0 && this.selectedRows.size < state.rows.length;
      
      headerHTML += `
        <div class="vibegridx-header-cell vibegridx-selection-header" 
             data-column="__selection" 
             style="width: 48px; min-width: 48px; max-width: 48px; position: sticky; left: 0; z-index: 10; background: var(--background);">
          <label class="vibegridx-checkbox-wrapper">
            <input type="checkbox" 
                   class="vibegridx-header-checkbox" 
                   ${allSelected ? 'checked' : ''}
                   ${someSelected ? 'indeterminate' : ''}>
            <span class="vibegridx-checkbox-custom"></span>
          </label>
        </div>`;
    }
    
    // Header rendered with columns
    headerHTML += columnsToRender.map((column, index) => {
      const width = this.dimensionManager?.getColumnWidth(column.id) || column.width || 120;
      const field = column.field || column.id;
      const xOffset = this.dimensionManager?.getColumnOffset?.(column.id) || this.getColumnOffset(column.id);
      
      
      // Find sort info for this column
      const sortInfo = sortState.find((s: any) => s.field === field);
      const sortIndex = sortInfo ? sortState.indexOf(sortInfo) : -1;
      
      // Sort info available for styling
      
      // Add sort class if column is sorted
      let sortClass = '';
      if (sortInfo) {
        sortClass = sortInfo.direction === 'asc' ? 'sort-asc' : 'sort-desc';
      }
      
      // Add sortable class if column is sortable
      const sortableClass = column.sortable !== false ? 'vibegridx-sortable' : '';
      
      return `<div class="vibegridx-header-cell ${sortableClass} ${sortClass}" data-column="${column.id}" data-field="${field}" style="width: ${width}px; min-width: ${width}px; max-width: ${width}px;">
        <span class="vibegridx-header-text">${column.name || column.id}</span>
        <span class="vibegridx-sort-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${sortInfo?.direction === 'asc' ? '1' : '0.3'}"/>
            <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${sortInfo?.direction === 'desc' ? '1' : '0.3'}"/>
          </svg>
        </span>
        <div class="vibegridx-resize-handle" data-column="${column.id}"></div>
      </div>`;
    }).join('');
    
    this.header.innerHTML = headerHTML;
    
    // Add event listener to header checkbox if selection column is enabled
    if (this.enableSelectionColumn) {
      const headerCheckbox = this.header.querySelector('.vibegridx-header-checkbox') as HTMLInputElement;
      if (headerCheckbox) {
        // Update indeterminate state
        const someSelected = this.selectedRows.size > 0 && this.selectedRows.size < state.rows.length;
        headerCheckbox.indeterminate = someSelected;
        
        // Add click handler
        headerCheckbox.addEventListener('click', (event) => {
          event.stopPropagation();
          const checked = (event.target as HTMLInputElement).checked;
          
          // Dispatch XState event for select all/none
          if (checked) {
            this.options.onSelectionChange?.(new Set()); // Clear first
            // Then dispatch select all event
            const selectAllEvent = { type: 'selection.checkbox.all' as const };
            (window as any).vibegridxDispatch?.(selectAllEvent);
          } else {
            this.options.onSelectionChange?.(new Set());
            // Dispatch select none event
            const selectNoneEvent = { type: 'selection.checkbox.none' as const };
            (window as any).vibegridxDispatch?.(selectNoneEvent);
          }
        });
      }
    }
  }
  
  private renderVisibleRows(state: RenderState): void {
    const visibleRange = this.virtualGrid.getVisibleRange();
    const visibleRows = state.rows.slice(visibleRange.start, visibleRange.end);
    
    // Calculate dimensions
    const totalHeight = this.virtualGrid.getTotalHeight();
    const totalWidth = this.getTotalColumnsWidth();
    
    // Set virtual dimensions
    this.body.style.height = `${totalHeight}px`;
    this.body.style.width = `${totalWidth}px`;
    
    // Ensure the viewport allows scrolling to show all content
    // Add a small timeout to ensure DOM has updated
    requestAnimationFrame(() => {
      const maxScroll = totalHeight - this.viewport.clientHeight;
      if (maxScroll > 0 && this.viewport.scrollHeight <= this.viewport.clientHeight) {
        // Force scrollbar to appear if content is taller than viewport
        this.viewport.style.overflowY = 'scroll';
      }
    });
    
    // Only log when dimensions actually change
    if (totalHeight !== this.lastDimensions.height || totalWidth !== this.lastDimensions.width) {
      console.log('[AtomicTableRenderer] Virtual dimensions changed:', {
        totalHeight,
        totalWidth,
        rowCount: state.rows.length,
        rowHeight: this.virtualGrid.getRowHeight(),
        viewportHeight: this.viewport.clientHeight,
        previousHeight: this.lastDimensions.height,
        previousWidth: this.lastDimensions.width
      });
      this.lastDimensions = { height: totalHeight, width: totalWidth };
    }
    
    // Canvas overlay is already created in initializeDOM, no need to update its size
    // It will use viewport-based sizing instead of full scrollable area
    
    // Clear existing rows that are no longer visible
    this.rowElements.forEach((element, rowId) => {
      if (!visibleRows.find(row => row.id === rowId)) {
        element.remove();
        this.rowElements.delete(rowId);
      }
    });
    
    // Render visible rows
    visibleRows.forEach((row, index) => {
      const absoluteIndex = visibleRange.start + index;
      this.renderRow(row, absoluteIndex);
    });
  }
  
  private renderRow(row: TableRow, index: number): void {
    let rowElement = this.rowElements.get(row.id);
    
    if (!rowElement) {
      rowElement = document.createElement('div');
      rowElement.className = CSS_CLASSES.ROW;
      rowElement.dataset.rowId = row.id;
      this.body.appendChild(rowElement);
      this.rowElements.set(row.id, rowElement);
    }
    
    // Position row
    const top = this.virtualGrid.getRowTop(index);
    rowElement.style.position = 'absolute';
    rowElement.style.top = `${top}px`;
    rowElement.style.width = '100%';
    rowElement.style.height = `${this.virtualGrid.getRowHeight()}px`;
    rowElement.style.borderBottom = '1px solid var(--border)';
    rowElement.style.boxSizing = 'border-box';
    
    
    // Render cells
    this.renderRowCells(row, rowElement);
    
    // Apply row state
    rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
  }
  
  private renderRowCells(row: TableRow, rowElement: HTMLElement): void {
    // Use visible columns from configuration if available
    const columnsToRender = this.visibleColumns.length > 0 
      ? this.visibleColumns 
      : Object.keys(row.data).map(key => ({
          id: key,
          name: key,
          field: key,
          type: 'text' as const,
          width: 120
        }));
    
    // Update cell elements map for this row
    columnsToRender.forEach(column => {
      const cellKey = `${row.id}:${column.id}`;
      const existingCell = this.cellElements.get(cellKey);
      if (existingCell && !rowElement.contains(existingCell)) {
        this.cellElements.delete(cellKey);
      }
    });
    
    // Create cells with proper positioning
    let cellsHTML = '';
    
    // Add selection checkbox cell (always included)
    {
      const isRowSelected = this.selectedRows.has(row.id);
      cellsHTML += `
        <div class="vibegridx-cell vibegridx-selection-cell" 
             data-row-id="${row.id}" 
             data-column-id="__selection"
             data-cell-key="${row.id}:__selection"
             role="gridcell"
             style="position: absolute; left: 0; width: 48px; height: ${this.rowHeight}px; border-right: 1px solid var(--border); box-sizing: border-box; overflow: hidden; position: sticky; z-index: 5; background: var(--background);">
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <label class="vibegridx-checkbox-wrapper" data-row-id="${row.id}">
              <input type="checkbox" 
                     class="vibegridx-row-checkbox" 
                     data-row-id="${row.id}"
                     ${isRowSelected ? 'checked' : ''}>
              <span class="vibegridx-checkbox-custom"></span>
            </label>
          </div>
        </div>`;
    }
    
    columnsToRender.forEach((column, index) => {
      const cellKey = `${row.id}:${column.id}`;
      const value = row.data[column.field || column.id];
      const width = this.dimensionManager?.getColumnWidth(column.id) || column.width || 120;
      const xOffset = this.dimensionManager?.getColumnOffset?.(column.id) || this.getColumnOffset(column.id);
      
      
      // Fast path: Skip complex state for normal cells (95% of cases)
      const isSelected = this.selectedCells.has(cellKey);
      const isEditing = this.editingCell?.rowId === row.id && this.editingCell?.columnId === column.id;
      const isDirty = row.metadata.isDirty || false;
      
      // Always use fast renderer for simplicity and performance
      const cellContent = this.renderValueFast(value, column);
      let cellClass = CSS_CLASSES.CELL;
      
      // Add state classes if needed
      if (isSelected) cellClass += ` ${CSS_CLASSES.SELECTED}`;
      if (isEditing) cellClass += ` ${CSS_CLASSES.EDITING}`;
      if (isDirty) cellClass += ` ${CSS_CLASSES.DIRTY}`;
      
      // Position cell absolutely within row - simplified for performance
      cellsHTML += `<div class="${cellClass}" 
                   data-row-id="${row.id}" 
                   data-column-id="${column.id}"
                   data-cell-key="${cellKey}"
                   role="gridcell"
                   style="position: absolute; left: ${xOffset}px; width: ${width}px; height: ${this.rowHeight}px; border-right: 1px solid var(--border); box-sizing: border-box; overflow: hidden;">
                <div style="width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 12px; box-sizing: border-box;">
                  ${cellContent}
                </div>
              </div>`;
    });
    
    rowElement.innerHTML = cellsHTML;
    
    // Update cell elements map with new cells
    const cellElements = rowElement.querySelectorAll(`.${CSS_CLASSES.CELL}`);
    cellElements.forEach((cellElement) => {
      const cellKey = cellElement.getAttribute('data-cell-key');
      if (cellKey) {
        this.cellElements.set(cellKey, cellElement as HTMLElement);
      }
    });
    
    // Add checkbox event listeners (selection column is always enabled)
    {
      // Prevent cell selection on checkbox wrapper click
      const checkboxWrapper = rowElement.querySelector('.vibegridx-checkbox-wrapper') as HTMLElement;
      if (checkboxWrapper) {
        checkboxWrapper.addEventListener('click', (event) => {
          event.stopPropagation();
        });
      }
      
      const rowCheckbox = rowElement.querySelector('.vibegridx-row-checkbox') as HTMLInputElement;
      if (rowCheckbox) {
        rowCheckbox.addEventListener('click', (event) => {
          event.stopPropagation();
          const rowId = (event.target as HTMLElement).getAttribute('data-row-id');
          
          if (rowId) {
            // Check for shift key for range selection
            if (event.shiftKey && this.lastSelectedRowId && this.lastSelectedRowId !== rowId) {
              // Dispatch range selection event
              const rangeEvent = { 
                type: 'selection.checkbox.range' as const, 
                startRowId: this.lastSelectedRowId,
                endRowId: rowId
              };
              (window as any).vibegridxDispatch?.(rangeEvent);
            } else {
              // Dispatch toggle event
              const toggleEvent = { 
                type: 'selection.checkbox.toggle' as const, 
                rowId 
              };
              (window as any).vibegridxDispatch?.(toggleEvent);
            }
            
            // Update last selected row
            this.lastSelectedRowId = rowId;
          }
        });
      }
    }
  }
  
  private lastSelectedRowId: string | null = null;
  
  // REMOVED: updateSelections - handled by Canvas Overlay Manager
  
  private applyOptimisticOperations(operations: Map<string, OptimisticOperation>): void {
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
        scrollTop: this.viewport.scrollTop,
        visibleRange: this.virtualGrid.getVisibleRange()
      }
    });
    
    // Ensure viewport has focus for keyboard events
    this.viewport.focus();
    
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
    
    console.log('[AtomicTableRenderer] handleHeaderMouseDown', {
      target: target.className,
      hasResizeHandle: !!resizeHandle,
      hasSortIcon: !!sortIcon,
      hasHeaderCell: !!headerCell
    });
    
    // Handle resize
    if (resizeHandle) {
      event.preventDefault();
      const columnId = (resizeHandle as HTMLElement).dataset.column;
      console.log('[AtomicTableRenderer] Resize handle clicked', { columnId });
      
      if (columnId && this.dimensionManager) {
        const currentWidth = this.dimensionManager.getColumnWidth(columnId) || 120;
        console.log('[AtomicTableRenderer] Sending resize start event', { columnId, currentWidth });
        
        // Send resize start event to XState
        this.options.onColumnResizeStart?.(columnId, event.clientX, currentWidth);
        
        // Set resizing state
        this.isResizing = true;
        
        // Add resizing class to container
        this.container.classList.add('vibegridx-resizing');
        
        // Add global mouse event listeners
        document.addEventListener('mousemove', this.handleResizeMove);
        document.addEventListener('mouseup', this.handleResizeEnd);
      }
      return;
    }
    
    // Don't start drag if clicking on sort icon
    if (headerCell && !sortIcon && !resizeHandle) {
      event.preventDefault();
      
      const columnId = headerCell.dataset.column;
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
        this.headerViewport.appendChild(dropIndicator);
        
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
    const headerRect = this.header.getBoundingClientRect();
    const relativeX = event.clientX - headerRect.left + this.viewport.scrollLeft;
    
    // Find target position and update column displacement
    let targetIndex = 0;
    let accumulatedWidth = 0;
    let dropX = 0;
    
    // Clear all displacement classes
    this.header.querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
      htmlCell.style.removeProperty('--drag-offset');
    });
    
    // Find current position of dragged column
    const draggedIndex = this.visibleColumns.findIndex(col => col.id === this.dragState.draggedColumnId);
    
    for (let i = 0; i < this.visibleColumns.length; i++) {
      const column = this.visibleColumns[i];
      const columnWidth = this.dimensionManager?.getColumnWidth(column.id) || 120;
      const midPoint = accumulatedWidth + columnWidth / 2;
      
      if (relativeX < midPoint) {
        targetIndex = i;
        dropX = accumulatedWidth;
        break;
      }
      
      targetIndex = i + 1;
      dropX = accumulatedWidth + columnWidth;
      accumulatedWidth += columnWidth;
    }
    
    // Get the width of the dragged column
    const draggedColumn = this.visibleColumns[draggedIndex];
    const draggedWidth = this.dimensionManager?.getColumnWidth(draggedColumn.id) || 120;
    
    // Apply displacement classes with proper offset
    this.visibleColumns.forEach((column, index) => {
      const cell = this.header.querySelector(`[data-column="${column.id}"]`) as HTMLElement;
      if (cell && column.id !== this.dragState.draggedColumnId) {
        if (draggedIndex < targetIndex && index >= draggedIndex && index < targetIndex) {
          cell.classList.add('vibegridx-will-move-left');
          cell.style.setProperty('--drag-offset', `-${draggedWidth}px`);
        } else if (draggedIndex > targetIndex && index >= targetIndex && index < draggedIndex) {
          cell.classList.add('vibegridx-will-move-right');
          cell.style.setProperty('--drag-offset', `${draggedWidth}px`);
        }
      }
    });
    
    // Update drop indicator position
    if (this.dragState.dropIndicator) {
      this.dragState.dropIndicator.style.left = `${dropX}px`;
    }
    
    this.options.onColumnDragMove?.(event.clientX, event.clientY);
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
    this.header.querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-dragging');
      htmlCell.style.removeProperty('--drag-offset');
    });
    
    // Calculate target index based on mouse position
    const headerRect = this.header.getBoundingClientRect();
    const relativeX = event.clientX - headerRect.left + this.viewport.scrollLeft;
    
    // Find target column index
    let targetIndex = 0;
    let accumulatedWidth = 0;
    for (let i = 0; i < this.visibleColumns.length; i++) {
      const columnWidth = this.dimensionManager?.getColumnWidth(this.visibleColumns[i].id) || 120;
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
    
    // Notify parent component
    this.options.onColumnDragEnd?.(targetIndex);
  }
  
  private handleHeaderClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const sortIcon = target.closest('.vibegridx-sort-icon');
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    const resizeHandle = target.closest('.vibegridx-resize-handle');
    
    if (!headerCell || resizeHandle) return;
    
    const columnId = headerCell.dataset.column;
    
    // Only handle clicks on the sort icon itself
    if (sortIcon && columnId) {
      // Handle sort icon click
      console.log('[AtomicTableRenderer] Sort icon clicked for column:', columnId);
      this.options.onColumnClick?.(columnId, event);
    }
    // Remove the else clause - no sorting on general header clicks
  }

  // Column resize handlers
  private handleResizeMove = (event: MouseEvent): void => {
    console.log('[AtomicTableRenderer] handleResizeMove', { clientX: event.clientX });
    // Send move event to XState
    this.options.onColumnResizeMove?.(event.clientX);
  };

  private handleResizeEnd = (event: MouseEvent): void => {
    console.log('[AtomicTableRenderer] handleResizeEnd');
    
    // Clear resizing state
    this.isResizing = false;
    
    // Remove resizing class
    this.container.classList.remove('vibegridx-resizing');
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.handleResizeMove);
    document.removeEventListener('mouseup', this.handleResizeEnd);
    
    // Send end event to XState
    this.options.onColumnResizeEnd?.();
  };

  
  // ====================================
  // FAST CELL RENDERING
  // ====================================
  
  // Map of renderers for quick lookup
  private static readonly renderers: Record<string, (value: any, column: Column, relationshipData?: any) => string> = {
    text: renderText,
    number: renderNumber,
    date: renderDate,
    boolean: renderBoolean,
    enum: renderEnum,
    select: renderText, // Reuse text renderer for select
    uuid: renderText, // UUID is text-based
    json: renderText, // JSON displayed as text (could be enhanced later)
    relationship: renderRelationship,
    'relationship-single': renderRelationship,
    'relationship-multi': renderRelationship,
    'relationship-collection': renderRelationship,
  };
  
  private renderValueFast(value: any, column: Column): string {
    // Check column cellType first, then fall back to type
    const cellType = column.cellType || column.type;
    const renderer = AtomicTableRenderer.renderers[cellType] || renderText;
    
    // For relationship types, pass the relationship data
    if (cellType?.startsWith('relationship')) {
      return (renderer as any)(value, column, this.relationshipData);
    }
    
    return renderer(value, column);
  }

  // ====================================
  // UTILITY METHODS
  // ====================================
  
  private getCellElement(rowId: string, columnId: string): HTMLElement | null {
    return this.body.querySelector(
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
    
    this.container.innerHTML = '';
  }
}