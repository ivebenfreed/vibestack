/**
 * DOM Position State - Reactive DOM Position Tracking
 *
 * This observable tracks actual DOM positions of rendered cells using
 * a single scroll-based trigger for reliable position updates.
 */

import { observable, batch, ObservableHint } from '@legendapp/state';
import { GRID_DIMENSIONS } from '../constants/grid-dimensions';
import type {
  CellCoordinates,
  CellPositionMap,
  PositionChangeEvent,
  PositionUpdateHandler,
  CellRef
} from '../types/coordinate-types';
import { CoordinateUtils } from '../types/coordinate-types';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/stores/dom-position-state.ts');

interface DOMPositionState {
  cellPositions: CellPositionMap;
  lastUpdate: number;
  isTracking: boolean;
}

// Central DOM position observable
export const domPositions$ = observable<DOMPositionState>({
  cellPositions: new Map(),
  lastUpdate: 0,
  isTracking: false
});

// Event handlers
const positionChangeHandlers = new Set<PositionUpdateHandler>();

// Store container reference outside of observable to avoid circular references
let tableContainer: HTMLElement | null = null;

/**
 * Reactive Position Tracker
 *
 * Uses a single scroll event listener to track viewport position changes
 * and update the reactive observable automatically.
 */
class ReactivePositionTracker {
  private scrollHandler: ((event: Event) => void) | null = null;
  private rafId: number | null = null;
  private isInitialized = false;
  private lastUpdateTime = 0;
  private updateThrottle = 100; // ~10fps max (further reduced to prevent forced reflows during initialization)
  private isUpdating = false;
  private pendingUpdate = false;

  /**
   * Initialize tracking on a table container
   */
  initialize(container: HTMLElement): void {
    if (this.isInitialized) {
      this.cleanup();
    }

    // Find the viewport container which is where cells and overlays live
    const viewportContainer = container.querySelector('.vibegridx-viewport') as HTMLElement || container;

    fileLog.info('🎯 Initializing DOM position tracking', {
      containerClass: container.className,
      viewportClass: viewportContainer.className,
      existingCells: viewportContainer.querySelectorAll('[data-row-id][data-column-id]').length,
      usingViewport: viewportContainer !== container
    });

    tableContainer = viewportContainer;
    domPositions$.isTracking.set(true);

    // Setup single scroll-based trigger
    this.setupScrollListener(viewportContainer);
    this.isInitialized = true;

    // Defer initial position update to prevent blocking initialization
    fileLog.info('🚀 Position tracker initialized, deferring initial update to prevent reflows', {
      cellsFound: viewportContainer.querySelectorAll('[data-row-id][data-column-id]').length
    });

    // Defer initial update by 500ms to allow DOM to settle and prevent forced reflows during initialization
    setTimeout(() => {
      if (this.isInitialized) {
        this.schedulePositionUpdate();
      }
    }, 500);
  }

  /**
   * Setup scroll listener for position tracking
   */
  private setupScrollListener(container: HTMLElement): void {
    // Single scroll event listener that triggers position updates
    this.scrollHandler = () => {
      this.schedulePositionUpdate();
    };

    // Listen to scroll events on the viewport container
    container.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Also listen to window resize which affects viewport positions
    window.addEventListener('resize', this.scrollHandler, { passive: true });

    fileLog.info('✅ Scroll listener initialized');
  }




