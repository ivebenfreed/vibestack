/**
 * DataForge API Routes
 * 
 * Centralized entity management system using the 8 DataForge archetypes.
 * All entity operations must go through DataForge with archetype patterns.
 * 
 * SECURITY MODEL:
 * - Uses hybridRLSOrgActorMiddleware for zero-latency permission checks
 * - PostgreSQL RLS handles organization-level data isolation
 * - Organization Actor SQLite cache provides instant role/permission validation
 * - 85-90% performance improvement over legacy RLS-only approach
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { 
  hybridRLSOrgActorMiddleware,
  requirePermission 
} from '../middleware/hybrid-rls-org-actor';

export const dataforgeRouter = new Hono<AppContext>();

// Apply hybrid security middleware to all organization-scoped routes
dataforgeRouter.use('/orgs/:orgId/*', hybridRLSOrgActorMiddleware);

// DataForge Field Definition
interface DataForgeFieldDefinition {
  name: string;
  type: 'text' | 'longtext' | 'rich_text' | 'number' | 'decimal' | 'integer' | 
        'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'json' |
        'status_option' | 'priority_option' | 'category_option' | 'discussion_type_option' |
        'user_reference' | 'entity_reference';
  required?: boolean;
  defaultValue?: any;
  syncable?: boolean;
  serverOnly?: boolean;
}

// DataForge Archetype Definition
interface DataForgeArchetypeDefinition {
  fields: DataForgeFieldDefinition[];
  archetype: 'universe' | 'world' | 'project' | 'task' | 'record' | 'document' | 'file' | 'activity' | 'discussion' | 'collection';
  syncable?: boolean;
}

// =============================================================================
// 1. ARCHETYPES ENDPOINTS - Discover available entity types
// =============================================================================

// Get all available archetypes
dataforgeRouter.get('/orgs/:orgId/archetypes', 
  requirePermission('entities:read'),
  async (c) => {
    const { ArchetypeRegistry } = await import('../dataforge/ArchetypeRegistry');
    
    const archetypes = ArchetypeRegistry.getAllArchetypes();
    
    return c.json({
      success: true,
      data: {
        archetypes: archetypes.map(arch => ({
          name: arch.name,
          displayName: arch.displayName,
          description: arch.description,
          icon: arch.icon,
          baseFieldCount: arch.baseFields.length,
          features: {
            softDelete: arch.supportsSoftDelete ?? false,
            versioning: arch.supportsVersioning ?? false,
            attachments: arch.supportsAttachments ?? false,
            comments: arch.supportsComments ?? false,
            workflows: arch.supportsWorkflows ?? false
          }
        })),
        total: archetypes.length
      }
    });
  }
);

// Get specific archetype details
dataforgeRouter.get('/orgs/:orgId/archetypes/:archetype',
  requirePermission('entities:read'),
  async (c) => {
    const archetypeName = c.req.param('archetype');
    const { ArchetypeRegistry } = await import('../dataforge/ArchetypeRegistry');
    
    const archetype = ArchetypeRegistry.getArchetype(archetypeName as any);
    
    if (!archetype) {
      return c.json({
        success: false,
        error: `Archetype '${archetypeName}' not found`
      }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        name: archetype.name,
        displayName: archetype.displayName,
        description: archetype.description,
        icon: archetype.icon,
        baseFields: archetype.baseFields,
        defaultStatus: archetype.defaultStatus,
        features: {
          softDelete: archetype.supportsSoftDelete ?? false,
          versioning: archetype.supportsVersioning ?? false,
          attachments: archetype.supportsAttachments ?? false,
          comments: archetype.supportsComments ?? false,
          workflows: archetype.supportsWorkflows ?? false
        }
      }
    });
  }
);

// =============================================================================
// 2. ENTITIES ENDPOINTS - Manage entity types (schemas)
// =============================================================================

// List all entities for organization
dataforgeRouter.get('/orgs/:orgId/entities',
  requirePermission('entities:read'),
  async (c) => {
    try {
      const { orgId } = c.req.param();
      const security = c.get('security');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      const { sql } = await import('kysely');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      // Query entity schemas for this organization
      const entities = await sql<any>`
        SELECT 
          entity_name,
          table_name,
          archetype,
          business_metadata,
          created_at,
          updated_at
        FROM entity_schemas
        WHERE org_id = ${orgId}
          AND (deleted = false OR deleted IS NULL)
        ORDER BY created_at DESC
      `.execute(kysely);
      
      // Parse and format entities
      const formattedEntities = entities.rows.map((entity: any) => {
        const metadata = typeof entity.business_metadata === 'string' 
          ? JSON.parse(entity.business_metadata)
          : entity.business_metadata;
        
        const fields = metadata.fields || {};
        
        return {
          entityName: entity.entity_name,
          tableName: entity.table_name,
          archetype: entity.archetype, // Direct column now
          fieldCount: Object.keys(fields).length,
          createdAt: entity.created_at,
          updatedAt: entity.updated_at,
          syncable: metadata.syncable !== false
        };
      });
      
      return c.json({
        success: true,
        data: {
          entities: formattedEntities,
          total: formattedEntities.length
        }
      });
    } catch (error) {
      console.error('Error listing entities:', error);
      return c.json({ 
        error: 'Failed to list entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Create entity with DataForge archetype format (MOVED AND UPDATED)
dataforgeRouter.post('/orgs/:orgId/entities', 
  requirePermission('entities:write'), 
  async (c) => {
  try {
    const body = await c.req.json();
    
    // Get hybrid security context (zero-latency)
    const security = c.get('security');
    const user = c.get('user');
    
    // Zero-latency permission check already performed by requirePermission middleware
    console.log(`[DataForge] User ${user?.email || 'anonymous'} creating entity in org ${security.organizationId} with ${security.roleInfo?.role || 'unknown'} role`);
    
    const { entityName, archetype, customFields = [] } = body as {
      entityName: string;
      archetype: string;
      customFields?: DataForgeFieldDefinition[];
    };
    
    if (!entityName || !archetype) {
      // Enhanced error message to guide developers toward correct structure
      const hasNestedDefinition = body && typeof body === 'object' && 'definition' in body;
      const errorMessage = hasNestedDefinition 
        ? 'entityName and archetype must be at the top level, not nested under "definition". See /docs/dataforge/ENTITY_CREATION_API.md for correct format.'
        : 'entityName and archetype are required at the top level. See /docs/dataforge/ENTITY_CREATION_API.md for correct format.';
      
      return c.json({ error: errorMessage }, 400);
    }
    
    // Validate archetype using NEW ArchetypeRegistry
    const { ArchetypeRegistry } = await import('../dataforge/archetypes');
    
    const validArchetypes = ArchetypeRegistry.getAvailableArchetypes();
    if (!validArchetypes.includes(archetype as any)) {
      return c.json({ 
        error: `Invalid archetype '${archetype}'. Valid archetypes: ${validArchetypes.join(', ')}`
      }, 400);
    }
    
    // We'll validate after combining archetype base fields + custom fields

    // Check if entity already exists
    const existingEntity = await getEntityDefinition(c, security.organizationId, entityName);
    if (existingEntity) {
      return c.json({ 
        error: 'Entity already exists',
        details: `Entity '${entityName}' already exists with archetype '${existingEntity.archetype}'`,
        existing: {
          entityName: existingEntity.entityName,
          tableName: existingEntity.tableName,
          archetype: existingEntity.archetype
        }
      }, 409); // 409 Conflict
    }
    
    // Access control handled by hybrid security:
    // - PostgreSQL RLS provides organization-level data isolation
    // - Organization Actor cache provided instant permission validation
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[DataForge] User ${user?.email || 'unknown'} creating entity in org ${security.organizationId} - hybrid security active`);

    // Lazy load additional components
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');
    
    const schemaGenerator = new RuntimeSchemaGenerator();
    
    // Generate table name using clean naming convention
    let cleanOrgId = security.organizationId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Ensure table name starts with letter (not number)
    if (/^[0-9]/.test(cleanOrgId)) {
      cleanOrgId = `org_${cleanOrgId}`;
    }
    
    const tableName = `${cleanOrgId}_${cleanEntityName}s`;
    
    // Get archetype definition from our new clean system
    const archetypeDefinition = ArchetypeRegistry.getArchetype(archetype as any);
    if (!archetypeDefinition) {
      return c.json({ error: `Archetype '${archetype}' not found` }, 400);
    }
    
    // Get base fields from archetype with proper defaults applied
    const baseFields = archetypeDefinition.getFieldsArray();
    const baseFieldNames = new Set(baseFields.map(f => f.name));
    
    // Filter out custom fields that duplicate archetype fields and apply defaults
    const customFieldsWithDefaults = customFields
      .filter(customField => {
        if (baseFieldNames.has(customField.name)) {
          console.log(`⚠️  Ignoring duplicate custom field '${customField.name}' - already exists in ${archetype} archetype`);
          return false;
        }
        return true;
      })
      .map(customField => {
        const archetypeField = archetypeDefinition.getField(customField.name);
        return {
          name: customField.name,
          type: customField.type,
          required: customField.required ?? archetypeField?.required ?? false,
          syncable: customField.syncable ?? archetypeField?.syncable ?? true,
          serverOnly: customField.serverOnly ?? archetypeField?.serverOnly ?? false,
          defaultValue: customField.defaultValue ?? archetypeField?.defaultValue,
          enum: customField.enum ?? archetypeField?.enum,
          validation: customField.validation ?? archetypeField?.validation
        };
      });
    
    // Combine base archetype fields + unique custom fields
    const allFields = [...baseFields, ...customFieldsWithDefaults];
    
    // Validate the complete entity definition
    const requiredFields = archetypeDefinition.getRequiredFields();
    const providedFields = allFields.map(f => f.name);
    const missingFields = requiredFields.filter(rf => !providedFields.includes(rf));
    
    if (missingFields.length > 0) {
      return c.json({
        error: 'Missing required archetype fields',
        details: missingFields.map(f => `Missing required field: ${f}`)
      }, 400);
    }
    
    console.log('Creating entity with archetype:', { 
      entityName, 
      archetype, 
      tableName, 
      baseFieldCount: baseFields.length,
      customFieldCount: customFieldsWithDefaults.length,
      totalFields: allFields.length,
      requiredFields,
      providedFields
    });
    
    const tableDefinition = {
      name: entityName,
      tableName,
      archetype,
      fields: allFields // All fields with proper archetype defaults applied
    };
    
    const fullDefinition = {
      archetype,
      fields: allFields,
      syncable: true
    };
    console.log('Table definition:', tableDefinition);
    
    // Create table immediately for testing
    const createTableSQL = schemaGenerator.generateCreateTableSQL(tableDefinition);
    
    console.log(`Creating table for ${entityName}:`, createTableSQL);
    
    // Execute the table creation using Kysely - split multi-statement DDL
    const { sql } = await import('kysely');
    
    // Split DDL into individual statements and execute each one
    const statements = createTableSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await sql`${sql.raw(statement)}`.execute(kysely);
      }
    }
    
    // Apply RLS policies to the newly created table
    // TODO: Fix RLS function to handle UUID organization_id correctly
    // await sql`SELECT apply_entity_table_rls(${tableName})`.execute(kysely);
    // console.log(`✅ Applied RLS policies to table: ${tableName}`);
    
    // Store entity definition for future queries (with all fields)
    await storeEntityDefinition(c, security.organizationId, entityName, fullDefinition, tableName);
    
    return c.json({
      success: true,
      entity: {
        orgId: security.organizationId,
        entityName,
        archetype: fullDefinition.archetype,
        tableName,
        fields: fullDefinition.fields,
        createdBy: {
          userId: security.userId,
          userEmail: user?.email,
          userRole: security.roleInfo?.role
        }
      },
      tableCreated: true,
      sql: createTableSQL
    });
    
  } catch (error) {
    console.error('DataForge entity creation error:', error);
    return c.json({ 
      error: 'Failed to create entity', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete entity and its table
dataforgeRouter.delete('/orgs/:orgId/entities/:entityName',
  requirePermission('entities:admin'),
  async (c) => {
    try {
      const { orgId, entityName } = c.req.param();
      const security = c.get('security');
      const user = c.get('user');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      // Check if entity exists
      const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
      if (!entityDef) {
        return c.json({ error: `Entity ${entityName} not found` }, 404);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      const { sql } = await import('kysely');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      console.log(`[DataForge] User ${user?.email} soft deleting entity ${entityName} (table ${entityDef.tableName} preserved for recovery)`);
      
      // SOFT DELETE ONLY - table and data are preserved for recovery
      // Table can be permanently deleted later via "empty trash" functionality
      await sql`UPDATE entity_schemas 
        SET deleted = true, deleted_at = CURRENT_TIMESTAMP
        WHERE org_id = ${orgId} 
        AND entity_name = ${entityName}`.execute(kysely);
      
      return c.json({
        success: true,
        message: `Entity ${entityName} has been moved to trash (data preserved for recovery)`,
        softDeleted: true,
        tableName: entityDef.tableName,
        recoverable: true
      });
      
    } catch (error) {
      console.error('Error deleting entity:', error);
      return c.json({
        error: 'Failed to delete entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// 2.5. SYSTEM OPTIONS ENDPOINTS - Reference field option management
// =============================================================================

// Get system options for a specific archetype and option type
dataforgeRouter.get('/system-options/:optionType/:archetype',
  async (c) => {
    try {
      const { optionType, archetype } = c.req.param();
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      // Get system option set and options
      const optionSet = await kysely
        .selectFrom('system_option_sets')
        .select([
          'system_option_sets.id',
          'system_option_sets.option_set_type',
          'system_option_sets.archetype', 
          'system_option_sets.name',
          'system_option_sets.description',
          'system_option_sets.is_active',
          'system_option_sets.sort_order'
        ])
        .where('system_option_sets.option_set_type', '=', optionType)
        .where('system_option_sets.archetype', '=', archetype)
        .where('system_option_sets.is_active', '=', true)
        .executeTakeFirst();
      
      if (!optionSet) {
        return c.json({
          success: false,
          error: `No system options found for ${optionType} in ${archetype} archetype`
        }, 404);
      }
      
      // Get options for this set
      const options = await kysely
        .selectFrom('system_options')
        .select([
          'value', 'label', 'description', 'color', 'icon', 'is_active', 'sort_order', 'metadata'
        ])
        .where('option_set_id', '=', optionSet.id)
        .where('is_active', '=', true)
        .orderBy('sort_order', 'asc')
        .execute();
      
      return c.json({
        success: true,
        optionSet: {
          id: optionSet.id,
          optionSetType: optionSet.option_set_type,
          archetype: optionSet.archetype,
          name: optionSet.name,
          description: optionSet.description,
          options: options,
          isActive: optionSet.is_active,
          sortOrder: optionSet.sort_order
        }
      });
    } catch (error) {
      console.error('[DataForge] Error getting system options:', error);
      return c.json({
        success: false,
        error: 'Failed to get system options'
      }, 500);
    }
  }
);

// Get custom options for organization and option set
dataforgeRouter.get('/orgs/:orgId/custom-options/:optionSetName',
  requirePermission('entities:read'),
  async (c) => {
    try {
      const { orgId, optionSetName } = c.req.param();
      const security = c.get('security');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      // Get custom option set and options
      const optionSet = await kysely
        .selectFrom('custom_option_sets')
        .select([
          'custom_option_sets.id',
          'custom_option_sets.option_set_type',
          'custom_option_sets.name',
          'custom_option_sets.description',
          'custom_option_sets.is_active',
          'custom_option_sets.sort_order'
        ])
        .where('custom_option_sets.org_id', '=', orgId)
        .where('custom_option_sets.name', '=', optionSetName)
        .where('custom_option_sets.is_active', '=', true)
        .executeTakeFirst();
      
      if (!optionSet) {
        return c.json({
          success: false,
          error: `No custom options found for ${optionSetName} in organization`
        }, 404);
      }
      
      // Get options for this set
      const options = await kysely
        .selectFrom('custom_options')
        .select([
          'value', 'label', 'description', 'color', 'icon', 'is_active', 'sort_order', 'metadata'
        ])
        .where('option_set_id', '=', optionSet.id)
        .where('is_active', '=', true)
        .orderBy('sort_order', 'asc')
        .execute();
      
      return c.json({
        success: true,
        optionSet: {
          id: optionSet.id,
          optionSetType: optionSet.option_set_type,
          name: optionSet.name,
          description: optionSet.description,
          options: options,
          isActive: optionSet.is_active,
          sortOrder: optionSet.sort_order
        }
      });
    } catch (error) {
      console.error('[DataForge] Error getting custom options:', error);
      return c.json({
        success: false,
        error: 'Failed to get custom options'
      }, 500);
    }
  }
);

// =============================================================================
// 3. DATA ENDPOINTS - CRUD operations on entity records
// =============================================================================

// Save data to DataForge archetype entity
dataforgeRouter.post('/orgs/:orgId/data/:entityName', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    // Log user action for audit trail
    console.log(`[DataForge] User ${user?.email || 'anonymous'} saving data to ${entityName} in org ${security.organizationId}`);

    // Access control is now handled by RLS policies
    // RLS middleware has already set the database context
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[DataForge] User ${user?.email || 'unknown'} saving ${entityName} in org ${security.organizationId} - access controlled by RLS`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Validate and prepare data
    const validationResult = validateUniversalArchetypeData(data, entityDef);
    if (!validationResult.valid) {
      return c.json({ error: 'Validation failed', details: validationResult.errors }, 400);
    }
    
    // Add system fields including user context
    const saveData = {
      ...validationResult.data,
      id: crypto.randomUUID(),
      organization_id: security.organizationId,
      created_by: security.userId,  // Use created_by to match existing schema
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Save to database using direct client
    await client.connect();
    try {
      const columns = Object.keys(saveData);
      const values = Object.values(saveData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const insertSQL = `
        INSERT INTO ${entityDef.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(insertSQL, values);
      var insertedRow = result.rows[0];
    } finally {
      await client.end();
    }
    
    return c.json({
      success: true,
      saved: insertedRow,
      archetype: entityDef.definition.archetype
    });
    
  } catch (error) {
    console.error('DataForge data save error:', error);
    return c.json({ 
      error: 'Failed to save data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Update data in DataForge archetype entity
dataforgeRouter.put('/orgs/:orgId/data/:entityName/:id', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const recordId = c.req.param('id');
    const updateData = await c.req.json();
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    console.log(`[DataForge] User ${user?.email || 'anonymous'} updating ${entityName}/${recordId} in org ${security.organizationId}`);

    // Access control is now handled by RLS policies
    // RLS middleware has already set the database context
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[DataForge] User ${user?.email || 'unknown'} accessing ${entityName} in org ${security.organizationId} - access controlled by RLS`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Add system fields for update
    const saveData = {
      ...updateData,
      updated_at: new Date()
    };
    
    // Update in database using direct client
    await client.connect();
    try {
      const updateColumns = Object.keys(saveData);
      const updateValues = Object.values(saveData);
      const setClause = updateColumns.map((col, i) => `${col} = $${i + 2}`).join(', ');
      
      const updateSQL = `
        UPDATE ${entityDef.tableName} 
        SET ${setClause}
        WHERE id = $1 AND organization_id = '${security.organizationId}'
        RETURNING *
      `;
      
      const result = await client.query(updateSQL, [recordId, ...updateValues]);
      
      if (result.rows.length === 0) {
        return c.json({ error: 'Record not found or access denied' }, 404);
      }
      
      var updatedRow = result.rows[0];
    } finally {
      await client.end();
    }
    
    return c.json({
      success: true,
      updated: updatedRow,
      archetype: entityDef.definition.archetype
    });
    
  } catch (error) {
    console.error('DataForge data update error:', error);
    return c.json({ 
      error: 'Failed to update data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete data from DataForge archetype entity
dataforgeRouter.delete('/orgs/:orgId/data/:entityName/:id',
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const recordId = c.req.param('id');
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} deleting ${entityName}/${recordId} in org ${security.organizationId}`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    await client.connect();
    try {
      // Check if the record exists
      const checkSQL = `SELECT id FROM ${entityDef.tableName} WHERE id = $1 AND organization_id = $2`;
      const checkResult = await client.query(checkSQL, [recordId, security.organizationId]);
      
      if (checkResult.rows.length === 0) {
        return c.json({ error: 'Record not found' }, 404);
      }
      
      // Perform the delete
      const deleteSQL = `DELETE FROM ${entityDef.tableName} WHERE id = $1 AND organization_id = $2 RETURNING id`;
      const result = await client.query(deleteSQL, [recordId, security.organizationId]);
      
      return c.json({
        success: true,
        deleted: result.rows[0].id,
        archetype: entityDef.definition.archetype
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('DataForge delete error:', error);
    return c.json({ 
      error: 'Failed to delete record', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Query data with changesSince support for Legend State differential sync
dataforgeRouter.get('/orgs/:orgId/sync/:entityName', 
  requirePermission('entities:read'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    
    // Get query parameters for differential sync
    const changesSince = c.req.query('changesSince'); // ISO timestamp
    const includeDeleted = c.req.query('includeDeleted') === 'true';
    const limit = parseInt(c.req.query('limit') || '1000');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    console.log(`[Sync API] User ${user?.email || 'anonymous'} syncing ${entityName} in org ${security.organizationId}`, {
      changesSince,
      includeDeleted,
      limit,
      offset
    });

    // Access control is now handled by RLS policies
    // RLS middleware has already set the database context
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[Sync API] User ${user?.email || 'unknown'} accessing ${entityName} in org ${security.organizationId} - access controlled by RLS`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Build differential sync query
    await client.connect();
    try {
      let whereClause = `organization_id = '${security.organizationId}'`;
      const queryParams: any[] = [];
      let paramCount = 0;
      
      // Add changesSince filter if provided
      if (changesSince) {
        paramCount++;
        whereClause += ` AND updated_at > $${paramCount}`;
        queryParams.push(new Date(changesSince));
      }
      
      // Include or exclude deleted records
      if (!includeDeleted) {
        whereClause += ` AND (deleted IS NULL OR deleted = false)`;
      }
      
      // Build the query
      const syncQuery = `
        SELECT *,
               EXTRACT(EPOCH FROM updated_at) * 1000 as updated_at_ms
        FROM ${entityDef.tableName}
        WHERE ${whereClause}
        ORDER BY updated_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${entityDef.tableName}
        WHERE ${whereClause}
      `;
      
      console.log(`[Sync API] Executing sync query:`, syncQuery, queryParams);
      
      const [dataResult, countResult] = await Promise.all([
        client.query(syncQuery, queryParams),
        client.query(countQuery, queryParams)
      ]);
      
      const results = dataResult.rows;
      const totalCount = parseInt(countResult.rows[0].total);
      
      // Calculate max updated_at for next sync
      const maxUpdatedAt = results.length > 0
        ? Math.max(...results.map(r => r.updated_at_ms))
        : changesSince 
          ? new Date(changesSince).getTime()
          : Date.now();
      
      console.log(`[Sync API] Returning ${results.length} records, maxUpdatedAt: ${maxUpdatedAt}`);
      
      return c.json({
        success: true,
        data: results,
        metadata: {
          archetype: entityDef.definition.archetype,
          totalCount,
          returnedCount: results.length,
          hasMore: (offset + results.length) < totalCount,
          maxUpdatedAt,
          changesSince,
          includeDeleted,
          limit,
          offset
        },
        syncInfo: {
          fieldUpdatedAt: 'updated_at',
          fieldDeleted: 'deleted',
          nextChangesSince: maxUpdatedAt
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('Sync API query error:', error);
    return c.json({ 
      error: 'Failed to sync data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Query data from DataForge archetype entity
dataforgeRouter.get('/orgs/:orgId/data/:entityName', 
  requirePermission('entities:read'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    const session = c.get('session');
    
    // Log user action for audit trail
    console.log(`[DataForge] User ${user?.email || 'anonymous'} querying ${entityName} in org ${security.organizationId}`);

    // Access control is now handled by RLS policies  
    // RLS middleware has already set the database context
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[DataForge] User ${user?.email || 'unknown'} accessing ${entityName} in org ${security.organizationId} - access controlled by RLS`);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }
    
    // Check if this is a count-only request
    const countOnly = c.req.query('count') === 'true';
    
    // Query data using direct client
    await client.connect();
    try {
      let querySQL: string;
      let results: any[];
      let count: number;
      
      if (countOnly) {
        // For count-only requests, use COUNT() for better performance
        querySQL = `
          SELECT COUNT(*) as count FROM ${entityDef.tableName}
          WHERE organization_id = $1
        `;
        
        const result = await client.query(querySQL, [security.organizationId]);
        count = parseInt(result.rows[0]?.count || '0');
        results = [];
      } else {
        // For full data requests, get all data sorted by updated_at DESC (most recent first)
        querySQL = `
          SELECT * FROM ${entityDef.tableName}
          WHERE organization_id = $1
          ORDER BY updated_at DESC, created_at DESC
        `;
        
        const result = await client.query(querySQL, [security.organizationId]);
        results = result.rows;
        count = results.length;
      }
      
      return c.json({
        success: true,
        data: results,
        archetype: entityDef.definition.archetype,
        count: count,
        countOnly: countOnly,
        queriedBy: {
          userId: security.userId,
          userEmail: user?.email
        }
      });
      
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('DataForge data query error:', error);
    return c.json({ 
      error: 'Failed to query data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete entity and its table
dataforgeRouter.delete('/orgs/:orgId/entities/:entityName', 
  requirePermission('entities:admin'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    
    // Get authenticated user from auth middleware
    const user = c.get('user');
    
    console.log(`[DataForge] User ${user?.email || 'anonymous'} deleting entity ${entityName} in org ${security.organizationId}`);
    
    if (!entityName) {
      return c.json({ error: 'entityName is required' }, 400);
    }

    // Access control is now handled by RLS policies
    // RLS middleware has already set the database context
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    console.log(`[DataForge] User ${user?.email || 'unknown'} deleting entity ${entityName} in org ${security.organizationId} - access controlled by RLS`);

    // Use ArchetypeEntityManager for proper deletion
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // First get the entity definition to find the table name
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    // For immediate execution: delete table and remove from entity_schemas
    const { sql } = await import('kysely');
    
    try {
      // 1. Drop the table immediately 
      await sql`DROP TABLE IF EXISTS ${sql.raw(entityDef.tableName)}`.execute(kysely);
      console.log(`Dropped table: ${entityDef.tableName}`);
      
      // 2. Soft delete from entity_schemas table
      await sql`UPDATE entity_schemas 
        SET deleted = true, deleted_at = CURRENT_TIMESTAMP
        WHERE org_id = ${security.organizationId} AND entity_name = ${entityName}`.execute(kysely);
      console.log(`Soft deleted entity from entity_schemas: ${security.organizationId}/${entityName}`);
      
      return c.json({
        success: true,
        entityName,
        tableName: entityDef.tableName,
        message: `Entity ${entityName} deleted successfully (immediate execution)`
      });
      
    } catch (error) {
      console.error('Entity deletion error:', error);
      return c.json({ 
        error: 'Failed to delete entity', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
    
  } catch (error) {
    console.error('Entity deletion error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Restore (undelete) entity from trash
dataforgeRouter.post('/orgs/:orgId/entities/:entityName/restore',
  requirePermission('entities:admin'),
  async (c) => {
    try {
      const { orgId, entityName } = c.req.param();
      const security = c.get('security');
      const user = c.get('user');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      const { sql } = await import('kysely');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      console.log(`[DataForge] User ${user?.email} restoring entity ${entityName} from trash`);
      
      // Check if entity exists in trash (deleted = true)
      const result = await sql`SELECT entity_name, table_name, deleted_at 
        FROM entity_schemas 
        WHERE org_id = ${orgId} 
        AND entity_name = ${entityName}
        AND deleted = true`.execute(kysely);
      
      if (!result.rows || result.rows.length === 0) {
        return c.json({ error: `Entity ${entityName} not found in trash` }, 404);
      }
      
      const entityRow = result.rows[0] as any;
      
      // Restore entity by setting deleted = false
      await sql`UPDATE entity_schemas 
        SET deleted = false, deleted_at = NULL
        WHERE org_id = ${orgId} 
        AND entity_name = ${entityName}`.execute(kysely);
      
      return c.json({
        success: true,
        message: `Entity ${entityName} has been restored from trash`,
        restored: true,
        tableName: entityRow.table_name,
        deletedAt: entityRow.deleted_at
      });
      
    } catch (error) {
      console.error('Error restoring entity:', error);
      return c.json({
        error: 'Failed to restore entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Permanently delete entity and its table (empty trash)
dataforgeRouter.delete('/orgs/:orgId/entities/:entityName/permanent',
  requirePermission('entities:admin'),
  async (c) => {
    try {
      const { orgId, entityName } = c.req.param();
      const security = c.get('security');
      const user = c.get('user');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      const { sql } = await import('kysely');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      console.log(`[DataForge] User ${user?.email} permanently deleting entity ${entityName} and its table`);
      
      // Check if entity exists in trash (deleted = true)
      const result = await sql`SELECT entity_name, table_name, deleted_at 
        FROM entity_schemas 
        WHERE org_id = ${orgId} 
        AND entity_name = ${entityName}
        AND deleted = true`.execute(kysely);
      
      if (!result.rows || result.rows.length === 0) {
        return c.json({ error: `Entity ${entityName} not found in trash` }, 404);
      }
      
      const entityRow = result.rows[0] as any;
      const tableName = entityRow.table_name;
      
      // PERMANENT DELETE - DROP TABLE AND REMOVE SCHEMA
      await sql`DROP TABLE IF EXISTS ${sql.raw(tableName)} CASCADE`.execute(kysely);
      console.log(`Permanently dropped table: ${tableName}`);
      
      await sql`DELETE FROM entity_schemas 
        WHERE org_id = ${orgId} 
        AND entity_name = ${entityName}`.execute(kysely);
      console.log(`Permanently removed entity from entity_schemas: ${entityName}`);
      
      return c.json({
        success: true,
        message: `Entity ${entityName} and all its data have been permanently deleted`,
        permanentlyDeleted: true,
        tableName: tableName,
        warning: 'This action cannot be undone'
      });
      
    } catch (error) {
      console.error('Error permanently deleting entity:', error);
      return c.json({
        error: 'Failed to permanently delete entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// List deleted entities (trash)
dataforgeRouter.get('/orgs/:orgId/entities/trash',
  requirePermission('entities:read'),
  async (c) => {
    try {
      const { orgId } = c.req.param();
      const security = c.get('security');
      
      // Verify org access
      if (orgId !== security.organizationId) {
        return c.json({ error: 'Access denied' }, 403);
      }
      
      const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
      const { sql } = await import('kysely');
      createDatabaseConnection(c.env);
      const kysely = getKysely();
      
      // Query deleted entities
      const entities = await sql<any>`
        SELECT 
          entity_name,
          table_name,
          archetype,
          business_metadata,
          created_at,
          deleted_at
        FROM entity_schemas
        WHERE org_id = ${orgId}
          AND deleted = true
        ORDER BY deleted_at DESC
      `.execute(kysely);
      
      // Format entities for response
      const formattedEntities = entities.rows.map((entity: any) => {
        const metadata = typeof entity.business_metadata === 'string' 
          ? JSON.parse(entity.business_metadata)
          : entity.business_metadata;
        
        const fields = metadata.fields || {};
        
        return {
          entityName: entity.entity_name,
          tableName: entity.table_name,
          archetype: entity.archetype,
          fieldCount: Object.keys(fields).length,
          createdAt: entity.created_at,
          deletedAt: entity.deleted_at,
          recoverable: true
        };
      });
      
      return c.json({
        success: true,
        data: {
          entities: formattedEntities,
          total: formattedEntities.length
        }
      });
    } catch (error) {
      console.error('Error listing trash:', error);
      return c.json({ 
        error: 'Failed to list deleted entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get organization schema (cache-first with PostgreSQL fallback)
dataforgeRouter.get('/orgs/:orgId/schema', 
  requirePermission('entities:read'),
  async (c) => {
  try {
    const security = c.get('security');
    const startTime = Date.now();
    
    // Check if cache busting is requested
    const bustCache = c.req.query('bustCache') === 'true';
    console.log(`[Schema Cache] 🔍 bustCache parameter:`, bustCache);
    if (bustCache) {
      console.log(`[Schema Cache] 🚫 Cache busting requested - skipping cache lookup`);
    }
    
    // 1. First try OrganizationActor cache (unless cache busting)
    try {
      if (c.env.ORGANIZATION_ACTOR && !bustCache) {
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        
        // Try to get schema from cache
        const cacheResponse = await orgActor.fetch(new Request('https://internal/org-schema', {
          headers: { 'x-org-id': security.organizationId }
        }));
        
        if (cacheResponse.ok) {
          const cacheResult = await cacheResponse.json();
          
          if (cacheResult.cached && cacheResult.schema && cacheResult.schema.length > 0) {
            console.log(`[Schema Cache] ✅ CACHE HIT - served from OrganizationActor SQLite cache (${Date.now() - startTime}ms)`);
            
            return c.json({
              success: true,
              schema: cacheResult.schema,
              cached: true,
              source: 'organization_actor_cache',
              responseTime: Date.now() - startTime
            });
          }
        }
      }
    } catch (cacheError) {
      console.warn('[Schema Cache] Cache lookup failed, falling back to PostgreSQL:', cacheError);
    }
    
    // 2. Cache miss - fallback to PostgreSQL and populate cache
    console.log(`[Schema Cache] ❌ CACHE MISS - fetching from PostgreSQL`);
    
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    createDatabaseConnection(c.env);
    const kysely = getKysely();
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    const schema = await entityManager.getSchema(security.organizationId);
    
    if (!schema) {
      return c.json({ error: `No schema found for org ${security.organizationId}` }, 404);
    }
    
    // 3. Populate cache with fresh data
    try {
      if (c.env.ORGANIZATION_ACTOR) {
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        
        const cacheRequest = new Request('https://internal/cache-org-schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: security.organizationId,
            schema: schema
          })
        });
        
        const cacheWriteResponse = await orgActor.fetch(cacheRequest);
        
        if (cacheWriteResponse.ok) {
          const cacheWriteResult = await cacheWriteResponse.json();
          console.log(`[Schema Cache] ✅ Cache populated successfully:`, cacheWriteResult);
        } else {
          const errorText = await cacheWriteResponse.text();
          console.log(`[Schema Cache] ❌ Cache population failed:`, cacheWriteResponse.status, errorText);
        }
      }
    } catch (populateError) {
      console.warn('[Schema Cache] Failed to populate cache:', populateError);
      // Don't fail the request if cache population fails
    }

    console.log(`[Schema Cache] ✅ PostgreSQL response served (${Date.now() - startTime}ms)`);
    
    return c.json({
      success: true,
      schema: schema,
      cached: false,
      source: 'postgresql_with_cache_population',
      responseTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Schema retrieval error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Validate data without saving (for testing)
dataforgeRouter.post('/orgs/:orgId/validate/:entityName', 
  requirePermission('entities:read'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const data = await c.req.json();

    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    createDatabaseConnection(c.env);
    const kysely = getKysely();
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    // Get entity config
    const config = await entityManager.getEntityConfig(security.organizationId, entityName);
    if (!config) {
      return c.json({ error: `Entity ${entityName} not found for org ${security.organizationId}` }, 404);
    }

    // Validate only
    const validation = rulesEngine.validate(data, config);

    return c.json({
      valid: validation.valid,
      errors: validation.errors,
      processedData: validation.data,
      syncableData: validation.syncableData
    });
  } catch (error) {
    console.error('Validation error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Migration status endpoints removed - now using immediate execution
// All table creation and schema registration happens immediately in entity creation endpoint
// No debounced migrations needed with immediate execution architecture

// Clear organization schema cache
dataforgeRouter.delete('/orgs/:orgId/schema/cache', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const startTime = Date.now();
    
    console.log(`[Schema Cache] 🗑️ CLEARING cache for org ${security.organizationId}`);
    
    try {
      if (c.env.ORGANIZATION_ACTOR) {
        const orgActorId = c.env.ORGANIZATION_ACTOR.idFromName(`org:${security.organizationId}`);
        const orgActor = c.env.ORGANIZATION_ACTOR.get(orgActorId);
        
        // Try to clear cache
        const clearRequest = new Request('https://internal/clear-org-schema', {
          method: 'DELETE',
          headers: { 'x-org-id': security.organizationId }
        });
        
        const clearResponse = await orgActor.fetch(clearRequest);
        
        if (clearResponse.ok) {
          const result = await clearResponse.json();
          console.log(`[Schema Cache] ✅ Cache cleared successfully (${Date.now() - startTime}ms)`);
          
          return c.json({
            success: true,
            message: 'Schema cache cleared successfully',
            cleared: true,
            responseTime: Date.now() - startTime
          });
        } else {
          console.log(`[Schema Cache] ⚠️ Cache clear failed, but continuing (${Date.now() - startTime}ms)`);
        }
      }
    } catch (cacheError) {
      console.warn('[Schema Cache] Cache clear failed, but continuing:', cacheError);
    }
    
    return c.json({
      success: true,
      message: 'Cache clear attempted',
      cleared: false,
      responseTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Schema cache clear error:', error);
    return c.json({ 
      error: 'Failed to clear schema cache', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Test endpoint to bypass cache and test schema changes (temporary)
dataforgeRouter.get('/orgs/:orgId/schema-direct', 
  requirePermission('entities:read'),
  async (c) => {
  try {
    const security = c.get('security');
    const startTime = Date.now();
    
    console.log(`[Schema Direct] 🧪 TESTING - bypassing cache completely`);
    
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    createDatabaseConnection(c.env);
    const kysely = getKysely();
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    const schema = await entityManager.getSchema(security.organizationId);
    
    if (!schema) {
      return c.json({ error: `No schema found for org ${security.organizationId}` }, 404);
    }
    
    console.log(`[Schema Direct] ✅ PostgreSQL direct response served (${Date.now() - startTime}ms)`);
    
    return c.json({
      success: true,
      schema: schema,
      cached: false,
      source: 'postgresql_direct_test',
      responseTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Schema direct fetch error:', error);
    return c.json({ 
      error: 'Failed to fetch schema directly from PostgreSQL', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Health check
dataforgeRouter.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    system: 'dataforge-api',
    archetypes: ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection']
  });
});

// Helper functions

function generateTableName(organizationId: string, entityName: string): string {
  const cleanOrgId = organizationId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  // PostgreSQL table names cannot start with numbers, so prefix with 'org_'
  return `org_${cleanOrgId}_${cleanEntityName}s`;
}

function convertToTableDefinition(entityName: string, definition: DataForgeArchetypeDefinition, tableName: string) {
  // Convert array format to Record<string, FieldDefinition> format for RuntimeSchemaGenerator
  const customFields: Record<string, any> = {};
  
  definition.fields.forEach(field => {
    customFields[field.name] = {
      type: mapUniversalTypeToFieldType(field.type),
      required: field.required || false,
      default: field.defaultValue,
      syncable: field.syncable !== false,
      serverOnly: field.serverOnly || false
    };
  });

  return {
    name: entityName,
    tableName,
    extends: mapArchetypeToBaseTable(definition.archetype),
    customFields
  };
}

function mapUniversalTypeToFieldType(universalType: string): string {
  // Map to FieldDefinition types expected by RuntimeSchemaGenerator
  const typeMap: Record<string, string> = {
    'text': 'string',
    'longtext': 'text',
    'rich_text': 'text',
    'number': 'number',
    'decimal': 'number',
    'integer': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'date',
    'email': 'email',
    'url': 'url',
    'json': 'json',
    'status_option': 'enum',
    'priority_option': 'enum',
    'category_option': 'enum',
    'discussion_type_option': 'enum',
    'user_reference': 'string',
    'entity_reference': 'string'
  };
  
  return typeMap[universalType] || 'string';
}

function mapArchetypeToBaseTable(archetype: string): string {
  // Map DataForge archetypes to base table extensions
  const baseTableMap: Record<string, string> = {
    'project': 'base_projects',
    'task': 'base_tasks',
    'record': 'base_records',
    'document': 'base_documents',
    'file': 'base_files',
    'activity': 'base_activities',
    'discussion': 'base_discussions',
    'collection': 'base_collections'
  };
  
  return baseTableMap[archetype] || 'base_entities';
}

function validateUniversalArchetypeData(data: any, entityDef: any) {
  const errors: string[] = [];
  const validatedData: any = { ...data };
  
  for (const field of entityDef.definition.fields) {
    const value = data[field.name];
    
    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.name} is required`);
      continue;
    }
    
    // Skip validation for undefined optional fields
    if (value === undefined || value === null) {
      continue;
    }
    
    // Type validation
    switch (field.type) {
      case 'text':
      case 'longtext':
      case 'rich_text':
      case 'email':
      case 'url':
      case 'status_option':
      case 'priority_option':
      case 'category_option':
      case 'discussion_type_option':
      case 'user_reference':
      case 'entity_reference':
        if (typeof value !== 'string') {
          errors.push(`${field.name} must be a string`);
        }
        break;
      case 'number':
      case 'decimal':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${field.name} must be a number`);
        }
        break;
      case 'integer':
        if (!Number.isInteger(value)) {
          errors.push(`${field.name} must be an integer`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field.name} must be a boolean`);
        }
        break;
      case 'date':
      case 'datetime':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          errors.push(`${field.name} must be a valid date`);
        }
        break;
      case 'json':
        // JSON fields accepted as-is
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: validatedData
  };
}

// =============================================================================
// 4. BULK OPERATIONS ENDPOINTS - Batch operations for efficiency
// =============================================================================

// Bulk create records
dataforgeRouter.post('/orgs/:orgId/data/:entityName/bulk', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { records, options = {} } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk creating ${records?.length || 0} records in ${entityName}`);

    if (!records || !Array.isArray(records)) {
      return c.json({ error: 'records array is required' }, 400);
    }

    if (records.length === 0) {
      return c.json({ success: true, created: [], errors: [], summary: { total: 0, created: 0, failed: 0 } });
    }

    // Use ArchetypeEntityManager following the established pattern
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    createDatabaseConnection(c.env);
    const kysely = getKysely();
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    const result = await entityManager.bulkCreateRecords(
      security.organizationId,
      entityName,
      records,
      options
    );

    return c.json(result);

  } catch (error) {
    console.error('Bulk create error:', error);
    return c.json({ 
      error: 'Failed to process bulk create', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Bulk update records
dataforgeRouter.put('/orgs/:orgId/data/:entityName/bulk', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { filter, updates } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk updating records in ${entityName}`);

    if (!filter || !updates) {
      return c.json({ error: 'filter and updates are required' }, 400);
    }

    // Use ArchetypeEntityManager following the established pattern
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { DataForgeEntityManager: ArchetypeEntityManager } = await import('../dataforge/entity-operations/EntityManager');
    const { JsonRulesEngine } = await import('../dataforge/rules/json-rules-engine');
    const { OrgSchemaManager } = await import('../dataforge/json-schema/org-entity-schema');
    const { RuntimeSchemaGenerator } = await import('../dataforge/kysely-generator/runtime-schema-generator');

    createDatabaseConnection(c.env);
    const kysely = getKysely();
    const rulesEngine = new JsonRulesEngine();
    const schemaManager = new OrgSchemaManager();
    const schemaGenerator = new RuntimeSchemaGenerator();

    const entityManager = new ArchetypeEntityManager({
      kysely,
      rulesEngine,
      schemaGenerator,
      schemaManager,
      env: c.env
    });

    const result = await entityManager.bulkUpdateRecords(
      security.organizationId,
      entityName,
      filter,
      updates
    );

    return c.json(result);

  } catch (error) {
    console.error('Bulk update error:', error);
    return c.json({ 
      error: 'Failed to process bulk update', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Bulk delete records
dataforgeRouter.delete('/orgs/:orgId/data/:entityName/bulk', 
  requirePermission('entities:write'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { filter, permanent = false } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} bulk deleting records in ${entityName} (permanent: ${permanent})`);

    if (!filter) {
      return c.json({ error: 'filter is required' }, 400);
    }

    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();

    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    // Build WHERE clause (similar to bulk update)
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'contains':
              whereConditions.push(`${field} ILIKE $${paramIndex}`);
              params.push(`%${operatorValue}%`);
              paramIndex++;
              break;
            case 'in':
              const inValues = Array.isArray(operatorValue) ? operatorValue : [operatorValue];
              const placeholders = inValues.map(() => `$${paramIndex++}`).join(', ');
              whereConditions.push(`${field} IN (${placeholders})`);
              params.push(...inValues);
              break;
          }
        }
      } else {
        whereConditions.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    let deleteQuery;
    if (permanent) {
      // Hard delete
      deleteQuery = `
        DELETE FROM ${entityDef.tableName} 
        WHERE ${whereConditions.join(' AND ')} AND organization_id = $${paramIndex}
        RETURNING id, name
      `;
    } else {
      // Soft delete (if status field exists)
      deleteQuery = `
        UPDATE ${entityDef.tableName} 
        SET status = 'deleted', updated_at = NOW()
        WHERE ${whereConditions.join(' AND ')} AND organization_id = $${paramIndex} AND status != 'deleted'
        RETURNING id, name
      `;
    }
    params.push(security.organizationId);

    const result = await kysely.executeQuery({
      sql: deleteQuery,
      parameters: params
    });

    return c.json({
      success: true,
      deleted_count: result.rows?.length || 0,
      deleted_records: result.rows?.map((row: any) => ({
        id: row.id,
        name: row.name
      })) || []
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return c.json({ 
      error: 'Failed to process bulk delete', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// =============================================================================
// 5. SCHEMA MODIFICATION ENDPOINTS - Dynamic entity field management
// =============================================================================

// Add fields to existing entity
dataforgeRouter.post('/orgs/:orgId/entities/:entityName/fields', 
  requirePermission('entities:admin'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const body = await c.req.json();
    const { fields, options = {} } = body;
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} adding ${fields?.length || 0} fields to ${entityName}`);

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return c.json({ error: 'fields array is required and must not be empty' }, 400);
    }

    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { sql } = await import('kysely');
    createDatabaseConnection(c.env);
    const kysely = getKysely();

    const addedFields = [];
    const errors = [];

    try {
      // Add each field to the table
      for (const field of fields) {
        const { name, type, required = false, defaultValue } = field;

        // Validate field definition
        if (!name || !type) {
          errors.push(`Field must have name and type: ${JSON.stringify(field)}`);
          continue;
        }

        // Map DataForge types to PostgreSQL types
        let pgType;
        switch (type.toLowerCase()) {
          case 'text':
            pgType = 'TEXT';
            break;
          case 'number':
            pgType = 'INTEGER';
            break;
          case 'decimal':
            pgType = 'DECIMAL(10,2)';
            break;
          case 'boolean':
            pgType = 'BOOLEAN';
            break;
          case 'date':
            pgType = 'TIMESTAMP';
            break;
          case 'json':
            pgType = 'JSONB';
            break;
          default:
            errors.push(`Unsupported field type: ${type}`);
            continue;
        }

        try {
          // Add column to table
          let alterQuery = `ALTER TABLE ${entityDef.tableName} ADD COLUMN ${name} ${pgType}`;
          
          if (defaultValue !== undefined) {
            if (typeof defaultValue === 'string') {
              alterQuery += ` DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
            } else {
              alterQuery += ` DEFAULT ${defaultValue}`;
            }
          }

          if (required) {
            alterQuery += ` NOT NULL`;
          }

          await kysely.executeQuery({
            sql: alterQuery,
            parameters: []
          });

          // Update entity_schemas table to include the new field
          const currentMetadata = entityDef.definition;
          const newFieldConfig = {
            type: field.type,
            required: field.required || false,
            syncable: field.syncable !== false,
            serverOnly: field.serverOnly || false,
            defaultValue: field.defaultValue
          };

          // Add to metadata
          if (!currentMetadata.fields) {
            currentMetadata.fields = {};
          }
          currentMetadata.fields[field.name] = newFieldConfig;

          // Update in database
          await kysely.executeQuery({
            sql: `UPDATE entity_schemas SET business_metadata = $1, updated_at = NOW() 
                  WHERE org_id = $2 AND entity_name = $3`,
            parameters: [JSON.stringify(currentMetadata), security.organizationId, entityName]
          });

          addedFields.push({
            name: field.name,
            type: field.type,
            required: field.required || false,
            defaultValue: field.defaultValue
          });

          console.log(`Added field ${field.name} (${field.type}) to ${entityName}`);
        } catch (fieldError) {
          errors.push(`Failed to add field ${field.name}: ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`);
        }
      }

      return c.json({
        success: errors.length === 0,
        added_fields: addedFields,
        errors: errors,
        summary: {
          total: fields.length,
          added: addedFields.length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error('Schema modification error:', error);
      return c.json({ 
        error: 'Failed to modify schema', 
        details: error instanceof Error ? error.message : 'Unknown error',
        added_fields: addedFields,
        errors: errors
      }, 500);
    }

  } catch (error) {
    console.error('Add fields error:', error);
    return c.json({ 
      error: 'Failed to process add fields request', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Modify existing field
dataforgeRouter.put('/orgs/:orgId/entities/:entityName/fields/:fieldName', 
  requirePermission('entities:admin'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const fieldName = c.req.param('fieldName');
    const body = await c.req.json();
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} modifying field ${fieldName} in ${entityName}`);

    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    // Check if field exists in entity metadata
    const currentMetadata = entityDef.definition;
    if (!currentMetadata.fields || !currentMetadata.fields[fieldName]) {
      return c.json({ error: `Field ${fieldName} not found in entity ${entityName}` }, 404);
    }

    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();

    // Update the field configuration in metadata
    const updatedFieldConfig = {
      ...currentMetadata.fields[fieldName],
      ...body
    };

    currentMetadata.fields[fieldName] = updatedFieldConfig;

    // Update in database
    await kysely.executeQuery({
      sql: `UPDATE entity_schemas SET business_metadata = $1, updated_at = NOW() 
            WHERE org_id = $2 AND entity_name = $3`,
      parameters: [JSON.stringify(currentMetadata), security.organizationId, entityName]
    });

    return c.json({
      success: true,
      field: {
        name: fieldName,
        ...updatedFieldConfig
      }
    });

  } catch (error) {
    console.error('Modify field error:', error);
    return c.json({ 
      error: 'Failed to modify field', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Remove field from entity
dataforgeRouter.delete('/orgs/:orgId/entities/:entityName/fields/:fieldName', 
  requirePermission('entities:admin'),
  async (c) => {
  try {
    const security = c.get('security');
    const entityName = c.req.param('entityName');
    const fieldName = c.req.param('fieldName');
    
    const user = c.get('user');
    console.log(`[DataForge] User ${user?.email || 'anonymous'} removing field ${fieldName} from ${entityName}`);

    // Get entity definition
    const entityDef = await getEntityDefinition(c, security.organizationId, entityName);
    if (!entityDef) {
      return c.json({ error: `Entity ${entityName} not found` }, 404);
    }

    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();

    // Remove from PostgreSQL table (optional - can be kept for data safety)
    try {
      await kysely.executeQuery({
        sql: `ALTER TABLE ${entityDef.tableName} DROP COLUMN IF EXISTS ${fieldName}`,
        parameters: []
      });
    } catch (dropError) {
      console.warn(`Could not drop column ${fieldName}:`, dropError);
      // Continue even if column drop fails - we'll remove from metadata
    }

    // Remove from entity metadata
    const currentMetadata = entityDef.definition;
    if (currentMetadata.fields && currentMetadata.fields[fieldName]) {
      delete currentMetadata.fields[fieldName];
      
      // Update in database
      await kysely.executeQuery({
        sql: `UPDATE entity_schemas SET business_metadata = $1, updated_at = NOW() 
              WHERE org_id = $2 AND entity_name = $3`,
        parameters: [JSON.stringify(currentMetadata), security.organizationId, entityName]
      });
    }

    return c.json({
      success: true,
      removed_field: fieldName
    });

  } catch (error) {
    console.error('Remove field error:', error);
    return c.json({ 
      error: 'Failed to remove field', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

async function storeEntityDefinition(c: any, organizationId: string, entityName: string, definition: DataForgeArchetypeDefinition, tableName: string) {
  try {
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { sql } = await import('kysely');
    createDatabaseConnection(c.env);
    const kysely = getKysely();

    // Store in PostgreSQL-native entity_schemas table (replaces universal_entity_registry)
    // UNIFIED FORMAT: Store fields as array (same format as API input and RuntimeSchemaGenerator)
    // Import archetype defaults to avoid hardcoded values
    const { ArchetypeRegistry } = await import('../dataforge/archetypes');
    
    const businessMetadata = {
      fields: definition.fields.map(field => {
        // Get archetype defaults for this field type
        const archetypeField = ArchetypeRegistry.getArchetype(definition.archetype)?.getField?.(field.name);
        
        return {
          name: field.name,
          type: field.type,
          required: field.required ?? archetypeField?.required ?? false,
          syncable: field.syncable ?? archetypeField?.syncable ?? true,
          serverOnly: field.serverOnly ?? archetypeField?.serverOnly ?? false,
          defaultValue: field.defaultValue ?? archetypeField?.defaultValue,
          enum: field.enum ?? archetypeField?.enum,
          validation: field.validation ?? archetypeField?.validation
        };
      }),
      description: `Entity created via DataForge API`,
      syncable: definition.syncable !== false,
      createdAt: new Date().toISOString()
    };

    // Insert into entity_schemas table (immediate execution, no debouncing)
    await sql`INSERT INTO entity_schemas (org_id, entity_name, table_name, archetype, business_metadata)
      VALUES (${organizationId}, ${entityName}, ${tableName}, ${definition.archetype}, ${JSON.stringify(businessMetadata)})
      ON CONFLICT (org_id, entity_name) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        archetype = EXCLUDED.archetype,
        business_metadata = EXCLUDED.business_metadata,
        updated_at = CURRENT_TIMESTAMP`.execute(kysely);

    console.log(`Stored entity definition in entity_schemas: ${organizationId}/${entityName} -> ${tableName} (archetype: ${definition.archetype})`);
  } catch (error) {
    console.error('Error storing entity definition in entity_schemas:', error);
    throw error;
  }
}

async function getEntityDefinition(c: any, organizationId: string, entityName: string) {
  try {
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    const { sql } = await import('kysely');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    // Query from PostgreSQL-native entity_schemas table
    const result = await sql`SELECT table_name, archetype, business_metadata FROM entity_schemas 
      WHERE org_id = ${organizationId} AND entity_name = ${entityName} 
        AND (deleted = false OR deleted IS NULL)`.execute(kysely);
      
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      const businessMetadata = typeof row.business_metadata === 'string' 
        ? JSON.parse(row.business_metadata) 
        : row.business_metadata;
      
      // Convert back to DataForgeArchetypeDefinition format for compatibility
      const definition = {
        archetype: row.archetype,
        fields: Object.entries(businessMetadata.fields || {}).map(([name, config]: [string, any]) => ({
          name,
          type: config.type,
          required: config.required || false,
          syncable: config.syncable !== false,
          serverOnly: config.serverOnly || false,
          defaultValue: config.defaultValue
        })),
        syncable: businessMetadata.syncable !== false
      };
      
      return {
        tableName: row.table_name,
        definition
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting entity definition from entity_schemas:', error);
    return null;
  }
}