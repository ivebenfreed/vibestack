import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Organization Infrastructure', () => {
  test('Organization entity creation and validation', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Organization',
            slug: 'test-org',
            domain: 'test.com',
            planType: 'pro'
          })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('organization');
    expect(result.organization).toHaveProperty('name', 'Test Organization');
    expect(result.organization).toHaveProperty('slug', 'test-org');
    expect(result.organization).toHaveProperty('domain', 'test.com');
    expect(result.organization).toHaveProperty('planType', 'pro');
    expect(result.organization).toHaveProperty('status', 'active');
  });

  test('OrganizationMember relationship and roles', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-organization-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'admin',
            status: 'active'
          })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('member');
    expect(result.member).toHaveProperty('role', 'admin');
    expect(result.member).toHaveProperty('status', 'active');
    expect(result.member).toHaveProperty('organization');
    expect(result.member).toHaveProperty('user');
  });

  test('DatabaseInstance creation with environment awareness', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-database-instance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: 'local',
            schemaPrefix: 'org_test_'
          })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('database');
    expect(result.database).toHaveProperty('environment', 'local');
    expect(result.database).toHaveProperty('schemaPrefix', 'org_test_');
    expect(result.database).toHaveProperty('status', 'provisioning');
  });

  test('ContainerPermission access control', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-container-permission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerType: 'project',
            containerId: '123e4567-e89b-12d3-a456-426614174000',
            role: 'member'
          })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('permission');
    expect(result.permission).toHaveProperty('permissionContainerType', 'project');
    expect(result.permission).toHaveProperty('permissionContainerId', '123e4567-e89b-12d3-a456-426614174000');
    expect(result.permission).toHaveProperty('role', 'member');
  });
});