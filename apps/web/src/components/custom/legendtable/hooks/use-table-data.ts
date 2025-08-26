import { useState, useEffect, useMemo } from 'react';
import { observable } from '@legendapp/state';
import type { TableRow } from '../types';
import { generateDummyData } from '../utils/legend-helpers';

export function useTableData(entityType: string, initialData?: TableRow[]) {
  // Create data observable
  const data$ = useMemo(() => {
    console.log('[useTableData] Creating data observable for:', entityType);
    return observable(initialData || []);
  }, []);
  
  // Generate dummy data if no initial data provided
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      console.log('[useTableData] Using provided initial data:', initialData.length, 'rows');
      return;
    }
    
    console.log('[useTableData] Generating dummy data for:', entityType);
    const dummyData = generateDummyData(entityType, 1000);
    data$.set(dummyData);
    
    console.log('[useTableData] Generated', dummyData.length, 'dummy rows for', entityType);
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
      if (!initialData) {
        const freshData = generateDummyData(entityType, 1000);
        data$.set(freshData);
      }
    }
  }), [data$, entityType, initialData]);
  
  return {
    data$,
    actions: dataActions
  };
}