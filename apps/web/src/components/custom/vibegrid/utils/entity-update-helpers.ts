// Import Dexie domain services
import { domainServices } from '@/domain';
import type { VibeGridXEntityType } from '../hooks/useDexieEntityConfig';

/**
 * Get the appropriate update function for an entity type
 * These functions handle both local updates and sync tracking
 */
export function getUpdateFunction(entityType: VibeGridXEntityType | null) {
  return async (id: string, updates: Record<string, any>) => {
    console.log('[getUpdateFunction] onEntityUpdate called', { id, updates, entityType });
    
    switch (entityType) {
      case 'task':
        await domainServices.task.updateUI(id, updates);
        break;
      case 'project':
        await domainServices.project.updateUI(id, updates);
        break;
      case 'user':
        await domainServices.user.updateUI(id, updates);
        break;
      case 'comment':
        await domainServices.comment.updateUI(id, updates);
        break;
      default:
        console.warn(`[getUpdateFunction] No update handler for entity type: ${entityType}`);
    }
  };
}