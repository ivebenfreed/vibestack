/**
 * Schema Observable - Persisted Sync Observable for Organization Schemas
 * 
 * Converts schema loading from repetitive API calls to a reactive, 
 * persisted sync observable like entity data observables.
 * 
 * Part of Legend State architecture - follows same patterns as entity observables.
 */

import { observable } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { log } from '@/logger'

const fileLog = log('legend-state/schema-observable.ts')

export interface OrgEntitySchema {
  orgId: string;
  entities: Record<string, EntityDefinition>;
  version: string;
  created_at?: string;
  updated_at?: string;
}

export interface EntityDefinition {
  archetype: string;
  tableName: string;
  syncableFields: Record<string, FieldDefinition>;
  customFields?: Record<string, FieldDefinition>;
  relationshipFields?: Record<string, RelationshipFieldDefinition>;
  allFields?: Record<string, FieldDefinition>;
  businessMetadata?: any;
}

export interface FieldDefinition {
  type: string;
  required?: boolean;
  syncable?: boolean;
  enum?: string[];
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

export interface RelationshipFieldDefinition {
  name: string;
  type: 'user_reference' | 'entity_reference';
  relationshipType?: string;
  targetEntityType?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  properties?: Record<string, any>;
}

/**
 * Schema sync observable - handles schema loading, caching, and real-time updates
 * Uses same patterns as entity data observables for consistency
 */
export function createSchemaObservable(orgId: string) {
  fileLog.info(`[SchemaObservable] Creating schema observable for org: ${orgId}`)
  
  const crudConfig = {
    // Enable differential sync for schema updates
    changesSince: 'last-sync',
    
    // Schema versioning fields
    fieldId: 'orgId',
    fieldUpdatedAt: 'version',
    fieldCreatedAt: 'created_at',
    
    // LIST - Load organization schema from server
    list: async () => {
      try {
        fileLog.info(`[SchemaObservable] Loading schema for org: ${orgId}`)
        
        const response = await fetch(`/api/dataforge/orgs/${orgId}/schema`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) {
          if (response.status === 404) {
            fileLog.info(`[SchemaObservable] No schema found for org ${orgId} - returning empty`)
            return []
          }
          throw new Error(`Schema fetch failed: ${response.status} ${response.statusText}`)
        }
        
        const rawData = await response.json()
        
        // Handle API response format
        let schemaArray: any[]
        if (rawData && typeof rawData === 'object' && 'success' in rawData) {
          if (!rawData.success) {
            throw new Error(rawData.error || 'Server returned error')
          }
          schemaArray = rawData.schema
        } else if (Array.isArray(rawData)) {
          schemaArray = rawData
        } else {
          throw new Error('Invalid schema format from server')
        }
        
        if (!Array.isArray(schemaArray)) {
          throw new Error('Schema must be an array of entities')
        }
        
        // Transform to schema format
        const processedSchema = processSchemaResponse(orgId, schemaArray)
        
        fileLog.info(`[SchemaObservable] Loaded schema with ${Object.keys(processedSchema.entities).length} entities`)
        
        // Return as single-item array for syncedCrud list format
        return [processedSchema]
        
      } catch (error) {
        fileLog.error(`[SchemaObservable] Failed to load schema for org ${orgId}:`, error)
        return []
      }
    },
    
    // No CREATE/UPDATE/DELETE for schemas - they're managed server-side
    create: null,
    update: null,
    delete: null,
    
    // Initial empty state
    initial: [],
    
    // Subscribe to schema change notifications via WebSocket
    subscribe: ({ refresh }: { refresh: () => void }) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        
        // Listen for schema changes affecting this organization
        if (notification?.table === 'entity_schemas' && notification?.orgId === orgId) {
          fileLog.info(`[SchemaObservable] Schema change notification for org ${orgId}`)
          refresh()
        }
        
        // Also listen for general schema reload events
        if (notification?.type === 'schema-reload' && notification?.orgId === orgId) {
          fileLog.info(`[SchemaObservable] Manual schema reload for org ${orgId}`)
          refresh()
        }
      }
      
      if (typeof window !== 'undefined') {
        window.addEventListener('vibestack:schema-change-notification', handler as any)
        window.addEventListener('vibestack:reload-schema', handler as any)
      }
      
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('vibestack:schema-change-notification', handler as any)
          window.removeEventListener('vibestack:reload-schema', handler as any)
        }
      }
    },
    
    // Retry configuration for reliability  
    retry: {
      times: 3,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 10000
    }
  }
  
  return observable(syncedCrud(crudConfig))
}

/**
 * Process raw schema array into organized schema format
 */
