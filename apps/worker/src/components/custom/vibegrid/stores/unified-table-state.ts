/**
 * Unified Table State - Perfect Reactive Sync
 * 
 * Everything is observable:
 * - UI state (sort, filter, columns, grouping)
 * - Legend State data (entity records)
 * - Computed view (perfectly synchronized)
 * 
 * No bridges, no data duplication, just reactive flow.
 */

import { observable, computed, observe, batch } from '@legendapp/state';
import { getEntity$ } from '@/legend-state/observables';
import { uiLog } from '@/logger';
import type { Column, GroupConfig, SortConfig, FilterConfig } from '../types';

const log = uiLog('components/custom/vibegrid/stores/unified-table-state.ts');

// ====================================
// TYPES
// ====================================

export interface TableState {
  // UI State (all reactive)
  sortBy: SortConfig[];
  filters: FilterConfig[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  groupConfig: GroupConfig | null;
  
  // Selection state (reactive)
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  anchorCell: { rowId: string; columnId: string } | null;
  selectionMode: 'cell' | 'row' | 'range' | 'multi';
  isSelecting: boolean;
  
  // Editing state (reactive)
  editingCell: { rowId: string; columnId: string } | null;
  editValue: any;
  isEditing: boolean;
  editValidation: { isValid: boolean; message?: string } | null;
  
  // Data (computed from Legend State)
  data: any; // Will be computed
  
  // Complete synchronized view (computed)
  view: any; // Will be computed
}

export interface TableView {
  rows: any[];
  columns: Column[];
  visibleColumns: Column[];
  totalCount: number;
  hasData: boolean;
  // UI state included for renderer
  sortBy: SortConfig[];
  filters: FilterConfig[];
  groupConfig: GroupConfig | null;
  // Selection state for renderer
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  anchorCell: { rowId: string; columnId: string } | null;
  selectionMode: 'cell' | 'row' | 'range' | 'multi';
  isSelecting: boolean;
  // Editing state for renderer
  editingCell: { rowId: string; columnId: string } | null;
  editValue: any;
  isEditing: boolean;
  editValidation: { isValid: boolean; message?: string } | null;
}

// ====================================
// PURE TRANSFORMATION FUNCTIONS
// ====================================

function applyFilters(rows: any[], filters: FilterConfig[]): any[] {
  if (!filters || filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data ? row.data[filter.field] : row[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
        case 'endsWith':
          return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(filter.value);
        case 'gte':
          return Number(value) >= Number(filter.value);
        case 'lt':
          return Number(value) < Number(filter.value);
        case 'lte':
          return Number(value) <= Number(filter.value);
        case 'isEmpty':
          return value == null || String(value).trim() === '';
        case 'isNotEmpty':
          return value != null && String(value).trim() !== '';
        default:
          return true;
      }
    });
  });
}

function applySorting(rows: any[], sortBy: SortConfig[]): any[] {
  if (!sortBy || sortBy.length === 0) return rows;
  
  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a.data ? a.data[sort.field] : a[sort.field];
      const bValue = b.data ? b.data[sort.field] : b[sort.field];
      
      // Handle null/undefined
      if (aValue == null && bValue == null) continue;
      if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
      
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        comparison = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      }
      
      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
}

async function applyGrouping(rows: any[], groupConfig: GroupConfig): Promise<any[]> {
  if (!groupConfig || !groupConfig.fields || groupConfig.fields.length === 0) {
    return rows;
  }
  
  // Dynamic import GroupProcessor for grouping
  try {
    const { GroupProcessor } = await import('../processors/GroupProcessor');
    const result = GroupProcessor.processData(rows, [], groupConfig);
    return result.virtualRows || rows;
  } catch (error) {
    log.error('Failed to apply grouping', error);
    return rows;
  }
}

function getVisibleColumns(columns: Column[], columnVisibility: Record<string, boolean>): Column[] {
  return columns.filter(col => 
    col.id !== '__selection' && columnVisibility[col.id] !== false
  );
}

// ====================================
// CREATE UNIFIED TABLE STATE
// ====================================

