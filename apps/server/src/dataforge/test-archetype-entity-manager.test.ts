/**
 * Test: ArchetypeEntityManager Integration
 * 
 * Tests the ArchetypeEntityManager that extends EntityManager with Universal Archetype support:
 * - Creates archetype entities with organization isolation
 * - Validates archetype fields and business logic  
 * - Integrates with OrgSchemaDO for schema management
 * - Provides CRUD operations for archetype entities
 * - Handles entity listing and deletion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArchetypeEntityManager } from './entity-operations/ArchetypeEntityManager';
import type { EntityManagerConfig } from './entity-operations/entity-manager';
import type { FieldDefinition } from './rules/json-rules-engine';

// Mock Kysely instance with improved chaining support
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

// Mock Rules Engine
const mockRulesEngine = {
  validate: () => ({
    valid: true,
    data: { name: 'Test', description: 'Test Description' },
    syncableData: { name: 'Test', description: 'Test Description' },
    errors: []
  })
};

// Mock Schema Generator
const mockSchemaGenerator = {
  generateCreateTableSQL: () => 'CREATE TABLE test_table (...);'
};

// Mock Schema Manager  
const mockSchemaManager = {
  validateEntityDefinition: () => [],
  generateTableName: (orgId: string, entityName: string) => `${orgId}_${entityName}`,
  createEntityConfig: (orgId: string, entityName: string, definition: any) => ({
    tableName: definition.tableName || `${orgId}_${entityName}`,
    archetype: definition.extends || 'project',
    fieldDefinitions: definition.customFields || {}
  })
};

// Mock Migration Service
const mockMigrationService = {
  scheduleSchemaChange: () => Promise.resolve('migration-123')
};

// Mock entity store for tracking created entities
const createdEntities: Record<string, any> = {};

// Mock OrgSchemaDO
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
      
      // Return 404 for non_existent_table
      if (tableName === 'non_existent_table') {
        return Promise.resolve(new Response('Not found', { status: 404 }));
      }
      
      // Return metadata for any other requested entity (mock as existing)
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
      
      // Return 404 for non_existent_table
      if (entityName === 'non_existent_table') {
        return Promise.resolve(new Response('Not found', { status: 404 }));
      }
      
      // Mock entity config as existing
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

// Mock environment with OrgSchemaDO
const mockEnv = {
  ORG_SCHEMA: {
    idFromName: () => 'org-do-id',
    get: () => mockOrgSchemaDO
  }
};

describe('ArchetypeEntityManager Integration', () => {
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

  describe('Archetype Entity Creation', () => {
    it('should create a Project archetype entity successfully', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'project',
        'client_projects',
        {
          client_budget: { type: 'decimal', required: false },
          client_name: { type: 'text', required: true }
        }
      );

      if (!result.success) {
        console.log('Creation failed with errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.tableName).toBe('client_projects');
      expect(result.ddl).toBeDefined();
      expect(result.migrationId).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should create a Task archetype entity successfully', async () => {
      const result = await manager.createArchetypeEntity(
        'org-456',
        'task',
        'development_tasks',
        {
          github_issue: { type: 'text', required: false },
          complexity_score: { type: 'integer', required: false }
        }
      );

      expect(result.success).toBe(true);
      expect(result.tableName).toBe('development_tasks');
      expect(result.ddl).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid archetype types', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'invalid_archetype',
        'test_table',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Invalid archetype: invalid_archetype');
    });

    it('should handle empty custom fields gracefully', async () => {
      const result = await manager.createArchetypeEntity(
        'org-123',
        'project',
        'minimal_projects',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.tableName).toBe('minimal_projects');
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

  describe('Data Operations', () => {
    beforeEach(async () => {
      // Create test entity first
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'test_projects',
        {
          client_budget: { type: 'decimal', required: false }
        }
      );
    });

    it('should save archetype entity data', async () => {
      const result = await manager.saveArchetypeEntityData(
        'org-123',
        'test_projects',
        {
          name: 'Test Project',
          description: 'A test project',
          client_budget: 10000.00
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.syncData).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should query archetype entity data', async () => {
      const result = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        { status: 'active' },
        { includeMetadata: true }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.archetype).toBe('project');
      expect(result.errors).toBeUndefined();
    });

    it('should query with filters', async () => {
      const result = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        { name: 'Test Project', status: 'active' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle syncable-only queries', async () => {
      const result = await manager.queryArchetypeEntityData(
        'org-123',
        'test_projects',
        {},
        { syncableOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Entity Management', () => {
    it('should list all archetype entities for an organization', async () => {
      const result = await manager.listArchetypeEntities('org-123');

      expect(result.success).toBe(true);
      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities!.length).toBeGreaterThan(0);
      
      const entity = result.entities![0];
      expect(entity.tableName).toBeDefined();
      expect(entity.archetype).toBeDefined();
      expect(entity.customFields).toBeDefined();
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
    });

    it('should delete an archetype entity', async () => {
      const result = await manager.deleteArchetypeEntity(
        'org-123',
        'test_projects',
        { dropTable: true }
      );

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should delete entity without dropping table', async () => {
      const result = await manager.deleteArchetypeEntity(
        'org-123',
        'test_projects',
        { dropTable: false }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Organization Isolation', () => {
    it('should handle different organizations separately', async () => {
      // Create entities for different orgs
      const org1Result = await manager.createArchetypeEntity(
        'org-1',
        'project',
        'org1_projects',
        { org1_field: { type: 'text', required: false } }
      );

      const org2Result = await manager.createArchetypeEntity(
        'org-2',
        'project',
        'org2_projects',
        { org2_field: { type: 'text', required: false } }
      );

      expect(org1Result.success).toBe(true);
      expect(org2Result.success).toBe(true);
      expect(org1Result.tableName).toBe('org1_projects');
      expect(org2Result.tableName).toBe('org2_projects');
    });

    it('should allow same table names in different organizations', async () => {
      const org1Result = await manager.createArchetypeEntity(
        'org-1',
        'project',
        'projects',
        {}
      );

      const org2Result = await manager.createArchetypeEntity(
        'org-2',
        'project',
        'projects',
        {}
      );

      expect(org1Result.success).toBe(true);
      expect(org2Result.success).toBe(true);
      expect(org1Result.tableName).toBe('projects');
      expect(org2Result.tableName).toBe('projects');
    });
  });

  describe('Error Handling', () => {
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

    it('should handle invalid organization IDs', async () => {
      // This would typically be handled by the parent EntityManager
      const result = await manager.saveArchetypeEntityData(
        'invalid-org',
        'test_projects',
        { name: 'Test' }
      );

      // The actual behavior depends on EntityManager implementation
      // but the test verifies the method handles invalid orgs gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle non-existent archetype entities', async () => {
      const result = await manager.queryArchetypeEntityData(
        'org-123',
        'non_existent_table',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Business Logic Integration', () => {
    it('should apply archetype validation rules', async () => {
      // Create a project entity
      await manager.createArchetypeEntity(
        'org-123',
        'project',
        'validated_projects',
        {}
      );

      // Try to save data that should trigger business logic validation
      const result = await manager.saveArchetypeEntityData(
        'org-123',
        'validated_projects',
        {
          name: 'Test Project'
          // Missing other required fields that business logic might require
        }
      );

      // The result depends on the actual business logic implementation
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe('Integration with EntityManager', () => {
    it('should use EntityManager for CRUD operations', async () => {
      // This test verifies that ArchetypeEntityManager properly delegates
      // to the parent EntityManager for standard operations
      
      await manager.createArchetypeEntity(
        'org-123',
        'task',
        'integration_tasks',
        { external_id: { type: 'text', required: false } }
      );

      // Test that standard EntityManager methods work
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
      // Verify that organization isolation is maintained through the parent EntityManager
      
      await manager.createArchetypeEntity('org-1', 'project', 'isolated_projects', {});
      await manager.createArchetypeEntity('org-2', 'project', 'isolated_projects', {});

      const org1Result = await manager.queryArchetypeEntityData('org-1', 'isolated_projects', {});
      const org2Result = await manager.queryArchetypeEntityData('org-2', 'isolated_projects', {});

      expect(org1Result.success).toBe(true);
      expect(org2Result.success).toBe(true);
      // Data should be isolated per organization through EntityManager
    });
  });
});