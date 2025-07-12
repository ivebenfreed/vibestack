import { useCallback, useMemo, useRef } from 'react';
import { useSelector } from '@xstate/react';
import type { TableRow, RenderState, CellRef, OptimisticOperation, Column } from './types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from './machines/table-machine';

// ====================================
// STATE EXTRACTION HOOKS
// ====================================

export const useTableState = (tableActor: ActorRefFrom<typeof tableBaseMachine>) => {
  return useSelector(tableActor, state => state);
};

// ====================================
// CHANGE DETECTION HOOKS
// ====================================

interface PreviousState {
  version?: number;
  selectedCellsSize?: number;
  editingCellId?: string;
  rowData?: Map<string, any>;
  lastStateKey?: string;
}

export const useChangeDetection = () => {
  const previousState = useRef<PreviousState>({
    rowData: new Map()
  });

  const getChangedRows = useCallback((renderState: RenderState): { 
    changedRows: TableRow[],
    newRows: TableRow[],
    deletedRowIds: string[],
    isStructuralChange: boolean
  } => {
    const previousRowData = previousState.current.rowData!;
    const currentRowData = new Map();
    
    const changedRows: TableRow[] = [];
    const newRows: TableRow[] = [];
    const deletedRowIds: string[] = [];
    
    // Check for new or changed rows
    renderState.rows.forEach(row => {
      currentRowData.set(row.id, row);
      
      if (!previousRowData.has(row.id)) {
        // New row
        newRows.push(row);
      } else {
        // Check if row data changed
        const previousRow = previousRowData.get(row.id);
        const currentRowString = JSON.stringify(row.data);
        const previousRowString = JSON.stringify(previousRow?.data || {});
        
        if (currentRowString !== previousRowString) {
          changedRows.push(row);
        }
      }
    });
    
    // Check for deleted rows
    previousRowData.forEach((row, rowId) => {
      if (!currentRowData.has(rowId)) {
        deletedRowIds.push(rowId);
      }
    });
    
    // Update stored row data
    previousState.current.rowData = currentRowData;
    
    // Determine if this is a structural change (needs full re-render)
    const isStructuralChange = newRows.length > 0 || deletedRowIds.length > 0 || 
                               previousRowData.size === 0; // Initial load
    
    return { changedRows, newRows, deletedRowIds, isStructuralChange };
  }, []);

  return {
    getChangedRows
  };
};

// ====================================
// RENDER STATE EXTRACTION
// ====================================

export const useRenderStateExtractor = () => {
  const extractRenderStateFromActor = useCallback((snapshot: any, providedColumns?: Column[]): RenderState | null => {
    try {
      // Get state from table machine context
      const context = snapshot.context;
      if (!context) {
        console.warn('getRenderState: No context available');
        return null;
      }
      
      // Use processed rows from ViewActor (Strategic Hybrid Approach)
      // ViewActor has already processed, sorted, and filtered the data
      let rows = context.rows || [];
      
      if (rows.length === 0) {
        console.log('getRenderState: No processed rows from ViewActor yet');
        return null;
      }
      
      // Use visible columns from context if available, otherwise use all columns
      let columns = context.visibleColumns || providedColumns || context.columns || [];
      
      console.log('getRenderState: Using processed rows from ViewActor', {
        rowCount: rows.length,
        columnsCount: columns.length,
        hasCoordinateMapping: !!context.coordinateMapping
      });
      
      // Get view state directly from TableMachine context
      const sortBy = context.sortBy || [];
      const columnVisibility = context.columnVisibility || {};
      const columnOrder = context.columnOrder || [];
      
      // Note: ViewActor has already processed and sorted the rows
      // No need to apply sorting here - use rows as-is from ViewActor
      
      // Build render state
      const renderState: RenderState = {
        rows, // Processed and sorted by ViewActor
        columns,
        selectedCells: new Set<string>(), // Empty by default
        editingCell: null, // No editing by default
        groupedData: [],
        optimisticOperations: new Map(),
        version: context.version || 0,
        sortBy, // Include for renderer awareness
        columnVisibility,
        columnOrder,
        columnWidths: context.columnWidths || {}
      };
      
      return renderState;
    } catch (error) {
      console.error('Error extracting render state:', error);
      return null;
    }
  }, []);

  return { extractRenderStateFromActor };
};

// ====================================
// PUBLIC API HOOK
// ====================================

export const useVibeGridXApi = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'],
  tableState: any,
  tableActor: ActorRefFrom<typeof tableBaseMachine>,
  rendererRef?: React.MutableRefObject<any> // Make optional for renderer actor pattern
) => {
  return useMemo(() => ({
    // Selection API
    selectCell: (rowId: string, columnId: string) => {
      tableSend({ type: 'selection.cell.select', rowId, columnId });
    },
    
    selectRange: (start: CellRef, end: CellRef) => {
      tableSend({ type: 'selection.range.select', start, end });
    },
    
    clearSelection: () => {
      tableSend({ type: 'selection.clear' });
    },
    
    // Edit API
    startEditing: (rowId: string, columnId: string) => {
      tableSend({ type: 'edit.cell.start', rowId, columnId });
    },
    
    commitEdit: () => {
      tableSend({ type: 'edit.commit' });
    },
    
    cancelEdit: () => {
      tableSend({ type: 'edit.cancel' });
    },
    
    // View API
    setGroupBy: (groupBy: string[]) => {
      tableSend({ type: 'view.group.set', groupBy });
    },
    
    setSortBy: (sortBy: any[]) => {
      tableSend({ type: 'view.sort.set', sortBy });
    },
    
    setFilters: (filters: any[]) => {
      tableSend({ type: 'view.filter.set', filters });
    },
    
    // Column visibility API
    toggleColumnVisibility: (columnId: string) => {
      tableSend({ type: 'view.columns.toggle', columnId });
    },
    
    showAllColumns: () => {
      tableSend({ type: 'view.columns.show.all' });
    },
    
    hideAllColumns: () => {
      tableSend({ type: 'view.columns.hide.all' });
    },
    
    setColumnVisibility: (visibility: Record<string, boolean>) => {
      tableSend({ type: 'view.columns.visibility.set', visibility });
    },
    
    // Data API
    createRow: (insertAfter?: string) => {
      tableSend({ type: 'edit.row.create', insertAfter });
    },
    
    // Performance API
    getMetrics: () => {
      return {
        renderer: rendererRef?.current?.getPerformanceMetrics(), // Optional chaining for renderer actor pattern
        machine: {
          state: tableState.value,
          context: tableState.context
        }
      };
    },
    
    // Debug API
    getState: () => tableState,
    getActor: () => tableActor
  }), [tableSend, tableState, tableActor]);
};

// ====================================
// REF HOOK FOR EXTERNAL USE
// ====================================

export const useVibeGridXRef = () => {
  const ref = useRef<any>(null);
  
  return {
    ref,
    api: ref.current || {}
  };
};