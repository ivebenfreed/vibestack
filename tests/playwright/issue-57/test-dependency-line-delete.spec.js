import { test, expect } from '../fixtures/persistent-context.js';
import { createEntity, setupDbHelpers } from '../core/db-test-helpers.js';

test.describe('Dependency line delete button', () => {
  let projectId;
  let task1Id;
  let task2Id;
  
  test.beforeEach(async ({ page }) => {
    // Setup database helpers
    await setupDbHelpers(page);
    
    // Create test project
    const project = await createEntity(page, 'project', {
      name: 'TEST_Dependency_Project',
      description: 'Testing dependency delete button'
    });
    projectId = project.id;
    
    // Create two tasks
    const task1 = await createEntity(page, 'task', {
      projectId,
      title: 'TEST_Task_1',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      status: 'pending'
    });
    task1Id = task1.id;
    
    const task2 = await createEntity(page, 'task', {
      projectId,
      title: 'TEST_Task_2',
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
      status: 'pending'
    });
    task2Id = task2.id;
    
    // Create dependency between tasks
    await createEntity(page, 'taskDependency', {
      sourceTaskId: task1Id,
      targetTaskId: task2Id,
      type: 'finish_start'
    });
  });
  
  test.afterEach(async ({ page }) => {
    // Cleanup test data
    await page.evaluate(() => window.dbHelpers.clearTestData());
  });
  
  test('should remove delete button when dependency line is removed', async ({ page }) => {
    // Navigate to the test project
    await page.goto(`/project/${projectId}`, { waitUntil: 'networkidle' });
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 60000 }
    );
    
    // Wait for Gantt chart to load
    await page.waitForSelector('.vibeGantt', { timeout: 10000 });
    
    // Wait for dependency lines to render
    await page.waitForSelector('.gantt-dependency-line', { timeout: 5000 });
    
    // Find dependency lines
    const dependencyLines = await page.locator('.gantt-dependency-line').all();
    expect(dependencyLines.length).toBeGreaterThan(0);
    
    // Click on the first dependency line
    const firstLine = dependencyLines[0];
    await firstLine.click();
    
    // Wait for delete button to appear
    await page.waitForSelector('.gantt-dependency-delete-button', { timeout: 5000 });
    
    // Verify delete button is visible
    const deleteButton = page.locator('.gantt-dependency-delete-button');
    await expect(deleteButton).toBeVisible();
    
    // Click the delete button
    await deleteButton.click();
    
    // Wait for dependency to be removed
    await page.waitForFunction((count) => {
      const lines = document.querySelectorAll('.gantt-dependency-line');
      return lines.length < count;
    }, dependencyLines.length, { timeout: 5000 });
    
    // Verify delete button is removed
    await expect(deleteButton).not.toBeVisible();
    await expect(page.locator('.gantt-dependency-delete-button')).toHaveCount(0);
  });
  
  test('should show delete button when clicking on dependency line', async ({ page }) => {
    // Navigate to the test project
    await page.goto(`/project/${projectId}`, { waitUntil: 'networkidle' });
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 60000 }
    );
    
    // Wait for Gantt chart to load
    await page.waitForSelector('.vibeGantt', { timeout: 10000 });
    
    // Wait for dependency lines to render
    await page.waitForSelector('.gantt-dependency-line', { timeout: 5000 });
    
    // Find dependency lines
    const dependencyLines = await page.locator('.gantt-dependency-line').all();
    expect(dependencyLines.length).toBeGreaterThan(0);
    
    // Initially no delete button should be visible
    await expect(page.locator('.gantt-dependency-delete-button')).toHaveCount(0);
    
    // Click on the first dependency line
    const firstLine = dependencyLines[0];
    await firstLine.click();
    
    // Wait for delete button to appear
    await page.waitForSelector('.gantt-dependency-delete-button', { timeout: 5000 });
    
    // Verify delete button is visible
    const deleteButton = page.locator('.gantt-dependency-delete-button');
    await expect(deleteButton).toBeVisible();
    
    // Click somewhere else to deselect
    await page.click('.vibeGantt', { position: { x: 10, y: 10 } });
    
    // Delete button should be hidden
    await expect(deleteButton).not.toBeVisible();
  });
  
  test('should handle multiple dependency lines correctly', async ({ page }) => {
    // Create a third task and another dependency
    const task3 = await createEntity(page, 'task', {
      projectId,
      title: 'TEST_Task_3',
      startDate: new Date(Date.now() + 172800000).toISOString(),
      endDate: new Date(Date.now() + 259200000).toISOString(),
      status: 'pending'
    });
    
    await createEntity(page, 'taskDependency', {
      sourceTaskId: task2Id,
      targetTaskId: task3.id,
      type: 'finish_start'
    });
    
    // Navigate to the test project
    await page.goto(`/project/${projectId}`, { waitUntil: 'networkidle' });
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 60000 }
    );
    
    // Wait for Gantt chart to load
    await page.waitForSelector('.vibeGantt', { timeout: 10000 });
    
    // Wait for dependency lines to render
    await page.waitForSelector('.gantt-dependency-line', { timeout: 5000 });
    
    // Should have 2 dependency lines
    const dependencyLines = await page.locator('.gantt-dependency-line').all();
    expect(dependencyLines.length).toBe(2);
    
    // Click first dependency
    await dependencyLines[0].click();
    
    // Should show one delete button
    await page.waitForSelector('.gantt-dependency-delete-button', { timeout: 5000 });
    let deleteButtons = await page.locator('.gantt-dependency-delete-button').all();
    expect(deleteButtons.length).toBe(1);
    
    // Click second dependency
    await dependencyLines[1].click();
    
    // Should still show only one delete button (for the second line now)
    deleteButtons = await page.locator('.gantt-dependency-delete-button').all();
    expect(deleteButtons.length).toBe(1);
    
    // Delete the second dependency
    await page.locator('.gantt-dependency-delete-button').click();
    
    // Should now have 1 dependency line
    await page.waitForFunction(() => {
      const lines = document.querySelectorAll('.gantt-dependency-line');
      return lines.length === 1;
    }, { timeout: 5000 });
    
    // Delete button should be removed
    await expect(page.locator('.gantt-dependency-delete-button')).toHaveCount(0);
  });
});