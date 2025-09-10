/**
 * Reusable hook for VibeGrid entity update handling
 * Connects to Legend State observables for all field types (text, select, etc.)
 */

import { useCallback } from 'react'
import { entityOperations } from '@/legend-state'
import { log } from '@/logger';
const fileLog = log('hooks/use-entity-update-handler.ts');

export function useEntityUpdateHandler(entityName: string) {
  return useCallback(async (rowId: string, updates: Record<string, any>) => {
    fileLog.info(`🔄 EntityUpdate (${entityName}): Update requested`, { rowId, updates });
    
    try {
      // Disable validation for now since the validation endpoint doesn't exist yet
      await entityOperations.updateEntity(entityName, rowId, updates, { validate: false });
      fileLog.info(`✅ EntityUpdate (${entityName}): Update successful`, { rowId, updates });
    } catch (error) {
      fileLog.error(`❌ EntityUpdate (${entityName}): Update failed`, { rowId, updates, error });
      throw error;
    }
  }, [entityName]);
}