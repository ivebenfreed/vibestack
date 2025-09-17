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
  private updateThrottle = 16; // ~60fps max
  private isUpdating = false;

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

    // Initial position update
    fileLog.info('🚀 Position tracker initialized, scheduling initial update', {
      cellsFound: viewportContainer.querySelectorAll('[data-row-id][data-column-id]').length
    });
    this.schedulePositionUpdate();
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
   */
  private schedulePositionUpdate(): void {
    if (this.rafId || this.isUpdating) return; // Already scheduled or updating

    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      // Throttle updates to prevent infinite loops
      setTimeout(() => this.schedulePositionUpdate(), this.updateThrottle);
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.updatePositions();
      this.rafId = null;
    });
  }

  /**
   * Update positions for all pending cells
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

    // Discover all cells in the DOM to ensure complete tracking
    const allCellsInDOM = container.querySelectorAll('[data-row-id][data-column-id]');
    const allCellKeys = Array.from(allCellsInDOM).map(cell => {
      const rowId = cell.getAttribute('data-row-id');
      const columnId = cell.getAttribute('data-column-id');
      return `${rowId}:${columnId}`;
    });

    // Always update ALL cells in DOM for single source reliability
    const cellsToUpdate = allCellKeys;

    fileLog.info('📐 Position update', {
      cellsInDOM: allCellsInDOM.length,
      tracked: currentPositions.size,
      updating: cellsToUpdate.length
    });

    cellsToUpdate.forEach(cellKey => {
      const { rowId, columnId } = CoordinateUtils.parseCellKey(cellKey) || {};
      if (!rowId || !columnId) return;

      const cell = container.querySelector(
        `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      ) as HTMLElement;

      if (cell) {
        const oldPosition = currentPositions.get(cellKey);

        // Get viewport container for relative positioning
        const viewportContainer = container.querySelector('.vibegridx-viewport') as HTMLElement;

        if (viewportContainer) {
          // Use getBoundingClientRect to get viewport-relative coordinates
          const cellRect = cell.getBoundingClientRect();
          const viewportRect = viewportContainer.getBoundingClientRect();

          // Calculate position relative to viewport container
          const relativeX = cellRect.left - viewportRect.left;
          const relativeY = cellRect.top - viewportRect.top;

          const newPosition: CellCoordinates = {
            x: relativeX,
            y: relativeY,
            width: cellRect.width,
            height: cellRect.height,
            source: 'dom',
            isVisible: cellRect.width > 0 && cellRect.height > 0,
            timestamp
          };

          // Reduced logging to prevent spam

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
        } else {
          fileLog.warn('❌ No viewport container found for position calculation', { cellKey });
        }
      } else {
        // Cell no longer exists in DOM
        newPositions.delete(cellKey);
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