/**
 * DOM Position State - Reactive DOM Position Tracking
 *
 * This observable tracks actual DOM positions of rendered cells using
 * ResizeObserver and IntersectionObserver for perfect accuracy.
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
 * Uses ResizeObserver and IntersectionObserver to track DOM changes
 * and update the reactive observable automatically.
 */
class ReactivePositionTracker {
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private rafId: number | null = null;
  private pendingUpdates = new Set<string>();
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

    fileLog.info('🎯 Initializing DOM position tracking', {
      containerClass: container.className,
      existingCells: container.querySelectorAll('[data-row-id][data-column-id]').length
    });

    tableContainer = container;
    domPositions$.isTracking.set(true);

    // Re-enable observers now that recursive updates are fixed
    this.setupObservers(container);
    this.observeAllCells(container);
    this.isInitialized = true;

    // Initial position update
    this.schedulePositionUpdate();
  }

  /**
   * Setup DOM observers
   */
  private setupObservers(container: HTMLElement): void {
    // Track cell size/position changes
    this.resizeObserver = new ResizeObserver((entries) => {
      entries.forEach(entry => {
        const cellKey = this.getCellKey(entry.target as HTMLElement);
        if (cellKey) {
          this.pendingUpdates.add(cellKey);
        }
      });
      this.schedulePositionUpdate();
    });

    // Track visibility changes
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const cellKey = this.getCellKey(entry.target as HTMLElement);
          if (cellKey) {
            this.pendingUpdates.add(cellKey);
          }
        });
        this.schedulePositionUpdate();
      },
      {
        root: container,
        threshold: [0, 0.1, 1.0] // Track partial visibility
      }
    );

    // Track DOM structure changes (cells added/removed)
    this.mutationObserver = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // Check for added cells
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (this.isCellElement(element)) {
                this.observeCell(element);
                hasRelevantChanges = true;
              }
              // Check children too
              const cells = element.querySelectorAll('[data-row-id][data-column-id]');
              cells.forEach(cell => {
                this.observeCell(cell as HTMLElement);
                hasRelevantChanges = true;
              });
            }
          });

          // Check for removed cells
          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (this.isCellElement(element)) {
                this.unobserveCell(element);
                hasRelevantChanges = true;
              }
            }
          });
        }
      });

      if (hasRelevantChanges) {
        this.schedulePositionUpdate();
      }
    });

    this.mutationObserver.observe(container, {
      childList: true,
      subtree: true
    });

    fileLog.info('✅ DOM observers initialized');
  }

  /**
   * Observe all existing cells in container
   */
  private observeAllCells(container: HTMLElement): void {
    const cells = container.querySelectorAll('[data-row-id][data-column-id]');

    fileLog.info('🔍 Observing cells', { cellCount: cells.length });

    // Debug: Log first few cells to see their data attributes
    const firstFewCells = Array.from(cells).slice(0, 5);
    firstFewCells.forEach((cell, index) => {
      const htmlCell = cell as HTMLElement;
      const rowId = htmlCell.getAttribute('data-row-id');
      const columnId = htmlCell.getAttribute('data-column-id');
      fileLog.info(`🔍 Cell ${index}: data-row-id="${rowId}", data-column-id="${columnId}"`);
    });

    cells.forEach(cell => {
      this.observeCell(cell as HTMLElement);
    });
  }

  /**
   * Start observing a specific cell
   */
  private observeCell(cell: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.observe(cell);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(cell);
    }

    const cellKey = this.getCellKey(cell);
    if (cellKey) {
      this.pendingUpdates.add(cellKey);
    }
  }

  /**
   * Stop observing a specific cell
   */
  private unobserveCell(cell: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(cell);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(cell);
    }

    const cellKey = this.getCellKey(cell);
    if (cellKey) {
      // Remove from positions
      const positions = domPositions$.cellPositions.get();
      positions.delete(cellKey);
      domPositions$.cellPositions.set(new Map(positions));
    }
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

    const containerRect = container.getBoundingClientRect();
    const currentPositions = domPositions$.cellPositions.get();
    const newPositions = new Map(currentPositions);

    // Update only pending cells for performance
    const cellsToUpdate = this.pendingUpdates.size > 0
      ? Array.from(this.pendingUpdates)
      : Array.from(currentPositions.keys());

    this.pendingUpdates.clear();

    cellsToUpdate.forEach(cellKey => {
      const { rowId, columnId } = CoordinateUtils.parseCellKey(cellKey) || {};
      if (!rowId || !columnId) return;

      const cell = container.querySelector(
        `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
      ) as HTMLElement;

      if (cell) {
        const rect = cell.getBoundingClientRect();
        const oldPosition = currentPositions.get(cellKey);

        // Calculate position relative to content area (excluding header and fixed columns)
        const rawX = rect.left - containerRect.left;
        const rawY = rect.top - containerRect.top;

        // Adjust Y position to be relative to content area, not entire grid
        // The header takes up HEADER_HEIGHT pixels at the top
        const adjustedY = rawY - GRID_DIMENSIONS.HEADER_HEIGHT;

        // Adjust X position to be relative to content area, not entire grid
        // Only subtract the drag column width (32px offset identified by testing)
        const adjustedX = rawX - 32;

        const newPosition: CellCoordinates = {
          x: adjustedX,
          y: adjustedY,
          width: rect.width,
          height: rect.height,
          source: 'dom',
          isVisible: rect.width > 0 && rect.height > 0,
          timestamp
        };

        fileLog.debug('📐 DOM position calculated', {
          cellKey,
          rawPosition: { x: rawX, y: rawY },
          adjustedPosition: { x: adjustedX, y: adjustedY },
          headerOffset: GRID_DIMENSIONS.HEADER_HEIGHT,
          contentOffsetX: 32 // Empirically determined offset
        });

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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
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