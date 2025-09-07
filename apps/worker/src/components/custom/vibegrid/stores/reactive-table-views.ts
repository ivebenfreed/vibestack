/**
 * Reactive Table Views - Computed Observables for Table Data
 * 
 * Creates reactive computed observables that combine:
 * - Legend State entity data (single source of truth)
 * - UI Store configuration (sorting, filtering, column visibility)
 * 
 * This eliminates data duplication and provides reactive filtered/sorted views
 */

import { observable, computed } from '@legendapp/state';
import { uiLog } from '@/logger';

const log = uiLog('components/custom/vibegrid/stores/reactive-table-views.ts');

export interface TableViewConfig {
  entityObservable: any;    // Legend State entity observable
  uiStore: any;            // UI store for rendering instructions
  entityType: string;      // Entity type name
}

export interface ProcessedTableRow {
  id: string;
  data: Record<string, any>;
  metadata: {
    isSelected: boolean;
    isDirty: boolean;
    isGroup: boolean;
    level: number;
  };
}

/**
 * Create reactive table view observables that combine Legend State data with UI configuration
 */
export function createReactiveTableViews(config: TableViewConfig) {
  const { entityObservable, uiStore, entityType } = config;
  
  log.info('🔄 ReactiveViews: Creating reactive table views', {
    entityType,
    hasEntityObservable: !!entityObservable,
    hasUIStore: !!uiStore
  });

  // ====================================
  // RAW DATA OBSERVABLE
  // ====================================
  
  /**
   * Raw entity data directly from Legend State - single source of truth
   */
  const rawData$ = computed(() => {
    if (!entityObservable) {
      log.warn('🔄 ReactiveViews: No entity observable available');
      return {};
    }
    
    const data = entityObservable.get();
    const recordCount = data && typeof data === 'object' ? Object.keys(data).length : 0;
    
    log.info('🔄 ReactiveViews: Raw data updated', {
      entityType,
      recordCount,
      hasData: !!data
    });
    
    return data || {};
  });

  // ====================================
  // PROCESSED ROWS OBSERVABLE
  // ====================================
  
  /**
   * Convert raw entity data to table row format
   */
  const processedRows$ = computed(() => {
    const rawData = rawData$.get();
    
    if (!rawData || typeof rawData !== 'object') {
      return [];
    }
    
    const entityRecords = Object.values(rawData);
    const rows: ProcessedTableRow[] = [];
    
    entityRecords.forEach((entity: any) => {
      if (entity && typeof entity === 'object' && entity.id) {
        rows.push({
          id: entity.id,
          data: entity,
          metadata: {
            isSelected: false,
            isDirty: false,
            isGroup: false,
            level: 0
          }
        });
      }
    });
    
    log.info('🔄 ReactiveViews: Processed rows updated', {
      entityType,
      rowCount: rows.length
    });
    
    return rows;
  });

  // ====================================
  // SORTED ROWS OBSERVABLE
  // ====================================
  
  /**
   * Apply sorting based on UI store configuration
   */
  const sortedRows$ = computed(() => {
    const rows = processedRows$.get();
    
    if (!uiStore || rows.length === 0) {
      return rows;
    }
    
    const uiState = uiStore.getSnapshot();
    const sortBy = uiState.context.sortBy;
    
    if (!sortBy || sortBy.length === 0) {
      return rows;
    }
    
    const sortedRows = [...rows].sort((a, b) => {
      for (const sort of sortBy) {
        const aValue = a.data[sort.field];
        const bValue = b.data[sort.field];
        
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
    
    log.info('🔄 ReactiveViews: Sorted rows updated', {
      entityType,
      rowCount: sortedRows.length,
      sortFields: sortBy.map((s: any) => `${s.field}:${s.direction}`)
    });
    
    return sortedRows;
  });

  // ====================================
  // FILTERED ROWS OBSERVABLE
  // ====================================
  
  /**
   * Apply filtering based on UI store configuration
   */
  const filteredRows$ = computed(() => {
    const rows = sortedRows$.get();
    
    if (!uiStore || rows.length === 0) {
      return rows;
    }
    
    const uiState = uiStore.getSnapshot();
    const filters = uiState.context.filters;
    
    if (!filters || filters.length === 0) {
      return rows;
    }
    
    const filteredRows = rows.filter(row => {
      return filters.every((filter: any) => {
        const fieldValue = row.data[filter.field];
        
        switch (filter.operator) {
          case 'equals':
            return fieldValue === filter.value;
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
          case 'endsWith':
            return String(fieldValue).toLowerCase().endsWith(String(filter.value).toLowerCase());
          case 'gt':
            return Number(fieldValue) > Number(filter.value);
          case 'gte':
            return Number(fieldValue) >= Number(filter.value);
          case 'lt':
            return Number(fieldValue) < Number(filter.value);
          case 'lte':
            return Number(fieldValue) <= Number(filter.value);
          case 'isEmpty':
            return fieldValue == null || String(fieldValue).trim() === '';
          case 'isNotEmpty':
            return fieldValue != null && String(fieldValue).trim() !== '';
          default:
            return true;
        }
      });
    });
    
    log.info('🔄 ReactiveViews: Filtered rows updated', {
      entityType,
      originalCount: rows.length,
      filteredCount: filteredRows.length,
      filterCount: filters.length
    });
    
    return filteredRows;
  });

  // ====================================
  // VISIBLE COLUMNS OBSERVABLE
  // ====================================
  
  /**
   * Get visible columns based on UI store configuration
   */
  const visibleColumns$ = computed(() => {
    if (!uiStore) {
      return [];
    }
    
    const uiState = uiStore.getSnapshot();
    const columns = uiState.context.columns || [];
    const columnVisibility = uiState.context.columnVisibility || {};
    
    const visibleColumns = columns.filter((col: any) => columnVisibility[col.id] !== false);
    
    log.info('🔄 ReactiveViews: Visible columns updated', {
      entityType,
      totalColumns: columns.length,
      visibleColumns: visibleColumns.length,
      hiddenColumns: columns.length - visibleColumns.length
    });
    
    return visibleColumns;
  });

  // ====================================
  // FINAL VIEW OBSERVABLE
  // ====================================
  
  /**
   * Final table view combining all reactive computations
   */
  const tableView$ = computed(() => {
    const rows = filteredRows$.get();
    const columns = visibleColumns$.get();
    const uiState = uiStore?.getSnapshot();
    
    const view = {
      rows,
      columns,
      totalRows: rows.length,
      hasData: rows.length > 0,
      // UI state for renderer
      sortBy: uiState?.context.sortBy || [],
      filters: uiState?.context.filters || [],
      columnVisibility: uiState?.context.columnVisibility || {},
      // Metadata
      entityType,
      lastUpdated: Date.now()
    };
    
    log.info('🔄 ReactiveViews: Final table view updated', {
      entityType,
      rowCount: view.totalRows,
      columnCount: view.columns.length,
      hasSort: view.sortBy.length > 0,
      hasFilters: view.filters.length > 0
    });
    
    return view;
  });

  // ====================================
  // PUBLIC API
  // ====================================
  
  return {
    // Individual observables
    rawData$,
    processedRows$,
    sortedRows$,
    filteredRows$,
    visibleColumns$,
    // Complete view
    tableView$,
    
    // Utility methods
    getRowCount: () => filteredRows$.get().length,
    getColumnCount: () => visibleColumns$.get().length,
    hasData: () => processedRows$.get().length > 0,
    
    // Debug helpers
    debugInfo: () => ({
      entityType,
      rawDataKeys: Object.keys(rawData$.get()).length,
      processedRows: processedRows$.get().length,
      filteredRows: filteredRows$.get().length,
      visibleColumns: visibleColumns$.get().length,
      hasUIStore: !!uiStore,
      hasEntityObservable: !!entityObservable
    })
  };
}

/**
 * Global registry for reactive table views
 */
const reactiveViewRegistry = new Map<string, ReturnType<typeof createReactiveTableViews>>();

/**
 * Get or create reactive views for an entity type
 */
export function getReactiveTableViews(entityType: string, config?: TableViewConfig) {
  if (!reactiveViewRegistry.has(entityType) && config) {
    const views = createReactiveTableViews(config);
    reactiveViewRegistry.set(entityType, views);
    log.info('🔄 ReactiveViews: Registered reactive views', { entityType });
  }
  
  return reactiveViewRegistry.get(entityType);
}

/**
 * Clear reactive views (for cleanup)
 */
export function clearReactiveViews(entityType?: string) {
  if (entityType) {
    reactiveViewRegistry.delete(entityType);
    log.info('🔄 ReactiveViews: Cleared views', { entityType });
  } else {
    reactiveViewRegistry.clear();
    log.info('🔄 ReactiveViews: Cleared all views');
  }
}