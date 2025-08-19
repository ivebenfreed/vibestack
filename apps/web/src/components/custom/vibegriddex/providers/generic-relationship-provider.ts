import type { RelationshipOptionsProvider, RelationshipContext, EnumOption, Column } from '../types';

/**
 * Generic relationship provider for VibeGridDex components.
 */
export function createGenericRelationshipProvider(
  column: Column,
  relationshipAtoms: Record<string, any>
): RelationshipOptionsProvider {
  return async (context: RelationshipContext) => {
    console.warn('⚠️ DEPRECATED: Atom-based relationship provider called. Use Dexie-based provider instead.', {
      columnId: column.id,
      relationshipTable: column.relationshipTable
    });
    
    // This provider is deprecated - return empty array
    return [];
  };
}