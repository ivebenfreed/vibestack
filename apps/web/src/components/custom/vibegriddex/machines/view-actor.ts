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
  
  // Relationship tracking for surgical updates
  relationshipUsage?: {
    // Map of entity ID -> relationship columns -> relationship IDs used
    entityRelationships: Map<string, Map<string, string | string[]>>;
    // Map of relationship ID -> entity IDs that use it
    reverseIndex: Map<string, Set<string>>;
    // Map of column ID -> relationship table name
    columnToTable: Map<string, string>;
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

const applySorting = (rows: TableRow[], sortBy: SortConfig[], columns?: Column[]): TableRow[] => {
  // If no explicit sort is configured, maintain the original order from entities
  // This preserves the insertion order and prevents re-ordering on updates
  if (sortBy.length === 0) {
    // Return rows as-is to maintain stable order
    // The order comes from how entities are stored in the atom
    return rows;
  }
  
  const sortStartTime = performance.now();
  
  // OPTIMIZATION: Pre-compute sort keys and comparators for better performance
  const sortConfigs = sortBy.map(sort => {
    // Check if this is a relationship column
    const column = columns?.find(col => col.id === sort.field);
    const isRelationship = column && (column.cellType === 'relationship-single' || column.cellType === 'relationship-multi');
    const effectiveSortField = isRelationship ? `__resolved_${sort.field}` : sort.field;
    
    // Pre-determine the comparison function based on first non-null value
    let compareFn: (a: any, b: any) => number;
    let sampleValue: any = null;
    
    // Find first non-null value to determine type
    for (const row of rows) {
      const value = row.data[effectiveSortField];
      if (value != null) {
        sampleValue = value;
        break;
      }
    }
    
    // Pre-select optimized comparator
    if (typeof sampleValue === 'number') {
      compareFn = (a: number, b: number) => a - b;
    } else if (sampleValue instanceof Date) {
      compareFn = (a: Date, b: Date) => a.getTime() - b.getTime();
    } else {
      // Cache string conversion and use case-insensitive comparison
      compareFn = (a: any, b: any) => {
        const aStr = String(a).toLowerCase();
        const bStr = String(b).toLowerCase();
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      };
    }
    
    return {
      field: effectiveSortField,
      originalField: sort.field,
      direction: sort.direction,
      compareFn
    };
  });
  
  // OPTIMIZATION: Use in-place sort with pre-computed comparators
  const sortedRows = rows.slice(); // Single slice instead of spread
  
  sortedRows.sort((a, b) => {
    for (const { field, originalField, direction, compareFn } of sortConfigs) {
      const aValue = a.data[field];
      const bValue = b.data[field];
      
      // Handle null/undefined - nulls go to bottom for ASC, top for DESC
      // Check for null, undefined, or empty string
      const aIsEmpty = aValue == null || aValue === '';
      const bIsEmpty = bValue == null || bValue === '';
      
      if (aIsEmpty && bIsEmpty) continue;
      if (aIsEmpty) return direction === 'asc' ? 1 : -1;
      if (bIsEmpty) return direction === 'asc' ? -1 : 1;
      
      const comparison = compareFn(aValue, bValue);
      if (comparison !== 0) {
        return direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
  
  const sortTime = performance.now() - sortStartTime;
  
  return sortedRows;
};

const applyFilters = (rows: TableRow[], filters: FilterConfig[]): TableRow[] => {
  if (filters.length === 0) return rows;
  
  const filterStartTime = performance.now();
  
  // OPTIMIZATION: Pre-compute filter operations to avoid repeated string operations
  const filterConfigs = filters.map(filter => {
    const operator = filter.operator;
    const field = filter.field;
    let filterValue = filter.value;
    let filterFn: (value: any) => boolean;
    
    // Pre-process filter values for string operations
    if (operator === 'contains' || operator === 'not_contains' || 
        operator === 'starts_with' || operator === 'ends_with') {
      filterValue = String(filter.value).toLowerCase();
    } else if (operator === 'greater_than' || operator === 'less_than') {
      filterValue = Number(filter.value);
    }
    
    // Pre-compile filter function
    switch (operator) {
      case 'equals':
        filterFn = (value: any) => value === filter.value;
        break;
      case 'not_equals':
        filterFn = (value: any) => value !== filter.value;
        break;
      case 'contains':
        filterFn = (value: any) => String(value).toLowerCase().includes(filterValue as string);
        break;
      case 'not_contains':
        filterFn = (value: any) => !String(value).toLowerCase().includes(filterValue as string);
        break;
      case 'starts_with':
        filterFn = (value: any) => String(value).toLowerCase().startsWith(filterValue as string);
        break;
      case 'ends_with':
        filterFn = (value: any) => String(value).toLowerCase().endsWith(filterValue as string);
        break;
      case 'greater_than':
        filterFn = (value: any) => Number(value) > (filterValue as number);
        break;
      case 'less_than':
        filterFn = (value: any) => Number(value) < (filterValue as number);
        break;
      case 'is_empty':
        filterFn = (value: any) => value === null || value === undefined || value === '';
        break;
      case 'is_not_empty':
        filterFn = (value: any) => value !== null && value !== undefined && value !== '';
        break;
      case 'in':
        filterFn = (value: any) => Array.isArray(filter.value) && filter.value.includes(value);
        break;
      case 'not_in':
        filterFn = (value: any) => Array.isArray(filter.value) && !filter.value.includes(value);
        break;
      case 'regex':
        const regex = (() => {
          try {
            return new RegExp(filter.value, filter.caseSensitive ? 'g' : 'gi');
          } catch {
            return null;
          }
        })();
        filterFn = regex ? (value: any) => regex.test(String(value)) : () => false;
        break;
      default:
        filterFn = () => true;
    }
    
    return {
      field,
      filterFn,
      negate: filter.negate || false
    };
  });
  
  // OPTIMIZATION: Use pre-compiled filter functions
  const filteredRows = rows.filter(row => {
    return filterConfigs.every(({ field, filterFn, negate }) => {
      const value = row.data[field];
      const matches = filterFn(value);
      return negate ? !matches : matches;
    });
  });
  
  const filterTime = performance.now() - filterStartTime;
  console.log('🔥 ViewActor: Filtering optimized', { 
    filterTime: `${filterTime.toFixed(2)}ms`,
    rowsFiltered: rows.length,
    resultCount: filteredRows.length,
    filterCount: filters.length
  });
  
  return filteredRows;
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
  // Column mapping calculation started
  
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
    // Column position calculated
    currentOffset += width;
    return mapping;
  });
  
  const calculationTime = performance.now() - startTime;
  // Coordinate calculation completed
  
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
  
  // When using store architecture, relationships are pre-resolved
  const hasPreResolvedData = input.entities.length > 0 && 
    input.entities[0].__resolved_project !== undefined;
  
  if (hasPreResolvedData) {
    console.log('[ViewActor] Using pre-resolved data from store');
  }
  
  // OPTIMIZATION: Only compute relationship columns if not pre-resolved
  const relationshipColumns = (!hasPreResolvedData && input.relationshipResolvers) ? 
    input.columns.filter(col => {
      const cellType = col.cellType || col.type;
      const hasResolver = !!input.relationshipResolvers![col.id];
      
      return cellType?.startsWith('relationship') && hasResolver;
    }).map(col => ({
      field: col.field || col.id,
      resolver: input.relationshipResolvers![col.id],
      resolvedKey: `__resolved_${col.id}`
    })) : [];
    
  console.log('[ViewActor] Processing mode', {
    hasPreResolvedData,
    relationshipColumnsToResolve: relationshipColumns.length
  });
  
  // Initialize relationship tracking
  const entityRelationships = new Map<string, Map<string, string | string[]>>();
  const reverseIndex = new Map<string, Set<string>>();
  const columnToTable = new Map<string, string>();
  
  // Track column to table mappings
  input.columns.forEach(col => {
    if (col.relationshipTable) {
      columnToTable.set(col.id, col.relationshipTable);
    }
  });

  // Step 1: Convert entities to TableRows
  const relationshipStartTime = performance.now();
  const allRows: TableRow[] = input.entities.map((entity, index) => {
    // Track relationships for this entity (if not pre-resolved)
    const entityRelMap = new Map<string, string | string[]>();
    
    // Skip resolution if data is pre-resolved from store
    const resolvedData = hasPreResolvedData ? entity : 
      relationshipColumns.length > 0 ? 
        relationshipColumns.reduce((data, { field, resolver, resolvedKey }) => {
          const value = entity[field];
          if (value != null) {
            const resolved = resolver(value);
            data[resolvedKey] = resolved;
            
            // Track relationship usage
            entityRelMap.set(field, value);
            
            // Update reverse index
            if (Array.isArray(value)) {
              value.forEach(v => {
                if (!reverseIndex.has(v)) {
                  reverseIndex.set(v, new Set());
                }
                reverseIndex.get(v)!.add(entity.id);
              });
            } else {
              if (!reverseIndex.has(value)) {
                reverseIndex.set(value, new Set());
              }
              reverseIndex.get(value)!.add(entity.id);
            }
            
            // Log first few resolutions for debugging
            if (index < 2) {
              console.log('[ViewActor] Resolving relationship', {
                entityId: entity.id,
                field,
                value,
                resolved,
                resolvedKey
              });
            }
          }
          return data;
        }, { ...entity }) : 
        entity;
    
    // Store entity relationship mapping
    if (entityRelMap.size > 0) {
      entityRelationships.set(entity.id, entityRelMap);
    }
    
    return {
      id: entity.id,
      data: resolvedData,
      metadata: {
        isSelected: false,
        isDirty: false,
        isGroup: false,
        level: 0
      }
    };
  });
  
  const relationshipTime = performance.now() - relationshipStartTime;
  
  // Step 2: Apply data transformations
  const filteredRows = applyFilters(allRows, input.filters);
  const sortedRows = applySorting(filteredRows, input.sortBy, input.columns);
  const groupTree = createGroupTree(sortedRows, input.groupBy, input.columns);
  
  // Data transformation completed
  
  // Step 3: Calculate visible columns based on visibility and order
  const visibleDataColumns = input.columns.filter(col => 
    input.columnVisibility[col.id] !== false && col.id !== '__selection'
  );
  
  // Calculated visible columns
  
  // Apply column order
  let orderedDataColumns = visibleDataColumns;
  if (input.columnOrder && input.columnOrder.length > 0) {
    // Applying column order
    console.log('[ViewActor] Applying column order:', {
      columnOrder: input.columnOrder,
      availableColumns: input.columns.map(c => c.id),
      visibleDataColumns: visibleDataColumns.map(c => c.id)
    });
    
    orderedDataColumns = input.columnOrder
      .filter(colId => colId !== '__selection')
      .map(colId => {
        const col = visibleDataColumns.find(col => col.id === colId);
        if (!col) {
          // This is expected when columns are hidden but still in the order
          // Only warn if the column doesn't exist at all
          const columnExists = input.columns.some(c => c.id === colId);
          if (!columnExists) {
            console.warn(`[ViewActor] Column ${colId} in columnOrder not found in column definitions`);
          }
        }
        return col;
      })
      .filter(Boolean) as Column[];
    // Column ordering applied
  } else {
    // Using default column order
  }
  
  // Always add selection column (selection column is always enabled)
  const visibleColumns: Column[] = [];
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
    },
    // Include relationship tracking if we have any relationships
    ...(entityRelationships.size > 0 ? {
      relationshipUsage: {
        entityRelationships,
        reverseIndex,
        columnToTable
      }
    } : {})
  };
  
  // Processing completed - performance info available in debug mode
  if ((window as any).__VIBEGRIDX_DEBUG) {
    console.log('[ViewActor] Processing completed:', {
      processingTime: processingTime.toFixed(2) + 'ms',
      outputRowCount: output.processedRows.length,
      outputColumnCount: output.coordinateMapping.columns.length,
      coordinateMappingVersion: output.coordinateMapping.version,
      visibleColumnOrder: output.visibleColumns.map(c => c.id),
      columnOrderFromInput: input.columnOrder
    });
  }
  
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
  const { entities, columns, viewState = {}, columnWidths, viewport, rowHeight = 40, enableSelectionColumn = true, relationshipResolvers } = config;
  
  // Debug log to ensure resolvers are passed
  if ((window as any).__VIBEGRIDX_DEBUG && relationshipResolvers) {
    console.log('[createViewActorInput] Relationship resolvers provided:', Object.keys(relationshipResolvers));
  }
  
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