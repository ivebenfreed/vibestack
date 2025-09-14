/**
 * BodyRenderer - Consolidated cell and row rendering for VibeGrid
 *
 * Combines RowRenderer, CellRenderer, and CellFormatter into a single module
 * for better maintainability and reduced file fragmentation.
 *
 * Phase 2.1 consolidation from:
 * - managers/RowRenderer.ts (388 lines)
 * - managers/CellRenderer.ts (327 lines)
 * - modules/CellFormatter.ts (245 lines)
 */

import { log } from '@/logger';
import { formatFieldForDisplay } from '@/server/dataforge/fields/display-formatters';
import type { TableCore$ } from '../../stores/data-state';
import type { TableInteraction$ } from '../../stores/interaction-state';
import type { TableViewport$ } from '../../stores/pure-observables';
import { visualState$, getColumnWidth } from '../../stores/visual-state';
import type { DOMElementFactory } from '../factories/DOMElementFactory';
import type { SelectionController } from '../modules/SelectionController';
import { BadgeRenderer } from '../modules/BadgeRenderer';
import { KeyboardNavigationController } from '../modules/KeyboardNavigationController';

const fileLog = log('components/custom/vibegrid/renderers/components/BodyRenderer.ts');

const ROW_HEIGHT = 40;

// ====================================
// INTERFACES
// ====================================

export interface BodyRendererOptions {
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  tableViewport$: TableViewport$;
  domFactory: DOMElementFactory;
  selectionController?: SelectionController;
  keyboardNavController?: KeyboardNavigationController;
  enableSelectionColumn?: boolean;
  container: HTMLElement;

  // DOM utility functions
  createElement: (tag: string, className?: string) => HTMLElement;

  // Cell creation callbacks
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
}

// ====================================
// BODY RENDERER CLASS
// ====================================

export class BodyRenderer {
  private tableCore$: TableCore$;
  private tableInteraction$: TableInteraction$;
  private tableViewport$: TableViewport$;
  private domFactory: DOMElementFactory;
  private selectionController?: SelectionController;
  private keyboardNavController?: KeyboardNavigationController;
  private enableSelectionColumn: boolean;
  private container: HTMLElement;
  private createElement: (tag: string, className?: string) => HTMLElement;
  private onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;

  // Row state
  private activeRows: Map<string, HTMLElement> = new Map();

  constructor(options: BodyRendererOptions) {
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    this.domFactory = options.domFactory;
    this.selectionController = options.selectionController;
    this.keyboardNavController = options.keyboardNavController;
    this.enableSelectionColumn = options.enableSelectionColumn ?? false;
    this.container = options.container;
    this.createElement = options.createElement;
    this.onEntityUpdate = options.onEntityUpdate;

    fileLog.info('🏗️ BodyRenderer initialized (Phase 2.1 consolidated)');
  }

  // ====================================
  // ROW RENDERING METHODS
  // ====================================

  /**
   * Create a complete row element with header and cells
   */
  createRowElement(
    row: any,
    rowIndex: number,
    columns: any[],
    columnVisibility: Record<string, boolean>,
    startX: number = 40
  ): HTMLElement {
    const rowElement = this.createElement('div', 'vibegridx-row');
    rowElement.dataset.rowId = row.id;
    rowElement.style.cssText = `
      position: absolute;
      top: ${rowIndex * ROW_HEIGHT}px;
      left: 0;
      right: 0;
      height: ${ROW_HEIGHT}px;
      border-bottom: 1px solid #f1f3f5;
      background: ${rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa'};
    `;

    // Add row header (row number or checkbox selector) with absolute positioning
    const rowHeader = this.createRowHeader(row, rowIndex);
    rowHeader.style.position = 'absolute';
    rowHeader.style.left = '0';
    rowHeader.style.top = '0';
    rowElement.appendChild(rowHeader);

    // Add cells with absolute positioning
    let currentX = startX;
    columns.forEach((column, colIndex) => {
      const cell = this.createCellElement(row, column, colIndex, currentX);
      rowElement.appendChild(cell);
      currentX += column.width;
    });

    // Use UNIFIED visual state's totalWidth - no duplicate calculation
    const visualState = visualState$.get();
    const totalRowWidth = visualState.geometry.totalWidth;
    rowElement.style.width = `${totalRowWidth}px`;
    rowElement.style.minWidth = `${totalRowWidth}px`;

    // Track active row
    this.activeRows.set(row.id, rowElement);

    return rowElement;
  }

