/**
 * SimplePassiveRenderer - Basic working table without overlays
 * 
 * This is a simplified version to get the basic table working first,
 * then we can add overlays back once we have the foundation working.
 */

import { observe } from '@legendapp/state';
import { uiLog } from '@/logger';
import type { 
  TableCore$, 
  TableInteraction$, 
  TableViewport$ 
} from '../../stores/pure-observables';
import { CanvasOverlayDOM } from '../../overlays/CanvasOverlayDOM';
import { EditingOverlay } from '../../overlays/EditingOverlay';
import { ContextMenuManager } from '../../components/ContextMenu';
import { SelectionManager } from '../managers/SelectionManager';
import type { ViewportInfo, TableRow } from '../../types';
import type { VisualCellPosition } from '../../overlays/OverlayTypes';

const log = uiLog('components/custom/vibegrid/renderers/core/SimplePassiveRenderer.ts');

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;

export interface SimplePassiveRendererOptions {
  container: HTMLElement;
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  tableViewport$: TableViewport$;
  enableSelectionColumn?: boolean;
  bufferSize?: number;
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
  onBatchEntityUpdate?: (updates: Array<{ id: string; updates: Record<string, any> }>) => Promise<void> | void;
}

export class SimplePassiveRenderer {
  private container: HTMLElement;
  private viewport: HTMLElement | null = null;
  private headerContainer: HTMLElement | null = null;
  private headerViewport: HTMLElement | null = null;
  private bodyContainer: HTMLElement | null = null;
  private disposers: (() => void)[] = [];
  
  // Observable references
  private tableCore$: TableCore$;
  private tableInteraction$: TableInteraction$;
  private tableViewport$: TableViewport$;
  
  // Basic row management
  private activeRows: Map<string, HTMLElement> = new Map();
  
  // Complete overlay system and selection manager
  private canvasOverlay: CanvasOverlayDOM | null = null;
  private selectionManager: SelectionManager | null = null;
  private editingOverlay: EditingOverlay | null = null;
  private contextMenu: ContextMenuManager | null = null;
  
  // Coordinate mapping for overlays
  private coordinateMapping = {
    rows: [] as Array<{ rowId: string; y: number; height: number; index: number }>,
    columns: [] as Array<{ columnId: string; x: number; width: number; index: number; offset: number }>,
    version: 0
  };
  
  // Scroll coordination
  private _scrollRAF: number | null = null;
  
  // Row range selection tracking
  private lastSelectedRowId: string | null = null;
  
  // Keyboard navigation tracking
  private focusedCell: string | null = null; // format: "rowId:columnId"
  private selectionAnchor: string | null = null; // anchor cell for range selection
  
  // UI element references
  private selectAllCheckbox: HTMLInputElement | null = null;
  
  constructor(private options: SimplePassiveRendererOptions) {
    log.info('🎯 SimplePassiveRenderer: Initializing');
    
    this.container = options.container;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    
    this.initDOM();
    this.initOverlays();
    this.setupObservers();
    this.setupScrollHandling();
  }
  
  /**
   * Initialize overlay components
   */
  private initOverlays(): void {
    log.info('🎨 Initializing overlays');
    
    // Create complete canvas overlay system
    this.canvasOverlay = new CanvasOverlayDOM(
      {
        selectionColor: 'rgba(59, 130, 246, 0.1)',
        selectionBorderColor: 'rgb(59, 130, 246)',
        selectionBorderWidth: 2,
        cellHeight: ROW_HEIGHT,
        cellWidth: 150 // Default width, will be updated by coordinate mapping
      },
      (event) => {
        log.info('📋 Canvas overlay event:', event);
        // Handle fill events from the overlay system
      }
    );
    this.canvasOverlay.init(this.container);

    // Create selection manager with DOM dependencies
    this.selectionManager = new SelectionManager({
      getCellElement: (rowId: string, columnId: string) => {
        const cellElement = this.container.querySelector(`[data-cell-id="${rowId}:${columnId}"]`) as HTMLElement;
        return cellElement;
      },
      forEachRowElement: (callback: (element: HTMLElement, rowId: string) => void) => {
        const rowElements = this.container.querySelectorAll('[data-row-id]');
        rowElements.forEach((element) => {
          const rowId = element.getAttribute('data-row-id');
          if (rowId) callback(element as HTMLElement, rowId);
        });
      },
      getHeaderElement: () => this.headerContainer!,
      isSelectionColumnEnabled: () => this.options.enableSelectionColumn ?? false
    });
    
    // Create editing overlay
    this.editingOverlay = new EditingOverlay(this.container, {
      // Pass tableInteraction$ for direct observable commit (new architecture)
      tableInteraction$: this.tableInteraction$,
      // Fallback callbacks for old architecture compatibility
      onCommit: async (value) => {
        await this.tableInteraction$.saveEdit(value);
      },
      onCancel: () => {
        this.tableInteraction$.cancelEdit();
      },
      // Add relationshipContext for ComboboxEditor options loading
      relationshipContext: {
        // Basic context object - ComboboxEditor mainly just checks for existence
        relationshipResolvers: {}
      },
      // Add getRowData function to access current row data from observables
      getRowData: (rowId: string) => {
        const processedRows = this.tableCore$.processedRows.get();
        return processedRows.find((row: any) => row.id === rowId) || null;
      }
    });
    
    // Create context menu manager
    this.contextMenu = new ContextMenuManager(this.container);
    
    log.info('✅ Canvas overlay system initialized');
  }
  
