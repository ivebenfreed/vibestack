/**
 * Dexie Entity Database
 *
 * IndexedDB cache layer for entity data using Dexie.js
 * Provides cache-first reads with differential sync from server
 */

import Dexie, { type Table } from 'dexie'
import { log } from '@/logger'

const fileLog = log('legend-state/persistence/DexieEntityDB')

export interface SyncMetadata {
  entityType: string
  lastSync: number
  lastLSN: string
  recordCount: number
  version: number
}

export interface EntitySchemas {
  [entityName: string]: {
    syncableFields?: Record<string, any>
    archetype?: string
    tableName?: string
  }
}

/**
 * Dexie database with dynamic entity tables
 */
export class DexieEntityDB extends Dexie {
  // Dynamic entity tables (created from schema)
  [tableName: string]: any

  // Metadata for sync tracking
  syncMeta!: Table<SyncMetadata, string>

  constructor(userId: string, entitySchemas: EntitySchemas) {
    const dbName = `elevra_universe_${userId.replace(/-/g, '_')}`
    super(dbName)

    // Build Dexie schema from entity schemas
    const dexieSchema = this.buildSchemaFromEntities(entitySchemas)

    // Define schema (all tables at once)
    this.version(1).stores({
      ...dexieSchema,
      syncMeta: '&entityType, lastSync, recordCount'
    })

    fileLog.info(`✅ Dexie DB initialized: ${dbName}`, {
      tables: Object.keys(dexieSchema),
      tableCount: Object.keys(dexieSchema).length
    })
  }

  /**
   * Convert Legend State entity schemas to Dexie schema syntax
   */
  private buildSchemaFromEntities(entitySchemas: EntitySchemas): Record<string, string> {
    const dexieSchema: Record<string, string> = {}

    Object.entries(entitySchemas).forEach(([entityName, schema]) => {
      // Extract table name: "01920000-1000_BuildProject" → "BuildProject"
      const tableName = entityName.split('_').pop() || entityName

      // Build Dexie index string from entity fields
      const indexes: string[] = ['&id']  // Primary key (unique)

      // Add commonly queried fields as indexes
      if (schema.syncableFields) {
        Object.entries(schema.syncableFields).forEach(([fieldName, fieldDef]) => {
          if (this.shouldIndex(fieldName, fieldDef)) {
            indexes.push(fieldName)
          }
        })
      }

      // Always index updated_at for differential sync
      if (!indexes.includes('updated_at')) {
        indexes.push('updated_at')
      }

      dexieSchema[tableName] = indexes.join(', ')

      fileLog.debug(`📋 Schema for ${tableName}: ${dexieSchema[tableName]}`)
    })

    return dexieSchema
  }

  /**
   * Determine if field should be indexed
   */
  private shouldIndex(fieldName: string, fieldDef: any): boolean {
    // Index reference fields for fast lookups
    if (fieldDef?.type?.includes('reference')) return true

    // Index status/priority for filtering
    if (fieldName.match(/status|priority|state|type/i)) return true

    // Index org/user IDs
    if (fieldName.match(/org|organization|user|owner|created_by|assigned/i)) return true

    // Index commonly filtered fields
    if (fieldName.match(/archived|deleted|active/i)) return true

    return false
  }

  /**
   * Get all records for an entity type
   */
  async getAllRecords(entityType: string): Promise<any[]> {
    try {
      const table = this.table(entityType)

      if (!table) {
        fileLog.warn(`Table ${entityType} not found in Dexie`)
        return []
      }

      const records = await table.toArray()
      fileLog.debug(`📦 ${entityType}: Retrieved ${records.length} records from cache`)
      return records
    } catch (error) {
      fileLog.error(`❌ ${entityType}: Error reading from cache`, error)
      return []
    }
  }

  /**
   * Get records changed since timestamp (for Legend State differential sync)
   */
  async getChangedSince(entityType: string, timestamp: number): Promise<any[]> {
    try {
      const table = this.table(entityType)

      if (!table) {
        fileLog.warn(`Table ${entityType} not found in Dexie`)
        return []
      }

      // Query records with updated_at > timestamp
      const isoTimestamp = new Date(timestamp).toISOString()

      const records = await table
        .where('updated_at')
        .above(isoTimestamp)
        .toArray()

      fileLog.debug(`📦 ${entityType}: Retrieved ${records.length} changed records since ${isoTimestamp}`)
      return records
    } catch (error) {
      fileLog.error(`❌ ${entityType}: Error reading changes from cache`, error)
      return []
    }
  }

  /**
   * Update cache with data from server (bulk upsert)
   */
  async updateFromServer(entityType: string, records: any[]): Promise<void> {
    try {
      const table = this.table(entityType)

      if (!table) {
        fileLog.warn(`Cannot update ${entityType}: table not found`)
        return
      }

      if (records.length === 0) {
        fileLog.debug(`${entityType}: No records to update`)
        return
      }

      // bulkPut = upsert (add or update based on primary key)
      await table.bulkPut(records)

      fileLog.info(`💾 [DEXIE] ${entityType}: Cached ${records.length} records`)

    } catch (error) {
      fileLog.error(`❌ [DEXIE] ${entityType}: Error updating cache`, {
        error: error.message,
        errorName: error.name,
        recordCount: records.length,
        sampleRecord: records[0]
      })
    }
  }

