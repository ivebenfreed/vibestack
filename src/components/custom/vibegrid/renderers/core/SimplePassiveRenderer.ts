/**
 * SimplePassiveRenderer - Basic working table without overlays
 * 
 * This is a simplified version to get the basic table working first,
 * then we can add overlays back once we have the foundation working.
 */

import { observe } from '@legendapp/state';
import { log } from '@/logger';
import type { 
  TableCore$, 
  TableInteraction$, 
  TableViewport$ 
} from '../../stores/pure-observables';
// New modular architecture imports
import { ObserverManager, type ObserverManagerOptions } from './ObserverManager';
import { DOMElementFactory, type DOMElementFactoryOptions } from '../factories/DOMElementFactory';
import { HeaderRenderer, type HeaderRendererOptions } from '../components/HeaderRenderer';

// Phase 2 manager imports
import { CellRenderer } from '../managers/CellRenderer';
import { RowRenderer } from '../managers/RowRenderer';
import { ViewportManager } from '../managers/ViewportManager';
import { EventManager } from '../managers/EventManager';

// Existing modular components
import { OverlayManager, type CoordinateMapping } from '../modules/OverlayManager';
import { BadgeRenderer } from '../modules/BadgeRenderer';
import { CellFormatter } from '../modules/CellFormatter';
import { SelectionController } from '../modules/SelectionController';
import { KeyboardNavigationController } from '../modules/KeyboardNavigationController';
import { ScrollController } from '../modules/ScrollController';

// Utility imports
import type { ViewportInfo, TableRow } from '../../types';
import type { VisualCellPosition } from '../../overlays/OverlayTypes';
import { formatFieldForDisplay } from '@/server/dataforge/fields/display-formatters';
import { createDataLoadingStage$, createStageCallbacks } from '../../stores/data-loading-stages';

