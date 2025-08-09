import { test, expect } from '../fixtures/persistent-context.js';

test('check if dexie hooks are initialized', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => {
    console.log('Browser:', msg.text());
  });
  
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  const result = await page.evaluate(async () => {
    console.log('=== CHECKING DEXIE HOOKS ===');
    
    // Import db
    const { db } = await import('/src/domain/index.js');
    console.log('DB imported:', !!db);
    
    // Check if hooks are registered
    const taskTable = db.tasks;
    console.log('Task table exists:', !!taskTable);
    
    // Try to check hook registration (Dexie doesn't expose this directly)
    // So we'll test by creating an entity
    console.log('Testing hook by creating task...');
    
    // First check current change tracking state
    const trackingModule = await import('/src/db/dexie-change-tracking.js');
    console.log('Change tracking module loaded');
    
    // Create a task
    const task = await taskTable.add({
      id: 'hook-test-' + Date.now(),
      title: 'Hook Test Task',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('Task created with ID:', task);
    
    // Wait a bit for async tracking
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check local changes
    const changes = await db.localChanges.toArray();
    console.log('Local changes found:', changes.length);
    changes.forEach(c => {
      console.log('Change:', c.operation, c.table, c.data.id);
    });
    
    return {
      dbExists: !!db,
      tableExists: !!taskTable,
      taskCreated: task,
      changesTracked: changes.length,
      changes: changes.map(c => ({
        operation: c.operation,
        table: c.table,
        id: c.data.id
      }))
    };
  });
  
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  
  // Hooks should track the change
  expect(result.changesTracked).toBeGreaterThan(0);
});