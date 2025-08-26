import { observable, batch } from '@legendapp/state';
import type { 
  TableRow, 
  Column, 
  CellRef, 
  ViewportInfo, 
  SortConfig, 
  SelectionState,
  TableConfig 
} from '../types';

// Utility functions for data processing
function filterData(data: TableRow[], filters: Map<string, any>, searchTerm: string): TableRow[] {
  return data.filter(row => {
    // Apply column filters
    for (const [columnId, filterValue] of filters.entries()) {
      if (!filterValue) continue;
      
      const cellValue = row.data[columnId];
      if (!cellValue || !String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase())) {
        return false;
      }
    }
    
    // Apply search term across all columns
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matches = Object.values(row.data).some(value => 
        value && String(value).toLowerCase().includes(searchLower)
      );
      if (!matches) return false;
    }
    
    return true;
  });
}

function sortData(data: TableRow[], sorting: SortConfig): TableRow[] {
  if (!sorting.column) return data;
  
  return [...data].sort((a, b) => {
    const aValue = a.data[sorting.column!];
    const bValue = b.data[sorting.column!];
    
    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    
    // Compare values based on type
    let comparison = 0;
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }
    
    return sorting.direction === 'asc' ? comparison : -comparison;
  });
}

function calculateCellRange(
  startCell: string, 
  endCell: string, 
  data: TableRow[], 
  columns: Column[]
): string[] {
  const [startRowId, startColId] = startCell.split(':');
  const [endRowId, endColId] = endCell.split(':');
  
  const startRowIndex = data.findIndex(row => row.id === startRowId);
  const endRowIndex = data.findIndex(row => row.id === endRowId);
  const startColIndex = columns.findIndex(col => col.id === startColId);
  const endColIndex = columns.findIndex(col => col.id === endColId);
  
  if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
    return [];
  }
  
  const minRowIndex = Math.min(startRowIndex, endRowIndex);
  const maxRowIndex = Math.max(startRowIndex, endRowIndex);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);
  
  const range: string[] = [];
  for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
    for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
      const rowId = data[rowIndex].id;
      const columnId = columns[colIndex].id;
      range.push(`${rowId}:${columnId}`);
    }
  }
  
  return range;
}

