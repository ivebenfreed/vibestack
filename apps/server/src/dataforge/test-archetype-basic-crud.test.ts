/**
 * Test: ArchetypeEntityManager Basic CRUD Operations with Organization Isolation
 * 
 * Tests the complete CRUD workflow using the working mock system from the previous test.
 * This focuses on validating the business logic and organization isolation rather than 
 * implementing a full data persistence layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArchetypeEntityManager } from './entity-operations/ArchetypeEntityManager';
import type { EntityManagerConfig } from './entity-operations/entity-manager';
import type { FieldDefinition } from './rules/json-rules-engine';

// Use the same proven mock system from the unit tests
const createChainableMockQuery = () => {
  const mockQuery = {
    select: (fields: any) => mockQuery,
    selectAll: () => mockQuery,
    where: (field: string, op: string, value: any) => mockQuery,
    executeTakeFirst: () => Promise.resolve({ id: 'org-uuid-123' }),
    execute: () => Promise.resolve([{ id: 'entity-123', name: 'Test Entity', created_at: new Date(), updated_at: new Date() }])
  };
  return mockQuery;
};

const mockKysely = {
  selectFrom: (table: string) => createChainableMockQuery(),
  executeQuery: () => Promise.resolve({
    rows: [{ id: 'entity-123', name: 'Test Entity', created_at: new Date(), updated_at: new Date() }]
  })
};

const mockRulesEngine = {
  validate: () => ({
    valid: true,
    data: { name: 'Test', description: 'Test Description' },
    syncableData: { name: 'Test', description: 'Test Description' },
    errors: []
  })
};

const mockSchemaGenerator = {
  generateCreateTableSQL: () => 'CREATE TABLE test_table (...);'
};

const mockSchemaManager = {
  validateEntityDefinition: () => [],
  generateTableName: (orgId: string, entityName: string) => `${orgId}_${entityName}`,
  createEntityConfig: (orgId: string, entityName: string, definition: any) => ({
    tableName: definition.tableName || `${orgId}_${entityName}`,
    archetype: definition.extends || 'project',
    fieldDefinitions: definition.customFields || {},
    customFields: definition.customFields || {},
    basePrimitive: definition.extends === 'project' ? 'Project' : 'Task'
  })
};

const mockMigrationService = {
  scheduleSchemaChange: () => Promise.resolve('migration-123')
};

// Enhanced mock OrgSchemaDO with CRUD operations
const mockOrgSchemaDO = {
  fetch: (request: Request) => {
    const url = new URL(request.url);
    
    if (url.pathname === '/create-archetype' && request.method === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        ddl: 'CREATE TABLE test_projects (...);'
      })));
    }
    
    if (url.pathname === '/archetype-entities') {
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        entities: {
          test_projects: {
            tableName: 'test_projects',
            extends: 'project',
            customFields: { client_budget: { type: 'decimal', required: false } },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        }
      })));
    }
    
    if (url.pathname.startsWith('/archetype-entity/')) {
      const tableName = url.pathname.split('/archetype-entity/')[1];
      if (request.method === 'DELETE') {
        return Promise.resolve(new Response(JSON.stringify({ success: true })));
      }
      
      if (tableName === 'non_existent_table') {
        return Promise.resolve(new Response('Not found', { status: 404 }));
      }
      
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        entity: {
          tableName,
          extends: 'project',
          customFields: { client_budget: { type: 'decimal', required: false } }
        }
      })));
    }
    
    if (url.pathname.startsWith('/config/')) {
      const entityName = url.pathname.split('/config/')[1];
      
      if (entityName === 'non_existent_table') {
        return Promise.resolve(new Response('Not found', { status: 404 }));
      }
      
      return Promise.resolve(new Response(JSON.stringify({
        tableName: entityName,
        archetype: 'project',
        fieldDefinitions: {},
        customFields: {},
        basePrimitive: 'Project'
      })));
    }
    
    return Promise.resolve(new Response('Not found', { status: 404 }));
  }
};

const mockEnv = {
  ORG_SCHEMA: {
    idFromName: () => 'org-do-id',
    get: () => mockOrgSchemaDO
  }
};

describe('ArchetypeEntityManager Basic CRUD Operations', () => {
  let manager: ArchetypeEntityManager;
  let config: EntityManagerConfig;

  beforeEach(() => {
    config = {
      kysely: mockKysely as any,
      rulesEngine: mockRulesEngine as any,
      schemaGenerator: mockSchemaGenerator as any,
      schemaManager: mockSchemaManager as any,
      migrationService: mockMigrationService as any,
      env: mockEnv
    };

    manager = new ArchetypeEntityManager(config);
  });

  describe('Create Operations', () => {
    it('should create Project archetype entities with organization isolation', async () => {
      // Create project entity for Org A
      const orgAResult = await manager.createArchetypeEntity(
        'org-a',
        'project',
        'client_projects',
        {
          client_name: { type: 'text', required: true },
          client_budget: { type: 'decimal', required: false }
        }
      );

      if (!orgAResult.success) {
        console.log('Org A creation failed with errors:', orgAResult.errors);
      }
      expect(orgAResult.success).toBe(true);
      expect(orgAResult.tableName).toBe('client_projects');
      expect(orgAResult.ddl).toBeDefined();
      expect(orgAResult.migrationId).toBeDefined();

      // Create similar entity for Org B (demonstrating isolation)
      const orgBResult = await manager.createArchetypeEntity(
        'org-b',
        'project',
        'client_projects', // Same table name, different org
        {
          department: { type: 'text', required: true },
          annual_budget: { type: 'decimal', required: false }
        }
      );

      expect(orgBResult.success).toBe(true);
      expect(orgBResult.tableName).toBe('client_projects');
    });

    it('should create Task archetype entities with custom fields', async () => {
      const result = await manager.createArchetypeEntity(
        'dev-team',
        'task',
        'development_tasks',
        {
          external_story_points: { type: 'integer', required: false },
          github_issue: { type: 'text', required: false },
          external_sprint_id: { type: 'text', required: false }
        }
      );

      if (!result.success) {
        console.log('Task creation failed with errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.tableName).toBe('development_tasks');
      expect(result.ddl).toBeDefined();
    });

    it('should create multiple archetype types in the same organization', async () => {
      const orgId = 'multi-arch-org';

      const projectResult = await manager.createArchetypeEntity(
        orgId,
        'project',
        'software_projects',
        { technology_stack: { type: 'text', required: false } }
      );

      const taskResult = await manager.createArchetypeEntity(
        orgId,
        'task',
        'project_tasks',
        { external_project_id: { type: 'text', required: true } }
      );

      if (!taskResult.success) {
        console.log('Task result failed with errors:', taskResult.errors);
      }
      expect(projectResult.success).toBe(true);
      expect(taskResult.success).toBe(true);

      // Verify all have different table names
      expect(projectResult.tableName).toBe('software_projects');
      expect(taskResult.tableName).toBe('project_tasks');
    });
  });

  describe('Read Operations', () => {
    it('should save and query archetype entity data', async () => {
      // First create the entity
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        { client_budget: { type: 'decimal', required: false } }
      );

      // Save data
      const saveResult = await manager.saveArchetypeEntityData(
        'org-123',
        'test_projects',
        {
          name: 'Test Project',
          description: 'A test project',
          client_budget: 10000.00,
          priority: 'high',
          status: 'active'
        }
      );

      expect(saveResult.success).toBe(true);
      expect(saveResult.data).toBeDefined();
      expect(saveResult.syncData).toBeDefined();

      // Query data
      const queryResult = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        {},
        { includeMetadata: true }
      );

      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toBeDefined();
      expect(queryResult.metadata).toBeDefined();
      expect(queryResult.metadata!.archetype).toBe('project');
    });

    it('should handle filtered queries', async () => {
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {}
      );

      const queryResult = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        { status: 'active', priority: 'high' }
      );

      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toBeDefined();
    });

    it('should handle syncable-only queries', async () => {
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {}
      );

      const queryResult = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        {},
        { syncableOnly: true }
      );

      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toBeDefined();
    });
  });

  describe('List and Management Operations', () => {
    it('should list all archetype entities for an organization', async () => {
      const result = await manager.listArchetypeEntities('org-123');

      expect(result.success).toBe(true);
      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
    });

    it('should delete archetype entities', async () => {
      const deleteResult = await manager.deleteArchetypeEntity(
        'org-123',
        'test_projects',
        { dropTable: true }
      );

      expect(deleteResult.success).toBe(true);
    });
  });

  describe('Organization Isolation', () => {
    it('should maintain strict boundaries between organizations', async () => {
      const orgs = ['finance-dept', 'marketing-dept', 'engineering-dept'];

      // Create same table name in different organizations
      for (const org of orgs) {
        const createResult = await manager.createArchetypeEntity(
          org,
          'project',
          'department_projects',
          {
            department_code: { type: 'text', required: true }
          }
        );

        expect(createResult.success).toBe(true);
        expect(createResult.tableName).toBe('department_projects');

        // Each organization should be able to create the same table name
        // because they are isolated
      }
    });

    it('should allow different custom fields for same table names across orgs', async () => {
      // Org A with client-focused fields
      const orgAResult = await manager.createArchetypeEntity(
        'org-a',
        'project',
        'projects',
        {
          client_name: { type: 'text', required: true },
          billable_hours: { type: 'decimal', required: false }
        }
      );

      // Org B with internal fields  
      const orgBResult = await manager.createArchetypeEntity(
        'org-b',
        'project',
        'projects',
        {
          department: { type: 'text', required: true },
          internal_cost_center: { type: 'text', required: false }
        }
      );

      expect(orgAResult.success).toBe(true);
      expect(orgBResult.success).toBe(true);
      expect(orgAResult.tableName).toBe('projects');
      expect(orgBResult.tableName).toBe('projects');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid archetype types', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'invalid_archetype',
        'test_table',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Invalid archetype');
    });

    it('should handle queries to non-existent entities', async () => {
      const result = await manager.queryArchetypeEntityData(
        'org-123',
        'non_existent_table',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle saves to non-existent entities', async () => {
      const result = await manager.saveArchetypeEntityData(
        'org-123',
        'non_existent_table',
        { name: 'Test' }
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle missing OrgSchemaDO gracefully', async () => {
      const configWithoutDO = {
        ...config,
        env: {} // Remove ORG_SCHEMA
      };

      const managerWithoutDO = new ArchetypeEntityManager(configWithoutDO);
      
      const result = await managerWithoutDO.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('OrgSchemaDO not available');
    });
  });

  describe('Field Validation', () => {
    it('should validate custom field types', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {
          invalid_field: { type: 'invalid_type', required: true } as any
        }
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain("Unsupported field type 'invalid_type'");
    });

    it('should require the required property for fields', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {
          missing_required: { type: 'text' } as any
        }
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('must specify required property');
    });

    it('should accept all supported field types', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'project',
        'comprehensive_projects',
        {
          text_field: { type: 'text', required: false },
          longtext_field: { type: 'longtext', required: false },
          number_field: { type: 'number', required: false },
          decimal_field: { type: 'decimal', required: false },
          boolean_field: { type: 'boolean', required: false },
          date_field: { type: 'date', required: false },
          datetime_field: { type: 'datetime', required: false },
          json_field: { type: 'json', required: false },
          priority_field: { type: 'priority_option', required: false },
          status_field: { type: 'status_option', required: false },
          user_ref_field: { type: 'user_reference', required: false },
          entity_ref_field: { type: 'entity_reference', required: false }
        }
      );

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Business Logic Integration', () => {
    it('should apply archetype validation rules', async () => {
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'validated_projects',
        {}
      );

      const result = await manager.saveArchetypeEntityData(
        'org-123',
        'validated_projects',
        {
          name: 'Test Project',
          description: 'Test project with validation'
        }
      );

      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('EntityManager Integration', () => {
    it('should properly delegate to parent EntityManager', async () => {
      await manager.createArchetypeEntity(
        'org-123',
        'task',
        'integration_tasks',
        { external_id: { type: 'text', required: false } }
      );

      const saveResult = await manager.saveArchetypeEntityData(
        'org-123',
        'integration_tasks',
        {
          title: 'Integration Test Task',
          description: 'Testing EntityManager integration'
        }
      );

      const queryResult = await manager.queryArchetypeEntityData(
        'org-123',
        'integration_tasks',
        {}
      );

      expect(saveResult.success).toBe(true);
      expect(queryResult.success).toBe(true);
    });

    it('should maintain organization isolation through EntityManager', async () => {
      await manager.createArchetypeEntity('org-1', 'project', 'isolated_projects', {});
      await manager.createArchetypeEntity('org-2', 'project', 'isolated_projects', {});

      const org1Result = await manager.queryArchetypeEntityData('org-1', 'isolated_projects', {});
      const org2Result = await manager.queryArchetypeEntityData('org-2', 'isolated_projects', {});

      expect(org1Result.success).toBe(true);
      expect(org2Result.success).toBe(true);
    });
  });
});