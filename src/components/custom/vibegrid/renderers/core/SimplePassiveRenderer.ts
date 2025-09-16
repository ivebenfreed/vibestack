/**
 * SimplePassiveRenderer - Basic working table without overlays
 * 
 * This is a simplified version to get the basic table working first,
 * then we can add overlays back once we have the foundation working.
 */

import { observe, batch } from '@legendapp/state';
import { log } from '@/logger';
import { visualOperations, visualState$, createCompleteGridState$, type CompleteGridState } from '../../stores/visual-state';
import type { TableCore$ } from '../../stores/data-state';
import type { TableInteraction$ } from '../../stores/interaction-state';
import type { TableViewport$ } from '../../stores/pure-observables';
// New modular architecture imports - ObserverManager will be removed
// import { ObserverManager, type ObserverManagerOptions, type VisualState } from './ObserverManager';
import { DOMElementFactory, type DOMElementFactoryOptions } from '../factories/DOMElementFactory';
import { HeaderRenderer, type HeaderRendererOptions } from '../components/HeaderRenderer';

// Manager imports (ViewportManager consolidated into visual-state)
import { BodyRenderer } from '../components/BodyRenderer';
import { EventManager } from '../managers/EventManager';

// Existing modular components
import { OverlayManager, type CoordinateMapping } from '../modules/OverlayManager';
import { BadgeRenderer } from '../modules/BadgeRenderer';
import { CellFormatter } from '../components/BodyRenderer';
import { SelectionController } from '../modules/SelectionController';
import { KeyboardNavigationController } from '../modules/KeyboardNavigationController';
import { ScrollController } from '../modules/ScrollController';
import { MouseController } from '../modules/MouseController';
import { GroupRenderer } from '../components/GroupRenderer';
import { ColumnWidthManager } from '../modules/ColumnWidthManager';

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
  private lastVisibleRows: { start: number; end: number } | null = null;

  // Visual state tracking for change detection
  private lastVisualState: VisualState | null = null;
  
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
  private mouseController: MouseController | null = null;
  private groupRenderer: GroupRenderer | null = null;
  private columnWidthManager: ColumnWidthManager | null = null;
  
  // New modular components (Phase 1 additions) - ObserverManager replaced with complete grid state
  private completeGridState$: any = null;
  private gridStateDisposer: (() => void) | null = null;
  private domFactory: DOMElementFactory | null = null;
  private headerRenderer: HeaderRenderer | null = null;
  
  // Phase 2 manager additions
  private bodyRenderer: BodyRenderer | null = null;
  // ViewportManager consolidated into visual-state
  private eventManager: EventManager | null = null;
  
  constructor(private options: SimplePassiveRendererOptions) {
    fileLog.info('🎯 SimplePassiveRenderer: Initializing');
    
    this.container = options.container;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    
    this.initDOM();
    this.initControllers();
    this.initDOMFactory();
    this.initPhase2Managers();
    this.initOverlayManager();
    this.initHeaderRenderer();
    this.initCompleteGridStateObserver();
    this.postInitialization();
  }
  
  /**
   * Initialize DOM Element Factory
   */
  private initDOMFactory(): void {
    fileLog.info('🏭 Initializing DOM Element Factory');
    
    this.domFactory = new DOMElementFactory({
      tableInteraction$: this.tableInteraction$,
      tableCore$: this.tableCore$,
      selectionController: this.selectionController,
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
      getVisibleColumns: () => {
        const columns = this.tableCore$.columns.get();
        const columnVisibility = this.tableCore$.columnVisibility.get();
        return columns.filter(col => columnVisibility[col.id] !== false);
      }
    });
    
    // Initialize keyboard navigation controller
    this.keyboardNavController = new KeyboardNavigationController({
      tableInteraction$: this.tableInteraction$,
      selectionController: this.selectionController,
      getProcessedRows: () => this.tableCore$.processedRows.get(),
      getVisibleColumns: () => {
        const columns = this.tableCore$.columns.get();
        const columnVisibility = this.tableCore$.columnVisibility.get();
        return columns.filter(col => columnVisibility[col.id] !== false);
      },
      container: this.container
    });

    // Initialize ColumnWidthManager
    this.columnWidthManager = new ColumnWidthManager({
      headerContainer: null, // Will be set after DOM initialization
      bodyContainer: null,   // Will be set after DOM initialization
      headerViewport: null   // Will be set after DOM initialization
    });

    // Scroll controller will be initialized after DOM is ready in postInitialization()
  }
  
  /**
   * Initialize Phase 2 managers
   */
  private initPhase2Managers(): void {
    fileLog.info('🚀 Initializing Phase 2 managers');
    
    // Initialize GroupRenderer first (needed by BodyRenderer)
    this.groupRenderer = new GroupRenderer({
      domFactory: this.domFactory!,
      createElement: this.createElement.bind(this)
    });

    // Initialize BodyRenderer (consolidated cell and row rendering)
    this.bodyRenderer = new BodyRenderer({
      tableCore$: this.tableCore$,
      tableInteraction$: this.tableInteraction$,
      tableViewport$: this.tableViewport$,
      domFactory: this.domFactory!,
      selectionController: this.selectionController,
      keyboardNavController: this.keyboardNavController,
      enableSelectionColumn: this.options.enableSelectionColumn,
      container: this.container,
      createElement: this.createElement.bind(this),
      onEntityUpdate: this.options.onEntityUpdate
    });
    
    // ViewportManager functionality now consolidated in visual-state.ts
    // Viewport operations are handled through visualOperations
    
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
   * Initialize Complete Grid State Observer - Legend State best practice
   * Replaces ObserverManager with single computed observable observation
   */
  private initCompleteGridStateObserver(): void {
    fileLog.info('🎯 Initializing complete grid state observer');
    console.log('🎯 [DEBUG] Starting complete grid state observer initialization');

    try {
      // Create the complete grid state computed observable
      this.completeGridState$ = createCompleteGridState$(
        this.tableCore$,
        this.tableInteraction$,
        this.tableViewport$
      );
      console.log('🎯 [DEBUG] Complete grid state computed observable created successfully');
    } catch (error) {
      console.error('🚨 [CRITICAL] Failed to create complete grid state observable:', error);
      fileLog.error('🚨 Failed to create complete grid state observable', error);
      throw error;
    }

    // Single observer for ALL state changes - eliminates cascade renders
    this.gridStateDisposer = observe(() => {
      const completeState = this.completeGridState$.get();

      fileLog.debug('🎯 Complete grid state changed - coordinated update', {
        visualColumns: completeState.visual.columnLayouts.length,
        dataRows: completeState.data.processedRows.length,
        selectedCells: completeState.interaction.selectedCells.size,
        isEditing: !!completeState.interaction.editingCell,
        isDragging: completeState.interaction.isDragging,
        hasColumnResize: !!completeState.columnResize
      });

      // Handle ALL state changes in coordinated fashion using Legend State batching
      batch(() => {
        this.handleCompleteGridStateChange(completeState);
      });
    });

    fileLog.info('✅ Complete grid state observer initialized');
  }

  /**
   * Handle complete grid state changes - single coordinated update point
   * Replaces all the individual callback handlers from ObserverManager
   */
  private handleCompleteGridStateChange(completeState: CompleteGridState): void {
    // Apply change detection to only update what actually changed
    const { visual, interaction, data, columnResize, renderState } = completeState;

    // 1. Handle visual layout changes (columns, viewport, dimensions)
    if (renderState.hasLayoutChanges) {
      this.handleVisualLayoutChanges(visual, renderState);
    }

    // 2. Handle data changes (rows, sorting)
    if (renderState.hasDataChanges) {
      this.handleDataChanges(data, renderState);
    }

    // 3. Handle interaction state changes (selection, editing, drag)
    if (renderState.hasInteractionChanges) {
      this.handleInteractionChanges(interaction);
    }

    // 4. Handle column resize (immediate DOM updates, no re-render)
    if (columnResize && columnResize.isResizing) {
      this.handleColumnResize(columnResize);
    }

    // 5. Update overlays based on current state
    if (renderState.shouldUpdateOverlays && this.overlayManager) {
      this.updateAllOverlays(completeState);
    }

    fileLog.debug('✅ Complete grid state update finished');
  }

  /**
   * Handle visual layout changes (columns, viewport, scroll)
   */
  private handleVisualLayoutChanges(visual: any, renderState: any): void {
    // Smart rendering - only render what actually changed
    if (renderState.shouldRenderHeader) {
      fileLog.debug('🎨 Rendering header due to layout changes');
      this.renderHeader();
    }

    if (renderState.shouldRenderBody) {
      fileLog.debug('🎨 Rendering body due to layout changes');
      this.renderBody();
    }
  }

  /**
   * Handle data changes (rows, sorting)
   */
  private handleDataChanges(data: any, renderState: any): void {
    // Smart rendering - only render body if needed
    if (renderState.shouldRenderBody) {
      fileLog.debug('🎨 Rendering body due to data changes');
      this.renderBody();
    }

    // Always update sort indicators for data changes
    this.updateSortIndicators();
  }

  /**
   * Handle interaction state changes (selection, editing, drag)
   */
  private handleInteractionChanges(interaction: any): void {
    // Update DOM selection classes
    this.updateDOMSelectionClasses(interaction.selectedCells);

    // Update select all checkbox
    this.updateSelectAllCheckboxVisual(interaction.selectAllCheckboxState);
  }

  /**
   * Handle column resize (immediate DOM updates)
   */
  private handleColumnResize(columnResize: any): void {
    if (columnResize.columnId && columnResize.newWidth) {
      // Direct DOM updates without re-render
      this.columnWidthManager?.updateHeaderCellWidth(columnResize.columnId, columnResize.newWidth);
      this.columnWidthManager?.updateBodyCellWidths(columnResize.columnId, columnResize.newWidth);
    }
  }

  /**
   * Update all overlays based on complete state
   */
  private updateAllOverlays(completeState: CompleteGridState): void {
    const { interaction, columnResize } = completeState;

    fileLog.debug('🎯 updateAllOverlays called', {
      completeStateSelectedCells: Array.from(interaction.selectedCells),
      directSelectedCells: Array.from(this.tableInteraction$.selectedCells.get()),
      areEqual: this.areSetsEqual(interaction.selectedCells, this.tableInteraction$.selectedCells.get())
    });

    // Selection overlay - always update to reflect current state
    this.overlayManager?.updateSelection(interaction.selectedCells);

    // Editing overlay - always update to handle both show and hide cases
    this.overlayManager?.updateEditingOverlay(interaction.editingCell, interaction.editValue);

    // Drag preview
    if (interaction.isDragging && interaction.dragSource) {
      const dragState = {
        isDragging: true,
        startCell: interaction.dragSource,
        currentCell: interaction.dragTarget || interaction.dragSource
      };
      this.overlayManager?.updateColumnDragPreview(dragState);
    } else {
      this.overlayManager?.updateColumnDragPreview(null);
    }

    // Column resize preview - always update to handle both show and hide cases
    this.overlayManager?.updateColumnResizePreview(columnResize);
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

    // Initialize viewport dimensions
    // Initialize viewport dimensions using visual operations
    const bounds = this.container.getBoundingClientRect();
    visualOperations.updateViewportDimensions(bounds.width, bounds.height);

    // Initialize enhanced ScrollController with comprehensive event handling
    this.scrollController = new ScrollController({
      viewport: this.viewport!,
      headerViewport: this.headerViewport,
      container: this.container,
      onScroll: (scrollLeft: number, scrollTop: number) => {
        // Only update viewport observable (consolidated visual observer handles the rest)
        // Visual operations are triggered by the consolidated observer, not directly here
        this.tableViewport$.updateScroll(scrollTop, scrollLeft);

        // DEBUGGING: Log detailed width calculations during scroll
        const visualState = visualState$.get();
        const viewport = this.viewport;
        const headerViewport = this.headerViewport;

        fileLog.info('📜 SCROLL DEBUG - Width Calculations', {
          scrollLeft,
          scrollTop,
          // Visual state geometry
          visualStateTotalWidth: visualState.geometry.totalWidth,
          visualStateViewportWidth: visualState.geometry.viewportWidth,
          // Visible columns analysis
          visibleColumnsCount: visualState.visibleColumns.length,
          columnLayouts: visualState.visibleColumns.map(col => ({
            id: col.id,
            width: col.width,
            xOffset: col.xOffset,
            visible: col.visible
          })),
          // DOM dimensions
          viewportClientWidth: viewport?.clientWidth,
          viewportScrollWidth: viewport?.scrollWidth,
          headerViewportClientWidth: headerViewport?.clientWidth,
          headerViewportScrollWidth: headerViewport?.scrollWidth,
          // Transform states
          headerTransform: headerViewport?.style.transform,
          // Scroll edge analysis
          scrollRightEdge: scrollLeft + (viewport?.clientWidth || 0),
          totalScrollableWidth: (viewport?.scrollWidth || 0) - (viewport?.clientWidth || 0),
          scrollProgress: viewport?.scrollWidth ? (scrollLeft / ((viewport.scrollWidth - viewport.clientWidth) || 1) * 100).toFixed(1) + '%' : '0%'
        });
      },
      keyboardNavController: this.keyboardNavController,
      selectionController: this.selectionController,
      tableInteraction$: this.tableInteraction$
    });

    // Initialize MouseController for centralized mouse event handling
    this.mouseController = new MouseController({
      container: this.container,
      bodyRenderer: this.bodyRenderer,
      scrollController: this.scrollController
    });

    // Configure ColumnWidthManager with DOM containers
    if (this.columnWidthManager) {
      this.columnWidthManager.setContainers({
        headerContainer: this.headerContainer,
        bodyContainer: this.bodyContainer,
        headerViewport: this.headerViewport
      });
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

    // Apply Legend State batching for initial render to prevent multiple layout calculations
    batch(() => {
      // Initial render
      this.renderHeader();
      this.renderBody();
    });

    fileLog.info('✅ Post-initialization complete');
  }
  
  /**
   * Initialize DOM structure
   */
  private initDOM(): void {
    if (!this.container) {
      fileLog.error('❌ Container is null - cannot initialize DOM');
      return;
    }

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
    
    // Create header clip wrapper (clips the visible area)
    const headerClipWrapper = this.createElement('div', 'vibegridx-header-clip');
    headerClipWrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: ${HEADER_HEIGHT}px;
      overflow: hidden;
      z-index: 10;
      background: hsl(var(--muted));
      border-bottom: 1px solid hsl(var(--border));
    `;

    // Create header viewport (can be as wide as needed, moved with transform)
    this.headerViewport = this.createElement('div', 'vibegridx-header-viewport');
    this.headerViewport.style.cssText = `
      position: relative;
      height: ${HEADER_HEIGHT}px;
      width: max-content;
      min-width: 100%;
      will-change: transform;
      /* border: 2px solid blue !important; */
      box-sizing: border-box;
    `;
    this.headerViewport.appendChild(this.headerContainer);
    headerClipWrapper.appendChild(this.headerViewport);
    
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
      /* border: 2px solid red !important; */
      box-sizing: border-box;
    `;
    
    this.viewport.appendChild(this.bodyContainer);

    // Assemble the complete structure
    table.appendChild(headerClipWrapper);
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
    
    // Context menu handling is now done by EventManager in Phase 2
    
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
   * DELEGATED: Now handled by GroupRenderer
   */
  private createGroupHeaderElement(groupRow: any, rowIndex: number): HTMLElement {
    // Delegate to GroupRenderer for consistent group header creation
    if (this.groupRenderer) {
      return this.groupRenderer.createGroupHeaderElement(groupRow, rowIndex);
    }

    // Fallback to DOMFactory if GroupRenderer not available
    if (this.domFactory) {
      return this.domFactory.createGroupHeaderElement(groupRow, rowIndex);
    }

    // Error case - should not happen with proper initialization
    fileLog.error('🚨 Neither GroupRenderer nor DOMFactory available');
    throw new Error('GroupRenderer not initialized - check initialization order');
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
    
    // HeaderRenderer should always be available - if not, something is wrong
    fileLog.error('🚨 HeaderRenderer not available - this should not happen');
    throw new Error('HeaderRenderer not initialized - check initialization order');
  }
  
  /**
   * Render table body
   */
  private renderBody(): void {
    if (!this.bodyContainer || !this.bodyRenderer) return;
    
    const rows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.tableCore$.columnVisibility.get();

    // Debug: Check if we have group rows (Legend State rows don't have type property)
    const groupRows = rows.filter((row: any) => row.type === 'group');
    const dataRows = rows.filter((row: any) => !row.type || row.type !== 'group'); // All non-group rows are data

    fileLog.info('🎨 Rendering body with Phase 2 managers', {
      rowCount: rows.length,
      columnCount: columns.length,
      groupRows: groupRows.length,
      dataRows: dataRows.length
    });

    this.bodyContainer.innerHTML = '';
    
    // Clear active rows in RowRenderer
    this.bodyRenderer.clearActiveRows();
    
    // Update content dimensions in visual state
    const totalHeight = rows.length * 40; // ROW_HEIGHT
    visualOperations.setRowCount(rows.length);
    
    // Update row coordinate mapping
    this.coordinateMapping.rows = [];
    
    // Virtual scrolling: Only render visible rows - use visual observables
    const visualState = visualState$.get();
    const visibleRange = visualState.geometry.visibleRowRange;
    const startIndex = Math.max(0, visibleRange.start);
    const endIndex = Math.min(rows.length, visibleRange.end);
    const visibleRows = rows.slice(startIndex, endIndex);
    
    fileLog.debug('🎨 Virtual scrolling with Phase 2', { 
      totalRows: rows.length, 
      visibleRange: `${startIndex}-${endIndex}`,
      rendering: visibleRows.length
    });
    
    // Get virtual column range and layouts from the unified visual state (single source of truth)
    const visibleColumnRange = visualState.geometry.visibleColumnRange;
    const allColumnLayouts = visualState.columnLayouts;
    const visibleColumnLayouts = visualState.visibleColumns;

    // Use the EXACT same range as header (from observable with buffer already included)
    const startColIndex = visibleColumnRange.start;
    const endColIndex = visibleColumnRange.end;
    const virtualColumnLayouts = visibleColumnLayouts.slice(startColIndex, endColIndex);

    // Calculate base offset including drag column width for grouped mode
    const baseOffset = this.calculateBaseOffset();

    // Use pre-computed starting x position from unified visual state - NO duplicate calculation
    const startX = startColIndex > 0 ? visibleColumnLayouts[startColIndex].xOffset : baseOffset;

    // Convert column layouts back to columns for compatibility with existing renderer
    const virtualColumns = virtualColumnLayouts.map(layout =>
      columns.find(col => col.id === layout.id)
    ).filter(Boolean);
    
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
        rowElement = this.bodyRenderer.createGroupHeaderElement(row, actualRowIndex);
      } else {
        rowElement = this.bodyRenderer.createRowElement(row, actualRowIndex, virtualColumns, columnVisibility, startX);
      }
      
      this.bodyContainer.appendChild(rowElement);
    });
    
    // Build complete coordinate mapping for all rows (needed for overlays)
    const newRows: any[] = [];
    rows.forEach((row, rowIndex) => {
      newRows.push({
        rowId: row.id,
        y: rowIndex * ROW_HEIGHT,
        height: ROW_HEIGHT,
        index: rowIndex
      });
    });

    // Check for row coordinate mapping changes (including position)
    const rowMappingChanged = !this.coordinateMapping.rows ||
      this.coordinateMapping.rows.length !== newRows.length ||
      newRows.some((newRow, index) => {
        const oldRow = this.coordinateMapping.rows?.[index];
        return !oldRow ||
               oldRow.rowId !== newRow.rowId ||
               oldRow.y !== newRow.y;
      });

    // Only update coordinate mapping if it actually changed
    if (rowMappingChanged) {
      this.coordinateMapping.rows = newRows;
      this.coordinateMapping.version++;

      fileLog.debug('🔄 Row coordinate mapping updated', {
        newRowCount: newRows.length,
        firstRowId: newRows[0]?.rowId,
        mappingVersion: this.coordinateMapping.version,
        sampleRows: newRows.slice(0, 3).map(r => ({ id: r.rowId, y: r.y }))
      });

      // Sync coordinate mapping with overlay manager
      this.overlayManager?.updateCoordinateMapping(this.coordinateMapping);
    }
    
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
  
  // REMOVED: createRowElement() - Now fully handled by RowRenderer in Phase 2
  // This legacy method has been replaced by this.rowRenderer.createRowElement()

  // Legacy method body removed - functionality moved to RowRenderer
  
  /**
   * Format cell value using centralized display formatters
   */
  private formatCellValue(value: any, type?: string, column?: any): string {
    // Delegate to the modular CellFormatter
    return CellFormatter.formatCellValue(value, type, column);
  }
  
  // Removed redundant formatting methods - now using centralized display formatters
  
  /**
   * Handle consolidated visual state changes - batched column, visibility, and viewport updates
   * This prevents cascade effects and reduces render cycles from 5+ to 1
   */
  private handleConsolidatedVisualStateChange(visualState: VisualState): void {
    fileLog.info('🎨 Consolidated visual state change - batched render coordination', {
      columnCount: visualState.columns.length,
      hiddenColumns: Object.values(visualState.columnVisibility).filter(v => v === false).length,
      viewport: visualState.viewport
    });

    // Apply Legend State batching pattern to prevent multiple DOM updates
    batch(() => {
      // Determine what actually changed to optimize renders
      const previousState = this.lastVisualState;

      // Check if header needs to be re-rendered
      const needsHeaderRender = !previousState ||
        previousState.columns.length !== visualState.columns.length ||
        JSON.stringify(previousState.columnVisibility) !== JSON.stringify(visualState.columnVisibility) ||
        JSON.stringify(previousState.columns.map(c => c.width)) !== JSON.stringify(visualState.columns.map(c => c.width));

      // Check if body needs to be re-rendered (viewport changes affect body virtual scrolling)
      const needsBodyRender = !previousState ||
        previousState.viewport.scrollTop !== visualState.viewport.scrollTop ||
        previousState.viewport.scrollLeft !== visualState.viewport.scrollLeft ||
        previousState.viewport.viewportWidth !== visualState.viewport.viewportWidth ||
        previousState.viewport.viewportHeight !== visualState.viewport.viewportHeight ||
        needsHeaderRender; // Body depends on header changes

      fileLog.debug('🎯 Render decisions', {
        needsHeaderRender,
        needsBodyRender,
        hasLastState: !!previousState
      });

      // Single coordinated render cycle instead of separate renders
      if (needsHeaderRender) {
        this.renderHeader();
      }

      if (needsBodyRender) {
        this.renderBody();
      }

      // Store current state for next comparison
      this.lastVisualState = {
        columns: [...visualState.columns],
        columnVisibility: { ...visualState.columnVisibility },
        viewport: { ...visualState.viewport }
      };
    });

    // Viewport handling is now fully integrated into consolidated visual state
    // No need to call handleViewportChange() as it would duplicate the work
  }

  /**
   * Handle viewport changes (scroll and dimension updates)
   * Triggers virtual scrolling updates when visible range changes
   */
  private handleViewportChange(): void {
    // FIXED: Use unified visual state instead of broken tableViewport$ observable
    const visualState = visualState$.get();
    const visibleColumns = visualState.geometry.visibleColumnRange;
    const previousColumns = this.lastVisibleColumns || { start: -1, end: -1 };

    const columnsChanged = visibleColumns && (
      visibleColumns.start !== previousColumns.start ||
      visibleColumns.end !== previousColumns.end
    );

    // DEBUG: Log trigger analysis to identify excessive rendering
    fileLog.info('🔍 VIEWPORT CHANGE TRIGGER FIXED', {
      scrollLeft: this.tableViewport$?.scrollLeft?.get?.() || 0,
      visibleColumns: visibleColumns ? `${visibleColumns.start}-${visibleColumns.end}` : 'null',
      previousColumns: `${previousColumns.start}-${previousColumns.end}`,
      columnsChanged,
      willTriggerHeaderRender: columnsChanged && visibleColumns
    });

    // Check if vertical rows have changed (for virtual scrolling)
    const visibleRows = this.tableViewport$?.visibleRows?.get?.() || { start: 0, end: 10 };
    const previousRows = this.lastVisibleRows || { start: -1, end: -1 };
    const rowsChanged = visibleRows && (
      visibleRows.start !== previousRows.start ||
      visibleRows.end !== previousRows.end
    );

    // Update viewport manager
    // Viewport changes are handled by visual-state observables

    // Update overlay selection with current viewport position (lightweight)
    if (this.overlayManager) {
      // Re-update selection overlay which will internally update viewport info
      const selectedCells = this.tableInteraction$.selectedCells.get();
      if (selectedCells.size > 0) {
        this.overlayManager.updateSelection(selectedCells);
      }
    }

    // Only re-render when necessary to prevent excessive rendering during scroll
    if (columnsChanged && visibleColumns) {
      // Horizontal scrolling with column changes - full re-render
      this.lastVisibleColumns = visibleColumns;

      // Apply Legend State batching for coordinated header/body re-render
      batch(() => {
        this.renderHeader();
        this.renderBody();
      });

      fileLog.info('🔄 Full re-render: columns changed', { visibleColumns });
    } else if (rowsChanged && visibleRows) {
      // Vertical scrolling with row changes - body only
      this.lastVisibleRows = visibleRows;
      this.renderBody();
      fileLog.info('🔄 Body re-render: rows changed', { visibleRows });
    } else {
      // No visible range changes - skip expensive re-renders
      fileLog.debug('⏭️ Viewport change skipped re-render (no visible range changes)');
    }
  }

  // ====================================
  // UTILITY METHODS
  // ====================================

  /**
   * Calculate base X offset including drag column width (always present for consistent layout)
   */
  private calculateBaseOffset(): number {
    const ROW_HEADER_WIDTH = 40;
    const DRAG_COLUMN_WIDTH = 30;

    // Always include both columns for consistent layout
    return DRAG_COLUMN_WIDTH + ROW_HEADER_WIDTH;  // 30px + 40px = 70px
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

  /**
   * Destroy the renderer
   */
  destroy(): void {
    fileLog.info('🧹 Destroying SimplePassiveRenderer with Phase 2 managers');
    
    // Clean up complete grid state observer
    if (this.gridStateDisposer) {
      this.gridStateDisposer();
      this.gridStateDisposer = null;
    }

    this.completeGridState$ = null;
    
    // Clean up Phase 2 managers
    if (this.eventManager) {
      this.eventManager.destroy();
      this.eventManager = null;
    }
    
    // ViewportManager cleanup not needed - visual-state handles this
    
    // Clean up ScrollController
    if (this.scrollController) {
      this.scrollController.destroy();
      this.scrollController = null;
    }

    // Clean up MouseController
    if (this.mouseController) {
      this.mouseController.destroy();
      this.mouseController = null;
    }

    // Clean up ColumnWidthManager
    if (this.columnWidthManager) {
      this.columnWidthManager.destroy();
      this.columnWidthManager = null;
    }

    // Clean up GroupRenderer
    if (this.groupRenderer) {
      this.groupRenderer.destroy();
      this.groupRenderer = null;
    }

    // RowRenderer and CellRenderer don't need explicit cleanup
    this.bodyRenderer = null;
    
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
  
  // REMOVED: setupScrollHandling() - Now handled by enhanced ScrollController
  
  // REMOVED: syncHeaderScroll() - Now handled by ColumnWidthManager

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
    
    // HeaderRenderer should always be available - if not, something is wrong
    fileLog.error('🚨 HeaderRenderer not available for sort indicators - this should not happen');
    throw new Error('HeaderRenderer not initialized - check initialization order');
  }

  // REMOVED: createSortIconSVG() - Now handled by HeaderRenderer

  // REMOVED: updateHeaderCellWidth() and updateBodyCellWidths() - Now handled by ColumnWidthManager

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

    // Check if column is editable before starting edit mode
    if (column.editable === false) {
      fileLog.info('🏷️ Tags field clicked - but column is not editable', {
        cellId,
        rowId: row.id,
        columnId: column.id,
        editable: column.editable
      });
      return;
    }

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