  /**
   * Schedule a position update (RAF throttled)
   * PERFORMANCE OPTIMIZED: Better throttling and coalescing
   */
  private schedulePositionUpdate(): void {
    if (this.rafId || this.isUpdating || this.pendingUpdate) return; // Already scheduled or updating

    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      // PERFORMANCE FIX: Use pendingUpdate flag to prevent multiple setTimeout calls
      if (!this.pendingUpdate) {
        this.pendingUpdate = true;
        setTimeout(() => {
          this.pendingUpdate = false;
          this.schedulePositionUpdate();
        }, this.updateThrottle - (now - this.lastUpdateTime));
      }
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.updatePositions();
      this.rafId = null;
    });
  }

  /**
   * Update positions for all pending cells
   * PERFORMANCE OPTIMIZED: Batch DOM reads to minimize forced reflows
   */
  private updatePositions(): void {
    if (!tableContainer || this.isUpdating) return;
    this.isUpdating = true;

    const container = tableContainer;
    const timestamp = Date.now();

    // Update lastUpdateTime to prevent throttle issues
    this.lastUpdateTime = timestamp;

    const currentPositions = domPositions$.cellPositions.get();
    const newPositions = new Map(currentPositions);

    // PERFORMANCE FIX: Discover all cells in the DOM to ensure complete tracking
    const allCellsInDOM = container.querySelectorAll('[data-row-id][data-column-id]');
    const allCellElements = Array.from(allCellsInDOM) as HTMLElement[];

    // Extract metadata in a single pass
    const cellsToUpdate = allCellElements.map(cell => ({
      element: cell,
      rowId: cell.getAttribute('data-row-id')!,
      columnId: cell.getAttribute('data-column-id')!,
      cellKey: `${cell.getAttribute('data-row-id')}:${cell.getAttribute('data-column-id')}`
    }));

    fileLog.debug('📐 Position update', {
      cellsInDOM: allCellsInDOM.length,
      tracked: currentPositions.size,
      updating: cellsToUpdate.length
    });

    // PERFORMANCE FIX: Get viewport container once to avoid repeated queries
    const viewportContainer = container.querySelector('.vibegridx-viewport') as HTMLElement || container;

    // CRITICAL PERFORMANCE FIX: Batch all layout reads together first, then writes
    let viewportRect: DOMRect | null = null;
    let scrollLeft = 0;
    let scrollTop = 0;

    // Single batch of layout reads
    if (viewportContainer) {
      viewportRect = viewportContainer.getBoundingClientRect();
      scrollLeft = viewportContainer.scrollLeft || 0;
      scrollTop = viewportContainer.scrollTop || 0;
    }

    // PERFORMANCE FIX: Process all cells with pre-calculated viewport data
    cellsToUpdate.forEach(({ element: cell, rowId, columnId, cellKey }) => {
      if (!rowId || !columnId || !viewportRect) return;

      const oldPosition = currentPositions.get(cellKey);

      // PERFORMANCE FIX: Single getBoundingClientRect call per cell
      const cellRect = cell.getBoundingClientRect();

      // Calculate position relative to viewport container
      const relativeX = cellRect.left - viewportRect.left;
      const relativeY = cellRect.top - viewportRect.top;

      // CRITICAL FIX: Since the overlay container is inside the scrolling viewport,
      // we need absolute positions within the scrollable area, not viewport-relative
      // Add scroll offset to get absolute position within scrollable content
      const absoluteX = relativeX + scrollLeft;
      const absoluteY = relativeY + scrollTop;

      // Log detailed position calculation for debugging (reduced frequency)
      if (columnId === 'satisfaction_rating' && Math.random() < 0.1) { // Only 10% of the time
        fileLog.debug('🎯 SCROLL FIX: Position calculation for satisfaction_rating', {
          cellKey,
          cellRect: { left: cellRect.left, top: cellRect.top },
          viewportRect: { left: viewportRect.left, top: viewportRect.top },
          relativeX,
          relativeY,
          scrollLeft,
          scrollTop,
          absoluteX,
          absoluteY
        });
      }

      const newPosition: CellCoordinates = {
        x: absoluteX,  // Use absolute position within scrollable content
        y: absoluteY,  // Use absolute position within scrollable content
        width: cellRect.width,
        height: cellRect.height,
        source: 'dom',
        isVisible: cellRect.width > 0 && cellRect.height > 0,
        timestamp
      };

      newPositions.set(cellKey, newPosition);

      // Emit position change event
      if (oldPosition && this.hasPositionChanged(oldPosition, newPosition)) {
        this.emitPositionChange({
          type: 'resize',
          cellKey,
          oldPosition,
          newPosition,
          timestamp
        });
      }
    });

    // Only update if there are actual changes
    let hasChanges = false;
    if (newPositions.size !== currentPositions.size) {
      hasChanges = true;
    } else {
      for (const [key, position] of newPositions) {
        const oldPosition = currentPositions.get(key);
        if (!oldPosition || this.hasPositionChanged(oldPosition, position)) {
          hasChanges = true;
          break;
        }
      }
    }

    if (hasChanges) {
      // Batch update the observable
      batch(() => {
        domPositions$.cellPositions.set(newPositions);
        domPositions$.lastUpdate.set(timestamp);
      });

      fileLog.debug('📊 Position update complete', {
        updatedCells: cellsToUpdate.length,
        totalCells: newPositions.size,
        timestamp
      });
    }

    this.isUpdating = false;
  }


  /**
   * Check if position has changed significantly
   */
  private hasPositionChanged(old: CellCoordinates, newPos: CellCoordinates): boolean {
    const threshold = 1; // 1px threshold
    return (
      Math.abs(old.x - newPos.x) > threshold ||
      Math.abs(old.y - newPos.y) > threshold ||
      Math.abs(old.width - newPos.width) > threshold ||
      Math.abs(old.height - newPos.height) > threshold ||
      old.isVisible !== newPos.isVisible
    );
  }

  /**
   * Emit position change event to handlers
   */
  private emitPositionChange(event: PositionChangeEvent): void {
    positionChangeHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        fileLog.error('❌ Error in position change handler', error);
      }
    });
  }

  /**
   * Extract cell key from DOM element
   */
  private getCellKey(element: HTMLElement): string | null {
    const rowId = element.getAttribute('data-row-id');
    const columnId = element.getAttribute('data-column-id');
    return rowId && columnId ? CoordinateUtils.createCellKey(rowId, columnId) : null;
  }

  /**
   * Check if element is a cell
   */
  private isCellElement(element: HTMLElement): boolean {
    return element.hasAttribute('data-row-id') && element.hasAttribute('data-column-id');
  }

  /**
   * Cleanup all observers
   */
  cleanup(): void {
    if (this.scrollHandler && tableContainer) {
      tableContainer.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    tableContainer = null;
    domPositions$.isTracking.set(false);
    this.isInitialized = false;

    fileLog.info('🧹 DOM position tracking cleaned up');
  }

  /**
   * Force immediate position update (useful for testing)
   */
  forceUpdate(): void {
    fileLog.info('🔄 forceUpdate called - updating positions immediately');
    this.updatePositions();
  }

  /**
   * Get current tracking status
   */
  getStatus(): { isTracking: boolean; cellCount: number; lastUpdate: number } {
    const state = domPositions$.get();
    return {
      isTracking: state.isTracking,
      cellCount: state.cellPositions.size,
      lastUpdate: state.lastUpdate
    };
  }
}

