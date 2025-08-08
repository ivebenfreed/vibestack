/**
 * Verify that hooks are actually working despite sync being stuck
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify hooks are tracking changes despite sync issues', async ({ page }) => {
  console.log('[Test] Testing if hooks work even with sync stuck');
  
  // Navigate to app and wait for partial load
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Give it time to initialize
  
  // Test 1: Create a task directly through Dexie
  const createResult = await page.evaluate(async () => {
    try {
      // Import Dexie db directly
      const { db } = await import('@repo/dataforge/dexie-schema');
      
      // Get initial change count
      const initialCount = await db.localChanges.where('processedSync').equals(0).count();
      
      // Create a task directly
      const taskId = await db.tasks.add({
        id: 'test-hook-' + Date.now(),
        title: 'Hook Test Task',
        description: 'Testing if hooks capture this',
        status: 'TODO',
        priority: 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: 'test-client',
        projectId: null,
        assigneeId: null,
        statusId: null,
        tags: [],
        completedAt: null,
        startDate: null,
        dueDate: null,
        estimatedHours: null,
        actualHours: null,
        blockedReason: ''
      });
      
      // Wait a bit for async hook to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get new change count
      const finalCount = await db.localChanges.where('processedSync').equals(0).count();
      
      // Get the actual changes
      const changes = await db.localChanges
        .where('table')
        .equals('tasks')
        .and(c => c.operation === 'insert')
        .toArray();
      
      return {
        success: true,
        taskId,
        initialCount,
        finalCount,
        changesCaptured: finalCount > initialCount,
        changes: changes.length,
        lastChange: changes[changes.length - 1]
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  console.log('[Test] Create result:', createResult);
  expect(createResult.success).toBe(true);
  expect(createResult.changesCaptured).toBe(true);
  
  // Test 2: Update the task
  const updateResult = await page.evaluate(async (taskId) => {
    try {
      const { db } = await import('@repo/dataforge/dexie-schema');
      
      // Update the task
      await db.tasks.update(taskId, {
        title: 'Updated Hook Test',
        description: 'Hook should capture this update'
      });
      
      // Wait for async hook
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check for update changes
      const changes = await db.localChanges
        .where('table')
        .equals('tasks')
        .and(c => c.operation === 'update')
        .toArray();
      
      return {
        success: true,
        updateChanges: changes.length,
        hasUpdateChange: changes.length > 0
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, createResult.taskId);
  
  console.log('[Test] Update result:', updateResult);
  expect(updateResult.success).toBe(true);
  expect(updateResult.hasUpdateChange).toBe(true);
  
  // Test 3: Delete the task
  const deleteResult = await page.evaluate(async (taskId) => {
    try {
      const { db } = await import('@repo/dataforge/dexie-schema');
      
      // Delete the task
      await db.tasks.delete(taskId);
      
      // Wait for async hook
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check for delete changes
      const changes = await db.localChanges
        .where('table')
        .equals('tasks')
        .and(c => c.operation === 'delete')
        .toArray();
      
      return {
        success: true,
        deleteChanges: changes.length,
        hasDeleteChange: changes.length > 0
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, createResult.taskId);
  
  console.log('[Test] Delete result:', deleteResult);
  expect(deleteResult.success).toBe(true);
  expect(deleteResult.hasDeleteChange).toBe(true);
  
  console.log('✅ Hooks ARE working! All CRUD operations are being tracked automatically.');
});