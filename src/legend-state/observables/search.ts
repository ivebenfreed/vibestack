import { observable } from '@legendapp/state'
import { universeSchema$, universeUserId$, getEntity$ } from '@/legend-state'
import type { NavigationMode } from './navigation-mode'

export interface SearchResult {
  entityName: string
  entityType: string
  recordId: string
  recordName: string
  matches: Array<{
    field: string
    preview: string
  }>
  record: any
}

export const entitySearch$ = observable({
  query: '',
  scope: 'all' as NavigationMode,
  results: [] as SearchResult[],
  searching: false
})

function searchInRecord(record: any, searchRegex: RegExp): Array<{ field: string; preview: string }> {
  const matches: Array<{ field: string; preview: string }> = []

  // Search in common text fields
  const primaryFields = ['name', 'title', 'description', 'email', 'company_name']
  const secondaryFields = [
    'notes', 'content', 'summary', 'address', 'phone',
    'priority', 'status', 'taskType', 'projectType',
    'firstName', 'lastName', 'position', 'department'
  ]

  // Search primary fields first (higher relevance)
  for (const field of primaryFields) {
    if (record[field] && typeof record[field] === 'string') {
      if (searchRegex.test(record[field])) {
        matches.push({
          field,
          preview: record[field].substring(0, 100)
        })
      }
    }
  }

  // Search secondary fields if no primary matches
  if (matches.length === 0) {
    for (const field of secondaryFields) {
      if (record[field] && typeof record[field] === 'string') {
        if (searchRegex.test(record[field])) {
          matches.push({
            field,
            preview: record[field].substring(0, 100)
          })
        }
      }
    }
  }

  return matches
}

export async function searchEntities(query: string, mode: NavigationMode = 'all'): Promise<SearchResult[]> {
  if (!query.trim()) {
    entitySearch$.results.set([])
    return []
  }

  entitySearch$.searching.set(true)

  try {
    const schema = universeSchema$.peek()
    const userId = universeUserId$.peek()
    if (!schema?.entities) {
      console.warn('No schema or entities available for search')
      return []
    }

    const results: SearchResult[] = []
    const searchRegex = new RegExp(query.trim(), 'i')

    // Search across all entities in the universe schema
    for (const [orgPrefixedEntityName, def] of Object.entries(schema.entities)) {
      try {
        // Get entity observable using the org-prefixed name
        const entityObs = getEntity$(orgPrefixedEntityName)
        if (!entityObs) {
          console.debug(`Entity observable not found: ${orgPrefixedEntityName}`)
          continue
        }

        // syncedCrud returns Record<string, EntityRecord>, not array
        const entityData = entityObs.get()
        if (!entityData || typeof entityData !== 'object') {
          console.debug(`No data available for entity: ${orgPrefixedEntityName}`)
          continue
        }

        // Convert to array for iteration
        const records = Object.values(entityData)
        if (records.length === 0) continue

        // Filter based on mode (if needed)
        let filteredRecords = records
        if (mode === 'personal' && userId) {
          filteredRecords = records.filter(record =>
            record.owner_id === userId || record.user_id === userId
          )
        } else if (mode === 'work' && userId) {
          filteredRecords = records.filter(record =>
            record.owner_id !== userId && record.user_id !== userId
          )
        }

        // Search in filtered records
        filteredRecords.forEach(record => {
          if (!record || typeof record !== 'object') return

          const matches = searchInRecord(record, searchRegex)
          if (matches.length > 0) {
            // Extract clean entity name from org-prefixed name
            const cleanEntityName = orgPrefixedEntityName.split('_').pop() || orgPrefixedEntityName

            results.push({
              entityName: cleanEntityName,
              entityType: def.archetype || 'Record',
              recordId: record.id || 'unknown',
              recordName: record.name || record.title || record.description?.substring(0, 50) || 'Unnamed',
              matches,
              record
            })
          }
        })

        // Limit results for performance
        if (results.length > 100) break

      } catch (error) {
        console.warn(`Failed to search entity ${orgPrefixedEntityName}:`, error)
        continue
      }
    }

    // Sort results by relevance (number of matches)
    results.sort((a, b) => b.matches.length - a.matches.length)

    entitySearch$.results.set(results)
    return results
  } catch (error) {
    console.error('Search error:', error)
    return []
  } finally {
    entitySearch$.searching.set(false)
  }
}