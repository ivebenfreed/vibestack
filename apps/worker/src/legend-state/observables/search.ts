import { observable } from '@legendapp/state'
import { orgContext$, getEntity$ } from '@/legend-state'
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
  
  // Search in common fields
  const searchFields = ['name', 'title', 'description', 'email', 'company_name']
  
  for (const field of searchFields) {
    if (record[field] && typeof record[field] === 'string') {
      if (searchRegex.test(record[field])) {
        matches.push({
          field,
          preview: record[field].substring(0, 100)
        })
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
    const schema = orgContext$.schema.peek()
    const userId = orgContext$.userId.peek()
    if (!schema) return []
    
    const results: SearchResult[] = []
    const searchRegex = new RegExp(query, 'i')
    
    // Get universe for personal filtering
    const universeObs = getEntity$('universe')
    const userUniverse = universeObs ? 
      Object.values(universeObs.get()).find(u => u.owner_id === userId) : 
      null
    
    // Search across all entities
    for (const [entityName, def] of Object.entries(schema.entities)) {
      const entityObs = getEntity$(entityName)
      if (!entityObs) continue
      
      const records = Object.values(entityObs.get())
      
      // Filter based on mode
      let filteredRecords = records
      if (mode === 'personal' && userUniverse) {
        // Only search personal items
        filteredRecords = records.filter(record => 
          record.universe_id === userUniverse.id ||
          record.owner_id === userId
        )
      } else if (mode === 'work') {
        // Only search work items (no universe_id)
        filteredRecords = records.filter(record => 
          !record.universe_id && record.owner_id !== userId
        )
      }
      
      // Search in filtered records
      filteredRecords.forEach(record => {
        const matches = searchInRecord(record, searchRegex)
        if (matches.length > 0) {
          results.push({
            entityName,
            entityType: def.archetype,
            recordId: record.id,
            recordName: record.name || record.title || 'Unnamed',
            matches,
            record
          })
        }
      })
      
      // Limit results for performance
      if (results.length > 100) break
    }
    
    entitySearch$.results.set(results)
    return results
  } finally {
    entitySearch$.searching.set(false)
  }
}