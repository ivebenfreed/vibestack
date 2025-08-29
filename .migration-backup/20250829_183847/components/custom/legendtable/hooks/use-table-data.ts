import { useState, useEffect, useMemo } from 'react';
import { observable } from '@legendapp/state';
import type { TableRow } from '../types';

export function useTableData(entityType: string, initialData?: TableRow[]) {
  // Create data observable
  const data$ = useMemo(() => {
    console.log('[useTableData] Creating data observable for:', entityType);
    return observable(initialData || []);
  }, []);
  
  // Use only real data - no dummy data fallback
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      console.log('[useTableData] Using provided initial data:', initialData.length, 'rows');
      data$.set(initialData);
    } else {
      console.log('[useTableData] No initial data provided, keeping empty table');
      data$.set([]);
    }
  }, [entityType, initialData, data$]);
  
  // Provide utility functions for data manipulation
  const dataActions = useMemo(() => ({
    updateRow: (rowId: string, updates: Record<string, any>) => {
      const currentData = data$.get();
      const updatedData = currentData.map(row =>
        row.id === rowId 
          ? { ...row, data: { ...row.data, ...updates } }
          : row
      );
      data$.set(updatedData);
    },
    
    addRow: (newRow: TableRow) => {
      const currentData = data$.get();
      data$.set([...currentData, newRow]);
    },
    
    removeRow: (rowId: string) => {
      const currentData = data$.get();
      const filteredData = currentData.filter(row => row.id !== rowId);
      data$.set(filteredData);
    },
    
    replaceData: (newData: TableRow[]) => {
      data$.set(newData);
    },
    
    refreshData: () => {
      // No dummy data - refresh would reload from the actual data source
      console.log('[useTableData] Refresh requested - real data source should handle this');
    }
  }), [data$, entityType, initialData]);
  
  return {
    data$,
    actions: dataActions
  };
}