// Export singleton instance
export const positionTracker = new ReactivePositionTracker();

// Position change event handling
export const PositionEvents = {
  /**
   * Subscribe to position change events
   */
  subscribe(handler: PositionUpdateHandler): () => void {
    positionChangeHandlers.add(handler);
    return () => positionChangeHandlers.delete(handler);
  },

  /**
   * Get current position for a cell
   */
  getCellPosition(cellKey: string): CellCoordinates | null {
    return domPositions$.cellPositions.get().get(cellKey) || null;
  },

  /**
   * Get positions for multiple cells
   */
  getMultipleCellPositions(cellKeys: string[]): Array<{ key: string; position: CellCoordinates | null }> {
    const positions = domPositions$.cellPositions.get();
    return cellKeys.map(key => ({
      key,
      position: positions.get(key) || null
    }));
  },

  /**
   * Check if a cell is currently visible
   */
  isCellVisible(cellKey: string): boolean {
    const position = this.getCellPosition(cellKey);
    return position?.isVisible || false;
  },

  /**
   * Get all visible cell keys
   */
  getVisibleCellKeys(): string[] {
    const positions = domPositions$.cellPositions.get();
    return Array.from(positions.entries())
      .filter(([_, pos]) => pos.isVisible)
      .map(([key, _]) => key);
  }
};