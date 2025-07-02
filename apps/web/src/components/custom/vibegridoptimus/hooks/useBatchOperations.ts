import { useCallback } from 'react'
import type { BaseEntity, BatchUpdate } from '../types'
import { PERFORMANCE } from '../utils/constants'

interface BatchOperationOptions<TEntity extends BaseEntity> {
  onUpdate?: (id: string, updates: Partial<TEntity>) => Promise<void>
  onBatchUpdate?: (batchUpdates: Array<{ id: string; updates: Partial<TEntity> }>) => Promise<void>
}

/**
 * Hook for handling batch operations efficiently
 */
export function useBatchOperations<TEntity extends BaseEntity>({
  onUpdate,
  onBatchUpdate
}: BatchOperationOptions<TEntity>) {
  
  const processBatchUpdates = useCallback(async (
    updates: BatchUpdate<TEntity>[]
  ): Promise<void> => {
    if (updates.length === 0) return
    
    // Single update - use normal onUpdate for optimal performance
    if (updates.length === 1) {
      const { id, changes } = updates[0]
      await onUpdate?.(id, changes)
      return
    }
    
    // Multiple updates - use dedicated batch function if available
    if (onBatchUpdate) {
      console.log('[VibeGridOptimus] 🚀 Processing batch update for', updates.length, 'items')
      await onBatchUpdate(updates.map(({ id, changes }) => ({ id, updates: changes })))
      return
    }
    
    // Fallback to parallel individual updates
    if (onUpdate) {
      console.log('[VibeGridOptimus] 🔄 Fallback to parallel updates for', updates.length, 'items')
      
      const results = await Promise.allSettled(
        updates.map(({ id, changes }) => onUpdate(id, changes))
      )
      
      // Log any failures
      const failures = results.filter(result => result.status === 'rejected')
      if (failures.length > 0) {
        console.error('[VibeGridOptimus] ❌ Batch update failures:', failures)
        throw new Error(`${failures.length} updates failed`)
      }
      
      console.log('[VibeGridOptimus] ✅ Batch update completed successfully')
    }
  }, [onUpdate, onBatchUpdate])
  
  const shouldUseBatch = useCallback((operationCount: number): boolean => {
    return operationCount > PERFORMANCE.BATCH_SIZE_THRESHOLD
  }, [])
  
  const createBatchUpdate = useCallback((
    id: string,
    changes: Partial<TEntity>
  ): BatchUpdate<TEntity> => ({
    id,
    changes
  }), [])
  
  return {
    processBatchUpdates,
    shouldUseBatch,
    createBatchUpdate
  }
}