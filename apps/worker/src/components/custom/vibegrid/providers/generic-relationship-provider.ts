import type { RelationshipOptionsProvider, RelationshipContext, EnumOption, Column } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/providers/generic-relationship-provider.ts');

/**
 * Generic relationship provider for VibeGrid components.
 */
export function createGenericRelationshipProvider(
  column: Column,
  relationshipAtoms: Record<string, any>
): RelationshipOptionsProvider {
  return async (context: RelationshipContext) => {
    log.warn('⚠️ DEPRECATED: Atom-based relationship provider called. Use Dexie-based provider instead.', {
      columnId: column.id,
      relationshipTable: column.relationshipTable
    });
    
    // This provider is deprecated - return empty array
    return [];
  };
}