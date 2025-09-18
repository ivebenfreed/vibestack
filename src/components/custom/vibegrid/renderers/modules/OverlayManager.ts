/**
 * OverlayManager - Centralized management of all overlay components for VibeGrid
 * Handles canvas overlay, selection manager, editing overlay, and context menu
 */

import { log } from '@/logger';
import { observe, batch } from '@legendapp/state';
import { CanvasOverlayDOM } from '../../overlays/CanvasOverlayDOM';
import { EditingOverlay } from '../../overlays/EditingOverlay';
import { ContextMenuManager } from '../../components/ContextMenu';
// SelectionManager functionality consolidated into interaction-state
import type { TableCore$ } from '../../stores/data-state';
import type { TableInteraction$ } from '../../stores/interaction-state';
import type { ViewportInfo } from '../../types';
import type { VisualCellPosition } from '../../overlays/OverlayTypes';

// New hybrid coordinate system imports
import { PositionEvents, domPositions$, positionTracker } from '../../stores/dom-position-state';
import { virtualCellPosition$ } from '../../virtualization/VirtualScrollManager';
import { GRID_DIMENSIONS } from '../../constants/grid-dimensions';
import type { CoordinateMapping } from '../../coordinates/VibeGridXCoordinateManager';

const fileLog = log('components/custom/vibegrid/renderers/modules/OverlayManager.ts');

// Use centralized dimensions from the new system
const ROW_HEIGHT = GRID_DIMENSIONS.ROW_HEIGHT;
const HEADER_HEIGHT = GRID_DIMENSIONS.HEADER_HEIGHT;

export interface OverlayManagerOptions {
  container: HTMLElement;
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  enableSelectionColumn?: boolean;
  headerContainer?: HTMLElement | null;
  bodyContainer?: HTMLElement | null;
  getProcessedRows: () => any[];
}


export class OverlayManager {
  private container: HTMLElement;
  private tableCore$: TableCore$;
  private tableInteraction$: TableInteraction$;
  private enableSelectionColumn: boolean;
  private headerContainer: HTMLElement | null;
  private bodyContainer: HTMLElement | null;
  private getProcessedRows: () => any[];
  
  // Overlay instances
  private canvasOverlay: CanvasOverlayDOM | null = null;
  // Selection now managed through tableInteraction$ observable
  private editingOverlay: EditingOverlay | null = null;
  private contextMenu: ContextMenuManager | null = null;
  
  // Performance optimization caches
  private lastSelectionString: string = ''; // More reliable deduplication
  private updateSelectionRAF: number | null = null;
  private lastCoordinateMappingVersion: number = -1;
  
  constructor(options: OverlayManagerOptions) {
    this.container = options.container;
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.enableSelectionColumn = options.enableSelectionColumn ?? false;
    this.headerContainer = options.headerContainer || null;
    this.bodyContainer = options.bodyContainer || null;
    this.getProcessedRows = options.getProcessedRows;

    this.initOverlays();
    this.setupEditingObserver();
  }
  
  /**
   * Initialize all overlay components
   */
  private initOverlays(): void {
    fileLog.info('🎨 Initializing overlay system');
    
    // Create canvas overlay
    this.canvasOverlay = new CanvasOverlayDOM(
      {
        selectionColor: 'rgba(59, 130, 246, 0.1)',
        selectionBorderColor: 'rgb(59, 130, 246)',
        selectionBorderWidth: 2,
        cellHeight: ROW_HEIGHT,
        cellWidth: 150 // Default width, updated by coordinate mapping
      },
      (event) => {
        fileLog.info('📋 Canvas overlay event:', event);
        // Handle fill events from the overlay system
      }
    );
    
    // Canvas overlay will be initialized in initializeOverlay() method
    // after DOM is ready
    
    // Selection is now managed through tableInteraction$ observable
    // Visual updates can be done via tableInteraction$.updateCellSelectionVisuals()
    
    // Create editing overlay
    this.editingOverlay = new EditingOverlay(this.container, {
      tableInteraction$: this.tableInteraction$,
      onCommit: async (value) => {
        await this.tableInteraction$.saveEdit(value);
      },
      onCancel: () => {
        this.tableInteraction$.cancelEdit();
      },
      relationshipContext: {
        relationshipResolvers: {}
      },
      getRowData: (rowId: string) => {
        const processedRows = this.getProcessedRows();
        return processedRows.find((row: any) => row.id === rowId) || null;
      }
    });
    
    // Create context menu
    this.contextMenu = new ContextMenuManager(this.container);

    // Link to existing interactions observable instead of setting up separate observer
    this.linkToInteractionsObservable();

    fileLog.info('✅ Overlay system initialized');
  }
  
