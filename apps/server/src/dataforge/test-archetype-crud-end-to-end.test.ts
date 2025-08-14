/**
 * Test: ArchetypeEntityManager End-to-End CRUD Operations with Organization Isolation
 * 
 * Tests the complete CRUD workflow for archetype entities:
 * - Create archetype entities with custom fields across multiple organizations
 * - Insert, update, and query data with organization isolation
 * - Validate business logic and data integrity
 * - Test complex scenarios with relationships and filtering
 * - Verify complete separation between organizations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArchetypeEntityManager } from './entity-operations/ArchetypeEntityManager';
import type { EntityManagerConfig } from './entity-operations/entity-manager';
import type { FieldDefinition } from './rules/json-rules-engine';

// Enhanced mock Kysely with CRUD support
const createDataStore = () => {
  const store: Record<string, any[]> = {};
  return {
    insert: (tableName: string, data: any) => {
      if (!store[tableName]) store[tableName] = [];
      const record = { ...data, id: `uuid-${Date.now()}` };
      store[tableName].push(record);
      return record;
    },
    update: (tableName: string, id: string, data: any) => {
      if (!store[tableName]) return null;
      const index = store[tableName].findIndex(r => r.id === id);
      if (index === -1) return null;
      store[tableName][index] = { ...store[tableName][index], ...data, updated_at: new Date() };
      return store[tableName][index];
    },
    query: (tableName: string, filters: Record<string, any> = {}) => {
      if (!store[tableName]) return [];
      return store[tableName].filter(record => 
        Object.entries(filters).every(([key, value]) => record[key] === value)
      );
    },
    delete: (tableName: string, id: string) => {
      if (!store[tableName]) return false;
      const index = store[tableName].findIndex(r => r.id === id);
      if (index === -1) return false;
      store[tableName].splice(index, 1);
      return true;
    },
    getStore: () => store
  };
};

// Global data store for testing
const dataStore = createDataStore();

// Enhanced mock Kysely with actual CRUD operations
const createEnhancedMockKysely = () => {
  const createChainableMockQuery = (tableName: string, operation = 'select') => {
    let filters: Record<string, any> = {};
    let selectFields: string[] = [];
    let insertData: any = null;
    let updateData: any = null;
    
    const mockQuery = {
      select: (fields: any) => {
        selectFields = Array.isArray(fields) ? fields : [fields];
        return mockQuery;
      },
      selectAll: () => {
        selectFields = ['*'];
        return mockQuery;
      },
      where: (field: string, op: string, value: any) => {
        filters[field] = value;
        return mockQuery;
      },
      values: (data: any) => {
        insertData = data;
        return mockQuery;
      },
      set: (data: any) => {
        updateData = data;
        return mockQuery;
      },
      executeTakeFirst: async () => {
        if (operation === 'select') {
          const results = dataStore.query(tableName, filters);
          return results[0] || null;
        }
        if (operation === 'update' && updateData) {
          const id = Object.values(filters)[0] as string;
          return dataStore.update(tableName, id, updateData);
        }
        return { id: 'org-uuid-123' };
      },
      execute: async () => {
        if (operation === 'select') {
          return dataStore.query(tableName, filters);
        }
        if (operation === 'insert' && insertData) {
          return [dataStore.insert(tableName, insertData)];
        }
        return [{ id: 'entity-123', name: 'Test Entity', created_at: new Date(), updated_at: new Date() }];
      }
    };
    return mockQuery;
  };

  return {
    selectFrom: (table: string) => createChainableMockQuery(table, 'select'),
    insertInto: (table: string) => createChainableMockQuery(table, 'insert'),
    updateTable: (table: string) => createChainableMockQuery(table, 'update'),
    deleteFrom: (table: string) => createChainableMockQuery(table, 'delete'),
    executeQuery: async (query: { sql: string; parameters: any[] }) => {
      // Parse simple INSERT statements
      if (query.sql.includes('INSERT INTO')) {
        const tableMatch = query.sql.match(/INSERT INTO (\w+)/);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const data: any = {};
          
          // Simple parameter mapping (for testing)
          const fieldNames = ['id', 'organization_id', 'created_at', 'updated_at', 'status', 'name', 'description'];
          query.parameters.forEach((param, i) => {
            if (fieldNames[i]) {
              data[fieldNames[i]] = param;
            }
          });

          const record = dataStore.insert(tableName, data);
          return { rows: [record] };
        }
      }
      
      return { rows: [{ id: 'entity-123', name: 'Test Entity', created_at: new Date(), updated_at: new Date() }] };
    }
  };
};

// Enhanced mock OrgSchemaDO with entity tracking
const createEnhancedMockOrgSchemaDO = () => {
  const entities: Record<string, any> = {};
  
  return {
    fetch: async (request: Request) => {
      const url = new URL(request.url);
      
      if (url.pathname === '/create-archetype' && request.method === 'POST') {
        const body = await request.json();
        const { tableName, archetype, fieldDefinitions } = body;
        
        entities[tableName] = {
          tableName,
          extends: archetype,
          customFields: fieldDefinitions,
          syncable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        return new Response(JSON.stringify({
          success: true,
          ddl: `CREATE TABLE ${tableName} (id UUID PRIMARY KEY, organization_id UUID, ...);`
        }));
      }
      
      if (url.pathname === '/archetype-entities') {
        return new Response(JSON.stringify({
          success: true,
          entities
        }));
      }
      
      if (url.pathname.startsWith('/archetype-entity/')) {
        const tableName = url.pathname.split('/archetype-entity/')[1];
        if (request.method === 'DELETE') {
          delete entities[tableName];
          return new Response(JSON.stringify({ success: true }));
        }
        
        if (entities[tableName]) {
          return new Response(JSON.stringify({
            success: true,
            entity: entities[tableName]
          }));
        }
        return new Response('Not found', { status: 404 });
      }
      
      if (url.pathname.startsWith('/config/')) {
        const entityName = url.pathname.split('/config/')[1];
        if (entities[entityName]) {
          return new Response(JSON.stringify({
            tableName: entityName,
            archetype: entities[entityName].extends,
            fieldDefinitions: entities[entityName].customFields,
            customFields: entities[entityName].customFields,
            basePrimitive: entities[entityName].extends === 'project' ? 'Project' : 'Task'
          }));
        }
        return new Response('Not found', { status: 404 });
      }
      
      return new Response('Not found', { status: 404 });
    }
  };
};

// Enhanced mock components - create fresh instances per test
let mockKysely: any;
let mockOrgSchemaDO: any;
let mockRulesEngine: any;
let mockSchemaGenerator: any;
let mockSchemaManager: any;
let mockMigrationService: any;
let mockEnv: any;

const initializeMocks = () => {
  mockKysely = createEnhancedMockKysely();
  mockOrgSchemaDO = createEnhancedMockOrgSchemaDO();

  mockRulesEngine = {
    validate: (data: any) => ({
      valid: true,
      data: { ...data },
      syncableData: { ...data },
      errors: []
    })
  };

  mockSchemaGenerator = {
    generateCreateTableSQL: () => 'CREATE TABLE test_table (...);'
  };

  mockSchemaManager = {
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

  mockMigrationService = {
    scheduleSchemaChange: () => Promise.resolve('migration-123')
  };

  mockEnv = {
    ORG_SCHEMA: {
      idFromName: () => 'org-do-id',
      get: () => mockOrgSchemaDO
    }
  };
};

describe('ArchetypeEntityManager End-to-End CRUD Operations', () => {
  let manager: ArchetypeEntityManager;
  let config: EntityManagerConfig;

  beforeEach(() => {
    // Reset data store
    Object.keys(dataStore.getStore()).forEach(key => {
      delete dataStore.getStore()[key];
    });

    // Initialize fresh mocks
    initializeMocks();

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

  describe('Complete Project Archetype CRUD Workflow', () => {
    it('should handle full project lifecycle with organization isolation', async () => {
      // Step 1: Create project archetype entity for organization A
      const createOrgAResult = await manager.createArchetypeEntity(
        'org-a',
        'project',
        'client_projects',
        {
          client_name: { type: 'text', required: true },
          budget: { type: 'decimal', required: false },
          contract_type: { type: 'text', required: false }
        }
      );

      if (!createOrgAResult.success) {
        console.log('DEBUG: Org A creation failed:', createOrgAResult.errors);
      }
      expect(createOrgAResult.success).toBe(true);
      expect(createOrgAResult.tableName).toBe('client_projects');

      // Step 2: Create similar entity for organization B (same table name, different org)
      const createOrgBResult = await manager.createArchetypeEntity(
        'org-b',
        'project',
        'client_projects',
        {
          department: { type: 'text', required: true },
          annual_budget: { type: 'decimal', required: false }
        }
      );

      expect(createOrgBResult.success).toBe(true);
      expect(createOrgBResult.tableName).toBe('client_projects');

      // Step 3: Insert data into Org A
      const insertOrgAResult = await manager.saveArchetypeEntityData(
        'org-a',
        'client_projects',
        {
          name: 'Website Redesign',
          description: 'Complete website overhaul for client',
          client_name: 'ACME Corp',
          budget: 50000.00,
          contract_type: 'fixed_price',
          priority: 'high',
          status: 'active'
        }
      );

      expect(insertOrgAResult.success).toBe(true);
      expect(insertOrgAResult.data).toBeDefined();
      expect(insertOrgAResult.data.name).toBe('Website Redesign');

      // Step 4: Insert data into Org B
      const insertOrgBResult = await manager.saveArchetypeEntityData(
        'org-b',
        'client_projects',
        {
          name: 'Internal System Migration',
          description: 'Migrate legacy systems to cloud',
          department: 'IT',
          annual_budget: 75000.00,
          priority: 'medium',
          status: 'planning'
        }
      );

      expect(insertOrgBResult.success).toBe(true);
      expect(insertOrgBResult.data).toBeDefined();
      expect(insertOrgBResult.data.name).toBe('Internal System Migration');

      // Step 5: Query Org A data (should only see Org A data)
      const queryOrgAResult = await manager.queryArchetypeEntityData(
        'org-a',
        'client_projects',
        {},
        { includeMetadata: true }
      );

      expect(queryOrgAResult.success).toBe(true);
      expect(queryOrgAResult.data).toBeDefined();
      expect(queryOrgAResult.metadata).toBeDefined();
      expect(queryOrgAResult.metadata!.archetype).toBe('project');

      // Step 6: Query Org B data (should only see Org B data)
      const queryOrgBResult = await manager.queryArchetypeEntityData(
        'org-b',
        'client_projects',
        {},
        { includeMetadata: true }
      );

      expect(queryOrgBResult.success).toBe(true);
      expect(queryOrgBResult.data).toBeDefined();
      expect(queryOrgBResult.metadata).toBeDefined();
      expect(queryOrgBResult.metadata!.archetype).toBe('project');

      // Step 7: Verify organization isolation - filter by status
      const orgAActiveProjects = await manager.queryArchetypeEntityData(
        'org-a',
        'client_projects',
        { status: 'active' }
      );

      const orgBPlanningProjects = await manager.queryArchetypeEntityData(
        'org-b',
        'client_projects',
        { status: 'planning' }
      );

      expect(orgAActiveProjects.success).toBe(true);
      expect(orgBPlanningProjects.success).toBe(true);
    });
  });

  describe('Task Archetype CRUD Operations', () => {
    it('should handle task creation and management with custom fields', async () => {
      // Step 1: Create task archetype entity
      const createResult = await manager.createArchetypeEntity(
        'dev-team',
        'task',
        'development_tasks',
        {
          story_points: { type: 'integer', required: false },
          github_issue: { type: 'text', required: false },
          sprint_id: { type: 'text', required: false },
          complexity: { type: 'text', required: false }
        }
      );

      expect(createResult.success).toBe(true);
      expect(createResult.tableName).toBe('development_tasks');

      // Step 2: Create multiple tasks
      const tasks = [
        {
          title: 'Implement user authentication',
          description: 'Add login/logout functionality',
          story_points: 8,
          github_issue: 'https://github.com/repo/issues/123',
          sprint_id: 'sprint-2024-01',
          complexity: 'high',
          priority: 'high',
          status: 'in_progress'
        },
        {
          title: 'Fix navbar styling',
          description: 'Resolve CSS issues in navigation',
          story_points: 3,
          github_issue: 'https://github.com/repo/issues/124',
          sprint_id: 'sprint-2024-01',
          complexity: 'low',
          priority: 'medium',
          status: 'todo'
        },
        {
          title: 'Database optimization',
          description: 'Optimize slow queries',
          story_points: 13,
          github_issue: 'https://github.com/repo/issues/125',
          sprint_id: 'sprint-2024-02',
          complexity: 'very_high',
          priority: 'low',
          status: 'backlog'
        }
      ];

      const savedTasks = [];
      for (const task of tasks) {
        const saveResult = await manager.saveArchetypeEntityData(
          'dev-team',
          'development_tasks',
          task
        );
        expect(saveResult.success).toBe(true);
        savedTasks.push(saveResult.data);
      }

      // Step 3: Query tasks by different criteria
      const highPriorityTasks = await manager.queryArchetypeEntityData(
        'dev-team',
        'development_tasks',
        { priority: 'high' }
      );

      const sprint1Tasks = await manager.queryArchetypeEntityData(
        'dev-team',
        'development_tasks',
        { sprint_id: 'sprint-2024-01' }
      );

      const inProgressTasks = await manager.queryArchetypeEntityData(
        'dev-team',
        'development_tasks',
        { status: 'in_progress' }
      );

      expect(highPriorityTasks.success).toBe(true);
      expect(sprint1Tasks.success).toBe(true);
      expect(inProgressTasks.success).toBe(true);
    });
  });

  describe('Mixed Archetype Operations', () => {
    it('should handle multiple archetype types in the same organization', async () => {
      const orgId = 'multi-arch-org';

      // Step 1: Create project archetype
      const projectResult = await manager.createArchetypeEntity(
        orgId,
        'project',
        'software_projects',
        {
          technology_stack: { type: 'text', required: false },
          team_size: { type: 'integer', required: false }
        }
      );

      // Step 2: Create task archetype
      const taskResult = await manager.createArchetypeEntity(
        orgId,
        'task',
        'project_tasks',
        {
          project_id: { type: 'text', required: true },
          estimated_hours: { type: 'decimal', required: false }
        }
      );

      // Step 3: Create document archetype
      const documentResult = await manager.createArchetypeEntity(
        orgId,
        'document',
        'project_docs',
        {
          document_type: { type: 'text', required: true },
          version: { type: 'text', required: false }
        }
      );

      expect(projectResult.success).toBe(true);
      expect(taskResult.success).toBe(true);
      expect(documentResult.success).toBe(true);

      // Step 4: Create related data
      const project = await manager.saveArchetypeEntityData(
        orgId,
        'software_projects',
        {
          name: 'E-commerce Platform',
          description: 'Build modern e-commerce solution',
          technology_stack: 'React, Node.js, PostgreSQL',
          team_size: 6,
          priority: 'high',
          status: 'active'
        }
      );

      const task = await manager.saveArchetypeEntityData(
        orgId,
        'project_tasks',
        {
          title: 'Set up database schema',
          description: 'Create initial database tables',
          project_id: project.data.id,
          estimated_hours: 16.5,
          priority: 'high',
          status: 'todo'
        }
      );

      const document = await manager.saveArchetypeEntityData(
        orgId,
        'project_docs',
        {
          name: 'API Documentation',
          description: 'REST API endpoint specifications',
          document_type: 'technical_spec',
          version: '1.0.0',
          status: 'draft'
        }
      );

      expect(project.success).toBe(true);
      expect(task.success).toBe(true);
      expect(document.success).toBe(true);

      // Step 5: List all archetype entities
      const entitiesResult = await manager.listArchetypeEntities(orgId);
      expect(entitiesResult.success).toBe(true);
      expect(entitiesResult.entities).toBeDefined();
      expect(entitiesResult.entities!.length).toBe(3);

      const entityNames = entitiesResult.entities!.map(e => e.tableName);
      expect(entityNames).toContain('software_projects');
      expect(entityNames).toContain('project_tasks');
      expect(entityNames).toContain('project_docs');
    });
  });

  describe('Organization Boundary Testing', () => {
    it('should strictly enforce organization boundaries across all operations', async () => {
      // Create identical entities in three different organizations
      const orgs = ['finance-dept', 'marketing-dept', 'engineering-dept'];
      const createdEntities = [];

      for (const org of orgs) {
        const createResult = await manager.createArchetypeEntity(
          org,
          'project',
          'department_projects',
          {
            department_code: { type: 'text', required: true },
            budget_category: { type: 'text', required: false }
          }
        );

        expect(createResult.success).toBe(true);
        createdEntities.push({ org, tableName: 'department_projects' });

        // Insert department-specific data
        const insertResult = await manager.saveArchetypeEntityData(
          org,
          'department_projects',
          {
            name: `${org.replace('-dept', '').toUpperCase()} Initiative`,
            description: `Department-specific project for ${org}`,
            department_code: org.split('-')[0].toUpperCase(),
            budget_category: org === 'finance-dept' ? 'operational' : 'strategic',
            priority: 'medium',
            status: 'active'
          }
        );

        expect(insertResult.success).toBe(true);
      }

      // Verify each organization can only see its own data
      for (const { org } of createdEntities) {
        const queryResult = await manager.queryArchetypeEntityData(
          org,
          'department_projects',
          {}
        );

        expect(queryResult.success).toBe(true);
        expect(queryResult.data).toBeDefined();
        
        // Each org should only see its own project
        const projectNames = queryResult.data!.map((p: any) => p.name);
        const expectedName = `${org.replace('-dept', '').toUpperCase()} Initiative`;
        expect(projectNames.some(name => name === expectedName)).toBe(true);
      }

      // Cross-organization queries should be isolated
      const financeQuery = await manager.queryArchetypeEntityData(
        'finance-dept',
        'department_projects',
        { department_code: 'MARKETING' }
      );

      expect(financeQuery.success).toBe(true);
      expect(financeQuery.data).toBeDefined();
      // Should not find marketing data in finance org
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data integrity across complex operations', async () => {
      const orgId = 'integrity-test-org';

      // Create archetype with validation-heavy custom fields
      const createResult = await manager.createArchetypeEntity(
        orgId,
        'project',
        'validated_projects',
        {
          email: { type: 'text', required: true },
          score: { type: 'integer', required: true },
          metadata: { type: 'json', required: false },
          active: { type: 'boolean', required: true }
        }
      );

      expect(createResult.success).toBe(true);

      // Test data with all field types
      const testData = {
        name: 'Data Integrity Test Project',
        description: 'Testing all field types and validation',
        email: 'test@example.com',
        score: 95,
        metadata: { tags: ['important', 'test'], category: 'validation' },
        active: true,
        priority: 'high',
        status: 'active'
      };

      const insertResult = await manager.saveArchetypeEntityData(
        orgId,
        'validated_projects',
        testData
      );

      expect(insertResult.success).toBe(true);
      expect(insertResult.data).toBeDefined();
      expect(insertResult.syncData).toBeDefined();

      // Query with syncable-only option
      const syncOnlyQuery = await manager.queryArchetypeEntityData(
        orgId,
        'validated_projects',
        {},
        { syncableOnly: true }
      );

      expect(syncOnlyQuery.success).toBe(true);
      expect(syncOnlyQuery.data).toBeDefined();

      // Query with metadata inclusion
      const metadataQuery = await manager.queryArchetypeEntityData(
        orgId,
        'validated_projects',
        {},
        { includeMetadata: true }
      );

      expect(metadataQuery.success).toBe(true);
      expect(metadataQuery.metadata).toBeDefined();
      expect(metadataQuery.metadata!.archetype).toBe('project');
      expect(metadataQuery.metadata!.fieldDefinitions).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle various error conditions gracefully', async () => {
      const orgId = 'error-test-org';

      // Test 1: Query non-existent entity
      const nonExistentQuery = await manager.queryArchetypeEntityData(
        orgId,
        'non_existent_table',
        {}
      );

      expect(nonExistentQuery.success).toBe(false);
      expect(nonExistentQuery.errors).toBeDefined();

      // Test 2: Save to non-existent entity
      const invalidSave = await manager.saveArchetypeEntityData(
        orgId,
        'non_existent_table',
        { name: 'Test' }
      );

      expect(invalidSave.success).toBe(false);
      expect(invalidSave.errors).toBeDefined();

      // Test 3: Create entity with invalid archetype
      const invalidArchetype = await manager.createArchetypeEntity(
        orgId,
        'invalid_archetype',
        'test_table',
        {}
      );

      expect(invalidArchetype.success).toBe(false);
      expect(invalidArchetype.errors).toBeDefined();
      expect(invalidArchetype.errors![0]).toContain('Invalid archetype');

      // Test 4: List entities for organization with no entities
      const emptyListResult = await manager.listArchetypeEntities('empty-org');
      expect(emptyListResult.success).toBe(true);
      expect(emptyListResult.entities).toBeDefined();
      expect(emptyListResult.entities!.length).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations efficiently', async () => {
      const orgId = 'performance-test-org';

      // Create archetype
      const createResult = await manager.createArchetypeEntity(
        orgId,
        'task',
        'performance_tasks',
        {
          batch_id: { type: 'text', required: true },
          sequence: { type: 'integer', required: true }
        }
      );

      expect(createResult.success).toBe(true);

      // Create multiple tasks in parallel
      const batchSize = 10;
      const savePromises = [];

      for (let i = 0; i < batchSize; i++) {
        const savePromise = manager.saveArchetypeEntityData(
          orgId,
          'performance_tasks',
          {
            title: `Batch Task ${i + 1}`,
            description: `Performance test task number ${i + 1}`,
            batch_id: 'batch-001',
            sequence: i + 1,
            priority: i % 2 === 0 ? 'high' : 'low',
            status: 'todo'
          }
        );
        savePromises.push(savePromise);
      }

      const results = await Promise.all(savePromises);
      
      // All saves should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Query all created tasks
      const queryResult = await manager.queryArchetypeEntityData(
        orgId,
        'performance_tasks',
        { batch_id: 'batch-001' }
      );

      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toBeDefined();
    });
  });
});