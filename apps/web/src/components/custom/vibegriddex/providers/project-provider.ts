import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGridDex now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * Project Provider
 * 
 * Provides all active projects as options
 * Sorted by name
 */
export const projectProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  console.warn('⚠️ DEPRECATED: Atom-based project provider called. VibeGridDex uses Dexie providers.');
  return [];
};