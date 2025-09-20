/**
 * SimplePassiveRenderer - Basic working table without overlays
 * 
 * This is a simplified version to get the basic table working first,
 * then we can add overlays back once we have the foundation working.
 */

import { observe, batch } from '@legendapp/state';
import { log } from '@/logger';
import { createVibeGridVisualState } from '../../stores/visual-state';
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

// New hybrid coordinate system imports
import { GRID_DIMENSIONS } from '../../constants/grid-dimensions';
import { updateVirtualBounds, updateVirtualViewport, updateVirtualColumns } from '../../virtualization/VirtualScrollManager';
import { positionTracker } from '../../stores/dom-position-state';

// Utility imports
import type { ViewportInfo, TableRow } from '../../types';
import type { VisualCellPosition } from '../../overlays/OverlayTypes';
import { formatFieldForDisplay } from '@/server/dataforge/fields/display-formatters';
import { createDataLoadingStage$, createStageCallbacks } from '../../stores/data-loading-stages';
import type { VibeGridHydrationManager } from '../../stores/init-state';

const fileLog = log('components/custom/vibegrid/renderers/core/SimplePassiveRenderer.ts');

// Use centralized dimensions from the new system
const ROW_HEIGHT = GRID_DIMENSIONS.ROW_HEIGHT;
const HEADER_HEIGHT = GRID_DIMENSIONS.HEADER_HEIGHT;

export interface SimplePassiveRendererOptions {
  container: HTMLElement;
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  tableViewport$: TableViewport$;
  visualState: ReturnType<typeof createVibeGridVisualState>;
  initManager: VibeGridHydrationManager;
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
  private initManager: VibeGridHydrationManager;
  private sortedProcessedRows$?: any; // Computed that provides sorted processedRows
  
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
  
  // Focused observers - replacing mega-observer pattern
  private dataObserverDisposer: (() => void) | null = null;
  private visualObserverDisposer: (() => void) | null = null;
  private columnVisibilityObserverDisposer: (() => void) | null = null;
  private columnOrderObserverDisposer: (() => void) | null = null;
  private columnWidthsObserverDisposer: (() => void) | null = null; // Add dedicated observer for column widths
  private interactionObserverDisposer: (() => void) | null = null;
  private scrollObserverDisposer: (() => void) | null = null;
  private dragSelectionObserverDisposer: (() => void) | null = null;
  private pendingRAF: number | null = null; // Track pending RAF to prevent cascades
  private observersEnabled: boolean = false; // Prevent observers from running during initialization
  private domFactory: DOMElementFactory | null = null;
  private headerRenderer: HeaderRenderer | null = null;
  
  // Phase 2 manager additions
  private bodyRenderer: BodyRenderer | null = null;
  // ViewportManager consolidated into visual-state
  private eventManager: EventManager | null = null;

  // Visual state instance
  private visualState: any = null;
  
