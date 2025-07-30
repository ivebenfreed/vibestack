// ====================================
// CLEAN TABLE RENDERER
// ====================================
// A simplified renderer that handles everything in one place
// No complex abstractions, just direct rendering

import type { 
  TableRow, 
  Column, 
  RenderState, 
  RendererOptions, 
  CellRef, 
  ViewportInfo,
  SortConfig 
} from '../../types';
import { CellPipeline } from './CellPipeline';

// ====================================
// TYPES
// ====================================

interface RendererCallbacks {
  onSort?: (field: string) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columnId: string, newIndex: number) => void;
  onSelectionChange?: (selectedRows: Set<string>) => void;
  onCellEdit?: (rowId: string, columnId: string, value: any) => void;
  onScroll?: (viewport: ViewportInfo) => void;
}

// ====================================
// CONSTANTS
// ====================================

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;
const BUFFER_ROWS = 5;

// ====================================
// CLEAN TABLE RENDERER
// ====================================

export class CleanTableRenderer {
  // DOM elements
  private container: HTMLElement;
  private table: HTMLElement;
  private header: HTMLElement;
  private viewport: HTMLElement;
  private body: HTMLElement;
  private canvasContainer: HTMLElement;
  
  // State
  private state: RenderState | null = null;
  private visibleRange = { start: 0, end: 0 };
  private selectedRows = new Set<string>();
  
  // Caches - Simple and direct
  private rowElements = new Map<string, HTMLElement>();
  private cellElements = new Map<string, HTMLElement>(); // key: "rowId:columnId"
  
  // Options
  private options: RendererOptions;
  private callbacks: RendererCallbacks;
  
  // Drag state
  private dragState: {
    type: 'column' | 'resize' | null;
    columnId: string | null;
    startX: number;
    startWidth: number;
    startMouseX?: number;
    startMouseY?: number;
  } = { type: null, columnId: null, startX: 0, startWidth: 0 };
  
  // Track if mouse moved during drag to prevent sort on drag
  private mouseMovedDuringDrag = false;
  
  // RequestAnimationFrame ID for scroll sync
  private _scrollRAF: number | null = null;
  
  // Drag preview elements
  private dragPreview: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  private _lastTargetIndex: number = -1;
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.container = options.container;
    
    // Extract callbacks from options
    this.callbacks = {
      onSort: options.onColumnClick,
      onColumnResize: options.onColumnResizeEnd,
      onColumnReorder: options.onColumnDragEnd,
      onScroll: options.onScroll
    };
    
    this.initializeDOM();
    this.attachEventListeners();
    
