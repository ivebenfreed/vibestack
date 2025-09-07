/**
 * Simplified Table UI Store - Only UI State, No Data Duplication
 * 
 * This store ONLY manages UI rendering instructions:
 * - Column visibility/order/widths
 * - Sort configuration
 * - Filter configuration  
 * - Pagination settings
 * 
 * ALL DATA comes directly from Legend State via getEntity$()
 */

import { fromStore } from '@xstate/store';
import { uiLog } from '@/logger';
import type { GroupConfig, CellRef } from '../types';

const log = uiLog('components/custom/vibegrid/stores/table-ui-store-simplified.ts');

export interface TableUIState {
  entityType: string;
  columns: any[];
  // UI State Only - No Data
  sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>;
  filters: Array<{ field: string; operator: string; value: any }>;
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumnCount: number;
  groupBy: string[];
  groupConfig: GroupConfig | null;
  // Context menu state
  contextMenu: {
    isVisible: boolean;
    position: { x: number; y: number; clientX: number; clientY: number } | null;
    context: {
      type: 'cell' | 'header' | 'general';
      rowId?: string;
      columnId?: string;
    } | null;
  };
  // Status tracking
  loading: boolean;
  error: string | null;
  lastProcessedAt: number;
  // Pagination state
  pagination: {
    enabled: boolean;
    currentPage: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  } | null;
  // Selection state (UI-only)
  selection: {
    selectedCells: string[]; // Array instead of Set for serialization
    selectedRows: string[];  // Array instead of Set for serialization
    activeCell: CellRef | null;
    lastSelectedRowId: string | null;
    selectionMode: 'cell' | 'row' | 'range';
    anchor: CellRef | null;
  };
}

/**
 * Create a simplified table UI store that only manages rendering instructions
 * Data comes directly from Legend State - no duplication
 */
