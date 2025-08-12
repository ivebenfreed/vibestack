import { test, expect } from '@playwright/test';

test.describe('BaseDomainEntity Container Access Control', () => {
  test('BaseDomainEntity includes container access control fields', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/create-domain-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerType: 'project',
            containerId: '123e4567-e89b-12d3-a456-426614174000',
            archetype: 'task'
          })
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('entity');
    expect(result.entity).toHaveProperty('containerType', 'project');
    expect(result.entity).toHaveProperty('containerId', '123e4567-e89b-12d3-a456-426614174000');
    expect(result.entity).toHaveProperty('archetype', 'task');
  });

  test('BaseDomainEntity computed properties work correctly', async ({ page }) => {
    await page.goto('/');
    
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/test-computed-properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result).toHaveProperty('projectContainer');
    expect(result.projectContainer.isProjectContainer).toBe(true);
    expect(result.projectContainer.isDepartmentContainer).toBe(false);
    
    expect(result).toHaveProperty('userContainer');
    expect(result.userContainer.isUserContainer).toBe(true);
    expect(result.userContainer.isSystemContainer).toBe(false);
  });
});