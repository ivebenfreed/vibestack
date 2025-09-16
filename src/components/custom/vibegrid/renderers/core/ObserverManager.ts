/**
 * ObserverManager - Centralized management of Legend State observers for VibeGrid
 * Handles all reactive state subscriptions and lifecycle management
 */

import { observe } from '@legendapp/state';
import { log } from '@/logger';
import type { TableCore$ } from '../../stores/data-state';
import type { TableInteraction$ } from '../../stores/interaction-state';
import type { TableViewport$ } from '../../stores/pure-observables';
import type { ViewportInfo } from '../../types';
import type { OverlayManager } from '../modules/OverlayManager';

const fileLog = log('components/custom/vibegrid/renderers/core/ObserverManager.ts');

const ROW_HEIGHT = 40;

export interface VisualState {
  columns: any[];
  columnVisibility: Record<string, boolean>;
  viewport: {
    scrollTop: number;
    scrollLeft: number;
    viewportWidth: number;
    viewportHeight: number;
  };
}

export interface ObserverManagerOptions {
  tableCore$: TableCore$;
  tableInteraction$: TableInteraction$;
  tableViewport$: TableViewport$;
  overlayManager?: OverlayManager;

  // Consolidated visual state callback
  onVisualStateChanged: (visualState: VisualState) => void;

  // Non-visual callbacks
  onRowsChanged: () => void;
  onSelectionChanged: (selectedCells: Set<string>) => void;
  onEditingChanged: (editingCell: string | null, editValue?: string) => void;
  onSelectAllCheckboxChanged: (state: { checked: boolean; indeterminate: boolean }) => void;
  onSortChanged: () => void;
  onDragChanged: () => void;

  // Column resize handlers (immediate DOM updates, no re-render)
  updateHeaderCellWidth: (columnId: string, newWidth: number) => void;
  updateBodyCellWidths: (columnId: string, newWidth: number) => void;
}

export class ObserverManager {
  private tableCore$: TableCore$;
  private tableInteraction$: TableInteraction$;
  private tableViewport$: TableViewport$;
  private overlayManager?: OverlayManager;

  private disposers: (() => void)[] = [];
  private viewportThrottleRAF: number | null = null;
  private visualStateThrottleRAF: number | null = null;
  
  // Callback functions
  private onVisualStateChanged: (visualState: VisualState) => void;
  private onRowsChanged: () => void;
  private onSelectionChanged: (selectedCells: Set<string>) => void;
  private onEditingChanged: (editingCell: string | null, editValue?: string) => void;
  private onSelectAllCheckboxChanged: (state: { checked: boolean; indeterminate: boolean }) => void;
  private onSortChanged: () => void;
  private onDragChanged: () => void;
  private updateHeaderCellWidth: (columnId: string, newWidth: number) => void;
  private updateBodyCellWidths: (columnId: string, newWidth: number) => void;

  constructor(options: ObserverManagerOptions) {
    this.tableCore$ = options.tableCore$;
    this.tableInteraction$ = options.tableInteraction$;
    this.tableViewport$ = options.tableViewport$;
    this.overlayManager = options.overlayManager;
    
    // Store callback functions
    this.onVisualStateChanged = options.onVisualStateChanged;
    this.onRowsChanged = options.onRowsChanged;
    this.onSelectionChanged = options.onSelectionChanged;
    this.onEditingChanged = options.onEditingChanged;
    this.onSelectAllCheckboxChanged = options.onSelectAllCheckboxChanged;
    this.onSortChanged = options.onSortChanged;
    this.onDragChanged = options.onDragChanged;
    this.updateHeaderCellWidth = options.updateHeaderCellWidth;
    this.updateBodyCellWidths = options.updateBodyCellWidths;
    
    this.setupObservers();
  }

  /**
   * Set up all reactive observers
   */
  private setupObservers(): void {
    fileLog.info('🔍 Setting up observers');

    try {
      fileLog.info('🔍 Setting up consolidated visual state observer');
      this.setupConsolidatedVisualObserver();
      fileLog.info('✅ Consolidated visual state observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up consolidated visual state observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up column resize observer');
      this.setupColumnResizeObserver();
      fileLog.info('✅ Column resize observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up column resize observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up rows observer');
      this.setupRowsObserver();
      fileLog.info('✅ Rows observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up rows observer', error);
      throw error;
    }

    // Viewport observer removed - now handled by consolidated visual observer

    try {
      fileLog.info('🔍 Setting up selection observer');
      this.setupSelectionObserver();
      fileLog.info('✅ Selection observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up selection observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up select all checkbox observer');
      this.setupSelectAllCheckboxObserver();
      fileLog.info('✅ Select all checkbox observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up select all checkbox observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up editing observer');
      this.setupEditingObserver();
      fileLog.info('✅ Editing observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up editing observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up sort observer');
      this.setupSortObserver();
      fileLog.info('✅ Sort observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up sort observer', error);
      throw error;
    }

    try {
      fileLog.info('🔍 Setting up drag observer');
      this.setupDragObserver();
      fileLog.info('✅ Drag observer set up');
    } catch (error) {
      fileLog.error('❌ Failed to set up drag observer', error);
      throw error;
    }

    fileLog.info('✅ All observers set up');
  }