  /**
   * Create row header with number or checkbox
   */
  private createRowHeader(row: any, rowIndex: number): HTMLElement {
    const rowHeader = this.createElement('div', 'vibegridx-row-header');
    rowHeader.style.cssText = `
      width: 40px;
      height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      border-right: 1px solid #e9ecef;
      font-size: 12px;
      color: #6c757d;
      cursor: pointer;
      user-select: none;
    `;
    rowHeader.dataset.rowId = row.id;

    if (this.enableSelectionColumn) {
      // Create checkbox for row selection
      const checkbox = this.createRowCheckbox(row);
      rowHeader.appendChild(checkbox);
    } else {
      // Show row number
      rowHeader.textContent = String(rowIndex + 1);
    }

    // Add click handler for row selection
    this.setupRowHeaderHandler(rowHeader, row);

    return rowHeader;
  }

  /**
   * Create checkbox for row selection
   */
  private createRowCheckbox(row: any): HTMLInputElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.cssText = `
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin: 0;
    `;
    checkbox.dataset.rowId = row.id;

    // Check if this row is currently selected (use ALL visible columns from visual state)
    const visualState = visualState$.get();
    const allVisibleColumns = visualState.visibleColumns;

    const selectedCells = this.tableInteraction$.selectedCells.get();
    const isRowSelected = allVisibleColumns.every(col =>
      selectedCells.has(`${row.id}:${col.id}`)
    ) && allVisibleColumns.length > 0;

    checkbox.checked = isRowSelected;

