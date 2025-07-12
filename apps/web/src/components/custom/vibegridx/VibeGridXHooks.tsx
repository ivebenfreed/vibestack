import { useCallback, useMemo, useRef } from 'react';
import { useSelector } from '@xstate/react';
import type { TableRow, RenderState, CellRef, OptimisticOperation, Column } from './types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from './machines/table-machine';
import type { EntityIntegrationLayer } from './integration/EntityIntegration';

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

export const useRenderStateExtractor = (integrationRef: React.MutableRefObject<EntityIntegrationLayer | null>) => {
  const extractRenderStateFromActor = useCallback((snapshot: any, providedColumns?: Column[]): RenderState | null => {
    try {
      // Get state from table machine context
      const context = snapshot.context;
      if (!context) {
        console.warn('getRenderState: No context available');
        return null;
      }
      
      // Get fresh data directly from integration (atoms)
      if (!integrationRef.current) {
        console.warn('getRenderState: No integration layer available');
        return null;
      }
      
      // Get fresh entity data from atoms
      const entityData = integrationRef.current.getAllEntityData();
      
      // Use visible columns from context if available, otherwise use all columns
      let columns = context.visibleColumns || providedColumns || context.columns || [];
      
      // Column selection priority: visibleColumns > providedColumns > contextColumns
      
      // Convert entity data to table rows - UNSORTED for now
      let rows = Object.values(entityData).map((entity: any) => ({
        id: entity.id,
        data: { ...entity },
        metadata: {
          createdAt: entity.createdAt || new Date(),
          updatedAt: entity.updatedAt || new Date(),
          version: entity.version || 1,
          isNew: entity.isNew || false,
          isDirty: entity.isDirty || false
        }
      }));
      
      // Get view state from coordinator if available (but don't depend on it)
      let sortBy = [];
      let columnVisibility = {};
      let columnOrder = [];
      
      if (context.actors?.viewCoordinator) {
        try {
          const viewSnapshot = context.actors.viewCoordinator.getSnapshot();
          const viewContext = viewSnapshot.context;
          if (viewContext) {
            sortBy = viewContext.sortBy || [];
            columnVisibility = viewContext.columnVisibility || {};
            columnOrder = viewContext.columnOrder || [];
            // Successfully retrieved view state
          }
        } catch (e) {
          console.warn('[RENDER STATE] Could not get view state from coordinator:', e);
        }
      }
      
      // Apply sort if we have it
      if (sortBy && sortBy.length > 0) {
        // Apply sort to rows
        rows = rows.sort((a, b) => {
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
        
        // Rows sorted successfully
      }
      
      // Build render state
      const renderState: RenderState = {
        rows, // May be sorted
        columns,
        selectedCells: new Set<string>(), // Empty by default
        editingCell: null, // No editing by default
        groupedData: [],
        optimisticOperations: new Map(),
        version: context.version || 0,
        sortBy, // Include for renderer awareness
        columnVisibility,
        columnOrder
      };
      
      return renderState;
    } catch (error) {
      console.error('Error extracting render state:', error);
      return null;
    }
  }, [integrationRef]);

  return { extractRenderStateFromActor };
};

// ====================================
// PUBLIC API HOOK
// ====================================

export const useVibeGridXApi = (
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'],
  tableState: any,
  tableActor: ActorRefFrom<typeof tableBaseMachine>,
  rendererRef: React.MutableRefObject<any>
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
        renderer: rendererRef.current?.getPerformanceMetrics(),
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