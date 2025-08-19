/**
 * LiveStore Event Generator - Phase 1 Implementation
 * 
 * Auto-generates LiveStore events and materializers from organization schemas.
 * This replaces manual domain services with schema-driven mutations.
 */

import { nanoid } from 'nanoid';
import type { OrgEntitySchema } from './schema-client';

// LiveStore imports for real event system
import { State } from '@livestore/livestore';

export interface LiveStoreEvent {
  type: string;
  payload: any;
  metadata: {
    timestamp: Date;
    organizationId: string;
    userId?: string;
    eventId: string;
  };
}

export interface MaterializerContext {
  query: (sql: string, params?: any[]) => Promise<any[]>;
  db: any; // Raw database access
  event: LiveStoreEvent;
}

export interface GeneratedLiveStoreComponents {
  events: {
    [entityName: string]: {
      created: (data: any) => LiveStoreEvent;
      updated: (id: string, changes: any) => LiveStoreEvent;
      deleted: (id: string) => LiveStoreEvent;
    };
  };
  materializers: {
    [eventName: string]: (payload: any, ctx: MaterializerContext) => any;
  };
  queries: {
    [entityName: string]: any; // LiveStore Query objects
  };
  tables: {
    [entityName: string]: any; // LiveStore Table objects
  };
}

/**
 * Generate LiveStore components from organization schema
 */
export function generateLiveStoreComponents(
  organizationId: string,
  orgSchema: OrgEntitySchema
): GeneratedLiveStoreComponents {
  console.log(`🔄 Generating LiveStore components for org: ${organizationId}`);

  const events: GeneratedLiveStoreComponents['events'] = {};
  const materializers: GeneratedLiveStoreComponents['materializers'] = {};
  const queries: GeneratedLiveStoreComponents['queries'] = {};
  const tables: GeneratedLiveStoreComponents['tables'] = {};

  // Generate components for each entity type in the schema
  Object.entries(orgSchema.entities || {}).forEach(([entityName, entityDef]) => {
    const tableName = `org_${organizationId}_${entityName}`;
    
    console.log(`📋 Generating components for entity: ${entityName} → table: ${tableName}`);

    // Generate events for this entity
    events[entityName] = generateEntityEvents(entityName, organizationId, entityDef);

    // Generate materializers for this entity's events
    const entityMaterializers = generateEntityMaterializers(entityName, tableName, entityDef);
    Object.assign(materializers, entityMaterializers);

    // Generate queries for this entity
    queries[entityName] = generateEntityQueries(entityName, tableName, entityDef);

    // Generate table reference for this entity
    tables[entityName] = generateEntityTable(entityName, tableName, entityDef);
  });

  console.log(`✅ Generated LiveStore components for ${Object.keys(events).length} entities`);

  return {
    events,
    materializers,
    queries,
    tables
  };
}

/**
 * Generate events for a specific entity
 */
function generateEntityEvents(
  entityName: string, 
  organizationId: string, 
  entityDef: any
): GeneratedLiveStoreComponents['events'][string] {
  return {
    created: (data: any): LiveStoreEvent => ({
      type: `${entityName}Created`,
      payload: {
        ...data,
        id: data.id || nanoid(),
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date(),
        organizationId,
        userId: data.createdBy || 'system',
        eventId: nanoid()
      }
    }),

    updated: (id: string, changes: any): LiveStoreEvent => ({
      type: `${entityName}Updated`,
      payload: {
        id,
        changes: {
          ...changes,
          updatedAt: new Date().toISOString()
        },
        organizationId
      },
      metadata: {
        timestamp: new Date(),
        organizationId,
        userId: changes.updatedBy || 'system',
        eventId: nanoid()
      }
    }),

    deleted: (id: string): LiveStoreEvent => ({
      type: `${entityName}Deleted`,
      payload: {
        id,
        organizationId,
        deletedAt: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date(),
        organizationId,
        eventId: nanoid()
      }
    })
  };
}

/**
 * Generate materializers for an entity's events using LiveStore's State.SQLite.materializers
 */
function generateEntityMaterializers(
  entityName: string,
  tableName: string,
  entityDef: any
): Record<string, (payload: any, ctx: MaterializerContext) => any> {
  const materializers: Record<string, (payload: any, ctx: MaterializerContext) => any> = {};

  // Created event materializer
  materializers[`${entityName}Created`] = (payload: any, ctx: MaterializerContext) => {
    console.log(`📝 Materializing ${entityName} creation:`, payload.id);

    // Generate INSERT SQL for the entity
    const fields = Object.keys(payload).filter(key => key !== 'organizationId');
    const columns = fields.map(field => convertFieldToColumn(field));
    const placeholders = fields.map(() => '?');
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}, organization_id) VALUES (${placeholders.join(', ')}, ?)`;
    const values = [...fields.map(field => payload[field]), payload.organizationId];

    return ctx.db.exec(sql, values);
  };

  // Updated event materializer  
  materializers[`${entityName}Updated`] = (payload: any, ctx: MaterializerContext) => {
    console.log(`📝 Materializing ${entityName} update:`, payload.id);

    const { id, changes, organizationId } = payload;
    const fields = Object.keys(changes);
    const setClauses = fields.map(field => `${convertFieldToColumn(field)} = ?`);
    
    const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`;
    const values = [...fields.map(field => changes[field]), id, organizationId];

    return ctx.db.exec(sql, values);
  };

  // Deleted event materializer
  materializers[`${entityName}Deleted`] = (payload: any, ctx: MaterializerContext) => {
    console.log(`📝 Materializing ${entityName} deletion:`, payload.id);

    const { id, organizationId } = payload;
    const sql = `DELETE FROM ${tableName} WHERE id = ? AND organization_id = ?`;
    
    return ctx.db.exec(sql, [id, organizationId]);
  };

  return materializers;
}

