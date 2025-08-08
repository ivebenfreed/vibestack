/**
 * Simple test to verify automatic Dexie hooks are working
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Simple Hook Test', () => {
  test('verify hooks are tracking changes', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    console.log('[Test] App is ready, testing change tracking');
    
    // Test 1: Check if hooks are initialized
    const hooksStatus = await page.evaluate(async () => {
      try {
        // Access the global domainServices that's already loaded
        const { db } = window.domainServices || {};
        if (!db) throw new Error('Database not initialized');
        
        // Check if we can query the localChanges table
        const count = await db.localChanges.count();
        return { success: true, count, error: null };
      } catch (error) {
        return { success: false, count: 0, error: error.message };
      }
    });
    
    console.log('[Test] Hooks status:', hooksStatus);
    expect(hooksStatus.success).toBe(true);
    
    // Test 2: Create a task and verify tracking
    const taskResult = await page.evaluate(async () => {
      try {
        // Access the global domainServices that's already loaded
        const domainServices = window.domainServices;
        if (!domainServices) throw new Error('Domain services not initialized');
        
        const task = await domainServices.task.create({
          title: 'Hook Test Task',
          description: 'Testing automatic hooks',
          status: 'TODO'
        });
        return { success: true, task, error: null };
      } catch (error) {
        return { success: false, task: null, error: error.message };
      }
    });
    
    console.log('[Test] Task creation result:', taskResult);
    expect(taskResult.success).toBe(true);
    
    // Test 3: Check if change was tracked
    const changeResult = await page.evaluate(async () => {
      try {
        // Access the database directly
        const { db } = window.domainServices || {};
        if (!db) throw new Error('Database not initialized');
        
        // Query localChanges table directly
        const changes = await db.localChanges
          .where('processedSync')
          .equals(0)
          .toArray();
        
        const taskChanges = changes.filter(c => c.table === 'tasks' && c.operation === 'insert');
        return { success: true, changes: taskChanges, error: null };
      } catch (error) {
        return { success: false, changes: [], error: error.message };
      }
    });
    
    console.log('[Test] Change tracking result:', changeResult);
    expect(changeResult.success).toBe(true);
    expect(changeResult.changes.length).toBeGreaterThan(0);
    
    // Log successful completion
    console.log('[Test] ✅ All tests passed - automatic hooks are working!');
  });
});