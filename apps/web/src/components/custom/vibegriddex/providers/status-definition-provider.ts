import type { RelationshipOptionsProvider, RelationshipContext } from '../types';
import type { StatusDefinition } from '@repo/dataforge/client-entities';

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGridDex now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * Status Definition Provider
 * 
 * Filters StatusDefinition options based on:
 * - StatusSet with entityType 'task' 
 * - Active status definitions only
 * - Sorted by sortOrder
 */
export const statusDefinitionProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  console.warn('⚠️ DEPRECATED: Atom-based status definition provider called. VibeGridDex uses Dexie providers.');
  return [];
};