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
    const visualDisposer = observe(() => {
      // Collect all visual state in single observer to batch changes
      const columns = this.tableCore$.columns.get();
      const columnVisibility = this.tableCore$.columnVisibility.get();
      const scrollTop = this.tableViewport$.scrollTop.get();
      const scrollLeft = this.tableViewport$.scrollLeft.get();
      const viewportWidth = this.tableViewport$.viewportWidth.get();
      const viewportHeight = this.tableViewport$.viewportHeight.get();

      const hiddenCount = Object.values(columnVisibility).filter(visible => visible === false).length;

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

        // Single coordinated visual state update
        const visualState: VisualState = {
          columns,
          columnVisibility,
          viewport: {
            scrollTop,
            scrollLeft,
            viewportWidth,
            viewportHeight
          }
        };

        // Batched render instead of separate column/viewport renders
        this.onVisualStateChanged(visualState);
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
    const rowsDisposer = observe(() => {
      const rows = this.tableCore$.processedRows.get();
      fileLog.info('📋 Rows changed', { count: rows.length });
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