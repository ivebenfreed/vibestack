import { Tag } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main tags store - holds all tags in normalized format
export const tagsAtom = createAtom<Record<string, Tag>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useTagAtoms = {
  // All tags as sorted array
  allTags: () => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => {
        const tags = Object.values(tagsRecord);
        return tags.sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Single tag by ID
  tagById: (id: string) => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => tagsRecord[id] || null,
      shallowEqual
    );
  },

  // Tags by tag set ID
  tagsByTagSet: (tagSetId: string) => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => {
        const tags = Object.values(tagsRecord);
        return tags
          .filter(tag => tag.tagSetId === tagSetId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Active tags
  activeTags: () => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => {
        const tags = Object.values(tagsRecord);
        return tags
          .filter(tag => tag.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Tags by parent ID
  tagsByParent: (parentId: string | null) => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => {
        const tags = Object.values(tagsRecord);
        return tags
          .filter(tag => tag.parentId === parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
      },
      shallowEqual
    );
  },

  // Tag count
  tagCount: () => {
    return useSelector(
      tagsAtom,
      (tagsRecord) => Object.keys(tagsRecord).length
    );
  }
};

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

// Simple atom manipulation functions that DataForge operations can use
export const atomActions = {
  createTagAtomOnly: (tag: Tag) => {
    const currentTags = tagsAtom.get();
    tagsAtom.set({ ...currentTags, [tag.id]: tag });
  },
  
  updateTagAtomOnly: (id: string, updates: Partial<Tag>) => {
    const currentTags = tagsAtom.get();
    const existingTag = currentTags[id];
    if (existingTag) {
      tagsAtom.set({ ...currentTags, [id]: { ...existingTag, ...updates } });
    }
  },
  
  deleteTagAtomOnly: (id: string) => {
    const currentTags = tagsAtom.get();
    const { [id]: deleted, ...remaining } = currentTags;
    tagsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations  
  tagsAtom: tagsAtom
};

// Utility functions for loading data
export const tagUtils = {
  loadTags: (tags: Tag[]) => {
    const tagsRecord = tags.reduce((acc, tag) => {
      acc[tag.id] = tag;
      return acc;
    }, {} as Record<string, Tag>);
    tagsAtom.set(tagsRecord);
  },
  
  clearTags: () => tagsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(tagsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const tags = await dataSource.getRepository(Tag).find({
        relations: ['tagSet', 'parent']
      });
      tagUtils.loadTags(tags);
    }
  }
};

// Live changes functions for integration
export function updateTagLiveChanges(id: string, updates: Partial<Tag>): void {
  atomActions.updateTagAtomOnly(id, updates);
}

export function deleteTagLiveChanges(id: string): void {
  atomActions.deleteTagAtomOnly(id);
}

// ============================================================================
// 🎯 INCOMING SYNC FUNCTIONS - Required for sync system
// ============================================================================

// Handle incoming insert from sync system
export function insertTagIncoming(tag: Tag): void {
  console.log('🔄 Tag domain: Incoming insert', { id: tag.id, name: tag.name });
  atomActions.createTagAtomOnly(tag);
}

// Handle incoming update from sync system
export function updateTagIncoming(id: string, updates: Partial<Tag>): void {
  console.log('🔄 Tag domain: Incoming update', { id, updates });
  atomActions.updateTagAtomOnly(id, updates);
}

// Handle incoming delete from sync system
export function deleteTagIncoming(id: string): void {
  console.log('🔄 Tag domain: Incoming delete', { id });
  atomActions.deleteTagAtomOnly(id);
}