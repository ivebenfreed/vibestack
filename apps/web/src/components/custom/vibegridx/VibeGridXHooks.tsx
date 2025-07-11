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

  const hasDataChanged = useCallback((snapshot: any): boolean => {
    const currentVersion = snapshot.context?.version || 0;
    const previousVersion = previousState.current.version;
    
    // Only log on actual data changes, not on every scroll event
    if (previousVersion === undefined || currentVersion !== previousVersion) {
      console.log('VibeGridX.hasDataChanged:', {
        currentVersion,
        previousVersion,
        isFirstRender: previousVersion === undefined,
        willRender: true
      });
    }
    
    // First render or version changed
    if (previousVersion === undefined || currentVersion !== previousVersion) {
      previousState.current.version = currentVersion;
      return true;
    }
    return false;
  }, []);

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

  const hasSelectionChanged = useCallback((renderState: RenderState): boolean => {
    const currentSelectedSize = renderState.selectedCells.size;
    const currentEditingId = renderState.editingCell?.rowId + ':' + renderState.editingCell?.columnId;
    
    const previousSelectedSize = previousState.current.selectedCellsSize || 0;
    const previousEditingId = previousState.current.editingCellId || '';
    
    const hasChanged = currentSelectedSize !== previousSelectedSize || currentEditingId !== previousEditingId;
    
    if (hasChanged) {
      console.log('VibeGridX.hasSelectionChanged: Selection changed', {
        previousSize: previousSelectedSize,
        currentSize: currentSelectedSize,
        previousEditingId,
        currentEditingId,
        selectedCells: Array.from(renderState.selectedCells).slice(0, 5)
      });
      previousState.current.selectedCellsSize = currentSelectedSize;
      previousState.current.editingCellId = currentEditingId;
      return true;
    }
    return false;
  }, []);

  return {
    hasDataChanged,
    getChangedRows,
    hasSelectionChanged,
    previousState
  };
};

// ====================================
// RENDER STATE EXTRACTION
// ====================================

export const useRenderStateExtractor = (
  integrationRef: React.MutableRefObject<EntityIntegrationLayer | null>
) => {
  const extractRenderStateFromActor = useCallback((snapshot: any, providedColumns?: Column[]): RenderState | null => {
    if (!integrationRef.current) {
      console.warn('extractRenderStateFromActor: No integration layer available');
      return null;
    }
    
    try {
      // Get entity data from integration layer
      const entityData = integrationRef.current.getAllEntityData();
      // Use provided columns if available, otherwise get from integration
      const columns = providedColumns || integrationRef.current.getColumns();
      
      // Only log during initial render or when entity count changes
      const entityCount = Object.keys(entityData).length;
      console.log(`extractRenderStateFromActor: ${entityCount} entities, ${columns.length} columns`, {
        columnIds: columns.map(c => c.id),
        firstEntity: Object.values(entityData)[0]
      });
      
      // Convert to table rows with proper structure for AtomicTableRenderer
      const rows = Object.values(entityData).map((entity: any) => {
        const tableRow = {
          id: entity.id,
          data: { ...entity }, // Spread all entity fields into data
          metadata: {
            createdAt: entity.createdAt || new Date(),
            updatedAt: entity.updatedAt || new Date(),
            version: entity.version || 1,
            isNew: entity.isNew || false,
            isDirty: entity.isDirty || false
          }
        };
        
        return tableRow;
      });
      
      // Extract state from coordinators (when available)
      const selectionCoordinator = snapshot.context.actors?.selectionCoordinator;
      const editCoordinator = snapshot.context.actors?.editCoordinator;
      const viewCoordinator = snapshot.context.actors?.viewCoordinator;
      
      let selectedCells = new Set<string>();
      let editingCell = null;
      let groupedData = [];
      let optimisticOperations = new Map<string, OptimisticOperation>();
      
      // Safely extract selection state
      if (selectionCoordinator) {
        try {
          const selectionSnapshot = selectionCoordinator.getSnapshot();
          selectedCells = selectionSnapshot.context?.selectedCells || new Set();
          console.log('Extracted selection state:', {
            hasCoordinator: true,
            selectedCellsSize: selectedCells.size,
            selectedCells: Array.from(selectedCells).slice(0, 5)
          });
        } catch (error) {
          console.warn('Failed to get selection coordinator snapshot:', error);
        }
      } else {
        console.log('Selection coordinator not available yet');
      }
      
      // Safely extract edit state
      if (editCoordinator) {
        try {
          const editSnapshot = editCoordinator.getSnapshot();
          editingCell = editSnapshot.context?.editingCell || null;
          optimisticOperations = editSnapshot.context?.optimisticOperations || new Map();
        } catch (error) {
          console.warn('Failed to get edit coordinator snapshot:', error);
        }
      }
      
      // Safely extract view state
      let sortBy = [];
      let columnVisibility = {};
      let columnOrder = [];
      if (viewCoordinator) {
        try {
          const viewSnapshot = viewCoordinator.getSnapshot();
          groupedData = viewSnapshot.context?.groupedData || [];
          sortBy = viewSnapshot.context?.sortBy || [];
          columnVisibility = viewSnapshot.context?.columnVisibility || {};
          columnOrder = viewSnapshot.context?.columnOrder || [];
          
          // Debug log
          if (sortBy.length > 0) {
            console.log('[RenderStateExtractor] Extracted sortBy:', sortBy);
          }
          if (Object.keys(columnVisibility).length > 0) {
            const hiddenCount = Object.values(columnVisibility).filter(visible => !visible).length;
            console.log('[RenderStateExtractor] Extracted columnVisibility:', { hiddenCount });
          }
          if (columnOrder.length > 0) {
            console.log('[RenderStateExtractor] Extracted columnOrder:', columnOrder.length);
          }
        } catch (error) {
          console.warn('Failed to get view coordinator snapshot:', error);
        }
      }
      
      const renderState = {
        rows,
        columns,
        selectedCells,
        editingCell,
        groupedData,
        optimisticOperations,
        version: snapshot.context.version || 0,
        sortBy, // Add sort state to render state
        columnVisibility, // Add column visibility state to render state
        columnOrder // Add column order to render state
      };
      
      console.log('Final render state:', {
        rowCount: renderState.rows.length,
        selectedCells: renderState.selectedCells.size,
        version: renderState.version,
        firstRowData: renderState.rows[0]?.data
      });
      
      return renderState;
    } catch (error) {
      console.error('Error extracting render state:', error);
      console.error('Snapshot context:', snapshot.context);
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