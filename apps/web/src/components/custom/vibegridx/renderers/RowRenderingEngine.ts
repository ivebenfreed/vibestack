// ====================================
// ROW RENDERING ENGINE
// ====================================

import type { TableRow, Column, RenderState, OptimisticOperation } from '../types';
import { CellRenderingPipeline } from './CellRenderingPipeline';
import type { VirtualGridManager } from './VirtualGridManager';
import type { ColumnManager } from './ColumnManager';
import type { DOMStructureManager } from './DOMStructureManager';
import type { SelectionManager } from './SelectionManager';

// ====================================
// CONSTANTS
// ====================================

const CSS_CLASSES = {
  ROW: 'vibegridx-row',
  CELL: 'vibegridx-cell',
  SELECTED: 'vibegridx-selected',
  EDITING: 'vibegridx-editing',
  DIRTY: 'vibegridx-dirty',
  OPTIMISTIC: 'vibegridx-optimistic'
} as const;

// ====================================
// TYPES
// ====================================

export interface RowRenderingEngineConfig {
  virtualGrid: VirtualGridManager;
  columnManager: ColumnManager;
  domManager: DOMStructureManager;
  selectionManager: SelectionManager;
  rowHeight: number;
  enableSelectionColumn: boolean;
}

export interface RowRenderMetrics {
  rowsRendered: number;
  cellsRendered: number;
  renderTime: number;
}

// ====================================
// ROW RENDERING ENGINE
// ====================================

export class RowRenderingEngine {
  private config: RowRenderingEngineConfig;
  private lastDimensions = { height: 0, width: 0 };
  