export function createTableState$(
  entityType: string,
  columns: Column[],
  initialState?: Partial<TableState>
) {
  log.info('🎯 UnifiedState: Creating reactive table state', {
    entityType,
    columnCount: columns.length
  });
  
  // Get Legend State entity observable
  const entity$ = getEntity$(entityType);
  
  // Create the unified observable state following Legend State best practices
  const tableState$ = observable({
    // UI State (all reactive, can be updated by XState events)
    sortBy: initialState?.sortBy || [],
    filters: initialState?.filters || [],
    columnVisibility: initialState?.columnVisibility || 
      Object.fromEntries(columns.map(col => [col.id, true])),
    columnOrder: initialState?.columnOrder || columns.map(col => col.id),
    groupConfig: initialState?.groupConfig || null,
    
    // Selection state (all reactive)
    selectedCells: initialState?.selectedCells || new Set<string>(),
    selectedRows: initialState?.selectedRows || new Set<string>(),
    anchorCell: initialState?.anchorCell || null,
    selectionMode: initialState?.selectionMode || 'cell',
    isSelecting: initialState?.isSelecting || false,
    
    // Editing state (all reactive)
    editingCell: initialState?.editingCell || null,
    editValue: initialState?.editValue || null,
    isEditing: initialState?.isEditing || false,
    editValidation: initialState?.editValidation || null,
    
    // Data (lazy computed from Legend State - following best practice)
    data: () => {
      const entityData = entity$.get();
      log.info('🎯 UnifiedState: Data computed', {
        entityType,
        recordCount: entityData ? Object.keys(entityData).length : 0
      });
      return entityData || {};
    },
    
    // The perfect synchronized view (lazy computed function - best practice)
    view: function() {
      // Get current state values - this tracks dependencies automatically
      const data = tableState$.data.get();
      const sortBy = tableState$.sortBy.get();
      const filters = tableState$.filters.get();
      const columnVisibility = tableState$.columnVisibility.get();
      const groupConfig = tableState$.groupConfig.get();
      
      // Get all selection state
      const selectedCells = tableState$.selectedCells.get();
      const selectedRows = tableState$.selectedRows.get();
      const anchorCell = tableState$.anchorCell.get();
      const selectionMode = tableState$.selectionMode.get();
      const isSelecting = tableState$.isSelecting.get();
      
      // Get all editing state
      const editingCell = tableState$.editingCell.get();
      const editValue = tableState$.editValue.get();
      const isEditing = tableState$.isEditing.get();
      const editValidation = tableState$.editValidation.get();
      
      // Convert data to rows
      let rows = Object.values(data).map((entity: any) => ({
        id: entity.id,
        data: entity,
        metadata: {
          isSelected: selectedRows.has(entity.id),
          isDirty: false,
          isGroup: false,
          level: 0
        }
      }));
      
      // Apply transformations in sequence
      rows = applyFilters(rows, filters);
      rows = applySorting(rows, sortBy);
      
      // Apply grouping if configured (keep synchronous for computed)
      if (groupConfig && groupConfig.fields && groupConfig.fields.length > 0) {
        // For now, skip grouping in computed - will handle separately
        // rows = applyGrouping(rows, groupConfig);
      }
      
      // Get visible columns
      const visibleColumns = getVisibleColumns(columns, columnVisibility);
      
      log.info('🎯 UnifiedState: View computed', {
        entityType,
        rowCount: rows.length,
        visibleColumnCount: visibleColumns.length,
        hasSort: sortBy.length > 0,
        hasFilters: filters.length > 0,
        hasGrouping: !!groupConfig?.fields?.length
      });
      
      // Return complete synchronized view
      return {
        rows,
        columns,
        visibleColumns,
        totalCount: rows.length,
        hasData: rows.length > 0,
        // Include UI state for renderer
        sortBy,
        filters,
        groupConfig,
        // Selection state for perfect sync
        selectedCells,
        selectedRows,
        anchorCell,
        selectionMode,
        isSelecting,
        // Editing state for perfect sync
        editingCell,
        editValue,
        isEditing,
        editValidation,
        // Metadata
        entityType,
        timestamp: Date.now()
      } as TableView;
    }
  });
  
  return tableState$;
}

// ====================================
// UI STATE UPDATERS (for XState events)
// ====================================