  /**
   * Consolidated visual state observer - handles columns, visibility, and viewport in one observer
   * This prevents cascade effects and reduces render cycles from 5+ to 1
   * Uses requestAnimationFrame debouncing to prevent excessive renders during initialization
   */
  private setupConsolidatedVisualObserver(): void {
    let previousState: VisualState | null = null;
    let isViewportStable = false;
    let lastStableViewport: { width: number; height: number } | null = null;

    const visualDisposer = observe(() => {
      // Collect ALL visual state in single observer to batch changes and prevent cascades
      // Use shallow tracking for better performance on structural changes
      const columns = this.tableCore$.columns.get(true); // shallow tracking for array structure
      const columnVisibility = this.tableCore$.columnVisibility.get(true); // shallow tracking for object keys
      const scrollTop = this.tableViewport$.scrollTop.get();
      const scrollLeft = this.tableViewport$.scrollLeft.get();
      const viewportWidth = this.tableViewport$.viewportWidth.get();
      const viewportHeight = this.tableViewport$.viewportHeight.get();

      // Include ALL other visual state that was previously observed separately
      const processedRows = this.tableCore$.processedRows.get(true); // shallow tracking for array structure
      const selectedCells = this.tableInteraction$.selectedCells.get();
      const selectAllCheckboxState = this.tableInteraction$.selectAllCheckboxState.get();
      const editingCell = this.tableInteraction$.editingCell.get();
      const editValue = this.tableInteraction$.editValue.get();
      const sortBy = this.tableCore$.sortBy.get(true); // shallow tracking for array structure
      const isDragging = this.tableInteraction$.isDragging.get();
      const dragSource = this.tableInteraction$.dragSource.get();
      const dragTarget = this.tableInteraction$.dragTarget.get();

      const hiddenCount = Object.values(columnVisibility).filter(visible => visible === false).length;

      // Skip processing during invalid viewport states (zero dimensions)
      if (viewportWidth <= 0 || viewportHeight <= 0) {
        fileLog.debug('🎨 Skipping render - invalid viewport dimensions', {
          viewportWidth,
          viewportHeight
        });
        return;
      }

      // Check if viewport dimensions have actually stabilized
      if (!isViewportStable) {
        if (lastStableViewport) {
          // Check if dimensions have changed significantly from last stable state
          const widthDiff = Math.abs(viewportWidth - lastStableViewport.width);
          const heightDiff = Math.abs(viewportHeight - lastStableViewport.height);

          if (widthDiff < 1 && heightDiff < 1) {
            // Dimensions are stable - allow renders to proceed
            isViewportStable = true;
            fileLog.debug('🎨 Viewport dimensions stabilized', {
              viewportWidth,
              viewportHeight,
              previousWidth: lastStableViewport.width,
              previousHeight: lastStableViewport.height
            });
          } else {
            // Dimensions still changing - update tracking and skip render
            lastStableViewport = { width: viewportWidth, height: viewportHeight };
            fileLog.debug('🎨 Viewport dimensions still changing, skipping render', {
              viewportWidth,
              viewportHeight,
              widthDiff,
              heightDiff
            });
            return;
          }
        } else {
          // First time seeing valid dimensions - start tracking
          lastStableViewport = { width: viewportWidth, height: viewportHeight };
          fileLog.debug('🎨 Starting viewport dimension tracking', {
            viewportWidth,
            viewportHeight
          });
          return;
        }
      }

      // Create new visual state
      const newVisualState: VisualState = {
        columns,
        columnVisibility,
        viewport: {
          scrollTop,
          scrollLeft,
          viewportWidth,
          viewportHeight
        }
      };

      // Apply comprehensive Legend State change detection pattern
      if (previousState) {
        // Check viewport changes with tolerance for floating point precision
        const VIEWPORT_TOLERANCE = 0.5; // Allow sub-pixel differences
        const viewportChanged =
          Math.abs(previousState.viewport.scrollTop - newVisualState.viewport.scrollTop) > VIEWPORT_TOLERANCE ||
          Math.abs(previousState.viewport.scrollLeft - newVisualState.viewport.scrollLeft) > VIEWPORT_TOLERANCE ||
          Math.abs(previousState.viewport.viewportWidth - newVisualState.viewport.viewportWidth) > VIEWPORT_TOLERANCE ||
          Math.abs(previousState.viewport.viewportHeight - newVisualState.viewport.viewportHeight) > VIEWPORT_TOLERANCE;

        // Check column visibility changes
        const visibilityChanged = JSON.stringify(previousState.columnVisibility) !== JSON.stringify(newVisualState.columnVisibility);

        // Check column structure changes (more comprehensive than just length)
        const columnsChanged =
          previousState.columns.length !== newVisualState.columns.length ||
          // Check if column IDs have changed (structural change)
          JSON.stringify(previousState.columns.map(c => c.id)) !== JSON.stringify(newVisualState.columns.map(c => c.id)) ||
          // Check if column widths have changed (layout change)
          JSON.stringify(previousState.columns.map(c => c.width)) !== JSON.stringify(newVisualState.columns.map(c => c.width));

        // Only render if something actually changed
        if (!viewportChanged && !visibilityChanged && !columnsChanged) {
          fileLog.debug('🎨 Visual state unchanged, skipping render', {
            columnCount: columns.length,
            hiddenCount,
            scrollTop,
            scrollLeft,
            viewportWidth,
            viewportHeight,
            columnsChanged,
            viewportChanged,
            visibilityChanged
          });
          return; // Skip render if nothing actually changed
        }

        fileLog.debug('🎨 Visual state changes detected', {
          columnsChanged,
          viewportChanged,
          visibilityChanged,
          columnCount: columns.length,
          hiddenCount,
          // Detailed viewport values for debugging
          currentViewport: newVisualState.viewport,
          previousViewport: previousState?.viewport || null
        });
      }

      // Update previous state reference
      previousState = newVisualState;

      // Cancel previous debounced render to prevent stacking
      if (this.visualStateThrottleRAF !== null) {
        cancelAnimationFrame(this.visualStateThrottleRAF);
      }

      // Debounce visual state updates using requestAnimationFrame
      this.visualStateThrottleRAF = requestAnimationFrame(() => {
        this.visualStateThrottleRAF = null;

        fileLog.info('🎨 Consolidated visual state changed (debounced)', {
          columnCount: columns.length,
          hiddenCount,
          scrollTop,
          scrollLeft,
          viewportWidth,
          viewportHeight
        });

        // Batched render instead of separate column/viewport renders
        this.onVisualStateChanged(newVisualState);
      });
    });
    this.disposers.push(visualDisposer);
  }