  /**
   * Link to existing interactions observable instead of creating separate observer
   * This directly uses the interaction state that's already being managed
   */
  private linkToInteractionsObservable(): void {
    // Observe selection state changes and reactively update selection overlay
    observe(() => {
      const selectedCells = this.tableInteraction$.selectedCells.get(true);
      const focusedCell = this.tableInteraction$.focusedCell.get(true);
      const hoveredCell = this.tableInteraction$.hoveredCell.get(true);

      // IMPROVED DEDUPLICATION: Use string comparison for reliable equality check
      const selectionString = Array.from(selectedCells).sort().join(',');

      if (this.lastSelectionString === selectionString) {
        fileLog.debug('🔍 REACTIVE: Selection unchanged, skipping update', {
          selectedCells: Array.from(selectedCells)
        });
        return;
      }

      // Update cached selection string for deduplication
      this.lastSelectionString = selectionString;

      fileLog.debug('🔍 REACTIVE: Selection state changed', {
        selectedCells: Array.from(selectedCells),
        focusedCell,
        hoveredCell
      });

      // BATCH: Use requestAnimationFrame for DOM updates to batch with browser paint
      if (this.updateSelectionRAF !== null) {
        cancelAnimationFrame(this.updateSelectionRAF);
      }

      this.updateSelectionRAF = requestAnimationFrame(() => {
        this.updateSelectionRAF = null;

        // Update selection overlay when selection changes
        if (selectedCells.size > 0) {
          this.performCanvasSelectionUpdate(selectedCells);
        } else {
          // Clear selection overlay when no cells selected
          if (this.canvasOverlay) {
            this.canvasOverlay.updateSelectionWithVisualPositions([]);
            this.canvasOverlay.hideFillHandle();
          }
        }
      });
    });

    // Observe editing state changes and reactively show/hide overlay
    observe(() => {
      const editingCell = this.tableInteraction$.editingCell.get(true);
      const editValue = this.tableInteraction$.editValue.get(true);
      const isEditing = this.tableInteraction$.isEditing.get(true);

      fileLog.debug('🔍 REACTIVE: Linked to interactions observable', {
        editingCell,
        editValue,
        isEditing,
        hasOverlay: !!this.editingOverlay
      });

      if (isEditing && editingCell && this.editingOverlay) {
        // Show editing overlay
        const [rowId, columnId] = editingCell.split(':');
        const columns = this.tableCore$.columns.get(true);
        const column = columns.find((c: any) => c.id === columnId);

        if (column) {
          const position = this.getCellPosition(rowId, columnId);
          if (position) {
            const cell = { rowId, columnId };
            const actualValue = editValue !== undefined ? editValue : this.getCellValue(rowId, columnId);

            fileLog.info('🔍 REACTIVE: Showing editing overlay via interactions link', {
              cellId: editingCell,
              position,
              value: actualValue
            });

            this.editingOverlay.showAt(position, cell, column, actualValue);
          }
        }
      } else if (!isEditing && this.editingOverlay) {
        // Hide editing overlay
        fileLog.info('🔍 REACTIVE: Hiding editing overlay via interactions link');
        this.editingOverlay.hide();
      }
    });

    fileLog.info('✅ Linked to interactions observable for both selection and editing overlay positioning');
  }

  
  /**
   * Initialize the canvas overlay in the proper container
   * Call this after DOM is ready
   */
  initializeOverlay(): void {
    if (!this.canvasOverlay || this.canvasOverlay.isInitialized) {
      return;
    }

    // Use viewport container (the scrolling container) for the overlay
    // This ensures the overlay scrolls with the content
    const targetContainer = this.container.querySelector('.vibegridx-viewport') as HTMLElement || this.container;

    if (!targetContainer) {
      fileLog.error('❌ No target container found for overlay initialization');
      return;
    }

    try {
      this.canvasOverlay.init(targetContainer);
      fileLog.info('🎨 Canvas overlay initialized in viewport container');

      // Initialize DOM position tracking now that overlay is ready
      this.initializeDOMPositionTracking();
    } catch (error) {
      fileLog.error('❌ Failed to initialize canvas overlay', error);
    }
  }