export const tableStateUpdaters = {
  toggleSort(tableState$: any, field: string) {
    const sortBy = tableState$.sortBy.get();
    const existingIndex = sortBy.findIndex((s: SortConfig) => s.field === field);
    
    if (existingIndex === -1) {
      // Add new sort
      tableState$.sortBy.set([...sortBy, { field, direction: 'asc' }]);
    } else if (sortBy[existingIndex].direction === 'asc') {
      // Toggle to desc
      const newSort = [...sortBy];
      newSort[existingIndex] = { field, direction: 'desc' };
      tableState$.sortBy.set(newSort);
    } else {
      // Remove sort
      tableState$.sortBy.set(sortBy.filter((_: any, i: number) => i !== existingIndex));
    }
  },
  
  setFilters(tableState$: any, filters: FilterConfig[]) {
    tableState$.filters.set(filters);
  },
  
  addFilter(tableState$: any, filter: FilterConfig) {
    const filters = tableState$.filters.get();
    tableState$.filters.set([...filters, filter]);
  },
  
  removeFilter(tableState$: any, index: number) {
    const filters = tableState$.filters.get();
    tableState$.filters.set(filters.filter((_: any, i: number) => i !== index));
  },
  
  toggleColumnVisibility(tableState$: any, columnId: string) {
    const visibility = tableState$.columnVisibility.get();
    tableState$.columnVisibility.set({
      ...visibility,
      [columnId]: !visibility[columnId]
    });
  },
  
  setGroupConfig(tableState$: any, groupConfig: GroupConfig | null) {
    tableState$.groupConfig.set(groupConfig);
  },
  
  // Selection updaters
  selectCell(tableState$: any, cellId: string, isMulti: boolean = false) {
    batch(() => {
      const selectedCells = new Set(tableState$.selectedCells.get());
      if (!isMulti) {
        selectedCells.clear();
      }
      selectedCells.add(cellId);
      tableState$.selectedCells.set(selectedCells);
      tableState$.selectionMode.set('cell');
    });
  },
  
  selectRow(tableState$: any, rowId: string, isMulti: boolean = false) {
    batch(() => {
      const selectedRows = new Set(tableState$.selectedRows.get());
      if (!isMulti) {
        selectedRows.clear();
      }
      selectedRows.add(rowId);
      tableState$.selectedRows.set(selectedRows);
      tableState$.selectionMode.set('row');
    });
  },
  
  toggleRowSelection(tableState$: any, rowId: string) {
    const selectedRows = new Set(tableState$.selectedRows.get());
    if (selectedRows.has(rowId)) {
      selectedRows.delete(rowId);
    } else {
      selectedRows.add(rowId);
    }
    tableState$.selectedRows.set(selectedRows);
  },
  
  selectRange(tableState$: any, start: { rowId: string; columnId: string }, end: { rowId: string; columnId: string }) {
    batch(() => {
      // Implementation would calculate cells in range
      tableState$.anchorCell.set(start);
      tableState$.selectionMode.set('range');
      tableState$.isSelecting.set(true);
    });
  },
  
  deselectCell(tableState$: any, cellId: string) {
    const selectedCells = new Set(tableState$.selectedCells.get());
    selectedCells.delete(cellId);
    tableState$.selectedCells.set(selectedCells);
  },
  
  clearSelection(tableState$: any) {
    batch(() => {
      tableState$.selectedCells.set(new Set());
      tableState$.selectedRows.set(new Set());
      tableState$.anchorCell.set(null);
      tableState$.isSelecting.set(false);
    });
  },
  
  setSelectionMode(tableState$: any, mode: 'cell' | 'row' | 'range' | 'multi') {
    tableState$.selectionMode.set(mode);
  },
  
  // Editing updaters
  startEditing(tableState$: any, cell: { rowId: string; columnId: string }, initialValue?: any) {
    batch(() => {
      tableState$.editingCell.set(cell);
      tableState$.editValue.set(initialValue || '');
      tableState$.isEditing.set(true);
      tableState$.editValidation.set(null);
    });
  },
  
  updateEditValue(tableState$: any, value: any) {
    tableState$.editValue.set(value);
  },
  
  setEditValidation(tableState$: any, validation: { isValid: boolean; message?: string }) {
    tableState$.editValidation.set(validation);
  },
  
  saveEdit(tableState$: any) {
    batch(() => {
      // The actual save would be handled by XState/entity update
      tableState$.editingCell.set(null);
      tableState$.editValue.set(null);
      tableState$.isEditing.set(false);
      tableState$.editValidation.set(null);
    });
  },
  
  cancelEdit(tableState$: any) {
    batch(() => {
      tableState$.editingCell.set(null);
      tableState$.editValue.set(null);
      tableState$.isEditing.set(false);
      tableState$.editValidation.set(null);
    });
  }
};

// ====================================
// RENDERER INTEGRATION
// ====================================

export function connectRendererToState(renderer: any, tableState$: any) {
  log.info('🎯 UnifiedState: Connecting renderer to reactive state');
  
  // Renderer observes the computed view and renders automatically
  // Following Legend State best practice - observe() for side effects
  const dispose = observe(() => {
    // Accessing .get() on the lazy computed function creates the observable
    // and tracks all dependencies automatically
    const view = tableState$.view.get();
    
    // Render the synchronized view
    renderer.render(view);
  });
  
  return dispose;
}

// ====================================
// GLOBAL REGISTRY
// ====================================

const tableStateRegistry = new Map<string, any>();

export function getTableState$(entityType: string) {
  return tableStateRegistry.get(entityType);
}

export function registerTableState$(entityType: string, tableState$: any) {
  tableStateRegistry.set(entityType, tableState$);
  log.info('🎯 UnifiedState: Registered table state', { entityType });
}

export function clearTableState$(entityType?: string) {
  if (entityType) {
    tableStateRegistry.delete(entityType);
  } else {
    tableStateRegistry.clear();
  }
}