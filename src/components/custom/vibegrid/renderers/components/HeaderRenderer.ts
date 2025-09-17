/**
 * HeaderRenderer - Specialized renderer for VibeGrid table headers
 * Handles column headers, sorting, resizing, and select-all functionality
 */

import { log } from '@/logger';
import { observe } from '@legendapp/state';
import { visualState$, visualOperations, getColumnWidth, getColumnXOffset, getVisibleColumns } from '../../stores/visual-state';
import type { TableCore$ } from '../../stores/data-state';
import type { TableInteraction$ } from '../../stores/interaction-state';
import type { TableViewport$ } from '../../stores/pure-observables';
import type { DOMElementFactory } from '../factories/DOMElementFactory';
import type { SelectionController } from '../modules/SelectionController';
import type { CoordinateMapping } from '../modules/OverlayManager';
// import { setupColumnDragHandlers } from '../utils/interaction-handlers'; // REMOVED: Consolidating drag handling in MouseController

const fileLog = log('components/custom/vibegrid/renderers/components/HeaderRenderer.ts');

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;

export interface HeaderRendererOptions {
  headerContainer: HTMLElement;
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  tableViewport$: TableViewport$;
  domFactory: DOMElementFactory;
  selectionController?: SelectionController;
  coordinateMapping: CoordinateMapping;
  enableSelectionColumn?: boolean;
  
  // Callbacks for coordinate updates
  updateCoordinateMapping: (mapping: CoordinateMapping) => void;
}

export class HeaderRenderer {
  private headerContainer: HTMLElement;
  private tableCore$: TableCore$;
  private tableInteraction$: TableInteraction$;
  private tableViewport$: TableViewport$;
  private domFactory: DOMElementFactory;
  private selectionController?: SelectionController;
  private coordinateMapping: CoordinateMapping;
  private enableSelectionColumn: boolean;

  // Legend State performance optimization: track last render state to prevent redundant renders
  private lastRenderState: {
    columnCount: number;
    scrollLeft: number;
    visibleColumnsLength: number;
    visibleRangeStart: number;
    visibleRangeEnd: number;
    columnOrderString: string; // Track column order for drag operations
  } | null = null;
  private updateCoordinateMapping: (mapping: CoordinateMapping) => void;
  
  // Header state
  private selectAllCheckbox: HTMLInputElement | null = null;

  constructor(options: HeaderRendererOptions) {
    this.headerContainer = options.headerContainer;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    this.domFactory = options.domFactory;
    this.selectionController = options.selectionController;
    this.coordinateMapping = options.coordinateMapping;
    this.enableSelectionColumn = options.enableSelectionColumn ?? false;
    this.updateCoordinateMapping = options.updateCoordinateMapping;
  }