export function createTableUIStore(
  entityType: string,
  columns?: any[],
  persistedState?: Partial<TableUIState>
) {
  log.info(`🎨 UIStore: Creating simplified UI store for ${entityType}`, {
    columnCount: columns?.length || 0,
    hasPersisted: !!persistedState
  });

  const initialColumns = columns || [];

  return fromStore({
    context: {
      entityType,
      columns: initialColumns,
      // UI State Only - No entities, processedRows, originalRows
      sortBy: persistedState?.sortBy || [],
      filters: persistedState?.filters || [],
      columnVisibility: persistedState?.columnVisibility || Object.fromEntries(
        initialColumns.map(col => [col.id, true])
      ),
      columnOrder: persistedState?.columnOrder || initialColumns.map(col => col.id),
      columnWidths: persistedState?.columnWidths || {},
      hiddenColumnCount: 0,
      groupBy: persistedState?.groupBy || [],
      groupConfig: persistedState?.groupConfig || null,
      contextMenu: persistedState?.contextMenu || {
        isVisible: false,
        position: null,
        context: null
      },
      loading: false,
      error: null,
      lastProcessedAt: 0,
      pagination: persistedState?.pagination || null,
      selection: persistedState?.selection || {
        selectedCells: [],
        selectedRows: [],
        activeCell: null,
        lastSelectedRowId: null,
        selectionMode: 'cell',
        anchor: null
      }
    },

    on: {
      // Initialize UI state only
      initialize: {
        loading: false,
        error: null,
        lastProcessedAt: Date.now(),
        columnVisibility: (context) => {
          if (initialColumns.length > 0 && Object.keys(context.columnVisibility).length === 0) {
            return Object.fromEntries(initialColumns.map(col => [col.id, true]));
          }
          return context.columnVisibility;
        },
        columnOrder: (context) => {
          if (initialColumns.length > 0 && context.columnOrder.length === 0) {
            return initialColumns.map(col => col.id);
          }
          return context.columnOrder;
        },
        hiddenColumnCount: (context) => {
          return Object.values(context.columnVisibility).filter(v => !v).length;
        }
      },

      // Column Visibility - Pure UI State
      toggleColumnVisibility: {
        columnVisibility: (context, event: { columnId: string }) => {
          const currentVisibility = context.columnVisibility[event.columnId];
          const isCurrentlyVisible = currentVisibility !== false;
          
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !isCurrentlyVisible
          };
          
          log.info('🎨 UIStore: Column visibility toggled', {
            columnId: event.columnId,
            wasVisible: isCurrentlyVisible,
            nowVisible: !isCurrentlyVisible
          });
          
          return newVisibility;
        },
        hiddenColumnCount: (context, event: { columnId: string }) => {
          const currentVisibility = context.columnVisibility[event.columnId];
          const isCurrentlyVisible = currentVisibility !== false;
          const newVisibility = {
            ...context.columnVisibility,
            [event.columnId]: !isCurrentlyVisible
          };
          return Object.values(newVisibility).filter(v => v === false).length;
        }
      },

      setColumnVisibility: {
        columnVisibility: (context, event: { columnVisibility: Record<string, boolean> }) => {
          log.info('🎨 UIStore: Column visibility set', {
            visibleCount: Object.values(event.columnVisibility).filter(v => v).length,
            hiddenCount: Object.values(event.columnVisibility).filter(v => !v).length
          });
          return event.columnVisibility;
        },
        hiddenColumnCount: (context, event: { columnVisibility: Record<string, boolean> }) => {
          return Object.values(event.columnVisibility).filter(v => !v).length;
        }
      },

      showAllColumns: {
        columnVisibility: (context) => {
          const allVisible = Object.fromEntries(
            Object.keys(context.columnVisibility).map(col => [col, true])
          );
          log.info('🎨 UIStore: All columns shown');
          return allVisible;
        },
        hiddenColumnCount: () => 0
      },

      hideAllColumns: {
        columnVisibility: (context) => {
          const allHidden = Object.fromEntries(
            Object.keys(context.columnVisibility).map(col => [col, false])
          );
          log.info('🎨 UIStore: All columns hidden');
          return allHidden;
        },
        hiddenColumnCount: (context) => Object.keys(context.columnVisibility).length
      },

      // Sorting - Pure UI State
      setSortBy: {
        sortBy: (context, event: { sortBy: Array<{ field: string; direction: 'asc' | 'desc' }> }) => {
          log.info('🎨 UIStore: Sort configuration set', {
            sortFields: event.sortBy.map(s => `${s.field}:${s.direction}`)
          });
          return event.sortBy;
        },
        lastProcessedAt: Date.now()
      },

      clearSort: {
        sortBy: () => {
          log.info('🎨 UIStore: Sort cleared');
          return [];
        },
        lastProcessedAt: Date.now()
      },

      // Filtering - Pure UI State  
      setFilters: {
        filters: (context, event: { filters: Array<{ field: string; operator: string; value: any }> }) => {
          log.info('🎨 UIStore: Filters set', {
            filterCount: event.filters.length,
            filterFields: event.filters.map(f => f.field)
          });
          return event.filters;
        },
        lastProcessedAt: Date.now()
      },

      // Column Order - Pure UI State
      reorderColumns: {
        columnOrder: (context, event: { columnOrder: string[] }) => {
          log.info('🎨 UIStore: Column order updated', {
            newOrder: event.columnOrder.slice(0, 3).join(', ') + '...'
          });
          return event.columnOrder;
        }
      },

      // Column Widths - Pure UI State
      setColumnWidth: {
        columnWidths: (context, event: { columnId: string; width: number }) => {
          log.info('🎨 UIStore: Column width set', {
            columnId: event.columnId,
            width: event.width
          });
          return {
            ...context.columnWidths,
            [event.columnId]: event.width
          };
        }
      },

      // Pagination - Pure UI State
      setPagination: {
        pagination: (context, event: { pagination: TableUIState['pagination'] }) => {
          log.info('🎨 UIStore: Pagination updated', {
            enabled: event.pagination?.enabled,
            currentPage: event.pagination?.currentPage,
            pageSize: event.pagination?.pageSize
          });
          return event.pagination;
        }
      },

      // Error handling
      setError: {
        error: (context, event: { error: string }) => {
          log.error('🎨 UIStore: Error set', { error: event.error });
          return event.error;
        },
        loading: false
      },

      clearError: {
        error: () => null
      },

      // Group Configuration - Pure UI State
      setGroupConfig: {
        groupConfig: (context, event: { groupConfig: GroupConfig | null }) => {
          log.info('🎨 UIStore: Group configuration set', {
            hasConfig: !!event.groupConfig,
            fieldCount: event.groupConfig?.fields?.length || 0
          });
          return event.groupConfig;
        },
        lastProcessedAt: Date.now()
      },

      // Loading state
      setLoading: {
        loading: (context, event: { loading: boolean }) => event.loading
      },

      // Selection state management (moved from table machine)
      selectCell: {
        selection: (context, event: { rowId: string; columnId: string; ctrlKey?: boolean; shiftKey?: boolean }) => {
          const cellKey = `${event.rowId}:${event.columnId}`;
          const selection = { ...context.selection };
          
          if (event.ctrlKey) {
            // Toggle selection with Ctrl
            const selectedCells = [...selection.selectedCells];
            const index = selectedCells.indexOf(cellKey);
            if (index >= 0) {
              selectedCells.splice(index, 1);
            } else {
              selectedCells.push(cellKey);
            }
            selection.selectedCells = selectedCells;
          } else {
            // Single selection
            selection.selectedCells = [cellKey];
            selection.selectedRows = []; // Clear row selection
          }
          
          selection.activeCell = { rowId: event.rowId, columnId: event.columnId };
          if (!event.shiftKey) {
            selection.anchor = { rowId: event.rowId, columnId: event.columnId };
          }
          
          log.info('🎨 UIStore: Cell selected', {
            cellKey,
            selectionCount: selection.selectedCells.length
          });
          
          return selection;
        }
      },

      toggleRowSelection: {
        selection: (context, event: { rowId: string }) => {
          const selection = { ...context.selection };
          const selectedRows = [...selection.selectedRows];
          const index = selectedRows.indexOf(event.rowId);
          
          if (index >= 0) {
            selectedRows.splice(index, 1);
          } else {
            selectedRows.push(event.rowId);
          }
          
          selection.selectedRows = selectedRows;
          selection.lastSelectedRowId = event.rowId;
          
          log.info('🎨 UIStore: Row selection toggled', {
            rowId: event.rowId,
            selectedCount: selectedRows.length
          });
          
          return selection;
        }
      },

      clearSelection: {
        selection: (context) => {
          log.info('🎨 UIStore: Selection cleared');
          return {
            selectedCells: [],
            selectedRows: [],
            activeCell: null,
            lastSelectedRowId: null,
            selectionMode: 'cell' as const,
            anchor: null
          };
        }
      },

      selectAllRows: {
        selection: (context, event: { allRowIds: string[] }) => {
          log.info('🎨 UIStore: All rows selected', {
            rowCount: event.allRowIds.length
          });
          return {
            ...context.selection,
            selectedRows: [...event.allRowIds],
            selectedCells: [] // Clear cell selection when selecting all rows
          };
        }
      }
    }
  });
}