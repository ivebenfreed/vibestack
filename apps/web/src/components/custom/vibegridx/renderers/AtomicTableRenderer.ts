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
    // Only add buffer if we're not at the edges
    const bufferRows = 5;
    const canAddTopBuffer = viewport.start > 0;
    const canAddBottomBuffer = viewport.end < totalRows;
    
    this.visibleRange = {
      start: canAddTopBuffer ? Math.max(0, viewport.start - bufferRows) : viewport.start,
      end: canAddBottomBuffer ? Math.min(totalRows, viewport.end + bufferRows) : viewport.end
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
    return index * this.rowHeight;
  }
  
  getTotalHeight(): number {
    // Ensure we don't create extra space beyond actual rows
    return Math.max(0, this.totalRows * this.rowHeight);
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
  
  // State caches
  private rowElements = new Map<string, HTMLElement>();
  private cellElements = new Map<string, HTMLElement>(); // "rowId:columnId" -> element
  private selectedCells = new Set<string>();
  private editingCell: CellRef | null = null;
  private lastRenderState: RenderState | null = null;
  
  // Column configuration
  private columns: Column[] = [];
  private dimensionManager: ColumnDimensionManager | null = null;
  private rowHeight = 40; // Default row height
  private relationshipData: any = {}; // Relationship data for lookups
  
  // Batch update queue
  private updateQueue = new Set<string>();
  private batchTimeoutId = 0;
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.dimensionManager = options.dimensionManager || null;
    this.relationshipData = options.relationshipData || {};
    
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
    // Don't set width/height - let Konva handle it based on viewport
    canvasOverlay.style.pointerEvents = 'none'; // Canvas is display only, DOM cells handle events
    canvasOverlay.style.zIndex = '10';
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
    // Dimension manager will be set separately via setDimensionManager
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
    
    // Subscribe to dimension changes
    manager.subscribe((event) => {
      // Handle dimension changes - could trigger re-render of affected cells
      console.log('AtomicTableRenderer: Column dimension changed', event);
      
      // Re-render header to reflect new widths
      if (this.lastRenderState) {
        this.renderHeader(this.lastRenderState);
      }
    });
  }
  
  // Get total width of all columns
  private getTotalColumnsWidth(): number {
    return this.dimensionManager?.getTotalWidth() || 0;
  }
  
  // Get column offset position
  private getColumnOffset(columnId: string): number {
    return this.dimensionManager?.getColumnOffset(columnId) || 0;
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
        const calculatedStart = Math.floor(this.viewport.scrollTop / rowHeight);
        const calculatedEnd = calculatedStart + Math.ceil(this.viewport.clientHeight / rowHeight);
        const cappedEnd = this.lastRenderState ? Math.min(calculatedEnd, this.lastRenderState.rows.length) : calculatedEnd;
        
        const newViewport: ViewportInfo = {
          start: calculatedStart,
          end: cappedEnd,
          height: this.viewport.clientHeight,
          width: this.viewport.clientWidth,
          scrollTop: this.viewport.scrollTop,
          scrollLeft: this.viewport.scrollLeft,
          itemHeight: rowHeight
        };
        
        // Update our own viewport and re-render visible rows immediately
        if (this.lastRenderState) {
          const hasViewportChanged = this.virtualGrid.updateViewport(newViewport, this.lastRenderState.rows.length);
          if (hasViewportChanged) {
            this.renderVisibleRows(this.lastRenderState);
            
            // Notify that render is complete after scroll
            this.options.onStateChange?.({
              type: 'render.complete',
              renderTime: 0,
              rowCount: this.lastRenderState.rows.length,
              visibleRange: this.virtualGrid.getVisibleRange()
            });
          }
        }
        
        this.options.onScroll?.(newViewport);
        
        // Allow next update
        isScrolling = false;
      });
    });
    
    // Let native scrolling handle wheel events - it naturally bubbles at boundaries
    
    // Cell interaction handlers
    this.body.addEventListener('click', this.handleCellClick.bind(this));
    this.body.addEventListener('dblclick', this.handleCellDoubleClick.bind(this));
    this.body.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Header interaction handlers
    this.header.addEventListener('click', this.handleHeaderClick.bind(this));
    
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
    this.renderStartTime = performance.now();
    
    // Apply sorting to rows if sort configuration exists
    let sortedState = state;
    if (state.sortBy && state.sortBy.length > 0) {
      console.log('[AtomicTableRenderer] Applying sort:', state.sortBy);
      const sortedRows = this.applySorting(state.rows, state.sortBy);
      sortedState = {
        ...state,
        rows: sortedRows
      };
    }
    
    this.lastRenderState = sortedState; // Store sorted state for scroll updates
    
    // Update columns if provided in state
    if (sortedState.columns && sortedState.columns.length > 0) {
      this.setColumns(sortedState.columns);
    }
    
    try {
      // Batch all DOM writes together before reading dimensions
      this.renderHeader(sortedState);
      
      // Use requestAnimationFrame to defer dimension reading until after browser paint
      requestAnimationFrame(() => {
        this.updateViewport(sortedState);
        this.renderVisibleRows(sortedState);
        this.applyOptimisticOperations(sortedState.optimisticOperations);
        
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
  
  // ====================================
  // PRIVATE RENDERING METHODS
  // ====================================
  
  private updateViewport(state: RenderState): void {
    // Update virtual grid with current data
    const viewportHeight = this.viewport.clientHeight || 600;
    const scrollTop = this.viewport.scrollTop || 0;
    const itemHeight = 40;
    
    // Calculate actual visible rows based on viewport
    const visibleRowCount = Math.ceil(viewportHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + visibleRowCount, state.rows.length);
    
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
    
    // Use columns from configuration if available, otherwise generate from data
    const columnsToRender = this.columns.length > 0 
      ? this.columns 
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
    
    // Header rendered with columns
    this.header.innerHTML = columnsToRender.map(column => {
      const width = this.dimensionManager?.getColumnWidth(column.id) || column.width || 120;
      const field = column.field || column.id;
      
      // Find sort info for this column
      const sortInfo = sortState.find((s: any) => s.field === field);
      const sortIndex = sortInfo ? sortState.indexOf(sortInfo) : -1;
      
      // Debug log
      if (sortInfo) {
        console.log(`[AtomicTableRenderer] Column ${column.id} has sort:`, sortInfo);
      }
      
      // Build sort indicator
      let sortIndicator = '';
      if (sortInfo) {
        const arrow = sortInfo.direction === 'asc' ? '▲' : '▼';
        const sortNumber = sortState.length > 1 ? `<sup>${sortIndex + 1}</sup>` : '';
        sortIndicator = `<span class="vibegridx-sort-indicator">${arrow}${sortNumber}</span>`;
      }
      
      // Add sortable class if column is sortable
      const sortableClass = column.sortable !== false ? 'vibegridx-sortable' : '';
      
      return `<div class="vibegridx-header-cell ${sortableClass}" data-column="${column.id}" style="width: ${width}px; min-width: ${width}px; max-width: ${width}px;">
        <span class="vibegridx-header-text">${column.name || column.id}</span>
        ${sortIndicator}
      </div>`;
    }).join('');
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
    // Use columns from configuration if available
    const columnsToRender = this.columns.length > 0 
      ? this.columns 
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
    
    columnsToRender.forEach(column => {
      const cellKey = `${row.id}:${column.id}`;
      const value = row.data[column.field || column.id];
      const width = this.dimensionManager?.getColumnWidth(column.id) || column.width || 120;
      const xOffset = this.dimensionManager?.getColumnOffset(column.id) || 0;
      
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
                   style="position: absolute; left: ${xOffset}px; width: ${width}px; height: ${this.rowHeight}px; border-right: 1px solid var(--border); box-sizing: border-box;">
                ${cellContent}
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
  }
  
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
    
    // Debug logging disabled - too verbose for normal operation
    
    if (!cellElement) return;
    
    const rowId = cellElement.dataset.rowId!;
    const columnId = cellElement.dataset.columnId!;
    
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
  
  private handleHeaderClick(event: MouseEvent): void {
    const headerCell = (event.target as Element).closest('.vibegridx-header-cell') as HTMLElement;
    if (!headerCell) return;
    
    const columnId = headerCell.dataset.column;
    if (columnId) {
      this.options.onColumnClick?.(columnId, event);
    }
  }
  
  
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