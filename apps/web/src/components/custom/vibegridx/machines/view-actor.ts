// ====================================
// VIBEGRIDX VIEW ACTOR
// ====================================
//
// Strategic Hybrid Approach: Stateless processor that combines data transformation
// and coordinate calculation into a single atomic operation.
//
// This replaces the ViewCoordinator machine with a stateless fromPromise actor
// that takes entities + config and returns both processed data AND coordinates
// together, eliminating synchronization issues.
//
// Input: Raw entities + view configuration (sort, filter, grouping, column visibility)
// Output: { processedData, coordinateMapping, viewState }
//
// ====================================

import { fromPromise } from 'xstate';
import type { 
  TableRow, 
  Column, 
  SortConfig, 
  FilterConfig, 
  GroupNode,
  ViewportInfo
} from '../types';

// Note: Atom access provided via input parameter from parent component

// ====================================
// HELPER FUNCTIONS
// ====================================

// Entity access provided via input parameter - no hardcoded atoms

// ====================================
// TYPES
// ====================================

export interface ViewActorInput {
  // Entity data from parent component (passed from domain atoms)
  entities: Array<{ id: string; [key: string]: any }>;
  
  // View configuration
  sortBy: SortConfig[];
  filters: FilterConfig[];
  groupBy: string[];
  
  // Column configuration from parent component (DataForge generated)
  columns: Column[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths?: Record<string, number>; // Actual column widths (including resized)
  
  // Viewport info for coordinate calculation
  viewport?: ViewportInfo;
  
  // Settings
  rowHeight?: number;
  enableSelectionColumn?: boolean;
  
  // Relationship resolvers for foreign key lookups
  relationshipResolvers?: Record<string, (id: string | string[]) => string>;
}

export interface ViewActorOutput {
  // Processed data
  processedRows: TableRow[];
  groupTree: GroupNode[];
  totalRowCount: number;
  
  // Ordered visible columns
  visibleColumns: Column[];
  
  // Coordinate mapping
  coordinateMapping: {
    rows: Array<{
      rowId: string;
      originalIndex: number;
      sortedIndex: number;
    }>;
    columns: Array<{
      columnId: string;
      index: number;
      offset: number;
      width: number;
    }>;
    version: number;
    sortBy: SortConfig[];
  };
  
  // View state for persistence
  viewState: {
    sortBy: SortConfig[];
    filters: FilterConfig[];
    groupBy: string[];
    columnVisibility: Record<string, boolean>;
    columnOrder: string[];
    hiddenColumnCount: number;
  };
  
  // Performance metrics
  metrics: {
    processingTime: number;
    rowCount: number;
    columnCount: number;
    timestamp: number;
  };
}

// ====================================
// HELPER FUNCTIONS (from ViewCoordinator)
// ====================================

const createGroupTree = (
  rows: TableRow[], 
  groupBy: string[], 
  columns: Column[]
): GroupNode[] => {
  if (groupBy.length === 0) return [];
  
  const groupTree: GroupNode[] = [];
  const groupMap = new Map<string, GroupNode>();
  
  rows.forEach(row => {
    let currentLevel = groupTree;
    let currentPath = '';
    
    groupBy.forEach((field, level) => {
      const value = row.data[field];
      const groupKey = `${currentPath}:${field}:${value}`;
      currentPath = groupKey;
      
      if (!groupMap.has(groupKey)) {
        const node: GroupNode = {
          id: groupKey,
          field,
          value,
          level,
          rowCount: 0,
          children: level === groupBy.length - 1 ? [] : [],
          isCollapsed: false
        };
        
        groupMap.set(groupKey, node);
        currentLevel.push(node);
      }
      
      const node = groupMap.get(groupKey)!;
      node.rowCount++;
      
      if (level === groupBy.length - 1) {
        (node.children as TableRow[]).push(row);
      } else {
        currentLevel = node.children as GroupNode[];
      }
    });
  });
  
  return groupTree;
};

const applySorting = (rows: TableRow[], sortBy: SortConfig[]): TableRow[] => {
  if (sortBy.length === 0) return rows;
  
  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aValue = a.data[sort.field];
      const bValue = b.data[sort.field];
      
      if (aValue === bValue) continue;
      
      let comparison = 0;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    }
    
    return 0;
  });
};

const applyFilters = (rows: TableRow[], filters: FilterConfig[]): TableRow[] => {
  if (filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data[filter.field];
      let matches = false;
      
      switch (filter.operator) {
        case 'equals':
          matches = value === filter.value;
          break;
        case 'not_equals':
          matches = value !== filter.value;
          break;
        case 'contains':
          matches = String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'not_contains':
          matches = !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          break;
        case 'starts_with':
          matches = String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          break;
        case 'ends_with':
          matches = String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          break;
        case 'greater_than':
          matches = Number(value) > Number(filter.value);
          break;
        case 'less_than':
          matches = Number(value) < Number(filter.value);
          break;
        case 'is_empty':
          matches = value === null || value === undefined || value === '';
          break;
        case 'is_not_empty':
          matches = value !== null && value !== undefined && value !== '';
          break;
        case 'in':
          matches = Array.isArray(filter.value) && filter.value.includes(value);
          break;
        case 'not_in':
          matches = Array.isArray(filter.value) && !filter.value.includes(value);
          break;
        case 'regex':
          try {
            const regex = new RegExp(filter.value, filter.caseSensitive ? 'g' : 'gi');
            matches = regex.test(String(value));
          } catch {
            matches = false;
          }
          break;
        default:
          matches = true;
      }
      
      return filter.negate ? !matches : matches;
    });
  });
};

