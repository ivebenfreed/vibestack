import { test, expect } from '../fixtures/persistent-context.js';

test('debug client change tracking', async ({ page }) => {
  await page.goto('/');
  
  // Wait for app to load
  await page.waitForTimeout(3000);
  
  // Check if hooks are initialized
  const hookStatus = await page.evaluate(async () => {
    // Check if change tracking is enabled
    const { db } = await import('/src/domain/index.js');
    
    // Create a test task directly
    console.log('Creating test task...');
    const task = await db.tasks.add({
      id: 'test-' + Date.now(),
      title: 'Test Task',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('Task created:', task);
    
    // Check local changes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const changes = await db.localChanges.toArray();
    console.log('Local changes after create:', changes);
    
    return {
      taskCreated: task,
      changesCount: changes.length,
      changes: changes
    };
  });
  
  console.log('Hook status:', hookStatus);
  expect(hookStatus.changesCount).toBeGreaterThan(0);
});
