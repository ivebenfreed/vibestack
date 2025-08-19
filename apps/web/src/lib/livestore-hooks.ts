/**
 * Pure LiveStore React Hooks - Complete Dexie Replacement
 * 
 * Replaces ALL Dexie functionality with LiveStore equivalents.
 * These hooks provide the same API as Dexie but use LiveStore natively.
 */

import { useState, useEffect, useCallback } from 'react'
import { liveStoreEventGenerator } from './livestore-event-generator'
import { liveStoreSchemaClient } from './livestore-schema-client'
import type { LiveStoreMutations } from './livestore-event-generator'

// ===== CORE HOOKS =====

/**
 * Replace useLiveQuery from Dexie with LiveStore equivalent
 */
export function useLiveStoreQuery<T = any>(
  organizationId: string | null,
  entityName: string,
  sql?: string,
  params: any[] = []
): {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = useCallback(async () => {
    if (!organizationId) {
      setData([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
      
      if (!liveStoreInstance) {
        throw new Error(`LiveStore not available for organization: ${organizationId}`)
      }

      // Use provided SQL or generate default query
      const tableName = `org_${organizationId}_${entityName}`
      const query = sql || `SELECT * FROM "${tableName}" WHERE organization_id = ?`
      const queryParams = sql ? params : [organizationId]

      console.log(`📊 LiveStore query: ${query}`, queryParams)

      // Execute query on LiveStore
      const result = await liveStoreInstance.store.query(query, queryParams)
      setData(result || [])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Query failed'
      console.error(`❌ LiveStore query failed for ${entityName}:`, err)
      setError(errorMessage)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, entityName, sql, JSON.stringify(params)])

  // Setup subscription for real-time updates
  useEffect(() => {
    if (!organizationId) return

    let unsubscribe: (() => void) | null = null

    const setupSubscription = async () => {
      try {
        const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
        
        if (liveStoreInstance) {
          const tableName = `org_${organizationId}_${entityName}`
          
          console.log(`📡 Setting up LiveStore subscription for: ${tableName}`)
          
          // LiveStore subscription using events stream
          const eventsStream = liveStoreInstance.store.events()
          for await (const event of eventsStream) {
            if (event.table === tableName) {
              console.log(`🔄 LiveStore change detected for: ${tableName}`)
              await executeQuery()
            }
          }
        }
      } catch (err) {
        console.error(`❌ Failed to setup subscription for ${entityName}:`, err)
      }
    }

    // Initial load
    executeQuery()
    
    // Setup subscription
    setupSubscription()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [executeQuery, organizationId, entityName])

  return {
    data,
    loading,
    error,
    refetch: executeQuery
  }
}

/**
 * Replace direct Dexie mutations with LiveStore mutations
 */
export function useLiveStoreMutations(organizationId: string | null): {
  mutations: LiveStoreMutations | null
  loading: boolean
  error: string | null
} {
  const [mutations, setMutations] = useState<LiveStoreMutations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setMutations(null)
      setLoading(false)
      return
    }

    const loadMutations = async () => {
      try {
        setLoading(true)
        setError(null)

        const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
        const orgSchema = await liveStoreSchemaClient.getOrgSchema(organizationId)
        
        if (!liveStoreInstance) {
          throw new Error(`LiveStore not available for organization: ${organizationId}`)
        }

        if (!orgSchema) {
          throw new Error(`Organization schema not available for: ${organizationId}`)
        }

        console.log(`🔧 Creating LiveStore mutations for org: ${organizationId}`)

        const generatedMutations = await liveStoreEventGenerator.createMutations(
          organizationId, 
          liveStoreInstance.store, 
          orgSchema
        )
        
        setMutations(generatedMutations)
        console.log(`✅ LiveStore mutations ready for org: ${organizationId}`)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load mutations'
        console.error(`❌ Failed to load mutations for org ${organizationId}:`, err)
        setError(errorMessage)
        setMutations(null)
      } finally {
        setLoading(false)
      }
    }

    loadMutations()
  }, [organizationId])

  return { mutations, loading, error }
}

// ===== ENTITY-SPECIFIC HOOKS (Replace Dexie table access) =====

/**
 * Replace: useLiveQuery(() => db.projects.where('organization_id').equals(orgId).toArray())
 */
export function useProjects(organizationId: string | null) {
  if (!organizationId) {
    return useLiveStoreQuery(null, 'projects')
  }
  
  const tableName = `org_${organizationId}_projects`
  return useLiveStoreQuery(
    organizationId,
    'projects',
    `SELECT * FROM "${tableName}" WHERE organization_id = ? ORDER BY created_at DESC`,
    [organizationId]
  )
}

/**
 * Replace: useLiveQuery(() => db.tasks.where('organization_id').equals(orgId).toArray())
 */
export function useTasks(organizationId: string | null, projectId?: string) {
  if (!organizationId) {
    return useLiveStoreQuery(null, 'tasks')
  }
  
  const tableName = `org_${organizationId}_tasks`
  const whereClause = projectId 
    ? 'WHERE organization_id = ? AND project_id = ?' 
    : 'WHERE organization_id = ?'
  const params = projectId ? [organizationId, projectId] : [organizationId]
  
  return useLiveStoreQuery(
    organizationId,
    'tasks',
    `SELECT * FROM "${tableName}" ${whereClause} ORDER BY created_at DESC`,
    params
  )
}

/**
 * Replace: useLiveQuery(() => db.users.where('organization_id').equals(orgId).toArray())
 */
export function useUsers(organizationId: string | null) {
  if (!organizationId) {
    return useLiveStoreQuery(null, 'users')
  }
  
  const tableName = `org_${organizationId}_users`
  return useLiveStoreQuery(
    organizationId,
    'users',
    `SELECT * FROM "${tableName}" WHERE organization_id = ? ORDER BY name`,
    [organizationId]
  )
}

/**
 * Replace: useLiveQuery(() => db.organizations.toArray())
 */
export function useOrganizations() {
  // Organizations are typically global, not org-specific
  return useLiveStoreQuery(
    'global', // Special case for global data
    'organizations',
    'SELECT * FROM organizations ORDER BY name'
  )
}

/**
 * Get single record by ID
 * Replace: useLiveQuery(() => db.projects.get(projectId))
 */
export function useProject(organizationId: string | null, projectId: string | null) {
  if (!organizationId || !projectId) {
    return {
      data: null,
      loading: false,
      error: null,
      refetch: async () => {}
    }
  }
  
  const tableName = `org_${organizationId}_projects`
  const result = useLiveStoreQuery(
    organizationId,
    'projects',
    `SELECT * FROM "${tableName}" WHERE id = ? AND organization_id = ? LIMIT 1`,
    [projectId, organizationId]
  )

  return {
    ...result,
    data: result.data[0] || null
  }
}

/**
 * Get single task by ID
 * Replace: useLiveQuery(() => db.tasks.get(taskId))
 */
export function useTask(organizationId: string | null, taskId: string | null) {
  if (!organizationId || !taskId) {
    return {
      data: null,
      loading: false,
      error: null,
      refetch: async () => {}
    }
  }
  
  const tableName = `org_${organizationId}_tasks`
  const result = useLiveStoreQuery(
    organizationId,
    'tasks',
    `SELECT * FROM "${tableName}" WHERE id = ? AND organization_id = ? LIMIT 1`,
    [taskId, organizationId]
  )

  return {
    ...result,
    data: result.data[0] || null
  }
}

// ===== ADVANCED HOOKS =====

/**
 * Search across entities
 * Replace complex Dexie queries with LiveStore SQL
 */
export function useSearch(organizationId: string | null, searchTerm: string, entityTypes: string[] = ['projects', 'tasks']) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!organizationId || !searchTerm.trim()) {
      setResults([])
      return
    }

    const performSearch = async () => {
      setLoading(true)
      try {
        const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
        if (!liveStoreInstance) return

        const allResults = []
        const searchPattern = `%${searchTerm}%`

        for (const entityType of entityTypes) {
          const query = `
            SELECT *, '${entityType}' as entity_type 
            FROM org_${organizationId}_${entityType} 
            WHERE organization_id = ? AND (name LIKE ? OR title LIKE ? OR description LIKE ?)
          `
          const entityResults = await liveStoreInstance.store.query(query, [
            organizationId, searchPattern, searchPattern, searchPattern
          ])
          allResults.push(...entityResults)
        }

        setResults(allResults)
      } catch (err) {
        console.error('Search failed:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    performSearch()
  }, [organizationId, searchTerm, entityTypes])

  return { results, loading }
}