  /**
   * Get sync metadata for an entity
   */
  async getSyncMetadata(entityType: string): Promise<SyncMetadata | null> {
    try {
      const meta = await this.syncMeta.get(entityType)
      return meta || null
    } catch (error) {
      fileLog.error(`❌ Error reading sync metadata for ${entityType}`, error)
      return null
    }
  }

  /**
   * Update sync metadata after successful sync
   */
  async updateSyncMetadata(
    entityType: string,
    updates: Partial<SyncMetadata>
  ): Promise<void> {
    try {
      const existing = await this.getSyncMetadata(entityType)

      await this.syncMeta.put({
        entityType,
        lastSync: existing?.lastSync || 0,
        lastLSN: existing?.lastLSN || '0/0',
        recordCount: existing?.recordCount || 0,
        version: existing?.version || 1,
        ...updates
      })

      fileLog.debug(`💾 ${entityType}: Updated sync metadata`, updates)
    } catch (error) {
      fileLog.error(`❌ ${entityType}: Error updating sync metadata`, error)
    }
  }

  /**
   * Clear all cache for logout/reset
   */
  async clearAllData(): Promise<void> {
    try {
      await this.transaction('rw', this.tables, async () => {
        for (const table of this.tables) {
          await table.clear()
        }
      })

      fileLog.info(`🗑️  Cleared all Dexie cache`)
    } catch (error) {
      fileLog.error(`❌ Error clearing Dexie cache`, error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {}

    try {
      for (const table of this.tables) {
        if (table.name !== 'syncMeta') {
          const count = await table.count()
          stats[table.name] = count
        }
      }

      fileLog.info(`📊 Cache stats:`, stats)
      return stats
    } catch (error) {
      fileLog.error(`❌ Error getting cache stats`, error)
      return {}
    }
  }
}

// Singleton instance
let dexieDB: DexieEntityDB | null = null

/**
 * Initialize Dexie database with entity schemas
 * Force recreate if schemas provided (for rebuild scenarios)
 */
export function initializeDexieDB(userId: string, schemas: EntitySchemas, forceRecreate: boolean = false): DexieEntityDB {
  if (dexieDB && !forceRecreate) {
    fileLog.info('Dexie DB already initialized, returning existing instance')
    return dexieDB
  }

  if (forceRecreate && dexieDB) {
    fileLog.info('Force recreating Dexie DB instance')
    dexieDB.close()
    dexieDB = null
  }

  dexieDB = new DexieEntityDB(userId, schemas)
  return dexieDB
}

/**
 * Get current Dexie DB instance
 */
export function getDexieDB(): DexieEntityDB | null {
  return dexieDB
}

/**
 * Close and reset Dexie DB (for logout)
 */
export function closeDexieDB(): void {
  if (dexieDB) {
    dexieDB.close()
    dexieDB = null
    fileLog.info('Dexie DB closed')
  }
}

/**
 * Compute schema hash for change detection
 */
export function computeSchemaHash(entitySchemas: EntitySchemas): string {
  // Create stable hash of entity names and their field signatures
  const schemaString = Object.keys(entitySchemas)
    .sort()
    .map(entityName => {
      const fields = Object.keys(entitySchemas[entityName].syncableFields || {}).sort()
      return `${entityName}:${fields.join(',')}`
    })
    .join('|')

  // Simple hash function
  let hash = 0
  for (let i = 0; i < schemaString.length; i++) {
    const char = schemaString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash  // Convert to 32-bit integer
  }

  return `schema_${Math.abs(hash).toString(36)}_${Object.keys(entitySchemas).length}`
}

/**
 * Store schema in localStorage for instant warm start access
 */
export function storeSchemaInLocalStorage(userId: string, schemas: EntitySchemas): void {
  try {
    const hash = computeSchemaHash(schemas)
    localStorage.setItem(`dexie_schema_${userId}`, JSON.stringify(schemas))
    localStorage.setItem(`dexie_schema_hash_${userId}`, hash)
    fileLog.debug(`📝 Stored schema in localStorage: ${hash}`)
  } catch (error) {
    fileLog.error('❌ Failed to store schema in localStorage', error)
  }
}

/**
 * Load schema from localStorage for instant warm start
 */
export function loadSchemaFromLocalStorage(userId: string): EntitySchemas | null {
  try {
    const cached = localStorage.getItem(`dexie_schema_${userId}`)
    if (!cached) return null

    const schemas = JSON.parse(cached)
    fileLog.debug(`📖 Loaded schema from localStorage: ${Object.keys(schemas).length} entities`)
    return schemas
  } catch (error) {
    fileLog.error('❌ Failed to load schema from localStorage', error)
    return null
  }
}

/**
 * Clear schema from localStorage
 */
export function clearSchemaFromLocalStorage(userId: string): void {
  localStorage.removeItem(`dexie_schema_${userId}`)
  localStorage.removeItem(`dexie_schema_hash_${userId}`)
  fileLog.debug('🗑️  Cleared schema from localStorage')
}