  /**
   * Initialize DOM position tracking after overlay is ready
   */
  private initializeDOMPositionTracking(): void {
    try {
      positionTracker.initialize(this.container);
      fileLog.info('✅ DOM position tracking initialized');
    } catch (error) {
      fileLog.error('❌ Failed to initialize DOM position tracking', error);
    }
  }
  
  /**
   * Update selection display (optimized with change detection and throttling)
   */
  updateSelection(selectedCells: Set<string>): void {
    fileLog.debug('🔄 OverlayManager.updateSelection called', {
      selectedCells: Array.from(selectedCells),
      cellCount: selectedCells.size
    });

    // BATCH: Use Legend State batch to prevent multiple reactive triggers
    batch(() => {
      // Update selection visuals using interaction-state
      this.tableInteraction$.selectedCells.set(selectedCells);
    });

    fileLog.debug('🎯 Updating overlay for selection', {
      selectedCells: Array.from(selectedCells)
    });

    // Cancel any pending updates and run immediately
    if (this.updateSelectionRAF !== null) {
      cancelAnimationFrame(this.updateSelectionRAF);
      this.updateSelectionRAF = null;
    }

    // Update overlay directly without RAF throttling for better responsiveness
    this.performCanvasSelectionUpdate(selectedCells);
  }

  /**
   * Perform the actual canvas selection update (separated for throttling)
   */
  private performCanvasSelectionUpdate(selectedCells: Set<string>): void {
    if (this.canvasOverlay && this.canvasOverlay.isInitialized) {
      // Convert selected cells to visual positions
      const visualCells = this.getVisualCellPositions(selectedCells);

      // Update viewport info
      const viewportInfo = this.getViewportInfo();

      this.canvasOverlay.updateViewport(viewportInfo);
      this.canvasOverlay.updateSelectionWithVisualPositions(visualCells);

      // Show/hide fill handle based on selection
      if (visualCells.length > 0) {
        this.canvasOverlay.renderFillHandle(visualCells, undefined, viewportInfo);
      } else {
        this.canvasOverlay.hideFillHandle();
      }
    }
  }

