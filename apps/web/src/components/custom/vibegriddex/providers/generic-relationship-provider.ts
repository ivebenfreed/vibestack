import type { RelationshipOptionsProvider, RelationshipContext, EnumOption, Column } from '../types';

/**
 * @deprecated This atom-based provider is deprecated. Use generic-relationship-provider-dexie.ts instead.
 * VibeGridDex is now pure Dexie-based and no longer supports atoms.
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