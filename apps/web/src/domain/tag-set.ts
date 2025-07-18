import { TagSet } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main tag sets store - holds all tag sets in normalized format
export const tagSetsAtom = createAtom<Record<string, TagSet>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useTagSetAtoms = {
  // All tag sets as sorted array
  allTagSets: () => {
    return useSelector(
      tagSetsAtom,
      (tagSetsRecord) => {
        const tagSets = Object.values(tagSetsRecord);
        return tagSets.sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Single tag set by ID
  tagSetById: (id: string) => {
    return useSelector(
      tagSetsAtom,
      (tagSetsRecord) => tagSetsRecord[id] || null,
      shallowEqual
    );
  },

  // Tag sets by category
  tagSetsByCategory: (category: string | null) => {
    return useSelector(
      tagSetsAtom,
      (tagSetsRecord) => {
        const tagSets = Object.values(tagSetsRecord);
        return tagSets
          .filter(ts => ts.category === category)
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Active tag sets
  activeTagSets: () => {
    return useSelector(
      tagSetsAtom,
      (tagSetsRecord) => {
        const tagSets = Object.values(tagSetsRecord);
        return tagSets
          .filter(ts => ts.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder);
      },
      shallowEqual
    );
  },

  // Tag set count
  tagSetCount: () => {
    return useSelector(
      tagSetsAtom,
      (tagSetsRecord) => Object.keys(tagSetsRecord).length
    );
  }
};

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

// Simple atom manipulation functions that DataForge operations can use
export const atomActions = {
  createTagSetAtomOnly: (tagSet: TagSet) => {
    const currentTagSets = tagSetsAtom.get();
    tagSetsAtom.set({ ...currentTagSets, [tagSet.id]: tagSet });
  },
  
  updateTagSetAtomOnly: (id: string, updates: Partial<TagSet>) => {
    const currentTagSets = tagSetsAtom.get();
    const existingTagSet = currentTagSets[id];
    if (existingTagSet) {
      tagSetsAtom.set({ ...currentTagSets, [id]: { ...existingTagSet, ...updates } });
    }
  },
  
  deleteTagSetAtomOnly: (id: string) => {
    const currentTagSets = tagSetsAtom.get();
    const { [id]: deleted, ...remaining } = currentTagSets;
    tagSetsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations  
  tagSetsAtom: tagSetsAtom
};

// Utility functions for loading data
export const tagSetUtils = {
  loadTagSets: (tagSets: TagSet[]) => {
    const tagSetsRecord = tagSets.reduce((acc, tagSet) => {
      acc[tagSet.id] = tagSet;
      return acc;
    }, {} as Record<string, TagSet>);
    tagSetsAtom.set(tagSetsRecord);
  },
  
  clearTagSets: () => tagSetsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(tagSetsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const tagSets = await dataSource.getRepository(TagSet).find({
        relations: ['tags', 'projects']
      });
      tagSetUtils.loadTagSets(tagSets);
    }
  }
};

// Live changes functions for integration
export function updateTagSetLiveChanges(id: string, updates: Partial<TagSet>): void {
  atomActions.updateTagSetAtomOnly(id, updates);
}

export function deleteTagSetLiveChanges(id: string): void {
  atomActions.deleteTagSetAtomOnly(id);
}

// ============================================================================
// 🎯 INCOMING SYNC FUNCTIONS - Required for sync system
// ============================================================================

// Handle incoming insert from sync system
export function insertTagSetIncoming(tagSet: TagSet): void {
  console.log('🔄 TagSet domain: Incoming insert', { id: tagSet.id, name: tagSet.name });
  atomActions.createTagSetAtomOnly(tagSet);
}

// Handle incoming update from sync system
export function updateTagSetIncoming(id: string, updates: Partial<TagSet>): void {
  console.log('🔄 TagSet domain: Incoming update', { id, updates });
  atomActions.updateTagSetAtomOnly(id, updates);
}

// Handle incoming delete from sync system
export function deleteTagSetIncoming(id: string): void {
  console.log('🔄 TagSet domain: Incoming delete', { id });
  atomActions.deleteTagSetAtomOnly(id);
}