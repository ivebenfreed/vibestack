/**
 * Reusable hook for VibeGrid entity update handling
 * Connects to Legend State observables for all field types (text, select, etc.)
 */

import { useCallback } from 'react'
import { entityOperations } from '@/legend-state'
import { stateLog } from '@/logger';
const log = stateLog('hooks/use-entity-update-handler.ts');

export function useEntityUpdateHandler(entityName: string) {
  return useCallback(async (rowId: string, updates: Record<string, any>) => {
    log.info(`🔄 EntityUpdate (${entityName}): Update requested`, { rowId, updates });
    
    try {
      // Disable validation for now since the validation endpoint doesn't exist yet
      await entityOperations.updateEntity(entityName, rowId, updates, { validate: false });
      log.info(`✅ EntityUpdate (${entityName}): Update successful`, { rowId, updates });
    } catch (error) {
      log.error(`❌ EntityUpdate (${entityName}): Update failed`, { rowId, updates, error });
      throw error;
    }
  }, [entityName]);
}