/**
 * UltraTableRenderer - High-Performance Table Renderer
 * 
 * Extracted from VibeGrid's CleanTableRenderer with Legend State integration.
 * Features:
 * - Direct DOM manipulation for maximum performance
 * - Virtual scrolling with intelligent buffering
 * - Element caching and reuse
 * - Legend State reactive updates
 * - RequestAnimationFrame optimization
 */

import type { Column, RendererOptions, ViewportInfo, RenderMetrics } from '../types';
import { UltraCellPipeline } from './UltraCellPipeline';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/ultratable/core/UltraTableRenderer.ts');

// Performance constants from VibeGrid
const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_HEADER_HEIGHT = 40;
const DEFAULT_BUFFER_ROWS = 5;
const SELECTION_COLUMN_WIDTH = 48;

interface RowElement {
  element: HTMLElement;
  rowId: string;
  lastUpdate: number;
}

interface CellCache {
  element: HTMLElement;
  content: string;
  lastUpdate: number;
}

export class UltraTableRenderer {
  // Core DOM elements
  private container: HTMLElement;
  private tableWrapper: HTMLElement;
  private headerContainer: HTMLElement;
  private bodyContainer: HTMLElement;
  private viewport: HTMLElement;
  
  // Configuration
  private options: RendererOptions;
  private rowHeight: number;
  private headerHeight: number;
  private bufferRows: number;
  
  // Data state
  private entities: any[] = [];
  private columns: Column[] = [];
  private sortBy: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
  
  // View state
  private selectedRows = new Set<string>();
  private selectedCells = new Set<string>();
  private editingCell: { rowId: string; columnId: string } | null = null;
  
  // Virtual scrolling state
  private viewportInfo: ViewportInfo = {
    scrollTop: 0,
    scrollLeft: 0,
    containerWidth: 0,
    containerHeight: 0,
    visibleStart: 0,
    visibleEnd: 0,
    totalRows: 0
  };
  
  // Element caches (performance critical)
  private rowCache = new Map<string, RowElement>();
  private cellCache = new Map<string, CellCache>(); // key: "rowId:columnId"
  private headerCells = new Map<string, HTMLElement>();
  
  // Performance tracking
  private renderMetrics: RenderMetrics = {
    renderTime: 0,
    cellCount: 0,
    visibleRows: 0,
    totalRows: 0,
    fps: 0
  };
  
  // RAF optimization
  private scrollRAF: number | null = null;
  private renderRAF: number | null = null;
  
  // Column coordinate cache
  private columnCoordinates: Array<{
    columnId: string;
    offset: number;
    width: number;
  }> = [];
  
  constructor(options: RendererOptions) {
    this.options = options;
    this.container = options.container;
    this.columns = options.columns;
    this.rowHeight = options.rowHeight || DEFAULT_ROW_HEIGHT;
    this.headerHeight = DEFAULT_HEADER_HEIGHT;
    this.bufferRows = options.bufferRows || DEFAULT_BUFFER_ROWS;
    
    if (options.debug) {
      log.info('[UltraTableRenderer] Initializing with options:', {
        entityType: options.entityType,
        columnCount: options.columns.length,
        rowHeight: this.rowHeight,
        bufferRows: this.bufferRows
      });
    }
    
    this.initializeDOM();
    this.setupEventHandlers();
    this.calculateColumnCoordinates();
    
    // Initial render
    this.renderHeader();
    this.updateViewport();
  }
  
  // ====================================
  // DOM INITIALIZATION
  // ====================================
  
  private initializeDOM(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Create table structure
    this.tableWrapper = this.createElement('div', 'ultra-table-wrapper');
    this.headerContainer = this.createElement('div', 'ultra-header-container');
    this.viewport = this.createElement('div', 'ultra-viewport');
    this.bodyContainer = this.createElement('div', 'ultra-body-container');
    
    // Apply core styles
    Object.assign(this.tableWrapper.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    });
    
