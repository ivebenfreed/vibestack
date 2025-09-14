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

import { computed, observable, batch } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { log } from '@/logger';
import type { Column, GroupConfig, VirtualRow } from '../types';
import { GroupProcessor } from '../processors/GroupProcessor';

const fileLog = log('components/custom/vibegrid/stores/visual-state.ts');

// ====================================
// CORE VISUAL STATE TYPES
// ====================================

// Column state types (merged from columns-observable)
export interface ColumnState {
  // Core column data (from schema)
  columns: Column[];

  // User preferences (persisted)
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];

  // Metadata
  entityType: string;
  orgId: string;
  userId: string;
}

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

  // Virtual rows (with grouping applied) - merged from visual-rows-state
  visualRows: VirtualRow[];
  totalRowsHeight: number;

  // Column management state (merged from columns-observable)
  columnState: ColumnState;
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

  // Grouping configuration
  groupConfig: null as GroupConfig | null,

  // Entity context
  entityType: '',
  orgId: '',
  userId: '',

  // Processed data rows (input for visual rows)
  processedRows: [] as any[]
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
  const totalWidth = 40 + totalColumnsWidth; // row header + columns (no end buffer needed)
  const totalHeight = inputs.rowCount * inputs.rowHeight;

  // Calculate visible ranges
  const startColIndexResult = visibleColumns.findIndex(col => col.xOffset + col.width > inputs.scrollLeft);
  const startColIndex = Math.max(0, startColIndexResult === -1 ? 0 : startColIndexResult);

  const endColIndexResult = visibleColumns.findIndex(col => col.xOffset > inputs.scrollLeft + inputs.viewportWidth);
  const endColIndex = Math.min(visibleColumns.length, endColIndexResult === -1 ? visibleColumns.length : endColIndexResult + 1);

  // DEBUG: Log column virtualization calculations
  if (inputs.scrollLeft > 0) {
    console.log('🔍 COLUMN VIRTUALIZATION DEBUG', {
      scrollLeft: inputs.scrollLeft,
      viewportWidth: inputs.viewportWidth,
      scrollRightEdge: inputs.scrollLeft + inputs.viewportWidth,
      startColIndexResult,
      startColIndex,
      endColIndexResult,
      endColIndex,
      visibleColumnsCount: visibleColumns.length,
      virtualRangeCount: endColIndex - startColIndex,
      firstColXOffset: visibleColumns[0]?.xOffset,
      startColXOffset: visibleColumns[startColIndex]?.xOffset,
      endColXOffset: visibleColumns[endColIndex - 1]?.xOffset,
      columnOffsets: visibleColumns.slice(Math.max(0, startColIndex - 2), endColIndex + 2).map(col => ({
        id: col.id,
        xOffset: col.xOffset,
        width: col.width,
        rightEdge: col.xOffset + col.width
      }))
    });
  }

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
    scrollSynchronized: true, // Always true when computed properly
    visualRows: computeVisualRows(inputs),
    totalRowsHeight: totalHeight,
    columnState: {
      columns: inputs.columns,
      columnWidths: inputs.columnWidths,
      columnVisibility: inputs.columnVisibility,
      columnOrder: inputs.columnOrder,
      entityType: inputs.entityType,
      orgId: inputs.orgId,
      userId: inputs.userId
    }
  };
});

// ====================================
// VISUAL ROWS COMPUTATION (merged from visual-rows-state)
// ====================================

/**
 * Compute visual rows with grouping applied
 */
function computeVisualRows(inputs: any): VirtualRow[] {
  const { processedRows, columns, groupConfig } = inputs;

  // If no grouping, return processedRows as-is
  if (!groupConfig || !groupConfig.fields || groupConfig.fields.length === 0) {
    fileLog.debug('No grouping configured, returning raw rows', {
      rowCount: processedRows.length
    });

    // Convert to virtual rows format for consistency
    return processedRows.map((row: any, index: number) => ({
      type: 'data' as const,
      id: row.id,
      index,
      height: 40,
      data: row
    }));
  }

  // Apply grouping using GroupProcessor
  fileLog.info('🎯 Applying grouping with GroupProcessor', {
    rowCount: processedRows.length,
    groupFields: groupConfig.fields.map((f: any) => f.field),
    expandedGroups: Array.from(groupConfig.expandedGroups)
  });

  const groupResult = GroupProcessor.processData(
    processedRows,
    columns,
    groupConfig
  );

  fileLog.info('✅ Grouping applied', {
    originalRows: processedRows.length,
    virtualRows: groupResult.virtualRows.length,
    groupCount: groupResult.groupCount,
    totalHeight: groupResult.totalHeight
  });

  return groupResult.virtualRows;
}