  constructor(private options: SimplePassiveRendererOptions) {
    fileLog.info('🎯 SimplePassiveRenderer: Initializing');

    this.container = options.container;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    this.initManager = options.initManager;

    // Use visual state passed from parent VibeGrid component
    this.visualState = options.visualState;

    // Create sorted processed rows computed observable internally (self-contained)
    this.sortedProcessedRows$ = this.visualState.createSortedProcessedRows$(this.tableCore$);

    fileLog.info('✅ Renderer self-contained: created sortedProcessedRows$ internally', {
      timestamp: Date.now(),
      hasSortedRows: !!this.sortedProcessedRows$
    });
    
    this.initDOM();
    this.initControllers();
    this.initDOMFactory();
    this.initPhase2Managers();
    this.initOverlayManager();
    this.initHeaderRenderer();
    fileLog.debug('🎯 About to call initFocusedObservers - this should appear during construction');
    this.initFocusedObservers();
    fileLog.debug('🎯 initFocusedObservers completed - observers should be created');
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
      onEntityUpdate: this.options.onEntityUpdate,
      visualOperations: this.visualState.visualOperations
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
        const columnVisibility = this.visualState.visualInputs$.columnVisibility.get();
        return columns.filter(col => columnVisibility[col.id] !== false);
      },
      bodyRenderer: null // Will be set after bodyRenderer is initialized
    });
    
    // Initialize keyboard navigation controller
    this.keyboardNavController = new KeyboardNavigationController({
      tableInteraction$: this.tableInteraction$,
      selectionController: this.selectionController,
      getProcessedRows: () => this.tableCore$.processedRows.get(),
      getVisibleColumns: () => {
        const columns = this.tableCore$.columns.get();
        const columnVisibility = this.visualState.visualInputs$.columnVisibility.get();
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
      createElement: this.createElement.bind(this),
      visualState: this.visualState
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
      visualState: this.visualState,
      createElement: this.createElement.bind(this),
      onEntityUpdate: this.options.onEntityUpdate
    });

    // Update SelectionController with bodyRenderer reference for checkbox updates
    if (this.selectionController) {
      this.selectionController.bodyRenderer = this.bodyRenderer;
    }
    
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

    // Initialize the canvas overlay after the DOM is ready
    this.overlayManager.initializeOverlay();

    fileLog.info('✅ Overlay manager initialized');
  }

  /**
   * Initialize Focused Observers - replaces mega-observer anti-pattern
   * Each observer handles only its specific concern for optimal performance
   */
  private initFocusedObservers(): void {
    fileLog.info('🎯 Initializing focused observers');

    // SORTED DATA OBSERVER: Direct subscription to computed sorted rows changes
    // This will trigger whenever the computed sorted data changes (due to sorting, filtering, or raw data changes)
    fileLog.debug('🎯 Creating sorted data observer - direct subscription to sortedProcessedRows$ changes');

    if (!this.sortedProcessedRows$) {
      fileLog.error('❌ DATA FLOW ERROR: sortedProcessedRows$ not available - cannot set up observer');
      return;
    }

    this.dataObserverDisposer = this.sortedProcessedRows$.onChange(() => {
      fileLog.info('🔍 SORTED DATA CHANGE DETECTED - Legend State computed observable onChange', {
        observersEnabled: this.observersEnabled,
        timestamp: Date.now()
      });

      // Get the latest sorted data after the computed observable change
      const processedRows = this.sortedProcessedRows$.get();
      const sortBy = this.visualState.visualInputs$.sortBy.get();

      fileLog.info('🔍 SORTED DATA AFTER CHANGE', {
        processedRowsCount: processedRows.length,
        sortByCount: sortBy.length,
        sortByFirst: sortBy[0]?.field,
        sortByDirection: sortBy[0]?.direction,
        firstRowTitle: processedRows[0]?.title
      });

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ SORTED DATA: Observers not enabled yet');
        return;
      }

      // GUARD: Only render if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ SORTED DATA: Skipping render during initialization');
        return;
      }

      // Legend State automatically handles change detection - just re-render
      this.renderBody();

      fileLog.debug('🔄 Legend State reactive render - sorted data applied', {
        processedRowsCount: processedRows.length,
        sortByCount: sortBy.length,
        sortByFirst: sortBy[0]?.field,
        sortByDirection: sortBy[0]?.direction,
        firstRowTitle: processedRows[0]?.title
      });
    });

    // COLUMN VISIBILITY OBSERVER: Dedicated observer for column visibility changes
    this.columnVisibilityObserverDisposer = this.visualState.visualInputs$.columnVisibility.onChange(() => {

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ COLUMN VISIBILITY: Observers not enabled yet');
        return;
      }

      // GUARD: Only render if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ COLUMN VISIBILITY: Skipping render during initialization');
        return;
      }

      const columnVisibility = this.visualState.visualInputs$.columnVisibility.get();
      const hiddenColumns = Object.entries(columnVisibility).filter(([_, visible]) => visible === false);

      fileLog.info('🎨 Column visibility changed - forcing layout re-render', {
        hiddenColumnsCount: hiddenColumns.length,
        hiddenColumns: hiddenColumns.map(([id]) => id)
      });

      // Force re-render when column visibility changes
      batch(() => {
        this.renderHeader();
        this.renderBody();
      });
    });

    // COLUMN ORDER OBSERVER: Dedicated observer for column order changes (like column visibility)
    this.columnOrderObserverDisposer = this.visualState.visualInputs$.columnOrder.onChange(() => {
      fileLog.info('🔄 COLUMN ORDER CHANGE DETECTED via dedicated observer', {
        observersEnabled: this.observersEnabled,
        timestamp: Date.now()
      });

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ COLUMN ORDER: Observers not enabled yet');
        return;
      }

      // GUARD: Only render if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ COLUMN ORDER: Skipping render during initialization');
        return;
      }

      const columnOrder = this.visualState.visualInputs$.columnOrder.get();

      fileLog.info('🎨 Column order changed - forcing layout re-render', {
        columnOrderLength: columnOrder.length,
        columnOrder: columnOrder
      });

      // Force re-render when column order changes
      batch(() => {
        this.renderHeader();
        this.renderBody();
      });
    });

    // COLUMN WIDTHS OBSERVER: Dedicated observer for column width changes
    this.columnWidthsObserverDisposer = this.visualState.visualInputs$.columnWidths.onChange(() => {
      fileLog.info('[RESIZE] 🔄 COLUMN WIDTH CHANGE DETECTED via dedicated observer', {
        observersEnabled: this.observersEnabled,
        timestamp: Date.now()
      });

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('[RESIZE] ⏸️ COLUMN WIDTHS: Observers not enabled yet');
        return;
      }

      // GUARD: Only render if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('[RESIZE] ⏸️ COLUMN WIDTHS: Skipping render during initialization');
        return;
      }

      const columnWidths = this.visualState.visualInputs$.columnWidths.get();

      fileLog.info('[RESIZE] 🎨 Column widths changed - forcing layout re-render', {
        columnWidths,
        columnCount: Object.keys(columnWidths).length
      });

      // Force re-render when column widths change (same as column order)
      batch(() => {
        this.renderHeader();
        this.renderBody();
      });
    });

    // VISUAL OBSERVER: Only watches layout changes (columns, viewport dimensions)
    // Track non-scroll visual changes to avoid duplicate renders with scroll observer
    let lastVisualLayout = '';

    fileLog.info('🎯 CREATING VISUAL OBSERVER', {
      visualStateExists: !!this.visualState,
      visualInputsExists: !!this.visualState?.visualInputs$,
      columnOrderExists: !!this.visualState?.visualInputs$?.columnOrder,
      observersEnabled: this.observersEnabled
    });

    this.visualObserverDisposer = observe(() => {
      fileLog.info('🔍 VISUAL OBSERVER CALLBACK ENTERED', {
        observersEnabled: this.observersEnabled,
        timestamp: Date.now()
      });

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ VISUAL: Observers not enabled yet');
        return;
      }

      // GUARD: Only render if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ VISUAL: Skipping render during initialization');
        return;
      }

      // CRITICAL: Don't use .get(true) here as it bypasses dependency tracking!
      const visualState = this.visualState.visualState$.get();

      // IMPORTANT: Read ALL visual inputs to track changes - this triggers the observer
      const columnOrder = this.visualState.visualInputs$.columnOrder.get();
      const columnVisibility = this.visualState.visualInputs$.columnVisibility.get();
      const columnWidths = this.visualState.visualInputs$.columnWidths.get();

      fileLog.info('[RESIZE] 🔍 VISUAL OBSERVER TRIGGERED - columnWidths change detected', {
        columnWidths,
        columnOrderLength: columnOrder.length,
        timestamp: Date.now(),
        visualInputsId: this.visualState.visualInputs$._id || 'no-id' // Debug: check instance
      });

      // Create a signature of layout-only changes (exclude scroll position)
      // Include column order, visibility, AND widths in signature to detect changes
      const columnOrderSignature = columnOrder?.join(',') || '';
      const columnVisibilitySignature = Object.entries(columnVisibility || {})
        .filter(([_, visible]) => visible === false)  // Only track hidden columns
        .map(([id]) => id)
        .sort()
        .join(',');
      const columnWidthsSignature = Object.entries(columnWidths || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, width]) => `${id}:${width}`)
        .join(',');
      const layoutSignature = `${visualState.columnLayouts.length}-${visualState.geometry.totalWidth}-${visualState.geometry.viewportWidth}x${visualState.geometry.viewportHeight}-${columnOrderSignature}-hidden:${columnVisibilitySignature}-widths:${columnWidthsSignature}`;

      fileLog.info('🔍 VISUAL OBSERVER TRIGGERED', {
        columnOrderSignature,
        columnOrder: columnOrder,
        columnVisibilitySignature,
        columnWidthsSignature,
        hiddenColumnCount: columnVisibilitySignature.split(',').filter(Boolean).length,
        currentLayoutSignature: layoutSignature,
        previousLayoutSignature: lastVisualLayout,
        columnOrderLength: visualState.columnState.columnOrder?.length || 0,
        willTriggerRender: layoutSignature !== lastVisualLayout,
        visualStateColumnOrder: visualState.columnState.columnOrder,
        columnWidths: columnWidths
      });

      // Only render if actual layout changed, not just scroll position
      if (layoutSignature !== lastVisualLayout) {
        lastVisualLayout = layoutSignature;

        fileLog.info('🎨 Visual layout changed - updating layout only', {
          columnCount: visualState.columnLayouts.length,
          totalWidth: visualState.geometry.totalWidth,
          viewportSize: `${visualState.geometry.viewportWidth}x${visualState.geometry.viewportHeight}`,
          columnOrder: columnOrderSignature || 'default',
          columnWidths: columnWidthsSignature || 'default',
          previousLayoutSignature: lastVisualLayout,
          currentLayoutSignature: layoutSignature
        });

        // Batch the render operations to prevent cascade
        batch(() => {
          // Only update layout, no data processing
          this.renderHeader();
          this.renderBody(); // Body needs re-render for column changes
        });
      }
    });

    // INTERACTION OBSERVER: Only watches interaction changes (selection, editing, drag)
    this.interactionObserverDisposer = observe(() => {
      // CRITICAL: Use .get(true) to avoid creating dependency when just checking state
      // We only want to track actual selection, editing, and drag state changes
      const columnResize = this.tableInteraction$.columnResize.get(true);

      // Only log resize-specific info when actually resizing
      if (columnResize?.isResizing) {
        fileLog.info('[RESIZE] 🔍 Column resize active in interaction observer', {
          observersEnabled: this.observersEnabled,
          timestamp: Date.now(),
          columnResizeState: columnResize
        });
      }

      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ INTERACTION: Observers not enabled yet');
        return;
      }
      const selectedCells = this.tableInteraction$.selectedCells.get();
      const editingCell = this.tableInteraction$.editingCell.get();
      const editValue = this.tableInteraction$.editValue.get();
      const selectAllState = this.tableInteraction$.selectAllCheckboxState.get();
      const isDragging = this.tableInteraction$.isDragging.get();
      const dragSource = this.tableInteraction$.dragSource.get();
      const dragTarget = this.tableInteraction$.dragTarget.get();
      const isDragSelecting = this.tableInteraction$.isDragSelecting.get();
      const dragSelectStart = this.tableInteraction$.dragSelectStart.get();
      const dragSelectCurrent = this.tableInteraction$.dragSelectCurrent.get();

      // Only log detailed state when something interesting is happening
      if (isDragging || editingCell || isDragSelecting || columnResize?.isResizing) {
        fileLog.info('🖱️ INTERACTION OBSERVER TRIGGERED', {
          selectedCount: selectedCells.size,
          isEditing: !!editingCell,
          isDragging,
          isDragSelecting,
          isResizing: !!columnResize?.isResizing,
          columnResizeDetails: columnResize?.isResizing ? {
            columnId: columnResize.columnId,
            newWidth: columnResize.newWidth,
            isResizing: columnResize.isResizing
          } : null
        });
      }

      // Only update DOM classes and overlays, no re-renders
      this.updateDOMSelectionClasses(selectedCells);
      this.updateSelectAllCheckboxVisual(selectAllState);

      if (this.overlayManager) {
        // Selection overlay is now handled reactively by OverlayManager via interactions observable
        // No need to manually update selection here

        // DISABLED: Update editing overlay (now handled by reactive observer in OverlayManager)
        // this.overlayManager.updateEditingOverlay(editingCell, editValue);

        // Update drag preview overlay
        if (isDragging && dragSource) {
          const dragState = {
            isDragging: true,
            startCell: dragSource,
            currentCell: dragTarget || dragSource
          };
          this.overlayManager.updateColumnDragPreview(dragState);
        } else {
          this.overlayManager.updateColumnDragPreview(null);
        }

        // Update column resize preview
        this.overlayManager.updateColumnResizePreview(columnResize);
      }

      // Handle column resize with direct DOM updates (no re-render)
      // CRITICAL FIX: Access columnResize state right here so Legend State tracks dependency
      const currentColumnResize = this.tableInteraction$.columnResize.get(true);
      if (currentColumnResize?.isResizing && currentColumnResize.columnId && currentColumnResize.newWidth) {
        fileLog.info('[RESIZE] 📏 SimplePassiveRenderer handling column resize', {
          columnId: currentColumnResize.columnId,
          newWidth: currentColumnResize.newWidth,
          isResizing: currentColumnResize.isResizing,
          hasColumnWidthManager: !!this.columnWidthManager
        });

        this.columnWidthManager?.updateHeaderCellWidth(currentColumnResize.columnId, currentColumnResize.newWidth);
        this.columnWidthManager?.updateBodyCellWidths(currentColumnResize.columnId, currentColumnResize.newWidth);
      }
    });

    // SCROLL OBSERVER: Watches scroll position and triggers re-render when virtual range changes
    this.scrollObserverDisposer = observe(() => {
      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ SCROLL: Observers not enabled yet');
        return;
      }

      // Skip during initialization to prevent unnecessary renders
      // Check rendererInitialized to ensure we're completely done initializing
      if (!this.initManager.hydrationState$.rendererInitialized.get(true)) {
        return;
      }

      const scrollLeft = this.visualState.visualInputs$.scrollLeft.get(true);
      const scrollTop = this.visualState.visualInputs$.scrollTop.get(true);

      // Always update CSS transforms immediately (lightweight)
      if (this.headerViewport) {
        this.headerViewport.style.transform = `translateX(-${scrollLeft}px)`;
      }

      // GUARD: Only trigger virtual range check if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ SCROLL: Skipping virtual range check during initialization');
        return;
      }

      // Defer virtual range checking to avoid reading computed state in observer
      // Use RAF to break out of the reactive context
      // CRITICAL FIX: Prevent RAF cascade by cancelling previous RAF
      if (this.pendingRAF !== null) {
        cancelAnimationFrame(this.pendingRAF);
      }

      // Only schedule RAF if we're fully initialized AND have previous ranges to compare
      // This prevents double-render during initialization
      if (this.initManager.hydrationState$.rendererInitialized.get(true) &&
          this.lastVisibleColumns && this.lastVisibleRows) {
        this.pendingRAF = requestAnimationFrame(() => {
          this.pendingRAF = null; // Clear the pending RAF
          this.checkVirtualRangeChange();
        });
      }
    });

    // DRAG SELECTION OBSERVER: Watches drag selection state and mouse coordinates
    this.dragSelectionObserverDisposer = observe(() => {
      // GUARD: Skip if observers are not enabled yet
      if (!this.observersEnabled) {
        fileLog.debug('⏸️ DRAG: Observers not enabled yet');
        return;
      }

      const isDragSelecting = this.tableInteraction$.isDragSelecting.get(true);
      const mouseX = this.tableInteraction$.mouseX.get(true);
      const mouseY = this.tableInteraction$.mouseY.get(true);
      const startCell = this.tableInteraction$.dragSelectStart.get(true);

      if (isDragSelecting && startCell && mouseX > 0 && mouseY > 0) {
        // Find current cell at mouse position
        const targetElement = document.elementFromPoint(mouseX, mouseY);
        const cellElement = targetElement?.closest('[data-row-id][data-column-id]');

        if (cellElement) {
          const rowId = cellElement.getAttribute('data-row-id');
          const columnId = cellElement.getAttribute('data-column-id');
          const currentCell = `${rowId}:${columnId}`;

          // Compute rectangular selection range with all interior cells
          const dragRange = this.calculateRectangularSelection(startCell, currentCell);
          this.tableInteraction$.selectedCells.set(new Set(dragRange));

          fileLog.debug('🎯 Drag selection updated reactively', {
            startCell,
            currentCell,
            rangeSize: dragRange.length,
            mousePos: { mouseX, mouseY }
          });
        }
      }
    });

    fileLog.info('✅ Focused observers initialized');
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
      visualState: this.visualState,
      updateCoordinateMapping: (mapping: CoordinateMapping) => {
        this.coordinateMapping = mapping;

        // GUARD: Only update coordinate mapping if grid is fully initialized
        const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
        if (!isFullyInitialized) {
          fileLog.debug('⏸️ COORDINATE: Skipping coordinate mapping update during initialization');
          return;
        }

        // CRITICAL: OverlayManager still needs coordinate mapping for positioning overlays
        this.overlayManager?.updateCoordinateMapping(mapping);
        fileLog.debug('🔄 Coordinate mapping updated for overlays', {
          rowCount: mapping.rows.length,
          columnCount: mapping.columns.length,
          version: mapping.version
        });
      }
    });
    
    fileLog.info('✅ Header Renderer initialized');
  }
  
  /**
   * Post-initialization setup after all managers are created
   */
  private postInitialization(): void {
    fileLog.info('🚀 Starting post-initialization');

    // Phase 1: Quick synchronous operations that don't cause reflows
    // Initialize hybrid coordinate system position tracking (mostly calculations)
    this.initializePositionTracking();

    // Phase 2: Defer DOM measurements and controller initialization
    requestAnimationFrame(() => {
      // Now safe to measure DOM
      const bounds = this.container.getBoundingClientRect();
      this.visualState.visualOperations.updateViewportDimensions(bounds.width, bounds.height);

      // Initialize enhanced ScrollController with comprehensive event handling
      this.scrollController = new ScrollController({
        viewport: this.viewport!,
        headerViewport: this.headerViewport,
        container: this.container,
        onClickOutside: () => {
          // Delegate to interaction state with proper editing logic
          this.tableInteraction$.handleOutsideClick();
        },
        onScroll: (scrollLeft: number, scrollTop: number) => {
          // Use the UNIFIED visual operations instead of legacy tableViewport$
          this.visualState.visualOperations.handleViewportScroll(scrollLeft, scrollTop, 'body');

          // DEBUGGING: Log detailed width calculations during scroll
          const visualState = this.visualState.visualState$.get(true);
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
        scrollController: this.scrollController,
        selectionController: this.selectionController,
        tableInteraction$: this.tableInteraction$,
        visualState: this.visualState
      });

      // Configure ColumnWidthManager with DOM containers
      if (this.columnWidthManager) {
        this.columnWidthManager.setContainers({
          headerContainer: this.headerContainer,
          bodyContainer: this.bodyContainer,
          headerViewport: this.headerViewport
        });
      }

      // Mark controller dependencies as ready
      this.initManager.markReady('mouseControllerReady');
      this.initManager.markReady('scrollControllerReady');
      this.initManager.markReady('viewportReady');
      this.initManager.markReady('positionTrackingReady');

      // Phase 3: Defer overlay and event setup
      requestAnimationFrame(() => {
        // Initialize overlay now that DOM is ready
        if (this.overlayManager) {
          this.overlayManager.initializeOverlay();
        }

        // Setup event handling via EventManager
        if (this.eventManager) {
          this.eventManager.setOverlayManager(this.overlayManager!);
          this.eventManager.setupEventHandling();
        }

        // Mark remaining dependencies as ready
        this.initManager.markReady('overlaySystemReady');
        this.initManager.markReady('eventHandlersReady');

        // Phase 4: Defer header render
        requestAnimationFrame(() => {
          // Render header first (lighter operation)
          batch(() => {
            this.renderHeader();
          });

          // Phase 5: Defer body render to next frame
          requestAnimationFrame(() => {
            // Render body and capture ranges in batch
            batch(() => {
              this.renderBody();

              // Capture initial visible ranges after body render
              this.lastVisibleColumns = this.visualState.visualState$.geometry.visibleColumnRange.get();
              this.lastVisibleRows = this.visualState.visualState$.geometry.visibleRowRange.get();
            });

            // Mark renderer as initialized after body render completes
            this.initManager.markReady('rendererInitialized');

            fileLog.info('✅ Renderer marked as initialized after initial render');

            // Enable observers after initialization is complete
            this.observersEnabled = true;
            fileLog.info('🔄 OBSERVERS ENABLED after initialization', {
              observersEnabled: this.observersEnabled,
              timestamp: Date.now(),
              visualObserverExists: !!this.visualObserverDisposer
            });

            fileLog.info('✅ Post-initialization complete');
          });
        });
      });
    });
  }

  /**
   * Initialize hybrid coordinate system position tracking
   */
  private initializePositionTracking(): void {
    fileLog.info('🎯 Initializing hybrid position tracking system');

    // Initialize DOM position tracking
    positionTracker.initialize(this.container);

    // Initialize virtual bounds with current data
    const columns = this.tableCore$.columns.get();
    const columnWidths = columns.map(col => col.width || GRID_DIMENSIONS.DEFAULT_COLUMN_WIDTH);
    const totalRows = this.tableCore$.processedRows.get().length;

    updateVirtualBounds({
      totalRows,
      columnWidths,
      rowHeight: GRID_DIMENSIONS.ROW_HEIGHT
    });

    // Initialize virtual viewport
    const bounds = this.container.getBoundingClientRect();
    updateVirtualViewport({
      viewportWidth: bounds.width,
      viewportHeight: bounds.height,
      scrollTop: 0,
      scrollLeft: 0
    });

    fileLog.info('✅ Hybrid position tracking initialized', {
      totalRows,
      columnCount: columns.length,
      viewportSize: `${bounds.width}x${bounds.height}`
    });
  }

  /**
   * Check if virtual range changed and trigger re-render if needed
   * This runs outside the reactive context to avoid observer cascades
   */
  private checkVirtualRangeChange(): void {
    // Skip during initialization to prevent multiple renders
    // Check rendererInitialized specifically to ensure we're completely done
    if (!this.initManager.hydrationState$.rendererInitialized.get(true)) {
      return;
    }

    // Get current visual state outside of observer context
    const visualState = this.visualState.visualState$.get(true);
    const currentColumnRange = visualState.geometry.visibleColumnRange;
    const currentRowRange = visualState.geometry.visibleRowRange;

    // Check if visible column range changed (horizontal virtual scrolling)
    const previousColumnRange = this.lastVisibleColumns || { start: -1, end: -1 };
    const columnRangeChanged =
      currentColumnRange.start !== previousColumnRange.start ||
      currentColumnRange.end !== previousColumnRange.end;

    // Check if visible row range changed (vertical virtual scrolling)
    const previousRowRange = this.lastVisibleRows || { start: -1, end: -1 };
    const rowRangeChanged =
      currentRowRange.start !== previousRowRange.start ||
      currentRowRange.end !== previousRowRange.end;

    // Re-render body if virtual ranges changed (heavy operation)
    if (columnRangeChanged || rowRangeChanged) {
      fileLog.info('🔄 Virtual range changed - triggering body re-render', {
        columnRangeChanged,
        rowRangeChanged,
        oldColumnRange: `${previousColumnRange.start}-${previousColumnRange.end}`,
        newColumnRange: `${currentColumnRange.start}-${currentColumnRange.end}`,
        oldRowRange: `${previousRowRange.start}-${previousRowRange.end}`,
        newRowRange: `${currentRowRange.start}-${currentRowRange.end}`
      });

      // Update tracking
      this.lastVisibleColumns = currentColumnRange;
      this.lastVisibleRows = currentRowRange;

      // Trigger body re-render with new virtual columns
      this.renderBody();
    }
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

    // GUARD: Only render if grid is fully initialized OR if this is the initial render call
    const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
    const rendererInitialized = this.initManager.hydrationState$.rendererInitialized.get(true);

    // Allow initial render before renderer is marked as initialized
    if (!isFullyInitialized && rendererInitialized) {
      fileLog.debug('⏸️ RENDER_BODY: Skipping render during initialization');
      return;
    }

    // CRITICAL FIX: Use sorted processed rows from visual state, not raw unsorted data
    const rows = this.sortedProcessedRows$ ? this.sortedProcessedRows$.get(true) : this.tableCore$.processedRows.get(true);
    const columns = this.tableCore$.columns.get(true);
    const columnVisibility = this.visualState.visualInputs$.columnVisibility.get(true);

    // Debug: Check if we have group rows (Legend State rows don't have type property)
    const groupRows = rows.filter((row: any) => row.type === 'group');
    const dataRows = rows.filter((row: any) => !row.type || row.type !== 'group'); // All non-group rows are data

    // TEMP DEBUG: Add stack trace back to identify remaining multiple render sources
    const stack = new Error().stack?.split('\n').slice(1, 4).join('\n') || 'No stack available';

    fileLog.info('🎨 Rendering body with Phase 2 managers', {
      rowCount: rows.length,
      columnCount: columns.length,
      groupRows: groupRows.length,
      dataRows: dataRows.length,
      usingSortedData: !!this.sortedProcessedRows$,
      firstRowTitle: rows[0]?.title,
      callStack: stack
    });

    this.bodyContainer.innerHTML = '';
    
    // Clear active rows in RowRenderer
    this.bodyRenderer.clearActiveRows();
    
    // Update content dimensions in visual state
    const totalHeight = rows.length * 40; // ROW_HEIGHT
    this.visualState.visualOperations.setRowCount(rows.length);

    // Update row coordinate mapping
    this.coordinateMapping.rows = [];

    // Virtual scrolling: Only render visible rows - use visual observables
    const visualState = this.visualState.visualState$.get(true);

    // CRITICAL FIX: Set body container width to enable proper horizontal scrolling
    // The body container must be wide enough to accommodate all content
    if (this.bodyContainer) {
      this.bodyContainer.style.width = `${visualState.geometry.totalWidth}px`;
      this.bodyContainer.style.minWidth = `${visualState.geometry.totalWidth}px`;
    }
    const visibleRange = visualState.geometry.visibleRowRange;
    const startIndex = Math.max(0, visibleRange.start);
    const endIndex = Math.min(rows.length, visibleRange.end);
    const visibleRows = rows.slice(startIndex, endIndex);
    
    fileLog.debug('🎨 Body rendering ALL columns (no virtualization) - matches HeaderRenderer', {
      totalRows: rows.length,
      visibleRange: `${startIndex}-${endIndex}`,
      rendering: visibleRows.length,
      totalColumns: visualState.visibleColumns.length
    });
    
    // Get ALL visible columns from unified visual state (same as HeaderRenderer - no virtualization)
    // This ensures header and body are always in sync after column reordering
    const allVisibleColumnLayouts = visualState.visibleColumns;

    // Calculate base offset including drag column width for grouped mode
    const baseOffset = this.calculateBaseOffset();

    // Always start from base offset when rendering all columns (matches HeaderRenderer)
    const startX = baseOffset;

    // Convert column layouts back to columns for compatibility with existing renderer
    // Use ALL visible columns like HeaderRenderer to maintain sync after column reorder
    const virtualColumns = allVisibleColumnLayouts.map(layout =>
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

      // GUARD: Only update coordinate mapping if grid is fully initialized
      const isFullyInitialized = this.initManager.isFullyHydrated$.get(true);
      if (!isFullyInitialized) {
        fileLog.debug('⏸️ COORDINATE: Skipping coordinate mapping update during initialization (renderBody)');
        return;
      }

      // CRITICAL: OverlayManager still needs coordinate mapping for positioning overlays
      this.overlayManager?.updateCoordinateMapping(this.coordinateMapping);
    }

    // Schedule DOM position tracker update in next frame to avoid forced reflow
    // This prevents measuring DOM immediately after modifying it
    // Only force update if initialization is complete
    if (this.initManager.isFullyHydrated$.get(true)) {
      requestAnimationFrame(() => {
        positionTracker.forceUpdate();
      });
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
      // Add scroll thresholds to prevent excessive re-renders on small scroll changes
      const scrollThreshold = 20; // Only re-render if scroll changes by more than 20px
      const scrollTopChanged = !previousState ||
        Math.abs(previousState.viewport.scrollTop - visualState.viewport.scrollTop) > scrollThreshold;
      const scrollLeftChanged = !previousState ||
        Math.abs(previousState.viewport.scrollLeft - visualState.viewport.scrollLeft) > scrollThreshold;

      const needsBodyRender = !previousState ||
        scrollTopChanged ||
        scrollLeftChanged ||
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
   * SIMPLIFIED: Virtual scrolling updates now handled by focused scroll observer
   */
  private handleViewportChange(): void {
    // Update overlay selection with current viewport position (lightweight)
    if (this.overlayManager) {
      // Selection overlay is now handled reactively by OverlayManager via interactions observable
      // Viewport changes are handled automatically by the hybrid coordinate system
    }

    fileLog.debug('⏭️ Viewport change - virtual scrolling handled by scroll observer');
  }

  // ====================================
  // UTILITY METHODS
  // ====================================

  /**
   * Calculate rectangular selection range including all interior cells
   */
  private calculateRectangularSelection(startCell: string, endCell: string): string[] {
    const [startRowId, startColId] = startCell.split(':');
    const [endRowId, endColId] = endCell.split(':');

    // Get current data and columns for range calculation
    const processedRows = this.tableCore$.processedRows.get();
    const columns = this.tableCore$.columns.get();
    const columnVisibility = this.visualState.visualInputs$.columnVisibility.get();
    const visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);

    // Find row and column indices
    const startRowIndex = processedRows.findIndex((row: any) => row.id === startRowId);
    const endRowIndex = processedRows.findIndex((row: any) => row.id === endRowId);
    const startColIndex = visibleColumns.findIndex(col => col.id === startColId);
    const endColIndex = visibleColumns.findIndex(col => col.id === endColId);

    if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
      // Fallback to just the two cells if indices not found
      return [startCell, endCell];
    }

    // Ensure proper ordering (top-left to bottom-right)
    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    // Generate all cells in the rectangular range
    const selectedCells: string[] = [];
    for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
      for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
        const row = processedRows[rowIndex];
        const column = visibleColumns[colIndex];
        if (row && column) {
          selectedCells.push(`${row.id}:${column.id}`);
        }
      }
    }

    fileLog.debug('🔢 Calculated rectangular selection', {
      startCell,
      endCell,
      rowRange: `${minRowIndex}-${maxRowIndex}`,
      colRange: `${minColIndex}-${maxColIndex}`,
      totalCells: selectedCells.length
    });

    return selectedCells;
  }

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
      const groupConfig = this.visualState.visualOperations.getGroupConfig();
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

    // Cancel any pending RAF
    if (this.pendingRAF !== null) {
      cancelAnimationFrame(this.pendingRAF);
      this.pendingRAF = null;
    }

    // Clean up focused observers
    if (this.dataObserverDisposer) {
      this.dataObserverDisposer();
      this.dataObserverDisposer = null;
    }
    if (this.visualObserverDisposer) {
      this.visualObserverDisposer();
      this.visualObserverDisposer = null;
    }
    if (this.columnVisibilityObserverDisposer) {
      this.columnVisibilityObserverDisposer();
      this.columnVisibilityObserverDisposer = null;
    }
    if (this.columnOrderObserverDisposer) {
      this.columnOrderObserverDisposer();
      this.columnOrderObserverDisposer = null;
    }
    if (this.columnWidthsObserverDisposer) {
      this.columnWidthsObserverDisposer();
      this.columnWidthsObserverDisposer = null;
    }
    if (this.interactionObserverDisposer) {
      this.interactionObserverDisposer();
      this.interactionObserverDisposer = null;
    }
    if (this.scrollObserverDisposer) {
      this.scrollObserverDisposer();
      this.scrollObserverDisposer = null;
    }
    if (this.dragSelectionObserverDisposer) {
      this.dragSelectionObserverDisposer();
      this.dragSelectionObserverDisposer = null;
    }
    
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

    // Clean up HeaderRenderer reactive observers
    if (this.headerRenderer) {
      this.headerRenderer.dispose();
      this.headerRenderer = null;
    }

    // RowRenderer and CellRenderer don't need explicit cleanup
    this.bodyRenderer = null;
    
    // Clean up legacy disposers (if any remain)
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    
    // Clean up hybrid position tracking
    positionTracker.cleanup();

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