    Object.assign(this.headerContainer.style, {
      height: `${this.headerHeight}px`,
      overflow: 'hidden',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--muted)',
      position: 'relative',
      flexShrink: '0'
    });
    
    Object.assign(this.viewport.style, {
      flex: '1',
      overflow: 'auto',
      position: 'relative'
    });
    
    Object.assign(this.bodyContainer.style, {
      position: 'relative',
      minHeight: '100%'
    });
    
    // Assemble DOM structure
    this.viewport.appendChild(this.bodyContainer);
    this.tableWrapper.appendChild(this.headerContainer);
    this.tableWrapper.appendChild(this.viewport);
    this.container.appendChild(this.tableWrapper);
    
    if (this.options.debug) {
      log.info('[UltraTableRenderer] DOM structure initialized');
    }
  }
  
  // ====================================
  // DATA MANAGEMENT
  // ====================================
  
  updateData(entities: any[]): void {
    const startTime = performance.now();
    
    this.entities = entities;
    this.viewportInfo.totalRows = entities.length;
    
    // Update body container height for virtual scrolling
    const totalHeight = entities.length * this.rowHeight;
    this.bodyContainer.style.height = `${totalHeight}px`;
    
    // Update viewport and re-render
    this.updateViewport();
    this.renderVisibleRows();
    
    this.renderMetrics.renderTime = performance.now() - startTime;
    this.renderMetrics.totalRows = entities.length;
    
    if (this.options.debug && entities.length > 0) {
      log.info('[UltraTableRenderer] Data updated:', {
        entityCount: entities.length,
        renderTime: Math.round(this.renderMetrics.renderTime * 100) / 100,
        visibleRange: `${this.viewportInfo.visibleStart}-${this.viewportInfo.visibleEnd}`
      });
    }
  }
  
  // ====================================
  // HEADER RENDERING
  // ====================================
  
  private renderHeader(): void {
    // Clear existing header
    this.headerContainer.innerHTML = '';
    this.headerCells.clear();
    
    const headerRow = this.createElement('div', 'ultra-header-row');
    Object.assign(headerRow.style, {
      display: 'flex',
      height: '100%',
      width: 'fit-content'
    });
    
    // Add selection column if enabled
    if (this.options.enableSelectionColumn) {
      const selectionHeader = this.createSelectionHeader();
      headerRow.appendChild(selectionHeader);
    }
    
    // Add data columns
    this.columns.forEach((column, index) => {
      const headerCell = this.createHeaderCell(column, index);
      headerRow.appendChild(headerCell);
      this.headerCells.set(column.id, headerCell);
    });
    
    this.headerContainer.appendChild(headerRow);
    
    if (this.options.debug) {
      log.info('[UltraTableRenderer] Header rendered with', this.columns.length, 'columns');
    }
  }
  
  private createSelectionHeader(): HTMLElement {
    const cell = this.createElement('div', 'ultra-header-cell ultra-selection-header');
    Object.assign(cell.style, {
      width: `${SELECTION_COLUMN_WIDTH}px`,
      minWidth: `${SELECTION_COLUMN_WIDTH}px`,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRight: '1px solid var(--border)',
      flexShrink: '0'
    });
    
    // Add select all checkbox
    const checkbox = this.createCheckbox(false);
    checkbox.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked) {
        this.selectAllRows();
      } else {
        this.clearSelection();
      }
    });
    
    cell.appendChild(checkbox);
    return cell;
  }
  
  private createHeaderCell(column: Column, index: number): HTMLElement {
    const cell = this.createElement('div', 'ultra-header-cell');
    cell.dataset.columnId = column.id;
    cell.dataset.field = column.field || column.id;
    
    const coordinate = this.columnCoordinates[index];
    const width = coordinate?.width || column.width || 120;
    
    Object.assign(cell.style, {
      width: `${width}px`,
      minWidth: `${width}px`,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRight: '1px solid var(--border)',
      cursor: column.sortable !== false ? 'pointer' : 'default',
      userSelect: 'none',
      flexShrink: '0',
      backgroundColor: 'transparent'
    });
    
    // Header content
    const content = this.createElement('div', 'ultra-header-content');
    Object.assign(content.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flex: '1',
      overflow: 'hidden'
    });
    
    // Column title
    const title = this.createElement('span', 'ultra-header-title');
    title.textContent = column.name || column.id;
    Object.assign(title.style, {
      fontWeight: '600',
      fontSize: '14px',
      color: 'var(--foreground)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });
    
    content.appendChild(title);
    
    // Sort indicator
    if (column.sortable !== false) {
      const sortIcon = this.createSortIcon(column.id);
      content.appendChild(sortIcon);
    }
    
    cell.appendChild(content);
    
    // Click handler for sorting
    if (column.sortable !== false) {
      cell.addEventListener('click', () => {
        this.handleColumnSort(column.id);
      });
    }
    
    return cell;
  }
  
  private createSortIcon(columnId: string): HTMLElement {
    const icon = this.createElement('span', 'ultra-sort-icon');
    const sortConfig = this.sortBy.find(s => s.field === columnId);
    
    Object.assign(icon.style, {
      width: '12px',
      height: '12px',
      flexShrink: '0',
      opacity: sortConfig ? '1' : '0.4'
    });
    
    const direction = sortConfig?.direction || 'asc';
    const upOpacity = direction === 'asc' ? '1' : '0.3';
    const downOpacity = direction === 'desc' ? '1' : '0.3';
    
    icon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" opacity="${upOpacity}"/>
        <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" opacity="${downOpacity}"/>
      </svg>
    `;
    
    return icon;
  }
  
  // ====================================
  // ROW RENDERING WITH VIRTUAL SCROLLING
  // ====================================
  
  private renderVisibleRows(): void {
    if (this.renderRAF) {
      cancelAnimationFrame(this.renderRAF);
    }
    
    this.renderRAF = requestAnimationFrame(() => {
      const startTime = performance.now();
      
      const visibleEntities = this.entities.slice(
        this.viewportInfo.visibleStart, 
        this.viewportInfo.visibleEnd
      );
      
      // Track which rows are currently needed
      const neededRowIds = new Set(visibleEntities.map(entity => entity.id));
      
      // Remove rows that are no longer visible
      this.cleanupInvisibleRows(neededRowIds);
      
      // Render visible rows
      visibleEntities.forEach((entity, index) => {
        const absoluteIndex = this.viewportInfo.visibleStart + index;
        this.renderRow(entity, absoluteIndex);
      });
      
      this.renderMetrics.renderTime = performance.now() - startTime;
      this.renderMetrics.visibleRows = visibleEntities.length;
      this.renderMetrics.cellCount = visibleEntities.length * this.columns.length;
      
      this.renderRAF = null;
    });
  }
  
  private renderRow(entity: any, absoluteIndex: number): void {
    let rowElement = this.rowCache.get(entity.id)?.element;
    
    if (!rowElement) {
      // Create new row element
      rowElement = this.createRowElement(entity, absoluteIndex);
      this.rowCache.set(entity.id, {
        element: rowElement,
        rowId: entity.id,
        lastUpdate: Date.now()
      });
      this.bodyContainer.appendChild(rowElement);
    } else {
      // Update position
      rowElement.style.top = `${absoluteIndex * this.rowHeight}px`;
    }
    
    // Render cells
    this.renderRowCells(entity, rowElement);
  }
  
  private createRowElement(entity: any, absoluteIndex: number): HTMLElement {
    const row = this.createElement('div', 'ultra-row');
    row.dataset.rowId = entity.id;
    
    Object.assign(row.style, {
      position: 'absolute',
      top: `${absoluteIndex * this.rowHeight}px`,
      left: '0',
      width: 'fit-content',
      height: `${this.rowHeight}px`,
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--background)'
    });
    
    // Add hover effect
    row.addEventListener('mouseenter', () => {
      row.style.backgroundColor = 'var(--muted)';
    });
    
    row.addEventListener('mouseleave', () => {
      row.style.backgroundColor = 'var(--background)';
    });
    
    return row;
  }
  
  private renderRowCells(entity: any, rowElement: HTMLElement): void {
    // Clear existing cells
    rowElement.innerHTML = '';
    
    // Add selection cell if enabled
    if (this.options.enableSelectionColumn) {
      const selectionCell = this.createSelectionCell(entity.id);
      rowElement.appendChild(selectionCell);
    }
    
    // Add data cells
    this.columns.forEach((column, columnIndex) => {
      const cell = this.createDataCell(entity, column, columnIndex);
      rowElement.appendChild(cell);
    });
  }
  
  private createSelectionCell(rowId: string): HTMLElement {
    const cell = this.createElement('div', 'ultra-cell ultra-selection-cell');
    Object.assign(cell.style, {
      width: `${SELECTION_COLUMN_WIDTH}px`,
      minWidth: `${SELECTION_COLUMN_WIDTH}px`,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRight: '1px solid var(--border)',
      flexShrink: '0'
    });
    
    const checkbox = this.createCheckbox(this.selectedRows.has(rowId));
    checkbox.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked) {
        this.selectedRows.add(rowId);
      } else {
        this.selectedRows.delete(rowId);
      }
      this.notifySelectionChange();
    });
    
    cell.appendChild(checkbox);
    return cell;
  }
  
  private createDataCell(entity: any, column: Column, columnIndex: number): HTMLElement {
    const cell = this.createElement('div', 'ultra-cell ultra-data-cell');
    cell.dataset.rowId = entity.id;
    cell.dataset.columnId = column.id;
    
    const coordinate = this.columnCoordinates[columnIndex];
    const width = coordinate?.width || column.width || 120;
    
    Object.assign(cell.style, {
      width: `${width}px`,
      minWidth: `${width}px`,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRight: '1px solid var(--border)',
      overflow: 'hidden',
      flexShrink: '0'
    });
    
    // Render cell content using UltraCellPipeline
    const value = entity[column.field || column.id];
    const content = UltraCellPipeline.createCellContent(value, column, entity);
    cell.appendChild(content);
    
    // Add click handler
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleCellClick(entity.id, column.id, value, entity);
    });
    
    // Add double-click handler for editing
    cell.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.handleCellDoubleClick(entity.id, column.id, value, entity);
    });
    
    return cell;
  }
  
  // ====================================
  // VIEWPORT AND VIRTUAL SCROLLING
  // ====================================
  
  private updateViewport(): void {
    if (!this.viewport || !this.entities.length) return;
    
    const containerRect = this.viewport.getBoundingClientRect();
    this.viewportInfo.containerWidth = containerRect.width;
    this.viewportInfo.containerHeight = containerRect.height;
    this.viewportInfo.scrollTop = this.viewport.scrollTop;
    this.viewportInfo.scrollLeft = this.viewport.scrollLeft;
    
    // Calculate visible row range with buffer
    const visibleStart = Math.max(0, 
      Math.floor(this.viewportInfo.scrollTop / this.rowHeight) - this.bufferRows
    );
    const visibleEnd = Math.min(this.entities.length,
      Math.ceil((this.viewportInfo.scrollTop + this.viewportInfo.containerHeight) / this.rowHeight) + this.bufferRows
    );
    
    if (visibleStart !== this.viewportInfo.visibleStart || visibleEnd !== this.viewportInfo.visibleEnd) {
      this.viewportInfo.visibleStart = visibleStart;
      this.viewportInfo.visibleEnd = visibleEnd;
      
      if (this.options.debug) {
        log.info('[UltraTableRenderer] Viewport updated:', {
          scrollTop: this.viewportInfo.scrollTop,
          visibleRange: `${visibleStart}-${visibleEnd}`,
          totalRows: this.entities.length
        });
      }
    }
  }
  
  private cleanupInvisibleRows(neededRowIds: Set<string>): void {
    const rowsToRemove: string[] = [];
    
    this.rowCache.forEach((rowData, rowId) => {
      if (!neededRowIds.has(rowId)) {
        rowsToRemove.push(rowId);
        rowData.element.remove();
        
        // Clean up cell cache for this row
        this.cellCache.forEach((_, cellKey) => {
          if (cellKey.startsWith(`${rowId}:`)) {
            this.cellCache.delete(cellKey);
          }
        });
      }
    });
    
    rowsToRemove.forEach(rowId => {
      this.rowCache.delete(rowId);
    });
  }
  
  // ====================================
  // EVENT HANDLING
  // ====================================
  
  private setupEventHandlers(): void {
    // Scroll handler with RAF optimization
    this.viewport.addEventListener('scroll', () => {
      if (this.scrollRAF) return;
      
      this.scrollRAF = requestAnimationFrame(() => {
        this.viewportInfo.scrollTop = this.viewport.scrollTop;
        this.viewportInfo.scrollLeft = this.viewport.scrollLeft;
        
        this.updateViewport();
        this.renderVisibleRows();
        this.syncHeaderScroll();
        
        // Notify scroll
        this.options.onScroll?.(this.viewportInfo.scrollTop, this.viewportInfo.scrollLeft);
        
        this.scrollRAF = null;
      });
    });
    
    if (this.options.debug) {
      log.info('[UltraTableRenderer] Event handlers set up');
    }
  }
  
  private syncHeaderScroll(): void {
    // Sync header horizontal scroll with body
    this.headerContainer.style.transform = `translateX(-${this.viewportInfo.scrollLeft}px)`;
  }
  
  private handleCellClick(rowId: string, columnId: string, value: any, rowData: any): void {
    this.options.onCellClick?.(rowId, columnId, value, rowData);
  }
  
  private handleCellDoubleClick(rowId: string, columnId: string, value: any, rowData: any): void {
    this.options.onCellDoubleClick?.(rowId, columnId, value, rowData);
  }
  
  private handleColumnSort(columnId: string): void {
    const currentSort = this.sortBy.find(s => s.field === columnId);
    let direction: 'asc' | 'desc' | null = 'asc';
    
    if (currentSort) {
      if (currentSort.direction === 'asc') {
        direction = 'desc';
      } else {
        direction = null; // Remove sort
      }
    }
    
    if (direction) {
      this.sortBy = [{ field: columnId, direction }];
    } else {
      this.sortBy = [];
    }
    
    // Update sort icon
    const headerCell = this.headerCells.get(columnId);
    if (headerCell) {
      const sortIcon = headerCell.querySelector('.ultra-sort-icon');
      if (sortIcon) {
        const upOpacity = direction === 'asc' ? '1' : '0.3';
        const downOpacity = direction === 'desc' ? '1' : '0.3';
        
        sortIcon.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" opacity="${upOpacity}"/>
            <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" opacity="${downOpacity}"/>
          </svg>
        `;
      }
    }
    
    this.options.onColumnSort?.(columnId, direction);
  }
  
  // ====================================
  // SELECTION MANAGEMENT
  // ====================================
  
  private selectAllRows(): void {
    this.selectedRows = new Set(this.entities.map(entity => entity.id));
    this.notifySelectionChange();
    this.updateSelectionUI();
  }
  
  clearSelection(): void {
    this.selectedRows.clear();
    this.selectedCells.clear();
    this.notifySelectionChange();
    this.updateSelectionUI();
  }
  
  private updateSelectionUI(): void {
    // Update all visible checkboxes
    this.rowCache.forEach((rowData) => {
      const checkbox = rowData.element.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = this.selectedRows.has(rowData.rowId);
      }
    });
    
    // Update header checkbox
    const headerCheckbox = this.headerContainer.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (headerCheckbox) {
      const allSelected = this.entities.length > 0 && 
        this.entities.every(entity => this.selectedRows.has(entity.id));
      headerCheckbox.checked = allSelected;
    }
  }
  
  private notifySelectionChange(): void {
    this.options.onSelectionChange?.(this.selectedRows, this.selectedCells);
  }
  
  // ====================================
  // UTILITIES
  // ====================================
  
  private calculateColumnCoordinates(): void {
    this.columnCoordinates = [];
    let offset = 0;
    
    // Add selection column if enabled
    if (this.options.enableSelectionColumn) {
      offset += SELECTION_COLUMN_WIDTH;
    }
    
    this.columns.forEach((column, index) => {
      const width = column.width || 120;
      this.columnCoordinates.push({
        columnId: column.id,
        offset,
        width
      });
      offset += width;
    });
  }
  
  private createElement(tag: string, className: string): HTMLElement {
    const element = document.createElement(tag);
    element.className = className;
    return element;
  }
  
  private createCheckbox(checked: boolean): HTMLInputElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ultra-checkbox';
    checkbox.checked = checked;
    
    Object.assign(checkbox.style, {
      width: '16px',
      height: '16px',
      cursor: 'pointer'
    });
    
    return checkbox;
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  getSelectedRows(): Set<string> {
    return new Set(this.selectedRows);
  }
  
  scrollToRow(rowId: string): void {
    const index = this.entities.findIndex(entity => entity.id === rowId);
    if (index >= 0) {
      const scrollTop = index * this.rowHeight;
      this.viewport.scrollTop = scrollTop;
    }
  }
  
  refresh(): void {
    this.updateViewport();
    this.renderVisibleRows();
  }
  
  getMetrics(): RenderMetrics {
    return { ...this.renderMetrics };
  }
  
  destroy(): void {
    // Cancel any pending animations
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
      this.scrollRAF = null;
    }
    
    if (this.renderRAF) {
      cancelAnimationFrame(this.renderRAF);
      this.renderRAF = null;
    }
    
    // Clear caches
    this.rowCache.clear();
    this.cellCache.clear();
    this.headerCells.clear();
    
    // Clear container
    this.container.innerHTML = '';
    
    if (this.options.debug) {
      log.info('[UltraTableRenderer] Destroyed and cleaned up');
    }
  }
}