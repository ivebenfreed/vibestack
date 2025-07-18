import { StatusDefinition } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main status definitions store - holds all status definitions in normalized format
export const statusDefinitionsAtom = createAtom<Record<string, StatusDefinition>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useStatusDefinitionAtoms = {
  // All status definitions as sorted array
  allStatusDefinitions: () => {
    return useSelector(
      statusDefinitionsAtom,
      (statusDefinitionsRecord) => {
        const statusDefinitions = Object.values(statusDefinitionsRecord);
        return statusDefinitions.sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Single status definition by ID
  statusDefinitionById: (id: string) => {
    return useSelector(
      statusDefinitionsAtom,
      (statusDefinitionsRecord) => statusDefinitionsRecord[id] || null,
      shallowEqual
    );
  },

  // Status definitions by status set ID
  statusDefinitionsByStatusSet: (statusSetId: string) => {
    return useSelector(
      statusDefinitionsAtom,
      (statusDefinitionsRecord) => {
        const statusDefinitions = Object.values(statusDefinitionsRecord);
        return statusDefinitions
          .filter(sd => sd.statusSetId === statusSetId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Active status definitions
  activeStatusDefinitions: () => {
    return useSelector(
      statusDefinitionsAtom,
      (statusDefinitionsRecord) => {
        const statusDefinitions = Object.values(statusDefinitionsRecord);
        return statusDefinitions
          .filter(sd => sd.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Status definition count
  statusDefinitionCount: () => {
    return useSelector(
      statusDefinitionsAtom,
      (statusDefinitionsRecord) => Object.keys(statusDefinitionsRecord).length
    );
  }
};

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

// Simple atom manipulation functions that DataForge operations can use
export const atomActions = {
  createStatusDefinitionAtomOnly: (statusDefinition: StatusDefinition) => {
    const currentStatusDefinitions = statusDefinitionsAtom.get();
    statusDefinitionsAtom.set({ ...currentStatusDefinitions, [statusDefinition.id]: statusDefinition });
  },
  
  updateStatusDefinitionAtomOnly: (id: string, updates: Partial<StatusDefinition>) => {
    const currentStatusDefinitions = statusDefinitionsAtom.get();
    const existingStatusDefinition = currentStatusDefinitions[id];
    if (existingStatusDefinition) {
      statusDefinitionsAtom.set({ ...currentStatusDefinitions, [id]: { ...existingStatusDefinition, ...updates } });
    }
  },
  
  deleteStatusDefinitionAtomOnly: (id: string) => {
    const currentStatusDefinitions = statusDefinitionsAtom.get();
    const { [id]: deleted, ...remaining } = currentStatusDefinitions;
    statusDefinitionsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations  
  statusDefinitionsAtom: statusDefinitionsAtom
};

// Utility functions for loading data
export const statusDefinitionUtils = {
  loadStatusDefinitions: (statusDefinitions: StatusDefinition[]) => {
    const statusDefinitionsRecord = statusDefinitions.reduce((acc, statusDefinition) => {
      acc[statusDefinition.id] = statusDefinition;
      return acc;
    }, {} as Record<string, StatusDefinition>);
    statusDefinitionsAtom.set(statusDefinitionsRecord);
  },
  
  clearStatusDefinitions: () => statusDefinitionsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(statusDefinitionsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const statusDefinitions = await dataSource.getRepository(StatusDefinition).find({
        relations: ['statusSet']
      });
      statusDefinitionUtils.loadStatusDefinitions(statusDefinitions);
    }
  }
};

// Live changes functions for integration
export function updateStatusDefinitionLiveChanges(id: string, updates: Partial<StatusDefinition>): void {
  atomActions.updateStatusDefinitionAtomOnly(id, updates);
}

export function deleteStatusDefinitionLiveChanges(id: string): void {
  atomActions.deleteStatusDefinitionAtomOnly(id);
}

// ============================================================================
// 🎯 INCOMING SYNC FUNCTIONS - Required for sync system
// ============================================================================

// Handle incoming insert from sync system
export function insertStatusDefinitionIncoming(statusDefinition: StatusDefinition): void {
  console.log('🔄 StatusDefinition domain: Incoming insert', { id: statusDefinition.id, name: statusDefinition.name });
  atomActions.createStatusDefinitionAtomOnly(statusDefinition);
}

// Handle incoming update from sync system
export function updateStatusDefinitionIncoming(id: string, updates: Partial<StatusDefinition>): void {
  console.log('🔄 StatusDefinition domain: Incoming update', { id, updates });
  atomActions.updateStatusDefinitionAtomOnly(id, updates);
}

// Handle incoming delete from sync system
export function deleteStatusDefinitionIncoming(id: string): void {
  console.log('🔄 StatusDefinition domain: Incoming delete', { id });
  atomActions.deleteStatusDefinitionAtomOnly(id);
}