// ====================================
// VISUAL ROWS OPERATIONS (merged from visual-rows-state)
// ====================================

export const visualRowsOperations = {
  /**
   * Check if a row is a group header
   */
  isGroupRow(row: VirtualRow): boolean {
    return row.type === 'group';
  },

  /**
   * Check if a row is a data row
   */
  isDataRow(row: VirtualRow): boolean {
    return row.type === 'data';
  },

  /**
   * Get the actual data from a visual row
   */
  getRowData(row: VirtualRow): any {
    return row.data;
  },

  /**
   * Get the nesting level of a row (for indentation)
   */
  getRowLevel(row: VirtualRow): number {
    return row.level || 0;
  },

  /**
   * Calculate total height of all visual rows
   */
  calculateTotalHeight(rows: VirtualRow[]): number {
    return rows.reduce((sum, row) => sum + row.height, 0);
  }
};

// ====================================
// CREATE VISUAL ROWS COMPUTED (exported function from visual-rows-state)
// ====================================

/**
 * Create a computed observable for visual rows that applies grouping
 * to the processed data rows from data-state
 */
export function createVisualRows$(
  processedRows$: { get: () => any[] },
  columns$: { get: () => any[] }
) {
  return computed(() => {
    const processedRows = processedRows$.get();
    const columns = columns$.get();
    const groupConfig = visualInputs$.groupConfig.get();

    // Update the processed rows in visual inputs for the main computed to use
    visualInputs$.processedRows.set(processedRows);

    return computeVisualRows({ processedRows, columns, groupConfig });
  });
}

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
      groupConfig: null,
      entityType,
      orgId,
      userId,
      processedRows: []
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


  // ====================================
  // VIEWPORT OPERATIONS (Consolidated from ViewportManager)
  // ====================================

  /**
   * Handle viewport scroll with proper sync between header and body
   */
  handleViewportScroll(scrollLeft: number, scrollTop: number, source: 'header' | 'body' = 'body') {
    visualInputs$.scrollLeft.set(scrollLeft);
    visualInputs$.scrollTop.set(scrollTop);

    fileLog.debug('📜 Viewport scrolled', { scrollLeft, scrollTop, source });
  },

  /**
   * Update viewport size and trigger recalculation
   */
  updateViewportDimensions(width: number, height: number) {
    visualInputs$.viewportWidth.set(width);
    visualInputs$.viewportHeight.set(height);

    fileLog.debug('📐 Viewport dimensions updated', { width, height });
  },

  /**
   * Get current visible column range based on scroll position
   */
  getVisibleColumnRange(): { start: number; end: number } {
    const state = visualState$.get();
    return state.geometry.visibleColumnRange;
  },

  /**
   * Get current visible row range based on scroll position
   */
  getVisibleRowRange(): { start: number; end: number } {
    const state = visualState$.get();
    return state.geometry.visibleRowRange;
  },

  /**
   * Check if a specific column is in the visible viewport
   */
  isColumnInViewport(columnId: string): boolean {
    const state = visualState$.get();
    const column = state.columnLayouts.find(c => c.id === columnId);
    if (!column || !column.visible) return false;

    const scrollLeft = state.geometry.scrollLeft;
    const viewportWidth = state.geometry.viewportWidth;

    return column.xOffset < scrollLeft + viewportWidth &&
           column.xOffset + column.width > scrollLeft;
  },

  /**
   * Scroll to make a specific column visible
   */
  scrollToColumn(columnId: string) {
    const state = visualState$.get();
    const column = state.columnLayouts.find(c => c.id === columnId);
    if (!column || !column.visible) return;

    const scrollLeft = state.geometry.scrollLeft;
    const viewportWidth = state.geometry.viewportWidth;

    // Check if column is already visible
    if (column.xOffset >= scrollLeft &&
        column.xOffset + column.width <= scrollLeft + viewportWidth) {
      return; // Already visible
    }

    // Scroll to make column visible
    let newScrollLeft = scrollLeft;
    if (column.xOffset < scrollLeft) {
      // Column is to the left of viewport
      newScrollLeft = column.xOffset;
    } else if (column.xOffset + column.width > scrollLeft + viewportWidth) {
      // Column is to the right of viewport
      newScrollLeft = column.xOffset + column.width - viewportWidth;
    }

    visualInputs$.scrollLeft.set(newScrollLeft);
    fileLog.debug('📜 Scrolled to column', { columnId, newScrollLeft });
  },

  /**
   * Scroll to make a specific row visible
   */
  scrollToRow(rowIndex: number) {
    const rowHeight = visualInputs$.rowHeight.get();
    const scrollTop = visualInputs$.scrollTop.get();
    const viewportHeight = visualInputs$.viewportHeight.get();

    const rowTop = rowIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;

    // Check if row is already visible
    if (rowTop >= scrollTop && rowBottom <= scrollTop + viewportHeight) {
      return; // Already visible
    }

    // Scroll to make row visible
    let newScrollTop = scrollTop;
    if (rowTop < scrollTop) {
      // Row is above viewport
      newScrollTop = rowTop;
    } else if (rowBottom > scrollTop + viewportHeight) {
      // Row is below viewport
      newScrollTop = rowBottom - viewportHeight;
    }

    visualInputs$.scrollTop.set(newScrollTop);
    fileLog.debug('📜 Scrolled to row', { rowIndex, newScrollTop });
  },

  // ====================================
  // GROUPING OPERATIONS
  // ====================================

  /**
   * Set grouping configuration
   */
  setGroupConfig(config: GroupConfig | null) {
    visualInputs$.groupConfig.set(config);
    fileLog.info('🎯 Group config updated', { config });
  },

  /**
   * Toggle group expansion/collapse
   */
  toggleGroupExpansion(groupId: string) {
    const groupConfig = visualInputs$.groupConfig.get();
    if (!groupConfig) return;

    const expandedGroups = new Set(groupConfig.expandedGroups);

    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
      fileLog.info('🎯 Group collapsed', { groupId });
    } else {
      expandedGroups.add(groupId);
      fileLog.info('🎯 Group expanded', { groupId });
    }

    visualInputs$.groupConfig.set({
      ...groupConfig,
      expandedGroups
    } as GroupConfig);
  },

  /**
   * Expand all groups
   */
  expandAllGroups() {
    const groupConfig = visualInputs$.groupConfig.get();
    if (!groupConfig) return;

    // Get all group IDs from the visual rows
    const visualRows = visualState$.get().visualRows;
    const allGroupIds = new Set<string>();

    visualRows.forEach(row => {
      if (row.type === 'group') {
        allGroupIds.add(row.id);
      }
    });

    visualInputs$.groupConfig.set({
      ...groupConfig,
      expandedGroups: allGroupIds
    });

    fileLog.info('🎯 All groups expanded', { count: allGroupIds.size });
  },

  /**
   * Collapse all groups
   */
  collapseAllGroups() {
    const groupConfig = visualInputs$.groupConfig.get();
    if (!groupConfig) return;

    visualInputs$.groupConfig.set({
      ...groupConfig,
      expandedGroups: new Set()
    } as GroupConfig);

    fileLog.info('🎯 All groups collapsed');
  },

  // ====================================
  // COLUMN OPERATIONS (merged from columns-observable)
  // ====================================

  /**
   * Initialize columns with data and user/org context with persistence
   */
  initializeColumns(
    columns: Column[],
    entityType: string,
    orgId: string,
    userId: string
  ) {
    const defaultState = this.createDefaultColumnState(columns, entityType, orgId, userId);

    // Set up persistence based on entity type, org, and user
    const persistKey = `vibeGrid-columns-${entityType}-${orgId}-${userId}`;

    syncObservable(visualInputs$, {
      persist: {
        plugin: ObservablePersistLocalStorage,
        name: persistKey,
        transform: {
          load: (value: any) => {
            if (!value) return { ...visualInputs$.get(), ...defaultState };

            // Merge with current state (in case schema changed)
            const currentInputs = visualInputs$.get();
            const merged = {
              ...currentInputs,
              ...value,
              columns: defaultState.columns, // Always use fresh columns from schema
              // Preserve user preferences but add defaults for new columns
              columnWidths: {
                ...defaultState.columnWidths,
                ...value.columnWidths
              },
              columnVisibility: {
                ...defaultState.columnVisibility,
                ...value.columnVisibility
              },
              columnOrder: value.columnOrder?.length ? value.columnOrder : defaultState.columnOrder
            };

            fileLog.info('📁 Columns state loaded from persistence', {
              persistKey,
              columnsCount: merged.columns.length,
              persistedWidths: Object.keys(merged.columnWidths).length,
              visibleColumns: Object.values(merged.columnVisibility).filter(Boolean).length
            });

            return merged;
          }
        }
      }
    });

    // Initialize with default state (persistence will override if available)
    visualInputs$.set({ ...visualInputs$.get(), ...defaultState });

    fileLog.info('🎯 Columns observable initialized', {
      entityType,
      orgId,
      userId,
      columnsCount: columns.length,
      persistKey
    });
  },

  /**
   * Create default column state
   */
  createDefaultColumnState(
    columns: Column[],
    entityType: string,
    orgId: string,
    userId: string
  ) {
    return {
      columns,
      columnWidths: Object.fromEntries(columns.map(col => [col.id, col.width || 150])),
      columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
      columnOrder: columns.map(col => col.id),
      entityType,
      orgId,
      userId
    };
  },

  /**
   * Get effective width for a column - SINGLE SOURCE OF TRUTH
   */
  getColumnWidth(columnId: string): number {
    const { columnWidths, columns } = visualInputs$.get();

    // 1. Try persisted user preference
    if (columnWidths[columnId] != null) {
      return columnWidths[columnId];
    }

    // 2. Fall back to column schema default
    const column = columns.find(c => c.id === columnId);
    if (column?.width != null) {
      return column.width;
    }

    // 3. Final fallback
    return 150;
  },

  /**
   * Update column width during resize (with batching)
   */
  updateColumnWidth(columnId: string, width: number) {
    batch(() => {
      const currentWidths = visualInputs$.columnWidths.get();
      visualInputs$.columnWidths.set({
        ...currentWidths,
        [columnId]: width
      });
    });

    fileLog.debug('📏 Column width updated', { columnId, width });
  },

  /**
   * Toggle column visibility
   */
  toggleColumnVisibility(columnId: string) {
    const currentVisibility = visualInputs$.columnVisibility.get();
    const newVisibility = !currentVisibility[columnId];

    visualInputs$.columnVisibility.set({
      ...currentVisibility,
      [columnId]: newVisibility
    });

    fileLog.info('👁️ Column visibility toggled', { columnId, visible: newVisibility });
  },

  /**
   * Reorder columns
   */
  reorderColumns(sourceColumnId: string, targetColumnId: string, insertBefore: boolean = true) {
    batch(() => {
      const currentOrder = [...visualInputs$.columnOrder.get()];
      const sourceIndex = currentOrder.indexOf(sourceColumnId);
      const targetIndex = currentOrder.indexOf(targetColumnId);

      if (sourceIndex === -1 || targetIndex === -1) {
        fileLog.warn('⚠️ Column reorder failed: column not found', {
          sourceColumnId,
          targetColumnId,
          sourceIndex,
          targetIndex
        });
        return;
      }

      // Remove source column
      const [sourceColumn] = currentOrder.splice(sourceIndex, 1);

      // Recalculate target index after removal
      const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

      // Insert at appropriate position
      const insertIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
      currentOrder.splice(insertIndex, 0, sourceColumn);

      visualInputs$.columnOrder.set(currentOrder);

      fileLog.info('🔄 Column reordered', {
        sourceColumnId,
        targetColumnId,
        insertBefore,
        newOrder: currentOrder
      });
    });
  },

  /**
   * Reset all column preferences to defaults
   */
  resetColumns() {
    const { columns, entityType, orgId, userId } = visualInputs$.get();
    const defaultState = this.createDefaultColumnState(columns, entityType, orgId, userId);

    batch(() => {
      visualInputs$.columnWidths.set(defaultState.columnWidths);
      visualInputs$.columnVisibility.set(defaultState.columnVisibility);
      visualInputs$.columnOrder.set(defaultState.columnOrder);
    });

    fileLog.info('🔄 Columns reset to defaults', {
      columnsCount: columns.length
    });
  }
};

