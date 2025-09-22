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
import type { createVibeGridVisualState } from '../../stores/visual-state';
import { GRID_DIMENSIONS } from '../../constants/grid-dimensions';
import type { DOMElementFactory } from '../factories/DOMElementFactory';
import type { SelectionController } from '../modules/SelectionController';
import { BadgeRenderer } from '../modules/BadgeRenderer';
import { KeyboardNavigationController } from '../modules/KeyboardNavigationController';
import { DragDropManager } from '../../utils/drag-drop-handlers';
import { isSelectType, SELECT_CELL_TYPES } from '../../column-types';

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
  visualState: ReturnType<typeof createVibeGridVisualState>;

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
  private visualState: ReturnType<typeof createVibeGridVisualState>;

  // Row state
  private activeRows: Map<string, HTMLElement> = new Map();
  private dragDropManager?: DragDropManager;
  private isGroupedMode: boolean = false;

  // Store context for potential drag selection
  private lastClickedCell: { cellId: string; row: any; column: any } | null = null;

  // Observer cleanup
  private selectionObserverDisposer?: () => void;

  // Cell rendering tracking for debugging invisible cells
  private cellRenderingStats = {
    rowsRequested: 0,
    rowsCreated: 0,
    cellsRequested: 0,
    cellsCreated: 0,
    lastRenderTime: 0,
    renderErrors: [] as string[]
  };
  private renderTimeoutId?: number;

  // NEW: Modular cell system support
  private modularCellBridge: any = null;

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
    this.visualState = options.visualState;

    // Initialize drag and drop manager with container
    this.initializeDragDrop();

    // Setup observer for selection changes to update checkboxes
    this.setupSelectionObserver();

    // NEW: Initialize modular cell system via hydration manager
    this.initializeModularCellSystem().catch(error => {
      fileLog.error('❌ [FIELD-BRIDGE] Failed to initialize modular system in constructor', { error });
    });

    fileLog.info('🏗️ BodyRenderer initialized (Phase 2.1 consolidated)');
  }

  /**
   * Setup observer to watch selection changes and update checkboxes
   */
  private setupSelectionObserver(): void {
    this.selectionObserverDisposer = this.tableInteraction$.selectedCells.onChange(() => {
      // Update all row checkboxes when selection changes
      this.updateAllRowCheckboxes();
      fileLog.debug('📦 Checkbox states updated due to selection change');
    });
  }

  /**
   * Initialize modular cell system for enhanced field type support
   */
  private async initializeModularCellSystem(): Promise<void> {
    try {
      // Dynamically import the modular system to avoid circular dependencies
      const modularModule = await import('../../field-types');
      this.modularCellBridge = modularModule.modularCellBridge;

      fileLog.info('🎯 [FIELD-BRIDGE] Modular cell system initialized in BodyRenderer', {
        supportedTypes: this.modularCellBridge.getStats().registry.totalTypes,
        basicTypes: this.modularCellBridge.getStats().registry.basicTypes.length,
        relationshipTypes: this.modularCellBridge.getStats().registry.relationshipTypes.length,
        rollupTypes: this.modularCellBridge.getStats().registry.rollupTypes.length
      });
    } catch (error) {
      fileLog.error('❌ [FIELD-BRIDGE] Modular cell system failed to initialize - FAIL FAST', { error });
      // FAIL FAST - Don't use legacy, surface the real issue
      throw error;
    }
  }


  /**
   * Cleanup observers and resources
   */
  destroy(): void {
    if (this.selectionObserverDisposer) {
      this.selectionObserverDisposer();
      this.selectionObserverDisposer = undefined;
    }

    // Clear active rows
    this.activeRows.clear();

    fileLog.info('🧹 BodyRenderer destroyed');
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
    startX: number = GRID_DIMENSIONS.CONTENT_OFFSET_X  // Use constant from centralized dimensions
  ): HTMLElement {
    // Track row rendering for debugging invisible cells
    this.cellRenderingStats.rowsRequested++;
    this.cellRenderingStats.lastRenderTime = Date.now();

    fileLog.info('🔧 [CELL-DEBUG] Creating row element', {
      rowId: row.id,
      rowIndex,
      rowType: row.type,
      columnsCount: columns.length,
      visibleColumns: Object.values(columnVisibility).filter(Boolean).length,
      startX,
      stats: this.cellRenderingStats
    });

    // Update grouped mode status
    this.updateGroupedModeStatus();
    const rowElement = this.createElement('div', 'vibegridx-row');
    rowElement.dataset.rowId = row.id;

    // Add group ID for data rows in grouped mode (needed for drag and drop)
    if (row.type === 'data' && row.groupId) {
      rowElement.setAttribute('data-group-id', row.groupId);
    }

    // startX now comes from visual state which already includes drag + checkbox columns (70px total)
    const adjustedStartX = startX;

    rowElement.style.cssText = `
      position: absolute;
      top: ${rowIndex * ROW_HEIGHT}px;
      left: 0;
      right: 0;
      height: ${ROW_HEIGHT}px;
      border-bottom: 1px solid #f1f3f5;
      background: ${rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa'};
    `;

    // Add drag column (always present for consistent layout)
    const dragColumn = this.createDragColumn(row);
    dragColumn.style.position = 'absolute';
    dragColumn.style.left = '0';
    dragColumn.style.top = '0';
    rowElement.appendChild(dragColumn);

    // Add row header (checkbox or row number) with absolute positioning
    const rowHeader = this.createRowHeader(row, rowIndex);
    rowHeader.style.position = 'absolute';
    rowHeader.style.left = `${GRID_DIMENSIONS.DRAG_COLUMN_WIDTH}px`;  // After drag column
    rowHeader.style.top = '0';
    rowElement.appendChild(rowHeader);

    // Add cells with absolute positioning
    // CRITICAL FIX: Use actual column layouts from visual state for proper positioning
    const visualStateData = this.visualState.visualState$.get();
    const columnLayouts = visualStateData.visibleColumns;

    columns.forEach((column, colIndex) => {
      this.cellRenderingStats.cellsRequested++;

      // Find the corresponding column layout with actual width and x-offset
      const layout = columnLayouts.find(l => l.id === column.id);
      if (!layout) {
        fileLog.warn('🚨 [CELL-DEBUG] No layout found for column', {
          columnId: column.id,
          columnField: column.field,
          availableLayouts: columnLayouts.map(l => l.id)
        });
        return;
      }

      fileLog.debug('🔧 [CELL-DEBUG] Creating cell', {
        rowId: row.id,
        columnId: column.id,
        columnField: column.field,
        colIndex,
        xOffset: layout.xOffset,
        cellType: column.cellType
      });

      // Use the layout's xOffset for absolute positioning (already includes cumulative positioning)
      const cell = this.createCellElement(row, column, colIndex, layout.xOffset);
      rowElement.appendChild(cell);

      this.cellRenderingStats.cellsCreated++;
    });

    // Use UNIFIED visual state's totalWidth - no duplicate calculation
    const totalRowWidth = visualStateData.geometry.totalWidth;
    rowElement.style.width = `${totalRowWidth}px`;
    rowElement.style.minWidth = `${totalRowWidth}px`;

    // Track active row
    this.activeRows.set(row.id, rowElement);

    // Set up drag and drop for data rows in both grouped and flat modes
    if (row.type === 'data' && this.dragDropManager) {
      // Use simplified VibeGrid pattern for drag setup
      this.dragDropManager.setupRowDragHandlers(
        rowElement,
        row.id,
        row.type,
        row.groupId
      );
    }

    // Track successful row creation
    this.cellRenderingStats.rowsCreated++;

    fileLog.info('✅ [CELL-DEBUG] Row element created successfully', {
      rowId: row.id,
      cellsInRow: this.cellRenderingStats.cellsCreated - (this.cellRenderingStats.cellsCreated - columns.length),
      totalWidth: totalRowWidth,
      activeRowsCount: this.activeRows.size
    });

    return rowElement;
  }

  /**
   * Create dedicated drag column (always present for consistent layout)
   */
  private createDragColumn(row: any): HTMLElement {
    const dragColumn = this.createElement('div', 'vibegridx-drag-column');

    const isDataRow = row.type === 'data' && this.dragDropManager;
    const canDragRow = isDataRow; // Support drag in both grouped and flat modes

    dragColumn.style.cssText = `
      width: ${GRID_DIMENSIONS.DRAG_COLUMN_WIDTH}px;
      height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      border-right: 1px solid #e9ecef;
      cursor: ${canDragRow ? 'grab' : 'default'};
      user-select: none;
      position: relative;
    `;
    dragColumn.dataset.rowId = row.id;
    dragColumn.dataset.columnId = '__drag_handle';

    // Add drag functionality for data rows in both grouped and flat modes
    if (canDragRow) {
      // Add drag handle
      const dragHandle = this.dragDropManager!.createDragHandle();
      dragHandle.style.cssText += 'opacity: 0; transition: opacity 0.2s ease;';
      dragColumn.appendChild(dragHandle);

      // Show drag handle on hover
      dragColumn.addEventListener('mouseenter', () => {
        dragHandle.style.opacity = '1';
      });
      dragColumn.addEventListener('mouseleave', () => {
        dragHandle.style.opacity = '0';
      });

      // Drag functionality is now handled at the row level
      // The drag column just provides the visual handle
    } else {
      // Empty space when not draggable (for consistent layout)
      dragColumn.innerHTML = '';
    }

    return dragColumn;
  }

  /**
   * Create row header with number or checkbox (no longer handles drag)
   */
  private createRowHeader(row: any, rowIndex: number): HTMLElement {
    const rowHeader = this.createElement('div', 'vibegridx-row-header');

    rowHeader.style.cssText = `
      width: ${GRID_DIMENSIONS.ROW_HEADER_WIDTH}px;
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
      position: relative;
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
    const visualStateData = this.visualState.visualState$.get();
    const allVisibleColumns = visualStateData.visibleColumns;

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
    // BodyRenderer should NOT handle selection logic - just render and emit events
    // MouseController will handle all interactions via event delegation
    fileLog.debug('🎯 Row header setup for rendering only', { rowId: row.id });

    // Just add data attributes that MouseController can use
    rowHeader.setAttribute('data-row-id', row.id);
    rowHeader.setAttribute('data-interaction-type', 'row-header');
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

    // Add data attribute for MouseController to detect group clicks
    rowElement.setAttribute('data-group-id', groupRow.id);

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
    // TODO: Integrate modular system once import issues are resolved
    // For now, use legacy rendering for all cells
    const cellType = column.cellType || column.type || 'text';
    const cellElement = this.domFactory.createElement('div', 'vibegridx-cell');
    cellElement.dataset.rowId = row.id;
    cellElement.dataset.columnId = column.id;

    // Check if this cell is selected
    const cellId = `${row.id}:${column.id}`;
    const isSelected = this.tableInteraction$.selectedCells.get().has(cellId);

    // Use centralized visual state for column width
    const actualWidth = this.visualState.visualOperations.getColumnWidth(column.id);

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
    // Handle virtual row structure: row.data contains the actual data
    const rowData = row.data || row;
    const value = rowData[column.id];

    // Create content element with proper CSS classes based on type
    // The content element should only take up the space it needs, not flex: 1
    let contentElement: HTMLElement;

    if (isSelectType(cellType) || cellType === 'tags') {
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
      contentElement = this.createTagsElement(value, rowData, column);
    } else if (['number', 'integer', 'float'].includes(cellType)) {
      // Number content - use editable class only if column is editable
      const editableClass = column.editable === false ? '' : 'vibegridx-cell-number-editable';
      contentElement = this.domFactory.createElement('span', `vibegridx-number-content ${editableClass}`.trim());
      contentElement.textContent = this.formatCellValue(value, cellType, column);
    } else if (cellType === 'boolean') {
      // Boolean content - use editable class only if column is editable
      const editableClass = column.editable === false ? '' : 'vibegridx-cell-boolean-editable';
      contentElement = this.domFactory.createElement('span', `vibegridx-boolean-text ${editableClass}`.trim());
      contentElement.textContent = this.formatCellValue(value, cellType, column);
    } else {
      // NEW: Try modular system for all supported field types
      if (this.modularCellBridge && this.modularCellBridge.isSupported(column)) {
        try {
          fileLog.debug('🎯 [FIELD-BRIDGE] Using modular system for text field', {
            columnId: column.id,
            fieldType: cellType,
            value: value
          });

          // Use modular system - it will return content element directly
          const modularContent = this.modularCellBridge.createCell(
            value,
            column,
            rowData,
            { rowIndex: 0, columnIndex: colIndex, xPosition }
          );

          // Extract the inner content from modular cell (skip the outer container)
          const innerContent = modularContent.querySelector('span') || modularContent.firstChild;
          if (innerContent) {
            contentElement = innerContent.cloneNode(true) as HTMLElement;

            // PRESERVE SelectRenderer styling for colored badges
            // Only add base classes if the renderer hasn't already styled the element
            const hasSelectStyling = contentElement.style.backgroundColor ||
                                    contentElement.className.includes('vibegridx-select-badge');

            if (!hasSelectStyling && !contentElement.className.includes('vibegridx-cell-text')) {
              contentElement.className = column.editable === false ? 'vibegridx-cell-text' : 'vibegridx-cell-text-editable';
            }
          } else {
            throw new Error('No content found in modular cell');
          }

        } catch (error) {
          fileLog.error('❌ [FIELD-BRIDGE] Modular system failed for text field - NO FALLBACK', {
            error,
            columnId: column.id,
            fieldType: cellType
          });
          // FAIL FAST - Don't fallback, throw the error to surface issues
          throw error;
        }
      } else {
        // FAIL FAST - No fallback allowed, modular system must work
        fileLog.error('❌ [FIELD-BRIDGE] Text field MUST use modular system - FAIL FAST', {
          columnId: column.id,
          cellType,
          modularBridgeAvailable: !!this.modularCellBridge,
          isSupported: this.modularCellBridge ? this.modularCellBridge.isSupported(column) : false
        });
        throw new Error(`Text field ${column.id} must use modular system - field type registry not initialized`);
      }
    }

    // Ensure all content elements have proper overflow handling
    if (contentElement && !contentElement.style.overflow) {
      contentElement.style.overflow = 'hidden';
      contentElement.style.textOverflow = 'ellipsis';
      contentElement.style.whiteSpace = 'nowrap';
    }

    // Add click handler for content area - immediate edit mode (only for editable columns)
    if (column.editable !== false) {
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
    }
    // For non-editable columns, don't add click handler - let clicks bubble up for cell selection

    cellElement.appendChild(contentElement);

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
        // Optimized: Handle all select types uniformly
        if (SELECT_CELL_TYPES.has(type as any)) {
          return String(value);
        }
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
   * Create legacy text content element (fallback for modular system)
   */
  private createLegacyTextContent(value: any, column: any, cellType: string): HTMLElement {
    const className = column.editable === false ? 'vibegridx-cell-text' : 'vibegridx-cell-text-editable';
    const contentElement = this.domFactory.createElement('span', className);
    contentElement.textContent = this.formatCellValue(value, cellType, column);

    // Add proper text overflow handling for long text
    contentElement.style.maxWidth = '100%';
    contentElement.style.overflow = 'hidden';
    contentElement.style.textOverflow = 'ellipsis';
    contentElement.style.whiteSpace = 'nowrap';
    contentElement.style.display = 'block';

    return contentElement;
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
   * Update all row checkboxes based on current selection (reactive)
   */
  updateAllRowCheckboxes(): void {
    // Use UNIFIED visual state's visible columns - no duplicate filtering
    const visualStateData = this.visualState.visualState$.get();
    const allVisibleColumns = visualStateData.visibleColumns;
    const processedRows = this.tableCore$.processedRows.get();

    // Get reactive checkbox states from interaction state
    const checkboxStates = this.tableInteraction$.getRowCheckboxStates(processedRows, allVisibleColumns);

    this.activeRows.forEach((rowElement, rowId) => {
      const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        const isRowSelected = checkboxStates.get(rowId) || false;
        checkbox.checked = isRowSelected;
      }
    });
  }

  // ====================================
  // DRAG AND DROP METHODS
  // ====================================

  /**
   * Initialize drag and drop functionality
   */
  private initializeDragDrop(): void {
    this.dragDropManager = new DragDropManager({
      onRowMove: (draggedRowId: string, targetGroupId: string, newIndex: number) => {
        fileLog.info('🔄 Row move requested via drag and drop (grouped)', {
          draggedRowId,
          targetGroupId,
          newIndex
        });

        // Get current group structure to determine the source group
        const processedRows = this.tableCore$.processedRows.get();
        const draggedRow = processedRows.find(r => r.id === draggedRowId);
        if (!draggedRow || draggedRow.type !== 'data') {
          fileLog.error('❌ Invalid dragged row or not a data row', { draggedRowId });
          return false;
        }

        // Find the source group by looking at the group hierarchy
        const sourceGroupId = draggedRow.groupId || this.findRowGroupId(draggedRowId);
        if (!sourceGroupId) {
          fileLog.error('❌ Could not determine source group for dragged row', { draggedRowId });
          return false;
        }

        // Move row within group using data state method
        const success = this.tableCore$.moveRowInGroup(sourceGroupId, targetGroupId, draggedRowId, newIndex);

        fileLog.info('✅ Row move delegated to drag handler', {
          draggedRowId,
          sourceGroupId,
          targetGroupId,
          newIndex,
          success
        });

        return success;
      },

      onFlatRowMove: (fromIndex: number, toIndex: number) => {
        fileLog.info('🔄 Row move requested via drag and drop (flat)', {
          fromIndex,
          toIndex
        });

        // Move row in flat mode
        const success = this.tableCore$.moveRowInFlat(fromIndex, toIndex);

        fileLog.info('✅ Row moved in flat mode', {
          success,
          fromIndex,
          toIndex
        });

        return success;
      },

      isGroupMode: () => {
        this.updateGroupedModeStatus();
        return this.isGroupedMode;
      },

      onDragStart: () => {
        fileLog.debug('🎯 Drag operation started');
      },

      onDragEnd: () => {
        fileLog.debug('🎯 Drag operation ended');
      }
    });

    // Set the container for drag operations
    if (this.dragDropManager) {
      this.dragDropManager.setContainer(this.container);
    }
  }

  /**
   * Update grouped mode status based on current table state
   */
  private updateGroupedModeStatus(): void {
    try {
      // Get grouping configuration from visual operations
      const groupConfig = this.visualState.visualOperations.getGroupConfig();
      this.isGroupedMode = !!(groupConfig && groupConfig.fields && groupConfig.fields.length > 0);
    } catch (error) {
      // Fallback: assume not grouped if unable to get config
      this.isGroupedMode = false;
      fileLog.warn('Failed to get group config, assuming not grouped', { error });
    }
  }

  /**
   * Find the group ID for a given row ID by traversing the processed rows
   */
  private findRowGroupId(rowId: string): string | null {
    const processedRows = this.tableCore$.processedRows.get();
    let currentGroupId: string | null = null;

    for (const row of processedRows) {
      if (row.type === 'group') {
        currentGroupId = row.id;
      } else if (row.type === 'data' && row.id === rowId) {
        return currentGroupId;
      }
    }

    return null;
  }

  /**
   * Refresh drag and drop setup for all active rows
   */
  refreshDragDropSetup(): void {
    this.updateGroupedModeStatus();

    if (!this.dragDropManager) {
      return;
    }

    this.activeRows.forEach((rowElement, rowId) => {
      const row = this.tableCore$.processedRows.get().find(r => r.id === rowId);
      if (row && row.type === 'data') {
        this.dragDropManager!.setupRowForDragDrop(rowElement, row);
      }
    });

    fileLog.debug('🔄 Drag and drop setup refreshed for all active rows');
  }

  /**
   * @deprecated OBSOLETE: Mouse handling moved to reactive MouseController
   * This method is no longer called - MouseController handles all mouse events reactively
   * Can be removed after verifying no references exist
   */
  handleCellMouseDown(e: MouseEvent, cellElement: HTMLElement, target: HTMLElement): void {
    const rowId = cellElement.getAttribute('data-row-id');
    const columnId = cellElement.getAttribute('data-column-id');

    if (!rowId || !columnId) {
      fileLog.warn('⚠️ Cell mouse down on element without row/column data');
      return;
    }

    // Find the row and column data
    const rows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const row = rows.find(r => r.id === rowId);
    const column = columns.find(c => c.id === columnId);

    if (!row || !column) {
      fileLog.warn('⚠️ Row or column not found for cell mouse down');
      return;
    }

    const isCtrlKey = e.ctrlKey || e.metaKey;
    const isShiftKey = e.shiftKey;
    const cellId = `${row.id}:${column.id}`;

    fileLog.info('🖱️ Cell mouse down - immediate selection', {
      rowId: row.id,
      columnId: column.id,
      ctrl: isCtrlKey,
      shift: isShiftKey,
      target: target.className
    });

    // Provide immediate selection feedback
    // Update keyboard navigation focus - use interaction state instead of local state
    this.tableInteraction$.setFocusedCell(cellId);

    // Focus the container so it can receive keyboard events
    this.container.focus();

    if (isShiftKey && this.tableInteraction$.anchorCell.get()) {
      // Shift+click for range selection
      this.tableInteraction$.selectRange(this.tableInteraction$.anchorCell.get()!, cellId);
    } else if (isCtrlKey) {
      // Ctrl/Cmd+click for multi-selection toggle
      this.tableInteraction$.toggleCellSelection(row.id, column.id, isCtrlKey, isShiftKey);
    } else {
      // Regular click - use toggleCellSelection to properly set anchor
      this.tableInteraction$.toggleCellSelection(row.id, column.id, isCtrlKey, isShiftKey);

      // Store context in case drag selection starts later
      this.lastClickedCell = { cellId, row, column };
    }
  }

  /**
   * @deprecated OBSOLETE: Click handling moved to reactive MouseController
   * This method is no longer called - MouseController handles all interactions reactively
   * Can be removed after verifying no references exist
   */
  handleCellClick(e: MouseEvent, cellElement: HTMLElement, target: HTMLElement): void {
    const rowId = cellElement.getAttribute('data-row-id');
    const columnId = cellElement.getAttribute('data-column-id');

    if (!rowId || !columnId) {
      fileLog.warn('⚠️ Cell click on element without row/column data');
      return;
    }

    // Find the row and column data
    const rows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const row = rows.find(r => r.id === rowId);
    const column = columns.find(c => c.id === columnId);

    if (!row || !column) {
      fileLog.warn('⚠️ Cell click on unknown row/column', { rowId, columnId });
      return;
    }

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
      target: target.className
    });

    // Update keyboard navigation focus - use interaction state instead of local state
    this.tableInteraction$.setFocusedCell(cellId);
    // Note: anchorCell is handled by setFocusedCell when no anchor exists

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
      // Regular click - use toggleCellSelection to properly set anchor
      // NOTE: Do NOT start drag selection immediately - wait for MouseController to detect actual dragging
      this.tableInteraction$.toggleCellSelection(row.id, column.id, isCtrlKey, isShiftKey);

      // Store context in case drag selection starts later
      this.lastClickedCell = { cellId, row, column };
    }

    // NOTE: Mouse move and up handlers are now managed by MouseController
    // This avoids duplicate event listeners and conflicting drag detection logic
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

  /**
   * @deprecated OBSOLETE: Drag selection moved to reactive observer pattern
   * This method is no longer called - drag selection handled by focused observers
   * Can be removed after verifying no references exist
   */
  startDragSelectionOnDrag(e: MouseEvent): void {
    if (!this.lastClickedCell) {
      fileLog.warn('⚠️ Drag selection triggered but no last clicked cell context available');
      return;
    }

    const { cellId } = this.lastClickedCell;

    fileLog.info('🖱️ Starting drag selection on actual drag detection', {
      startCell: cellId,
      mousePosition: { x: e.clientX, y: e.clientY }
    });

    // Now start drag selection since actual dragging is detected
    this.tableInteraction$.startDragSelection(cellId);
    // NOTE: No additional event listeners - MouseController handles all mouse events
  }

  /**
   * @deprecated OBSOLETE: Drag selection moved to reactive observer pattern
   * This method is no longer called - drag selection handled by focused observers
   * Can be removed after verifying no references exist
   */
  updateDragSelectionOnMove(e: MouseEvent): void {
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
          columnVisibility: this.visualState.visualInputs$.columnVisibility.get()
        };
        this.tableInteraction$.updateDragSelection(currentCellId, dataContext);
      }
    }
  }

  /**
   * @deprecated OBSOLETE: Drag selection moved to reactive observer pattern
   * This method is no longer called - drag selection handled by focused observers
   * Can be removed after verifying no references exist
   */
  endDragSelectionOnMouseUp(): void {
    fileLog.info('🖱️ Ending drag selection on mouse up');
    this.tableInteraction$.endDragSelection();

    // Clean up context since interaction is complete
    this.lastClickedCell = null;
  }

  // ====================================
  // CELL RENDERING DEBUG METHODS
  // ====================================

  /**
   * Schedule a health check to detect if cell rendering stalls
   */
  private scheduleRenderHealthCheck(): void {
    // Clear any existing timeout
    if (this.renderTimeoutId) {
      clearTimeout(this.renderTimeoutId);
    }

    // Schedule new health check in 2 seconds
    this.renderTimeoutId = window.setTimeout(() => {
    }, 2000);
  }


  /**
   * Get current cell rendering statistics for debugging
   */
  getRenderingStats() {
    return {
      ...this.cellRenderingStats,
      activeRowsCount: this.activeRows.size,
      containerChildren: this.container.children.length,
      timeSinceLastRender: Date.now() - this.cellRenderingStats.lastRenderTime
    };
  }
}