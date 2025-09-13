/**
 * Visual State - Central Computed Place for All Table Visual State
 *
 * This is the SINGLE SOURCE OF TRUTH for all visual aspects of the table:
 * - Column dimensions (widths, positions, visibility)
 * - Scroll state and viewport calculations
 * - Layout geometry (total dimensions, visible ranges)
 * - Visual synchronization between header and body
 *
 * All renderers, managers, and components should read from this computed state ONLY.
 */

import { computed, observable } from '@legendapp/state';
import { log } from '@/logger';
import type { Column } from '../types';

const fileLog = log('components/custom/vibegrid/stores/visual-state.ts');

// ====================================
// CORE VISUAL STATE TYPES
// ====================================

export interface ColumnLayout {
  id: string;
  width: number;
  xOffset: number;
  visible: boolean;
  order: number;
}

export interface ViewportGeometry {
  // Viewport dimensions
  viewportWidth: number;
  viewportHeight: number;

  // Scroll positions
  scrollLeft: number;
  scrollTop: number;

  // Content dimensions
  totalWidth: number;
  totalHeight: number;

  // Visible ranges
  visibleColumnRange: { start: number; end: number };
  visibleRowRange: { start: number; end: number };
}

export interface VisualState {
  // Column layout (SINGLE SOURCE OF TRUTH)
  columnLayouts: ColumnLayout[];
  visibleColumns: ColumnLayout[];
  totalColumnsWidth: number;

  // Viewport geometry (COMPUTED)
  geometry: ViewportGeometry;

  // Synchronization state
  headerScrollLeft: number;
  bodyScrollLeft: number;
  scrollSynchronized: boolean;
}

// ====================================
// CORE OBSERVABLES (Input)
// ====================================

// Base input observables - these are the ONLY things that can be mutated
export const visualInputs$ = observable({
  // Column configuration
  columns: [] as Column[],
  columnWidths: {} as Record<string, number>,
  columnVisibility: {} as Record<string, boolean>,
  columnOrder: [] as string[],

  // Viewport state
  viewportWidth: 0,
  viewportHeight: 0,
  scrollLeft: 0,
  scrollTop: 0,

  // Data dimensions
  rowCount: 0,
  rowHeight: 40,

  // Entity context
  entityType: '',
  orgId: '',
  userId: ''
});

// ====================================
// COMPUTED VISUAL STATE (Output)
// ====================================

/**
 * The SINGLE SOURCE OF TRUTH for all visual state
 * Everything reads from this computed observable
 */
export const visualState$ = computed((): VisualState => {
  const inputs = visualInputs$.get();

  // Calculate column layouts with cumulative positioning
  let cumulativeX = 40; // Start after row header
  const columnLayouts: ColumnLayout[] = [];

  inputs.columnOrder.forEach((columnId, index) => {
    const column = inputs.columns.find(c => c.id === columnId);
    if (!column) return;

    const width = inputs.columnWidths[columnId] || column.width || 150;
    const visible = inputs.columnVisibility[columnId] !== false;

    const layout: ColumnLayout = {
      id: columnId,
      width,
      xOffset: cumulativeX,
      visible,
      order: index
    };

    columnLayouts.push(layout);

    if (visible) {
      cumulativeX += width;
    }
  });

  // Filter visible columns
  const visibleColumns = columnLayouts.filter(col => col.visible);

  // Calculate total dimensions
  const totalColumnsWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);
  const totalWidth = 40 + totalColumnsWidth + 20; // row header + columns + end buffer
  const totalHeight = inputs.rowCount * inputs.rowHeight;

  // Calculate visible ranges
  const startColIndex = Math.max(0,
    visibleColumns.findIndex(col => col.xOffset + col.width > inputs.scrollLeft)
  );
  const endColIndex = Math.min(visibleColumns.length,
    visibleColumns.findIndex(col => col.xOffset > inputs.scrollLeft + inputs.viewportWidth) + 1
  );

  const startRowIndex = Math.floor(inputs.scrollTop / inputs.rowHeight);
  const endRowIndex = Math.min(inputs.rowCount,
    Math.ceil((inputs.scrollTop + inputs.viewportHeight) / inputs.rowHeight) + 1
  );

  const geometry: ViewportGeometry = {
    viewportWidth: inputs.viewportWidth,
    viewportHeight: inputs.viewportHeight,
    scrollLeft: inputs.scrollLeft,
    scrollTop: inputs.scrollTop,
    totalWidth,
    totalHeight,
    visibleColumnRange: { start: startColIndex, end: endColIndex },
    visibleRowRange: { start: startRowIndex, end: endRowIndex }
  };

  return {
    columnLayouts,
    visibleColumns,
    totalColumnsWidth,
    geometry,
    headerScrollLeft: inputs.scrollLeft, // Header should match body
    bodyScrollLeft: inputs.scrollLeft,
    scrollSynchronized: true // Always true when computed properly
  };
});

