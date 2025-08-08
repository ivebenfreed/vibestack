import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Sync Diagnostic Test', () => {
  test.setTimeout(20000);

  test('Diagnose sync tracking issues', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    console.log('\n=== SYNC DIAGNOSTIC TEST ===\n');
    
    // 1. Check if DexieOutgoingChangeService is available
    const serviceCheck = await page.evaluate(() => {
      const hasService = typeof window.DexieOutgoingChangeService !== 'undefined';
      const hasVibestackSync = typeof window.vibestackSync !== 'undefined';
      const hasDomainServices = typeof window.domainServices !== 'undefined';
      
      return {
        hasDexieOutgoingChangeService: hasService,
        hasVibestackSync,
        hasDomainServices,
        windowKeys: Object.keys(window).filter(k => 
          k.includes('sync') || k.includes('Sync') || 
          k.includes('dexie') || k.includes('Dexie') ||
          k.includes('change') || k.includes('Change')
        )
      };
    });
    
    console.log('Service availability:', serviceCheck);
    
    // 2. Check database tables
    const dbCheck = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        
        const tables = db.tables.map(t => ({
          name: t.name,
          schema: t.schema ? Object.keys(t.schema.indexes) : []
        }));
        
        // Check specific tracking tables
        const hasLocalChanges = tables.some(t => t.name === 'localChanges');
        const hasOutgoingQueue = tables.some(t => t.name === 'outgoing_change_queue');
        const hasChangeHistory = tables.some(t => t.name === 'change_history');
        
        return {
          success: true,
          tables: tables.map(t => t.name),
          hasLocalChanges,
          hasOutgoingQueue,
          hasChangeHistory
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Database check:', dbCheck);
    
    // 3. Test if changes are being tracked at all
    console.log('\n--- Testing change tracking mechanism ---');
    
    const trackingTest = await page.evaluate(async () => {
      try {
        const { db, domainServices } = await import('/src/domain/index.js');
        
        // Get initial counts from all potential tracking tables
        const initialCounts = {};
        
        if (db.localChanges) {
          initialCounts.localChanges = await db.localChanges.count();
        }
        if (db.outgoing_change_queue) {
          initialCounts.outgoing_change_queue = await db.outgoing_change_queue.count();
        }
        if (db.change_history) {
          initialCounts.change_history = await db.change_history.count();
        }
        
        // Create a task
        const taskId = crypto.randomUUID();
        await domainServices.task.create({
          id: taskId,
          title: 'Diagnostic Test Task',
          status: 'todo'
        });
        
        // Wait a moment for any async tracking
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get counts after creation
        const afterCounts = {};
        
        if (db.localChanges) {
          afterCounts.localChanges = await db.localChanges.count();
        }
        if (db.outgoing_change_queue) {
          afterCounts.outgoing_change_queue = await db.outgoing_change_queue.count();
        }
        if (db.change_history) {
          afterCounts.change_history = await db.change_history.count();
        }
        
        // Check what changed
        const changes = {};
        for (const table in initialCounts) {
          changes[table] = {
            before: initialCounts[table],
            after: afterCounts[table],
            diff: afterCounts[table] - initialCounts[table]
          };
        }
        
        return {
          success: true,
          taskId,
          changes
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Tracking test result:', JSON.stringify(trackingTest, null, 2));
    
    // 4. Check if there's a tracking service running
    console.log('\n--- Checking for active tracking service ---');
    
    const serviceStatus = await page.evaluate(async () => {
      try {
        // Check if there's an active service worker or tracking mechanism
        const hasServiceWorker = 'serviceWorker' in navigator;
        let swStatus = null;
        
        if (hasServiceWorker) {
          const registration = await navigator.serviceWorker.getRegistration();
          swStatus = registration ? 'registered' : 'not registered';
        }
        
        // Check localStorage for sync state
        const syncState = localStorage.getItem('sync-machine-state');
        const parsedSyncState = syncState ? JSON.parse(syncState) : null;
        
        // Check if there's any hook or middleware
        const { db } = await import('/src/domain/index.js');
        const hasHooks = db._hasHooks;
        const middleware = db._middleware;
        
        return {
          hasServiceWorker,
          swStatus,
          syncState: parsedSyncState,
          hasHooks,
          middlewareCount: middleware ? Object.keys(middleware).length : 0
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });
    
    console.log('Service status:', serviceStatus);
    
    // 5. Try to manually trigger tracking
    console.log('\n--- Attempting manual tracking ---');
    
    const manualTracking = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        
        // Try to manually add a change to localChanges
        const changeId = crypto.randomUUID();
        const change = {
          id: changeId,
          entity: 'task',
          entityId: crypto.randomUUID(),
          operation: 'create',
          data: { title: 'Manual test' },
          timestamp: Date.now(),
          processedSync: 0
        };
        
        await db.localChanges.add(change);
        
        // Verify it was added
        const added = await db.localChanges.get(changeId);
        
        return {
          success: true,
          changeAdded: !!added,
          changeId
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Manual tracking result:', manualTracking);
    
    // Summary
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log('1. Database tables exist:', dbCheck.success && dbCheck.hasLocalChanges);
    console.log('2. Changes are tracked:', trackingTest.success && 
      Object.values(trackingTest.changes || {}).some(c => c.diff > 0));
    console.log('3. Manual tracking works:', manualTracking.success && manualTracking.changeAdded);
    console.log('4. Sync state exists:', !!serviceStatus.syncState);
    
    // Assert basic functionality
    expect(dbCheck.hasLocalChanges).toBe(true);
    expect(manualTracking.success).toBe(true);
  });
});