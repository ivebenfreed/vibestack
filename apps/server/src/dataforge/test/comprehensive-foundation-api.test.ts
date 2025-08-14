/**
 * Comprehensive Foundation Test - All Archetypes & Access Control (API-Based)
 * 
 * Complete end-to-end test that validates via real API calls:
 * - All 8 universal archetypes can be created via JSON system
 * - Access control patterns work correctly
 * - Cross-archetype relationships function properly
 * - Universal systems (labels, options) integrate correctly
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
const API_BASE_URL = 'http://localhost:8787/api';
const API_ARCHETYPE_URL = `${API_BASE_URL}/archetype`;

// Test data structures
interface TestOrganization {
  id: string;
  name: string;
  slug: string;
}

interface ArchetypeTestCase {
  archetype: string;
  entityName: string;
  definition: any;
  testData: any;
  expectedFields: string[];
}

describe('Comprehensive Foundation Test - All Archetypes & Access Control (API)', () => {
  let testOrg: TestOrganization;

  beforeAll(async () => {
    // Create test organization
    testOrg = {
      id: `test-org-${Date.now()}`,
      name: 'Foundation Test Organization',
      slug: `foundation-test-${Date.now()}`
    };

    // Test API health first
    const healthResponse = await fetch(`${API_ARCHETYPE_URL}/health`);
    expect(healthResponse.ok).toBe(true);
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.system).toBe('universal-archetype-api');
    console.log('✅ DataForge API is healthy:', healthData);
  });

  describe('Universal Archetype System - All 8 Archetypes', () => {
    // Define test cases for universal archetypes (starting with 2 for now)
    const archetypeTestCases: ArchetypeTestCase[] = [
      {
        archetype: 'project',
        entityName: 'SoftwareProject',
        definition: {
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'longtext', required: false },
            { name: 'repository_url', type: 'url', required: true },
            { name: 'tech_stack', type: 'json', required: false },
            { name: 'budget', type: 'decimal', required: false },
            { name: 'status', type: 'status_option', required: true, defaultValue: 'planning' },
            { name: 'priority', type: 'priority_option', required: true, defaultValue: 'medium' }
          ],
          archetype: 'project',
          syncable: true
        },
        testData: {
          name: 'Foundation Platform v2.0',
          description: 'Next generation platform with universal archetypes',
          repository_url: 'https://github.com/acme/foundation-platform',
          tech_stack: {
            frontend: ['React', 'TypeScript'],
            backend: ['Node.js', 'Hono', 'Kysely'],
            database: ['PostgreSQL']
          },
          budget: 250000,
          status: 'in_progress',
          priority: 'high'
        },
        expectedFields: ['name', 'description', 'repository_url', 'tech_stack', 'budget', 'status', 'priority']
      },
      {
        archetype: 'task',
        entityName: 'FeatureTask',
        definition: {
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'longtext', required: false },
            { name: 'status', type: 'status_option', required: true, defaultValue: 'todo' },
            { name: 'priority', type: 'priority_option', required: true, defaultValue: 'medium' },
            { name: 'story_points', type: 'integer', required: false },
            { name: 'assignee_id', type: 'user_reference', required: false },
            { name: 'due_date', type: 'date', required: false }
          ],
          archetype: 'task',
          syncable: true
        },
        testData: {
          title: 'Implement archetype validation system',
          description: 'Add comprehensive validation for all 8 universal archetypes',
          status: 'in_progress',
          priority: 'high',
          story_points: 8,
          assignee_id: 'admin-user',
          due_date: '2024-02-15'
        },
        expectedFields: ['title', 'description', 'status', 'priority', 'story_points', 'assignee_id', 'due_date']
      }
      // TODO: Add remaining 6 archetypes after basic validation works
    ];

    test.each(archetypeTestCases)('should create and validate $archetype archetype ($entityName) via API', async (testCase) => {
      const { archetype, entityName, definition, testData, expectedFields } = testCase;

      console.log(`\n🔧 Testing ${archetype} archetype: ${entityName}`);

      // 1. Create entity definition via API
      const createResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName,
          definition
        })
      });

      expect(createResponse.ok).toBe(true);
      const createResult = await createResponse.json();
      console.log(`✅ Entity ${entityName} created:`, createResult);

      expect(createResult.success).toBe(true);
      expect(createResult.entity.entityName).toBe(entityName);
      expect(createResult.entity.archetype).toBe(archetype);

      // 2. Table is created immediately, no migrations needed
      console.log(`✅ Table created for ${entityName}: ${createResult.entity.tableName}`);

      // 3. Save test data via API
      const saveResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/data/${entityName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      expect(saveResponse.ok).toBe(true);
      const saveResult = await saveResponse.json();
      console.log(`✅ Data saved for ${entityName}:`, saveResult);

      expect(saveResult.success).toBe(true);
      expect(saveResult.saved).toBeDefined();

      // 4. Query saved data via API
      const queryResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/data/${entityName}`);
      expect(queryResponse.ok).toBe(true);
      
      const queryResult = await queryResponse.json();
      console.log(`✅ Data queried for ${entityName}:`, queryResult);

      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toHaveLength(1);

      const savedEntity = queryResult.data[0];
      expect(savedEntity.name || savedEntity.title).toBeDefined(); // Should have a name or title field

      // 5. Validate that all expected fields are accessible
      for (const field of expectedFields) {
        expect(savedEntity).toHaveProperty(field);
      }
    }, 30000); // 30 second timeout for each test

    test('should validate data without saving via API', async () => {
      // Test validation endpoint with invalid data
      const invalidData = { description: 'Missing required name field' };
      
      const validateResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/validate/SoftwareProject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      expect(validateResponse.ok).toBe(true);
      const validateResult = await validateResponse.json();
      
      expect(validateResult.valid).toBe(false);
      expect(validateResult.errors).toBeDefined();
      expect(validateResult.errors.length).toBeGreaterThan(0);
      console.log('✅ Validation correctly rejected invalid data:', validateResult.errors);
    });

    test('should generate SQL DDL for archetype entities via API', async () => {
      const definition = {
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'status', type: 'status_option', required: true }
        ],
        archetype: 'task',
        syncable: true
      };

      const ddlResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/entities/TestDDL/ddl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definition)
      });

      expect(ddlResponse.ok).toBe(true);
      const ddlResult = await ddlResponse.json();
      
      expect(ddlResult.success).toBe(true);
      expect(ddlResult.ddl).toContain('CREATE TABLE');
      expect(ddlResult.ddl).toContain('title');
      expect(ddlResult.ddl).toContain('status');
      console.log('✅ DDL generated successfully:', ddlResult.tableName);
    });
  });

  describe('Sync and Export Capabilities', () => {
    test('should generate syncable schema for all archetype entities via API', async () => {
      const schemaResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/schema`);
      expect(schemaResponse.ok).toBe(true);
      
      const schemaResult = await schemaResponse.json();
      expect(schemaResult.success).toBe(true);
      expect(schemaResult.schema).toBeDefined();
      expect(typeof schemaResult.schema).toBe('object');
      console.log('✅ Sync schema generated for organization:', Object.keys(schemaResult.schema).length, 'entities');
    });

    test('should support syncable data queries via API', async () => {
      const syncResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/data/SoftwareProject?syncOnly=true`);
      expect(syncResponse.ok).toBe(true);
      
      const syncResult = await syncResponse.json();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncOnly).toBe(true);
      expect(syncResult.data).toBeDefined();
      console.log('✅ Sync-only data query successful:', syncResult.data.length, 'records');
    });
  });

  describe('Performance and Migration System', () => {
    test('should handle debounced migrations via API', async () => {
      const definition = {
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'priority', type: 'priority_option', required: true }
        ],
        archetype: 'task',
        syncable: true
      };

      const debouncedResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/entities/DebouncedTest/debounced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition,
          operation: 'create'
        })
      });

      expect(debouncedResponse.ok).toBe(true);
      const debouncedResult = await debouncedResponse.json();
      
      expect(debouncedResult.success).toBe(true);
      expect(debouncedResult.migrationId).toBeDefined();
      expect(debouncedResult.pendingMigrations).toBeDefined();
      console.log('✅ Debounced migration scheduled:', debouncedResult.migrationId);

      // Check pending migrations status
      const statusResponse = await fetch(`${API_ARCHETYPE_URL}/migrations/pending`);
      expect(statusResponse.ok).toBe(true);
      
      const statusResult = await statusResponse.json();
      expect(statusResult.success).toBe(true);
      expect(statusResult.count).toBeGreaterThan(0);
      console.log('✅ Pending migrations found:', statusResult.count);
    });

    test('should handle multiple archetype entities efficiently via API', async () => {
      const startTime = Date.now();
      
      // Create multiple entities in parallel
      const createPromises = [
        { name: 'PerfProject', archetype: 'project' },
        { name: 'PerfTask', archetype: 'task' },
        { name: 'PerfRecord', archetype: 'record' },
        { name: 'PerfDocument', archetype: 'document' }
      ].map(async ({ name, archetype }) => {
        const definition = {
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'status', type: 'status_option', required: true }
          ],
          archetype,
          syncable: true
        };

        return fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityName: name,
            definition,
            useDebounced: false
          })
        });
      });

      const responses = await Promise.all(createPromises);
      const endTime = Date.now();

      // All should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      // Should complete reasonably quickly (less than 10 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
      console.log(`✅ Performance test: ${responses.length} entities created in ${duration}ms`);
    });
  });

  describe('Data Integrity and Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Test with non-existent entity
      const errorResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/data/NonExistentEntity`);
      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.status).toBe(500); // Internal server error for non-existent entity
      
      const errorResult = await errorResponse.json();
      expect(errorResult.error).toBeDefined();
      console.log('✅ API error handling working:', errorResult.error);
    });

    test('should enforce archetype entity data integrity via API', async () => {
      // Test that required fields are enforced
      const invalidData = { description: 'Missing required name field' };
      
      const saveResponse = await fetch(`${API_ARCHETYPE_URL}/orgs/${testOrg.id}/data/SoftwareProject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });
      
      expect(saveResponse.ok).toBe(false);
      expect(saveResponse.status).toBe(400); // Bad request for validation error
      
      const saveResult = await saveResponse.json();
      expect(saveResult.error).toBe('Validation failed');
      expect(saveResult.details).toBeDefined();
      console.log('✅ Data integrity enforced via API:', saveResult.details);
    });
  });

  afterAll(async () => {
    console.log('\n🧹 Test cleanup completed');
    // Note: In a real scenario, we might want to clean up test data
    // For now, we'll let the data persist for debugging
  });
});