  /**
   * Observe column resize changes
   */
  private setupColumnResizeObserver(): void {
    const columnResizeDisposer = observe(() => {
      const resizeState = this.tableInteraction$.columnResize.get();
      if (resizeState && resizeState.isResizing && resizeState.newWidth && resizeState.columnId) {
        // Only update visual elements during resize, don't trigger re-renders
        this.updateHeaderCellWidth(resizeState.columnId, resizeState.newWidth);
        this.updateBodyCellWidths(resizeState.columnId, resizeState.newWidth);

        // Update overlay manager with resize preview (throttled)
        if (this.overlayManager) {
          this.overlayManager.updateColumnResizePreview(resizeState);
        }
      } else if (resizeState === null) {
        // Resize completed - this should trigger a single re-render
        fileLog.info('📏 Column resize completed');

        // Clear resize preview
        if (this.overlayManager) {
          this.overlayManager.updateColumnResizePreview(null);
        }
      }
    });
    this.disposers.push(columnResizeDisposer);
  }

  /**
   * Observe processed rows changes
   */
  private setupRowsObserver(): void {
    let previousRowCount: number | null = null;
    let previousRowIds: string[] | null = null;

    const rowsDisposer = observe(() => {
      const rows = this.tableCore$.processedRows.get();
      const currentRowCount = rows.length;

      // Create a lightweight identifier for row changes (using IDs to detect actual data changes)
      const currentRowIds = rows.map(row => row.id).slice(0, 10); // Sample first 10 for performance

      // Only trigger if rows actually changed (count or identity)
      if (previousRowCount !== null && previousRowIds !== null) {
        const countChanged = previousRowCount !== currentRowCount;
        const identityChanged = JSON.stringify(previousRowIds) !== JSON.stringify(currentRowIds);

        if (!countChanged && !identityChanged) {
          fileLog.debug('📋 Rows observer fired but no meaningful changes detected', {
            count: currentRowCount,
            sampleIds: currentRowIds.slice(0, 3)
          });
          return; // Skip redundant row changes
        }

        fileLog.info('📋 Rows changed', {
          count: currentRowCount,
          countChanged,
          identityChanged,
          previousCount: previousRowCount
        });
      } else {
        fileLog.info('📋 Rows initialized', { count: currentRowCount });
      }

      // Update tracking state
      previousRowCount = currentRowCount;
      previousRowIds = currentRowIds;

      this.onRowsChanged();
    });
    this.disposers.push(rowsDisposer);
  }

