import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGridDex now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * User Provider
 * 
 * Provides all users as options for assignment
 * Sorted by displayName/name
 */
export const userProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  console.warn('⚠️ DEPRECATED: Atom-based user provider called. VibeGridDex uses Dexie providers.');
  return [];
};