  /**
   * Compare two Sets for equality (optimized for performance)
   */
  private areSetsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }
  
  /**
   * REACTIVE: Setup editing overlay observer
   */
  private setupEditingObserver(): void {
    let lastShownCell: string | null = null;
    let observerCallCount = 0;
    let pendingUpdate: number | null = null;

    observe(() => {
      // Safety check for observable availability
      if (!this.tableInteraction$) {
        return;
      }

      // Read all values in a single batch to minimize reactive triggers
      let state;
      try {
        state = batch(() => ({
          editingCell: this.tableInteraction$.editingCell.get(true),
          editValue: this.tableInteraction$.editValue.get(true),
          isEditing: this.tableInteraction$.isEditing.get(true)
        }));
      } catch (error) {
        fileLog.debug('🔍 REACTIVE: Error reading state, likely during unmount', error);
        return;
      }

      if (!state) {
        return;
      }

      observerCallCount++;

      // Cancel any pending update
      if (pendingUpdate !== null) {
        cancelAnimationFrame(pendingUpdate);
        pendingUpdate = null;
      }

      fileLog.debug('🔍 REACTIVE: Editing observer triggered', {
        editingCell: state.editingCell,
        isEditing: state.isEditing,
        editValue: state.editValue,
        lastShownCell,
        hasOverlay: !!this.editingOverlay,
        callCount: observerCallCount
      });

      // Debounce updates using requestAnimationFrame to batch within same frame
      // Capture state in closure for RAF callback
      const capturedState = state;
      const capturedOverlay = this.editingOverlay;

      pendingUpdate = requestAnimationFrame(() => {
        pendingUpdate = null;

      // Safety check - RAF might execute after component unmount
      if (!capturedState || !capturedOverlay) {
        return;
      }

      if (capturedState.isEditing && capturedState.editingCell && capturedOverlay) {
        // Only update overlay if the cell has actually changed
        if (lastShownCell !== capturedState.editingCell) {
          const [rowId, columnId] = capturedState.editingCell.split(':');
          const columns = this.tableCore$.columns.get(true);
          const column = columns.find((c: any) => c.id === columnId);

          if (column) {
            const position = this.getCellPosition(rowId, columnId);
            if (position) {
              const cell = { rowId, columnId };
              // ALWAYS use the current cell value, ignore reactive editValue for initial display
              const actualValue = this.getCellValue(rowId, columnId);

              console.log('🔍 REACTIVE OBSERVER: About to call showAt', {
                editingCell: capturedState.editingCell,
                rowId,
                columnId,
                freshValue: actualValue,
                ignoredReactiveValue: capturedState.editValue,
                isLastShownCell: lastShownCell,
                willCallShowAt: true
              });

              fileLog.debug('📝 REACTIVE: Getting fresh cell value', {
                editingCell: capturedState.editingCell,
                rowId,
                columnId,
                freshValue: actualValue,
                ignoredReactiveValue: capturedState.editValue
              });

              // Hide previous overlay if different cell
              if (lastShownCell && lastShownCell !== capturedState.editingCell) {
                capturedOverlay.hide();
                fileLog.debug('📝 REACTIVE: Hidden previous overlay for different cell', {
                  from: lastShownCell,
                  to: capturedState.editingCell
                });
              }

              console.log('🔍 FINAL DEBUG: Calling showAt with exact values', {
                cellId: `${rowId}:${columnId}`,
                passedValue: actualValue,
                valuePreview: typeof actualValue === 'string' ? actualValue.substring(0, 50) + '...' : actualValue
              });

              capturedOverlay.showAt(position, cell, column, actualValue);

              fileLog.info('📝 REACTIVE: Editing overlay shown', {
                editingCell: capturedState.editingCell,
                editValue: actualValue,
                isEditing: capturedState.isEditing,
                transitionFrom: lastShownCell ? 'different-cell' : 'new-edit'
              });

              lastShownCell = capturedState.editingCell;
            }
          }
        } else {
          fileLog.debug('📝 REACTIVE: Skipping overlay update - same cell', { editingCell: capturedState.editingCell });
        }
      } else if (capturedOverlay) {
        // Clear state when editing stops
        if (lastShownCell !== null) {
          capturedOverlay.hide();
          lastShownCell = null;
          fileLog.info('📝 REACTIVE: Editing overlay hidden', {
            isEditing: capturedState.isEditing,
            editingCell: capturedState.editingCell,
            wasShowing: lastShownCell
          });
        }
      }
      });  // End of requestAnimationFrame callback
    });
  }

  // NOTE: updateEditingOverlay method removed - editing overlays now handled reactively via interactions observable
  
  /**
   * Get current cell value from data
   */
  private getCellValue(rowId: string, columnId: string): any {
    const processedRows = this.tableCore$.processedRows.get();

    // Debug the full data structure
    console.log('🔍 getCellValue DETAILED DEBUG:', {
      targetRowId: rowId,
      targetColumnId: columnId,
      totalRows: processedRows?.length || 0,
      firstFewRowIds: processedRows?.slice(0, 3).map((r: any) => r.id) || [],
      allRowIds: processedRows?.map((r: any) => r.id) || [],
      sampleRowStructure: processedRows?.[0] ? Object.keys(processedRows[0]).slice(0, 8) : 'no rows'
    });

    const row = processedRows.find((r: any) => r.id === rowId);

    if (!row) {
      console.log('❌ getCellValue: Row NOT found!', {
        targetRowId: rowId,
        availableRowIds: processedRows?.map((r: any) => r.id) || []
      });
      return '';
    }

    const value = row[columnId];

    console.log('✅ getCellValue: Row found, extracting value', {
      targetRowId: rowId,
      foundRowId: row.id,
      targetColumnId: columnId,
      extractedValue: value,
      rowKeys: Object.keys(row).slice(0, 8),
      hasTargetColumn: columnId in row
    });

    fileLog.info('📄 Getting cell value for editing', {
      rowId,
      columnId,
      foundRow: !!row,
      cellValue: value,
      rowKeys: row ? Object.keys(row).slice(0, 5) : []
    });

    return value;
  }

  /**
   * Update column resize preview
   */
  updateColumnResizePreview(resizeState: any): void {
    // Ensure overlay is initialized
    if (!this.canvasOverlay?.isInitialized) {
      this.initializeOverlay();
    }
    
    if (this.canvasOverlay && this.canvasOverlay.isInitialized) {
      this.canvasOverlay.updateColumnResizePreview(resizeState);
    }
  }
  
  /**
   * Update column drag preview
   */
  updateColumnDragPreview(dragState: any): void {
    if (this.canvasOverlay) {
      const viewportInfo = this.getViewportInfo();
      if (dragState) {
        this.canvasOverlay.updateDragPreview(dragState, viewportInfo);
      } else {
        this.canvasOverlay.updateDragPreview(null, null);
      }
    }
  }
  
  /**
   * Show context menu
   */
  showContextMenu(options: {
    x: number;
    y: number;
    rowId: string;
    columnId: string;
    items: Array<{
      label: string;
      icon?: string;
      action: () => void;
    }>;
  }): void {
    if (this.contextMenu) {
      this.contextMenu.show(options);
    }
  }
  
  /**
   * Hide context menu
   */
  hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.hide();
    }
  }
  
  /**
   * Get visual cell positions from selected cells using hybrid coordinate system
   */
  private getVisualCellPositions(selectedCells: Set<string>): VisualCellPosition[] {
    const visualPositions: VisualCellPosition[] = [];

    // GET COMPREHENSIVE DIAGNOSTIC DATA
    const scrollContainer = this.bodyContainer || this.container.querySelector('.vibegridx-body-container') as HTMLElement || this.container;
    const currentScrollLeft = scrollContainer.scrollLeft || 0;
    const currentScrollTop = scrollContainer.scrollTop || 0;
    const viewportWidth = scrollContainer.clientWidth || 0;
    const columns = this.tableCore$.columns.get(true);

    fileLog.debug('🎨 DIAGNOSTIC: Getting visual cell positions with full context', {
      selectedCount: selectedCells.size,
      currentScrollLeft,
      currentScrollTop,
      viewportWidth,
      totalColumns: columns.length,
      scrollContainer: {
        className: scrollContainer.className,
        scrollWidth: scrollContainer.scrollWidth,
        clientWidth: scrollContainer.clientWidth
      }
    });

    selectedCells.forEach(cellId => {
      fileLog.debug('🔍 DIAGNOSTIC: Processing cellId in getVisualCellPositions', {
        cellId,
        cellIdType: typeof cellId,
        cellIdValue: cellId
      });

      const [rowId, columnId] = cellId.split(':');

      // GET COLUMN INFORMATION
      const column = columns.find((c: any) => c.id === columnId);
      const columnIndex = columns.findIndex((c: any) => c.id === columnId);

      fileLog.debug('🔍 DIAGNOSTIC: Column analysis', {
        rowId,
        columnId,
        rowIdType: typeof rowId,
        columnIdType: typeof columnId,
        columnIndex,
        columnExists: !!column,
        columnData: column ? {
          id: column.id,
          title: column.title,
          width: column.width,
          type: column.type
        } : null
      });

      // Calculate expected column X position based on column widths
      let expectedColumnX = 0;
      for (let i = 0; i < columnIndex; i++) {
        const prevColumn = columns[i];
        expectedColumnX += (prevColumn.width || 150); // Use column width or default
      }

      // CRITICAL FIX: Account for scroll position in expected calculation
      const expectedColumnXScrollAdjusted = expectedColumnX - currentScrollLeft;

      fileLog.debug('🔍 DIAGNOSTIC: Expected column position calculation with scroll adjustment', {
        columnId,
        columnIndex,
        expectedColumnX, // Absolute position in full table
        expectedColumnXScrollAdjusted, // Position relative to current viewport
        currentScrollLeft,
        scrollAdjustment: currentScrollLeft,
        currentColumnWidth: column?.width || 150,
        calculationBreakdown: columns.slice(0, columnIndex).map((c: any, i: number) => ({
          index: i,
          id: c.id,
          width: c.width || 150
        }))
      });

      // Use the hybrid getCellPosition method
      const position = this.getCellPosition(rowId, columnId);

      if (position) {
        const visualPos: VisualCellPosition = {
          cellKey: cellId,
          x: position.x,
          y: position.y,
          width: position.width,
          height: position.height
        };
        visualPositions.push(visualPos);

        // CRITICAL DIAGNOSTIC: Compare expected vs actual position using scroll-adjusted expected value
        const positionDiscrepancy = Math.abs(position.x - expectedColumnXScrollAdjusted);
        const isPositionAccurate = positionDiscrepancy < 5; // Allow 5px tolerance

        fileLog.debug('🎯 DIAGNOSTIC: Position analysis for selection overlay', {
          requestedCell: cellId,
          columnId,
          columnIndex,
          actualPosition: { x: position.x, y: position.y, width: position.width, height: position.height },
          expectedColumnX, // Absolute position
          expectedColumnXScrollAdjusted, // Scroll-adjusted position
          positionDiscrepancy, // Now using scroll-adjusted comparison
          isPositionAccurate,
          positionAnalysis: {
            expectedAbsolute: expectedColumnX,
            expectedViewportRelative: expectedColumnXScrollAdjusted,
            actualViewportRelative: position.x,
            discrepancyFromScrollAdjusted: positionDiscrepancy,
            discrepancyFromAbsolute: Math.abs(position.x - expectedColumnX)
          },
          context: {
            scrollLeft: currentScrollLeft,
            viewportWidth,
            isLastColumn: columnIndex === columns.length - 1,
            isScrolledRight: currentScrollLeft > 0
          }
        });
      } else {
        fileLog.warn('❌ DIAGNOSTIC: Could not find position for cell via hybrid system', {
          cellId,
          rowId,
          columnId,
          expectedColumnX,
          expectedColumnXScrollAdjusted,
          columnIndex,
          scrollContext: {
            scrollLeft: currentScrollLeft,
            viewportWidth,
            scrollWidth: scrollContainer.scrollWidth
          }
        });
      }
    });

    fileLog.info('✅ Visual positions calculated via hybrid system', {
      inputCells: selectedCells.size,
      outputPositions: visualPositions.length
    });

    return visualPositions;
  }
  
  /**
   * Get cell position for editing overlay
   */
  private getCellPosition(rowId: string, columnId: string): { x: number; y: number; width: number; height: number } | null {
    const scrollContainer = this.bodyContainer || this.container.querySelector('.vibegridx-body-container') as HTMLElement || this.container;
    const currentScrollLeft = scrollContainer.scrollLeft || 0;

    fileLog.debug('🎯 DIAGNOSTIC: getCellPosition called with full context', {
      rowId,
      columnId,
      rowIdType: typeof rowId,
      columnIdType: typeof columnId,
      rowIdValue: rowId,
      columnIdValue: columnId,
      currentScrollLeft,
      scrollContainerClass: scrollContainer.className
    });

    const cellKey = `${rowId}:${columnId}`;

    fileLog.debug('🎯 DIAGNOSTIC: Getting cell position with scroll context', {
      cellKey,
      rowId,
      columnId,
      scrollLeft: currentScrollLeft
    });

    // Try DOM position first (highest accuracy)
    const domPositions = domPositions$.cellPositions.get();
    const domPosition = domPositions.get(cellKey);

    fileLog.debug('🎯 HYBRID: DOM position check', {
      cellKey,
      hasDomPosition: !!domPosition,
      isVisible: domPosition?.isVisible,
      domPosition: domPosition ? { x: domPosition.x, y: domPosition.y, width: domPosition.width, height: domPosition.height } : null
    });

    if (domPosition && domPosition.isVisible) {
      fileLog.info('✅ Using DOM position', {
        cellKey,
        position: { x: domPosition.x, y: domPosition.y, width: domPosition.width, height: domPosition.height },
        source: 'dom'
      });

      return {
        x: domPosition.x,
        y: domPosition.y,
        width: domPosition.width,
        height: domPosition.height
      };
    }

    // DIRECT SOLUTION: Calculate position directly from DOM
    fileLog.warn('🔄 DOM position not cached, calculating directly', { cellKey });

    const cell = this.container.querySelector(`[data-row-id="${rowId}"][data-column-id="${columnId}"]`) as HTMLElement;
    if (cell) {
      // Find the actual scrollable container that contains this cell
      let viewportContainer = cell.closest('.vibegridx-viewport') as HTMLElement;
      if (!viewportContainer) {
        // Try finding from the main container
        viewportContainer = this.container.querySelector('.vibegridx-viewport') as HTMLElement;
      }
      if (!viewportContainer) {
        // Fallback: find the scrollable parent of the cell
        let parent = cell.parentElement;
        while (parent && parent !== this.container) {
          const overflow = getComputedStyle(parent).overflow;
          if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') {
            viewportContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
      if (!viewportContainer) {
        fileLog.error('❌ No viewport container found - using main container', {
          cellKey,
          containerClass: this.container.className,
          cellParentClass: cell.parentElement?.className
        });
        viewportContainer = this.container;
      }

      fileLog.debug('🔍 DIAGNOSTIC: Container debug info', {
        cellKey,
        columnId,
        foundCell: !!cell,
        foundViewport: !!viewportContainer,
        containerClass: this.container.className,
        viewportClass: viewportContainer?.className,
        cellParentClass: cell.parentElement?.className,
        isViewportSameAsContainer: viewportContainer === this.container,
        scrollingContext: {
          containerScrollLeft: this.container.scrollLeft,
          viewportScrollLeft: viewportContainer?.scrollLeft,
          globalScrollLeft: currentScrollLeft,
          shouldUseViewportForCalculation: !!viewportContainer && viewportContainer !== this.container
        }
      });

      if (viewportContainer) {
        const cellRect = cell.getBoundingClientRect();
        const viewportRect = viewportContainer.getBoundingClientRect();

        const directPosition = {
          x: cellRect.left - viewportRect.left,
          y: cellRect.top - viewportRect.top,
          width: cellRect.width,
          height: cellRect.height
        };

        fileLog.debug('✅ DIAGNOSTIC: Using direct DOM calculation with scroll analysis', {
          cellKey,
          columnId,
          position: directPosition,
          source: 'direct',
          rawCellRect: {
            left: cellRect.left,
            top: cellRect.top,
            right: cellRect.right,
            width: cellRect.width,
            height: cellRect.height
          },
          rawViewportRect: {
            left: viewportRect.left,
            top: viewportRect.top,
            right: viewportRect.right,
            width: viewportRect.width,
            height: viewportRect.height
          },
          calculation: {
            xCalc: `${cellRect.left} - ${viewportRect.left} = ${cellRect.left - viewportRect.left}`,
            yCalc: `${cellRect.top} - ${viewportRect.top} = ${cellRect.top - viewportRect.top}`,
            cellVisibleWidth: Math.min(cellRect.right, viewportRect.right) - Math.max(cellRect.left, viewportRect.left),
            isPartiallyVisible: cellRect.right > viewportRect.right || cellRect.left < viewportRect.left,
            isFullyVisible: cellRect.left >= viewportRect.left && cellRect.right <= viewportRect.right
          },
          scrollDiagnostic: {
            scrollLeft: currentScrollLeft,
            cellAbsoluteLeft: cellRect.left,
            cellAbsoluteRight: cellRect.right,
            viewportAbsoluteLeft: viewportRect.left,
            viewportAbsoluteRight: viewportRect.right,
            cellRelativeToViewport: cellRect.left - viewportRect.left,
            isCellOutsideViewport: cellRect.right < viewportRect.left || cellRect.left > viewportRect.right
          }
        });

        return directPosition;
      }
    }

    // No DOM position means cell is not visible - overlays only render for visible cells
    fileLog.debug('Cell not visible in DOM, no overlay needed', {
      cellKey,
      rowId,
      columnId
    });

    return null;
  }

  /**
   * Get viewport info
   */
  private getViewportInfo(): ViewportInfo {
    // Use the body container if available, as that's where scrolling happens
    const scrollContainer = this.bodyContainer || this.container.querySelector('.vibegridx-body-container') as HTMLElement || this.container;

    // Defensive code to handle performance monitoring overrides
    let scrollTop = 0;
    let scrollLeft = 0;
    let viewportWidth = 0;
    let viewportHeight = 0;

    try {
      scrollTop = scrollContainer.scrollTop || 0;
    } catch (e) {
      // Performance monitoring may override getter
      fileLog.debug('Failed to get scrollTop, using 0', e);
    }

    try {
      scrollLeft = scrollContainer.scrollLeft || 0;
    } catch (e) {
      // Performance monitoring may override getter
      fileLog.debug('Failed to get scrollLeft, using 0', e);
    }

    try {
      viewportWidth = scrollContainer.clientWidth || 0;
    } catch (e) {
      // Performance monitoring may override getter
      fileLog.debug('Failed to get clientWidth, using 0', e);
    }

    try {
      viewportHeight = scrollContainer.clientHeight || 0;
    } catch (e) {
      // Performance monitoring may override getter
      fileLog.debug('Failed to get clientHeight, using 0', e);
    }

    return {
      scrollTop,
      scrollLeft,
      viewportWidth,
      viewportHeight
    };
  }
  
  /**
   * Set header container reference
   */
  setHeaderContainer(headerContainer: HTMLElement | null): void {
    this.headerContainer = headerContainer;
  }
  
  /**
   * Set body container reference
   */
  setBodyContainer(bodyContainer: HTMLElement | null): void {
    this.bodyContainer = bodyContainer;
  }
  
  /**
   * Clean up all overlays
   */
  destroy(): void {
    fileLog.info('🧹 Destroying overlay system');

    // Clean up RAF to prevent memory leaks
    if (this.updateSelectionRAF !== null) {
      cancelAnimationFrame(this.updateSelectionRAF);
      this.updateSelectionRAF = null;
    }

    // Clear caches
    this.lastSelectionString = '';
    this.lastCoordinateMappingVersion = -1;

    // Clear selections using interaction-state
    this.tableInteraction$.clearSelection();
    
    if (this.canvasOverlay) {
      this.canvasOverlay.destroy();
      this.canvasOverlay = null;
    }
    
    if (this.editingOverlay) {
      this.editingOverlay.hide();
      this.editingOverlay = null;
    }
    
    if (this.contextMenu) {
      this.contextMenu.destroy();
      this.contextMenu = null;
    }
    
    // Selection cleanup not needed - handled by interaction-state
    
    fileLog.info('✅ Overlay system destroyed');
  }
  
  /**
   * Get canvas overlay instance (for direct access when needed)
   */
  getCanvasOverlay(): CanvasOverlayDOM | null {
    return this.canvasOverlay;
  }
  
  /**
   * Get selection manager instance
   */
  // Selection is managed through tableInteraction$ - no separate manager needed
  
  /**
   * Get editing overlay instance
   */
  getEditingOverlay(): EditingOverlay | null {
    return this.editingOverlay;
  }
  
  /**
   * Get context menu instance
   */
  getContextMenu(): ContextMenuManager | null {
    return this.contextMenu;
  }

  /**
   * Update coordinate mapping for all overlays
   * This method is called by SimplePassiveRenderer when coordinates change
   */
  updateCoordinateMapping(mapping: CoordinateMapping): void {
    // PERFORMANCE: Deduplicate coordinate mapping updates
    if (this.lastCoordinateMappingVersion === mapping.version) {
      fileLog.debug('🔄 Coordinate mapping unchanged, skipping update', {
        version: mapping.version,
        lastVersion: this.lastCoordinateMappingVersion
      });
      return;
    }

    this.lastCoordinateMappingVersion = mapping.version;

    fileLog.info('🔄 Coordinate mapping updated for overlays', {
      version: mapping.version,
      rowCount: mapping.rows.length,
      columnCount: mapping.columns.length
    });

    // Delegate to canvas overlay which handles all sub-overlays
    if (this.canvasOverlay) {
      this.canvasOverlay.updateCoordinateMapping(mapping);
    }
  }
}
