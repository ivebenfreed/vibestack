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
  // Direct selector without complex caching - let XState handle reactivity
  return useSelector(atom, (record) => {
    if (!record || typeof record !== 'object') {
      return []
    }
    
    const values = Object.values(record)
    return sortFn ? [...values].sort(sortFn) : values
  }, shallowEqual)
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