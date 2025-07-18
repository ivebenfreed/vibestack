import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGridDex now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * Tag Provider
 * 
 * Filters Tag options based on:
 * - Associated TagSets for the current project (if available)
 * - Active tags only
 * - Sorted by sortOrder
 */
export const tagProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  console.warn('⚠️ DEPRECATED: Atom-based tag provider called. VibeGridDex uses Dexie providers.');
  return [];
};