// ====================================
// COMPUTED VALUES FROM COLUMNS (merged from columns-observable)
// ====================================

/**
 * Get all visible columns in display order
 */
export const visibleColumns$ = computed(() => {
  const { columns, columnVisibility, columnOrder } = visualInputs$.get();

  return columnOrder
    .map(id => columns.find(col => col.id === id))
    .filter((col): col is Column => col !== undefined && columnVisibility[col.id] !== false);
});

/**
 * Get total width of all visible columns (separate from visualState$ for performance)
 */
export const totalColumnsWidth$ = computed(() => {
  const visibleCols = visibleColumns$.get();
  const columnWidths = visualInputs$.columnWidths.get();

  return visibleCols.reduce((total, col) => {
    const width = columnWidths[col.id] || col.width || 150;
    return total + width;
  }, 0);
});

// ====================================
// UTILITY FUNCTIONS (merged from columns-observable)
// ====================================

/**
 * Get column widths for a list of columns (bulk operation)
 */
export const getColumnWidths = (columnIds: string[]): Record<string, number> => {
  return Object.fromEntries(
    columnIds.map(id => [id, visualOperations.getColumnWidth(id)])
  );
};

/**
 * Check if a column is visible
 */
export const isColumnVisible = (columnId: string): boolean => {
  return visualInputs$.columnVisibility.get()[columnId] !== false;
};

/**
 * Get visible column count
 */
export const getVisibleColumnCount = (): number => {
  const visibility = visualInputs$.columnVisibility.get();
  return Object.values(visibility).filter(Boolean).length;
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