    // Store instance on window for EventDelegationManager to access
    (window as any).__vibegridx_renderer_instance = this;
  }
  
  // Get current sort state from store
  private getCurrentSortState(): Array<{ field: string; direction: 'asc' | 'desc' }> {
    // Access store actor from window (temporary until we pass it properly)
    const storeActor = (window as any).__vibegridx_store_actor;
    if (storeActor) {
      const snapshot = storeActor.getSnapshot();
      return snapshot?.context?.sortBy || [];
    }
    return [];
  }
  
  // ====================================
  // DOM INITIALIZATION
  // ====================================
  
  private initializeDOM(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Create structure
    this.table = this.createElement('div', 'vibegridx-table');
    this.header = this.createElement('div', 'vibegridx-header');
    this.viewport = this.createElement('div', 'vibegridx-viewport');
    this.body = this.createElement('div', 'vibegridx-body');
    this.canvasContainer = this.createElement('div', 'vibegridx-canvas-overlay-container');
    
    // Apply styles
    Object.assign(this.viewport.style, {
      position: 'relative',
      overflow: 'auto',
      flex: '1'
    });
    
    Object.assign(this.body.style, {
      position: 'relative'
    });
    
    Object.assign(this.canvasContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '100'
    });
    
    // Assemble
    this.body.appendChild(this.canvasContainer);
    this.viewport.appendChild(this.body);
    this.table.appendChild(this.header);
    this.table.appendChild(this.viewport);
    this.container.appendChild(this.table);
    
    // Notify about canvas container
    if (this.options.onStateChange) {
      setTimeout(() => {
        this.options.onStateChange!({
          type: 'canvas.container.ready',
          container: this.canvasContainer
        });
      }, 0);
    }
  }
  
  // ====================================
  // MAIN RENDER METHOD
  // ====================================
  
  render(state: RenderState): void {
    console.log('CleanTableRenderer: render() called with columns:', {
      columnCount: state.columns?.length,
      columnIds: state.columns?.map(c => c.id),
      columnNames: state.columns?.map(c => c.name),
      version: state.version
    });
    
    this.state = state;
    
    // Update dimensions
    this.updateDimensions(state);
    
    // Render header
    this.renderHeader(state);
    
    // Batch read layout properties first
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    
    // Calculate visible rows
    this.updateVisibleRange(scrollTop, viewportHeight);
    
    // Render rows
    this.renderRows(state);
    
    // Cleanup old rows
    this.cleanupRows();
    
    // Ensure header is synchronized with current scroll position
    this.syncHeaderScroll();
  }
  
  // ====================================
  // HEADER RENDERING
  // ====================================
  
  private renderHeader(state: RenderState): void {
    console.log('CleanTableRenderer: renderHeader called with columns:', {
      stateColumns: state.columns?.map(c => ({ id: c.id, name: c.name })),
      coordinateMappingColumns: state.coordinateMapping?.columns?.map((c: any) => ({ 
        columnId: c.columnId, 
        index: c.index 
      }))
    });
    
    // Force complete re-render of header by removing all children
    while (this.header.firstChild) {
      this.header.removeChild(this.header.firstChild);
    }
    
    if (!state.columns || !state.coordinateMapping) return;
    
    // Create header row container
    const headerRow = this.createElement('div', 'vibegridx-header-row');
    headerRow.style.height = `${HEADER_HEIGHT}px`;
    headerRow.style.position = 'relative';
    headerRow.style.display = 'flex';
    headerRow.style.width = 'fit-content';
    
    // Render columns in the order they appear in state.columns (from store)
    console.log('CleanTableRenderer: Creating header cells in order:', state.columns.map(c => c.id));
    
    state.columns.forEach((column, index) => {
      // Find the coordinate mapping for this column to get its width
      const colMapping = state.coordinateMapping?.columns.find((cm: any) => cm.columnId === column.id);
      
      // If no mapping, create a default one
      const mapping = colMapping || {
        columnId: column.id,
        index: index,
        offset: index * 120, // Will be recalculated
        width: column.width || 120
      };
      
      const headerCell = this.createHeaderCell(column, mapping, state);
      console.log(`CleanTableRenderer: Appending column ${column.id} at position ${index}`);
      headerRow.appendChild(headerCell);
    });
    
    this.header.appendChild(headerRow);
    
    // Log final DOM state
    console.log('CleanTableRenderer: Final header DOM order:', 
      Array.from(headerRow.children).map((el: any) => el.dataset.column));
  }
  
  private createHeaderCell(column: Column, colMapping: any, state: RenderState): HTMLElement {
    const cell = this.createElement('div', 'vibegridx-header-cell');
    
    // Essential attributes for event handling
    cell.dataset.column = column.id;
    cell.dataset.field = column.field || column.id;
    
    // Positioning - use flex layout instead of absolute positioning
    Object.assign(cell.style, {
      position: 'relative',
      width: `${colMapping.width}px`,
      height: `${HEADER_HEIGHT}px`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRight: '1px solid var(--border)',
      cursor: column.sortable !== false ? 'pointer' : 'default',
      userSelect: 'none',
      flexShrink: '0'
    });
    
    if (column.id === '__selection') {
      // Selection checkbox
      cell.classList.add('vibegridx-selection-header');
      const checkbox = this.createCheckbox(state.rows.every(row => this.selectedRows.has(row.id)));
      cell.appendChild(checkbox);
    } else {
      // Column content with sort icon
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'flex';
      contentWrapper.style.alignItems = 'center';
      contentWrapper.style.flex = '1';
      contentWrapper.style.gap = '4px';
      contentWrapper.style.overflow = 'hidden'; // Add overflow hidden
      
      const content = document.createElement('span');
      content.className = 'vibegridx-header-text';
      content.textContent = column.name || column.id;
      contentWrapper.appendChild(content);
      
      // Add tooltip for truncated header text
      requestAnimationFrame(() => {
        if (content.scrollWidth > content.clientWidth) {
          content.title = column.name || column.id;
          content.style.cursor = 'help';
        }
      });
      
      // Sort indicator
      if (column.sortable !== false) {
        // Get sort state from store, not from render state
        const currentSortState = this.getCurrentSortState();
        const sortConfig = currentSortState.find(s => s.field === (column.field || column.id));
        
        
        const sortIcon = this.createSortIcon(sortConfig);
        
        // Add sort state class to header cell
        // First remove any existing sort classes
        cell.classList.remove('sort-asc', 'sort-desc');
        if (sortConfig) {
          const sortClass = `sort-${sortConfig.direction}`;
          cell.classList.add(sortClass);
        }
        
        contentWrapper.appendChild(sortIcon);
      }
      
      cell.appendChild(contentWrapper);
      
      // Resize handle
      if (column.resizable !== false) {
        const handle = document.createElement('div');
        handle.className = 'vibegridx-resize-handle';
        handle.dataset.column = column.id;
        Object.assign(handle.style, {
          position: 'absolute',
          right: '0',
          top: '0',
          width: '4px',
          height: '100%',
          cursor: 'col-resize'
        });
        cell.appendChild(handle);
      }
    }
    
    return cell;
  }
  
  private createSortIcon(sortConfig?: SortConfig): HTMLElement {
    const icon = document.createElement('span');
    icon.className = 'vibegridx-sort-icon';
    
    // Override CSS to make icon always visible with proper opacity
    // Use !important to ensure inline styles take precedence
    icon.style.marginLeft = '4px';
    icon.style.opacity = sortConfig ? '1' : '0.5';
    icon.style.flexShrink = '0';
    
    const ascOpacity = sortConfig?.direction === 'asc' ? '1' : '0.3';
    const descOpacity = sortConfig?.direction === 'desc' ? '1' : '0.3';
    
    
    icon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" opacity="${ascOpacity}"/>
        <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" opacity="${descOpacity}"/>
      </svg>
    `;
    
    return icon;
  }
  
  // ====================================
  // ROW RENDERING
  // ====================================
  
  private renderRows(state: RenderState): void {
    if (!state.rows || !state.columns || !state.coordinateMapping) return;
    
    const { start, end } = this.visibleRange;
    const visibleRows = state.rows.slice(start, end);
    
    // Check if column order changed by comparing with cached column order
    const currentColumnOrder = state.columns.map(c => c.id).join(',');
    const lastColumnOrder = (this as any)._lastColumnOrder || '';
    const columnsReordered = currentColumnOrder !== lastColumnOrder;
    (this as any)._lastColumnOrder = currentColumnOrder;
    
    visibleRows.forEach((row, index) => {
      const absoluteIndex = start + index;
      let rowEl = this.rowElements.get(row.id);
      
      if (!rowEl) {
        // Create new row
        rowEl = this.createRow(row, absoluteIndex);
        this.rowElements.set(row.id, rowEl);
        this.body.appendChild(rowEl);
      } else {
        // Update position
        rowEl.style.top = `${absoluteIndex * ROW_HEIGHT}px`;
      }
      
      // Always render cells - the renderCells method now handles reordering
      this.renderCells(row, rowEl, state);
    });
  }
  
  private createRow(row: TableRow, index: number): HTMLElement {
    const rowEl = this.createElement('div', 'vibegridx-row');
    rowEl.dataset.rowId = row.id;
    
    Object.assign(rowEl.style, {
      position: 'absolute',
      top: `${index * ROW_HEIGHT}px`,
      left: '0',
      right: '0',
      height: `${ROW_HEIGHT}px`,
      display: 'flex',
      width: 'fit-content'
    });
    
    return rowEl;
  }
  
  private renderCells(row: TableRow, rowEl: HTMLElement, state: RenderState): void {
    if (!state.coordinateMapping || !state.columns) return;
    
    // Always clear and re-render cells to ensure correct order
    // This is necessary when columns are reordered
    rowEl.innerHTML = '';
    
    // Clear cell cache for this row
    const cellKeysToRemove: string[] = [];
    this.cellElements.forEach((cell, key) => {
      if (key.startsWith(`${row.id}:`)) {
        cellKeysToRemove.push(key);
      }
    });
    cellKeysToRemove.forEach(key => this.cellElements.delete(key));
    
    // Render cells in the order they appear in state.columns (from store)
    state.columns.forEach((column, index) => {
      // Find the coordinate mapping for this column
      const colMapping = state.coordinateMapping?.columns.find((cm: any) => cm.columnId === column.id);
      
      // If no mapping, create a default one
      const mapping = colMapping || {
        columnId: column.id,
        index: index,
        offset: index * 120, // Will be recalculated
        width: column.width || 120
      };
      
      const cellKey = `${row.id}:${column.id}`;
      const cell = this.createCell(row, column, mapping);
      rowEl.appendChild(cell);
      this.cellElements.set(cellKey, cell);
      
      // Update content
      this.updateCellContent(cell, row, column);
    });
  }
  
  private createCell(row: TableRow, column: Column, colMapping: any): HTMLElement {
    const cell = this.createElement('div', 'vibegridx-cell');
    cell.dataset.rowId = row.id;
    cell.dataset.columnId = column.id;
    
    Object.assign(cell.style, {
      position: 'relative',
      width: `${colMapping.width}px`,
      height: `${ROW_HEIGHT}px`,
      borderRight: '1px solid var(--border)',
      flexShrink: '0',
      overflow: 'hidden' // Add overflow hidden to cell
    });
    
    return cell;
  }
  
  private updateCellContent(cell: HTMLElement, row: TableRow, column: Column): void {
    cell.innerHTML = '';
    
    if (column.id === '__selection') {
      const checkbox = this.createCheckbox(this.selectedRows.has(row.id));
      cell.appendChild(checkbox);
    } else {
      const value = row.data[column.field || column.id];
      const content = CellPipeline.createCellContent(value, column, row.data);
      cell.appendChild(content);
    }
  }
  
  // ====================================
  // UTILITIES
  // ====================================
  
  private createCheckbox(checked: boolean): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'vibegridx-checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'vibegridx-checkbox';
    checkbox.checked = checked;
    
    const custom = document.createElement('span');
    custom.className = 'vibegridx-checkbox-custom';
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(custom);
    
    return wrapper;
  }
  
  private createElement(tag: string, className: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  }
  
  private updateDimensions(state: RenderState): void {
    if (!state.coordinateMapping) return;
    
    const totalWidth = state.coordinateMapping.columns.reduce(
      (sum: number, col: any) => sum + col.width, 0
    );
    const totalHeight = state.rows.length * ROW_HEIGHT;
    
    this.body.style.width = `${totalWidth}px`;
    this.body.style.height = `${totalHeight}px`;
  }
  
  private updateVisibleRange(scrollTop?: number, viewportHeight?: number): void {
    // Use passed values or read from DOM
    scrollTop = scrollTop ?? this.viewport.scrollTop;
    viewportHeight = viewportHeight ?? this.viewport.clientHeight;
    
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const end = Math.min(
      this.state?.rows.length || 0,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS
    );
    
    this.visibleRange = { start, end };
  }
  
  private cleanupRows(): void {
    const visibleIds = new Set(
      this.state?.rows.slice(this.visibleRange.start, this.visibleRange.end).map(r => r.id)
    );
    
    this.rowElements.forEach((rowEl, rowId) => {
      if (!visibleIds.has(rowId)) {
        rowEl.remove();
        this.rowElements.delete(rowId);
        
        // Clean up cell cache
        this.cellElements.forEach((_, key) => {
          if (key.startsWith(`${rowId}:`)) {
            this.cellElements.delete(key);
          }
        });
      }
    });
  }
  
  private syncHeaderScroll(): void {
    // Synchronize header horizontal scroll with viewport
    // Use requestAnimationFrame to avoid forced reflow
    if (!this._scrollRAF) {
      this._scrollRAF = requestAnimationFrame(() => {
        const scrollLeft = this.viewport.scrollLeft;
        this.header.style.transform = `translateX(-${scrollLeft}px)`;
        this._scrollRAF = null;
      });
    }
  }
  
  // ====================================
  // EVENT HANDLING
  // ====================================
  
  private attachEventListeners(): void {
    // Scroll
    this.viewport.addEventListener('scroll', this.handleScroll);
    
    // Header clicks - REMOVED to prevent double event handling
    // The EventDelegationManager handles all click events
    // this.header.addEventListener('click', this.handleHeaderClick);
    
    // Resize/drag - REMOVED to prevent double event handling
    // The EventDelegationManager handles all mouse events
    // this.header.addEventListener('mousedown', this.handleHeaderMouseDown);
    
    // Selection
    this.table.addEventListener('change', this.handleCheckboxChange);
  }
  
  private handleScroll = (): void => {
    // Batch read all layout properties first to avoid interleaving reads and writes
    const scrollTop = this.viewport.scrollTop;
    const scrollLeft = this.viewport.scrollLeft;
    const viewportHeight = this.viewport.clientHeight;
    const viewportWidth = this.viewport.clientWidth;
    
    // Now do all the updates
    this.updateVisibleRange(scrollTop, viewportHeight);
    if (this.state) {
      this.renderRows(this.state);
      this.cleanupRows();
    }
    
    // Synchronize header horizontal scroll with viewport
    this.syncHeaderScroll();
    
    this.callbacks.onScroll?.({
      start: this.visibleRange.start,
      end: this.visibleRange.end,
      height: viewportHeight,
      width: viewportWidth,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
      itemHeight: ROW_HEIGHT
    });
  };
  
  private handleHeaderClick = (e: MouseEvent): void => {
    // Don't sort if we just finished dragging
    if (this.mouseMovedDuringDrag) {
      this.mouseMovedDuringDrag = false;
      return;
    }
    
    const target = e.target as HTMLElement;
    
    // Don't sort if clicking on resize handle
    if (target.classList.contains('vibegridx-resize-handle')) {
      return;
    }
    
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    if (!headerCell) return;
    
    const columnId = headerCell.dataset.column;
    if (!columnId || columnId === '__selection') return;
    
    // Sort click
    const field = headerCell.dataset.field || columnId;
    console.log('CleanTableRenderer: Sort click detected', {
      field,
      columnId,
      timestamp: Date.now()
    });
    this.callbacks.onSort?.(field);
  };
  
  private handleHeaderMouseDown = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    
    // Reset drag tracking
    this.mouseMovedDuringDrag = false;
    
    if (target.classList.contains('vibegridx-resize-handle')) {
      // Start resize
      const columnId = target.dataset.column;
      if (!columnId) return;
      
      this.dragState = {
        type: 'resize',
        columnId,
        startX: e.clientX,
        startWidth: this.getColumnWidth(columnId)
      };
      
      // Add global listeners
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
      
      e.preventDefault();
    } else {
      // Check if clicking on a draggable header
      const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
      if (!headerCell || headerCell.querySelector('[data-column="__selection"]')) return;
      
      const columnId = headerCell.dataset.column;
      if (!columnId) return;
      
      // Start potential column drag
      this.dragState = {
        type: null, // Will become 'column' if mouse moves enough
        columnId,
        startX: e.clientX,
        startWidth: 0,
        startMouseX: e.clientX,
        startMouseY: e.clientY
      };
      
      // Add global listeners
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
      
      e.preventDefault();
    }
  };
  
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.dragState.columnId) return;
    
    // Check if we should start column drag
    if (this.dragState.type === null && this.dragState.startMouseX && this.dragState.startMouseY) {
      const deltaX = Math.abs(e.clientX - this.dragState.startMouseX);
      const deltaY = Math.abs(e.clientY - this.dragState.startMouseY);
      
      // Start drag if moved more than 5 pixels
      if (deltaX > 5 || deltaY > 5) {
        this.dragState.type = 'column';
        this.mouseMovedDuringDrag = true;
        this.startColumnDrag(e);
      }
    } else if (this.dragState.type === 'resize') {
      const delta = e.clientX - this.dragState.startX;
      const newWidth = Math.max(50, this.dragState.startWidth + delta);
      
      // Preview resize (update header only)
      const headerCell = this.header.querySelector(`[data-column="${this.dragState.columnId}"]`) as HTMLElement;
      if (headerCell) {
        headerCell.style.width = `${newWidth}px`;
      }
    } else if (this.dragState.type === 'column') {
      this.updateColumnDrag(e);
    }
  };
  
  private handleMouseUp = (e: MouseEvent): void => {
    if (this.dragState.type === 'resize' && this.dragState.columnId) {
      const delta = e.clientX - this.dragState.startX;
      const newWidth = Math.max(50, this.dragState.startWidth + delta);
      
      this.callbacks.onColumnResize?.(this.dragState.columnId, newWidth);
    } else if (this.dragState.type === 'column' && this.dragState.columnId) {
      // Column drag completion is handled by EventDelegationManager
      // Just clean up visual state
      this.clearDragPreview();
      document.body.classList.remove('vibegridx-dragging-active');
    }
    
    // Reset state
    this.dragState = { type: null, columnId: null, startX: 0, startWidth: 0 };
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  };
  
  private handleCheckboxChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('vibegridx-checkbox')) return;
    
    const wrapper = target.closest('.vibegridx-checkbox-wrapper') as HTMLElement;
    const cell = wrapper?.closest('.vibegridx-cell, .vibegridx-header-cell') as HTMLElement;
    
    if (!cell) return;
    
    if (cell.classList.contains('vibegridx-selection-header')) {
      // Header checkbox - select all/none
      if (target.checked) {
        this.selectedRows = new Set(this.state?.rows.map(r => r.id) || []);
      } else {
        this.selectedRows.clear();
      }
      
      // Update all row checkboxes
      this.updateAllCheckboxes();
    } else {
      // Row checkbox
      const rowId = cell.dataset.rowId;
      if (!rowId) return;
      
      if (target.checked) {
        this.selectedRows.add(rowId);
      } else {
        this.selectedRows.delete(rowId);
      }
      
      // Update header checkbox
      this.updateHeaderCheckbox();
    }
    
    this.callbacks.onSelectionChange?.(this.selectedRows);
  };
  
  private getColumnWidth(columnId: string): number {
    const colMapping = this.state?.coordinateMapping?.columns.find(
      (c: any) => c.columnId === columnId
    );
    return colMapping?.width || 120;
  }
  
  private updateAllCheckboxes(): void {
    this.rowElements.forEach((rowEl, rowId) => {
      const checkbox = rowEl.querySelector('.vibegridx-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = this.selectedRows.has(rowId);
      }
    });
  }
  
  private updateHeaderCheckbox(): void {
    const headerCheckbox = this.header.querySelector('.vibegridx-selection-header .vibegridx-checkbox') as HTMLInputElement;
    if (headerCheckbox && this.state) {
      headerCheckbox.checked = this.state.rows.length > 0 && 
        this.state.rows.every(row => this.selectedRows.has(row.id));
    }
  }
  
  // ====================================
  // COLUMN DRAG IMPLEMENTATION
  // ====================================
  
  private startColumnDrag(e: MouseEvent): void {
    if (!this.dragState.columnId) return;
    
    const column = this.state?.columns.find(col => col.id === this.dragState.columnId);
    if (!column) return;
    
    console.log('CleanTableRenderer: Starting column drag', {
      columnId: this.dragState.columnId,
      columnName: column.name || column.id
    });
    
    // Create drag preview
    this.applyDragPreview({
      draggedColumnId: this.dragState.columnId,
      columnName: column.name || column.id,
      mouseX: e.clientX,
      mouseY: e.clientY,
      isInitialPreview: true
    });
    
    // Add dragging class to body
    document.body.classList.add('vibegridx-dragging-active');
  }
  
  private updateColumnDrag(e: MouseEvent): void {
    if (!this.dragState.columnId) return;
    
    // Calculate target position
    const targetIndex = this.calculateColumnDropTarget(e.clientX);
    
    console.log('CleanTableRenderer: Updating column drag', {
      columnId: this.dragState.columnId,
      targetIndex,
      mouseX: e.clientX
    });
    
    // Update drag preview
    const column = this.state?.columns.find(col => col.id === this.dragState.columnId);
    this.applyDragPreview({
      draggedColumnId: this.dragState.columnId,
      columnName: column?.name || this.dragState.columnId,
      mouseX: e.clientX,
      mouseY: e.clientY,
      targetIndex: targetIndex,
      isInitialPreview: false
    });
  }
  
  // New method to handle drag position updates from EventDelegationManager
  updateDragPosition(params: { mouseX: number; mouseY: number }): void {
    console.log('CleanTableRenderer: updateDragPosition called', {
      params,
      dragState: this.dragState,
      hasDragState: !!this.dragState,
      hasColumnId: !!this.dragState?.columnId
    });
    
    if (!this.dragState || !this.dragState.columnId) {
      console.warn('CleanTableRenderer: No active drag state', {
        dragState: this.dragState
      });
      return;
    }
    
    // Calculate target position
    const targetIndex = this.calculateColumnDropTarget(params.mouseX);
    
    // Store the calculated target index
    this._lastCalculatedTargetIndex = targetIndex;
    
    // For drop indicator, find the closest column boundary
    const headerCells = Array.from(this.header.querySelectorAll('.vibegridx-header-cell:not([data-column="__selection"])'));
    const visibleColumns = this.state?.columns?.filter(col => col.id !== '__selection') || [];
    const draggedIndex = visibleColumns.findIndex(col => col.id === this.dragState.columnId);
    
    let dropIndicatorX = -1000; // Default to hidden
    let minDistance = Infinity;
    let closestBoundaryIndex = -1;
    
    // Get the bounds of the dragged column
    if (draggedIndex === -1 || draggedIndex >= headerCells.length) {
      console.warn('CleanTableRenderer: Dragged column not found in visible columns', {
        draggedColumnId: this.dragState.columnId,
        visibleColumns: visibleColumns.map(c => c.id)
      });
      // Apply drag preview without drop indicator
      const column = this.state?.columns.find(col => col.id === this.dragState.columnId);
      this.applyDragPreview({
        draggedColumnId: this.dragState.columnId,
        columnName: column?.name || this.dragState.columnId,
        mouseX: params.mouseX,
        mouseY: params.mouseY,
        targetIndex: targetIndex,
        isInitialPreview: false
      });
      return;
    }
    
    const draggedCell = headerCells[draggedIndex] as HTMLElement;
    const draggedRect = draggedCell.getBoundingClientRect();
    
    // Only show drop indicator if we're outside the dragged column
    if (params.mouseX < draggedRect.left || params.mouseX > draggedRect.right) {
      // Check each column boundary to find the closest one
      for (let i = 0; i <= headerCells.length; i++) {
        // Skip boundaries of the dragged column itself
        if (i === draggedIndex || i === draggedIndex + 1) {
          continue;
        }
        
        let boundaryX: number;
        
        if (i === 0) {
          // Left edge of first column
          const firstCell = headerCells[0] as HTMLElement;
          boundaryX = firstCell.getBoundingClientRect().left;
        } else if (i === headerCells.length) {
          // Right edge of last column
          const lastCell = headerCells[headerCells.length - 1] as HTMLElement;
          boundaryX = lastCell.getBoundingClientRect().right;
        } else {
          // Between columns
          const leftCell = headerCells[i - 1] as HTMLElement;
          boundaryX = leftCell.getBoundingClientRect().right;
        }
        
        const distance = Math.abs(params.mouseX - boundaryX);
        if (distance < minDistance) {
          minDistance = distance;
          dropIndicatorX = boundaryX - this.container.getBoundingClientRect().left;
          closestBoundaryIndex = i;
        }
      }
    }
    
    console.log('CleanTableRenderer: updateDragPosition', {
      draggedColumnId: params.draggedColumnId,
      mouseX: params.mouseX,
      targetIndex: targetIndex,
      dropIndicatorX: dropIndicatorX,
      closestBoundaryIndex: closestBoundaryIndex,
      headerCellsCount: headerCells.length
    });
    
    // Apply drag preview with calculated target
    const column = this.state?.columns.find(col => col.id === this.dragState.columnId);
    const dragPreviewData: any = {
      draggedColumnId: this.dragState.columnId,
      columnName: column?.name || this.dragState.columnId,
      mouseX: params.mouseX,
      mouseY: params.mouseY,
      targetIndex: targetIndex,
      isInitialPreview: false
    };
    
    // Only include dropIndicatorX if we actually found a valid position
    if (dropIndicatorX !== -1000) {
      dragPreviewData.dropIndicatorX = dropIndicatorX;
    }
    
    this.applyDragPreview(dragPreviewData);
  }
  
  calculateColumnDropTarget(mouseX: number, useStoredTarget: boolean = false): number {
    if (!this.state?.columns || !this.dragState.columnId) {
      console.warn('CleanTableRenderer: calculateColumnDropTarget - missing required state');
      return -1;
    }
    
    // If explicitly asked to use stored target (for drag end), return it
    if (useStoredTarget && this._lastCalculatedTargetIndex >= 0) {
      const result = this._lastCalculatedTargetIndex;
      this._lastCalculatedTargetIndex = -1;
      return result;
    }
    
    const headerCells = Array.from(this.header.querySelectorAll('.vibegridx-header-cell:not([data-column="__selection"])'));
    const visibleColumns = this.state.columns.filter(col => col.id !== '__selection');
    
    // Get the index of the dragged column
    const draggedIndex = visibleColumns.findIndex(col => col.id === this.dragState.columnId);
    if (draggedIndex === -1) {
      return -1;
    }
    
    // Get bounds of the dragged column to check if we're still inside it
    const draggedCell = headerCells[draggedIndex] as HTMLElement;
    const draggedRect = draggedCell.getBoundingClientRect();
    
    // If mouse is still within the dragged column, return current index
    if (mouseX >= draggedRect.left && mouseX <= draggedRect.right) {
      return draggedIndex;
    }
    
    // Find the target position based on which side of columns we're on
    let targetIndex = draggedIndex;
    
    // Check each column to find where the mouse is
    for (let i = 0; i < headerCells.length; i++) {
      const cell = headerCells[i] as HTMLElement;
      const rect = cell.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      
      if (i < draggedIndex) {
        // For columns to the left of dragged column
        if (mouseX < midpoint) {
          targetIndex = i;
          break;
        }
      } else if (i > draggedIndex) {
        // For columns to the right of dragged column
        if (mouseX < midpoint) {
          // Insert before this column
          targetIndex = i;
          break;
        } else {
          // Keep checking, might insert after this column
          targetIndex = i + 1;
        }
      }
    }
    
    // Clamp to valid range
    targetIndex = Math.max(0, Math.min(targetIndex, headerCells.length));
    
    // Adjust for the removal of the dragged column
    if (targetIndex > draggedIndex) {
      targetIndex--;
    }
    
    console.log('CleanTableRenderer: calculateColumnDropTarget', {
      mouseX,
      draggedIndex,
      targetIndex,
      draggedColumnId: this.dragState.columnId,
      draggedRect: { left: draggedRect.left, right: draggedRect.right }
    });
    
    return targetIndex;
  }
  
  private completeColumnDrag(targetIndex: number): void {
    if (!this.dragState.columnId || !this.state?.columns || targetIndex < 0) return;
    
    // Get visible columns (excluding selection column)
    const visibleColumns = this.state.columns.filter(col => col.id !== '__selection');
    
    // Find current index in visible columns
    const currentIndex = visibleColumns.findIndex(col => col.id === this.dragState.columnId);
    if (currentIndex === -1) return;
    
    console.log('CleanTableRenderer: Completing column drag', {
      columnId: this.dragState.columnId,
      currentIndex,
      targetIndex
    });
    
    // Only reorder if position actually changed
    if (currentIndex !== targetIndex) {
      // Calculate the actual from/to indices for the reorder
      // These indices should be relative to visible columns only
      const fromIndex = currentIndex;
      const toIndex = targetIndex;
      
      console.log('CleanTableRenderer: Column reorder needed', {
        columnId: this.dragState.columnId,
        fromIndex,
        toIndex
      });
      
      // Call the onColumnDragEnd callback with proper event structure
      if (this.options.onColumnDragEnd) {
        (this.options.onColumnDragEnd as any)({
          type: 'view.columns.reorder',
          fromIndex,
          toIndex
        });
      }
    }
  }
  
  // ====================================
  // DRAG AND DROP
  // ====================================
  
  private _lastCalculatedTargetIndex: number = -1;
  
  applyDragPreview(dragPreview: any): void {
    // Log key information about the drag preview
    console.log('CleanTableRenderer: Applying drag preview', {
      draggedColumnId: dragPreview.draggedColumnId,
      columnName: dragPreview.columnName,
      mouseX: dragPreview.mouseX,
      mouseY: dragPreview.mouseY,
      hasDropIndicatorX: dragPreview.dropIndicatorX !== undefined,
      dropIndicatorX: dragPreview.dropIndicatorX,
      isInitialPreview: dragPreview.isInitialPreview
    });
    
    // Determine if this is a column or row drag
    const isColumnDrag = dragPreview.draggedColumnId !== undefined;
    const isRowDrag = dragPreview.draggedRowId !== undefined;
    
    // Create floating drag preview
    if (!this.dragPreview) {
      this.dragPreview = document.createElement('div');
      this.dragPreview.className = 'vibegridx-drag-preview';
      document.body.appendChild(this.dragPreview);
      console.log('CleanTableRenderer: Created drag preview element');
    }
    
    // Update content based on drag type
    if (isColumnDrag) {
      this.dragPreview.textContent = dragPreview.columnName || dragPreview.draggedColumnId;
      this.dragPreview.classList.add('vibegridx-drag-preview-column');
      this.dragPreview.classList.remove('vibegridx-drag-preview-row');
      
      // Initialize drag state if this is from EventDelegationManager (initial preview)
      if (dragPreview.isInitialPreview && !this.dragState.columnId) {
        this.dragState = {
          type: 'column',
          columnId: dragPreview.draggedColumnId,
          startX: dragPreview.mouseX,
          startWidth: 0
        };
        console.log('CleanTableRenderer: Initialized drag state from EventDelegationManager', this.dragState);
      }
    } else if (isRowDrag) {
      // For row drag, show row data or summary
      const rowData = dragPreview.rowData || {};
      this.dragPreview.textContent = rowData.title || rowData.name || `Row ${dragPreview.draggedRowId}`;
      this.dragPreview.classList.add('vibegridx-drag-preview-row');
      this.dragPreview.classList.remove('vibegridx-drag-preview-column');
    }
    
    // Update position with offset to follow cursor
    this.dragPreview.style.left = `${dragPreview.mouseX + 10}px`;
    this.dragPreview.style.top = `${dragPreview.mouseY + 10}px`;
    this.dragPreview.style.display = 'block';
    
    console.log('CleanTableRenderer: Drag preview positioned at', {
      left: this.dragPreview.style.left,
      top: this.dragPreview.style.top,
      display: this.dragPreview.style.display
    });
    
    // Apply drag-specific visual feedback
    if (isColumnDrag) {
      // Hide the original column being dragged (only on initial preview)
      if (dragPreview.isInitialPreview) {
        const headerCell = this.header.querySelector(`[data-column="${dragPreview.draggedColumnId}"]`) as HTMLElement;
        if (headerCell) {
          headerCell.style.opacity = '0.3';
          console.log('CleanTableRenderer: Made dragged column semi-transparent');
        }
      }
      
      // Calculate target index if not initial preview
      if (!dragPreview.isInitialPreview && dragPreview.mouseX) {
        // Ensure drag state has the dragged column ID
        if (!this.dragState.columnId) {
          this.dragState.columnId = dragPreview.draggedColumnId;
          this.dragState.type = 'column';
        }
        
        // Calculate where the column would be dropped
        const calculatedTargetIndex = this.calculateColumnDropTarget(dragPreview.mouseX);
        
        // Only update if target changed
        if (calculatedTargetIndex !== this._lastTargetIndex) {
          dragPreview.targetIndex = calculatedTargetIndex;
          this._lastTargetIndex = calculatedTargetIndex;
          this._lastCalculatedTargetIndex = calculatedTargetIndex;
          
          console.log('CleanTableRenderer: Target index changed', {
            mouseX: dragPreview.mouseX,
            targetIndex: calculatedTargetIndex,
            draggedColumn: dragPreview.draggedColumnId,
            draggedFromIndex: this.state?.columns?.filter(col => col.id !== '__selection').findIndex(col => col.id === dragPreview.draggedColumnId),
            wouldMoveTo: calculatedTargetIndex
          });
        } else {
          dragPreview.targetIndex = calculatedTargetIndex;
        }
      }
      
      // Show column drop indicator
      if (!dragPreview.isInitialPreview) {
        console.log('CleanTableRenderer: Showing column drop indicator', {
          targetIndex: dragPreview.targetIndex,
          isInitialPreview: dragPreview.isInitialPreview
        });
        this.showColumnDropIndicator(dragPreview);
      }
    } else if (isRowDrag) {
      // Hide the original row being dragged
      const rowEl = this.rowElements.get(dragPreview.draggedRowId);
      if (rowEl) {
        rowEl.style.opacity = '0.3';
      }
      
      // Show row drop indicator
      if (dragPreview.targetRowIndex >= 0 && !dragPreview.isInitialPreview) {
        this.showRowDropIndicator(dragPreview);
      }
    }
  }
  
  private showColumnDropIndicator(dragPreview: any): void {
    // Create drop indicator if it doesn't exist
    if (!this.dropIndicator) {
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'vibegridx-column-drop-indicator';
      this.dropIndicator.style.cssText = `
        position: absolute;
        top: 0;
        width: 3px;
        height: 40px;
        background-color: #3b82f6;
        pointer-events: none;
        z-index: 9999;
        opacity: 1;
        display: block;
      `;
      
      // Add to container at the table level to avoid any transform issues
      this.container.appendChild(this.dropIndicator);
    }
    
    // Position the drop indicator if we have created it
    if (this.dropIndicator) {
      const containerRect = this.container.getBoundingClientRect();
      const headerRect = this.header.getBoundingClientRect();
      
      // Show or hide the drop indicator based on whether we have a valid position
      if (dragPreview.dropIndicatorX !== undefined) {
        // Position relative to header top
        const headerTop = headerRect.top - containerRect.top;
        
        this.dropIndicator.style.left = `${dragPreview.dropIndicatorX}px`;
        this.dropIndicator.style.top = `${headerTop}px`;
        this.dropIndicator.style.height = `${headerRect.height}px`;
        this.dropIndicator.style.display = 'block';
        this.dropIndicator.style.opacity = '1';
        this.dropIndicator.style.zIndex = '1000';
        
        console.log('CleanTableRenderer: Drop indicator positioned', {
          targetIndex: dragPreview.targetIndex,
          dropIndicatorX: dragPreview.dropIndicatorX,
          headerTop,
          headerHeight: headerRect.height,
          indicatorElement: this.dropIndicator
        });
      } else {
        // Hide the drop indicator when within the dragged column
        this.dropIndicator.style.display = 'none';
        this.dropIndicator.style.opacity = '0';
        
        console.log('CleanTableRenderer: Drop indicator hidden - within dragged column');
      }
    }
  }
  
  private showRowDropIndicator(dragPreview: any): void {
    if (!this.dropIndicator) {
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'vibegridx-row-drop-indicator';
      this.body.appendChild(this.dropIndicator);
    }
    
    // Calculate drop position based on target row index
    const targetY = dragPreview.targetRowIndex * ROW_HEIGHT;
    this.dropIndicator.style.top = `${targetY}px`;
    this.dropIndicator.style.width = '100%';
    this.dropIndicator.style.opacity = '1';
  }
  
  clearDragPreview(): void {
    console.log('CleanTableRenderer: Clearing drag preview');
    
    // Remove drag preview
    if (this.dragPreview) {
      this.dragPreview.remove();
      this.dragPreview = null;
      console.log('CleanTableRenderer: Removed drag preview element');
    }
    
    // Hide and remove drop indicator
    if (this.dropIndicator) {
      this.dropIndicator.remove();
      this.dropIndicator = null;
      console.log('CleanTableRenderer: Removed drop indicator');
    }
    
    // Reset target index tracking
    this._lastTargetIndex = -1;
    this._lastCalculatedTargetIndex = -1;
    
    // Restore column opacity
    const columns = this.header.querySelectorAll('.vibegridx-header-cell');
    columns.forEach((col: Element) => {
      (col as HTMLElement).style.opacity = '';
    });
    
    // Restore row opacity
    this.rowElements.forEach((rowEl) => {
      rowEl.style.opacity = '';
    });
    
    // Remove dragging class from body
    document.body.classList.remove('vibegridx-dragging-active');
    
    // Defer clearing drag state to allow final calculations
    setTimeout(() => {
      this.dragState = {
        type: null,
        columnId: null,
        startX: 0,
        startWidth: 0
      };
      console.log('CleanTableRenderer: Cleared drag state (deferred)');
    }, 100);
  }
  
  // ====================================
  // COORDINATE MAPPING
  // ====================================
  
  updateCoordinateMapping(mapping: any, version: number): void {
    // Store the coordinate mapping for internal use
    if (this.state) {
      this.state.coordinateMapping = mapping;
    }
    
    console.log('CleanTableRenderer: Updated coordinate mapping', {
      version,
      columnCount: mapping?.columns?.length
    });
    
    // Apply new column widths to DOM immediately
    this.applyColumnWidths(mapping);
  }
  
  private applyColumnWidths(mapping: any): void {
    if (!mapping?.columns) return;
    
    // Update header cell widths
    mapping.columns.forEach((colMapping: any) => {
      const headerCell = this.header?.querySelector(`[data-column="${colMapping.columnId}"]`) as HTMLElement;
      if (headerCell) {
        headerCell.style.width = `${colMapping.width}px`;
      }
      
      // Update body cell widths for all visible rows
      const bodyCells = this.tbody?.querySelectorAll(`[data-column="${colMapping.columnId}"]`) as NodeListOf<HTMLElement>;
      bodyCells?.forEach(cell => {
        cell.style.width = `${colMapping.width}px`;
      });
    });
    
    console.log('CleanTableRenderer: Applied column widths to DOM', {
      columnCount: mapping.columns.length
    });
  }
  
  // ====================================
  // PUBLIC API
  // =====================================
  
  updateRow(rowId: string, newData: any): void {
    const row = this.state?.rows.find(r => r.id === rowId);
    if (!row) return;
    
    // Update data - this should already be fully resolved from the store
    row.data = newData;
    
    console.log('CleanTableRenderer: Row updated with store data', {
      rowId,
      hasResolvedValues: Object.keys(newData).filter(k => k.includes('__resolved_')).length > 0
    });
    
    // Re-render cells if row is visible
    const rowEl = this.rowElements.get(rowId);
    if (rowEl && this.state) {
      this.renderCells(row, rowEl, this.state);
    }
  }
  
  setSelectedRows(selectedRows: Set<string>): void {
    this.selectedRows = selectedRows;
    this.updateAllCheckboxes();
    this.updateHeaderCheckbox();
  }
  
  destroy(): void {
    this.viewport.removeEventListener('scroll', this.handleScroll);
    // Header click listener removed - handled by EventDelegationManager
    // this.header.removeEventListener('click', this.handleHeaderClick);
    // Mouse listeners removed - handled by EventDelegationManager
    // this.header.removeEventListener('mousedown', this.handleHeaderMouseDown);
    this.table.removeEventListener('change', this.handleCheckboxChange);
    
    // Cancel any pending RAF
    if (this._scrollRAF) {
      cancelAnimationFrame(this._scrollRAF);
      this._scrollRAF = null;
    }
    
    // Clear drag preview if exists
    this.clearDragPreview();
    
    // Clear from window
    if ((window as any).__vibegridx_renderer_instance === this) {
      delete (window as any).__vibegridx_renderer_instance;
    }
    
    this.rowElements.clear();
    this.cellElements.clear();
    this.container.innerHTML = '';
  }
}