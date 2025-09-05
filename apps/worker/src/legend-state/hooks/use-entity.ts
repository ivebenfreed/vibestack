/**
 * Universal Legend State Entity Hook
 * 
 * Provides a consistent way for components to access entity data with proper loading states.
 * Uses official Legend State patterns for reactive async data handling.
 */

import { use$ } from '@legendapp/state/react'
import { observable } from '@legendapp/state'
import { universeSchema$, universeLoading$, entities$ } from '../observables'
import { stateLog } from '@/logger';
const log = stateLog('legend-state/hooks/use-entity.ts');

export interface UseEntityResult<T = any> {
  /** Entity data as array */
  data: T[]
  /** Loading state - true while schema/entities are initializing */
  loading: boolean
  /** Error message if entity not found */
  error: string | null
  /** The raw entity observable for advanced use cases */
  observable: any | null
  /** True if loaded but no data exists */
  isEmpty: boolean
  /** Raw entity data as object (id -> entity) */
  rawData: Record<string, T> | null
}

/**
 * Universal hook for accessing entity data with proper loading states
 * 
 * Follows Legend State patterns:
 * - Uses computed observables for reactive lazy loading
 * - Proper loading state management
 * - Automatic updates when entities become available
 * 
 * @param entityName - Name of the entity to access
 * @returns Entity data with loading/error states
 */
export function useEntity$<T = any>(entityName: string): UseEntityResult<T> {
  // React to context and entities changes
  const schema = use$(universeSchema$)
  const loading = use$(universeLoading$)
  const allEntities = use$(entities$)
  
  // Create computed observable that returns entity when available
  const entityObs$ = observable(() => {
    if (!schema || !allEntities) return null
    return allEntities[entityName] || null
  })
  
  // Use the computed observable reactively
  const entityObs = use$(entityObs$)
  const entityData = use$(entityObs)
  
  // Determine loading state using Legend State patterns
  const isLoading = loading || !schema || !allEntities
  const hasError = !isLoading && !entityObs && schema
  
  // Convert to array format for components
  const dataArray = entityData ? Object.values(entityData) : []
  const isEmpty = !isLoading && entityData && Object.keys(entityData).length === 0
  
  log.info(`🔍 [useEntity$] ${entityName}:`, {
    loading: isLoading,
    hasSchema: !!schema,
    hasAllEntities: !!allEntities,
    hasEntityObs: !!entityObs,
    hasEntityData: !!entityData,
    dataCount: dataArray.length,
    isEmpty
  })
  
  return {
    data: dataArray,
    loading: isLoading,
    error: hasError ? `Entity ${entityName} not found in schema` : null,
    observable: entityObs,
    isEmpty,
    rawData: entityData || null
  }
}

/**
 * Hook for waiting for entity to be available (returns Promise)
 * 
 * @param entityName - Name of the entity to wait for
 * @returns Promise that resolves when entity is available
 */
export async function waitForEntity$(entityName: string): Promise<any> {
  return new Promise((resolve) => {
    const checkEntity = () => {
      const allEntities = entities$.get()
      if (allEntities?.[entityName]) {
        resolve(allEntities[entityName])
      } else {
        // Use requestAnimationFrame to avoid blocking
        requestAnimationFrame(checkEntity)
      }
    }
    checkEntity()
  })
}

/**
 * Hook for multiple entities at once
 * 
 * @param entityNames - Array of entity names
 * @returns Map of entity name to UseEntityResult
 */
export function useEntities$<T = any>(entityNames: string[]): Record<string, UseEntityResult<T>> {
  const results: Record<string, UseEntityResult<T>> = {}
  
  entityNames.forEach(entityName => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[entityName] = useEntity$<T>(entityName)
  })
  
  return results
}