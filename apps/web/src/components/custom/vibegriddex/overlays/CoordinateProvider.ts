import type { VibeGridXCoordinateManager } from '../coordinates/VibeGridXCoordinateManager';
import type { ViewportInfo } from '../types';

// ====================================
// COORDINATE PROVIDER INTERFACE
// ====================================

/**
 * Interface for components that provide coordinate information.
 * This allows overlays to get coordinates without direct dependencies.
 */
export interface CoordinateProvider {
  getCoordinateManager(): VibeGridXCoordinateManager | null;
}

/**
 * Helper class that wraps coordinate queries for overlays.
 * Provides null-safe access to coordinate information.
 */
export class CoordinateHelper {
  constructor(private provider: CoordinateProvider) {}

  getCellPosition(rowId: string, columnId: string): { x: number; y: number; row: number; column: number } | null {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      // This is expected during initialization, not a warning
      return null;
    }

    const position = manager.getCellPosition(rowId, columnId);
    if (!position) {
      return null;
    }

    // Convert to viewport coordinates
    return {
      x: position.x,
      y: position.y,
      row: position.row,
      column: position.column
    };
  }

  getCellPositionWithViewport(
    rowId: string, 
    columnId: string, 
    viewport: ViewportInfo
  ): { x: number; y: number } | null {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      console.warn('CoordinateHelper: No coordinate manager available');
      return null;
    }

    // Use the new viewport-aware method from coordinate manager
    const viewportAwarePosition = manager.getCellPositionWithViewport(rowId, columnId, viewport);
    
    if (!viewportAwarePosition || !viewportAwarePosition.isVisible || !viewportAwarePosition.viewport) {
      // Cell is not visible in current viewport
      return null;
    }

    // Return the viewport-relative position
    // The coordinate manager already calculated the viewport-relative position
    return viewportAwarePosition.viewport;
  }

  parseCellKey(cellKey: string): { rowId: string; columnId: string } | null {
    const parts = cellKey.split(':');
    if (parts.length !== 2) {
      return null;
    }
    return { rowId: parts[0], columnId: parts[1] };
  }

  getVisibleCellRange(viewport: ViewportInfo): {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  } | null {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return null;
    }

    // Use viewport's buffered range
    return {
      startRow: Math.max(0, viewport.start),
      endRow: viewport.end,
      startColumn: 0,
      endColumn: manager.getColumnCount()
    };
  }

  calculateDragSelection(
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    viewport: ViewportInfo
  ): Set<string> {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return new Set();
    }

    // TODO: Implement drag selection calculation using coordinate manager
    // For now, return empty set
    return new Set();
  }

  getColumnWidth(columnId: string): number {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return 120; // default width
    }

    const column = manager.getColumn(columnId);
    return column?.width || 120;
  }

  getRowHeight(): number {
    // For now, return fixed height
    // TODO: Get from row dimension manager
    return 40;
  }

  getAllRowIds(): string[] {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return [];
    }
    return manager.getSortedRowIds();
  }

  getAllColumnIds(): string[] {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return [];
    }
    return manager.getColumnIds();
  }

  getVisibleCells(selectedCells: Set<string>, viewport: ViewportInfo): Map<string, { x: number; y: number }> {
    const manager = this.provider.getCoordinateManager();
    if (!manager) {
      return new Map();
    }

    const visiblePositions = manager.getVisibleCells(selectedCells, viewport);
    const result = new Map<string, { x: number; y: number }>();

    // Convert ViewportAwarePosition to simple x,y coordinates
    for (const [cellKey, position] of visiblePositions) {
      if (position.viewport) {
        result.set(cellKey, position.viewport);
      }
    }

    return result;
  }
}