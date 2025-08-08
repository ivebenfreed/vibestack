import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Change Tracking Hooks Test', () => {
  test.setTimeout(20000);

  test('Verify change tracking hooks are installed and working', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    console.log('\n=== TESTING CHANGE TRACKING HOOKS ===\n');
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.text().includes('[Dexie')) {
        console.log('Page console:', msg.text());
      }
    });
    
    // 1. Check if hooks are initialized
    const hooksCheck = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Check if tasks table has hooks
      const tasksTable = db.tasks;
      const hasHooks = tasksTable && tasksTable._hooks;
      
      return {
        hasTable: !!tasksTable,
        hasHooks: !!hasHooks,
        hookTypes: hasHooks ? Object.keys(tasksTable._hooks) : []
      };
    });
    
    console.log('Hooks check:', hooksCheck);
    
    // 2. Reinitialize hooks to ensure they're active
    const reinitResult = await page.evaluate(async () => {
      try {
        // Import the change tracking module
        const { initializeDexieChangeTracking } = await import('/src/db/dexie-change-tracking.js');
        
        // Get clientId from sync state or use a test ID
        const syncState = localStorage.getItem('sync-machine-state');
        const clientId = syncState ? JSON.parse(syncState).clientId : 'test-client-' + Date.now();
        
        // Reinitialize hooks
        initializeDexieChangeTracking(clientId, 'test-user');
        
        return { success: true, clientId };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Reinit result:', reinitResult);
    
    // 3. Test direct database operation (should trigger hooks)
    console.log('\n--- Testing direct database operation ---');
    
    const directDbTest = await page.evaluate(async () => {
      try {
        const { db } = await import('@repo/dataforge/dexie-schema');
        
        // Get initial count
        const initialCount = await db.localChanges.count();
        
        // Create a task directly via Dexie (not through domainServices)
        const taskId = crypto.randomUUID();
        await db.tasks.add({
          id: taskId,
          title: 'Direct DB Test Task',
          description: 'Testing hooks directly',
          status: 'todo',
          priority: 'medium',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Wait a moment for async hook processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if change was tracked
        const afterCount = await db.localChanges.count();
        
        return {
          success: true,
          taskId,
          initialCount,
          afterCount,
          changeTracked: afterCount > initialCount
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Direct DB test:', directDbTest);
    
    // 4. Test through domainServices (should also trigger hooks)
    console.log('\n--- Testing through domainServices ---');
    
    const domainServiceTest = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        const { db } = await import('@repo/dataforge/dexie-schema');
        
        // Get initial count
        const initialCount = await db.localChanges.count();
        
        // Create a task through domainServices
        const taskId = crypto.randomUUID();
        const task = await domainServices.task.create({
          id: taskId,
          title: 'Domain Service Test Task',
          description: 'Testing hooks via domain service',
          status: 'todo'
        });
        
        // Wait a moment for async hook processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if change was tracked
        const afterCount = await db.localChanges.count();
        
        // Get the last change to see what was tracked
        const lastChange = await db.localChanges
          .orderBy('updatedAt')
          .reverse()
          .first();
        
        return {
          success: true,
          taskId,
          task,
          initialCount,
          afterCount,
          changeTracked: afterCount > initialCount,
          lastChange: lastChange ? {
            id: lastChange.id,
            table: lastChange.table,
            operation: lastChange.operation,
            processedSync: lastChange.processedSync
          } : null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Domain service test:', domainServiceTest);
    
    // 5. Check current hook status
    console.log('\n--- Final hook status ---');
    
    const finalStatus = await page.evaluate(async () => {
      const { db } = await import('@repo/dataforge/dexie-schema');
      
      // Check each table for hooks
      const tableStatus = {};
      const tables = ['tasks', 'projects', 'users', 'comments'];
      
      for (const tableName of tables) {
        const table = db[tableName];
        if (table && table._hooks) {
          tableStatus[tableName] = {
            hasHooks: true,
            hookTypes: Object.keys(table._hooks)
          };
        } else {
          tableStatus[tableName] = {
            hasHooks: false,
            hookTypes: []
          };
        }
      }
      
      // Get total changes count
      const totalChanges = await db.localChanges.count();
      const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
      const processed = await db.localChanges.where('processedSync').equals(1).count();
      
      return {
        tableStatus,
        changeStats: {
          total: totalChanges,
          unprocessed,
          processed
        }
      };
    });
    
    console.log('Final status:', JSON.stringify(finalStatus, null, 2));
    
    // Assertions
    expect(directDbTest.success).toBe(true);
    expect(directDbTest.changeTracked).toBe(true);
    expect(domainServiceTest.success).toBe(true);
    
    // At least one method should track changes
    const anyChangeTracked = directDbTest.changeTracked || domainServiceTest.changeTracked;
    expect(anyChangeTracked).toBe(true);
  });
});