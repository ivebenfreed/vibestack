/**
 * Synchronous View Processor for VibeGridX
 * 
 * Extracts view processing logic from ViewActor to enable synchronous
 * initial rendering. This eliminates the blank container issue by processing
 * data immediately without async actor communication.
 */

import type { Column, TableRow, SortConfig } from '../types';
import type { ViewActorInput, ViewActorOutput } from '../machines/view-actor';

/**
 * Process view data synchronously (same logic as ViewActor but sync)
 */
export function syncProcessView(input: ViewActorInput): ViewActorOutput {
  const startTime = performance.now();
  
  // Pre-compute relationship columns
  const relationshipColumns = input.relationshipResolvers ? 
    input.columns.filter(col => {
      const cellType = col.cellType || col.type;
      return cellType?.startsWith('relationship') && input.relationshipResolvers![col.id];
    }).map(col => ({
      field: col.field || col.id,
      resolver: input.relationshipResolvers![col.id],
      resolvedKey: `__resolved_${col.id}`
    })) : [];
  
  // Step 1: Convert entities to TableRows with relationship resolution
  const allRows: TableRow[] = input.entities.map(entity => {
    // Single-pass relationship resolution
    const resolvedData = relationshipColumns.length > 0 ? 
      relationshipColumns.reduce((data, { field, resolver, resolvedKey }) => {
        const value = entity[field];
        if (value != null) {
          data[resolvedKey] = resolver(value);
        }
        return data;
      }, { ...entity }) : 
      entity;
    
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
  
  // Step 2: Apply sorting (optimized version)
  let sortedRows = allRows;
  if (input.sortBy && input.sortBy.length > 0) {
    const sortConfigs = input.sortBy;
    
    // Pre-process sort fields
    const sortFields = sortConfigs.map(config => ({
      field: config.field,
      desc: config.desc,
      isRelationship: config.field.startsWith('__resolved_')
    }));
    
    sortedRows = [...allRows].sort((a, b) => {
      for (const { field, desc, isRelationship } of sortFields) {
        const aVal = a.data[field];
        const bVal = b.data[field];
        
        // Handle null/undefined
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return desc ? 1 : -1;
        if (bVal == null) return desc ? -1 : 1;
        
        // String comparison (case-insensitive for relationships)
        const aStr = isRelationship ? String(aVal).toLowerCase() : String(aVal);
        const bStr = isRelationship ? String(bVal).toLowerCase() : String(bVal);
        
        const comparison = aStr.localeCompare(bStr, undefined, { numeric: true });
        if (comparison !== 0) {
          return desc ? -comparison : comparison;
        }
      }
      return 0;
    });
  }
  
  // Step 3: Apply filters
  let filteredRows = sortedRows;
  if (input.filters && input.filters.length > 0) {
    // Pre-compile filter functions
    const filterFuncs = input.filters.map(filter => {
      const field = filter.field;
      const operator = filter.operator;
      const value = filter.value;
      
      switch (operator) {
        case 'equals':
          return (row: TableRow) => row.data[field] === value;
        case 'contains':
          return (row: TableRow) => {
            const cellValue = String(row.data[field] || '').toLowerCase();
            return cellValue.includes(String(value).toLowerCase());
          };
        case 'startsWith':
          return (row: TableRow) => {
            const cellValue = String(row.data[field] || '').toLowerCase();
            return cellValue.startsWith(String(value).toLowerCase());
          };
        case 'endsWith':
          return (row: TableRow) => {
            const cellValue = String(row.data[field] || '').toLowerCase();
            return cellValue.endsWith(String(value).toLowerCase());
          };
        case 'greaterThan':
          return (row: TableRow) => Number(row.data[field]) > Number(value);
        case 'lessThan':
          return (row: TableRow) => Number(row.data[field]) < Number(value);
        case 'between':
          return (row: TableRow) => {
            const cellValue = Number(row.data[field]);
            const [min, max] = value as [number, number];
            return cellValue >= min && cellValue <= max;
          };
        case 'empty':
          return (row: TableRow) => !row.data[field];
        case 'notEmpty':
          return (row: TableRow) => !!row.data[field];
        default:
          return () => true;
      }
    });
    
    // Apply all filters
    filteredRows = sortedRows.filter(row => 
      filterFuncs.every(filterFunc => filterFunc(row))
    );
  }
  
  // Step 4: Apply column visibility and order
  const visibleColumns = processColumns(
    input.columns,
    input.columnVisibility,
    input.columnOrder
  );
  
  // Step 5: Create coordinate mapping
  const coordinateMapping = createCoordinateMapping(
    filteredRows,
    visibleColumns,
    input.columnWidths,
    input.enableSelectionColumn
  );
  
  const processingTime = performance.now() - startTime;
  console.log(`🚀 Sync View Processing completed in ${processingTime.toFixed(2)}ms`);
  
  return {
    processedRows: filteredRows,
    visibleColumns,
    coordinateMapping
  };
}

/**
 * Process column visibility and ordering
 */
function processColumns(
  columns: Column[],
  columnVisibility?: Record<string, boolean>,
  columnOrder?: string[]
): Column[] {
  // Filter visible columns
  let visibleColumns = columns;
  if (columnVisibility) {
    visibleColumns = columns.filter(col => 
      columnVisibility[col.id] !== false
    );
  }
  
  // Apply column order
  if (columnOrder && columnOrder.length > 0) {
    const orderMap = new Map(columnOrder.map((id, index) => [id, index]));
    visibleColumns = [...visibleColumns].sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? 999;
      const bOrder = orderMap.get(b.id) ?? 999;
      return aOrder - bOrder;
    });
  }
  
  return visibleColumns;
}

/**
 * Create coordinate mapping for efficient cell lookups
 */
function createCoordinateMapping(
  rows: TableRow[],
  columns: Column[],
  columnWidths: Record<string, number>,
  enableSelectionColumn: boolean
) {
  const coordinateMapping = {
    version: Date.now(),
    rows: rows.map((row, index) => ({ 
      rowId: row.id,
      originalIndex: index,
      sortedIndex: index
    })),
    columns: [] as Array<{
      columnId: string;
      index: number;
      offset: number;
      width: number;
    }>
  };
  
  let totalOffset = 0;
  
  // Always add selection column first
  const selectionWidth = 48;
  coordinateMapping.columns.push({
    columnId: '__selection',
    index: 0,
    offset: 0,
    width: selectionWidth
  });
  totalOffset = selectionWidth;
  
  // Add data columns
  columns.forEach((col, index) => {
    const width = columnWidths[col.id] || col.width || 120;
    coordinateMapping.columns.push({
      columnId: col.id,
      index: index + 1, // Always offset by 1 for selection column
      offset: totalOffset,
      width: width
    });
    totalOffset += width;
  });
  
  return coordinateMapping;
}