/**
 * Count records
 * Replace: useLiveQuery(() => db.projects.where('organization_id').equals(orgId).count())
 */
export function useEntityCount(organizationId: string | null, entityName: string, whereClause?: string, params: any[] = []) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setCount(0)
      setLoading(false)
      return
    }

    const loadCount = async () => {
      try {
        const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
        if (!liveStoreInstance) return

        const baseQuery = `SELECT COUNT(*) as count FROM org_${organizationId}_${entityName}`
        const fullQuery = whereClause 
          ? `${baseQuery} WHERE ${whereClause}`
          : `${baseQuery} WHERE organization_id = ?`
        const queryParams = whereClause ? params : [organizationId]

        const result = await liveStoreInstance.store.query(fullQuery, queryParams)
        setCount(result[0]?.count || 0)
      } catch (err) {
        console.error(`Failed to count ${entityName}:`, err)
        setCount(0)
      } finally {
        setLoading(false)
      }
    }

    loadCount()
  }, [organizationId, entityName, whereClause, JSON.stringify(params)])

  return { count, loading }
}

// ===== UTILITY HOOKS =====

/**
 * Check if LiveStore is ready for organization
 */
export function useLiveStoreReady(organizationId: string | null) {
  const [isReady, setIsReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) {
      setIsReady(false)
      setLoading(false)
      return
    }

    const checkReady = async () => {
      try {
        const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(organizationId)
        setIsReady(!!liveStoreInstance)
      } catch (err) {
        console.error('LiveStore readiness check failed:', err)
        setIsReady(false)
      } finally {
        setLoading(false)
      }
    }

    checkReady()
  }, [organizationId])

  return { isReady, loading }
}