  /**
   * Render complete table header
   */
  render(): void {
    if (!this.headerContainer) return;

    // Get visual state early for debugging
    const visualState = visualState$.get();

    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();

    // Legend State change detection pattern: check if render is actually needed
    const currentRenderState = {
      columnCount: columns.length,
      scrollLeft: visualState.geometry.scrollLeft,
      visibleColumnsLength: visualState.visibleColumns.length,
      visibleRangeStart: visualState.geometry.visibleColumnRange.start,
      visibleRangeEnd: visualState.geometry.visibleColumnRange.end,
      columnOrderString: (visualState.columnState.columnOrder || []).join(',') // Track column order for drag operations
    };

    // Skip render if nothing actually changed (Legend State optimization pattern)
    if (this.lastRenderState &&
        this.lastRenderState.columnCount === currentRenderState.columnCount &&
        this.lastRenderState.scrollLeft === currentRenderState.scrollLeft &&
        this.lastRenderState.visibleColumnsLength === currentRenderState.visibleColumnsLength &&
        this.lastRenderState.visibleRangeStart === currentRenderState.visibleRangeStart &&
        this.lastRenderState.visibleRangeEnd === currentRenderState.visibleRangeEnd &&
        this.lastRenderState.columnOrderString === currentRenderState.columnOrderString) {

      fileLog.debug('🔄 HEADER RENDER SKIPPED - no changes detected', currentRenderState);
      return;
    }

    // Update last render state
    this.lastRenderState = currentRenderState;

    fileLog.info('🔄 HEADER RENDER TRIGGERED', {
      columnCount: columns.length,
      scrollLeft: visualState.geometry.scrollLeft,
      visibleRange: `${visualState.geometry.visibleColumnRange.start}-${visualState.geometry.visibleColumnRange.end}`,
      totalColumns: visualState.visibleColumns.length,
      virtualRangeCount: visualState.geometry.visibleColumnRange.end - visualState.geometry.visibleColumnRange.start
    });
    
    this.headerContainer.innerHTML = '';
    
    const headerRow = this.domFactory.createElement('div', 'vibegridx-header-row');
    headerRow.style.cssText = `
      position: relative;
      height: ${HEADER_HEIGHT}px;
    `;
    
    // Add drag column header (for grouped mode) - always present for consistent layout
    const dragColumnHeader = this.createDragColumnHeader();
    dragColumnHeader.style.position = 'absolute';
    dragColumnHeader.style.left = '0';
    dragColumnHeader.style.top = '0';
    dragColumnHeader.style.zIndex = '1';
    headerRow.appendChild(dragColumnHeader);

    // Add corner header cell (aligns with row headers) - positioned after drag column
    const { cornerCell, selectAllCheckbox } = this.domFactory.createCornerHeaderCell();
    this.selectAllCheckbox = selectAllCheckbox || null;

    // Position corner cell absolutely after drag column
    cornerCell.style.position = 'absolute';
    cornerCell.style.left = '30px';  // After 30px drag column
    cornerCell.style.top = '0';
    cornerCell.style.zIndex = '1';

    // Add select all checkbox handler
    if (this.selectAllCheckbox) {
      this.setupSelectAllHandler();
    }

    headerRow.appendChild(cornerCell);
    
    // Get visible columns from unified visual state (same as DOM rendering)
    // This ensures coordinate mapping matches exactly what's rendered in DOM
    const allColumnLayouts = visualState.visibleColumns;
    const allVisibleColumns = allColumnLayouts.map(layout =>
      columns.find(col => col.id === layout.id)
    ).filter(Boolean);

    fileLog.info('🎨 Header rendering ALL columns (no virtualization)', {
      totalColumns: columns.length,
      visibleColumns: allColumnLayouts.length,
      scrollLeft: visualState.geometry.scrollLeft,
      columnIds: allColumnLayouts.slice(0, 5).map(col => col.id)
    });

    // Update column coordinate mapping only if columns have changed
    // Now uses the SAME column source as DOM rendering (visualState.visibleColumns)
    const needsCoordinateUpdate = this.updateColumnCoordinateMapping(allVisibleColumns);

    // Render ALL columns at their absolute positions
    // The header viewport transform will handle the scrolling
    allColumnLayouts.forEach((columnLayout, columnIndex) => {
      const column = columns.find(c => c.id === columnLayout.id);
      if (!column) return;

      const headerCell = this.createColumnHeader(column, columnIndex, 0);

      // Position at xOffset from visual state (already includes drag + row header columns)
      headerCell.style.position = 'absolute';
      headerCell.style.left = `${columnLayout.xOffset}px`;
      headerCell.style.top = '0';
      headerCell.style.width = `${columnLayout.width}px`;
      headerCell.style.height = `${HEADER_HEIGHT}px`;

      headerRow.appendChild(headerCell);
    });

    // End drop zone removed - users can drop between columns instead

    // Set total width for proper overflow handling (include end drop zone)
    // Use UNIFIED visual state's totalWidth - no duplicate calculation
    const totalHeaderWidth = visualState.geometry.totalWidth;
    headerRow.style.width = `${totalHeaderWidth}px`;
    headerRow.style.minWidth = `${totalHeaderWidth}px`;

    this.headerContainer.appendChild(headerRow);

    // Update header container width
    this.headerContainer.style.width = `${totalHeaderWidth}px`;
    this.headerContainer.style.minWidth = `${totalHeaderWidth}px`;

    // Only update coordinate mapping if columns actually changed
    if (needsCoordinateUpdate) {
      this.coordinateMapping.version++;
      this.updateCoordinateMapping(this.coordinateMapping);
    }
    
    fileLog.info('✅ Header rendered with total width', { totalHeaderWidth });
  }

