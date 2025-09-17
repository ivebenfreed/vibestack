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

import { computed, observable, batch, when, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { log } from '@/logger';
import type { Column, GroupConfig, SortConfig, VirtualRow } from '../types';
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

  // Sorting configuration
  sortBy: [] as SortConfig[],

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
  let cumulativeX = 70; // Start after drag column (30px) + row header (40px)
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
  const totalWidth = 70 + totalColumnsWidth; // drag column (30px) + row header (40px) + columns
  const totalHeight = inputs.rowCount * inputs.rowHeight;

  // DISABLED: Column virtualization to fix header/body sync issues after reordering
  // Always render ALL columns to maintain sync between header and body
  const startColIndex = 0;
  const endColIndex = visibleColumns.length;

  // DEBUG: Log column rendering status (virtualization disabled)
  if (inputs.scrollLeft > 0) {
    console.log('🔍 COLUMN RENDERING DEBUG (NO VIRTUALIZATION)', {
      scrollLeft: inputs.scrollLeft,
      viewportWidth: inputs.viewportWidth,
      scrollRightEdge: inputs.scrollLeft + inputs.viewportWidth,
      startColIndex,
      endColIndex,
      visibleColumnsCount: visibleColumns.length,
      renderAllColumns: true,
      firstColXOffset: visibleColumns[0]?.xOffset,
      lastColXOffset: visibleColumns[endColIndex - 1]?.xOffset,
      totalWidth: totalColumnsWidth
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

    // REMOVED: This was causing circular dependency - data observer fired on scroll
    // because scroll changes visual inputs, which triggers this computed, which sets
    // processedRows, which triggers data observer
    // visualInputs$.processedRows.set(processedRows);

    return computeVisualRows({ processedRows, columns, groupConfig });
  });
}

// ====================================
// VISUAL STATE SYNC STATUS (exported for persistence checking)
// ====================================

export let visualSyncStatus$: any = null;

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
    // Batch scroll updates to prevent observer from firing twice
    batch(() => {
      visualInputs$.scrollLeft.set(scrollLeft);
      visualInputs$.scrollTop.set(scrollTop);
    });

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
    // Debug: Check current values to see if this is actually a change
    const currentScrollLeft = visualInputs$.scrollLeft.get(true);
    const currentScrollTop = visualInputs$.scrollTop.get(true);

    if (currentScrollLeft === scrollLeft && currentScrollTop === scrollTop) {
      fileLog.debug('📜 Scroll event with same values - skipping update', { scrollLeft, scrollTop, source });
      return; // Skip update if values haven't changed
    }

    // Batch scroll updates to prevent observer from firing twice
    batch(() => {
      visualInputs$.scrollLeft.set(scrollLeft);
      visualInputs$.scrollTop.set(scrollTop);
    });

    fileLog.debug('📜 Viewport scrolled', { scrollLeft, scrollTop, source, changed: true });
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
   * Get current grouping configuration
   */
  getGroupConfig(): GroupConfig | null {
    return visualInputs$.groupConfig.get();
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
    const persistKey = `vibeGrid-visual-${entityType}-${orgId}-${userId}`;

    const syncObservableInstance = syncObservable(visualInputs$, {
      persist: {
        plugin: ObservablePersistLocalStorage,
        name: persistKey,
        transform: {
          load: (value: any) => {
            fileLog.debug('🔍 Loading visual state from persistence', { value, persistKey });

            // Handle missing or invalid data
            if (!value || typeof value !== 'object') {
              fileLog.warn('⚠️ No valid persisted state found, using defaults');
              return { ...visualInputs$.get(), ...defaultState };
            }

            // Merge with current state (in case schema changed)
            const currentInputs = visualInputs$.get();

            // Ensure sortBy is valid array
            const persistedSortBy = Array.isArray(value.sortBy) ? value.sortBy : [];
            const validSortBy = persistedSortBy.filter(item =>
              item && typeof item === 'object' && item.field && item.direction
            );

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
              columnOrder: value.columnOrder?.length ? value.columnOrder : defaultState.columnOrder,
              // Include group configuration in persistence
              groupConfig: value.groupConfig || null,
              // Include sort configuration in persistence - validated
              sortBy: validSortBy
            };

            fileLog.info('📁 Visual state loaded from persistence', {
              persistKey,
              columnsCount: merged.columns.length,
              persistedWidths: Object.keys(merged.columnWidths).length,
              visibleColumns: Object.values(merged.columnVisibility).filter(Boolean).length,
              hasGroupConfig: !!merged.groupConfig,
              groupFields: merged.groupConfig?.fields?.length || 0
            });

            return merged;
          },
          save: (value: any) => {
            // Ensure sortBy is valid before saving
            const validSortBy = Array.isArray(value.sortBy) ? value.sortBy.filter(item =>
              item && typeof item === 'object' && item.field && item.direction
            ) : [];

            // Only persist configuration state, not transient data
            const persistedState = {
              columnWidths: value.columnWidths || {},
              columnVisibility: value.columnVisibility || {},
              columnOrder: value.columnOrder || [],
              groupConfig: value.groupConfig || null,
              sortBy: validSortBy,
              entityType: value.entityType,
              orgId: value.orgId,
              userId: value.userId,
              version: '1.0',
              lastUpdated: new Date().toISOString()
            };

            fileLog.debug('💾 Saving visual state to persistence', {
              persistKey,
              hasGroupConfig: !!persistedState.groupConfig,
              groupFields: persistedState.groupConfig?.fields?.length || 0,
              columnCount: Object.keys(persistedState.columnWidths).length
            });

            return persistedState;
          }
        }
      }
    });

    // Initialize with default state (persistence will override if available)
    visualInputs$.set({ ...visualInputs$.get(), ...defaultState });

    // Add persistence debugging as recommended by Legend State docs
    const syncStatus$ = syncState(visualInputs$);

    // Create a custom persistence loaded tracker that waits for actual data loading
    const persistenceComplete$ = observable(false);

    // Export both sync status and our custom completion tracker for persistence checking in VibeGrid
    visualSyncStatus$ = {
      ...syncStatus$,
      isPersistenceDataLoaded: persistenceComplete$
    };

    // Wait for persistence to load, then log status and mark as complete
    when(syncStatus$.isPersistLoaded).then(() => {
      // Give the load transform a chance to complete
      setTimeout(() => {
        persistenceComplete$.set(true);
        fileLog.info('🎯 Columns observable persistence loaded', {
          entityType,
          orgId,
        userId,
        columnsCount: columns.length,
        persistKey,
        isPersistLoaded: syncStatus$.isPersistLoaded.get(),
        isPersistEnabled: syncStatus$.isPersistEnabled.get(),
        currentSortBy: visualInputs$.sortBy.get(),
        error: syncStatus$.error.get()
      });

      // Debug localStorage content
      try {
        const stored = localStorage.getItem(persistKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          fileLog.debug('📦 Persistence content check', {
            persistKey,
            hasSortBy: !!parsed.sortBy,
            sortByLength: Array.isArray(parsed.sortBy) ? parsed.sortBy.length : 0,
            sortBy: parsed.sortBy
          });
        }
      } catch (e) {
        fileLog.error('❌ Failed to check persistence content', e);
      }
      }, 10); // Small delay to allow load transform to complete
    });

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
      groupConfig: null, // Include groupConfig in default state
      sortBy: [], // Include sortBy in default state
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
  },

  /**
   * Show all columns - set all to visible
   */
  showAllColumns() {
    const columns = visualInputs$.columns.get();
    const allVisible = Object.fromEntries(
      columns.map(col => [col.id, true])
    );

    visualInputs$.columnVisibility.set(allVisible);
    fileLog.info('👁️ All columns shown', { columnCount: columns.length });
  },

  /**
   * Hide all columns except system columns
   */
  hideAllColumns() {
    const columns = visualInputs$.columns.get();
    const allHidden = Object.fromEntries(
      columns.map(col => [col.id, col.id === 'id' || col.id === '__selection']) // Keep ID and selection columns visible
    );

    visualInputs$.columnVisibility.set(allHidden);
    fileLog.info('🫥 All columns hidden (except system)', { columnCount: columns.length });
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

// ====================================
// COMPLETE GRID STATE OBSERVABLE
// ====================================

/**
 * Complete grid state interface - combines all state sources
 * This is the TRUE SINGLE SOURCE OF TRUTH for the entire grid
 */
export interface CompleteGridState {
  // Visual layout state (from visualState$)
  visual: VisualState;

  // Interaction state
  interaction: {
    selectedCells: Set<string>;
    selectAllCheckboxState: { checked: boolean; indeterminate: boolean };
    editingCell: string | null;
    editValue: string;
    isDragging: boolean;
    dragSource: string | null;
    dragTarget: string | null;
  };

  // Data state
  data: {
    processedRows: any[];
    sortBy: any[];
  };

  // Column resize state
  columnResize: {
    isResizing: boolean;
    columnId: string | null;
    newWidth: number | null;
  } | null;

  // Derived state for rendering decisions
  renderState: {
    shouldRenderHeader: boolean;
    shouldRenderBody: boolean;
    shouldUpdateSelection: boolean;
    shouldUpdateOverlays: boolean;
    hasDataChanges: boolean;
    hasLayoutChanges: boolean;
    hasInteractionChanges: boolean;
  };
}

/**
 * Create complete grid state observable - Legend State best practice
 * Combines all state sources into a single computed observable
 */
export function createCompleteGridState$(
  tableCore$: any,
  tableInteraction$: any,
  tableViewport$: any
) {
  fileLog.info('🎯 Creating complete grid state observable');

  // Previous state tracking for change detection
  let previousState: CompleteGridState | null = null;

  return computed((): CompleteGridState => {
    try {
      // Get all state in one computed - this creates the dependency tracking
      const visual = visualState$.get();
      const selectedCells = tableInteraction$.selectedCells.get();
      const selectAllCheckboxState = tableInteraction$.selectAllCheckboxState.get();
      const focusedCell = tableInteraction$.focusedCell.get();
      const editingCell = tableInteraction$.editingCell.get();
      const editValue = tableInteraction$.editValue.get();
      const isDragging = tableInteraction$.isDragging.get();
      const dragSource = tableInteraction$.dragSource.get();
      const dragTarget = tableInteraction$.dragTarget.get();
      const processedRows = tableCore$.processedRows.get(true); // shallow for performance
      const sortBy = tableCore$.sortBy.get(true); // shallow for performance
      const columnResize = tableInteraction$.columnResize.get();

    // Smart change detection - compare with previous state
    let hasLayoutChanges = true;
    let hasDataChanges = true;
    let hasInteractionChanges = true;

    if (previousState) {
      // Check layout changes (visual state)
      hasLayoutChanges =
        visual.columnLayouts.length !== previousState.visual.columnLayouts.length ||
        visual.geometry.totalWidth !== previousState.visual.geometry.totalWidth ||
        visual.geometry.scrollLeft !== previousState.visual.geometry.scrollLeft ||
        visual.geometry.scrollTop !== previousState.visual.geometry.scrollTop ||
        visual.geometry.viewportWidth !== previousState.visual.geometry.viewportWidth ||
        visual.geometry.viewportHeight !== previousState.visual.geometry.viewportHeight;

      // Check data changes (rows, sorting)
      hasDataChanges =
        processedRows.length !== previousState.data.processedRows.length ||
        sortBy.length !== previousState.data.sortBy.length ||
        JSON.stringify(sortBy.map(s => s.id)) !== JSON.stringify(previousState.data.sortBy.map(s => s.id));

      // Check interaction changes (selection, editing, drag, focus)
      hasInteractionChanges =
        selectedCells.size !== previousState.interaction.selectedCells.size ||
        focusedCell !== previousState.interaction.focusedCell ||
        editingCell !== previousState.interaction.editingCell ||
        isDragging !== previousState.interaction.isDragging ||
        dragSource !== previousState.interaction.dragSource;
    }

    // Calculate smart render state based on actual changes
    const renderState = {
      shouldRenderHeader: hasLayoutChanges, // Only render header when layout changes
      shouldRenderBody: hasLayoutChanges || hasDataChanges, // Render body for layout or data changes
      shouldUpdateSelection: hasInteractionChanges && selectedCells.size > 0,
      shouldUpdateOverlays: hasInteractionChanges || isDragging || editingCell !== null || columnResize !== null,
      hasDataChanges,
      hasLayoutChanges,
      hasInteractionChanges
    };

    const completeState: CompleteGridState = {
      visual,
      interaction: {
        selectedCells,
        selectAllCheckboxState,
        focusedCell,
        editingCell,
        editValue,
        isDragging,
        dragSource,
        dragTarget
      },
      data: {
        processedRows,
        sortBy
      },
      columnResize,
      renderState
    };

    fileLog.debug('🎯 Complete grid state computed', {
      visualColumns: visual.columnLayouts.length,
      dataRows: processedRows.length,
      selectedCells: selectedCells.size,
      isEditing: !!editingCell,
      isDragging,
      hasColumnResize: !!columnResize,
      changeDetection: {
        hasLayoutChanges,
        hasDataChanges,
        hasInteractionChanges,
        shouldRenderHeader: renderState.shouldRenderHeader,
        shouldRenderBody: renderState.shouldRenderBody,
        shouldUpdateOverlays: renderState.shouldUpdateOverlays
      }
    });

    // Update previous state for next change detection cycle
    previousState = completeState;

    return completeState;
    } catch (error) {
      fileLog.error('🚨 Error in createCompleteGridState$ computed', error);
      console.error('🚨 CRITICAL: VibeGrid createCompleteGridState$ error:', error);

      // Return minimal fallback state to prevent complete failure
      return {
        visual: {
          columnLayouts: [],
          visibleColumns: [],
          totalColumnsWidth: 0,
          geometry: {
            viewportWidth: 0,
            viewportHeight: 0,
            scrollLeft: 0,
            scrollTop: 0,
            totalWidth: 0,
            totalHeight: 0,
            visibleColumnRange: { start: 0, end: 0 },
            visibleRowRange: { start: 0, end: 0 }
          },
          headerScrollLeft: 0,
          bodyScrollLeft: 0,
          scrollSynchronized: false,
          visualRows: [],
          totalRowsHeight: 0,
          columnState: {
            columns: [],
            columnWidths: {},
            columnVisibility: {},
            columnOrder: [],
            entityType: '',
            orgId: '',
            userId: ''
          }
        },
        data: {
          processedRows: [],
          sortBy: []
        },
        interaction: {
          selectedCells: new Set(),
          selectAllCheckboxState: { checked: false, indeterminate: false },
          focusedCell: null,
          editingCell: null,
          editValue: '',
          isDragging: false,
          dragSource: null,
          dragTarget: null
        },
        columnResize: null,
        renderState: {
          hasLayoutChanges: false,
          hasDataChanges: false,
          hasInteractionChanges: false,
          shouldRenderHeader: false,
          shouldRenderBody: false,
          shouldUpdateOverlays: false
        }
      };
    }
  });
}