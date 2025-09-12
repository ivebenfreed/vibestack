/**
 * DataForge Migration API Routes
 * 
 * Handles migration operations for moving custom fields from JSONB to real columns
 * and adding proper foreign key constraints for reference fields.
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';
import { 
  hybridRLSOrgActorMiddleware,
  requirePermission 
} from '../middleware/hybrid-rls-org-actor';

export const dataforgeMigrationRouter = new Hono<AppContext>();

// Apply hybrid security middleware to all organization-scoped routes
dataforgeMigrationRouter.use('/orgs/:orgId/*', hybridRLSOrgActorMiddleware);

// =============================================================================
// CUSTOM FIELD MIGRATION ENDPOINTS
// =============================================================================

/**
 * Migrate custom fields from JSONB to real columns for an entity
 */
dataforgeMigrationRouter.post('/orgs/:orgId/entities/:entityName/migrate-custom-fields',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Get options from query parameters
    const dryRun = c.req.query('dryRun') === 'true';
    
    console.log(`[Migration] User ${user?.email} migrating custom fields for ${entityName} (dryRun: ${dryRun})`);
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { DynamicSchemaManager } = await import('../dataforge/services/DynamicSchemaManager');
      
      const kysely = createKyselyForPersistentUse();
      const schemaManager = new DynamicSchemaManager({ kysely });
      
      const result = await schemaManager.migrateCustomFieldsToColumns(orgId, entityName, dryRun);
      
      if (!result.success) {
        return c.json({ 
          error: 'Migration failed', 
          details: result.errors,
          migratedFields: result.migratedFields 
        }, 400);
      }
      
      const response: any = {
        success: true,
        message: dryRun 
          ? `Migration plan generated for ${entityName}` 
          : `Successfully migrated ${result.migratedFields.length} custom fields to columns`,
        migratedFields: result.migratedFields,
        dryRun
      };
      
      if (dryRun && result.sql) {
        response.migrationSQL = result.sql;
      }
      
      if (result.warnings) {
        response.warnings = result.warnings;
      }
      
      return c.json(response);
      
    } catch (error) {
      console.error(`[Migration] Error migrating custom fields for ${entityName}:`, error);
      return c.json({ 
        error: 'Internal server error during migration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Check migration status for an entity
 */
dataforgeMigrationRouter.get('/orgs/:orgId/entities/:entityName/migration-status',
  requirePermission('entities:read'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { DynamicSchemaManager } = await import('../dataforge/services/DynamicSchemaManager');
      
      const kysely = createKyselyForPersistentUse();
      const schemaManager = new DynamicSchemaManager({ kysely });
      
      const hasUnmigrated = await schemaManager.hasUnmigratedCustomFields(orgId, entityName);
      
      // Get entity configuration to show details
      const entityConfig = await schemaManager['getEntityConfiguration'](orgId, entityName);
      
      return c.json({
        success: true,
        entityName,
        hasUnmigratedCustomFields: hasUnmigrated,
        customFields: entityConfig?.customFields || [],
        migrationRequired: hasUnmigrated
      });
      
    } catch (error) {
      console.error(`[Migration] Error checking migration status for ${entityName}:`, error);
      return c.json({ 
        error: 'Failed to check migration status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// FOREIGN KEY CONSTRAINT ENDPOINTS  
// =============================================================================

/**
 * Add foreign key constraints to existing reference fields
 */
dataforgeMigrationRouter.post('/orgs/:orgId/entities/:entityName/add-foreign-keys',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId, entityName } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const dryRun = c.req.query('dryRun') === 'true';
    
    console.log(`[Migration] User ${user?.email} adding foreign keys for ${entityName} (dryRun: ${dryRun})`);
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { DDLGenerator } = await import('../dataforge/DDLGenerator');
      
      const kysely = createKyselyForPersistentUse();
      
      // Get entity configuration
      const entity = await kysely
        .selectFrom('entity_schemas')
        .select(['table_name', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();
        
      if (!entity) {
        return c.json({ error: 'Entity not found' }, 404);
      }
      
      const metadata = typeof entity.business_metadata === 'string' 
        ? JSON.parse(entity.business_metadata)
        : entity.business_metadata;
        
      const allFields = metadata.allFields || [];
      const referenceFields = allFields.filter((field: any) => 
        field.type === 'user_reference' || field.type === 'entity_reference'
      );
      
      if (referenceFields.length === 0) {
        return c.json({
          success: true,
          message: 'No reference fields found - no foreign keys to add',
          addedConstraints: []
        });
      }
      
      const constraintSQL: string[] = [];
      const addedConstraints: string[] = [];
      
      // Generate foreign key constraint SQL for each reference field
      for (const field of referenceFields) {
        const constraintDDL = DDLGenerator.generateForeignKeyConstraintDDL(
          entity.table_name,
          field.name,
          field.type,
          orgId
        );
        
        if (constraintDDL) {
          constraintSQL.push(constraintDDL);
          addedConstraints.push(field.name);
        }
      }
      
      if (dryRun) {
        return c.json({
          success: true,
          message: `Foreign key plan generated for ${entityName}`,
          addedConstraints,
          constraintSQL,
          dryRun: true
        });
      }
      
      // Execute foreign key additions
      for (const sql of constraintSQL) {
        try {
          await kysely.executeQuery(kysely.raw(sql) as any);
          console.log(`[Migration] Added foreign key constraint: ${sql}`);
        } catch (error) {
          // Some constraints may already exist or reference non-existent tables
          // Log but continue with other constraints
          console.warn(`[Migration] Failed to add constraint: ${sql}`, error);
        }
      }
      
      return c.json({
        success: true,
        message: `Added foreign key constraints for ${addedConstraints.length} reference fields`,
        addedConstraints,
        constraintSQL
      });
      
    } catch (error) {
      console.error(`[Migration] Error adding foreign keys for ${entityName}:`, error);
      return c.json({ 
        error: 'Internal server error adding foreign keys',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// COMPREHENSIVE ENTITY MIGRATION ENDPOINTS
// =============================================================================

/**
 * Generate comprehensive migration plan for entire organization
 */
dataforgeMigrationRouter.get('/orgs/:orgId/migration-plan',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { EntityMigrationTool } = await import('../dataforge/services/EntityMigrationTool');
      
      const kysely = createKyselyForPersistentUse();
      const migrationTool = new EntityMigrationTool({ kysely });
      
      const plans = await migrationTool.generateMigrationPlan(orgId);
      
      const summary = {
        totalEntities: plans.length,
        needsForeignKeys: plans.filter(p => p.migrations.addForeignKeys).length,
        needsCustomFieldMigration: plans.filter(p => p.migrations.migrateCustomFields).length,
        needsTextToUuidConversion: plans.filter(p => p.migrations.convertTextToUuid).length,
        totalReferenceFields: plans.reduce((sum, p) => sum + p.referenceFields.length, 0),
        totalCustomFields: plans.reduce((sum, p) => sum + p.customFields.length, 0)
      };
      
      return c.json({
        success: true,
        summary,
        plans,
        recommendations: [
          'Execute migrations during low-traffic periods',
          'Run dry-run first to validate migration plan',
          'Backup database before executing migrations',
          'Consider running in batches for large organizations'
        ]
      });
      
    } catch (error) {
      console.error(`[Migration] Error generating migration plan:`, error);
      return c.json({ 
        error: 'Failed to generate migration plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Execute comprehensive migration for entire organization
 */
dataforgeMigrationRouter.post('/orgs/:orgId/execute-migration',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const dryRun = c.req.query('dryRun') === 'true';
    const body = await c.req.json();
    const entityFilter = body.entityFilter; // Optional array of entity names
    
    console.log(`[Migration] User ${user?.email} executing comprehensive migration (dryRun: ${dryRun})`);
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { EntityMigrationTool } = await import('../dataforge/services/EntityMigrationTool');
      
      const kysely = createKyselyForPersistentUse();
      const migrationTool = new EntityMigrationTool({ kysely });
      
      const result = await migrationTool.executeMigration(orgId, dryRun, entityFilter);
      
      return c.json({
        success: result.success,
        message: dryRun 
          ? `Migration plan validated for ${result.entitiesMigrated} entities`
          : `Successfully migrated ${result.entitiesMigrated} entities`,
        summary: {
          entitiesMigrated: result.entitiesMigrated,
          foreignKeysAdded: result.foreignKeysAdded,
          customFieldsMigrated: result.customFieldsMigrated,
          textToUuidConverted: result.textToUuidConverted
        },
        results: result.results,
        errors: result.errors.length > 0 ? result.errors : undefined,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        dryRun
      });
      
    } catch (error) {
      console.error(`[Migration] Error executing migration:`, error);
      return c.json({ 
        error: 'Migration execution failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// =============================================================================
// BULK MIGRATION ENDPOINTS
// =============================================================================

/**
 * Migrate all entities with custom fields in an organization
 */
dataforgeMigrationRouter.post('/orgs/:orgId/migrate-all-custom-fields',
  requirePermission('entities:admin'),
  async (c) => {
    const { orgId } = c.req.param();
    const security = c.get('security');
    const user = c.get('user');
    
    if (orgId !== security.organizationId) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const dryRun = c.req.query('dryRun') === 'true';
    
    console.log(`[Migration] User ${user?.email} bulk migrating all custom fields (dryRun: ${dryRun})`);
    
    try {
      const { createKyselyForPersistentUse } = await import('../lib/database-manager');
      const { DynamicSchemaManager } = await import('../dataforge/services/DynamicSchemaManager');
      
      const kysely = createKyselyForPersistentUse();
      const schemaManager = new DynamicSchemaManager({ kysely });
      
      // Get all entities with custom fields
      const entitiesWithCustomFields = await kysely
        .selectFrom('entity_schemas')
        .select(['entity_name', 'business_metadata'])
        .where('org_id', '=', orgId)
        .where('deleted', '!=', true)
        .execute();
        
      const migrationsNeeded = entitiesWithCustomFields.filter(entity => {
        const metadata = typeof entity.business_metadata === 'string' 
          ? JSON.parse(entity.business_metadata)
          : entity.business_metadata;
        return metadata.customFields && metadata.customFields.length > 0;
      });
      
      if (migrationsNeeded.length === 0) {
        return c.json({
          success: true,
          message: 'No entities with custom fields found',
          results: []
        });
      }
      
      const results = [];
      
      for (const entity of migrationsNeeded) {
        try {
          const result = await schemaManager.migrateCustomFieldsToColumns(
            orgId, 
            entity.entity_name, 
            dryRun
          );
          
          results.push({
            entityName: entity.entity_name,
            success: result.success,
            migratedFields: result.migratedFields,
            errors: result.errors,
            warnings: result.warnings
          });
          
        } catch (error) {
          results.push({
            entityName: entity.entity_name,
            success: false,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalMigratedFields = results.reduce((sum, r) => sum + (r.migratedFields?.length || 0), 0);
      
      return c.json({
        success: true,
        message: dryRun 
          ? `Migration plan generated for ${successCount}/${results.length} entities`
          : `Successfully migrated ${totalMigratedFields} custom fields across ${successCount}/${results.length} entities`,
        results,
        summary: {
          entitiesProcessed: results.length,
          entitiesSucceeded: successCount,
          totalFieldsMigrated: totalMigratedFields
        },
        dryRun
      });
      
    } catch (error) {
      console.error(`[Migration] Error in bulk migration:`, error);
      return c.json({ 
        error: 'Internal server error during bulk migration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);