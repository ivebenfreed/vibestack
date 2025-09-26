/**
 * DataForge API Routes
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
import { createDatabaseConnection, getKysely } from '../lib/database-manager';

export const dataforgeRouter = new Hono<AppContext>();

// Helper function to populate relationship field UUIDs from relationship table
async function populateRelationshipFields(
  records: any[],
  orgId: string,
  entityName: string,
  kysely: any
): Promise<any[]> {
  if (!records || records.length === 0) return records;

  const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;

  try {
    // Get all relationships for these entities
    const entityIds = records.map(r => r.id);

    console.log(`🔍 [populateRelationshipFields] Querying relationships for ${entityName} with IDs:`, entityIds);

    const relationships = await kysely
      .selectFrom(relationshipTable)
      .select([
        'source_entity_id',
        'target_entity_id',
        'relationship_type',
        'properties'
      ])
      .where('source_entity_type', '=', entityName)
      .where('source_entity_id', 'in', entityIds)
      .where('valid_until', 'is', null)
      .execute();

    console.log(`🔍 [populateRelationshipFields] Found ${relationships.length} relationships:`, relationships);

    // Create a map of entity_id -> field_name -> target_id
    const relationshipMap = new Map<string, Record<string, string>>();

    for (const rel of relationships) {
      if (!relationshipMap.has(rel.source_entity_id)) {
        relationshipMap.set(rel.source_entity_id, {});
      }

      // Extract field_name from properties if available
      let fieldName: string | undefined;
      try {
        const properties = typeof rel.properties === 'string'
          ? JSON.parse(rel.properties)
          : rel.properties;
        fieldName = properties?.field_name;
      } catch (error) {
        console.log(`⚠️ [populateRelationshipFields] Failed to parse properties:`, rel.properties);
        fieldName = undefined;
      }
      console.log(`🔍 [populateRelationshipFields] Processing relationship:`, {
        source_entity_id: rel.source_entity_id,
        target_entity_id: rel.target_entity_id,
        relationship_type: rel.relationship_type,
        properties: rel.properties,
        extracted_field_name: fieldName
      });

      if (fieldName) {
        relationshipMap.get(rel.source_entity_id)![fieldName] = rel.target_entity_id;
        console.log(`🔗 [populateRelationshipFields] Mapped ${fieldName} = ${rel.target_entity_id} for entity ${rel.source_entity_id}`);
      } else {
        console.log(`⚠️ [populateRelationshipFields] No field_name found in properties for relationship ${rel.relationship_type}`);
      }
    }

    // Populate relationship fields in records
    const populatedRecords = records.map(record => {
      const entityRelationships = relationshipMap.get(record.id);
      if (entityRelationships) {
        return { ...record, ...entityRelationships };
      }
      return record;
    });

    console.log(`🔗 [populateRelationshipFields] Populated ${relationships.length} relationship field values for ${records.length} ${entityName} records`);

    return populatedRecords;
  } catch (error) {
    console.error(`🔗 [populateRelationshipFields] Failed to populate relationship fields for ${entityName}:`, error);
    return records; // Return original records on error
  }
}

// Helper function to resolve relationship field IDs to display names
async function resolveRelationships(
  records: any[],
  orgId: string,
  entityName: string,
  kysely: any
): Promise<any[]> {
  
  // Helper function to extract display field from format string
  function extractDisplayFieldFromFormat(displayFormat: string): string {
    // Look for patterns like {name}, {title}, {email}
    const match = displayFormat.match(/\{(\w+)\}/);
    return match ? match[1] : 'name'; // default to 'name'
  }
  if (!records || records.length === 0) return records;

  // Get entity schema to find relationship fields
  const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
  const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
  
  const rulesEngine = new JsonRulesEngine();
  const entityManager = new DataForgeEntityManager({ kysely, rulesEngine } as any);
  
  const entityDetails = await entityManager.getEntityDetails(orgId, entityName);
  if (!entityDetails.success) return records;
  
  // Find relationship fields in the entity schema
  const relationshipFields: string[] = [];
  const entity = entityDetails.data;
  
  // Check all fields for relationship types (fields property contains both archetype and custom fields)
  if (entity.fields) {
    for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
      const fieldType = typeof fieldDef === 'string' ? fieldDef : (fieldDef as any)?.type;
      if (fieldType === 'user_reference' || fieldType === 'entity_reference' || 
          fieldType === 'custom_user_reference' || fieldType === 'custom_entity_reference') {
        relationshipFields.push(fieldName);
      }
    }
  }

  if (relationshipFields.length === 0) return records;

  // Load relationship field configurations to get proper display fields
  const relationshipConfigs = await kysely
    .selectFrom('dataforge_relationship_fields')
    .select(['field_name', 'target_entity_type', 'display_format'])
    .where('org_id', '=', orgId)
    .where('entity_type', '=', entityName)
    .execute();
  
  const fieldConfigMap = new Map(
    relationshipConfigs.map(config => [config.field_name, config])
  );

  // Group IDs by target entity type and extract display field from configuration
  const entityTypeInfo = new Map<string, { ids: Set<string>, displayField: string }>();
  
  for (const record of records) {
    for (const fieldName of relationshipFields) {
      const value = record[fieldName];
      if (value && typeof value === 'string') {
        const config = fieldConfigMap.get(fieldName);
        if (!config) {
          console.warn(`🔧 resolveRelationships: No relationship config found for ${fieldName} in ${entityName}`);
          continue;
        }
        
        const targetEntityType = config.target_entity_type;
        const displayField = extractDisplayFieldFromFormat(config.display_format);
        
        if (!entityTypeInfo.has(targetEntityType)) {
          entityTypeInfo.set(targetEntityType, { ids: new Set(), displayField });
        }
        entityTypeInfo.get(targetEntityType)!.ids.add(value);
      }
    }
  }

  if (entityTypeInfo.size === 0) return records;

  // Query each target entity type separately and build lookup map
  const lookupMap = new Map<string, string>();
  
  for (const [targetEntityType, { ids: idsToResolve, displayField }] of entityTypeInfo) {
    if (idsToResolve.size === 0) continue;

    try {
      let referencedEntities: any[] = [];

      if (targetEntityType === 'User') {
        // Handle User entities specially - they're system entities, not org-specific
        referencedEntities = await kysely
          .selectFrom('organization_members as om')
          .innerJoin('user as u', 'u.id', 'om.user_id')
          .select([
            'u.id',
            'u.name',
            'u.email'
          ])
          .where('om.organization_id', '=', orgId)
          .where('u.id', 'in', Array.from(idsToResolve))
          .execute();
      } else {
        // Handle regular entities - org-specific tables
        const tableName = `org_${orgId.replace(/-/g, '_')}_${targetEntityType.toLowerCase()}`;
        const selectColumns = ['id', displayField];

        referencedEntities = await kysely
          .selectFrom(tableName)
          .select(selectColumns)
          .where('id', 'in', Array.from(idsToResolve))
          .execute();
      }

      // Add to lookup map using the configured display field
      for (const entity of referencedEntities) {
        const displayName = entity[displayField] || entity.name || entity.title || entity.id;
        lookupMap.set(entity.id, displayName);
      }
    } catch (error) {
      console.error(`🔧 resolveRelationships: Error querying ${targetEntityType} with field ${displayField}:`, error);
      // Continue with other entity types
    }
  }

  // Resolve relationships in records
  const resolvedRecords = records.map(record => {
    const resolvedRecord = { ...record };
      
      for (const fieldName of relationshipFields) {
        const value = record[fieldName];
        
        if (value && typeof value === 'string' && lookupMap.has(value)) {
          // Keep original UUID in the field for saving, add resolved name to separate field for display
          resolvedRecord[fieldName] = value; // Keep original UUID
          resolvedRecord[`${fieldName}_resolved`] = lookupMap.get(value); // Add resolved display name
        }
      }
      
      return resolvedRecord;
    });

  return resolvedRecords;
}

// Apply hybrid security middleware to all organization-scoped routes
dataforgeRouter.use('/orgs/:orgId/*', hybridRLSOrgActorMiddleware);

// =============================================================================
// 0. SYSTEM OPTIONS ENDPOINTS - Global field type options
// =============================================================================

// Get system options for field types (used by frontend components)
dataforgeRouter.get('/system-options/:optionType', async (c) => {
  const { optionType } = c.req.param();
  
  try {
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const kysely = createKyselyForPersistentUse();
    
    // Get system options for the specified type
    const options = await kysely
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
      .where('system_options.is_active', '=', true)
      .orderBy('system_options.sort_order', 'asc')
      .execute();
    
    return c.json({
      success: true,
      data: options,
      metadata: {
        optionType,
        count: options.length,
        source: 'system'
      }
    });
  } catch (error) {
    console.error(`[SystemOptions] Failed to fetch system options for ${optionType}:`, error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch system options',
      optionType 
    }, 500);
  }
});

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
    
    // Cache layer removed - using direct PostgreSQL queries with WAL real-time updates
    console.log(`[EntityCreation] Created entity: ${entityName} (no cache invalidation needed)`);
    
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
    // Direct PostgreSQL query (no caching complexity)
    console.log(`[Schema Loading] 📡 Loading schema from PostgreSQL`);
    
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
    
    const responseTime = Date.now() - startTime;
    console.log(`[Schema Loading] ✅ PostgreSQL response completed (${responseTime}ms) with ${result.data?.length || 0} entities`);
    
    return c.json({
      success: true,
      schema: result.data,
      cached: false,
      source: 'postgresql_direct',
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
    
    // Cache layer removed - using direct PostgreSQL queries with WAL real-time updates
    console.log(`[EntityDeletion] Deleted entity: ${entityName} (no cache invalidation needed)`);
    
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
    
    // Resolve relationship fields for sync data
    const data = result.data || [];
    const resolvedData = await resolveRelationships(data, orgId, entityName, kysely);
    
    // Calculate maxUpdatedAt for Legend State's next changesSince
    const maxUpdatedAt = resolvedData.length > 0
      ? Math.max(...resolvedData.map((r: any) => new Date(r.updated_at || r.created_at || 0).getTime()))
      : changesSince 
        ? new Date(changesSince).getTime()
        : Date.now();
    
    return c.json({ 
      success: true, 
      data: resolvedData,
      // Metadata for Legend State sync tracking
      metadata: {
        totalCount: result.total || resolvedData.length,
        returnedCount: resolvedData.length,
        hasMore: (result.total || resolvedData.length) > resolvedData.length,
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
    
    // First populate relationship field UUIDs from relationship table
    const dataWithRelationships = await populateRelationshipFields(filteredData, orgId, entityName, kysely);

    // Then resolve relationship fields to show actual entity names instead of IDs
    const resolvedData = await resolveRelationships(dataWithRelationships, orgId, entityName, kysely);
    
    return c.json({ 
      success: true, 
      data: resolvedData,
      total: resolvedData.length,
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

    // Populate relationship field UUIDs and resolve display names for single record
    const dataWithRelationships = await populateRelationshipFields([result.data], orgId, entityName, kysely);
    const resolvedData = await resolveRelationships(dataWithRelationships, orgId, entityName, kysely);

    return c.json({ success: true, data: resolvedData[0] });
  }
);

dataforgeRouter.put('/orgs/:orgId/data/:entityName/:id',
  requirePermission('entities:write'),
  async (c) => {
    const { orgId, entityName, id } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    console.log(`🔍 [DataForge API] PUT UPDATE REQUEST RECEIVED:`, {
      orgId,
      entityName,
      id,
      userEmail: user?.email || 'anonymous',
      securityOrgId: security?.organizationId
    });
    
    if (orgId !== security.organizationId) {
      console.log(`❌ [DataForge API] Access denied: orgId ${orgId} !== securityOrgId ${security.organizationId}`);
      return c.json({ error: 'Access denied' }, 403);
    }
    
    let updateData;
    try {
      updateData = await c.req.json();
      console.log(`📝 [DataForge API] Update data received:`, updateData);

      // Filter out deprecated _resolved fields from client-side persisted data
      // These fields were deprecated in September 2025 but may still exist in Legend State browser cache
      const originalKeys = Object.keys(updateData);
      updateData = Object.keys(updateData).reduce((acc, key) => {
        if (key.endsWith('_resolved')) {
          console.log(`🧹 [DataForge API] Filtering out deprecated _resolved field: ${key}`);
          return acc;
        }
        acc[key] = updateData[key];
        return acc;
      }, {} as any);

      const filteredKeys = Object.keys(updateData);
      if (originalKeys.length !== filteredKeys.length) {
        console.log(`🔧 [DataForge API] Filtered update data:`, {
          originalCount: originalKeys.length,
          filteredCount: filteredKeys.length,
          removedCount: originalKeys.length - filteredKeys.length
        });
      }
    } catch (error) {
      console.log(`❌ [DataForge API] Failed to parse JSON:`, error);
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);
    
    // Get entity schema to identify relationship fields
    const entityDetails = await entityManager.getEntityDetails(orgId, entityName);
    if (!entityDetails.success) {
      return c.json({ error: 'Entity not found', details: entityDetails.errors }, 404);
    }

    // Identify relationship fields from the entity schema
    const relationshipFields = new Set<string>();
    const entity = entityDetails.data;

    if (entity.fields) {
      for (const [fieldName, fieldDef] of Object.entries(entity.fields)) {
        const fieldType = typeof fieldDef === 'string' ? fieldDef : (fieldDef as any)?.type;
        if (fieldType === 'user_reference' || fieldType === 'entity_reference' ||
            fieldType === 'custom_user_reference' || fieldType === 'custom_entity_reference') {
          relationshipFields.add(fieldName);
        }
      }
    }

    // Separate regular fields from relationship fields
    const regularFields: any = {};
    const relationshipUpdates: any = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (relationshipFields.has(key)) {
        relationshipUpdates[key] = value;
      } else {
        regularFields[key] = value;
      }
    }

    console.log(`⚡ [DataForge API] Separated update data:`, {
      orgId,
      entityName,
      id,
      regularFieldsKeys: Object.keys(regularFields),
      relationshipFieldsKeys: Object.keys(relationshipUpdates)
    });

    // Update regular fields if any exist
    let result: any = { success: true, data: {} };
    if (Object.keys(regularFields).length > 0) {
      result = await entityManager.updateRecord(orgId, entityName, id, regularFields);

      if (!result.success) {
        console.log(`❌ [DataForge API] Regular fields update failed:`, result.errors);
        return c.json({ error: 'Failed to update record', errors: result.errors }, 400);
      }
    }

    // Handle relationship field updates if any exist
    if (Object.keys(relationshipUpdates).length > 0) {
      console.log(`🔗 [DataForge API] Processing relationship field updates:`, relationshipUpdates);

      try {
        const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;

        // Process each relationship field update
        for (const [fieldName, targetEntityId] of Object.entries(relationshipUpdates)) {
          if (targetEntityId) {
            // Get relationship configuration for this field
            const relationshipConfig = await kysely
              .selectFrom('dataforge_relationship_fields')
              .select(['relationship_type', 'target_entity_type'])
              .where('org_id', '=', orgId)
              .where('entity_type', '=', entityName)
              .where('field_name', '=', fieldName)
              .executeTakeFirst();

            if (relationshipConfig) {
              // Create new relationship (simplified - no invalidation for now)
              await kysely
                .insertInto(relationshipTable)
                .values({
                  source_entity_type: entityName,
                  source_entity_id: id,
                  target_entity_type: relationshipConfig.target_entity_type,
                  target_entity_id: String(targetEntityId),
                  relationship_type: relationshipConfig.relationship_type,
                  properties: JSON.stringify({ field_name: fieldName }),
                  created_by: security.userId,
                  created_at: new Date()
                })
                .execute();

              console.log(`🔗 [DataForge API] Created relationship: ${entityName}/${id} -> ${relationshipConfig.target_entity_type}/${targetEntityId} (${fieldName})`);
            }
          }
        }
      } catch (error) {
        console.error(`🔗 [DataForge API] Failed to process relationship updates:`, error);
        // Don't fail the entire request for relationship errors
      }
    }
    
    console.log(`📊 [DataForge API] EntityManager.updateRecord result:`, {
      success: result.success,
      hasData: !!result.data,
      errors: result.errors,
      statusCode: result.success ? 200 : 400
    });
    
    if (!result.success) {
      console.log(`❌ [DataForge API] Update failed with errors:`, result.errors);
      return c.json({ error: 'Failed to update record', errors: result.errors }, 400);
    }
    
    console.log(`✅ [DataForge API] Update successful for ${entityName}/${id}`);
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
// FIELD TRASH MANAGEMENT ENDPOINTS - Soft delete with recovery for custom fields
// =============================================================================

// List deleted fields (field trash)
dataforgeRouter.get('/orgs/:orgId/entities/:entityName/fields/trash',
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
    
    const result = await entityManager.listFieldTrash(orgId, entityName);
    
    if (!result.success) {
      return c.json({ 
        error: result.error, 
        details: result.details 
      }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result);
  }
);

// Restore field from trash
dataforgeRouter.post('/orgs/:orgId/entities/:entityName/fields/:fieldName/restore',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName, fieldName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    console.log(`[DataForge] User ${user?.email} restoring field ${fieldName} from trash in entity ${entityName}`);
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.restoreField(orgId, entityName, fieldName);
    
    if (!result.success) {
      return c.json({ 
        error: result.error, 
        details: result.details 
      }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result);
  }
);

// Permanently delete field (empty field from trash)
dataforgeRouter.delete('/orgs/:orgId/entities/:entityName/fields/:fieldName/permanent',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName, fieldName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    console.log(`[DataForge] User ${user?.email} permanently deleting field ${fieldName} from entity ${entityName}`);
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');
    
    const kysely = createKyselyForPersistentUse();
    const rulesEngine = new JsonRulesEngine();
    const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });
    
    const result = await entityManager.permanentDeleteField(orgId, entityName, fieldName);
    
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
// REMOVED: System options endpoint - system options are templates only
// Use /orgs/:orgId/options/:optionType instead

// Get custom options for an organization
// Unified options endpoint - all live dropdown data comes from custom options
dataforgeRouter.get('/orgs/:orgId/options/:optionType',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, optionType } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const { createKyselyForPersistentUse } = await import('../lib/database-manager');
    const kysely = createKyselyForPersistentUse();
    
    try {
      const options = await kysely
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
        .where('custom_option_sets.option_set_type', '=', optionType)
        .where('custom_options.is_active', '=', true)
        .orderBy('custom_options.sort_order', 'asc')
        .orderBy('custom_options.label', 'asc')
        .execute();
        
      return c.json({
        success: true,
        data: options,
        metadata: {
          organizationId: orgId,
          optionType,
          count: options.length
        }
      });
      
    } catch (error) {
      console.error('[Options] Failed to fetch options:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch options',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Create a new custom option in an option set
dataforgeRouter.post('/orgs/:orgId/options/:optionType',
  requirePermission('entities:write'),
  async (c) => {
    try {
      const { orgId, optionType } = c.req.param();
      const body = await c.req.json();
      const { value, label, description, color, icon, sort_order } = body;

      if (!value || !label) {
        return c.json({
          success: false,
          error: 'Missing required fields: value and label'
        }, 400);
      }

      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const kysely = createKyselyForPersistentUse();

      // Get or create the custom option set
      let optionSet = await kysely
        .selectFrom('custom_option_sets')
        .select('id')
        .where('org_id', '=', orgId)
        .where('option_set_type', '=', optionType)
        .executeTakeFirst();

      if (!optionSet) {
        // Auto-create option set if it doesn't exist (unified options system)
        const newOptionSetId = crypto.randomUUID();
        await kysely
          .insertInto('custom_option_sets')
          .values({
            id: newOptionSetId,
            org_id: orgId,
            option_set_type: optionType,
            name: optionType.charAt(0).toUpperCase() + optionType.slice(1), // Capitalize option type
            description: `${optionType} options for this organization`,
            is_active: true,
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date()
          })
          .execute();
        
        optionSet = { id: newOptionSetId };
        console.log(`[UnifiedOptions] Auto-created option set '${optionType}' for org ${orgId}`);
      }

      // Check if value already exists
      const existing = await kysely
        .selectFrom('custom_options')
        .select('id')
        .where('option_set_id', '=', optionSet.id)
        .where('value', '=', value)
        .executeTakeFirst();

      if (existing) {
        return c.json({
          success: false,
          error: `Option with value '${value}' already exists`
        }, 409);
      }

      // Create the new custom option
      const newOption = await kysely
        .insertInto('custom_options')
        .values({
          option_set_id: optionSet.id,
          value,
          label,
          description: description || null,
          color: color || null,
          icon: icon || null,
          sort_order: sort_order || 0,
          is_active: true,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning([
          'value as option_key',
          'label',
          'description',
          'color',
          'icon',
          'sort_order',
          'is_active'
        ])
        .executeTakeFirst();

      console.log(`[Options] Created custom option '${value}' in ${optionType} set for org ${orgId}`);

      return c.json({
        success: true,
        data: newOption,
        message: `Option '${label}' created successfully`
      });

    } catch (error) {
      console.error('[Options] Failed to create option:', error);
      return c.json({
        success: false,
        error: 'Failed to create option',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Update a custom option
dataforgeRouter.put('/orgs/:orgId/options/:optionType/:optionValue',
  requirePermission('entities:write'),
  async (c) => {
    try {
      const { orgId, optionType, optionValue } = c.req.param();
      const body = await c.req.json();
      const { label, description, color, icon, sort_order, is_active } = body;

      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const kysely = createKyselyForPersistentUse();

      // CRITICAL: Prevent modification of system option values
      const systemOptionExists = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select('system_options.id')
        .where('system_option_sets.option_set_type', '=', optionType)
        .where('system_options.value', '=', optionValue)
        .executeTakeFirst();

      if (systemOptionExists) {
        return c.json({
          success: false,
          error: 'Cannot modify system option values',
          details: `The option value '${optionValue}' is a system template and cannot be modified. System options serve as templates for all organizations.`,
          systemProtection: true
        }, 403);
      }

      // Get the custom option to update
      const option = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select(['custom_options.id', 'custom_options.value'])
        .where('custom_option_sets.org_id', '=', orgId)
        .where('custom_option_sets.option_set_type', '=', optionType)
        .where('custom_options.value', '=', optionValue)
        .executeTakeFirst();

      if (!option) {
        return c.json({
          success: false,
          error: `Option '${optionValue}' not found in '${optionType}' set`
        }, 404);
      }

      // Update the custom option
      const updatedOption = await kysely
        .updateTable('custom_options')
        .set({
          ...(label && { label }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
          ...(icon !== undefined && { icon }),
          ...(sort_order !== undefined && { sort_order }),
          ...(is_active !== undefined && { is_active }),
          updated_at: new Date()
        })
        .where('id', '=', option.id)
        .returning([
          'value as option_key',
          'label',
          'description',
          'color',
          'icon',
          'sort_order',
          'is_active'
        ])
        .executeTakeFirst();

      console.log(`[Options] Updated custom option '${optionValue}' in ${optionType} set for org ${orgId}`);

      return c.json({
        success: true,
        data: updatedOption,
        message: `Option '${optionValue}' updated successfully`
      });

    } catch (error) {
      console.error('[Options] Failed to update option:', error);
      return c.json({
        success: false,
        error: 'Failed to update option',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Delete a custom option (with system option protection)
dataforgeRouter.delete('/orgs/:orgId/options/:optionType/:optionValue',
  requirePermission('entities:write'),
  async (c) => {
    try {
      const { orgId, optionType, optionValue } = c.req.param();

      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const kysely = createKyselyForPersistentUse();

      // CRITICAL: Prevent deletion of system option values
      // This is the key protection you requested
      const systemOptionExists = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select(['system_options.id', 'system_option_sets.archetype'])
        .where('system_option_sets.option_set_type', '=', optionType)
        .where('system_options.value', '=', optionValue)
        .executeTakeFirst();

      if (systemOptionExists) {
        return c.json({
          success: false,
          error: 'Cannot delete system option values',
          details: `The option value '${optionValue}' is a system template and cannot be deleted. System options serve as templates for all organizations and are required for the application to function properly.`,
          systemProtection: true,
          archetype: systemOptionExists.archetype
        }, 403);
      }

      // Get the custom option to delete
      const option = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select(['custom_options.id', 'custom_options.value', 'custom_options.label'])
        .where('custom_option_sets.org_id', '=', orgId)
        .where('custom_option_sets.option_set_type', '=', optionType)
        .where('custom_options.value', '=', optionValue)
        .executeTakeFirst();

      if (!option) {
        return c.json({
          success: false,
          error: `Option '${optionValue}' not found in '${optionType}' set`
        }, 404);
      }

      // TODO: Add usage check to prevent orphaned references
      // This would require checking each entity table's schema for columns that reference this option type
      let usageWarning = false;

      // Delete the custom option
      await kysely
        .deleteFrom('custom_options')
        .where('id', '=', option.id)
        .execute();

      console.log(`[Options] Deleted custom option '${optionValue}' from ${optionType} set for org ${orgId}`);

      return c.json({
        success: true,
        message: `Option '${option.label}' deleted successfully`,
        warning: usageWarning ? 'This option may have been referenced by existing records. Those records will need to be updated.' : undefined
      });

    } catch (error) {
      console.error('[Options] Failed to delete option:', error);
      return c.json({
        success: false,
        error: 'Failed to delete option',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// VIRTUAL ENTITIES ENDPOINTS - For Legend State synced observables
// =============================================================================

// Organization members endpoint for User entity
dataforgeRouter.get('/orgs/:orgId/members',
  requirePermission('entities:read'),
  async (c) => {
    try {
      const { orgId } = c.req.param();

      // Create database connection
      createDatabaseConnection(c.env);
      const db = getKysely();

      // Get organization members with user data
      const members = await db
        .selectFrom('organization_members as om')
        .innerJoin('user as u', 'u.id', 'om.user_id')
        .select([
          'u.id',
          'u.name',
          'u.email',
          'om.role',
          'om.created_at',
          'om.updated_at'
        ])
        .where('om.organization_id', '=', orgId)
        .orderBy('u.name', 'asc')
        .execute();

      return c.json({
        success: true,
        data: members,
        total: members.length,
        archetype: 'user',
        containerModel: null
      });
    } catch (error) {
      console.error('[DataForge] Failed to fetch organization members:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch organization members',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// 7. RELATIONSHIP ENDPOINTS - For VibeGrid relationship field data loading
// =============================================================================

// Get relationship data for users (for user_reference fields)
dataforgeRouter.get('/orgs/:orgId/relationships/users',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    const rowIds = c.req.query('rowIds')?.split(',') || [];

    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    try {
      // Create database connection
      createDatabaseConnection(c.env);
      const db = getKysely();

      // Get organization members with user data for the specified user IDs
      let query = db
        .selectFrom('organization_members as om')
        .innerJoin('user as u', 'u.id', 'om.user_id')
        .select([
          'u.id',
          'u.name',
          'u.email',
          'om.role',
          'om.created_at',
          'om.updated_at'
        ])
        .where('om.organization_id', '=', orgId);

      // Filter by specific user IDs if provided
      if (rowIds.length > 0) {
        query = query.where('u.id', 'in', rowIds);
      }

      const users = await query
        .orderBy('u.name', 'asc')
        .execute();

      // Format for VibeGrid relationship data structure
      const userData: Record<string, any> = {};
      users.forEach(user => {
        userData[user.id] = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      });

      return c.json({
        success: true,
        data: {
          users: userData
        }
      });
    } catch (error) {
      console.error('[Relationships] Failed to fetch user relationship data:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch user relationship data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get relationship data for entities (for entity_reference fields)
dataforgeRouter.get('/orgs/:orgId/relationships/:entityType',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityType } = c.req.param();
    const security = c.get('security');
    const rowIds = c.req.query('rowIds')?.split(',') || [];

    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { DataForgeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
      const { JsonRulesEngine } = await import('../dataforge/json-rules-engine');

      const kysely = createKyselyForPersistentUse();
      const rulesEngine = new JsonRulesEngine();
      const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env } as any);

      // Query the target entity type data
      let queryOptions: any = {
        limit: 1000, // Default limit for relationship data
        orderBy: 'name'
      };

      // Filter by specific entity IDs if provided
      if (rowIds.length > 0) {
        queryOptions.filters = {
          id: { in: rowIds }
        };
      }

      const result = await entityManager.queryRecords(orgId, entityType, queryOptions);

      if (!result.success) {
        return c.json({
          error: `Failed to query ${entityType} relationship data`,
          details: result.errors
        }, 500);
      }

      // Format for VibeGrid relationship data structure
      const entityData: Record<string, any> = {};
      const records = result.data || [];

      records.forEach(record => {
        entityData[record.id] = record;
      });

      return c.json({
        success: true,
        data: {
          [entityType.toLowerCase()]: entityData
        }
      });
    } catch (error) {
      console.error(`[Relationships] Failed to fetch ${entityType} relationship data:`, error);
      return c.json({
        success: false,
        error: `Failed to fetch ${entityType} relationship data`,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// REMOVED: Legacy system options endpoint - replaced by unified options API

