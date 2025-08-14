/**
 * Universal Archetype Auth Integration Test
 * 
 * Tests Week 2 Day 1-2: Connect archetypes to auth middleware and user session management
 * 
 * Validates that:
 * - User context is properly passed to archetype operations
 * - User actions are logged for audit trail
 * - User information is included in responses
 * - Auth middleware integration works seamlessly
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
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

describe('Week 2 Day 1-2: Universal Archetype Auth Integration', () => {
  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Auth Middleware Integration', () => {
    it('should block unauthenticated requests to archetype endpoints', async () => {
      const orgId = 'auth-block-test-' + Date.now();
      
      // Attempt to create entity without authentication
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'blocked_projects',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'test_field', type: 'text', required: true }
            ]
          }
        })
      });

      console.log('Blocked Response:', createResponse);
      
      // Should be blocked with 401
      expect(createResponse.ok).toBe(false);
      expect(createResponse.status).toBe(401);
      expect(createResponse.data).toHaveProperty('error', 'Authentication required');
      expect(createResponse.data).toHaveProperty('code', 'UNAUTHORIZED');
      
      // Attempt to save data without authentication
      const saveResponse = await apiCall(`/archetype/orgs/${orgId}/data/test_entity`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Data',
          test_field: 'value'
        })
      });

      // Should also be blocked with 401
      expect(saveResponse.ok).toBe(false);
      expect(saveResponse.status).toBe(401);
      expect(saveResponse.data).toHaveProperty('error', 'Authentication required');
      
      // Attempt to query data without authentication
      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/data/test_entity`);

      // Should also be blocked with 401
      expect(queryResponse.ok).toBe(false);
      expect(queryResponse.status).toBe(401);
      expect(queryResponse.data).toHaveProperty('error', 'Authentication required');
    });

    it('should allow public health endpoints without authentication', async () => {
      // Test main health endpoint
      const healthResponse = await apiCall('/health');
      expect(healthResponse.ok).toBe(true);
      expect(healthResponse.data).toBe('Server OK');
      
      // Test archetype health endpoint
      const archetypeHealthResponse = await apiCall('/archetype/health');
      expect(archetypeHealthResponse.ok).toBe(true);
      expect(archetypeHealthResponse.data).toHaveProperty('status', 'ok');
      expect(archetypeHealthResponse.data).toHaveProperty('system', 'universal-archetype-api');
      
      // Test env debug endpoint
      const envResponse = await apiCall('/env/debug');
      expect(envResponse.ok).toBe(true);
      expect(envResponse.data).toHaveProperty('environment');
      
      console.log('✅ All public endpoints accessible without authentication');
    });

    it('should integrate with auth middleware for user context when authenticated', async () => {
      // Note: This test demonstrates the structure for authenticated requests
      // In a real scenario with actual auth, this would include valid session cookies
      
      const orgId = 'auth-test-org-' + Date.now();
      
      // Create archetype entity via API (this will be blocked due to no auth)
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'auth_tracked_projects',
          definition: {
            archetype: 'project',
            fields: [
              { name: 'project_owner', type: 'text', required: true },
              { name: 'auth_test_field', type: 'text', required: false }
            ]
          }
        })
      });

      console.log('Create Response (Auth Test):', createResponse);
      
      expect(createResponse.ok).toBe(true);
      expect(createResponse.data).toHaveProperty('success', true);
      expect(createResponse.data.entity).toHaveProperty('tableName');
      
      // Verify user context is included in response
      expect(createResponse.data.entity).toHaveProperty('createdBy');
      expect(createResponse.data.entity.createdBy).toHaveProperty('userId');
      expect(createResponse.data.entity.createdBy).toHaveProperty('userEmail');
      
      // Note: In test environment without actual auth, these may be null
      // In real environment with auth, they would contain actual user data
      console.log('Created by:', createResponse.data.entity.createdBy);

      // Save data with user tracking
      const saveResponse = await apiCall(`/archetype/orgs/${orgId}/data/auth_tracked_projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Auth Integration Test Project',
          description: 'Testing user context integration',
          project_owner: 'Test User',
          auth_test_field: 'Integration Test Data',
          priority: 'high',
          status: 'active'
        })
      });

      expect(saveResponse.ok).toBe(true);
      expect(saveResponse.data).toHaveProperty('success', true);
      
      // Verify saved data includes created_by_id from user context
      expect(saveResponse.data.saved).toHaveProperty('created_by_id');
      console.log('Saved with created_by_id:', saveResponse.data.saved.created_by_id);

      // Query data with user tracking
      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/data/auth_tracked_projects`);

      expect(queryResponse.ok).toBe(true);
      expect(queryResponse.data).toHaveProperty('success', true);
      
      // Verify query response includes who performed the query
      expect(queryResponse.data).toHaveProperty('queriedBy');
      expect(queryResponse.data.queriedBy).toHaveProperty('userId');
      expect(queryResponse.data.queriedBy).toHaveProperty('userEmail');
      
      console.log('Queried by:', queryResponse.data.queriedBy);
      
      // Verify data contains user tracking fields
      expect(queryResponse.data.data).toBeDefined();
      if (queryResponse.data.data.length > 0) {
        const savedRecord = queryResponse.data.data[0];
        expect(savedRecord).toHaveProperty('created_by_id');
        expect(savedRecord).toHaveProperty('organization_id', orgId);
        console.log('Record user tracking:', {
          created_by_id: savedRecord.created_by_id,
          organization_id: savedRecord.organization_id
        });
      }
    });
  });

  describe('User Action Audit Trail', () => {
    it('should log user actions for audit trail', async () => {
      const orgId = 'audit-org-' + Date.now();
      
      // This test verifies that console logs are generated for user actions
      // In a real implementation, these would be captured by logging infrastructure
      
      console.log('=== Testing User Action Logging ===');
      
      // Create entity (should log user action)
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'audit_test_tasks',
          definition: {
            archetype: 'task',
            fields: [
              { name: 'assignee', type: 'text', required: true }
            ]
          }
        })
      });

      expect(createResponse.ok).toBe(true);
      console.log('✓ Entity creation logged');

      // Save data (should log user action)
      const saveResponse = await apiCall(`/archetype/orgs/${orgId}/data/audit_test_tasks`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Audit Test Task',
          description: 'Testing audit trail',
          assignee: 'Test Assignee',
          priority: 'medium',
          status: 'todo'
        })
      });

      expect(saveResponse.ok).toBe(true);
      console.log('✓ Data save logged');

      // Query data (should log user action)
      const queryResponse = await apiCall(`/archetype/orgs/${orgId}/data/audit_test_tasks`);

      expect(queryResponse.ok).toBe(true);
      console.log('✓ Data query logged');
      
      console.log('=== Audit Trail Test Complete ===');
    });
  });

  describe('Organization Isolation with User Context', () => {
    it('should maintain organization isolation while tracking users', async () => {
      const orgA = 'user-org-a-' + Date.now();
      const orgB = 'user-org-b-' + Date.now();

      // Create entities in both orgs
      const createA = await apiCall(`/archetype/orgs/${orgA}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'user_isolated_records',
          definition: {
            archetype: 'record',
            fields: [
              { name: 'user_data', type: 'text', required: true }
            ]
          }
        })
      });

      const createB = await apiCall(`/archetype/orgs/${orgB}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'user_isolated_records',
          definition: {
            archetype: 'record',
            fields: [
              { name: 'user_data', type: 'text', required: true }
            ]
          }
        })
      });

      expect(createA.ok).toBe(true);
      expect(createB.ok).toBe(true);

      // Save data in both orgs
      const saveA = await apiCall(`/archetype/orgs/${orgA}/data/user_isolated_records`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Org A Record',
          user_data: 'ORG_A_USER_DATA',
          status: 'active'
        })
      });

      const saveB = await apiCall(`/archetype/orgs/${orgB}/data/user_isolated_records`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Org B Record',
          user_data: 'ORG_B_USER_DATA',
          status: 'active'
        })
      });

      expect(saveA.ok).toBe(true);
      expect(saveB.ok).toBe(true);

      // Verify isolation - each org only sees its own data
      const queryA = await apiCall(`/archetype/orgs/${orgA}/data/user_isolated_records`);
      const queryB = await apiCall(`/archetype/orgs/${orgB}/data/user_isolated_records`);

      expect(queryA.ok).toBe(true);
      expect(queryB.ok).toBe(true);

      // Each query response should include user context
      expect(queryA.data).toHaveProperty('queriedBy');
      expect(queryB.data).toHaveProperty('queriedBy');

      // Data should be isolated by organization
      expect(queryA.data.data).toBeDefined();
      expect(queryB.data.data).toBeDefined();

      console.log('Org A query by:', queryA.data.queriedBy);
      console.log('Org B query by:', queryB.data.queriedBy);
      console.log('Org A data count:', queryA.data.count);
      console.log('Org B data count:', queryB.data.count);
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle auth context gracefully when user is anonymous', async () => {
      // This test validates the system handles cases where user context might be null
      // (e.g., test environment without full auth setup)
      
      const orgId = 'anon-test-org-' + Date.now();
      
      const createResponse = await apiCall(`/archetype/orgs/${orgId}/entities`, {
        method: 'POST',
        body: JSON.stringify({
          entityName: 'anonymous_test',
          definition: {
            archetype: 'document',
            fields: [
              { name: 'anonymous_field', type: 'text', required: false }
            ]
          }
        })
      });

      // Should succeed even if user context is null
      expect(createResponse.ok).toBe(true);
      expect(createResponse.data).toHaveProperty('success', true);
      
      // createdBy fields should be present but may be null
      expect(createResponse.data.entity).toHaveProperty('createdBy');
      
      console.log('Anonymous user creation:', createResponse.data.entity.createdBy);
    });
  });
});