  /**
   * Initialize DOM structure
   */
  private initDOM(): void {
    this.container.innerHTML = '';
    
    // Create basic table structure
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    
    // Create main table container
    const table = this.createElement('div', 'vibegridx-table');
    
    // Header viewport wrapper (for proper horizontal scrolling sync)
    this.headerViewport = this.createElement('div', 'vibegridx-header-viewport');
    this.headerViewport.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${HEADER_HEIGHT}px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      overflow-x: scroll;
      overflow-y: hidden;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      z-index: 10;
    `;
    
    // Hide webkit scrollbars for header viewport
    this.headerViewport.style.setProperty('-webkit-overflow-scrolling', 'touch');
    
    // Header container (scrollable content inside viewport)
    this.headerContainer = this.createElement('div', 'vibegridx-header');
    this.headerContainer.style.cssText = `
      position: relative;
      white-space: nowrap;
      height: 100%;
    `;
    
    // Viewport (scrollable area)
    this.viewport = this.createElement('div', 'vibegridx-viewport');
    this.viewport.style.cssText = `
      position: absolute;
      top: ${HEADER_HEIGHT}px;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: auto;
    `;
    
    // Body container (inside viewport)
    this.bodyContainer = this.createElement('div', 'vibegridx-body');
    this.bodyContainer.style.cssText = `
      position: relative;
      width: 100%;
    `;
    
    // Assemble structure with header viewport wrapper
    this.headerViewport.appendChild(this.headerContainer);
    this.viewport.appendChild(this.bodyContainer);
    table.appendChild(this.headerViewport);
    table.appendChild(this.viewport);
    this.container.appendChild(table);
    
    // Initialize viewport dimensions
    setTimeout(() => {
      if (this.viewport) {
        const rect = this.viewport.getBoundingClientRect();
        this.tableViewport$.updateViewport(rect.width, rect.height);
      }
    }, 0);
    
    log.info('✅ DOM structure created');
  }
  
  /**
   * Setup reactive observers
   */
  private setupObservers(): void {
    log.info('🔍 Setting up observers');
    
    // Observe columns changes
    const columnsDisposer = observe(() => {
      const columns = this.tableCore$.columns.get();
      log.info('📊 Columns changed', { count: columns.length });
      this.renderHeader();
      this.renderBody();
    });
    this.disposers.push(columnsDisposer);
    
    // Observe column visibility changes
    const columnVisibilityDisposer = observe(() => {
      const columnVisibility = this.tableCore$.columnVisibility.get();
      const hiddenCount = Object.values(columnVisibility).filter(visible => visible === false).length;
      log.info('👁️ Column visibility changed', { hiddenCount });
      // Only re-render header and body - both need to filter columns
      this.renderHeader();
      this.renderBody();
    });
    this.disposers.push(columnVisibilityDisposer);
    
    // Observe processed rows changes
    const rowsDisposer = observe(() => {
      const rows = this.tableCore$.processedRows.get();
      log.info('📋 Rows changed', { count: rows.length });
      this.renderBody();
    });
    this.disposers.push(rowsDisposer);
    
    // Observe viewport changes
    const viewportDisposer = observe(() => {
      const scrollTop = this.tableViewport$.scrollTop.get();
      const scrollLeft = this.tableViewport$.scrollLeft.get();
      const viewportWidth = this.tableViewport$.viewportWidth.get();
      const viewportHeight = this.tableViewport$.viewportHeight.get();
      
      log.info('🖼️ Viewport changed', { 
        scrollTop, 
        scrollLeft, 
        viewportWidth, 
        viewportHeight 
      });
      this.handleViewportChange();
    });
    this.disposers.push(viewportDisposer);
    
    // Observe selection changes and update overlay
    const selectionDisposer = observe(() => {
      const selectedCells = this.tableInteraction$.selectedCells.get();
      const scrollTop = this.tableViewport$.scrollTop.get();
      const scrollLeft = this.tableViewport$.scrollLeft.get();
      const viewportHeight = this.tableViewport$.viewportHeight.get();
      
      log.info('🎯 Selection changed', { 
        selectedCount: selectedCells.size,
        scrollTop,
        viewportHeight 
      });
      
      // Checkbox state is now handled by the computed observable and observer
      
      // Update selection using both SelectionManager and CanvasOverlayDOM
      if (this.selectionManager) {
        this.selectionManager.setSelectedCells(selectedCells);
      }

      // Apply CSS classes to DOM cells for immediate visual feedback
      this.updateDOMSelectionClasses(selectedCells);

      // Update visual overlays via CanvasOverlayDOM with calculated positions
      if (this.canvasOverlay) {
        // Update coordinate mapping first
        this.canvasOverlay.updateCoordinateMapping(this.coordinateMapping);
        
        // Update viewport
        const viewportInfo: ViewportInfo = {
          start: Math.floor(scrollTop / ROW_HEIGHT),
          end: Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT),
          scrollTop: scrollTop,
          scrollLeft: scrollLeft
        };
        this.canvasOverlay.updateViewport(viewportInfo);
        
        // Calculate visual positions for selected cells
        const visualCells = this.calculateVisualCellPositions(selectedCells);
        
        // Update selection with visual positions (proper method)
        this.canvasOverlay.updateSelectionWithVisualPositions(visualCells);
        
        // Render fill handle with visual positions
        if (visualCells.length > 0) {
          this.canvasOverlay.renderFillHandle(visualCells, undefined, viewportInfo);
        } else {
          this.canvasOverlay.hideFillHandle();
        }
      }
    });
    this.disposers.push(selectionDisposer);
    
    // Observe select all checkbox state changes
    const checkboxDisposer = observe(() => {
      const checkboxState = this.tableInteraction$.selectAllCheckboxState.get();
      this.updateSelectAllCheckboxVisual(checkboxState);
    });
    this.disposers.push(checkboxDisposer);
    
    // Observe editing state and show/hide editing overlay
    const editingDisposer = observe(() => {
      const editingCell = this.tableInteraction$.editingCell.get();
      const editValue = this.tableInteraction$.editValue.get();
      
      if (editingCell && this.editingOverlay) {
        const [rowId, columnId] = editingCell.split(':');
        // Find the cell element
        const cellElement = this.container.querySelector(
          `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
        ) as HTMLElement;
        