function processSchemaResponse(orgId: string, schemaArray: any[]): OrgEntitySchema {
  const entities: Record<string, EntityDefinition> = {}
  
  schemaArray.forEach(entity => {
    const businessMetadata = entity.businessMetadata || {}
    const fields = businessMetadata.fields || businessMetadata.allFields || []
    
    // Process fields by category
    const syncableFields: Record<string, FieldDefinition> = {}
    const customFields: Record<string, FieldDefinition> = {}
    const relationshipFields: Record<string, RelationshipFieldDefinition> = {}
    
    fields.forEach((field: any) => {
      if (field.type === 'user_reference' || field.type === 'entity_reference') {
        // Relationship field
        relationshipFields[field.name] = {
          name: field.name,
          type: field.type,
          relationshipType: field.relationshipType || field.type,
          targetEntityType: field.targetEntityType,
          cardinality: field.cardinality || 'many-to-one',
          properties: field.properties || {}
        }
      } else {
        // Regular field
        const fieldDef: FieldDefinition = {
          type: mapFieldType(field.type),
          required: field.required || false,
          syncable: field.syncable !== false,
          enum: field.enum || field.enumOptions?.map((opt: any) => opt.value),
          defaultValue: field.defaultValue,
          validation: field.validation
        }
        
        syncableFields[field.name] = fieldDef
      }
    })
    
    // Add default timestamp fields
    if (!syncableFields.created_at) {
      syncableFields.created_at = { type: 'timestamp', required: false, syncable: false }
    }
    if (!syncableFields.updated_at) {
      syncableFields.updated_at = { type: 'timestamp', required: false, syncable: false }
    }
    
    entities[entity.entityName] = {
      tableName: entity.tableName,
      archetype: entity.archetype,
      syncableFields,
      customFields,
      relationshipFields,
      allFields: { ...syncableFields, ...customFields, ...relationshipFields },
      businessMetadata
    }
  })
  
  return {
    orgId,
    version: Date.now().toString(),
    entities,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Map server field types to client field types
 */
function mapFieldType(serverType: string): string {
  const typeMap: Record<string, string> = {
    'longtext': 'text',
    'priority_set': 'priority_option', 
    'status_set': 'status_option',
    'category_set': 'category_option'
  }
  return typeMap[serverType] || serverType
}

/**
 * Global schema observables cache - one per organization
 * Integrated with Legend State architecture
 */
const schemaObservables = new Map<string, any>()

/**
 * Get or create schema observable for an organization
 * Follows same pattern as getEntity$() for consistency
 */
export function getSchemaObservable$(orgId: string) {
  if (!schemaObservables.has(orgId)) {
    const observable = createSchemaObservable(orgId)
    schemaObservables.set(orgId, observable)
    fileLog.info(`[SchemaObservable] Created new schema observable for org: ${orgId}`)
  }
  
  return schemaObservables.get(orgId)
}

/**
 * Get schema data from observable (reactive)
 * Returns the first (and only) schema item from the list
 */
export function getSchemaData$(orgId: string): OrgEntitySchema | null {
  const schemaObs = getSchemaObservable$(orgId)
  if (!schemaObs) return null
  
  const schemaList = schemaObs.get()
  return Array.isArray(schemaList) && schemaList.length > 0 ? schemaList[0] : null
}

/**
 * Get schema data from observable (non-reactive)
 * Use this in event handlers and async functions
 */
export function peekSchemaData$(orgId: string): OrgEntitySchema | null {
  const schemaObs = getSchemaObservable$(orgId)
  if (!schemaObs) return null
  
  const schemaList = schemaObs.peek()
  return Array.isArray(schemaList) && schemaList.length > 0 ? schemaList[0] : null
}

/**
 * Clear schema observables (for logout/org switching)
 */
export function clearSchemaObservables() {
  fileLog.info(`[SchemaObservable] Clearing ${schemaObservables.size} schema observables`)
  schemaObservables.clear()
}

/**
 * Manually trigger schema reload for an organization
 */
export function reloadSchema(orgId: string) {
  fileLog.info(`[SchemaObservable] Triggering manual schema reload for org: ${orgId}`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vibestack:reload-schema', {
      detail: { type: 'schema-reload', orgId }
    }))
  }
}

/**
 * Helper functions for common schema operations (replaces schema-client methods)
 */
export function getEntitySchema(orgId: string, entityName: string): EntityDefinition | null {
  const schema = peekSchemaData$(orgId)
  return schema?.entities?.[entityName] || null
}

export function getSyncableFields(orgId: string, entityName: string): Record<string, FieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  if (!entitySchema) return null
  
  // Filter only syncable fields
  const syncableFields: Record<string, FieldDefinition> = {}
  for (const [fieldName, fieldDef] of Object.entries(entitySchema.syncableFields || {})) {
    if (fieldDef.syncable !== false) {
      syncableFields[fieldName] = fieldDef
    }
  }
  return syncableFields
}

export function getCustomFields(orgId: string, entityName: string): Record<string, FieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  return entitySchema?.customFields || {}
}

export function getRelationshipFields(orgId: string, entityName: string): Record<string, RelationshipFieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  return entitySchema?.relationshipFields || {}
}

/**
 * Integration with existing legend-state patterns
 * Add schema observables to global clearing function
 */
export function integrateWithLegendState() {
  // This will be called from observables.ts clearContext function
  return {
    clearSchemaObservables
  }
}