// ====================================
// COORDINATE CALCULATION (from CoordinateActor)
// ====================================

const calculateCoordinateMapping = (
  processedRows: TableRow[],
  visibleColumns: Column[],
  rowHeight: number = 40,
  columnWidths?: Record<string, number>
) => {
  const startTime = performance.now();
  
  // Calculate row mapping
  const rowMapping = processedRows.map((row, sortedIndex) => ({
    rowId: row.id,
    originalIndex: sortedIndex, // In this context, sortedIndex is our reference
    sortedIndex: sortedIndex
  }));
  
  // Calculate column mapping with offsets and widths
  console.log('calculateCoordinateMapping: Creating column mapping for columns:', {
    columnCount: visibleColumns.length,
    columnOrder: visibleColumns.map(c => c.id),
    firstColumn: visibleColumns[0],
    allColumns: visibleColumns.map(c => ({ id: c.id, name: c.name, width: c.width }))
  });
  
  let currentOffset = 0;
  const columnMapping = visibleColumns.map((column, index) => {
    // Use actual column width if available, otherwise fall back to column definition
    const width = columnWidths?.[column.id] || column.width || 120;
    const mapping = {
      columnId: column.id,
      index,
      offset: currentOffset,
      width
    };
    console.log(`calculateCoordinateMapping: Column ${column.id} at visual index ${index}, offset ${currentOffset}, width ${width}`, {
      actualWidth: columnWidths?.[column.id],
      defaultWidth: column.width
    });
    currentOffset += width;
    return mapping;
  });
  
  const calculationTime = performance.now() - startTime;
  console.log(`ViewActor: Coordinate calculation completed in ${calculationTime.toFixed(2)}ms`, {
    rowCount: rowMapping.length,
    columnCount: columnMapping.length
  });
  
  return {
    rows: rowMapping,
    columns: columnMapping,
    version: Date.now(), // Use timestamp as version
    sortBy: [] // Will be set by caller
  };
};

// ====================================
// VIEW ACTOR
// ====================================