/**
 * Bulk operations
 * Replace: db.transaction('rw', [db.projects, db.tasks], async () => { ... })
 */
export function useBulkOperations(organizationId: string | null) {
  const { mutations } = useLiveStoreMutations(organizationId)

  const bulkCreate = useCallback(async (entityName: string, records: any[]) => {
    if (!mutations) throw new Error('Mutations not available')

    const entityMutations = mutations[entityName]
    if (!entityMutations) throw new Error(`No mutations for entity: ${entityName}`)

    // LiveStore handles transactions internally
    const results = []
    for (const record of records) {
      const result = await entityMutations.create(record)
      results.push(result)
    }
    return results
  }, [mutations])

  const bulkUpdate = useCallback(async (entityName: string, updates: Array<{ id: string, changes: any }>) => {
    if (!mutations) throw new Error('Mutations not available')

    const entityMutations = mutations[entityName]
    if (!entityMutations) throw new Error(`No mutations for entity: ${entityName}`)

    const results = []
    for (const { id, changes } of updates) {
      const result = await entityMutations.update(id, changes)
      results.push(result)
    }
    return results
  }, [mutations])

  const bulkDelete = useCallback(async (entityName: string, ids: string[]) => {
    if (!mutations) throw new Error('Mutations not available')

    const entityMutations = mutations[entityName]
    if (!entityMutations) throw new Error(`No mutations for entity: ${entityName}`)

    const results = []
    for (const id of ids) {
      const result = await entityMutations.delete(id)
      results.push(result)
    }
    return results
  }, [mutations])

  return {
    bulkCreate,
    bulkUpdate,
    bulkDelete,
    available: !!mutations
  }
}

export default {
  useLiveStoreQuery,
  useLiveStoreMutations,
  useProjects,
  useTasks,
  useUsers,
  useOrganizations,
  useProject,
  useTask,
  useSearch,
  useEntityCount,
  useLiveStoreReady,
  useBulkOperations
}