  constructor(config: RowRenderingEngineConfig) {
    this.config = config;
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  /**
   * Render all visible rows
   */
  renderVisibleRows(state: RenderState): RowRenderMetrics {
    const startTime = performance.now();
    
    const visibleRange = this.config.virtualGrid.getVisibleRange();
    console.log('🎨 RowRenderingEngine: renderVisibleRows', {
      visibleRange,
      stateRowsLength: state.rows.length,
      sliceResult: state.rows.slice(visibleRange.start, visibleRange.end).length
    });
    
    const visibleRows = state.rows.slice(visibleRange.start, visibleRange.end);
    
    // Update virtual dimensions
    this.updateVirtualDimensions();
    
    // Handle empty visible rows case
    let rowsToRender = visibleRows;
    if (visibleRows.length === 0 && state.rows.length > 0) {
      console.warn('PERFORMANCE ISSUE: visibleRows is empty! Using fallback to render first 20 rows.');
      rowsToRender = state.rows.slice(0, Math.min(20, state.rows.length));
    }
    
    // Clean up rows that are no longer visible
    this.cleanupInvisibleRows(rowsToRender);
    
    // Render visible rows with batched DOM updates
    const cellCount = this.renderRowsBatched(rowsToRender, visibleRange.start, state);
    
    const renderTime = performance.now() - startTime;
    
    return {
      rowsRendered: rowsToRender.length,
      cellsRendered: cellCount,
      renderTime
    };
  }
  
  /**
   * Update a single row
   */
  updateRow(row: TableRow, state?: RenderState): void {
    const rowElement = this.config.domManager.getRowElement(row.id);
    if (!rowElement) {
      return;
    }
    
    const startTime = performance.now();
    
    // Update row content
    this.renderRowCells(row, rowElement, state);
    
    // Update row state
    rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
    
    const duration = performance.now() - startTime;
    if (duration > 0.5 * 10) { // Warn if row update is slow
      console.log(`RowRenderingEngine: Slow row update ${row.id} took ${duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Update multiple rows
   */
  updateRows(rows: TableRow[], state?: RenderState): void {
    const startTime = performance.now();
    
    rows.forEach(row => {
      const rowElement = this.config.domManager.getRowElement(row.id);
      if (rowElement) {
        this.renderRowCells(row, rowElement, state);
        rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
      }
    });
    
    const duration = performance.now() - startTime;
    if (duration > 0.5 * rows.length) { // Warn if updates are slow
      console.log(`RowRenderingEngine: Slow batch update - ${rows.length} rows took ${duration.toFixed(2)}ms`);
    }
  }
  
  /**
   * Apply optimistic operations to cells
   */
  applyOptimisticOperations(operations: Map<string, OptimisticOperation> | undefined): void {
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
  
  // ====================================
  // PRIVATE METHODS
  // ====================================
  
  private updateVirtualDimensions(): void {
    const totalHeight = this.config.virtualGrid.getTotalHeight();
    const totalWidth = this.getTotalColumnsWidth();
    
    // Batch DOM style updates
    this.config.domManager.getElement('body').style.height = `${totalHeight}px`;
    this.config.domManager.getElement('body').style.width = `${totalWidth}px`;
    
    // Handle viewport overflow
    const maxScroll = totalHeight - this.config.domManager.getElement('viewport').clientHeight;
    if (maxScroll > 0) {
      this.config.domManager.getElement('viewport').style.overflowY = 'scroll';
    }
    
    // Track dimension changes
    if (totalHeight !== this.lastDimensions.height || totalWidth !== this.lastDimensions.width) {
      this.lastDimensions = { height: totalHeight, width: totalWidth };
    }
  }
  
  private cleanupInvisibleRows(visibleRows: TableRow[]): void {
    this.config.domManager.forEachRowElement((element, rowId) => {
      if (!visibleRows.find(row => row.id === rowId)) {
        this.config.domManager.removeRowElement(rowId);
      }
    });
  }
  
  private renderRowsBatched(rows: TableRow[], startIndex: number, state?: RenderState): number {
    const fragment = document.createDocumentFragment();
    const newRowElements: Array<{ element: HTMLElement; rowId: string }> = [];
    let totalCells = 0;
    
    // Pre-create new rows in fragment (batched DOM insertion)
    rows.forEach((row, index) => {
      const absoluteIndex = startIndex + index;
      
      let rowElement = this.config.domManager.getRowElement(row.id);
      if (!rowElement) {
        rowElement = this.createRowElement(row);
        newRowElements.push({ element: rowElement, rowId: row.id });
        fragment.appendChild(rowElement);
      }
      
      // Position and update row content
      this.updateRowElement(row, rowElement, absoluteIndex, state);
      totalCells += this.getColumnCount(state);
    });
    
    // Single DOM append for all new rows
    if (newRowElements.length > 0) {
      this.config.domManager.getElement('body').appendChild(fragment);
      
      // Register new elements
      newRowElements.forEach(({ element, rowId }) => {
        this.config.domManager.setRowElement(rowId, element);
      });
    }
    
    return totalCells;
  }
  
  private createRowElement(row: TableRow): HTMLElement {
    const rowElement = document.createElement('div');
    rowElement.className = CSS_CLASSES.ROW;
    rowElement.dataset.rowId = row.id;
    rowElement.style.borderBottom = '1px solid var(--border)';
    rowElement.style.boxSizing = 'border-box';
    return rowElement;
  }
  
  private updateRowElement(row: TableRow, rowElement: HTMLElement, index: number, state?: RenderState): void {
    // Position row
    const top = this.config.virtualGrid.getRowTop(index);
    rowElement.style.position = 'absolute';
    rowElement.style.top = `${top}px`;
    rowElement.style.left = '0px';
    
    // Calculate total width from columns
    const totalWidth = this.getTotalColumnsWidth();
    rowElement.style.width = `${totalWidth}px`;
    rowElement.style.height = `${this.config.virtualGrid.getRowHeight()}px`;
    
    // Update row content
    this.renderRowCells(row, rowElement, state);
    
    // Apply row state styling
    rowElement.classList.toggle(CSS_CLASSES.DIRTY, row.metadata.isDirty || false);
  }
  
  private renderRowCells(row: TableRow, rowElement: HTMLElement, state?: RenderState): void {
    // Get columns to render
    const columnsToRender = this.getColumnsToRender(row, state);
    
    // Clear existing content efficiently
    rowElement.textContent = '';
    
    // Create document fragment for batched insertion
    const fragment = document.createDocumentFragment();
    
    // Add selection checkbox cell if enabled
    if (this.config.enableSelectionColumn) {
      const selectionCell = this.createSelectionCell(row);
      fragment.appendChild(selectionCell);
    }
    
    // Add data cells
    columnsToRender.forEach((column, index) => {
      const cell = this.createDataCell(row, column, index, columnsToRender);
      fragment.appendChild(cell);
    });
    
    // Single DOM insertion
    rowElement.appendChild(fragment);
  }
  
  private createSelectionCell(row: TableRow): HTMLElement {
    const cellKey = `${row.id}:__selection`;
    const isRowSelected = this.config.selectionManager.isRowSelected(row.id);
    
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
      height: `${this.config.rowHeight}px`,
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
    
    this.config.domManager.setCellElement(row.id, '__selection', cell);
    
    return cell;
  }
  
  private createDataCell(row: TableRow, column: Column, index: number, allColumns: Column[]): HTMLElement {
    const cellKey = `${row.id}:${column.id}`;
    const value = row.data[column.field || column.id];
    const width = this.config.columnManager.getColumnWidth(column.id);
    
    // Calculate offset
    const xOffset = this.calculateCellOffset(index, allColumns);
    
    // Create cell element
    const cell = document.createElement('div');
    cell.className = CSS_CLASSES.CELL;
    cell.setAttribute('data-row-id', row.id);
    cell.setAttribute('data-column-id', column.id);
    cell.setAttribute('data-cell-key', cellKey);
    cell.setAttribute('role', 'gridcell');
    
    // Apply state classes
    const isSelected = this.config.selectionManager.isCellSelected(row.id, column.id);
    const isEditing = this.config.selectionManager.isCellEditing(row.id, column.id);
    const isDirty = row.metadata.isDirty || false;
    
    if (isSelected) cell.classList.add(CSS_CLASSES.SELECTED);
    if (isEditing) cell.classList.add(CSS_CLASSES.EDITING);
    if (isDirty) cell.classList.add(CSS_CLASSES.DIRTY);
    
    // Style cell
    Object.assign(cell.style, {
      position: 'absolute',
      left: `${xOffset}px`,
      width: `${width}px`,
      height: `${this.config.rowHeight}px`,
      borderRight: '1px solid var(--border)',
      boxSizing: 'border-box',
      overflow: 'hidden'
    });
    
    // Create content using CellRenderingPipeline
    const content = CellRenderingPipeline.createCellContent(value, column, row.data);
    cell.appendChild(content);
    
    this.config.domManager.setCellElement(row.id, column.id, cell);
    
    return cell;
  }
  
  private getColumnsToRender(row: TableRow, state?: RenderState): Column[] {
    // Use columns from render state if available
    const stateColumns = state?.columns;
    if (stateColumns && stateColumns.length > 0) {
      return stateColumns.filter(col => col.id !== '__selection');
    }
    
    // Fall back to visible columns from column manager
    const visibleColumns = this.config.columnManager.getVisibleColumns();
    if (visibleColumns.length > 0) {
      return this.config.columnManager.getDataColumns();
    }
    
    // Last resort: create columns from row data
    return Object.keys(row.data).map(key => ({
      id: key,
      name: key,
      field: key,
      type: 'text' as const,
      width: 120
    }));
  }
  
  private calculateCellOffset(index: number, columns: Column[]): number {
    let offset = this.config.enableSelectionColumn ? 48 : 0; // Start after selection column if enabled
    
    for (let i = 0; i < index; i++) {
      const prevColumn = columns[i];
      const prevWidth = this.config.columnManager.getColumnWidth(prevColumn.id);
      offset += prevWidth;
    }
    
    return offset;
  }
  
  private getTotalColumnsWidth(): number {
    let totalWidth = this.config.enableSelectionColumn ? 48 : 0; // Selection column
    
    this.config.columnManager.getVisibleColumns().forEach(column => {
      totalWidth += this.config.columnManager.getColumnWidth(column.id);
    });
    
    return totalWidth;
  }
  
  private getColumnCount(state?: RenderState): number {
    const dataColumns = state?.columns 
      ? state.columns.filter(col => col.id !== '__selection').length
      : this.config.columnManager.getDataColumns().length;
    
    return dataColumns + (this.config.enableSelectionColumn ? 1 : 0);
  }
  
  private getCellElement(rowId: string, columnId: string): HTMLElement | null {
    return this.config.domManager.getElement('body').querySelector(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
    ) as HTMLElement;
  }
}