import { useState, useEffect, useMemo } from 'react'
import { observable, Observable } from '@legendapp/state'
import { useObservable } from '@legendapp/state/react'
import { switchToOrganization, getOrgDataStore, clearOrgDataStore, loadEntityData } from '@/stores/org-data-store'
import { useAuth } from '@/state-machines'

export function useOrgDataStore() {
  const { currentOrganization } = useAuth()
  const [store, setStore] = useState(() => getOrgDataStore())
  
  useEffect(() => {
    if (currentOrganization?.id) {
      switchToOrganization(currentOrganization.id).then(() => {
        setStore(getOrgDataStore())
      }).catch(error => {
        console.error('[useOrgDataStore] Failed to switch organization:', error)
        setStore(null)
      })
    } else {
      clearOrgDataStore()
      setStore(null)
    }
  }, [currentOrganization?.id])
  
  return store
}

export function useEntityData(entityName: string) {
  const { currentOrganization } = useAuth()
  const store = useOrgDataStore()
  
  // Create a stable fallback observable that won't change between renders
  const fallbackObservable = useMemo(() => observable([]), [])
  
  // Use the actual observable with case-insensitive lookup
  const targetObservable = useMemo(() => {
    if (!store) return fallbackObservable
    
    // First try exact match
    if (store[entityName]) {
      return store[entityName] as Observable<any[]>
    }
    
    // Then try case-insensitive match
    const storeKeys = Object.keys(store).filter(key => key !== 'schema')
    const matchedKey = storeKeys.find(key => key.toLowerCase() === entityName.toLowerCase())
    
    return matchedKey ? store[matchedKey] as Observable<any[]> : fallbackObservable
  }, [store, entityName, fallbackObservable])
  
  // Use the correct Legend State React hook for observing external observables
  const observableData = useObservable(targetObservable).get()
  
  // Trigger lazy loading when the observable is accessed
  useEffect(() => {
    if (store && currentOrganization?.id && targetObservable !== fallbackObservable) {
      const currentData = targetObservable.peek()
      // Only load if data is empty and we haven't loaded before
      if (Array.isArray(currentData) && currentData.length === 0) {
        console.log(`[useEntityData] Lazy loading data for ${entityName}`)
        loadEntityData(currentOrganization.id, entityName, targetObservable)
      }
    }
  }, [store, currentOrganization?.id, entityName, targetObservable, fallbackObservable])

  // Debug the observable value to see what's happening
  useEffect(() => {
    console.log(`[useEntityData] Observable data changed for ${entityName}:`, {
      observableData,
      isArray: Array.isArray(observableData),
      length: Array.isArray(observableData) ? observableData.length : 'not array',
      targetObservable: targetObservable !== fallbackObservable ? 'real' : 'fallback'
    })
  }, [observableData, entityName, targetObservable, fallbackObservable])
  
  // With use$, we should get the actual array data directly
  // If observableData is not an array, it means the observable hasn't been set with array data yet
  const actualData = useMemo(() => {
    console.log(`[useEntityData] Processing data from use$ for ${entityName}:`, {
      observableData,
      type: typeof observableData,
      isArray: Array.isArray(observableData),
      length: Array.isArray(observableData) ? observableData.length : 'not array'
    })
    
    // use$ should return the actual value, so if it's an array, use it directly
    if (Array.isArray(observableData)) {
      console.log(`[useEntityData] Returning array data for ${entityName}, length:`, observableData.length)
      return observableData
    }
    
    // If not an array, return empty array (this means data hasn't loaded yet)
    console.log(`[useEntityData] No array data for ${entityName}, returning empty array`)
    return []
  }, [observableData, entityName])
  
  return actualData
}

export function useOrgSchema() {
  const store = useOrgDataStore()
  
  // Create a stable fallback observable for the schema
  const fallbackSchemaObservable = useMemo(() => observable(null), [])
  
  // Use the actual schema observable if available, otherwise use stable fallback
  // Only access store.schema if store exists and has been initialized
  const targetObservable = (store && store.schema) ? store.schema : fallbackSchemaObservable
  const schemaObservable = useObservable(targetObservable).get()
  
  // With use$, schemaObservable should be the actual schema value
  const schema = schemaObservable
  
  // If we have a store but no schema yet, try to get it directly from the store
  // This handles the case where the observable hasn't updated yet but the store exists
  const finalSchema = useMemo(() => {
    if (schema) return schema
    
    // If store exists and has schema, try to get it directly
    if (store && store.schema) {
      try {
        const directSchema = store.schema.peek()
        if (directSchema) {
          console.log('[useOrgSchema] Got schema directly from store.schema.peek():', directSchema)
          return directSchema
        }
      } catch (e) {
        console.warn('[useOrgSchema] Failed to peek schema from store:', e)
      }
    }
    
    return schema
  }, [schema, store])
  
  // Debug logging to understand what's happening
  console.log('[useOrgSchema] Debug info:', { 
    orgId,
    hasStore: !!store,
    hasStoreSchema: !!(store && store.schema),
    schemaFromObservable: schema,
    finalSchema,
    schemaType: typeof finalSchema,
    hasEntities: !!(finalSchema && finalSchema.entities),
    entityKeys: finalSchema && finalSchema.entities ? Object.keys(finalSchema.entities) : 'no entities'
  })
  
  return finalSchema
}