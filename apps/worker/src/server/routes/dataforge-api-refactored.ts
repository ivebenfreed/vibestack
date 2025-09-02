/**
 * DataForge API Routes (Refactored)
 * 
 * Thin route handlers that delegate to modular services.
 * Clean separation of HTTP concerns from business logic.
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { 
  hybridRLSOrgActorMiddleware,
  requirePermission 
} from '../middleware/hybrid-rls-org-actor';
import { archetypePermissionService } from '../dataforge/ArchetypePermissionService';
import { ArchetypeRegistry, type ArchetypeType } from '../dataforge/ArchetypeRegistry';

export const dataforgeRouter = new Hono<AppContext>();

// Apply hybrid security middleware to all organization-scoped routes
dataforgeRouter.use('/orgs/:orgId/*', hybridRLSOrgActorMiddleware);

// =============================================================================
// 1. ARCHETYPES ENDPOINTS - Discover available entity types
// =============================================================================

dataforgeRouter.get('/orgs/:orgId/archetypes', 
  requirePermission('entities:read'),
  async (c) => {
    const { ArchetypeService } = await import('../dataforge/ArchetypeService');
    const archetypeService = new ArchetypeService();
    
    const result = await archetypeService.getAllArchetypes();
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json(result.data);
  }
);

dataforgeRouter.get('/orgs/:orgId/archetypes/:archetype',
  requirePermission('entities:read'),
  async (c) => {
    const archetypeName = c.req.param('archetype');
    const { ArchetypeService } = await import('../dataforge/ArchetypeService');
    const archetypeService = new ArchetypeService();
    
    const result = await archetypeService.getArchetypeDetails(archetypeName);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json({ success: true, data: result.data });
  }
);

// =============================================================================
// 2. ENTITIES ENDPOINTS - Manage entity types (schemas)
// =============================================================================

dataforgeRouter.get('/orgs/:orgId/entities',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    const result = await entityManager.listEntities(orgId);
    
    if (result.success === false) {
      return c.json({ error: result.error, details: result.details }, 500);
    }
    
    return c.json({ success: true, data: result });
  }
);

dataforgeRouter.post('/orgs/:orgId/entities', 
  requirePermission('entities:write'), 
  async (c) => {
    const body = await c.req.json();
    const security = c.get('security');
    const user = c.get('user');
    
    console.log(`[DataForge] User ${user?.email || 'anonymous'} creating entity in org ${security.organizationId}`);
    
    const { entityName, archetype, customFields = {} } = body;
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    const result = await entityManager.createEntity(
      security.organizationId,
      entityName,
      archetype,
      customFields || {}
    );
    
    if (!result.success) {
      const hasNestedDefinition = body && typeof body === 'object' && 'definition' in body;
      const errorMessage = hasNestedDefinition 
        ? 'entityName and archetype must be at the top level, not nested under "definition"'
        : result.errors?.[0] || 'Failed to create entity';
      
      return c.json({ error: errorMessage, errors: result.errors }, 400);
    }
    
    // 🔄 CACHE INVALIDATION: Clear OrganizationActor schema cache when new entity is created
    if (c.env.ORGANIZATION_ACTOR) {
      try {
        console.log(`[EntityCreation] Invalidating OrganizationActor cache for new entity: ${entityName}`);
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        
        const cacheInvalidationResponse = await orgActor.fetch(new Request('https://internal/clear-org-schema-cache', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': security.organizationId
          }
        }));
        
        if (cacheInvalidationResponse.ok) {
          const invalidationResult = await cacheInvalidationResponse.json();
          console.log(`[EntityCreation] ✅ Cache invalidated successfully:`, invalidationResult);
        } else {
          const errorText = await cacheInvalidationResponse.text();
          console.log(`[EntityCreation] ⚠️ Cache invalidation failed:`, cacheInvalidationResponse.status, errorText);
        }
      } catch (error) {
        console.log(`[EntityCreation] ⚠️ Cache invalidation error:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    return c.json({ success: true, data: result.data });
  }
);

dataforgeRouter.get('/orgs/:orgId/entities/:entityName',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.getEntityDetails(orgId, entityName);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json({ success: true, data: result.data });
  }
);

dataforgeRouter.get('/orgs/:orgId/schema',
  requirePermission('entities:read'),
  async (c) => {
    console.log(`[Schema Cache] 🚀 Schema request started for org`);
    const startTime = Date.now();
    const security = c.get('security');
    
    // Check if cache busting is requested
    const bustCache = c.req.query('bustCache') === 'true';
    console.log(`[Schema Cache] 🔍 bustCache parameter:`, bustCache);
    if (bustCache) {
      console.log(`[Schema Cache] 🚫 Cache busting requested - skipping cache lookup`);
    }
    
    // 1. First try OrganizationActor cache (unless cache busting)
    if (c.env.ORGANIZATION_ACTOR && !bustCache) {
      try {
        console.log(`[Schema Cache] 📡 Trying OrganizationActor cache first`);
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        const cacheResponse = await orgActor.fetch(new Request('https://internal/org-schema', {
          headers: { 'x-org-id': security.organizationId }
        }));
        
        if (cacheResponse.ok) {
          const cacheResult = await cacheResponse.json();
          console.log(`[Schema Cache] 🔍 Cache response:`, { 
            cached: cacheResult.cached, 
            schemaCount: cacheResult.schema?.length || 0 
          });
          
          if (cacheResult.cached && cacheResult.schema && cacheResult.schema.length > 0) {
            const responseTime = Date.now() - startTime;
            console.log(`[Schema Cache] ✅ CACHE HIT - served from OrganizationActor SQLite cache (${responseTime}ms)`);
            return c.json({
              success: true,
              schema: cacheResult.schema,
              cached: true,
              source: 'organization_actor_cache',
              responseTime: responseTime
            });
          }
        }
      } catch (error) {
        console.log(`[Schema Cache] ⚠️ Cache attempt failed:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // 2. Cache miss - fallback to PostgreSQL and populate cache
    console.log(`[Schema Cache] 💾 CACHE MISS - falling back to PostgreSQL`);
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.getSchema(security.organizationId);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    // 3. Populate cache with fresh data
    if (c.env.ORGANIZATION_ACTOR && result.data) {
      try {
        console.log(`[Schema Cache] 💾 Populating cache with fresh schema data (${result.data.length} entities)`);
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        const cacheWriteResponse = await orgActor.fetch(new Request('https://internal/cache-org-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            organizationId: security.organizationId, 
            schema: result.data 
          })
        }));
        
        if (cacheWriteResponse.ok) {
          const cacheWriteResult = await cacheWriteResponse.json();
          console.log(`[Schema Cache] ✅ Cache populated successfully:`, cacheWriteResult);
        } else {
          const errorText = await cacheWriteResponse.text();
          console.log(`[Schema Cache] ❌ Cache population failed:`, cacheWriteResponse.status, errorText);
        }
      } catch (error) {
        console.log(`[Schema Cache] ⚠️ Cache population failed:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[Schema Cache] 📊 PostgreSQL response completed (${responseTime}ms) with ${result.data?.length || 0} entities`);
    
    return c.json({
      success: true,
      schema: result.data,
      cached: false,
      source: 'postgresql_fallback',
      responseTime: responseTime
    });
  }
);

dataforgeRouter.delete('/orgs/:orgId/entities/:entityName',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.deleteEntity(orgId, entityName);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    // 🔄 CACHE INVALIDATION: Clear OrganizationActor schema cache when entity is deleted
    if (c.env.ORGANIZATION_ACTOR) {
      try {
        console.log(`[EntityDeletion] Invalidating OrganizationActor cache for deleted entity: ${entityName}`);
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        
        const cacheInvalidationResponse = await orgActor.fetch(new Request('https://internal/clear-org-schema-cache', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': security.organizationId
          }
        }));
        
        if (cacheInvalidationResponse.ok) {
          const invalidationResult = await cacheInvalidationResponse.json();
          console.log(`[EntityDeletion] ✅ Cache invalidated successfully:`, invalidationResult);
        } else {
          const errorText = await cacheInvalidationResponse.text();
          console.log(`[EntityDeletion] ⚠️ Cache invalidation failed:`, cacheInvalidationResponse.status, errorText);
        }
      } catch (error) {
        console.log(`[EntityDeletion] ⚠️ Cache invalidation error:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    return c.json({ success: true, message: result.message });
  }
);

// =============================================================================
// 3. DATA ENDPOINTS - CRUD operations on entity records
// =============================================================================

// Differential sync endpoint for Legend State changesSince functionality
dataforgeRouter.get('/orgs/:orgId/sync/:entityName',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Get query parameters for differential sync
    const changesSince = c.req.query('changesSince'); // ISO timestamp from Legend State
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 1000;
    const includeDeleted = c.req.query('includeDeleted') === 'true';
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    // Build filters for differential sync
    const filters: Record<string, any> = {};
    
    // Add changesSince filter if provided (core differential sync functionality)
    if (changesSince) {
      filters.updated_at = { gte: new Date(changesSince) };
    }
    
    // Handle soft deletes
    if (!includeDeleted) {
      filters.deleted = { neq: true }; // Exclude soft-deleted records
    }
    
    const result = await entityManager.queryRecords(orgId, entityName, {
      limit,
      orderBy: 'updated_at',
      orderDirection: 'asc', // Chronological order for sync
      filters: Object.keys(filters).length > 0 ? filters : undefined
    });
    
    if (!result.success) {
      return c.json({ error: 'Failed to sync records', details: result.errors }, 500);
    }
    
    // Calculate maxUpdatedAt for Legend State's next changesSince
    const data = result.data || [];
    const maxUpdatedAt = data.length > 0
      ? Math.max(...data.map((r: any) => new Date(r.updated_at || r.created_at || 0).getTime()))
      : changesSince 
        ? new Date(changesSince).getTime()
        : Date.now();
    
    return c.json({ 
      success: true, 
      data: data,
      // Metadata for Legend State sync tracking
      metadata: {
        totalCount: result.total || data.length,
        returnedCount: data.length,
        hasMore: (result.total || data.length) > data.length,
        maxUpdatedAt,
        changesSince,
        includeDeleted,
        limit
      },
      // Legend State sync info
      syncInfo: {
        fieldUpdatedAt: 'updated_at',
        fieldCreatedAt: 'created_at', 
        fieldDeleted: 'deleted',
        nextChangesSince: maxUpdatedAt
      }
    });
  }
);

dataforgeRouter.get('/orgs/:orgId/data/:entityName',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Parse query parameters properly
    const queryParams = c.req.query();
    
    // Basic pagination and limits
    const limit = queryParams.limit ? parseInt(queryParams.limit) : undefined;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : undefined;
    
    // Parse complex filters from filter[field][operator] format
    const filters: Record<string, any> = {};
    
    // Parse sorting from sort parameter (e.g., "sort=-created_at,name")
    let orderBy: string | undefined;
    let orderDirection: 'asc' | 'desc' = 'asc';
    
    if (queryParams.sort) {
      const sortFields = queryParams.sort.split(',');
      const firstField = sortFields[0];
      if (firstField.startsWith('-')) {
        orderBy = firstField.substring(1);
        orderDirection = 'desc';
      } else {
        orderBy = firstField;
        orderDirection = 'asc';
      }
    }
    
    // Override with explicit orderBy/orderDirection if provided
    if (queryParams.orderBy) {
      orderBy = queryParams.orderBy;
    }
    if (queryParams.orderDirection) {
      orderDirection = queryParams.orderDirection as 'asc' | 'desc';
    }
    
    // Parse filter parameters: filter[field][operator]=value
    for (const [key, value] of Object.entries(queryParams)) {
      const filterMatch = key.match(/^filter\[([^\]]+)\]\[([^\]]+)\]$/);
      if (filterMatch) {
        const [, field, operator] = filterMatch;
        if (!filters[field]) {
          filters[field] = {};
        }
        filters[field][operator] = value;
      }
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    // Get entity's archetype for permission checking
    const entity = await entityManager.getEntityDetails(orgId, entityName);
    if (!entity.success || !entity.data) {
      return c.json({ error: 'Entity not found', details: entity.errors }, 404);
    }

    const archetype = entity.data.archetype as ArchetypeType;
    
    // Query all records first
    const result = await entityManager.queryRecords(orgId, entityName, {
      limit,
      offset,
      orderBy,
      orderDirection,
      filters: Object.keys(filters).length > 0 ? filters : undefined
    });
    
    if (!result.success) {
      return c.json({ error: 'Failed to query records', details: result.errors }, 500);
    }
    
    // Apply archetype-specific container permissions
    console.log(`[Container Permissions] Applying ${archetype} archetype permissions for ${result.data?.length || 0} records`);
    
    const filteredData = await archetypePermissionService.filterReadableEntities(
      archetype,
      result.data || [],
      security
    );
    
    console.log(`[Container Permissions] ${archetype} filter: ${result.data?.length || 0} → ${filteredData.length} records accessible`);
    
    return c.json({ 
      success: true, 
      data: filteredData,
      total: filteredData.length,
      archetype: archetype,
      containerModel: archetypePermissionService.getArchetypePermissionSummary(archetype)?.model
    });
  }
);

dataforgeRouter.post('/orgs/:orgId/data/:entityName',
  requirePermission('entities:write'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const createData = await c.req.json();
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    // Get entity's archetype for permission checking
    const entity = await entityManager.getEntityDetails(orgId, entityName);
    if (!entity.success || !entity.data) {
      return c.json({ error: 'Entity not found', details: entity.errors }, 404);
    }

    const archetype = entity.data.archetype as ArchetypeType;
    
    // Check archetype-specific create permissions
    const permissionCheck = await archetypePermissionService.canCreate(
      archetype,
      createData,
      security
    );
    
    if (!permissionCheck.allowed) {
      console.log(`[Container Permissions] Create denied for ${archetype}: ${permissionCheck.reason}`);
      return c.json({ 
        error: 'Insufficient permissions to create this record',
        details: permissionCheck.reason,
        archetype,
        containerModel: archetypePermissionService.getArchetypePermissionSummary(archetype)?.model
      }, 403);
    }
    
    console.log(`[Container Permissions] Create allowed for ${archetype}: ${permissionCheck.reason}`);
    
    const result = await entityManager.createRecord(orgId, entityName, createData, security.userId);
    
    if (!result.success) {
      return c.json({ error: 'Failed to create record', errors: result.errors }, 400);
    }
    
    return c.json({ 
      success: true, 
      data: result.data,
      archetype,
      containerModel: archetypePermissionService.getArchetypePermissionSummary(archetype)?.model
    });
  }
);

dataforgeRouter.get('/orgs/:orgId/data/:entityName/:id',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityName, id } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    const result = await entityManager.getRecord(orgId, entityName, id);
    
    if (!result.success) {
      return c.json({ error: result.errors?.[0] || 'Record not found' }, 404);
    }
    
    return c.json({ success: true, data: result.data });
  }
);

dataforgeRouter.put('/orgs/:orgId/data/:entityName/:id',
  requirePermission('entities:write'),
  async (c) => {
    const { orgId, entityName, id } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const updateData = await c.req.json();
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    const result = await entityManager.updateRecord(orgId, entityName, id, updateData);
    
    if (!result.success) {
      return c.json({ error: 'Failed to update record', errors: result.errors }, 400);
    }
    
    return c.json({ success: true, data: result.data });
  }
);

dataforgeRouter.delete('/orgs/:orgId/data/:entityName/:id',
  requirePermission('entities:write'),
  async (c) => {
    const { orgId, entityName, id } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const permanent = c.req.query('permanent') === 'true';
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    const result = await entityManager.deleteRecord(orgId, entityName, id, permanent);
    
    if (!result.success) {
      return c.json({ error: result.errors?.[0] || 'Failed to delete record' }, 400);
    }
    
    return c.json({ success: true, data: result.data });
  }
);

// =============================================================================
// 4. BULK OPERATIONS ENDPOINTS - Batch operations for efficiency
// =============================================================================

dataforgeRouter.post('/orgs/:orgId/bulk/:entityName/create', 
  requirePermission('entities:write'),
  async (c) => {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { records, options = {} } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk creating ${records?.length || 0} records in ${entityName}`);

    if (!records || !Array.isArray(records) || records.length === 0) {
      return c.json({ error: 'records array is required and must not be empty' }, 400);
    }

    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');

    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);

    const result = await entityManager.bulkCreateRecords(
      security.organizationId,
      entityName,
      records,
      options
    );

    return c.json(result);
  }
);

dataforgeRouter.put('/orgs/:orgId/bulk/:entityName/update', 
  requirePermission('entities:write'),
  async (c) => {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { filter, updates } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk updating records in ${entityName}`);

    if (!filter || !updates) {
      return c.json({ error: 'filter and updates are required' }, 400);
    }

    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');

    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);

    const result = await entityManager.bulkUpdateRecords(
      security.organizationId,
      entityName,
      filter,
      updates
    );

    return c.json(result);
  }
);

dataforgeRouter.delete('/orgs/:orgId/bulk/:entityName/delete', 
  requirePermission('entities:write'),
  async (c) => {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { filter, permanent = false } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk deleting records in ${entityName}`);

    if (!filter) {
      return c.json({ error: 'filter is required for bulk delete' }, 400);
    }

    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');

    const kysely = createKyselyForPersistentUse();
    const entityManager = new DataForgeEntityManager({ kysely, env: c.env } as any);

    const result = await entityManager.bulkDeleteRecords(
      security.organizationId,
      entityName,
      filter,
      permanent
    );

    return c.json(result);
  }
);

// =============================================================================
// 5. SCHEMA MODIFICATION ENDPOINTS - Dynamic entity field management
// =============================================================================

dataforgeRouter.post('/orgs/:orgId/entities/:entityName/fields', 
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    const body = await c.req.json();
    const { fields, options = {} } = body;
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} adding ${fields?.length || 0} fields to ${entityName}`);

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return c.json({ error: 'fields array is required and must not be empty' }, 400);
    }

    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.addFields(orgId, entityName, fields);
    
    if (!result.success) {
      return c.json({ error: result.error, errors: result.errors, details: result.details }, 400);
    }
    
    // Include warnings if there were any partial failures
    const response: any = { success: true, message: result.message };
    if (result.addedFields) response.addedFields = result.addedFields;
    if (result.warnings) response.warnings = result.warnings;
    
    return c.json(response);
  }
);

dataforgeRouter.delete('/orgs/:orgId/entities/:entityName/fields/:fieldName', 
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName, fieldName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.removeField(orgId, entityName, fieldName);
    
    if (!result.success) {
      return c.json({ error: result.error, details: result.details }, result.error?.includes('not found') ? 404 : 400);
    }
    
    return c.json({ success: true, message: result.message });
  }
);

// =============================================================================
// 6. TRASH MANAGEMENT ENDPOINTS - Soft delete with recovery
// Using unique paths to avoid route conflicts with parametrized routes
// =============================================================================

// List deleted entities (trash) - using unique path
dataforgeRouter.get('/orgs/:orgId/trash',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.listTrash(orgId);
    
    if (!result.success) {
      return c.json({ error: result.error, details: result.details }, 500);
    }
    
    return c.json(result);
  }
);

// Restore entity from trash (undelete)
dataforgeRouter.post('/orgs/:orgId/trash/:entityName/restore',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    console.log(`[DataForge] User ${user?.email} restoring entity ${entityName} from trash`);
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.restoreEntity(orgId, entityName);
    
    if (!result.success) {
      return c.json({ 
        error: result.error, 
        details: result.details 
      }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result);
  }
);

// Permanently delete entity and its table (empty trash)
dataforgeRouter.delete('/orgs/:orgId/trash/:entityName/permanent',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    console.log(`[DataForge] User ${user?.email} permanently deleting entity ${entityName} and its table`);
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.permanentDeleteEntity(orgId, entityName);
    
    if (!result.success) {
      return c.json({ 
        error: result.error, 
        details: result.details 
      }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result);
  }
);

// =============================================================================
// SYSTEM OPTIONS ENDPOINTS - Reference data for field types
// =============================================================================

// Get system options for a specific archetype and option type
dataforgeRouter.get('/system-options/:optionType/:archetype',
  async (c) => {
    const { optionType, archetype } = c.req.param();
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const kysely = createKyselyForPersistentUse();
    
    try {
      const systemOptions = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select([
          'system_options.value as option_key',
          'system_options.label', 
          'system_options.description',
          'system_options.color',
          'system_options.icon',
          'system_options.sort_order',
          'system_options.is_active'
        ])
        .where('system_option_sets.option_set_type', '=', optionType)
        .where('system_option_sets.archetype', '=', archetype)
        .where('system_options.is_active', '=', true)
        .orderBy('system_options.sort_order', 'asc')
        .orderBy('system_options.label', 'asc')
        .execute();
        
      return c.json({
        success: true,
        data: systemOptions,
        metadata: {
          optionType,
          archetype,
          count: systemOptions.length
        }
      });
      
    } catch (error) {
      console.error('[System Options] Failed to fetch system options:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch system options',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get custom options for an organization
dataforgeRouter.get('/orgs/:orgId/custom-options/:optionSetName',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, optionSetName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const kysely = createKyselyForPersistentUse();
    
    try {
      const customOptions = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select([
          'custom_options.value as option_key',
          'custom_options.label',
          'custom_options.description', 
          'custom_options.color',
          'custom_options.icon',
          'custom_options.sort_order',
          'custom_options.is_active'
        ])
        .where('custom_option_sets.org_id', '=', orgId)
        .where('custom_option_sets.name', '=', optionSetName)
        .where('custom_options.is_active', '=', true)
        .orderBy('custom_options.sort_order', 'asc')
        .orderBy('custom_options.label', 'asc')
        .execute();
        
      return c.json({
        success: true,
        data: customOptions,
        metadata: {
          organizationId: orgId,
          optionSetName,
          count: customOptions.length
        }
      });
      
    } catch (error) {
      console.error('[Custom Options] Failed to fetch custom options:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch custom options',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