        if (cellElement) {
          const rect = cellElement.getBoundingClientRect();
          const containerRect = this.container.getBoundingClientRect();
          
          // Get column info
          const columns = this.tableCore$.columns.get();
          const column = columns.find((col: any) => col.id === columnId);
          
          if (column) {
            const position = {
              x: rect.left - containerRect.left,
              y: rect.top - containerRect.top,
              width: rect.width,
              height: rect.height
            };
            
            const cell = { rowId, columnId };
            
            log.debug('🖊️ Showing edit overlay', {
              editingCell,
              position,
              cell,
              column: column.id,
              value: editValue
            });
            
            this.editingOverlay.showAt(position, cell, column, editValue || '');
          }
        }
      } else if (this.editingOverlay) {
        this.editingOverlay.hide();
      }
    });
    this.disposers.push(editingDisposer);
    
    // Observe column resize state
    const resizeDisposer = observe(() => {
      const resizeState = this.tableInteraction$.columnResize.get();
      
      // Update header cell width during resize
      if (resizeState && resizeState.isResizing && resizeState.columnId && resizeState.newWidth) {
        this.updateHeaderCellWidth(resizeState.columnId, resizeState.newWidth);
      }
      
      if (this.canvasOverlay) {
        // Update coordinate mapping and column resize preview via CanvasOverlayDOM
        this.canvasOverlay.updateCoordinateMapping(this.coordinateMapping);
        this.canvasOverlay.updateColumnResizePreview(resizeState);
      }
    });
    this.disposers.push(resizeDisposer);
    
    // Observe drag state for drag preview
    const dragDisposer = observe(() => {
      const isDragging = this.tableInteraction$.isDragging.get();
      const dragSource = this.tableInteraction$.dragSource.get();
      const dragTarget = this.tableInteraction$.dragTarget.get();
      const scrollTop = this.tableViewport$.scrollTop.get();
      const scrollLeft = this.tableViewport$.scrollLeft.get();
      const viewportHeight = this.tableViewport$.viewportHeight.get();
      
      if (this.canvasOverlay) {
        // Update coordinate mapping
        this.canvasOverlay.updateCoordinateMapping(this.coordinateMapping);
        
        // Create drag state if dragging
        if (isDragging && dragSource) {
          const dragState = {
            isDragging: true,
            startCell: dragSource,
            currentCell: dragTarget || dragSource
          };
          
          const viewportInfo: ViewportInfo = {
            start: Math.floor(scrollTop / ROW_HEIGHT),
            end: Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT),
            scrollTop: scrollTop,
            scrollLeft: scrollLeft
          };
          
          this.canvasOverlay.updateDragPreview(dragState, viewportInfo);
        } else {
          this.canvasOverlay.updateDragPreview(null, null);
        }
      }
    });
    this.disposers.push(dragDisposer);
    
    // Sort observer - updates sort indicators when sort state changes
    const sortDisposer = observe(() => {
      const sortBy = this.tableCore$.sortBy.get();
      log.debug('🔄 Sort state changed, updating indicators', { sortBy });
      
      // Update sort indicators after a small delay to ensure header is rendered
      requestAnimationFrame(() => {
        this.updateSortIndicators();
      });
    });
    this.disposers.push(sortDisposer);
    
    // Setup context menu event handler
    this.setupContextMenu();
    
    log.info('✅ All observers and event handlers set up');
  }

  /**
   * Create DOM element with class - matches UnifiedTableRenderer pattern
   */
  private createElement(tag: string, className: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  }
  
  /**
   * Create group header element with expand/collapse functionality
   */
  private createGroupHeaderElement(groupRow: any, rowIndex: number): HTMLElement {
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
    
    // Group label with count
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
    
    rowElement.appendChild(expandButton);
    rowElement.appendChild(groupLabel);
    
    // Add click handler for expand/collapse
    rowElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      log.info('🎯 Group header clicked', { 
        groupId: groupRow.id, 
        currentlyExpanded: isExpanded 
      });
      
      // Toggle group expansion via tableCore$
      this.tableCore$.toggleGroupExpansion(groupRow.id);
    });
    
    return rowElement;
  }
  
  /**
   * Setup context menu handling
   */
  private setupContextMenu(): void {
    // Add right-click handler for context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const cellElement = (e.target as HTMLElement).closest('[data-row-id][data-column-id]') as HTMLElement;
      if (cellElement && this.contextMenu) {
        const rowId = cellElement.dataset.rowId;
        const columnId = cellElement.dataset.columnId;
        
        log.info('🖱️ Context menu triggered', { rowId, columnId });
        
        // Show context menu
        this.contextMenu.show({
          isVisible: true,
          position: {
            x: e.pageX,
            y: e.pageY,
            clientX: e.clientX,
            clientY: e.clientY
          },
          context: {
            type: 'cell' as const,
            rowId,
            columnId
          },
          onClose: () => {
            this.contextMenu?.hide();
          },
          onCopy: () => {
            log.info('📋 Copy action');
            // Implement copy logic via tableInteraction$
            this.contextMenu?.hide();
          },
          onPaste: () => {
            log.info('📋 Paste action');
            // Implement paste logic via tableInteraction$
            this.contextMenu?.hide();
          },
          onCut: () => {
            log.info('✂️ Cut action');
            // Implement cut logic via tableInteraction$
            this.contextMenu?.hide();
          },
          onInsertRow: () => {
            log.info('➕ Insert row action');
            // Implement insert row logic via tableCore$
            this.contextMenu?.hide();
          },
          onDeleteRow: () => {
            log.info('➖ Delete row action');
            // Implement delete row logic via tableCore$
            this.contextMenu?.hide();
          }
        });
      }
    });
  }
  
  /**
   * Render table header
   */
  private renderHeader(): void {
    if (!this.headerContainer) return;
    
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get(); // Cache once
    log.info('🎨 Rendering header', { columnCount: columns.length });
    
    this.headerContainer.innerHTML = '';
    
    const headerRow = this.createElement('div', 'vibegridx-header-row');
    headerRow.style.cssText = `
      display: flex;
      height: ${HEADER_HEIGHT}px;
      align-items: center;
    `;
    
    // Add corner header cell (aligns with row headers)
    const cornerCell = this.createElement('div', 'vibegridx-corner-header');
    cornerCell.style.cssText = `
      width: 40px;
      min-width: 40px;
      height: ${HEADER_HEIGHT}px;
      background: #f8f9fa;
      border-right: 1px solid #e9ecef;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: pointer;
    `;

    if (this.options.enableSelectionColumn) {
      // Add "select all" checkbox in corner
      this.selectAllCheckbox = document.createElement('input');
      this.selectAllCheckbox.type = 'checkbox';
      this.selectAllCheckbox.style.cssText = `
        width: 16px;
        height: 16px;
        cursor: pointer;
        margin: 0;
      `;
      this.selectAllCheckbox.title = 'Select all rows';
      
      // Add click handler for select all
      this.selectAllCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Check current selection state to determine action
        const selectedCells = this.tableInteraction$.selectedCells.get();
        const processedRows = this.tableCore$.processedRows.get();
        const columns = this.tableCore$.columns.get();
        const visibleColumns = columns.filter(col => {
          return columnVisibility[col.id] !== false;
        });
        const totalCells = processedRows.length * visibleColumns.length;
        
        log.info('🎯 Select all checkbox clicked', {
          currentSelection: selectedCells.size,
          totalCells,
          checkboxChecked: this.selectAllCheckbox!.checked
        });
        
        // If we have any selection (full or partial), clear it
        // If we have no selection, select all
        if (selectedCells.size > 0) {
          this.tableInteraction$.clearSelection();
          log.info('🎯 Select all checkbox - clearing selection');
        } else {
          this.selectAllCells();
          log.info('🎯 Select all checkbox - selecting all');
        }
      });
      
      cornerCell.appendChild(this.selectAllCheckbox);
    }
    
    headerRow.appendChild(cornerCell);
    
    // Get virtual column range for horizontal scrolling
    const visibleColumnRange = this.tableViewport$.visibleColumns.get();
    const allVisibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    // Apply horizontal virtual scrolling - only render columns in visible range
    const startColIndex = Math.max(0, visibleColumnRange.start);
    const endColIndex = Math.min(allVisibleColumns.length, visibleColumnRange.end);
    const virtualColumns = allVisibleColumns.slice(startColIndex, endColIndex);
    
    log.info('🎨 Rendering header with column virtual scrolling', { 
      totalColumns: columns.length,
      allVisibleColumns: allVisibleColumns.length,
      virtualRange: `${startColIndex}-${endColIndex}`,
      renderingColumns: virtualColumns.length
    });
    
    // Update column coordinate mapping (account for 40px row header)
    this.coordinateMapping.columns = [];
    let xOffset = 40; // Start after row header
    
    // Build complete coordinate mapping for all visible columns (for overlays)
    allVisibleColumns.forEach((column, index) => {
      this.coordinateMapping.columns.push({
        columnId: column.id,
        x: xOffset,
        width: column.width,
        index: index,
        offset: xOffset
      });
      xOffset += column.width;
    });
    
    // Reset xOffset for virtual column rendering
    xOffset = 40;
    for (let i = 0; i < startColIndex; i++) {
      xOffset += allVisibleColumns[i].width;
    }
    
    virtualColumns.forEach((column, virtualIndex) => {
      const actualIndex = startColIndex + virtualIndex;
      const headerCell = this.createElement('div', 'vibegridx-header-cell');
      headerCell.dataset.field = column.id; // Add field ID for sort updates
      headerCell.style.cssText = `
        flex: 0 0 ${column.width}px;
        height: 100%;
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        border-right: 1px solid #e9ecef;
        background: #f8f9fa;
        position: relative;
      `;
      
      // Create header content with text and sort icon (like HeaderEngine)
      const textGroup = this.createElement('div', 'vibegridx-header-text-group');
      textGroup.style.cssText = 'display: flex; align-items: center; gap: 4px;';
      
      // Header text
      const headerText = this.createElement('span', 'vibegridx-header-text');
      headerText.textContent = column.label;
      
      // Sort icon (if column is sortable)
      if (column.sortable !== false) {
        const sortIcon = this.createElement('span', 'vibegridx-sort-icon');
        sortIcon.innerHTML = this.createSortIconSVG(null); // No sort initially
        textGroup.appendChild(headerText);
        textGroup.appendChild(sortIcon);
      } else {
        textGroup.appendChild(headerText);
      }
      
      headerCell.appendChild(textGroup);
      
      // Add resize handle
      const resizeHandle = this.createElement('div', 'vibegridx-resize-handle');
      resizeHandle.style.cssText = `
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        cursor: col-resize;
        background: transparent;
        z-index: 1;
      `;
      
      // Add resize handle events
      let isResizing = false;
      let startX = 0;
      let startWidth = column.width;
      
      resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.pageX;
        startWidth = column.width;
        
        // Update interaction state
        this.tableInteraction$.columnResize.set({
          isResizing: true,
          columnId: column.id,
          startWidth: startWidth,
          newWidth: startWidth
        });
        
        // Add document-level listeners for resize
        const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing) return;
          
          const deltaX = e.pageX - startX;
          const newWidth = Math.max(50, startWidth + deltaX); // Min width 50px
          
          // Update resize state
          this.tableInteraction$.columnResize.set({
            isResizing: true,
            columnId: column.id,
            startWidth: startWidth,
            newWidth: newWidth
          });
        };
        
        const handleMouseUp = () => {
          if (!isResizing) return;
          isResizing = false;
          
          const resizeState = this.tableInteraction$.columnResize.get();
          if (resizeState && resizeState.newWidth) {
            // Apply the new width
            this.tableCore$.updateColumnWidth(column.id, resizeState.newWidth);
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
      
      headerCell.appendChild(resizeHandle);
      
      // Update xOffset for next column positioning
      xOffset += column.width;
      
      // Add click handler for sorting and column selection
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
          this.selectColumn(column.id);
          log.info('🎯 Column selected', { columnId: column.id });
        } else {
          // Regular click or Shift+click - toggle sort
          // Shift+click enables multi-column sorting
          const isMultiSort = isShiftKey;
          
          log.info('🔄 Column header clicked for sort', { 
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
      
      headerRow.appendChild(headerCell);
    });
    
    this.headerContainer.appendChild(headerRow);
    this.coordinateMapping.version++;
    log.info('✅ Header rendered');
  }
  
  /**
   * Render table body
   */
  private renderBody(): void {
    if (!this.bodyContainer) return;
    
    const rows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get(); // Cache once
    
    log.info('🎨 Rendering body', { 
      rowCount: rows.length, 
      columnCount: columns.length 
    });
    
    this.bodyContainer.innerHTML = '';
    
    // Set total height for virtual scrolling
    const totalHeight = rows.length * ROW_HEIGHT;
    this.bodyContainer.style.height = `${totalHeight}px`;
    
    // Update row coordinate mapping
    this.coordinateMapping.rows = [];
    
    // Virtual scrolling: Only render visible rows
    const visibleRange = this.tableViewport$.visibleRange.get();
    const startIndex = Math.max(0, visibleRange.start);
    const endIndex = Math.min(rows.length, visibleRange.end);
    const visibleRows = rows.slice(startIndex, endIndex);
    
    log.debug('🎨 Virtual scrolling', { 
      totalRows: rows.length, 
      visibleRange: `${startIndex}-${endIndex}`,
      rendering: visibleRows.length
    });
    
    // Get virtual column range for horizontal scrolling (same as header)
    const visibleColumnRange = this.tableViewport$.visibleColumns.get();
    const allVisibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    // Apply horizontal virtual scrolling - only render columns in visible range
    const startColIndex = Math.max(0, visibleColumnRange.start);
    const endColIndex = Math.min(allVisibleColumns.length, visibleColumnRange.end);
    const virtualColumns = allVisibleColumns.slice(startColIndex, endColIndex);
    
    // Render only visible rows with proper positioning
    visibleRows.forEach((row, visibleIndex) => {
      const actualRowIndex = startIndex + visibleIndex;
      
      let rowElement: HTMLElement;
      
      // Check if this is a group header or data row
      if (row.type === 'group') {
        rowElement = this.createGroupHeaderElement(row, actualRowIndex);
      } else {
        rowElement = this.createRowElement(row.data || row, actualRowIndex, virtualColumns, columnVisibility);
      }
      
      this.bodyContainer.appendChild(rowElement);
      
      // Add to coordinate mapping (all rows for overlay positioning)
    });
    
    // Build complete coordinate mapping for all rows (needed for overlays)
    rows.forEach((row, rowIndex) => {
      this.coordinateMapping.rows.push({
        rowId: row.id,
        y: rowIndex * ROW_HEIGHT,
        height: ROW_HEIGHT,
        index: rowIndex
      });
    });
    
    this.coordinateMapping.version++;
    log.info('✅ Body rendered', { totalHeight });
  }
  
  /**
   * Apply CSS classes to DOM cells for selection state
   */
  private updateDOMSelectionClasses(selectedCells: Set<string>): void {
    // Remove existing selection classes from all cells
    const allCells = this.container.querySelectorAll('.vibegridx-cell');
    allCells.forEach(cell => {
      cell.classList.remove('vibegridx-selected');
    });
    
    // Apply selection classes to selected cells
    selectedCells.forEach(cellId => {
      const [rowId, columnId] = cellId.split(':');
      const cellElement = this.container.querySelector(
        `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      );
      if (cellElement) {
        cellElement.classList.add('vibegridx-selected');
      }
    });
    
    log.info('✅ DOM selection classes updated', { selectedCount: selectedCells.size });
  }
  
  /**
   * Calculate visual cell positions for canvas overlays
   */
  private calculateVisualCellPositions(selectedCells: Set<string>): VisualCellPosition[] {
    const visualCells: VisualCellPosition[] = [];
    
    selectedCells.forEach(cellId => {
      const [rowId, columnId] = cellId.split(':');
      const cellElement = this.container.querySelector(
        `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      ) as HTMLElement;
      
      if (cellElement && this.viewport) {
        const cellRect = cellElement.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        
        visualCells.push({
          cellKey: cellId,
          x: cellRect.left - containerRect.left,
          y: cellRect.top - containerRect.top,
          width: cellRect.width,
          height: cellRect.height
        });
      }
    });
    
    log.info('✅ Visual cell positions calculated', { 
      selectedCount: selectedCells.size,
      visualCount: visualCells.length 
    });
    
    return visualCells;
  }
  
  /**
   * Create a row element
   */
  private createRowElement(
    row: any, 
    rowIndex: number, 
    columns: any[],
    columnVisibility: Record<string, boolean>
  ): HTMLElement {
    const rowElement = this.createElement('div', 'vibegridx-row');
    rowElement.dataset.rowId = row.id;
    rowElement.style.cssText = `
      position: absolute;
      top: ${rowIndex * ROW_HEIGHT}px;
      left: 0;
      right: 0;
      height: ${ROW_HEIGHT}px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #f1f3f5;
      background: ${rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa'};
    `;
    
    // Add row header (row number or checkbox selector)
    const rowHeader = this.createElement('div', 'vibegridx-row-header');
    rowHeader.style.cssText = `
      width: 40px;
      min-width: 40px;
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
      flex-shrink: 0;
    `;
    rowHeader.dataset.rowId = row.id;

    if (this.options.enableSelectionColumn) {
      // Create checkbox for row selection
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        cursor: pointer;
        margin: 0;
      `;
      checkbox.dataset.rowId = row.id;
      
      // Check if this row is currently selected (use ALL visible columns, not just virtual ones)
      const allVisibleColumns = this.tableCore$.columns.get().filter(col => 
        this.tableCore$.columnVisibility.get()[col.id] !== false
      );
      
      const selectedCells = this.tableInteraction$.selectedCells.get();
      const isRowSelected = allVisibleColumns.every(col => 
        selectedCells.has(`${row.id}:${col.id}`)
      ) && allVisibleColumns.length > 0;
      
      checkbox.checked = isRowSelected;
      
      rowHeader.appendChild(checkbox);
    } else {
      // Show row number
      rowHeader.textContent = String(rowIndex + 1);
    }
    
    // Add click handler for row selection
    rowHeader.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const isCtrlKey = e.ctrlKey || e.metaKey;
      
      // If click is directly on checkbox, let it handle the event
      if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
        const checkbox = target as HTMLInputElement;
        const isShiftKey = e.shiftKey;
        
        log.debug('🔘 Checkbox click detected', {
          rowId: row.id,
          isShiftKey,
          lastSelectedRowId: this.lastSelectedRowId,
          checkboxChecked: checkbox.checked
        });
        
        if (isShiftKey && this.lastSelectedRowId) {
          // Shift+Click for row range selection
          log.debug('🎯 Shift+Click detected - calling selectRowRange', {
            from: this.lastSelectedRowId,
            to: row.id
          });
          this.selectRowRange(this.lastSelectedRowId, row.id);
        } else {
          // Use toggleRowSelection for proper multi-row behavior
          log.debug('🔘 Regular click - calling toggleRowSelection', {
            rowId: row.id
          });
          this.toggleRowSelection(row.id);
          this.lastSelectedRowId = row.id;
        }
        return;
      }
      
      // Click on row header area (but not checkbox) - still select row
      if (isCtrlKey) {
        // Ctrl+Click on row header - add to selection
        e.preventDefault();
        // TODO: Implement multi-row selection
        this.selectRow(row.id);
      } else {
        // Regular click - select entire row
        this.selectRow(row.id);
      }
      
      log.info('🎯 Row header clicked', { rowId: row.id, isCtrlKey });
    });
    
    rowElement.appendChild(rowHeader);
    
    columns.forEach((column, colIndex) => {
      const cell = this.createCellElement(row, column, colIndex);
      rowElement.appendChild(cell);
    });
    
    return rowElement;
  }
  
  /**
   * Create a cell element with proper CSS-based dual-target system
   */
  private createCellElement(
    row: any, 
    column: any, 
    colIndex: number
  ): HTMLElement {
    const cellElement = this.createElement('div', 'vibegridx-cell');
    cellElement.dataset.rowId = row.id;
    cellElement.dataset.columnId = column.id;
    cellElement.style.cssText = `
      flex: 0 0 ${column.width}px;
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
    
    // Get cell value and determine content type for proper CSS classes
    const value = row[column.id];
    const cellType = column.cellType || column.type || 'text';
    
    // Create content element with proper CSS classes based on type
    // The content element should only take up the space it needs, not flex: 1
    let contentElement: HTMLElement;
    
    if (cellType === 'enum' || cellType === 'select') {
      // Badge/enum content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.createElement('span', 'vibegridx-enum-badge vibegridx-cell-badge-editable');
      contentElement.textContent = this.formatCellValue(value, cellType);
    } else if (this.isTagsField(column.id, value)) {
      // Tags field with comma-separated values - create multiple badges
      contentElement = this.createTagsElement(value, row, column);
    } else if (['number', 'integer', 'float'].includes(cellType)) {
      // Number content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.createElement('span', 'vibegridx-number-content vibegridx-cell-number-editable');
      contentElement.textContent = this.formatCellValue(value, cellType);
    } else if (cellType === 'boolean') {
      // Boolean content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.createElement('span', 'vibegridx-boolean-text vibegridx-cell-boolean-editable');
      contentElement.textContent = this.formatCellValue(value, cellType);
    } else if (value == null || value === '') {
      // Empty content - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.createElement('span', 'vibegridx-cell-empty-editable');
      contentElement.textContent = 'Click to edit';
      contentElement.style.fontSize = '12px';
      contentElement.style.opacity = '0.6';
    } else {
      // Text content (default) - only use specific classes, NOT vibegridx-cell-content
      contentElement = this.createElement('span', 'vibegridx-cell-text-editable');
      contentElement.textContent = this.formatCellValue(value, cellType);
    }
    
    // Let CSS classes handle all styling - no manual overrides
    // This ensures the clickable area matches exactly the text content size
    
    // Add click handler for content area - immediate edit mode
    contentElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const cellId = `${row.id}:${column.id}`;
      
      log.info('📝 Content clicked - entering edit mode', {
        rowId: row.id,
        columnId: column.id,
        value,
        cellType
      });
      
      // Start edit immediately
      this.tableInteraction$.startEdit(cellId, value ? String(value) : '');
    });
    
    cellElement.appendChild(contentElement);
    
    // Mouse down handler for cell selection (only on cell background, not content)
    cellElement.addEventListener('mousedown', (e) => {
      const target = e.target as Element;
      
      // If click is on content element with editable class, ignore for selection
      if (target && target.classList && (
          target.classList.contains('vibegridx-cell-text-editable') ||
          target.classList.contains('vibegridx-cell-badge-editable') ||
          target.classList.contains('vibegridx-cell-number-editable') ||
          target.classList.contains('vibegridx-cell-boolean-editable') ||
          target.classList.contains('vibegridx-cell-empty-editable'))) {
        log.info('📝 Content element clicked, ignoring for selection');
        return; // Content clicks are handled separately for editing
      }
      
      // Only proceed for cell background clicks (whitespace)
      if (target !== cellElement) {
        log.info('🖱️ Click not on cell element, ignoring', {
          targetElement: (target as HTMLElement)?.tagName,
          targetClass: (target as HTMLElement)?.className
        });
        return;
      }
      
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      const cellId = `${row.id}:${column.id}`;
      
      log.info('🖱️ Cell whitespace clicked - selection mode', { 
        rowId: row.id, 
        columnId: column.id,
        ctrl: isCtrlKey,
        shift: isShiftKey,
        target: (e.target as HTMLElement).className
      });
      
      // Update keyboard navigation focus
      this.focusedCell = cellId;
      if (!isCtrlKey && !isShiftKey) {
        // For single clicks, update the anchor
        this.selectionAnchor = cellId;
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
            this.tableInteraction$.updateDragSelection(currentCellId);
          }
        }
      };
      
      const handleMouseUp = (e: MouseEvent) => {
        log.info('🖱️ Mouse up - ending drag selection');
        this.tableInteraction$.endDragSelection();
        
        // Clean up listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
    
    // Click handler removed - all logic handled by mousedown and content click handlers
    
    // Double-click handler removed - immediate edit mode via content click
    
    // Remove drag handlers - cells should not be draggable for reordering
    // Drag functionality will be reserved for:
    // 1. Column headers (for reordering columns) 
    // 2. Fill handle (for filling data ranges)
    // Regular cells should only support selection, not dragging
    
    return cellElement;
  }
  
  /**
   * Format cell value based on type
   */
  private formatCellValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
      case 'datetime':
        return value instanceof Date ? value.toLocaleDateString() : String(value);
      case 'number':
        return typeof value === 'number' ? value.toString() : String(value);
      default:
        return String(value);
    }
  }
  
  /**
   * Handle viewport changes (scroll and dimension updates)
   * Triggers virtual scrolling updates when visible range changes
   */
  private handleViewportChange(): void {
    const scrollTop = this.tableViewport$.scrollTop.get();
    const scrollLeft = this.tableViewport$.scrollLeft.get();
    const viewportWidth = this.tableViewport$.viewportWidth.get();
    const viewportHeight = this.tableViewport$.viewportHeight.get();
    const visibleRange = this.tableViewport$.visibleRange.get();
    
    log.debug('📐 Viewport updated', { 
      scrollTop, 
      scrollLeft, 
      viewportWidth, 
      viewportHeight,
      visibleRange: `${visibleRange.start}-${visibleRange.end}`
    });
    
    // Update viewport dimensions if we have a container
    if (this.viewport && viewportWidth === 0) {
      const rect = this.viewport.getBoundingClientRect();
      this.tableViewport$.updateViewport(rect.width, rect.height);
    }
    
    // Trigger virtual scrolling update when scroll changes visible range
    // This will re-render only the visible rows
    this.renderBody();
  }
  
  /**
   * Destroy the renderer
   */
  destroy(): void {
    log.info('🧹 Destroying SimplePassiveRenderer');
    
    // Clean up observers
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    
    // Clean up selection manager and overlays
    if (this.selectionManager) {
      this.selectionManager.clearAllSelections();
    }
    if (this.canvasOverlay) {
      this.canvasOverlay.destroy();
    }
    if (this.editingOverlay) {
      this.editingOverlay.hide();
    }
    if (this.contextMenu) {
      this.contextMenu.destroy();
    }
    
    // Clear DOM
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Clear references
    this.activeRows.clear();
    this.viewport = null;
    this.headerContainer = null;
    this.headerViewport = null;
    this.bodyContainer = null;
    this.selectionManager = null;
    this.canvasOverlay = null;
    this.editingOverlay = null;
    this.contextMenu = null;
    
    log.info('✅ SimplePassiveRenderer destroyed with all 5 overlays cleaned up');
  }
  
  /**
   * Select all visible cells
   */
  private selectAllCells(): void {
    const processedRows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    const allCells = new Set<string>();
    
    for (const row of processedRows) {
      for (const column of visibleColumns) {
        allCells.add(`${row.id}:${column.id}`);
      }
    }
    
    this.tableInteraction$.selectedCells.set(allCells);
    this.tableInteraction$.selectionMode.set('multi');
    
    log.info('🎯 Selected all cells', { 
      rowCount: processedRows.length,
      columnCount: visibleColumns.length,
      totalSelected: allCells.size
    });
  }
  
  /**
   * Select entire column
   */
  private selectColumn(columnId: string): void {
    const processedRows = this.tableCore$.processedRows.get();
    const columnCells = new Set<string>();
    
    for (const row of processedRows) {
      columnCells.add(`${row.id}:${columnId}`);
    }
    
    this.tableInteraction$.selectedCells.set(columnCells);
    this.tableInteraction$.selectionMode.set('column');
    
    log.info('🎯 Selected column', { 
      columnId,
      rowCount: processedRows.length,
      selectedCells: columnCells.size
    });
  }
  
  /**
   * Select entire row (replaces current selection)
   */
  private selectRow(rowId: string): void {
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    const rowCells = new Set<string>();
    
    for (const column of visibleColumns) {
      rowCells.add(`${rowId}:${column.id}`);
    }
    
    this.tableInteraction$.selectedCells.set(rowCells);
    this.tableInteraction$.selectionMode.set('row');
    
    log.info('🎯 Selected row', { 
      rowId,
      columnCount: visibleColumns.length,
      selectedCells: rowCells.size
    });
  }

  /**
   * Toggle entire row selection (adds to or removes from current selection)
   */
  private toggleRowSelection(rowId: string): void {
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    const currentSelection = new Set(this.tableInteraction$.selectedCells.get());
    const rowCells = new Set<string>();
    
    for (const column of visibleColumns) {
      rowCells.add(`${rowId}:${column.id}`);
    }
    
    // Check if row is already selected (all row cells are in selection)
    const isRowSelected = Array.from(rowCells).every(cellId => currentSelection.has(cellId));
    
    if (isRowSelected) {
      // Remove row cells from selection
      for (const cellId of rowCells) {
        currentSelection.delete(cellId);
      }
      log.info('🎯 Deselected row', { 
        rowId,
        columnCount: visibleColumns.length,
        remainingCells: currentSelection.size
      });
    } else {
      // Add row cells to selection
      for (const cellId of rowCells) {
        currentSelection.add(cellId);
      }
      log.info('🎯 Selected row', { 
        rowId,
        columnCount: visibleColumns.length,
        totalCells: currentSelection.size
      });
    }
    
    this.tableInteraction$.selectedCells.set(currentSelection);
    this.tableInteraction$.selectionMode.set('row');
  }

  /**
   * Select range of rows (for Shift+Click on row checkboxes)
   */
  private selectRowRange(startRowId: string, endRowId: string): void {
    log.debug('🎯 selectRowRange called', { startRowId, endRowId });
    
    const processedRows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    log.debug('🎯 selectRowRange - data retrieved', {
      processedRowsCount: processedRows.length,
      visibleColumnsCount: visibleColumns.length
    });

    // Find row indices
    const startRowIndex = processedRows.findIndex((row: any) => row.id === startRowId);
    const endRowIndex = processedRows.findIndex((row: any) => row.id === endRowId);

    if (startRowIndex === -1 || endRowIndex === -1) {
      log.warn('🔴 Row range selection failed - invalid row IDs', { startRowId, endRowId });
      return;
    }

    // Calculate range bounds
    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);

    // Clear existing selection and select only the range
    const rangeSelection = new Set<string>();

    // Select all cells in the row range
    for (let r = minRowIndex; r <= maxRowIndex; r++) {
      const rowId = processedRows[r].id;
      for (const column of visibleColumns) {
        rangeSelection.add(`${rowId}:${column.id}`);
      }
    }

    this.tableInteraction$.selectedCells.set(rangeSelection);
    this.tableInteraction$.selectionMode.set('row');

    const selectedRowCount = maxRowIndex - minRowIndex + 1;
    const selectedCellCount = selectedRowCount * visibleColumns.length;

    log.info('🎯 Selected row range', {
      startRowId,
      endRowId,
      rowCount: selectedRowCount,
      cellCount: selectedCellCount,
      totalSelected: rangeSelection.size
    });
  }

  /**
   * Handle arrow key navigation and range selection
   */
  private handleArrowKey(direction: 'up' | 'down' | 'left' | 'right', isShiftKey: boolean): void {
    log.debug('⌨️ Arrow key pressed', { direction, isShiftKey, focusedCell: this.focusedCell });

    const processedRows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);

    if (processedRows.length === 0 || visibleColumns.length === 0) {
      log.debug('⌨️ No data to navigate');
      return;
    }

    // If no focused cell, start with first visible cell
    if (!this.focusedCell) {
      this.focusedCell = `${processedRows[0].id}:${visibleColumns[0].id}`;
      this.selectionAnchor = this.focusedCell;
      log.debug('⌨️ Starting focus at first cell', { focusedCell: this.focusedCell });
    }

    // Parse current focused cell
    const [currentRowId, currentColumnId] = this.focusedCell.split(':');
    const currentRowIndex = processedRows.findIndex((row: any) => row.id === currentRowId);
    const currentColIndex = visibleColumns.findIndex(col => col.id === currentColumnId);

    if (currentRowIndex === -1 || currentColIndex === -1) {
      log.debug('⌨️ Current focused cell not found in data');
      return;
    }

    // Calculate new position
    let newRowIndex = currentRowIndex;
    let newColIndex = currentColIndex;

    switch (direction) {
      case 'up':
        newRowIndex = Math.max(0, currentRowIndex - 1);
        break;
      case 'down':
        newRowIndex = Math.min(processedRows.length - 1, currentRowIndex + 1);
        break;
      case 'left':
        newColIndex = Math.max(0, currentColIndex - 1);
        break;
      case 'right':
        newColIndex = Math.min(visibleColumns.length - 1, currentColIndex + 1);
        break;
    }

    // Update focused cell
    const newRowId = processedRows[newRowIndex].id;
    const newColumnId = visibleColumns[newColIndex].id;
    const newFocusedCell = `${newRowId}:${newColumnId}`;

    this.focusedCell = newFocusedCell;

    log.debug('⌨️ New focused cell', {
      from: `${currentRowId}:${currentColumnId}`,
      to: newFocusedCell,
      isShiftKey
    });

    if (isShiftKey) {
      // Range selection mode - extend from anchor to new focused cell
      if (!this.selectionAnchor) {
        this.selectionAnchor = `${currentRowId}:${currentColumnId}`;
      }
      
      log.debug('⌨️ Extending range selection', {
        anchor: this.selectionAnchor,
        focus: newFocusedCell
      });
      
      this.selectKeyboardRange(this.selectionAnchor, newFocusedCell);
    } else {
      // Single cell selection - clear previous and select new
      this.selectionAnchor = newFocusedCell;
      this.tableInteraction$.selectCell(newFocusedCell, false); // false = replace selection
      log.debug('⌨️ Single cell selected', { cell: newFocusedCell });
    }
  }

  /**
   * Select rectangular range between two cells (for keyboard range selection)
   */
  private selectKeyboardRange(startCell: string, endCell: string): void {
    log.debug('⌨️ Keyboard range selection', { startCell, endCell });
    
    const processedRows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);

    // Parse cell coordinates
    const [startRowId, startColId] = startCell.split(':');
    const [endRowId, endColId] = endCell.split(':');

    // Find indices
    const startRowIndex = processedRows.findIndex((row: any) => row.id === startRowId);
    const endRowIndex = processedRows.findIndex((row: any) => row.id === endRowId);
    const startColIndex = visibleColumns.findIndex(col => col.id === startColId);
    const endColIndex = visibleColumns.findIndex(col => col.id === endColId);

    if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
      log.debug('⌨️ Invalid cell coordinates for range selection');
      return;
    }

    // Calculate rectangle bounds
    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    // Create range selection
    const rangeSelection = new Set<string>();
    for (let r = minRowIndex; r <= maxRowIndex; r++) {
      const rowId = processedRows[r].id;
      for (let c = minColIndex; c <= maxColIndex; c++) {
        const columnId = visibleColumns[c].id;
        rangeSelection.add(`${rowId}:${columnId}`);
      }
    }

    this.tableInteraction$.selectedCells.set(rangeSelection);
    this.tableInteraction$.selectionMode.set('cell');

    const rowCount = maxRowIndex - minRowIndex + 1;
    const colCount = maxColIndex - minColIndex + 1;

    log.info('⌨️ Keyboard range selected', {
      anchor: startCell,
      focus: endCell,
      rowCount,
      colCount,
      cellCount: rangeSelection.size
    });
  }

  /**
   * Update the select all checkbox visual state based on computed observable state
   */
  private updateSelectAllCheckboxVisual(state: { checked: boolean; indeterminate: boolean }): void {
    if (!this.selectAllCheckbox) return;

    log.debug('📋 Updating select all checkbox visual state', {
      newState: state,
      previousChecked: this.selectAllCheckbox.checked,
      previousIndeterminate: this.selectAllCheckbox.indeterminate
    });

    const checkbox = this.selectAllCheckbox;
    
    // Direct DOM property updates - Legend State computed observable ensures these are correct
    checkbox.checked = state.checked;
    checkbox.indeterminate = state.indeterminate;
  }
  
  /**
   * Setup scroll event handling and header synchronization
   * Implements the planned scroll coordination from PURE_OBSERVABLE_PROGRESS.md
   */
  private setupScrollHandling(): void {
    if (!this.viewport) return;
    
    log.info('📜 Setting up scroll coordination');
    
    // Direct DOM event binding → Observable updates (as planned in docs)
    this.viewport.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      const scrollTop = target.scrollTop;
      const scrollLeft = target.scrollLeft;
      
      // Update viewport observable (triggers all reactive updates)
      this.tableViewport$.updateScroll(scrollTop, scrollLeft);
      
      // Sync header scroll with requestAnimationFrame optimization
      this.syncHeaderScroll(scrollLeft);
      
      log.debug('📜 Scroll event processed', { scrollTop, scrollLeft });
    });
    
    // Add click-outside handler to clear selection
    this.container.addEventListener('click', (e) => {
      const cellElement = (e.target as HTMLElement).closest('[data-row-id][data-column-id]');
      const headerElement = (e.target as HTMLElement).closest('.vibegridx-header-cell');
      const viewportElement = (e.target as HTMLElement).closest('.vibegridx-viewport');
      
      // Only clear selection if click is in the viewport area but not on a cell or header
      // This prevents clearing when clicking on cells (event bubbling) or outside the table entirely
      if (viewportElement && !cellElement && !headerElement) {
        log.info('🖱️ Click outside cells - clearing selection');
        this.tableInteraction$.clearSelection();
      }
    });
    
    // Add keyboard event handling for advanced selection and navigation
    this.container.addEventListener('keydown', (e) => {
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      
      log.debug('⌨️ Keyboard event', { key: e.key, shiftKey: isShiftKey, ctrlKey: isCtrlKey, focusedCell: this.focusedCell });
      
      switch (e.key) {
        case 'a':
        case 'A':
          if (isCtrlKey) {
            e.preventDefault();
            this.selectAllCells();
            log.info('⌨️ Ctrl+A - Select all cells');
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.tableInteraction$.clearSelection();
          this.focusedCell = null;
          this.selectionAnchor = null;
          log.info('⌨️ Escape - Clear selection and focus');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.handleArrowKey('up', isShiftKey);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.handleArrowKey('down', isShiftKey);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.handleArrowKey('left', isShiftKey);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.handleArrowKey('right', isShiftKey);
          break;
        default:
          // Let other keys pass through
          break;
      }
    });
    
    // Make container focusable to receive keyboard events
    this.container.tabIndex = 0; // Changed from -1 to 0 to make it focusable
    this.container.style.outline = 'none';
    
    log.info('✅ Scroll coordination setup complete');
  }
  
  /**
   * Synchronize header horizontal scroll with viewport
   * Now properly syncs header scroll position instead of using transforms
   */
  private syncHeaderScroll(scrollLeft: number): void {
    if (!this._scrollRAF && this.headerViewport) {
      this._scrollRAF = requestAnimationFrame(() => {
        if (this.headerViewport) {
          this.headerViewport.scrollLeft = scrollLeft;
          log.debug('📜 Header scroll synced', { scrollLeft });
        }
        this._scrollRAF = null;
      });
    }
  }

  /**
   * Update sort indicators in header cells based on current sort state
   * Similar to HeaderEngine.updateSortIndicators()
   */
  private updateSortIndicators(): void {
    if (!this.headerContainer) return;
    
    const sortBy = this.tableCore$.sortBy.get();
    const sortLookup = new Map<string, { direction: 'asc' | 'desc'; index: number }>();
    
    // Build lookup map from current sort state
    sortBy.forEach((sort, index) => {
      sortLookup.set(sort.field, { direction: sort.direction, index });
    });
    
    // Update all header cells
    this.headerContainer.querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const field = (cell as HTMLElement).dataset.field;
      if (!field) return;
      
      const sortInfo = sortLookup.get(field);
      
      // Update classes for CSS styling
      cell.classList.remove('sort-asc', 'sort-desc');
      if (sortInfo) {
        cell.classList.add(sortInfo.direction === 'asc' ? 'sort-asc' : 'sort-desc');
      }
      
      // Update sort icon SVG
      const sortIcon = cell.querySelector('.vibegridx-sort-icon');
      if (sortIcon) {
        sortIcon.innerHTML = this.createSortIconSVG(sortInfo);
      }
    });
    
    log.debug('🔄 Sort indicators updated', { 
      sortBy: sortBy.map(s => `${s.field}:${s.direction}`)
    });
  }

  /**
   * Create SVG sort icon with proper opacity for current sort state
   * Copied from HeaderEngine.createSortIconSVG() for consistency
   */
  private createSortIconSVG(sortInfo?: { direction: 'asc' | 'desc'; index: number } | null): string {
    const ascOpacity = sortInfo?.direction === 'asc' ? '1' : '0.3';
    const descOpacity = sortInfo?.direction === 'desc' ? '1' : '0.3';
    
    return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${ascOpacity}"/>
      <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${descOpacity}"/>
    </svg>`;
  }

  /**
   * Update header cell width to keep in sync with column resize
   */
  private updateHeaderCellWidth(columnId: string, newWidth: number): void {
    const headerCell = this.headerContainer.querySelector(`[data-field="${columnId}"]`) as HTMLElement;
    if (headerCell) {
      // Update the flex-basis style to match new width
      const currentStyle = headerCell.style.cssText;
      const updatedStyle = currentStyle.replace(
        /flex:\s*0\s+0\s+\d+px/,
        `flex: 0 0 ${newWidth}px`
      );
      headerCell.style.cssText = updatedStyle;
      
      log.debug('📏 Updated header cell width', {
        columnId,
        newWidth,
        previousStyle: currentStyle.match(/flex:\s*0\s+0\s+\d+px/)?.[0],
        updatedStyle: `flex: 0 0 ${newWidth}px`
      });
    } else {
      log.warn('⚠️ Header cell not found for width update', { columnId });
    }
  }

  /**
   * Determine if a field should be treated as a tags field
   */
  private isTagsField(columnId: string, value: any): boolean {
    if (!value || typeof value !== 'string') return false;
    
    // Check if column name suggests it's a tags field
    const tagsFieldPatterns = ['tags', 'tag', 'labels', 'categories', 'keywords'];
    const lowerColumnId = columnId.toLowerCase();
    const isTagsColumn = tagsFieldPatterns.some(pattern => lowerColumnId.includes(pattern));
    
    // Check if value contains commas (suggesting multiple tags)
    const hasMultipleValues = value.includes(',');
    
    return isTagsColumn && hasMultipleValues;
  }

  /**
   * Create a container element with multiple tag badges
   */
  private createTagsElement(value: string, row: any, column: any): HTMLElement {
    const container = this.createElement('div', 'vibegridx-tags-container');
    container.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    `;
    
    // Split comma-separated values and create individual badges
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    
    tags.forEach((tag, index) => {
      const tagBadge = this.createElement('span', 'vibegridx-tag-badge');
      tagBadge.textContent = tag;
      tagBadge.style.cssText = `
        background: oklch(0.95 0.02 220);
        color: oklch(0.45 0.06 220);
        border: 1px solid oklch(0.88 0.04 220);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
      `;
      
      // Add hover effect
      tagBadge.addEventListener('mouseenter', () => {
        tagBadge.style.background = 'oklch(0.92 0.04 220)';
      });
      tagBadge.addEventListener('mouseleave', () => {
        tagBadge.style.background = 'oklch(0.95 0.02 220)';
      });
      
      // Add click handler for individual tag editing
      tagBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        log.info('🏷️ Tag badge clicked - editing entire tags field', { tag, index, allTags: tags });
        // Edit the entire tags field, not individual tags
        this.editTagsField(value, row, column);
      });
      
      container.appendChild(tagBadge);
    });
    
    // Add click handler for the container (for editing tags)
    container.addEventListener('click', (e) => {
      if (e.target === container) {
        log.info('🏷️ Tags container clicked - editing tags field', { currentTags: tags });
        this.editTagsField(value, row, column);
      }
    });
    
    return container;
  }

  /**
   * Trigger editing mode for tags fields
   */
  private editTagsField(currentValue: string, row: any, column: any): void {
    const cellId = `${row.id}:${column.id}`;
    log.info('🏷️ Starting tags field edit mode', {
      cellId,
      currentValue,
      rowId: row.id,
      columnId: column.id,
      currentTags: currentValue.split(',').map(t => t.trim()).filter(t => t.length > 0)
    });
    
    // Trigger the standard VibeGrid edit mode - the editor selection system
    // will automatically choose MultiSelectEditor for tags fields
    this.tableInteraction$.startEdit(cellId, currentValue);
  }
}