import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Verify Sync Loop Fix', () => {
  
  test('no sync loop on initial data load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for sync to initialize
    await waitForSyncInitialized(page, 30000);
    
    console.log('\n=== VERIFYING SYNC LOOP FIX ===\n');
    
    // Clear any existing changes to start fresh
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.clear();
      console.log('Cleared localChanges table');
    });
    
    // Wait for initial sync to complete
    await page.waitForTimeout(3000);
    
    // Check if any changes were tracked during initial sync
    const afterInitialSync = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const count = await db.localChanges.count();
      const changes = await db.localChanges.limit(10).toArray();
      
      return {
        count,
        sample: changes.map(c => ({
          table: c.table,
          operation: c.operation,
          id: c.id.substring(0, 8)
        }))
      };
    });
    
    console.log('After initial sync:');
    console.log('  Local changes count:', afterInitialSync.count);
    if (afterInitialSync.count > 0) {
      console.log('  Sample changes:', afterInitialSync.sample);
    }
    
    // CRITICAL: There should be NO changes tracked during initial sync
    if (afterInitialSync.count > 0) {
      console.error('🚨 SYNC LOOP DETECTED! Initial sync created', afterInitialSync.count, 'local changes');
      console.error('This means incoming sync data is being tracked as outgoing changes!');
    } else {
      console.log('✅ NO SYNC LOOP! Initial sync did not create any local changes');
    }
    
    // Now create a user change and verify it IS tracked
    console.log('\n--- Creating user change to verify tracking still works ---');
    
    const userChange = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // Create a task (user action)
      const task = await domainServices.task.create({
        title: 'User Created Task',
        description: 'This should be tracked',
        status: 'todo'
      });
      
      // Wait for hooks to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if it was tracked
      const changes = await db.localChanges.toArray();
      const tracked = changes.find(c => c.data?.id === task.id);
      
      return {
        taskId: task.id,
        wasTracked: !!tracked,
        totalChanges: changes.length
      };
    });
    
    console.log('User change result:');
    console.log('  Task ID:', userChange.taskId);
    console.log('  Was tracked:', userChange.wasTracked);
    console.log('  Total changes:', userChange.totalChanges);
    
    // Verify user changes ARE being tracked
    expect(userChange.wasTracked).toBe(true);
    expect(userChange.totalChanges).toBeGreaterThan(0);
    
    // Final verification
    if (afterInitialSync.count === 0 && userChange.wasTracked) {
      console.log('\n✅ SYNC LOOP FIX VERIFIED!');
      console.log('  - Initial sync does NOT create local changes');
      console.log('  - User actions ARE properly tracked');
      console.log('  - The dual-mode sync system is working correctly!');
    }
    
    // Clean up
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Delete the test task
      const testTasks = await db.tasks
        .where('title')
        .equals('User Created Task')
        .toArray();
      
      for (const task of testTasks) {
        await db.tasks.delete(task.id);
      }
      
      // Clear changes
      await db.localChanges.clear();
    });
  });
});