/**
 * Generate LiveStore queries for an entity
 */
function generateEntityQueries(entityName: string, tableName: string, entityDef: any): any {
  // For now, return a simple query structure
  // TODO: Implement actual LiveStore Query objects when available
  return {
    findAll: `SELECT * FROM ${tableName} WHERE organization_id = ?`,
    findById: `SELECT * FROM ${tableName} WHERE id = ? AND organization_id = ?`,
    findByCondition: (condition: string) => `SELECT * FROM ${tableName} WHERE ${condition} AND organization_id = ?`
  };
}

/**
 * Generate LiveStore table reference for an entity
 */
function generateEntityTable(entityName: string, tableName: string, entityDef: any): any {
  // For now, return a simple table structure
  // TODO: Implement actual LiveStore Table objects when available
  return {
    name: tableName,
    entityName,
    definition: entityDef
  };
}

/**
 * Convert camelCase field names to snake_case column names
 */
function convertFieldToColumn(fieldName: string): string {
  return fieldName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Create LiveStore mutations interface from generated components
 */
export interface LiveStoreMutations {
  [entityName: string]: {
    create: (data: any) => Promise<void>;
    update: (id: string, changes: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
}

/**
 * Create mutation functions that apply events to a LiveStore instance
 */
export function createLiveStoreMutations(
  store: any, // LiveStore instance
  components: GeneratedLiveStoreComponents
): LiveStoreMutations {
  const mutations: LiveStoreMutations = {};

  Object.keys(components.events).forEach(entityName => {
    mutations[entityName] = {
      create: async (data: any): Promise<void> => {
        const event = components.events[entityName].created(data);
        console.log(`🚀 Applying ${entityName} creation event:`, event);
        
        // Apply event using LiveStore's commit method
        await store.commit(event);
      },

      update: async (id: string, changes: any): Promise<void> => {
        const event = components.events[entityName].updated(id, changes);
        console.log(`🚀 Applying ${entityName} update event:`, event);
        
        await store.commit(event);
      },

      delete: async (id: string): Promise<void> => {
        const event = components.events[entityName].deleted(id);
        console.log(`🚀 Applying ${entityName} deletion event:`, event);
        
        await store.commit(event);
      }
    };
  });

  return mutations;
}

/**
 * Main LiveStore Event Generator class
 */
export class LiveStoreEventGenerator {
  private components: Map<string, GeneratedLiveStoreComponents> = new Map();

  /**
   * Generate and cache components for organization
   */
  async generateForOrganization(
    organizationId: string,
    orgSchema: OrgEntitySchema
  ): Promise<GeneratedLiveStoreComponents> {
    const cacheKey = `org_${organizationId}`;
    
    if (this.components.has(cacheKey)) {
      console.log(`📦 Using cached components for org: ${organizationId}`);
      return this.components.get(cacheKey)!;
    }

    console.log(`🔧 Generating new components for org: ${organizationId}`);
    const components = generateLiveStoreComponents(organizationId, orgSchema);
    
    this.components.set(cacheKey, components);
    
    // Dispatch event for debugging/monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('livestore:components:generated', {
        detail: { organizationId, components }
      }));
    }

    return components;
  }

  /**
   * Create mutations for an organization's LiveStore
   */
  async createMutations(
    organizationId: string,
    store: any,
    orgSchema: OrgEntitySchema
  ): Promise<LiveStoreMutations> {
    const components = await this.generateForOrganization(organizationId, orgSchema);
    return createLiveStoreMutations(store, components);
  }

  /**
   * Get cached components for organization
   */
  getComponents(organizationId: string): GeneratedLiveStoreComponents | null {
    return this.components.get(`org_${organizationId}`) || null;
  }

  /**
   * Clear cache for organization
   */
  clearCache(organizationId: string): void {
    this.components.delete(`org_${organizationId}`);
    console.log(`🗑️ Cleared components cache for org: ${organizationId}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.components.clear();
    console.log('🗑️ Cleared all components caches');
  }

  /**
   * Get all cached organizations
   */
  getCachedOrganizations(): string[] {
    return Array.from(this.components.keys()).map(key => key.replace('org_', ''));
  }
}

// Singleton instance
export const liveStoreEventGenerator = new LiveStoreEventGenerator();

/**
 * React Hook for using LiveStore mutations
 */
export function useLiveStoreMutations(
  organizationId: string | null,
  store: any,
  orgSchema: OrgEntitySchema | null
) {
  const [mutations, setMutations] = React.useState<LiveStoreMutations | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!organizationId || !store || !orgSchema) {
      setMutations(null);
      return;
    }

    setLoading(true);
    setError(null);

    liveStoreEventGenerator.createMutations(organizationId, store, orgSchema)
      .then(generatedMutations => {
        setMutations(generatedMutations);
        console.log(`✅ LiveStore mutations ready for org: ${organizationId}`);
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create mutations';
        setError(errorMessage);
        console.error(`❌ Failed to create mutations for org ${organizationId}:`, err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [organizationId, store, orgSchema]);

  return {
    mutations,
    loading,
    error,
    clearCache: () => organizationId && liveStoreEventGenerator.clearCache(organizationId)
  };
}

// React import declaration
declare const React: any;

export default liveStoreEventGenerator;