  // Viewport observer removed - now handled by setupConsolidatedVisualObserver()

  /**
   * Observe selection changes
   */
  private setupSelectionObserver(): void {
    const selectionDisposer = observe(() => {
      const selectedCells = this.tableInteraction$.selectedCells.get();

      fileLog.info('🎯 Selection changed', {
        selectedCount: selectedCells.size
      });

      // Update selection using overlay manager
      if (this.overlayManager) {
        this.overlayManager.updateSelection(selectedCells);
      }

      // Delegate to renderer for DOM class updates
      this.onSelectionChanged(selectedCells);
    });
    this.disposers.push(selectionDisposer);
  }

  /**
   * Observe select all checkbox state changes
   */
  private setupSelectAllCheckboxObserver(): void {
    const checkboxDisposer = observe(() => {
      const checkboxState = this.tableInteraction$.selectAllCheckboxState.get();
      fileLog.info('☑️ Select all checkbox state changed', checkboxState);
      this.onSelectAllCheckboxChanged(checkboxState);
    });
    this.disposers.push(checkboxDisposer);
  }

  /**
   * Observe editing state changes
   */
  private setupEditingObserver(): void {
    const editingDisposer = observe(() => {
      const editingCell = this.tableInteraction$.editingCell.get();
      const editValue = this.tableInteraction$.editValue.get();
      
      fileLog.info('📝 Editing state changed', { 
        editingCell, 
        hasValue: !!editValue 
      });
      
      // Update editing overlay via overlay manager
      if (this.overlayManager) {
        this.overlayManager.updateEditingOverlay(editingCell, editValue);
      }
      
      // Delegate to renderer for any additional editing updates
      this.onEditingChanged(editingCell, editValue);
    });
    this.disposers.push(editingDisposer);
  }

  /**
   * Observe sort state changes
   */
  private setupSortObserver(): void {
    const sortDisposer = observe(() => {
      const sortBy = this.tableCore$.sortBy.get();
      fileLog.info('🔄 Sort state changed', { 
        sortCount: sortBy.length 
      });
      this.onSortChanged();
    });
    this.disposers.push(sortDisposer);
  }

  /**
   * Observe drag state changes
   */
  private setupDragObserver(): void {
    const dragDisposer = observe(() => {
      const isDragging = this.tableInteraction$.isDragging.get();
      const dragSource = this.tableInteraction$.dragSource.get();
      const dragTarget = this.tableInteraction$.dragTarget.get();
      
      fileLog.info('🖱️ Drag state changed', { 
        isDragging, 
        hasDragSource: !!dragSource,
        hasDragTarget: !!dragTarget 
      });
      
      // Update drag preview via overlay manager
      if (this.overlayManager) {
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
      }
      
      // Delegate to renderer for any additional drag updates
      this.onDragChanged();
    });
    this.disposers.push(dragDisposer);
  }

  /**
   * Set overlay manager reference (for late initialization)
   */
  setOverlayManager(overlayManager: OverlayManager): void {
    this.overlayManager = overlayManager;
  }

  /**
   * Clean up all observers
   */
  destroy(): void {
    fileLog.info('🧹 Destroying observers');

    // Cancel any pending debounced renders
    if (this.visualStateThrottleRAF !== null) {
      cancelAnimationFrame(this.visualStateThrottleRAF);
      this.visualStateThrottleRAF = null;
    }

    if (this.viewportThrottleRAF !== null) {
      cancelAnimationFrame(this.viewportThrottleRAF);
      this.viewportThrottleRAF = null;
    }

    this.disposers.forEach(dispose => {
      try {
        dispose();
      } catch (error) {
        fileLog.error('❌ Error disposing observer', error);
      }
    });

    this.disposers = [];
    fileLog.info('✅ All observers destroyed');
  }

  /**
   * Get the number of active observers (for debugging)
   */
  getObserverCount(): number {
    return this.disposers.length;
  }
}