  /**
   * Create column header element
   */
  private createColumnHeader(column: any, actualIndex: number, xOffset: number): HTMLElement {
    // Use single source of truth for column width
    const actualWidth = getColumnWidth(column.id);
    const headerCell = this.domFactory.createHeaderCell(column, actualWidth);
    
    // Create header content with text and sort icon
    const textGroup = this.domFactory.createHeaderTextGroup(column);
    headerCell.appendChild(textGroup);
    
    // Update sort indicator if column is sorted
    this.updateSortIndicator(headerCell, column);
    
    // Add resize handle
    const resizeHandle = this.domFactory.createResizeHandle();
    this.setupResizeHandler(resizeHandle, column);
    headerCell.appendChild(resizeHandle);
    
    // Add click handler for sorting and column selection
    this.setupHeaderClickHandler(headerCell, column);

    // Add drag handling for column reordering - MOVED TO MOUSECONTROLLER
    // this.setupColumnDragHandlers(headerCell, column);

    // Disable HTML5 drag on header cells - MouseController will handle all dragging
    headerCell.draggable = false;

    // Add data attribute for MouseController to identify column
    headerCell.setAttribute('data-column-id', column.id);

    return headerCell;
  }

  /**
   * Create end drop zone for placing columns at the end
   */
  private createEndDropZone(): HTMLElement {
    const endDropZone = document.createElement('div');
    endDropZone.className = 'vibegridx-end-drop-zone';
    endDropZone.style.cssText = `
      position: relative;
      width: 20px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      border-left: 1px dashed transparent;
      transition: border-color 0.15s ease;
    `;

    // Add drop handlers for inserting at the end
    endDropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      // Remove any existing insertion lines from column headers
      document.querySelectorAll('.column-drop-line').forEach(line => line.remove());

      // Show visual feedback for end insertion
      endDropZone.style.borderLeftColor = '#3b82f6';
      endDropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    });

    endDropZone.addEventListener('dragleave', (e: DragEvent) => {
      // Only remove if actually leaving (not moving to child elements)
      if (!endDropZone.contains(e.relatedTarget as Node)) {
        endDropZone.style.borderLeftColor = 'transparent';
        endDropZone.style.backgroundColor = 'transparent';
      }
    });

    endDropZone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();

      // Clear visual feedback
      endDropZone.style.borderLeftColor = 'transparent';
      endDropZone.style.backgroundColor = 'transparent';

      const draggedColumnId = e.dataTransfer!.getData('text/plain');
      if (draggedColumnId) {
        fileLog.info('🎯 Column dropped at end position', { draggedColumnId });

        // Move column to the end by using the last column as target with insertBefore=false
        const columns = this.tableCore$.columns.get();
        if (columns.length > 0) {
          const lastColumn = columns[columns.length - 1];
          if (lastColumn.id !== draggedColumnId) {
            // Insert after the last column (insertBefore=false)
            this.tableCore$.reorderColumn(draggedColumnId, lastColumn.id, false);
          }
        }
      }
    });

    return endDropZone;
  }

  /**
   * Update column coordinate mapping
   * @returns true if mapping changed, false if unchanged
   */
  private updateColumnCoordinateMapping(allVisibleColumns: any[]): boolean {
    const newColumns: any[] = [];
    let xOffset = 70; // Start after drag column (30px) + row header (40px)

    // Build new coordinate mapping for all visible columns
    // Get reactive column widths
    const columnWidths = this.tableCore$.columnWidths.get();

    allVisibleColumns.forEach((column, index) => {
      const actualWidth = getColumnWidth(column.id);
      newColumns.push({
        columnId: column.id,
        x: xOffset,
        width: actualWidth,
        index: index,
        offset: xOffset
      });
      xOffset += actualWidth;
    });

    // Check if coordinate mapping has changed (including position)
    const hasChanged = !this.coordinateMapping.columns ||
      this.coordinateMapping.columns.length !== newColumns.length ||
      newColumns.some((newCol, index) => {
        const oldCol = this.coordinateMapping.columns?.[index];
        return !oldCol ||
               oldCol.columnId !== newCol.columnId ||
               oldCol.width !== newCol.width ||
               oldCol.x !== newCol.x;
      });

    if (hasChanged) {
      this.coordinateMapping.columns = newColumns;

      fileLog.debug('🔄 Column coordinate mapping updated', {
        newColumnCount: newColumns.length,
        firstColumnId: newColumns[0]?.columnId,
        mappingVersion: this.coordinateMapping.version,
        sampleColumns: newColumns.slice(0, 3).map(c => ({ id: c.columnId, x: c.x, width: c.width }))
      });

      return true;
    }

    return false;
  }

  /**
   * Set up select all checkbox handler
   */
  private setupSelectAllHandler(): void {
    if (!this.selectAllCheckbox) return;
    
    this.selectAllCheckbox.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Check current selection state to determine action
      const selectedCells = this.tableInteraction$.selectedCells.get();
      const processedRows = this.tableCore$.processedRows.get();
      const columns = this.tableCore$.columns.get();
      const columnVisibility = this.tableCore$.columnVisibility.get();
      const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
      
      fileLog.info('🎯 Select all checkbox clicked', {
        currentSelection: selectedCells.size,
        totalRows: processedRows.length,
        totalColumns: visibleColumns.length
      });
      
      if (selectedCells.size === 0) {
        // REACTIVE: No selection - select all directly via state
        this.tableInteraction$.selectAll({
          rows: processedRows,
          columns: visibleColumns,
          columnVisibility
        });
        fileLog.info('✅ Select all triggered reactively');
      } else {
        // REACTIVE: Has selection - clear all directly via state
        this.tableInteraction$.clearSelection();
        fileLog.info('✅ Clear selection triggered reactively');
      }
    });
  }

  /**
   * Set up resize handler for column
   */
  private setupResizeHandler(resizeHandle: HTMLElement, column: any): void {
    let isResizing = false;
    let startX = 0;
    // Get actual width from centralized visual state
    let startWidth = getColumnWidth(column.id);

    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.pageX;
      // Update startWidth from current reactive state
      const currentColumnWidths = this.tableCore$.columnWidths.get();
      startWidth = currentColumnWidths[column.id] || column.width || 150;
      
      // Update interaction state
      this.tableInteraction$.columnResize.set({
        isResizing: true,
        columnId: column.id,
        startWidth: startWidth,
        newWidth: startWidth
      });
      
      // Add document-level listeners for resize
      let resizeRAF: number | null = null;
      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        // Throttle resize updates with requestAnimationFrame
        if (!resizeRAF) {
          resizeRAF = requestAnimationFrame(() => {
            const deltaX = e.pageX - startX;
            const newWidth = Math.max(50, startWidth + deltaX); // Min width 50px
            
            // Update resize state
            this.tableInteraction$.columnResize.set({
              isResizing: true,
              columnId: column.id,
              startWidth: startWidth,
              newWidth: newWidth
            });
            
            resizeRAF = null;
          });
        }
      };
      
      const handleMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;
        
        // Cancel any pending resize RAF
        if (resizeRAF) {
          cancelAnimationFrame(resizeRAF);
          resizeRAF = null;
        }
        
        const resizeState = this.tableInteraction$.columnResize.get();
        if (resizeState && resizeState.newWidth) {
          // Apply the new width
          visualOperations.setColumnWidth(column.id, resizeState.newWidth);
        }
        
        // Clear resize state
        this.tableInteraction$.columnResize.set(null);
        
        // Clean up listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }


  /**
   * Set up header click handler for sorting and column selection
   */
  private setupHeaderClickHandler(headerCell: HTMLElement, column: any): void {
    headerCell.style.cursor = 'pointer';
    headerCell.addEventListener('click', (e) => {
      // Don't sort if clicking on resize handle
      if ((e.target as HTMLElement).classList.contains('vibegridx-resize-handle')) {
        return;
      }
      
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      
      if (isCtrlKey && !isShiftKey) {
        // Ctrl+Click on header - select entire column
        e.preventDefault();
        if (this.selectionController) {
          this.selectionController.selectColumn(column.id);
        }
        fileLog.info('🎯 Column selected', { columnId: column.id });
      } else {
        // Regular click or Shift+click - toggle sort
        // Shift+click enables multi-column sorting
        const isMultiSort = isShiftKey;
        
        fileLog.info('🔄 Column header clicked for sort', { 
          columnId: column.id, 
          field: column.field,
          usingField: column.field || column.id,
          isMultiSort,
          isShiftKey
        });
        
        // Use column.field for sorting (data field), not column.id (display identifier)
        // Pass isMultiSort parameter to enable/disable multi-column sorting
        this.tableCore$.toggleSort(column.field || column.id, isMultiSort);
      }
    });
  }

  /**
   * Update sort indicator for a column
   */
  private updateSortIndicator(headerCell: HTMLElement, column: any): void {
    const sortState = this.tableCore$.sortBy.get();
    const columnSort = sortState.find((s: any) => s.field === (column.field || column.id));
    
    if (columnSort) {
      this.domFactory.updateSortIcon(headerCell, columnSort.direction);
    } else {
      this.domFactory.updateSortIcon(headerCell, null);
    }
  }

  /**
   * Update all sort indicators
   */
  updateSortIndicators(): void {
    const headerCells = this.headerContainer.querySelectorAll('.vibegridx-header-cell');
    const columns = this.tableCore$.columns.get();
    
    headerCells.forEach((headerCell, index) => {
      const fieldId = headerCell.getAttribute('data-field');
      const column = columns.find(c => c.id === fieldId);
      
      if (column) {
        this.updateSortIndicator(headerCell as HTMLElement, column);
      }
    });
  }

  /**
   * Update select all checkbox visual state
   */
  updateSelectAllCheckboxVisual(state: { checked: boolean; indeterminate: boolean }): void {
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.checked = state.checked;
      this.selectAllCheckbox.indeterminate = state.indeterminate;
      
      fileLog.info('☑️ Select all checkbox updated', {
        checked: state.checked,
        indeterminate: state.indeterminate
      });
    }
  }

  /**
   * Update header cell width during resize
   */
  updateHeaderCellWidth(columnId: string, newWidth: number): void {
    const headerCell = this.headerContainer.querySelector(`[data-field="${columnId}"]`) as HTMLElement;
    if (headerCell) {
      headerCell.style.flex = `0 0 ${newWidth}px`;
      
      fileLog.debug('📏 Header cell width updated', {
        columnId,
        newWidth
      });
    }
  }

  /**
   * Get header container reference
   */
  getHeaderContainer(): HTMLElement {
    return this.headerContainer;
  }

  /**
   * Get select all checkbox reference
   */
  getSelectAllCheckbox(): HTMLInputElement | null {
    return this.selectAllCheckbox;
  }

  /**
   * Create drag column header (permanently present for consistent layout)
   */
  private createDragColumnHeader(): HTMLElement {
    const dragColumnHeader = this.domFactory.createElement('div', 'vibegridx-drag-column-header');

    // Style to match drag column in body (30px wide)
    dragColumnHeader.style.cssText = `
      width: 30px;
      min-width: 30px;
      height: ${HEADER_HEIGHT}px;
      background: #f8f9fa;
      border-right: 1px solid #e9ecef;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      font-size: 11px;
      color: #9ca3af;
    `;

    // Add visual indicator when in grouped mode
    const isGroupedMode = this.isGroupedMode();
    if (isGroupedMode) {
      // Add a small drag indicator icon
      dragColumnHeader.innerHTML = `
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" style="opacity: 0.4;">
          <circle cx="2" cy="3" r="1"/>
          <circle cx="6" cy="3" r="1"/>
          <circle cx="2" cy="6" r="1"/>
          <circle cx="6" cy="6" r="1"/>
          <circle cx="2" cy="9" r="1"/>
          <circle cx="6" cy="9" r="1"/>
        </svg>
      `;
      dragColumnHeader.title = 'Drag to reorder rows within groups';
    } else {
      // Empty space when not in grouped mode
      dragColumnHeader.innerHTML = '';
    }

    return dragColumnHeader;
  }

  /**
   * Check if we're currently in grouped mode
   */
  private isGroupedMode(): boolean {
    try {
      const groupConfig = visualOperations.getGroupConfig();
      return groupConfig && groupConfig.fields && groupConfig.fields.length > 0;
    } catch (error) {
      // If visual operations aren't available, fallback to direct check
      const tableCore = this.tableCore$.get();
      return tableCore.grouping && tableCore.grouping.fields && tableCore.grouping.fields.length > 0;
    }
  }
}