// ====================================
// VISUAL STATE OPERATIONS
// ====================================

export const visualOperations = {

  /**
   * Initialize visual state with columns and context
   */
  initialize(columns: Column[], entityType: string, orgId: string, userId: string) {
    const defaultWidths = Object.fromEntries(
      columns.map(col => [col.id, col.width || 150])
    );
    const defaultVisibility = Object.fromEntries(
      columns.map(col => [col.id, true])
    );
    const defaultOrder = columns.map(col => col.id);

    visualInputs$.set({
      columns,
      columnWidths: defaultWidths,
      columnVisibility: defaultVisibility,
      columnOrder: defaultOrder,
      viewportWidth: 0,
      viewportHeight: 0,
      scrollLeft: 0,
      scrollTop: 0,
      rowCount: 0,
      rowHeight: 40,
      entityType,
      orgId,
      userId
    });

    fileLog.info('🎯 Visual state initialized', { entityType, columnCount: columns.length });
  },

  /**
   * Update column width - SINGLE MUTATION POINT
   */
  setColumnWidth(columnId: string, width: number) {
    const currentWidths = visualInputs$.columnWidths.get();
    visualInputs$.columnWidths.set({
      ...currentWidths,
      [columnId]: width
    });

    fileLog.debug('📏 Column width updated', { columnId, width });
  },

  /**
   * Update viewport dimensions
   */
  setViewportSize(width: number, height: number) {
    visualInputs$.viewportWidth.set(width);
    visualInputs$.viewportHeight.set(height);

    fileLog.debug('📐 Viewport size updated', { width, height });
  },

  /**
   * Update scroll position - SINGLE MUTATION POINT
   */
  setScrollPosition(scrollLeft: number, scrollTop: number) {
    visualInputs$.scrollLeft.set(scrollLeft);
    visualInputs$.scrollTop.set(scrollTop);

    fileLog.debug('📜 Scroll position updated', { scrollLeft, scrollTop });
  },

  /**
   * Update row count (from data changes)
   */
  setRowCount(count: number) {
    visualInputs$.rowCount.set(count);

    fileLog.debug('📊 Row count updated', { count });
  },

  /**
   * Toggle column visibility
   */
  toggleColumnVisibility(columnId: string) {
    const currentVisibility = visualInputs$.columnVisibility.get();
    visualInputs$.columnVisibility.set({
      ...currentVisibility,
      [columnId]: !currentVisibility[columnId]
    });

    fileLog.debug('👁️ Column visibility toggled', { columnId });
  },

  /**
   * Reorder columns
   */
  reorderColumns(sourceColumnId: string, targetColumnId: string, insertBefore: boolean = true) {
    const currentOrder = [...visualInputs$.columnOrder.get()];
    const sourceIndex = currentOrder.indexOf(sourceColumnId);
    const targetIndex = currentOrder.indexOf(targetColumnId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Remove source
    const [sourceColumn] = currentOrder.splice(sourceIndex, 1);

    // Insert at new position
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
    currentOrder.splice(insertIndex, 0, sourceColumn);

    visualInputs$.columnOrder.set(currentOrder);

    fileLog.debug('🔄 Columns reordered', { sourceColumnId, targetColumnId, insertBefore });
  }
};

// ====================================
// CONVENIENCE GETTERS
// ====================================

/**
 * Get effective width for a column - reads from computed state
 */
export const getColumnWidth = (columnId: string): number => {
  const state = visualState$.get();
  const layout = state.columnLayouts.find(col => col.id === columnId);
  return layout?.width || 150;
};

/**
 * Get column x-offset position - reads from computed state
 */
export const getColumnXOffset = (columnId: string): number => {
  const state = visualState$.get();
  const layout = state.columnLayouts.find(col => col.id === columnId);
  return layout?.xOffset || 0;
};

/**
 * Get visible columns in display order - reads from computed state
 */
export const getVisibleColumns = (): ColumnLayout[] => {
  return visualState$.get().visibleColumns;
};

/**
 * Get current viewport geometry - reads from computed state
 */
export const getViewportGeometry = (): ViewportGeometry => {
  return visualState$.get().geometry;
};