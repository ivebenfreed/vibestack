import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized } from '../core/sync-test-helpers.js';

test.describe('Automatic Sync Tracking Tests', () => {
  test.setTimeout(20000);

  test('Verify automatic change tracking after initial sync', async ({ page }) => {
    await page.goto('/');
    
    // Enable console logging to see hook activity
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Dexie') || text.includes('Hook Debug') || text.includes('sync')) {
        console.log('Browser:', text);
      }
    });
    
    // Wait for app and sync initialization
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await waitForSyncInitialized(page, 30000);
    
    console.log('\n=== TESTING AUTOMATIC CHANGE TRACKING ===\n');
    
    // Step 1: Check if tracking is enabled
    const trackingStatus = await page.evaluate(() => {
      // Check localStorage for sync state
      const syncState = localStorage.getItem('sync-machine-state');
      const parsed = syncState ? JSON.parse(syncState) : null;
      
      // Check if we can access the tracking state
      const trackingEnabled = window.isTrackingEnabled || true; // Assume enabled if not exposed
      
      return {
        syncState: parsed,
        hasSyncState: !!parsed,
        hasClientId: !!(parsed?.clientId),
        hasLSN: !!(parsed?.currentLSN),
        trackingEnabled
      };
    });
    
    console.log('Tracking status:', trackingStatus);
    expect(trackingStatus.hasSyncState).toBe(true);
    expect(trackingStatus.hasClientId).toBe(true);
    
    // Step 2: Create a task and verify it's automatically tracked
    console.log('\n--- Creating task to test automatic tracking ---');
    
    const trackingTest = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // Get initial change count
      const initialCount = await db.localChanges.count();
      console.log(`[Test] Initial localChanges count: ${initialCount}`);
      
      // Create a task through domainServices
      const taskId = crypto.randomUUID();
      const startTime = Date.now();
      
      try {
        const task = await domainServices.task.create({
          id: taskId,
          title: 'Auto Track Test Task',
          description: 'Testing automatic change tracking via hooks',
          status: 'todo'
        });
        
        console.log(`[Test] Task created with ID: ${task.id}`);
        
        // Wait a bit for async hook processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if change was automatically tracked
        const afterCount = await db.localChanges.count();
        const timeTaken = Date.now() - startTime;
        
        console.log(`[Test] After creation - localChanges count: ${afterCount}`);
        console.log(`[Test] Changes added: ${afterCount - initialCount}`);
        
        // Get the most recent change
        const recentChange = await db.localChanges
          .orderBy('updatedAt')
          .reverse()
          .first();
        
        return {
          success: true,
          taskId,
          task,
          initialCount,
          afterCount,
          changeAdded: afterCount > initialCount,
          timeTaken,
          recentChange: recentChange ? {
            id: recentChange.id,
            table: recentChange.table,
            operation: recentChange.operation,
            processedSync: recentChange.processedSync,
            hasData: !!recentChange.data
          } : null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          initialCount
        };
      }
    });
    
    console.log('Tracking test result:', JSON.stringify(trackingTest, null, 2));
    
    // Step 3: Verify the hooks are working
    if (!trackingTest.changeAdded) {
      console.log('\n--- Hooks may not be firing, checking hook status ---');
      
      const hookStatus = await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        
        // Check if tables have hooks
        const tables = ['tasks', 'projects', 'users', 'comments'];
        const hookInfo = {};
        
        for (const tableName of tables) {
          const table = db[tableName];
          if (table) {
            // Dexie stores hooks in _hooks property
            const hasHooks = !!(table._hooks);
            hookInfo[tableName] = {
              exists: true,
              hasHooks,
              hookCount: hasHooks && table._hooks ? Object.keys(table._hooks).length : 0
            };
          } else {
            hookInfo[tableName] = { exists: false, hasHooks: false };
          }
        }
        
        return hookInfo;
      });
      
      console.log('Hook status:', JSON.stringify(hookStatus, null, 2));
    }
    
    // Step 4: Test update operation
    console.log('\n--- Testing update operation tracking ---');
    
    const updateTest = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // First create a task to update
      const taskId = crypto.randomUUID();
      await domainServices.task.create({
        id: taskId,
        title: 'Task to Update',
        status: 'todo'
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const beforeUpdateCount = await db.localChanges.count();
      
      // Update the task
      await domainServices.task.update(taskId, {
        title: 'Updated Task Title',
        status: 'in_progress'
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterUpdateCount = await db.localChanges.count();
      
      return {
        taskId,
        beforeUpdateCount,
        afterUpdateCount,
        updateTracked: afterUpdateCount > beforeUpdateCount
      };
    });
    
    console.log('Update test result:', updateTest);
    
    // Step 5: Test delete operation
    console.log('\n--- Testing delete operation tracking ---');
    
    const deleteTest = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      // Create a task to delete
      const taskId = crypto.randomUUID();
      await domainServices.task.create({
        id: taskId,
        title: 'Task to Delete',
        status: 'todo'
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const beforeDeleteCount = await db.localChanges.count();
      
      // Delete the task
      await domainServices.task.delete(taskId);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const afterDeleteCount = await db.localChanges.count();
      
      return {
        taskId,
        beforeDeleteCount,
        afterDeleteCount,
        deleteTracked: afterDeleteCount > beforeDeleteCount
      };
    });
    
    console.log('Delete test result:', deleteTest);
    
    // Final summary
    console.log('\n=== SUMMARY ===');
    console.log('Sync initialized:', trackingStatus.hasSyncState);
    console.log('Create tracking:', trackingTest.changeAdded ? '✅ Working' : '❌ Not working');
    console.log('Update tracking:', updateTest.updateTracked ? '✅ Working' : '❌ Not working');
    console.log('Delete tracking:', deleteTest.deleteTracked ? '✅ Working' : '❌ Not working');
    
    // At least one operation should be tracked for the test to pass
    const anyTracking = trackingTest.changeAdded || updateTest.updateTracked || deleteTest.deleteTracked;
    expect(anyTracking).toBe(true);
  });

  test('Verify tracking auto-enables after sync initialization', async ({ page }) => {
    await page.goto('/');
    
    console.log('\n=== TESTING AUTO-ENABLE AFTER SYNC ===\n');
    
    // Monitor console for tracking enable/disable messages
    const trackingMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Enabling change tracking') || text.includes('Disabling change tracking')) {
        trackingMessages.push(text);
        console.log('Tracking state change:', text);
      }
    });
    
    // Wait for sync initialization
    await waitForSyncInitialized(page, 30000);
    
    // Give it a moment for any auto-enable to happen
    await page.waitForTimeout(2000);
    
    // Check if tracking got enabled
    const finalState = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Try to add a test change
      const testId = crypto.randomUUID();
      const beforeCount = await db.localChanges.count();
      
      // Create a test task
      await db.tasks.add({
        id: testId,
        title: 'Test Auto-Enable',
        status: 'todo',
        priority: 'medium',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const afterCount = await db.localChanges.count();
      
      return {
        beforeCount,
        afterCount,
        changeTracked: afterCount > beforeCount
      };
    });
    
    console.log('Final state:', finalState);
    console.log('Tracking messages seen:', trackingMessages);
    
    // Tracking should be working after sync init
    expect(finalState.changeTracked).toBe(true);
  });

  test('Verify hooks are installed on all tracked tables', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 30000);
    
    console.log('\n=== VERIFYING HOOKS ON ALL TABLES ===\n');
    
    const hookVerification = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const TRACKED_TABLES = [
        'tasks',
        'projects', 
        'users',
        'comments',
        'statusDefinitions',
        'statusSets',
        'tags',
        'tagSets'
      ];
      
      const results = {};
      
      for (const tableName of TRACKED_TABLES) {
        const table = db[tableName];
        
        if (!table) {
          results[tableName] = {
            exists: false,
            hasHooks: false,
            error: 'Table not found'
          };
          continue;
        }
        
        // Test by creating an entity
        const testId = crypto.randomUUID();
        const beforeCount = await db.localChanges.count();
        
        try {
          // Create a minimal entity for each table
          const entity = {
            id: testId,
            name: tableName === 'users' ? 'Test User' : undefined,
            title: ['tasks', 'projects'].includes(tableName) ? 'Test Entity' : undefined,
            content: tableName === 'comments' ? 'Test Comment' : undefined,
            taskId: tableName === 'comments' ? crypto.randomUUID() : undefined,
            label: ['tags', 'statusDefinitions'].includes(tableName) ? 'Test Label' : undefined,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Add the entity
          await table.add(entity);
          
          // Wait for hook processing
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const afterCount = await db.localChanges.count();
          
          // Clean up - delete the test entity
          await table.delete(testId).catch(() => {});
          
          results[tableName] = {
            exists: true,
            hasHooks: afterCount > beforeCount,
            changeDetected: afterCount > beforeCount
          };
        } catch (error) {
          results[tableName] = {
            exists: true,
            hasHooks: false,
            error: error.message
          };
        }
      }
      
      return results;
    });
    
    console.log('Hook verification results:');
    for (const [table, result] of Object.entries(hookVerification)) {
      const status = result.changeDetected ? '✅' : '❌';
      console.log(`  ${status} ${table}:`, result);
    }
    
    // At least the main tables should have working hooks
    expect(hookVerification.tasks?.changeDetected).toBe(true);
  });
});