export function createTableState(config: TableConfig) {
  const tableState$ = observable({
    // Data layer
    data: [] as TableRow[],
    
    // Computed filtered data
    filteredData: (): TableRow[] => {
      const data = tableState$.data.get();
      const filters = tableState$.filters.get();
      const searchTerm = tableState$.searchTerm.get();
      return filterData(data, filters, searchTerm);
    },
    
    // Computed sorted data
    sortedData: (): TableRow[] => {
      const filtered = tableState$.filteredData.get();
      const sorting = tableState$.sorting.get();
      return sortData(filtered, sorting);
    },
    
    // View layer
    columns: config.columns,
    viewport: {
      start: 0,
      end: Math.min(20, config.columns.length), // Initial viewport
      scrollTop: 0,
      scrollLeft: 0,
      height: 400,
      width: 800
    } as ViewportInfo,
    
    // Selection layer
    selection: {
      selectedCells: new Set<string>(),
      selectedRows: new Set<string>(),
      anchorCell: null as CellRef | null,
      editingCell: null as CellRef | null
    } as SelectionState,
    
    // Interaction layer
    sorting: {
      column: null as string | null,
      direction: 'asc' as 'asc' | 'desc'
    } as SortConfig,
    
    filters: new Map<string, any>(),
    searchTerm: '',
    
    // Settings
    settings: {
      enableSelectionColumn: config.enableSelectionColumn ?? true,
      enableVirtualScrolling: config.enableVirtualScrolling ?? true,
      enableSorting: config.enableSorting ?? true,
      enableFiltering: config.enableFiltering ?? true,
      persistState: config.persistState ?? true
    },
    
    // Actions as observable methods
    selectCell: (cellId: string, addToSelection = false) => {
      batch(() => {
        if (!addToSelection) {
          tableState$.selection.selectedCells.set(new Set());
        }
        const selected = new Set(tableState$.selection.selectedCells.get());
        selected.add(cellId);
        tableState$.selection.selectedCells.set(selected);
      });
    },
    
    selectRange: (startCell: string, endCell: string) => {
      batch(() => {
        const data = tableState$.sortedData.get();
        const columns = tableState$.columns.get();
        const range = calculateCellRange(startCell, endCell, data, columns);
        tableState$.selection.selectedCells.set(new Set(range));
      });
    },
    
    selectRow: (rowId: string, addToSelection = false) => {
      batch(() => {
        if (!addToSelection) {
          tableState$.selection.selectedRows.set(new Set());
        }
        const selected = new Set(tableState$.selection.selectedRows.get());
        selected.add(rowId);
        tableState$.selection.selectedRows.set(selected);
      });
    },
    
    selectAllRows: () => {
      const data = tableState$.sortedData.get();
      const allRowIds = new Set(data.map(row => row.id));
      tableState$.selection.selectedRows.set(allRowIds);
    },
    
    clearSelection: () => {
      batch(() => {
        tableState$.selection.selectedCells.set(new Set());
        tableState$.selection.selectedRows.set(new Set());
        tableState$.selection.anchorCell.set(null);
      });
    },
    
    setViewport: (viewport: ViewportInfo) => {
      tableState$.viewport.assign(viewport);
    },
    
    sortByColumn: (columnId: string) => {
      const currentSort = tableState$.sorting.get();
      tableState$.sorting.assign({
        column: columnId,
        direction: currentSort.column === columnId && currentSort.direction === 'asc' ? 'desc' : 'asc'
      });
    },
    
    setFilter: (columnId: string, value: any) => {
      const filters = new Map(tableState$.filters.get());
      if (value) {
        filters.set(columnId, value);
      } else {
        filters.delete(columnId);
      }
      tableState$.filters.set(filters);
    },
    
    setSearchTerm: (term: string) => {
      tableState$.searchTerm.set(term);
    },
    
    startEdit: (rowId: string, columnId: string) => {
      tableState$.selection.editingCell.set({ rowId, columnId });
    },
    
    commitEdit: (value: any) => {
      const editingCell = tableState$.selection.editingCell.get();
      if (!editingCell) return;
      
      batch(() => {
        // Update data
        const data = [...tableState$.data.get()];
        const rowIndex = data.findIndex(row => row.id === editingCell.rowId);
        if (rowIndex !== -1) {
          data[rowIndex] = {
            ...data[rowIndex],
            data: {
              ...data[rowIndex].data,
              [editingCell.columnId]: value
            }
          };
          tableState$.data.set(data);
        }
        
        // Clear editing state
        tableState$.selection.editingCell.set(null);
      });
    },
    
    cancelEdit: () => {
      tableState$.selection.editingCell.set(null);
    },
    
    // Fill operations for Excel-like functionality
    fillDown: (sourceRange: Set<string>, fillRange: Set<string>) => {
      batch(() => {
        const data = [...tableState$.data.get()];
        
        // Get source values (use first row as template)
        const sourceValues: Record<string, any> = {};
        const sourceArray = Array.from(sourceRange);
        if (sourceArray.length === 0) return;
        
        // Parse first source cell to get the template
        const [sourceRowId, sourceColId] = sourceArray[0].split(':');
        const sourceRow = data.find(row => row.id === sourceRowId);
        if (!sourceRow) return;
        
        // For each column in source range, get the template value
        const sourceColumns = new Set<string>();
        sourceRange.forEach(cellId => {
          const [, colId] = cellId.split(':');
          sourceColumns.add(colId);
        });
        
        sourceColumns.forEach(colId => {
          sourceValues[colId] = sourceRow.data[colId];
        });
        
        // Apply values to fill range
        fillRange.forEach(cellId => {
          const [rowId, colId] = cellId.split(':');
          const rowIndex = data.findIndex(row => row.id === rowId);
          if (rowIndex !== -1 && sourceValues[colId] !== undefined) {
            data[rowIndex] = {
              ...data[rowIndex],
              data: {
                ...data[rowIndex].data,
                [colId]: sourceValues[colId]
              }
            };
          }
        });
        
        tableState$.data.set(data);
      });
    },
    
    fillSeries: (sourceRange: Set<string>, fillRange: Set<string>) => {
      // TODO: Implement smart series detection (1, 2, 3... or Mon, Tue, Wed...)
      // For now, fall back to fillDown
      tableState$.fillDown(sourceRange, fillRange);
    }
  });
  
  return tableState$;
}

export type TableState = ReturnType<typeof createTableState>;