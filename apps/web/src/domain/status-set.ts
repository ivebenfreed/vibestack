import { StatusSet } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main status sets store - holds all status sets in normalized format
export const statusSetsAtom = createAtom<Record<string, StatusSet>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useStatusSetAtoms = {
  // All status sets as sorted array
  allStatusSets: () => {
    return useSelector(
      statusSetsAtom,
      (statusSetsRecord) => {
        const statusSets = Object.values(statusSetsRecord);
        return statusSets.sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Single status set by ID
  statusSetById: (id: string) => {
    return useSelector(
      statusSetsAtom,
      (statusSetsRecord) => statusSetsRecord[id] || null,
      shallowEqual
    );
  },

  // Status sets by entity type
  statusSetsByEntityType: (entityType: string) => {
    return useSelector(
      statusSetsAtom,
      (statusSetsRecord) => {
        const statusSets = Object.values(statusSetsRecord);
        return statusSets
          .filter(ss => ss.entityType === entityType)
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Active status sets
  activeStatusSets: () => {
    return useSelector(
      statusSetsAtom,
      (statusSetsRecord) => {
        const statusSets = Object.values(statusSetsRecord);
        return statusSets
          .filter(ss => ss.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Status set count
  statusSetCount: () => {
    return useSelector(
      statusSetsAtom,
      (statusSetsRecord) => Object.keys(statusSetsRecord).length
    );
  }
};

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

// Simple atom manipulation functions that DataForge operations can use
export const atomActions = {
  createStatusSetAtomOnly: (statusSet: StatusSet) => {
    const currentStatusSets = statusSetsAtom.get();
    statusSetsAtom.set({ ...currentStatusSets, [statusSet.id]: statusSet });
  },
  
  updateStatusSetAtomOnly: (id: string, updates: Partial<StatusSet>) => {
    const currentStatusSets = statusSetsAtom.get();
    const existingStatusSet = currentStatusSets[id];
    if (existingStatusSet) {
      statusSetsAtom.set({ ...currentStatusSets, [id]: { ...existingStatusSet, ...updates } });
    }
  },
  
  deleteStatusSetAtomOnly: (id: string) => {
    const currentStatusSets = statusSetsAtom.get();
    const { [id]: deleted, ...remaining } = currentStatusSets;
    statusSetsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations  
  statusSetsAtom: statusSetsAtom
};

// Utility functions for loading data
export const statusSetUtils = {
  loadStatusSets: (statusSets: StatusSet[]) => {
    const statusSetsRecord = statusSets.reduce((acc, statusSet) => {
      acc[statusSet.id] = statusSet;
      return acc;
    }, {} as Record<string, StatusSet>);
    statusSetsAtom.set(statusSetsRecord);
  },
  
  clearStatusSets: () => statusSetsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(statusSetsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const statusSets = await dataSource.getRepository(StatusSet).find({
        relations: ['statuses', 'projects']
      });
      statusSetUtils.loadStatusSets(statusSets);
    }
  }
};

// Live changes functions for integration
export function updateStatusSetLiveChanges(id: string, updates: Partial<StatusSet>): void {
  atomActions.updateStatusSetAtomOnly(id, updates);
}

export function deleteStatusSetLiveChanges(id: string): void {
  atomActions.deleteStatusSetAtomOnly(id);
}

// ============================================================================
// 🎯 INCOMING SYNC FUNCTIONS - Required for sync system
// ============================================================================

// Handle incoming insert from sync system
export function insertStatusSetIncoming(statusSet: StatusSet): void {
  console.log('🔄 StatusSet domain: Incoming insert', { id: statusSet.id, name: statusSet.name });
  atomActions.createStatusSetAtomOnly(statusSet);
}

// Handle incoming update from sync system
export function updateStatusSetIncoming(id: string, updates: Partial<StatusSet>): void {
  console.log('🔄 StatusSet domain: Incoming update', { id, updates });
  atomActions.updateStatusSetAtomOnly(id, updates);
}

// Handle incoming delete from sync system
export function deleteStatusSetIncoming(id: string): void {
  console.log('🔄 StatusSet domain: Incoming delete', { id });
  atomActions.deleteStatusSetAtomOnly(id);
}