const fileLog = log('components/custom/vibegrid/renderers/core/SimplePassiveRenderer.ts');

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
  private lastVisibleColumns: { start: number; end: number } | null = null;
  
  // Overlay management
  private overlayManager: OverlayManager | null = null;
  
  // Coordinate mapping (maintained locally but synced with overlay manager)
  private coordinateMapping: CoordinateMapping = {
    rows: [],
    columns: [],
    version: 0
  };
  
  // Scroll coordination
  private _scrollRAF: number | null = null;
  
  // Row range selection tracking - now handled by SelectionController
  // Keyboard navigation tracking - now handled by KeyboardNavigationController
  
  // UI element references
  private selectAllCheckbox: HTMLInputElement | null = null;
  
  // Smart cell system
  private dataLoadingStage$: any = null;
  private relationshipResolver$: Map<string, any> = new Map();
  private formattersReady: boolean = false;
  private universeSchema$: any = null;
  
  // Modular controllers
  private selectionController: SelectionController | null = null;
  private keyboardNavController: KeyboardNavigationController | null = null;
  private scrollController: ScrollController | null = null;
  
  // New modular components (Phase 1 additions)
  private observerManager: ObserverManager | null = null;
  private domFactory: DOMElementFactory | null = null;
  private headerRenderer: HeaderRenderer | null = null;
  
  // Phase 2 manager additions
  private cellRenderer: CellRenderer | null = null;
  private rowRenderer: RowRenderer | null = null;
  private viewportManager: ViewportManager | null = null;
  private eventManager: EventManager | null = null;
  
  constructor(private options: SimplePassiveRendererOptions) {
    fileLog.info('🎯 SimplePassiveRenderer: Initializing');
    
    this.container = options.container;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    
    this.initDOM();
    this.initDOMFactory();
    this.initControllers();
    this.initPhase2Managers();
    this.initOverlayManager();
    this.initHeaderRenderer();
    this.initObserverManager();
    this.postInitialization();
  }
  
  /**
   * Initialize DOM Element Factory
   */
  private initDOMFactory(): void {
    fileLog.info('🏭 Initializing DOM Element Factory');
    
    this.domFactory = new DOMElementFactory({
      tableInteraction$: this.tableInteraction$,
      enableSelectionColumn: this.options.enableSelectionColumn,
      onEntityUpdate: this.options.onEntityUpdate
    });
    
    fileLog.info('✅ DOM Element Factory initialized');
  }

  /**
   * Initialize modular controllers
   */
  private initControllers(): void {
    fileLog.info('🎮 Initializing modular controllers');
    
    // Initialize selection controller
    this.selectionController = new SelectionController({
      tableInteraction$: this.tableInteraction$,
      getProcessedRows: () => this.tableCore$.processedRows.get(),
      getVisibleColumns: () => this.tableCore$.visibleColumns.get()
    });
    
    // Initialize keyboard navigation controller
    this.keyboardNavController = new KeyboardNavigationController({
      tableInteraction$: this.tableInteraction$,
      selectionController: this.selectionController,
      getProcessedRows: () => this.tableCore$.processedRows.get(),
      getVisibleColumns: () => this.tableCore$.visibleColumns.get(),
      container: this.container
    });
    
    // Scroll controller will be initialized after DOM is ready
  }
  
  /**
   * Initialize Phase 2 managers
   */
  private initPhase2Managers(): void {
    fileLog.info('🚀 Initializing Phase 2 managers');
    
    // Initialize CellRenderer first (dependency for RowRenderer)
    this.cellRenderer = new CellRenderer({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      domFactory: this.domFactory!,
      keyboardNavController: this.keyboardNavController,
      container: this.container,
      onEntityUpdate: this.options.onEntityUpdate
    });
    
    // Initialize RowRenderer (depends on CellRenderer)
    this.rowRenderer = new RowRenderer({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      domFactory: this.domFactory!,
      cellRenderer: this.cellRenderer,
      selectionController: this.selectionController,
      enableSelectionColumn: this.options.enableSelectionColumn,
      createElement: this.createElement.bind(this)
    });
    
    // Initialize ViewportManager with the actual viewport element
    this.viewportManager = new ViewportManager({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      scrollController: this.scrollController,
      keyboardNavController: this.keyboardNavController,
      selectionController: this.selectionController,
      container: this.container,
      viewport: this.viewport!, // Pass the actual viewport element
      headerViewport: this.headerViewport!,
      bodyContainer: this.bodyContainer!,
      onViewportChange: () => this.renderBody(),
      createElement: this.createElement.bind(this)
    });
    
    // Initialize EventManager
    this.eventManager = new EventManager({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      container: this.container,
      onEntityUpdate: this.options.onEntityUpdate
    });
    
    fileLog.info('✅ Phase 2 managers initialized');
  }
  
  /**
   * Initialize overlay manager
   */
  private initOverlayManager(): void {
    fileLog.info('🎨 Initializing overlay manager');
    
    this.overlayManager = new OverlayManager({
      container: this.container,
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      enableSelectionColumn: this.options.enableSelectionColumn,
      headerContainer: this.headerContainer,
      bodyContainer: this.bodyContainer,
      getProcessedRows: () => this.tableCore$.processedRows.get()
    });
    
    fileLog.info('✅ Overlay manager initialized');
  }

  /**
   * Initialize Observer Manager (replaces setupObservers)
   */
  private initObserverManager(): void {
    fileLog.info('🔍 Initializing Observer Manager');
    
    this.observerManager = new ObserverManager({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      overlayManager: this.overlayManager,
      
      // Callback functions for renderer actions
      onColumnsChanged: () => {
        this.renderHeader();
        this.renderBody();
      },
      onColumnVisibilityChanged: () => {
        this.renderHeader();
        this.renderBody();
      },
      onRowsChanged: () => {
        this.renderBody();
      },
      onViewportChanged: () => {
        this.handleViewportChange();
      },
      onSelectionChanged: (selectedCells: Set<string>) => {
        this.updateDOMSelectionClasses(selectedCells);
      },
      onEditingChanged: (editingCell: string | null, editValue?: string) => {
        // Editing is handled by overlay manager
      },
      onSelectAllCheckboxChanged: (state: { checked: boolean; indeterminate: boolean }) => {
        this.updateSelectAllCheckboxVisual(state);
      },
      onSortChanged: () => {
        this.updateSortIndicators();
      },
      onDragChanged: () => {
        // Drag changes are handled by overlay manager
      },
      
      // Column resize handlers
      updateHeaderCellWidth: (columnId: string, newWidth: number) => {
        this.updateHeaderCellWidth(columnId, newWidth);
      },
      updateBodyCellWidths: (columnId: string, newWidth: number) => {
        this.updateBodyCellWidths(columnId, newWidth);
      }
    });
    
    fileLog.info('✅ Observer Manager initialized');
  }

  /**
   * Initialize Header Renderer
   */
  private initHeaderRenderer(): void {
    if (!this.headerContainer || !this.domFactory) {
      fileLog.warn('🎨 Cannot initialize HeaderRenderer - missing dependencies');
      return;
    }
    
    fileLog.info('🎨 Initializing Header Renderer');
    
    this.headerRenderer = new HeaderRenderer({
      headerContainer: this.headerContainer,
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      domFactory: this.domFactory,
      selectionController: this.selectionController,
      coordinateMapping: this.coordinateMapping,
      enableSelectionColumn: this.options.enableSelectionColumn,
      updateCoordinateMapping: (mapping: CoordinateMapping) => {
        this.coordinateMapping = mapping;
        this.overlayManager?.updateCoordinateMapping(mapping);
      }
    });
    
    fileLog.info('✅ Header Renderer initialized');
  }
  
  /**
   * Post-initialization setup after all managers are created
   */
  private postInitialization(): void {
    fileLog.info('🚀 Starting post-initialization');
    
    // Initialize viewport dimensions and setup scroll handling
    if (this.viewportManager) {
      this.viewportManager.initializeViewportDimensions();
      this.viewportManager.setupScrollHandling();
    }
    
    // Initialize overlay now that DOM is ready
    if (this.overlayManager) {
      this.overlayManager.initializeOverlay();
    }
    
    // Setup event handling via EventManager
    if (this.eventManager) {
      this.eventManager.setOverlayManager(this.overlayManager!);
      this.eventManager.setupEventHandling();
    }
    
    // Initial render
    this.renderHeader();
    this.renderBody();
    
    fileLog.info('✅ Post-initialization complete');
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
    
    // Create header container first (will be populated by HeaderRenderer)
    this.headerContainer = this.createElement('div', 'vibegridx-header');
    this.headerContainer.style.cssText = `
      position: relative;
      white-space: nowrap;
      height: 100%;
      display: flex;
      min-width: min-content;
      width: max-content;
    `;
    
    // Create header viewport wrapper for the header container
    this.headerViewport = this.createElement('div', 'vibegridx-header-viewport');
    this.headerViewport.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${HEADER_HEIGHT}px;
      background: hsl(var(--muted));
      border-bottom: 1px solid hsl(var(--border));
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      z-index: 10;
      contain: layout style;
    `;
    this.headerViewport.style.setProperty('-webkit-overflow-scrolling', 'touch');
    this.headerViewport.appendChild(this.headerContainer);
    
    // Basic viewport structure (will be enhanced by ViewportManager)
    this.viewport = this.createElement('div', 'vibegridx-viewport');
    this.viewport.style.cssText = `
      position: absolute;
      top: ${HEADER_HEIGHT}px;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: auto;
    `;
    
    this.bodyContainer = this.createElement('div', 'vibegridx-body');
    this.bodyContainer.style.cssText = `
      position: relative;
      width: 100%;
    `;
    
    this.viewport.appendChild(this.bodyContainer);
    
    // Assemble the complete structure
    table.appendChild(this.headerViewport);
    table.appendChild(this.viewport);
    this.container.appendChild(table);
    
    fileLog.info('✅ Basic DOM structure created');
  }
  
  /**
   * Legacy observers setup - removed, now using ObserverManager
   */
  private setupObservers(): void {
    // This method is kept for compatibility but now delegates to ObserverManager
    // All observer logic has been moved to ObserverManager.ts
    
    // Setup context menu event handler
    this.setupContextMenu();
    
    fileLog.info('✅ Legacy setupObservers() called - using ObserverManager instead');
  }

  /**
   * Create DOM element with class - matches UnifiedTableRenderer pattern
   */
  private createElement(tag: string, className: string): HTMLElement {
    // Delegate to DOM Factory for consistent element creation
    if (this.domFactory) {
      return this.domFactory.createElement(tag, className);
    }
    
    // Fallback for early initialization
    const el = document.createElement(tag);
    el.className = className;
    return el;
  }
  
  /**
   * Create group header element with expand/collapse functionality
   */
  private createGroupHeaderElement(groupRow: any, rowIndex: number): HTMLElement {
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
      
      fileLog.info('🎯 Group header clicked', { 
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
   * LEGACY: Now handled by EventManager in Phase 2
   */
  private setupContextMenu(): void {
    // Add right-click handler for context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const cellElement = (e.target as HTMLElement).closest('[data-row-id][data-column-id]') as HTMLElement;
      if (cellElement && this.overlayManager) {
        const rowId = cellElement.dataset.rowId;
        const columnId = cellElement.dataset.columnId;
        
        fileLog.info('🖱️ Context menu triggered', { rowId, columnId });
        
        // Show context menu
        this.overlayManager.showContextMenu({
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
            this.overlayManager?.hideContextMenu();
          },
          onCopy: () => {
            fileLog.info('📋 Copy action');
            // Implement copy logic via tableInteraction$
            this.overlayManager?.hideContextMenu();
          },
          onPaste: () => {
            fileLog.info('📋 Paste action');
            // Implement paste logic via tableInteraction$
            this.overlayManager?.hideContextMenu();
          },
          onCut: () => {
            fileLog.info('✂️ Cut action');
            // Implement cut logic via tableInteraction$
            this.overlayManager?.hideContextMenu();
          },
          onInsertRow: () => {
            fileLog.info('➕ Insert row action');
            // Implement insert row logic via tableCore$
            this.overlayManager?.hideContextMenu();
          },
          onDeleteRow: () => {
            fileLog.info('➖ Delete row action');
            // Implement delete row logic via tableCore$
            this.overlayManager?.hideContextMenu();
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
    
    // Delegate to HeaderRenderer if available
    if (this.headerRenderer) {
      this.headerRenderer.render();
      
      // Update select all checkbox reference
      this.selectAllCheckbox = this.headerRenderer.getSelectAllCheckbox();
      return;
    }
    
    // Fallback to original header rendering
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get(); // Cache once
    fileLog.info('🎨 Rendering header (fallback)', { columnCount: columns.length });
    
    this.headerContainer.innerHTML = '';
    
    const headerRow = this.createElement('div', 'vibegridx-header-row');
    headerRow.style.cssText = `
      position: relative;
      height: ${HEADER_HEIGHT}px;
    `;
    
    // Add corner header cell (aligns with row headers) with absolute positioning
    const cornerCell = this.createElement('div', 'vibegridx-corner-header');
    cornerCell.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 40px;
      height: ${HEADER_HEIGHT}px;
      background: #f8f9fa;
      border-right: 1px solid #e9ecef;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1;
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
        
        fileLog.info('🎯 Select all checkbox clicked', {
          currentSelection: selectedCells.size,
          totalCells,
          checkboxChecked: this.selectAllCheckbox!.checked
        });
        
        // If we have any selection (full or partial), clear it
        // If we have no selection, select all
        if (selectedCells.size > 0) {
          this.tableInteraction$.clearSelection();
          fileLog.info('🎯 Select all checkbox - clearing selection');
        } else {
          this.selectionController?.selectAllCells();
          fileLog.info('🎯 Select all checkbox - selecting all');
        }
      });
      
      cornerCell.appendChild(this.selectAllCheckbox);
    }
    
    headerRow.appendChild(cornerCell);
    
    // Get virtual column range from the observable (single source of truth)
    const visibleColumnRange = this.tableViewport$.visibleColumns.get();
    const allVisibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    // Use the range directly from the observable (it already includes buffer)
    const startColIndex = visibleColumnRange.start;
    const endColIndex = visibleColumnRange.end;
    const virtualColumns = allVisibleColumns.slice(startColIndex, endColIndex);
    
    fileLog.info('🎨 Rendering header with virtual columns', { 
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
    
    // Calculate starting x position for virtual columns
    xOffset = 40;
    for (let i = 0; i < startColIndex; i++) {
      xOffset += allVisibleColumns[i].width;
    }
    
    virtualColumns.forEach((column, virtualIndex) => {
      const actualIndex = startColIndex + virtualIndex;
      const headerCell = this.createElement('div', 'vibegridx-header-cell');
      headerCell.dataset.field = column.id; // Add field ID for sort updates
      headerCell.style.cssText = `
        position: absolute;
        left: ${xOffset}px;
        top: 0;
        width: ${column.width}px;
        height: 100%;
        padding: 0 12px;
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        border-right: 1px solid #e9ecef;
        background: #f8f9fa;
      `;
      
      // Create header content with text and sort icon (like HeaderEngine)
      const textGroup = this.createElement('div', 'vibegridx-header-text-group');
      textGroup.style.cssText = 'display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;';
      
      // Header text
      const headerText = this.createElement('span', 'vibegridx-header-text');
      headerText.style.cssText = 'flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      headerText.textContent = column.label;
      
      // Sort icon (if column is sortable)
      if (column.sortable !== false) {
        const sortIcon = this.createElement('span', 'vibegridx-sort-icon');
        sortIcon.style.cssText = 'flex-shrink: 0; min-width: 16px; margin-left: 4px;';
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
          this.selectionController?.selectColumn(column.id);
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
      
      headerRow.appendChild(headerCell);
    });
    
    // Calculate total width and set header container width for proper overflow handling
    const totalHeaderWidth = 40 + allVisibleColumns.reduce((sum, col) => sum + col.width, 0);
    headerRow.style.width = `${totalHeaderWidth}px`;
    headerRow.style.minWidth = `${totalHeaderWidth}px`;
    
    this.headerContainer.appendChild(headerRow);
    
    // Update header container width to ensure proper scrolling
    this.headerContainer.style.width = `${totalHeaderWidth}px`;
    this.headerContainer.style.minWidth = `${totalHeaderWidth}px`;
    
    this.coordinateMapping.version++;
    // Sync coordinate mapping with overlay manager
    this.overlayManager?.updateCoordinateMapping(this.coordinateMapping);
    fileLog.info('✅ Header rendered with total width', { totalHeaderWidth });
  }
  
  /**
   * Render table body
   */
  private renderBody(): void {
    if (!this.bodyContainer || !this.rowRenderer || !this.viewportManager) return;
    
    const rows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();
    
    // Debug: Check if we have group rows
    const groupRows = rows.filter((row: any) => row.type === 'group');
    const dataRows = rows.filter((row: any) => row.type === 'data');
    
    fileLog.info('🎨 Rendering body with Phase 2 managers', { 
      rowCount: rows.length, 
      columnCount: columns.length,
      groupRows: groupRows.length,
      dataRows: dataRows.length,
      firstRowType: rows[0]?.type,
      firstRowData: rows[0]
    });
    
    this.bodyContainer.innerHTML = '';
    
    // Clear active rows in RowRenderer
    this.rowRenderer.clearActiveRows();
    
    // Update content dimensions via ViewportManager
    this.viewportManager.updateContentDimensions();
    
    // Update row coordinate mapping
    this.coordinateMapping.rows = [];
    
    // Virtual scrolling: Only render visible rows
    const visibleRange = this.tableViewport$.visibleRange.get();
    const startIndex = Math.max(0, visibleRange.start);
    const endIndex = Math.min(rows.length, visibleRange.end);
    const visibleRows = rows.slice(startIndex, endIndex);
    
    fileLog.debug('🎨 Virtual scrolling with Phase 2', { 
      totalRows: rows.length, 
      visibleRange: `${startIndex}-${endIndex}`,
      rendering: visibleRows.length
    });
    
    // Get virtual column range from the observable (single source of truth) - MUST match header
    const visibleColumnRange = this.tableViewport$.visibleColumns.get();
    const allVisibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
    
    // Use the EXACT same range as header (from observable with buffer already included)
    const startColIndex = visibleColumnRange.start;
    const endColIndex = visibleColumnRange.end;
    const virtualColumns = allVisibleColumns.slice(startColIndex, endColIndex);
    
    // Calculate starting x position for virtual columns - MUST match header
    let startX = 40; // Account for row header
    for (let i = 0; i < startColIndex; i++) {
      startX += allVisibleColumns[i].width;
    }
    
    // Render only visible rows using RowRenderer
    visibleRows.forEach((row, visibleIndex) => {
      const actualRowIndex = startIndex + visibleIndex;
      
      let rowElement: HTMLElement;
      
      // Check if this is a group header or data row
      if (row.type === 'group') {
        fileLog.info('🎯 Rendering group row', { 
          rowId: row.id, 
          level: row.level,
          isExpanded: row.isExpanded,
          data: row.data
        });
        rowElement = this.rowRenderer.createGroupHeaderElement(row, actualRowIndex);
      } else {
        rowElement = this.rowRenderer.createRowElement(row.data || row, actualRowIndex, virtualColumns, columnVisibility, startX);
      }
      
      this.bodyContainer.appendChild(rowElement);
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
    // Sync coordinate mapping with overlay manager
    this.overlayManager?.updateCoordinateMapping(this.coordinateMapping);
    
    fileLog.info('✅ Body rendered with Phase 2 managers');
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
    
    fileLog.info('✅ DOM selection classes updated', { selectedCount: selectedCells.size });
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
    
    fileLog.info('✅ Visual cell positions calculated', { 
      selectedCount: selectedCells.size,
      visualCount: visualCells.length 
    });
    
    return visualCells;
  }
  
  /**
   * Create a row element
   * LEGACY: Now handled by RowRenderer in Phase 2
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
        
        fileLog.debug('🔘 Checkbox click detected', {
          rowId: row.id,
          isShiftKey,
          lastSelectedRowId: this.lastSelectedRowId,
          checkboxChecked: checkbox.checked
        });
        
        if (isShiftKey && this.lastSelectedRowId) {
          // Shift+Click for row range selection
          fileLog.debug('🎯 Shift+Click detected - calling selectRowRange', {
            from: this.lastSelectedRowId,
            to: row.id
          });
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
        // TODO: Implement multi-row selection
        this.selectionController?.selectRow(row.id);
      } else {
        // Regular click - select entire row
        this.selectionController?.selectRow(row.id);
      }
      
      fileLog.info('🎯 Row header clicked', { rowId: row.id, isCtrlKey });
    });
    
    rowElement.appendChild(rowHeader);
    
    columns.forEach((column, colIndex) => {
      const cell = this.cellRenderer!.createCellElement(row, column, colIndex);
      rowElement.appendChild(cell);
    });
    
    // Calculate total width to ensure consistent scrolling with header
    const allVisibleColumns = this.tableCore$.columns.get().filter(col => 
      this.tableCore$.columnVisibility.get()[col.id] !== false
    );
    const totalRowWidth = 40 + allVisibleColumns.reduce((sum, col) => sum + col.width, 0);
    rowElement.style.width = `${totalRowWidth}px`;
    rowElement.style.minWidth = `${totalRowWidth}px`;
    
    return rowElement;
  }
  
  /**
   * Format cell value using centralized display formatters
   */
  private formatCellValue(value: any, type?: string, column?: any): string {
    // Delegate to the modular CellFormatter
    return CellFormatter.formatCellValue(value, type, column);
  }
  
  // Removed redundant formatting methods - now using centralized display formatters
  
  /**
   * Handle viewport changes (scroll and dimension updates)
   * Triggers virtual scrolling updates when visible range changes
   */
  private handleViewportChange(): void {
    // Check if horizontal columns have changed
    const visibleColumns = this.tableViewport$.visibleColumns.get();
    const previousColumns = this.lastVisibleColumns || { start: -1, end: -1 };
    
    const columnsChanged = visibleColumns.start !== previousColumns.start || 
                          visibleColumns.end !== previousColumns.end;
    
    // Update viewport manager
    if (this.viewportManager) {
      this.viewportManager.handleViewportChange();
    }
    
    // Update overlay selection with current viewport position
    if (this.overlayManager) {
      // Re-update selection overlay which will internally update viewport info
      const selectedCells = this.tableInteraction$.selectedCells.get();
      if (selectedCells.size > 0) {
        this.overlayManager.updateSelection(selectedCells);
      }
    }
    
    // Re-render if columns changed (for horizontal virtual scrolling)
    if (columnsChanged) {
      this.lastVisibleColumns = visibleColumns;
      this.renderHeader();
      this.renderBody();
    } else {
      // Only re-render body for vertical scrolling
      this.renderBody();
    }
  }
  
  /**
   * Destroy the renderer
   */
  destroy(): void {
    fileLog.info('🧹 Destroying SimplePassiveRenderer with Phase 2 managers');
    
    // Clean up observers (managed by ObserverManager)
    if (this.observerManager) {
      this.observerManager.destroy();
      this.observerManager = null;
    }
    
    // Clean up Phase 2 managers
    if (this.eventManager) {
      this.eventManager.destroy();
      this.eventManager = null;
    }
    
    if (this.viewportManager) {
      this.viewportManager.destroy();
      this.viewportManager = null;
    }
    
    // RowRenderer and CellRenderer don't need explicit cleanup
    this.rowRenderer = null;
    this.cellRenderer = null;
    
    // Clean up legacy disposers (if any remain)
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    
    // Clean up overlay manager
    if (this.overlayManager) {
      this.overlayManager.destroy();
      this.overlayManager = null;
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
    this.domFactory = null;
    this.headerRenderer = null;
    
    fileLog.info('✅ SimplePassiveRenderer destroyed with all Phase 2 managers cleaned up');
  }
  
  // selectAllCells method removed - now handled by SelectionController
  
  // selectColumn method removed - now handled by SelectionController
  
  // selectRow method removed - now handled by SelectionController

  // toggleRowSelection method removed - now handled by SelectionController

  // selectRowRange method removed - now handled by SelectionController

  // handleArrowKey method removed - now handled by KeyboardNavigationController

  // selectKeyboardRange method removed - now handled by SelectionController

  /**
   * Update the select all checkbox visual state based on computed observable state
   */
  private updateSelectAllCheckboxVisual(state: { checked: boolean; indeterminate: boolean }): void {
    // Delegate to HeaderRenderer if available
    if (this.headerRenderer) {
      this.headerRenderer.updateSelectAllCheckboxVisual(state);
      return;
    }
    
    // Fallback to original implementation
    if (!this.selectAllCheckbox) return;

    fileLog.debug('📋 Updating select all checkbox visual state', {
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
    
    fileLog.info('📜 Setting up scroll coordination');
    
    // Direct DOM event binding → Observable updates (as planned in docs)
    this.viewport.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      const scrollTop = target.scrollTop;
      const scrollLeft = target.scrollLeft;
      
      // Update viewport observable (triggers all reactive updates)
      this.tableViewport$.updateScroll(scrollTop, scrollLeft);
      
      // Sync header scroll with requestAnimationFrame optimization
      this.syncHeaderScroll(scrollLeft);
      
      fileLog.debug('📜 Scroll event processed', { scrollTop, scrollLeft });
    });
    
    // Add click-outside handler to clear selection
    this.container.addEventListener('click', (e) => {
      const cellElement = (e.target as HTMLElement).closest('[data-row-id][data-column-id]');
      const headerElement = (e.target as HTMLElement).closest('.vibegridx-header-cell');
      const viewportElement = (e.target as HTMLElement).closest('.vibegridx-viewport');
      
      // Only clear selection if click is in the viewport area but not on a cell or header
      // This prevents clearing when clicking on cells (event bubbling) or outside the table entirely
      if (viewportElement && !cellElement && !headerElement) {
        fileLog.info('🖱️ Click outside cells - clearing selection');
        this.tableInteraction$.clearSelection();
      }
    });
    
    // Add keyboard event handling for advanced selection and navigation
    this.container.addEventListener('keydown', (e) => {
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      
      const focusedCell = this.keyboardNavController?.getFocusedCell();
      fileLog.debug('⌨️ Keyboard event', { key: e.key, shiftKey: isShiftKey, ctrlKey: isCtrlKey, focusedCell });
      
      switch (e.key) {
        case 'a':
        case 'A':
          if (isCtrlKey) {
            e.preventDefault();
            this.selectionController?.selectAllCells();
            fileLog.info('⌨️ Ctrl+A - Select all cells');
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.tableInteraction$.clearSelection();
          this.keyboardNavController?.clear();
          fileLog.info('⌨️ Escape - Clear selection and focus');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.keyboardNavController?.handleArrowKey('up', isShiftKey);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.keyboardNavController?.handleArrowKey('down', isShiftKey);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.keyboardNavController?.handleArrowKey('left', isShiftKey);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.keyboardNavController?.handleArrowKey('right', isShiftKey);
          break;
        default:
          // Let other keys pass through
          break;
      }
    });
    
    // Make container focusable to receive keyboard events
    this.container.tabIndex = 0; // Changed from -1 to 0 to make it focusable
    this.container.style.outline = 'none';
    
    fileLog.info('✅ Scroll coordination setup complete');
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
          fileLog.debug('📜 Header scroll synced', { scrollLeft });
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
    
    // Delegate to HeaderRenderer if available
    if (this.headerRenderer) {
      this.headerRenderer.updateSortIndicators();
      return;
    }
    
    // Fallback to original implementation
    
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
    
    fileLog.debug('🔄 Sort indicators updated', { 
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
      
      fileLog.debug('📏 Updated header cell width', {
        columnId,
        newWidth,
        previousStyle: currentStyle.match(/flex:\s*0\s+0\s+\d+px/)?.[0],
        updatedStyle: `flex: 0 0 ${newWidth}px`
      });
    } else {
      fileLog.warn('⚠️ Header cell not found for width update', { columnId });
    }
  }

  /**
   * Update body cell widths to keep in sync with column resize
   */
  private updateBodyCellWidths(columnId: string, newWidth: number): void {
    const bodyCells = this.bodyContainer?.querySelectorAll(`[data-column-id="${columnId}"]`) as NodeListOf<HTMLElement>;
    if (bodyCells && bodyCells.length > 0) {
      bodyCells.forEach((cell) => {
        // Update the flex-basis style to match new width
        const currentStyle = cell.style.cssText;
        const updatedStyle = currentStyle.replace(
          /flex:\s*0\s+0\s+\d+px/,
          `flex: 0 0 ${newWidth}px`
        );
        cell.style.cssText = updatedStyle;
      });
      
      fileLog.debug('📏 Updated body cell widths', {
        columnId,
        newWidth,
        cellsUpdated: bodyCells.length
      });
    } else {
      fileLog.debug('📏 No body cells found for width update', { columnId });
    }
  }

  /**
   * Determine if a field should be treated as a tags field
   */
  private isTagsField(columnId: string, value: any): boolean {
    // Delegate to the modular BadgeRenderer
    return BadgeRenderer.isTagsField(columnId, value);
  }

  /**
   * Create a container element with multiple tag badges
   */
  private createTagsElement(value: string, row: any, column: any): HTMLElement {
    // Delegate to the modular BadgeRenderer
    return BadgeRenderer.createTagsElement(
      value,
      row,
      column,
      this.createElement.bind(this),
      (val, r, c) => this.editTagsField(val, r, c)
    );
  }

  /**
   * Trigger editing mode for tags fields
   */
  private editTagsField(currentValue: string, row: any, column: any): void {
    const cellId = `${row.id}:${column.id}`;
    fileLog.info('🏷️ Starting tags field edit mode', {
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

  /**
   * Get the appropriate CSS badge color class for a given value and column
   */
  private getBadgeColorClass(value: string, columnId: string): string | null {
    // Delegate to the modular BadgeRenderer
    return BadgeRenderer.getBadgeColorClass(value, columnId);
  }

}