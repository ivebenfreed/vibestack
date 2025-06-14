import { useRef, useEffect } from 'react'
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm'
import { useLiveEntity } from './useLiveEntity'

/**
 * Universal Reactive Data Pattern with Suspense Support
 * 
 * This hook implements the three-layer pattern:
 * 1. Router Loader Data (instant) - passed as prop
 * 2. Live Query Hook (real-time) - internal to hook
 * 3. Smart Fallback - use best available data source
 * 
 * Key benefits:
 * - Eliminates complex loading state management
 * - Provides instant data via router loaders
 * - Maintains real-time updates via live queries
 * - Throws promises for Suspense compatibility
 * - Always returns data (never null/undefined)
 */
export function useSuspenseEntity<T extends ObjectLiteral & { id: string }>(
  loaderData: T[] | null | undefined,           // Pre-loaded data from router loader
  liveQueryBuilder: SelectQueryBuilder<T> | null, // Live query for real-time updates
  options?: {
    transform?: boolean
    enabled?: boolean
  }
): T[] {
  const { transform = true, enabled = true } = options || {}
  
  // Use live query hook for real-time updates
  const { data: liveData, loading: liveLoading, error: liveError } = useLiveEntity<T>(
    liveQueryBuilder,
    { 
      enabled: enabled && !!liveQueryBuilder,
      transform 
    }
  )
  
  // Track if we've ever had data to avoid unnecessary suspense
  const hasHadDataRef = useRef(false)
  
  // Update the ref when we get data (including empty arrays as valid data)
  useEffect(() => {
    if (loaderData !== null && loaderData !== undefined) {
      hasHadDataRef.current = true
    }
    if (liveData !== null && liveData !== undefined) {
      hasHadDataRef.current = true
    }
  }, [loaderData, liveData])
  
  // Error handling - throw error for error boundaries
  if (liveError) {
    throw liveError
  }
  
  // Smart fallback logic
  const data = liveData || loaderData || []
  
  // Suspense logic: Only suspend if we have no data sources available and are still loading
  // Don't suspend if we have loader data (even if empty) or if live query returned data (even if empty)
  const hasValidDataSource = (loaderData !== null && loaderData !== undefined) || 
                             (liveData !== null && liveData !== undefined)
  
  if (!hasValidDataSource && liveLoading && enabled && !!liveQueryBuilder) {
    // Create a promise that will resolve when data is available
    const promise = new Promise<T[]>((resolve) => {
      // This will be resolved by the live query hook when data arrives
      const checkForData = () => {
        if (liveData !== null && liveData !== undefined) {
          resolve(liveData)
        } else if (loaderData !== null && loaderData !== undefined) {
          resolve(loaderData)
        } else if (!liveLoading) {
          // Live query finished but no data - resolve with empty array
          resolve([])
        } else {
          // Check again on next tick
          setTimeout(checkForData, 10)
        }
      }
      checkForData()
    })
    
    // Throw the promise to trigger Suspense
    throw promise
  }
  
  // Always return data (Suspense guarantees we have data when we reach here)
  return data
}

/**
 * Suspense-compatible hook for single entities
 */
export function useSuspenseEntitySingle<T extends ObjectLiteral & { id: string }>(
  loaderData: T | null | undefined,
  liveQueryBuilder: SelectQueryBuilder<T> | null,
  options?: {
    transform?: boolean
    enabled?: boolean
  }
): T | null {
  const { transform = true, enabled = true } = options || {}
  
  // Use live query hook for real-time updates
  const { data: liveDataArray, loading: liveLoading, error: liveError } = useLiveEntity<T>(
    liveQueryBuilder,
    { 
      enabled: enabled && !!liveQueryBuilder,
      transform 
    }
  )
  
  // Extract single entity from array
  const liveData = liveDataArray?.[0] || null
  
  // Track if we've ever had data
  const hasHadDataRef = useRef(false)
  
  useEffect(() => {
    if (loaderData !== null && loaderData !== undefined) {
      hasHadDataRef.current = true
    }
    if (liveData !== null && liveData !== undefined) {
      hasHadDataRef.current = true
    }
  }, [loaderData, liveData])
  
  // Error handling
  if (liveError) {
    throw liveError
  }
  
  // Smart fallback logic
  const data = liveData || loaderData || null
  
  // Suspense logic for single entities
  const hasValidDataSource = (loaderData !== null && loaderData !== undefined) || 
                             (liveData !== null && liveData !== undefined)
  
  if (!hasValidDataSource && liveLoading && enabled && !!liveQueryBuilder) {
    const promise = new Promise<T | null>((resolve) => {
      const checkForData = () => {
        if (liveDataArray !== null && liveDataArray !== undefined) {
          resolve(liveDataArray[0] || null)
        } else if (loaderData !== null && loaderData !== undefined) {
          resolve(loaderData)
        } else if (!liveLoading) {
          // Live query finished but no data - resolve with null
          resolve(null)
        } else {
          setTimeout(checkForData, 10)
        }
      }
      checkForData()
    })
    
    throw promise
  }
  
  return data
} 