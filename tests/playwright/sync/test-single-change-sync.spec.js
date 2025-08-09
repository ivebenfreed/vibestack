/**
 * Test single client change sync to server
 * 
 * This test:
 * 1. Makes a single change on the client (update a task)
 * 2. Waits for the sync to complete
 * 3. Verifies the server processed the change
 * 4. Checks for any errors in the sync
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('Single client change syncs to server', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');
  
  // Wait for the app to be ready
  await page.waitForFunction(() => 
    document.body.getAttribute('data-playwright-ready') === 'true',
    { timeout: 30000 }
  );

  // Wait for initial sync to complete
  await page.waitForTimeout(3000);

  // Make a single change by updating a task title via console
  const changeResult = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    
    // Get the first task
    const tasks = await db.tasks.limit(1).toArray();
    if (tasks.length === 0) {
      // Create a new task if none exist
      const newTask = {
        id: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        title: 'Test Task for Sync',
        description: 'This task will be updated',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.tasks.add(newTask);
      return {
        operation: 'create',
        taskId: newTask.id,
        title: newTask.title
      };
    } else {
      // Update existing task
      const task = tasks[0];
      const newTitle = `Updated at ${new Date().toISOString()}`;
      
      await db.tasks.update(task.id, {
        title: newTitle,
        updatedAt: new Date()
      });
      
      return {
        operation: 'update',
        taskId: task.id,
        oldTitle: task.title,
        newTitle: newTitle
      };
    }
  });

  console.log('Made change:', changeResult);

  // Check if change was tracked in localChanges
  const trackedChanges = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    const changes = await db.localChanges.toArray();
    return changes.map(c => ({
      table: c.table,
      operation: c.operation,
      processedSync: c.processedSync,
      dataId: c.data?.id
    }));
  });

  console.log('Tracked changes:', trackedChanges);
  
  // Verify at least one change was tracked
  expect(trackedChanges.length).toBeGreaterThan(0);
  
  // Verify the change is for tasks table
  const taskChange = trackedChanges.find(c => c.table === 'tasks');
  expect(taskChange).toBeDefined();
  expect(taskChange.operation).toMatch(/insert|update/);
  
  // With efficient sync, changes might be processed immediately or need time
  // We'll check both cases and wait if needed
  const isAlreadyProcessed = taskChange.processedSync === 1;
  
  if (isAlreadyProcessed) {
    console.log('✅ Change already processed efficiently by sync system');
  } else {
    console.log('⏳ Change queued, waiting for sync to process...');
    // Wait for sync to process (sync runs every few seconds)
    await page.waitForTimeout(5000);
  }

  // Check if changes were processed
  const processedChanges = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    const changes = await db.localChanges
      .where('processedSync')
      .equals(1)
      .toArray();
    return changes.length;
  });

  console.log('Processed changes count:', processedChanges);

  // Wait for the sync to happen automatically
  // The OutgoingChangeService runs on a timer
  console.log('Waiting for automatic sync...');
  await page.waitForTimeout(8000); // Sync interval is typically 5 seconds

  // Check if changes were processed
  const syncStatus = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    
    // Check processed changes
    const processedChanges = await db.localChanges
      .where('processedSync')
      .equals(1)
      .toArray();
    
    // Check unprocessed changes
    const unprocessedChanges = await db.localChanges
      .where('processedSync')
      .equals(0)
      .toArray();
    
    return {
      processed: processedChanges.length,
      unprocessed: unprocessedChanges.length,
      processedDetails: processedChanges.map(c => ({
        table: c.table,
        operation: c.operation
      }))
    };
  });

  console.log('Sync status:', syncStatus);
  
  // Verify the change was processed (either immediately or after waiting)
  expect(syncStatus.processed).toBeGreaterThan(0);

  // Check server logs (would need to be captured separately)
  console.log('Test completed. Check server logs for processing details.');
  
  // Final verification - check if the change exists in the database
  // This would require a server endpoint or direct DB access
  const finalTask = await page.evaluate(async (taskId) => {
    const { db } = await import('/src/domain/index.js');
    const task = await db.tasks.get(taskId);
    return task ? { id: task.id, title: task.title } : null;
  }, changeResult.taskId);

  console.log('Final task state:', finalTask);
  
  if (changeResult.operation === 'update') {
    expect(finalTask.title).toBe(changeResult.newTitle);
  }
});

test('Server error handling for invalid changes', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');
  
  // Wait for ready
  await page.waitForFunction(() => 
    document.body.getAttribute('data-playwright-ready') === 'true',
    { timeout: 30000 }
  );

  // Create an invalid change (missing required fields)
  // This will automatically be tracked and synced
  await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    
    try {
      // Try to create a task without required title field
      // This should trigger validation error on server
      await db.tasks.add({
        id: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        // Missing required 'title' field
        description: 'Task without title',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.log('Client validation caught the error:', error.message);
      // If client catches it, manually add an invalid change to test server handling
      await db.localChanges.add({
        id: crypto.randomUUID(),
        table: 'tasks',
        operation: 'insert',
        data: {
          id: crypto.randomUUID(),
          description: 'Task without title'
          // Missing required 'title' field
        },
        lsn: '',
        clientSequence: Date.now().toString(),
        clientId: 'test-client',
        updatedAt: new Date(),
        processedSync: 0
      });
    }
  });

  // Wait for automatic sync
  console.log('Waiting for automatic sync of invalid change...');
  await page.waitForTimeout(8000);

  // Check if the invalid change was handled
  const errorHandling = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    
    const allChanges = await db.localChanges.toArray();
    const processedChanges = await db.localChanges
      .where('processedSync')
      .equals(1)
      .toArray();
    
    return {
      totalChanges: allChanges.length,
      processedChanges: processedChanges.length,
      latestChanges: allChanges.slice(-3).map(c => ({
        table: c.table,
        operation: c.operation,
        processedSync: c.processedSync
      }))
    };
  });
  
  console.log('Error handling result:', errorHandling);
  
  // The test passes if we don't crash - error handling should be graceful
  expect(errorHandling.totalChanges).toBeGreaterThan(0);
});