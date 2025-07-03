/**
 * useStableEntityArray - Provides stable array references for XState entity atoms
 * 
 * Solves the performance issue where Object.values(record) creates new array
 * references on every render, causing unnecessary re-renders of table components.
 * 
 * Uses WeakMap caching to maintain stable array and entity object references,
 * only creating new arrays when entities actually change.
 */

import { useMemo, useRef } from 'react'
import type { Atom } from '@xstate/store'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'

// Base entity interface that all DataForge entities implement
interface BaseEntity {
  id: string
  updatedAt: Date | string
}

// WeakMap cache for stable array references
const arrayCache = new WeakMap<Record<string, any>, any[]>()
const entityCache = new WeakMap<any, any>()

/**
 * Creates a stable array from an XState atom containing a record of entities.
 * Only creates new array references when the underlying data actually changes.
 * 
 * @param atom - XState atom containing Record<string, TEntity>
 * @param sortFn - Optional sort function for the array
 * @returns Stable array of entities that only changes when data changes
 */
export function useStableEntityArray<TEntity extends BaseEntity>(
  atom: Atom<Record<string, TEntity>>,
  sortFn?: (a: TEntity, b: TEntity) => number
): TEntity[] {
  // Track the last known entity timestamps for change detection
  const lastTimestampsRef = useRef<Record<string, string>>({})
  
  // Subscribe to atom changes
  const entitiesRecord = useSelector(atom, (record) => record, shallowEqual)
  
  return useMemo(() => {
    if (!entitiesRecord || typeof entitiesRecord !== 'object') {
      return []
    }
    
    // Check if we have a cached array for this record reference
    const cachedArray = arrayCache.get(entitiesRecord)
    if (cachedArray) {
      return cachedArray
    }
    
    // Detect if any entities have actually changed
    const currentTimestamps: Record<string, string> = {}
    let hasChanges = false
    
    for (const [id, entity] of Object.entries(entitiesRecord)) {
      const timestamp = entity.updatedAt instanceof Date 
        ? entity.updatedAt.toISOString() 
        : String(entity.updatedAt)
      
      currentTimestamps[id] = timestamp
      
      // Check if this entity is new or has changed
      if (lastTimestampsRef.current[id] !== timestamp) {
        hasChanges = true
      }
    }
    
    // Check if any entities were deleted
    for (const id in lastTimestampsRef.current) {
      if (!(id in currentTimestamps)) {
        hasChanges = true
        break
      }
    }
    
    // If no changes detected and we have a previous array, return it
    if (!hasChanges && Object.keys(lastTimestampsRef.current).length > 0) {
      // This shouldn't happen due to WeakMap caching, but safety fallback
      const values = Object.values(entitiesRecord)
      const stableArray = sortFn ? values.sort(sortFn) : values
      arrayCache.set(entitiesRecord, stableArray)
      return stableArray
    }
    
    // Update timestamp tracking
    lastTimestampsRef.current = currentTimestamps
    
    // Create stable entity references
    const stableEntities: TEntity[] = []
    for (const entity of Object.values(entitiesRecord)) {
      // Check if we have a cached stable reference for this entity
      const cachedEntity = entityCache.get(entity)
      if (cachedEntity && cachedEntity.updatedAt === entity.updatedAt) {
        stableEntities.push(cachedEntity)
      } else {
        // Create new stable reference and cache it
        entityCache.set(entity, entity)
        stableEntities.push(entity)
      }
    }
    
    // Apply sorting if provided
    const finalArray = sortFn ? stableEntities.sort(sortFn) : stableEntities
    
    // Cache the array for this record reference
    arrayCache.set(entitiesRecord, finalArray)
    
    return finalArray
  }, [entitiesRecord, sortFn])
}

/**
 * Convenience hook for common sorting patterns
 */
export function useStableEntityArraySorted<TEntity extends BaseEntity>(
  atom: Atom<Record<string, TEntity>>,
  sortBy: keyof TEntity = 'updatedAt' as keyof TEntity,
  direction: 'asc' | 'desc' = 'desc'
): TEntity[] {
  const sortFn = useMemo(() => {
    return (a: TEntity, b: TEntity) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    }
  }, [sortBy, direction])
  
  return useStableEntityArray(atom, sortFn)
}

/**
 * Convenience hook for filtered stable arrays
 * Creates a stable filtered array that only changes when the filter results change
 */
export function useStableEntityArrayFiltered<TEntity extends BaseEntity>(
  atom: Atom<Record<string, TEntity>>,
  filterFn: (entity: TEntity) => boolean,
  sortFn?: (a: TEntity, b: TEntity) => number
): TEntity[] {
  // Get the base stable array
  const stableArray = useStableEntityArray(atom)
  
  // Apply filtering and sorting with memoization
  return useMemo(() => {
    const filtered = stableArray.filter(filterFn)
    return sortFn ? filtered.sort(sortFn) : filtered
  }, [stableArray, filterFn, sortFn])
}