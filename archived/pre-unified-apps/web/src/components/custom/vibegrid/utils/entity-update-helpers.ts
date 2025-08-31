// Import Legend State entity operations
import { entityOperations } from '@/legend-state';
import type { VibeGridXEntityType } from '../hooks/useDexieEntityConfig';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/utils/entity-update-helpers.ts');

/**
 * Get the appropriate update function for an entity type using Legend State
 * These functions handle both local updates and sync tracking
 */
export function getUpdateFunction(entityType: VibeGridXEntityType | null) {
  return async (id: string, updates: Record<string, any>) => {
    log.info('[getUpdateFunction] onEntityUpdate called with Legend State', { id, updates, entityType });
    
    if (!entityType) {
      log.warn('[getUpdateFunction] No entity type provided');
      return;
    }
    
    try {
      // Convert entity type to proper case for Legend State entity names
      const entityName = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      await entityOperations.updateEntity(entityName, id, updates);
      log.info(`[getUpdateFunction] Successfully updated ${entityName}:${id}`);
    } catch (error) {
      log.error(`[getUpdateFunction] Failed to update ${entityType}:${id}:`, error);
      throw error;
    }
  };
}