    return checkbox;
  }

  /**
   * Set up row header click handling
   */
  private setupRowHeaderHandler(rowHeader: HTMLElement, row: any): void {
    rowHeader.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const isCtrlKey = e.ctrlKey || e.metaKey;

      // If click is directly on checkbox, let it handle the event
      if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
        const checkbox = target as HTMLInputElement;
        const isShiftKey = e.shiftKey;

        fileLog.debug('🔘 Checkbox click detected', {
          rowId: row.id,
          isShiftKey,
          checkboxChecked: checkbox.checked
        });

        if (isShiftKey) {
          // Shift+Click for row range selection
          fileLog.debug('🎯 Shift+Click detected - calling selectRowRange');
          const lastSelectedRowId = this.selectionController?.getLastSelectedRowId();
          if (lastSelectedRowId) {
            this.selectionController?.selectRowRange(lastSelectedRowId, row.id);
          }
        } else {
          // Use toggleRowSelection for proper multi-row behavior
          fileLog.debug('🔘 Regular click - calling toggleRowSelection', {
            rowId: row.id
          });
          this.selectionController?.toggleRowSelection(row.id);
          this.selectionController?.setLastSelectedRowId(row.id);
        }
        return;
      }

      // Click on row header area (but not checkbox) - still select row
      if (isCtrlKey) {
        // Ctrl+Click on row header - add to selection
        e.preventDefault();
        this.selectionController?.selectRow(row.id);
      } else {
        // Regular click - select entire row
        this.selectionController?.selectRow(row.id);
      }

      fileLog.info('🎯 Row header clicked', { rowId: row.id, isCtrlKey });
    });
  }

  /**
   * Create group header element for grouped data
   */
  createGroupHeaderElement(groupRow: any, rowIndex: number): HTMLElement {
    // Delegate to DOM Factory for consistent group header creation
    if (this.domFactory) {
      return this.domFactory.createGroupHeaderElement(groupRow, rowIndex);
    }

    // Fallback implementation for early initialization
    const groupData = groupRow.data;
    const level = groupRow.level || 0;
    const isExpanded = groupRow.isExpanded;

    const rowElement = this.createElement('div', 'vibegridx-row vibegridx-group-header');
    rowElement.dataset.rowId = groupRow.id;
    rowElement.dataset.groupId = groupRow.id;
    rowElement.style.cssText = `
      position: absolute;
      top: ${rowIndex * ROW_HEIGHT}px;
      left: 0;
      right: 0;
      height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      background: ${level === 0 ? '#e3f2fd' : '#f5f5f5'};
      border-bottom: 2px solid ${level === 0 ? '#2196f3' : '#9e9e9e'};
      font-weight: ${level === 0 ? '600' : '500'};
      cursor: pointer;
      user-select: none;
    `;

    // Add expand/collapse button with proper indentation
    const expandButton = this.createGroupExpandButton(level, isExpanded);
    rowElement.appendChild(expandButton);

    // Group label with count
    const groupLabel = this.createGroupLabel(groupData);
    rowElement.appendChild(groupLabel);

    // Add click handler for expand/collapse
    this.setupGroupHeaderHandler(rowElement, groupRow, isExpanded);

    return rowElement;
  }

  /**
   * Create expand/collapse button for group headers
   */
  private createGroupExpandButton(level: number, isExpanded: boolean): HTMLElement {
    const expandButton = this.createElement('div', 'vibegridx-group-expand');
    expandButton.style.cssText = `
      width: ${40 + level * 20}px;
      min-width: ${40 + level * 20}px;
      height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #666;
      padding-left: ${level * 20}px;
    `;

    // Triangle icon for expand/collapse
    const triangle = this.createElement('span', 'triangle-icon');
    triangle.innerHTML = isExpanded ? '▼' : '▶';
    triangle.style.cssText = `
      font-size: 12px;
      transition: transform 0.2s;
      margin-right: 8px;
    `;
    expandButton.appendChild(triangle);

    return expandButton;
  }

  /**
   * Create group label with field name and count
   */
  private createGroupLabel(groupData: any): HTMLElement {
    const groupLabel = this.createElement('div', 'vibegridx-group-label');
    groupLabel.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 14px;
      color: #333;
    `;

    const fieldName = groupData.field.charAt(0).toUpperCase() + groupData.field.slice(1);
    const displayValue = groupData.displayValue;
    const count = groupData.rowCount;

    groupLabel.innerHTML = `
      <strong>${fieldName}:</strong>
      <span style="margin: 0 8px;">${displayValue}</span>
      <span style="color: #666; font-size: 12px;">(${count} ${count === 1 ? 'item' : 'items'})</span>
    `;

    return groupLabel;
  }

  /**
   * Set up group header click handling
   */
  private setupGroupHeaderHandler(rowElement: HTMLElement, groupRow: any, isExpanded: boolean): void {
    rowElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      fileLog.info('🎯 Group header clicked', {
        groupId: groupRow.id,
        currentlyExpanded: isExpanded
      });

      // Toggle group expansion via tableCore$
      this.tableCore$.toggleGroupExpansion(groupRow.id);
    });
  }

  // ====================================
  // CELL RENDERING METHODS
  // ====================================

  /**
   * Create a cell element with full interaction and content handling
   */
  createCellElement(
    row: any,
    column: any,
    colIndex: number,
    xPosition?: number
  ): HTMLElement {
    // Single path for ALL cells - no smart vs regular distinction
    const cellType = column.cellType || column.type || 'text';
    const cellElement = this.domFactory.createElement('div', 'vibegridx-cell');
    cellElement.dataset.rowId = row.id;
    cellElement.dataset.columnId = column.id;

    // Check if this cell is selected
    const cellId = `${row.id}:${column.id}`;
    const isSelected = this.tableInteraction$.selectedCells.get().has(cellId);

    // Use centralized visual state for column width
    const actualWidth = getColumnWidth(column.id);

    // Use absolute positioning if xPosition is provided
    if (xPosition !== undefined) {
      cellElement.style.cssText = `
        position: absolute;
        left: ${xPosition}px;
        top: 0;
        width: ${actualWidth}px;
        height: 100%;
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-size: 14px;
        border-right: 1px solid #f1f3f5;
        overflow: hidden;
        cursor: default;
      `;
    } else {
      // Fallback to flex layout for compatibility
      cellElement.style.cssText = `
        flex: 0 0 ${actualWidth}px;
        height: 100%;
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-size: 14px;
        border-right: 1px solid #f1f3f5;
        overflow: hidden;
        position: relative;
        cursor: default;
      `;
    }

    // Apply selection class if selected
    if (isSelected) {
      cellElement.classList.add('vibegridx-selected');
    }

    // Get cell value and determine content type for proper CSS classes
    const value = row[column.id];

    // Create content element with proper CSS classes based on type
    // The content element should only take up the space it needs, not flex: 1
    let contentElement: HTMLElement;

    if (cellType === 'enum' || cellType === 'select' || cellType === 'tags') {
      // Badge/enum content - use centralized formatter for schema-based styling
      contentElement = this.domFactory.createElement('span', 'vibegridx-enum-badge vibegridx-cell-badge-editable');
      const displayValue = this.formatCellValue(value, cellType, column);

      // Check if the formatter returned HTML (with styling)
      if (displayValue.includes('<span')) {
        contentElement.innerHTML = displayValue;
      } else {
        contentElement.textContent = displayValue;

        // Apply default styling if no schema-based styling was applied
        contentElement.style.cssText = `
          background-color: rgb(243, 244, 246);
          color: rgb(75, 85, 99);
          border: 1px solid rgb(209, 213, 219);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
        `;
      }
    } else if (this.isTagsField(column.id, value)) {
      // Tags field with comma-separated values - create multiple badges
      contentElement = this.createTagsElement(value, row, column);
    } else if (['number', 'integer', 'float'].includes(cellType)) {
      // Number content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.domFactory.createElement('span', 'vibegridx-number-content vibegridx-cell-number-editable');
      contentElement.textContent = this.formatCellValue(value, cellType, column);
    } else if (cellType === 'boolean') {
      // Boolean content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.domFactory.createElement('span', 'vibegridx-boolean-text vibegridx-cell-boolean-editable');
      contentElement.textContent = this.formatCellValue(value, cellType, column);
    } else if (value == null || value === '') {
      // Empty content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.domFactory.createElement('span', 'vibegridx-cell-empty-editable');
      contentElement.textContent = 'Click to edit';
      contentElement.style.fontSize = '12px';
      contentElement.style.opacity = '0.6';
    } else {
      // Text content (default) - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.domFactory.createElement('span', 'vibegridx-cell-text-editable');
      contentElement.textContent = this.formatCellValue(value, cellType, column);

      // Add proper text overflow handling for long text
      contentElement.style.maxWidth = '100%';
      contentElement.style.overflow = 'hidden';
      contentElement.style.textOverflow = 'ellipsis';
      contentElement.style.whiteSpace = 'nowrap';
      contentElement.style.display = 'block';
    }

    // Ensure all content elements have proper overflow handling
    if (contentElement && !contentElement.style.overflow) {
      contentElement.style.overflow = 'hidden';
      contentElement.style.textOverflow = 'ellipsis';
      contentElement.style.whiteSpace = 'nowrap';
    }

    // Add click handler for content area - immediate edit mode
    contentElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const cellId = `${row.id}:${column.id}`;

      fileLog.info('📝 Content clicked - entering edit mode', {
        rowId: row.id,
        columnId: column.id,
        value,
        cellType
      });

      // Start edit immediately
      this.tableInteraction$.startEdit(cellId, value ? String(value) : '');
    });

    cellElement.appendChild(contentElement);

    // Mouse down handler for cell selection
    cellElement.addEventListener('mousedown', (e) => {
      const target = e.target as Element;

      // If click is on content element with editable class, ignore for selection
      // These elements have their own click handlers for editing
      if (target && target.classList && (
          target.classList.contains('vibegridx-cell-text-editable') ||
          target.classList.contains('vibegridx-cell-badge-editable') ||
          target.classList.contains('vibegridx-cell-number-editable') ||
          target.classList.contains('vibegridx-cell-boolean-editable') ||
          target.classList.contains('vibegridx-cell-empty-editable') ||
          target.classList.contains('vibegridx-enum-badge'))) {
        fileLog.info('📝 Content element clicked, ignoring for selection');
        return; // Content clicks are handled separately for editing
      }

      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      const cellId = `${row.id}:${column.id}`;

      fileLog.info('🖱️ Cell whitespace clicked - selection mode', {
        rowId: row.id,
        columnId: column.id,
        ctrl: isCtrlKey,
        shift: isShiftKey,
        target: (e.target as HTMLElement).className
      });

      // Update keyboard navigation focus
      this.keyboardNavController?.setFocusedCell(cellId);
      if (!isCtrlKey && !isShiftKey) {
        // For single clicks, update the anchor
        this.keyboardNavController?.setSelectionAnchor(cellId);
      }

      // Focus the container so it can receive keyboard events
      this.container.focus();

      // Prevent text selection during drag
      e.preventDefault();

      if (isShiftKey && this.tableInteraction$.anchorCell.get()) {
        // Shift+click for range selection
        this.tableInteraction$.selectRange(this.tableInteraction$.anchorCell.get()!, cellId);
      } else if (isCtrlKey) {
        // Ctrl/Cmd+click for multi-selection toggle
        this.tableInteraction$.toggleCellSelection(row.id, column.id, isCtrlKey, isShiftKey);
      } else {
        // Regular click - use toggleCellSelection to properly set anchor, then start potential drag selection
        this.tableInteraction$.toggleCellSelection(row.id, column.id, isCtrlKey, isShiftKey);
        this.tableInteraction$.startDragSelection(cellId);
      }

      // Set up document-level mouse move and up handlers for drag selection
      const handleMouseMove = (e: MouseEvent) => {
        // Find the cell element under the mouse
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        const cellUnderMouse = elementUnderMouse?.closest('[data-row-id][data-column-id]') as HTMLElement;

        if (cellUnderMouse) {
          const rowId = cellUnderMouse.dataset.rowId;
          const columnId = cellUnderMouse.dataset.columnId;
          if (rowId && columnId) {
            const currentCellId = `${rowId}:${columnId}`;
            // Create data context for the interaction state
            const dataContext = {
              rows: this.tableCore$.processedRows.get(),
              columns: this.tableCore$.columns.get(),
              columnVisibility: this.tableCore$.columnVisibility.get()
            };
            this.tableInteraction$.updateDragSelection(currentCellId, dataContext);
          }
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        fileLog.info('🖱️ Mouse up - ending drag selection');
        this.tableInteraction$.endDragSelection();

        // Clean up listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    return cellElement;
  }

  // ====================================
  // CELL FORMATTING METHODS (from CellFormatter)
  // ====================================

  /**
   * Format a cell value for display based on its type and column configuration
   */
  private formatCellValue(value: any, type?: string, column?: any): string {
    if (value === null || value === undefined) return '';

    // Use the DataForge formatter if type is provided
    if (type) {
      try {
        const formatted = formatFieldForDisplay(value, type, column);
        if (formatted !== null && formatted !== undefined) {
          return String(formatted);
        }
      } catch (error) {
        // Fall back to simple formatting if DataForge formatter fails
        console.warn('DataForge formatter failed, using fallback', error);
      }
    }

    // Fallback formatting based on type
    switch (type) {
      case 'boolean':
        return value ? 'True' : 'False';

      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);

      case 'datetime':
        if (value instanceof Date) {
          return value.toLocaleString();
        }
        return String(value);

      case 'number':
      case 'integer':
        return Number(value).toLocaleString();

      case 'float':
      case 'decimal':
        return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: column?.currency || 'USD'
        }).format(Number(value));

      case 'percentage':
        return `${(Number(value) * 100).toFixed(2)}%`;

      case 'email':
        return String(value).toLowerCase();

      case 'url':
        return String(value);

      case 'phone':
        return this.formatPhoneNumber(String(value));

      case 'enum':
      case 'select':
        return String(value);

      case 'tags':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);

      case 'json':
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2);
        }
        return String(value);

      default:
        return String(value);
    }
  }

  /**
   * Format phone number for display
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Format US phone numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    // Return original if not a standard format
    return phone;
  }

  /**
   * Check if a column should use tags field rendering
   */
  private isTagsField(columnId: string, value: any): boolean {
    return BadgeRenderer.isTagsField(columnId, value);
  }

  /**
   * Create tags element with multiple badges
   */
  private createTagsElement(value: string, row: any, column: any): HTMLElement {
    return BadgeRenderer.createTagsElement(
      value,
      row,
      column,
      this.onEntityUpdate
    );
  }

  // ====================================
  // ROW MANAGEMENT METHODS
  // ====================================

  /**
   * Get active rows map
   */
  getActiveRows(): Map<string, HTMLElement> {
    return this.activeRows;
  }

  /**
   * Clear active rows tracking
   */
  clearActiveRows(): void {
    this.activeRows.clear();
  }

  /**
   * Update row selection visual state
   */
  updateRowSelectionVisual(rowId: string, isSelected: boolean): void {
    const rowElement = this.activeRows.get(rowId);
    if (rowElement) {
      const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    }
  }

  /**
   * Update all row checkboxes based on current selection
   */
  updateAllRowCheckboxes(): void {
    const selectedCells = this.tableInteraction$.selectedCells.get();
    // Use UNIFIED visual state's visible columns - no duplicate filtering
    const visualState = visualState$.get();
    const allVisibleColumns = visualState.visibleColumns;

    this.activeRows.forEach((rowElement, rowId) => {
      const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        const isRowSelected = allVisibleColumns.every(col =>
          selectedCells.has(`${rowId}:${col.id}`)
        ) && allVisibleColumns.length > 0;

        checkbox.checked = isRowSelected;
      }
    });
  }
}

// ====================================
// STATIC UTILITY METHODS (from CellFormatter)
// ====================================

export class CellFormatter {
  /**
   * Get display text for empty values based on type
   */
  static getEmptyDisplayText(type?: string): string {
    switch (type) {
      case 'boolean':
        return 'Not set';
      case 'date':
      case 'datetime':
        return 'No date';
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
      case 'currency':
        return '—';
      case 'tags':
        return 'No tags';
      case 'enum':
      case 'select':
        return 'Select...';
      default:
        return '';
    }
  }

  /**
   * Check if value should be displayed as empty
   */
  static isEmptyValue(value: any, type?: string): boolean {
    if (value === null || value === undefined) return true;

    if (type === 'boolean') {
      return false; // Booleans are never empty, they're either true or false
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (type === 'number' || type === 'integer' || type === 'float' || type === 'decimal') {
      return isNaN(Number(value));
    }

    return false;
  }

  /**
   * Format value for editing (raw format for input fields)
   */
  static formatForEdit(value: any, type?: string): string {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'boolean':
        return value ? 'true' : 'false';

      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return String(value);

      case 'datetime':
        if (value instanceof Date) {
          return value.toISOString();
        }
        return String(value);

      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
      case 'currency':
      case 'percentage':
        return String(value);

      case 'tags':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);

      case 'json':
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2);
        }
        return String(value);

      default:
        return String(value);
    }
  }

  /**
   * Parse edited value back to proper type
   */
  static parseEditedValue(value: string, type?: string): any {
    if (!value && value !== '0' && value !== 'false') return null;

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 'yes';

      case 'date':
      case 'datetime':
        return new Date(value);

      case 'number':
      case 'integer':
        return parseInt(value, 10);

      case 'float':
      case 'decimal':
      case 'currency':
      case 'percentage':
        return parseFloat(value);

      case 'tags':
        return value.split(',').map(t => t.trim()).filter(t => t.length > 0);

      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }

      default:
        return value;
    }
  }
}