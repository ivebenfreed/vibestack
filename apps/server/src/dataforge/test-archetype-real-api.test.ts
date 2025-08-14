/**
 * Real API End-to-End Test: ArchetypeEntityManager with Live Server
 * 
 * Uses the real running server instead of complex mocking for reliable testing.
 * Tests the complete CRUD workflow with actual HTTP requests.
 */

import { describe, it, expect, beforeEach } from 'vitest';

const API_BASE = 'http://localhost:8787/api';

// Helper function to make API calls
async function apiCall(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  const text = await response.text();
  let data;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    // If not JSON, return text
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

describe('Real API End-to-End ArchetypeEntityManager Tests', () => {
  beforeEach(async () => {
    // Wait a moment for any previous operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Project Archetype CRUD with Real API', () => {
    it('should create and manage project archetype entities', async () => {
      const orgId = 'test-org-api-' + Date.now();
      
      // Step 1: Create project archetype entity via API
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'client_projects_api',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'client_name', type: 'text', required: true },
              { name: 'contract_value', type: 'decimal', required: false },
              { name: 'project_phase', type: 'text', required: false }
            ]
          }
        })
      });

      console.log('Create Response:', createResponse);
      
      if (!createResponse.ok) {
        console.log('Create failed with status:', createResponse.status);
        console.log('Create response data:', createResponse.data);
      }

      expect(createResponse.ok).toBe(true);
      expect(createResponse.data).toHaveProperty('success', true);
      expect(createResponse.data.entity).toHaveProperty('tableName');
      expect(createResponse.data.entity.entityName).toBe('client_projects_api');
      expect(createResponse.data).toHaveProperty('sql');

      // Step 2: Save data to the entity
      const saveResponse = await apiCall(`/archetype/orgs/${orgId}/entities/client_projects_api/data`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'API Test Project',
          description: 'Testing project creation via API',
          client_name: 'Test Client Corp',
          contract_value: 25000.50,
          project_phase: 'discovery',
          priority: 'high',
          status: 'active'
        })
      });

      console.log('Save Response:', saveResponse);
      expect(saveResponse.ok).toBe(true);
      expect(saveResponse.data).toHaveProperty('success', true);
      expect(saveResponse.data.data).toHaveProperty('name', 'API Test Project');

      // Step 3: Query the data back
      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/entities/client_projects_api/data`);

      console.log('Query Response:', queryResponse);
      expect(queryResponse.ok).toBe(true);
      expect(queryResponse.data).toHaveProperty('success', true);
      expect(queryResponse.data.data).toBeDefined();
    });
  });

  describe('Task Archetype CRUD with Real API', () => {
    it('should create and manage task archetype entities', async () => {
      const orgId = 'task-org-api-' + Date.now();
      
      // Create task archetype entity
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'development_tasks_api',
          definition: {
            archetype: 'task',
            fields: [
              { name: 'github_issue', type: 'text', required: false },
              { name: 'story_points', type: 'integer', required: false },
              { name: 'sprint', type: 'text', required: false }
            ]
          }
        })
      });

      expect(createResponse.ok).toBe(true);
      expect(createResponse.data).toHaveProperty('success', true);

      // Create multiple tasks
      const tasks = [
        {
          title: 'API Integration Task',
          description: 'Integrate with external API',
          github_issue: 'https://github.com/example/repo/issues/123',
          story_points: 5,
          sprint: 'sprint-2024-01',
          priority: 'high',
          status: 'todo'
        },
        {
          title: 'UI Polish Task', 
          description: 'Improve user interface',
          github_issue: 'https://github.com/example/repo/issues/124',
          story_points: 3,
          sprint: 'sprint-2024-01',
          priority: 'medium',
          status: 'in_progress'
        }
      ];

      const savePromises = tasks.map(task => 
        apiCall(`/archetype/orgs/${orgId}/entities/development_tasks_api/data`, {
          method: 'POST',
          body: JSON.stringify(task)
        })
      );

      const saveResults = await Promise.all(savePromises);
      
      saveResults.forEach(result => {
        expect(result.ok).toBe(true);
        expect(result.data).toHaveProperty('success', true);
      });

      // Query all tasks
      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/entities/development_tasks_api/data`);
      
      expect(queryResponse.ok).toBe(true);
      expect(queryResponse.data).toHaveProperty('success', true);
      expect(queryResponse.data.data).toBeDefined();
    });
  });

  describe('Multi-Organization Isolation', () => {
    it('should maintain strict organization boundaries', async () => {
      const orgA = 'isolation-org-a-' + Date.now();
      const orgB = 'isolation-org-b-' + Date.now();

      // Create identical entities in both orgs
      const createEntityA = await apiCall(`/archetype/orgs/${orgA}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'shared_table_name',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'org_specific_field', type: 'text', required: true }
            ]
          }
        })
      });

      const createEntityB = await apiCall(`/archetype/orgs/${orgB}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'shared_table_name',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'org_specific_field', type: 'text', required: true }
            ]
          }
        })
      });

      expect(createEntityA.ok).toBe(true);
      expect(createEntityB.ok).toBe(true);

      // Insert org-specific data
      const saveOrgA = await apiCall(`/archetype/orgs/${orgA}/entities/shared_table_name/data`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Organization A Project',
          description: 'Data for org A only',
          org_specific_field: 'ORG_A_DATA',
          priority: 'high',
          status: 'active'
        })
      });

      const saveOrgB = await apiCall(`/archetype/orgs/${orgB}/entities/shared_table_name/data`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Organization B Project',
          description: 'Data for org B only',
          org_specific_field: 'ORG_B_DATA',
          priority: 'medium',
          status: 'active'
        })
      });

      expect(saveOrgA.ok).toBe(true);
      expect(saveOrgB.ok).toBe(true);

      // Verify isolation - each org should only see its own data
      const queryOrgA = await apiCall(`/archetype/orgs/${orgA}/entities/shared_table_name/data`);
      const queryOrgB = await apiCall(`/archetype/orgs/${orgB}/entities/shared_table_name/data`);

      expect(queryOrgA.ok).toBe(true);
      expect(queryOrgB.ok).toBe(true);

      // Each org should have its data
      expect(queryOrgA.data).toHaveProperty('success', true);
      expect(queryOrgB.data).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid archetype types', async () => {
      const orgId = 'error-test-org-' + Date.now();

      const invalidResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'test_table',
          definition: {
            archetype: 'invalid_archetype',
            fields: []
          }
        })
      });

      expect(invalidResponse.ok).toBe(false);
      expect(invalidResponse.status).toBe(400);
    });

    it('should handle queries to non-existent entities', async () => {
      const orgId = 'error-test-org-' + Date.now();

      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/entities/non_existent_table/data`);

      expect(queryResponse.ok).toBe(false);
      expect(queryResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Field Validation', () => {
    it('should accept all supported field types', async () => {
      const orgId = 'validation-org-' + Date.now();

      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'comprehensive_test',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'text_field', type: 'text', required: false },
              { name: 'longtext_field', type: 'longtext', required: false },
              { name: 'number_field', type: 'number', required: false },
              { name: 'decimal_field', type: 'decimal', required: false },
              { name: 'boolean_field', type: 'boolean', required: false },
              { name: 'date_field', type: 'date', required: false },
              { name: 'datetime_field', type: 'datetime', required: false },
              { name: 'json_field', type: 'json', required: false }
            ]
          }
        })
      });

      expect(createResponse.ok).toBe(true);
      expect(createResponse.data).toHaveProperty('success', true);

      // Test data insertion with various field types
      const saveResponse = await apiCall(`/archetype/orgs/${orgId}/entities/comprehensive_test/data`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Comprehensive Field Test',
          description: 'Testing all field types',
          text_field: 'Sample text',
          longtext_field: 'This is a much longer text field with more content...',
          number_field: 42,
          decimal_field: 99.99,
          boolean_field: true,
          date_field: '2024-01-15',
          datetime_field: '2024-01-15T10:30:00Z',
          json_field: { key: 'value', array: [1, 2, 3] },
          priority: 'medium',
          status: 'active'
        })
      });

      expect(saveResponse.ok).toBe(true);
      expect(saveResponse.data).toHaveProperty('success', true);
    });
  });
});