export const viewActor = fromPromise(async ({ input }: { input: ViewActorInput }): Promise<ViewActorOutput> => {
  const startTime = performance.now();
  
  console.log('[ViewActor] Starting processing with input:', {
    entityCount: input.entities.length,
    sortBy: input.sortBy,
    hasFilters: input.filters.length > 0,
    hasGrouping: input.groupBy.length > 0,
    columnCount: input.columns.length,
    visibleColumns: Object.values(input.columnVisibility).filter(visible => visible).length,
    columnOrder: input.columnOrder,
    hasColumnOrder: !!input.columnOrder && input.columnOrder.length > 0
  });
  
  // Step 1: Convert entities to TableRows with resolved relationships
  const allRows: TableRow[] = input.entities.map(entity => {
    // Create a copy of entity data with resolved relationship values
    const resolvedData = { ...entity };
    
    // Resolve relationship values if resolvers are provided
    if (input.relationshipResolvers) {
      input.columns.forEach(column => {
        const cellType = column.cellType || column.type;
        
        // Check if this is a relationship column with a resolver
        if (cellType?.startsWith('relationship') && input.relationshipResolvers[column.id]) {
          const resolver = input.relationshipResolvers[column.id];
          const foreignKeyValue = entity[column.field || column.id];
          
          if (foreignKeyValue !== null && foreignKeyValue !== undefined) {
            // Store the resolved value with a special key
            resolvedData[`__resolved_${column.id}`] = resolver(foreignKeyValue);
          }
        }
      });
    }
    
    return {
      id: entity.id,
      data: resolvedData,
      metadata: {
        createdAt: entity.createdAt || new Date(),
        updatedAt: entity.updatedAt || new Date(),
        version: entity.version || 1,
        isNew: false,
        isDirty: false
      }
    };
  });
  
  // Step 2: Apply data transformations
  const filteredRows = applyFilters(allRows, input.filters);
  const sortedRows = applySorting(filteredRows, input.sortBy);
  const groupTree = createGroupTree(sortedRows, input.groupBy, input.columns);
  
  console.log('[ViewActor] Data transformation completed:', {
    originalCount: allRows.length,
    filteredCount: filteredRows.length,
    sortedCount: sortedRows.length,
    groupCount: groupTree.length
  });
  
  // Step 3: Calculate visible columns based on visibility and order
  const visibleDataColumns = input.columns.filter(col => 
    input.columnVisibility[col.id] !== false && col.id !== '__selection'
  );
  
  console.log('[ViewActor] Visible columns before ordering:', {
    count: visibleDataColumns.length,
    columnIds: visibleDataColumns.map(c => c.id)
  });
  
  // Apply column order
  let orderedDataColumns = visibleDataColumns;
  if (input.columnOrder && input.columnOrder.length > 0) {
    console.log('[ViewActor] Applying column order:', {
      inputOrder: input.columnOrder,
      visibleDataColumnIds: visibleDataColumns.map(c => c.id)
    });
    orderedDataColumns = input.columnOrder
      .filter(colId => colId !== '__selection')
      .map(colId => {
        const col = visibleDataColumns.find(col => col.id === colId);
        if (!col) {
          console.warn(`[ViewActor] Column ${colId} in columnOrder not found in visible columns`);
        }
        return col;
      })
      .filter(Boolean) as Column[];
    console.log('[ViewActor] Columns after ordering:', {
      count: orderedDataColumns.length,
      columnIds: orderedDataColumns.map(c => c.id),
      fullColumns: orderedDataColumns.map(c => ({ id: c.id, name: c.name }))
    });
  } else {
    console.log('[ViewActor] No column order provided, using default order');
  }
  
  // Add selection column if enabled
  const visibleColumns: Column[] = [];
  if (input.enableSelectionColumn) {
    visibleColumns.push({
      id: '__selection',
      field: '__selection',
      name: 'Select',
      type: 'boolean',
      width: 48,
      resizable: false,
      sortable: false,
      hideable: false
    } as Column);
  }
  visibleColumns.push(...orderedDataColumns);
  
  // Step 4: Calculate coordinate mapping
  const coordinateMapping = calculateCoordinateMapping(
    sortedRows,
    visibleColumns,
    input.rowHeight || 40,
    input.columnWidths
  );
  coordinateMapping.sortBy = input.sortBy; // Set the actual sortBy configuration
  
  // Step 5: Calculate view state
  const hiddenColumnCount = Object.values(input.columnVisibility).filter(visible => !visible).length;
  const viewState = {
    sortBy: input.sortBy,
    filters: input.filters,
    groupBy: input.groupBy,
    columnVisibility: input.columnVisibility,
    columnOrder: input.columnOrder,
    hiddenColumnCount
  };
  
  // Step 6: Prepare output
  const processingTime = performance.now() - startTime;
  const output: ViewActorOutput = {
    processedRows: sortedRows,
    groupTree,
    totalRowCount: filteredRows.length,
    visibleColumns, // Include ordered visible columns
    coordinateMapping,
    viewState,
    metrics: {
      processingTime,
      rowCount: sortedRows.length,
      columnCount: visibleColumns.length,
      timestamp: Date.now()
    }
  };
  
  console.log('[ViewActor] Processing completed:', {
    processingTime: processingTime.toFixed(2) + 'ms',
    outputRowCount: output.processedRows.length,
    outputColumnCount: output.coordinateMapping.columns.length,
    coordinateMappingVersion: output.coordinateMapping.version,
    visibleColumnOrder: output.visibleColumns.map(c => c.id),
    columnOrderFromInput: input.columnOrder
  });
  
  return output;
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Create input for the view actor from current state
 */
export const createViewActorInput = (config: {
  entities: Array<{ id: string; [key: string]: any }>;
  columns: Column[];
  viewState?: {
    sortBy?: SortConfig[];
    filters?: FilterConfig[];
    groupBy?: string[];
    columnVisibility?: Record<string, boolean>;
    columnOrder?: string[];
  };
  columnWidths?: Record<string, number>;
  viewport?: ViewportInfo;
  rowHeight?: number;
  enableSelectionColumn?: boolean;
  relationshipResolvers?: Record<string, (id: string | string[]) => string>;
}): ViewActorInput => {
  const { entities, columns, viewState = {}, columnWidths, viewport, rowHeight = 40, enableSelectionColumn = false, relationshipResolvers } = config;
  
  return {
    entities,
    sortBy: viewState.sortBy || [],
    filters: viewState.filters || [],
    groupBy: viewState.groupBy || [],
    columns,
    columnVisibility: viewState.columnVisibility || Object.fromEntries(columns.map(col => [col.id, true])),
    columnOrder: viewState.columnOrder || columns.map(col => col.id),
    columnWidths,
    viewport,
    rowHeight,
    enableSelectionColumn,
    relationshipResolvers
  };
};

/**
 * Extract coordinate events from view actor output for sending to other actors
 */
export const extractCoordinateEvents = (output: ViewActorOutput) => {
  return {
    type: 'COORDINATES_UPDATED' as const,
    mapping: output.coordinateMapping,
    version: output.coordinateMapping.version
  };
};

/**
 * Extract view state change event from view actor output
 */
export const extractViewStateEvent = (output: ViewActorOutput) => {
  return {
    type: 'view.state.changed' as const,
    viewState: output.viewState
  };
};

/**
 * Extract processed rows event from view actor output
 */
export const extractProcessedRowsEvent = (output: ViewActorOutput) => {
  return {
    type: 'view.rows.processed' as const,
    rows: output.processedRows,
    sortBy: output.viewState.sortBy
  };
};