import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Dexie Service Status Test', () => {
  
  test('check if DexieOutgoingChangeService is running and processing changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 10000 }
    );
    
    await waitForSyncInitialized(page, 30000);
    await waitForSyncLive(page, 30000);
    
    console.log('\n=== DEXIE SERVICE STATUS CHECK ===');
    
    // Listen for console logs to detect sync system activity
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DexieOutgoingChangeService') || 
          text.includes('ServiceCoordinator') || 
          text.includes('sync') ||
          text.includes('Dexie')) {
        logs.push(text);
      }
    });
    
    console.log('Monitoring console logs for sync system activity...');
    
    // Force trigger change processing manually
    console.log('\n--- Manually creating change and checking processing ---');
    
    const manualTest = await page.evaluate(async () => {
      try {
        const { db, domainServices } = await import('/src/domain/index.js');
        
        // Clear existing changes
        await db.localChanges.clear();
        
        console.log('[TEST] Creating a task manually...');
        const taskId = crypto.randomUUID();
        await domainServices.task.create({
          id: taskId,
          title: 'Manual Service Test Task',
          description: 'Testing service status',
          status: 'todo'
        });
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if change was tracked
        const changes = await db.localChanges.toArray();
        console.log('[TEST] Changes after manual create:', changes.length);
        
        // Check attempts
        const changeDetails = changes.map(c => ({
          table: c.table,
          operation: c.operation,
          processedSync: c.processedSync,
          sendAttempts: c.sendAttempts || 0,
          id: c.id.substring(0, 8)
        }));
        
        return {
          changeCount: changes.length,
          changeDetails,
          error: null
        };
        
      } catch (error) {
        console.error('[TEST] Error in manual test:', error);
        return {
          changeCount: -1,
          changeDetails: [],
          error: error.message
        };
      }
    });
    
    console.log('Manual test results:', manualTest);
    
    if (manualTest.error) {
      throw new Error(`Manual test failed: ${manualTest.error}`);
    }
    
    // Verify change was tracked
    expect(manualTest.changeCount).toBe(1);
    console.log('✅ Change tracking is working');
    
    // Check if change has send attempts (indicating service processed it)
    const change = manualTest.changeDetails[0];
    console.log(`Change details:`, change);
    
    if (change.sendAttempts > 0) {
      console.log('✅ DexieOutgoingChangeService is processing changes');
    } else {
      console.log('❌ DexieOutgoingChangeService is NOT processing changes (sendAttempts = 0)');
      
      // Display captured console logs
      console.log('\n--- Console logs captured ---');
      if (logs.length > 0) {
        logs.forEach((log, i) => {
          console.log(`  ${i + 1}. ${log}`);
        });
      } else {
        console.log('  No sync-related console logs captured');
      }
      
      // Try to force a sync operation
      console.log('\n--- Attempting to force sync processing ---');
      const forceResult = await page.evaluate(async () => {
        try {
          // Try to access change tracking directly
          const { setChangeProcessor, trackOutgoingChange } = await import('/src/db/dexie-change-tracking.js');
          
          // Try to trigger the change processor manually
          console.log('[TEST] Attempting to trigger change processor manually...');
          
          return {
            hasChangeTracking: typeof trackOutgoingChange === 'function',
            hasSetChangeProcessor: typeof setChangeProcessor === 'function',
            error: null
          };
        } catch (error) {
          return {
            hasChangeTracking: false,
            hasSetChangeProcessor: false,
            error: error.message
          };
        }
      });
      
      console.log('Force sync result:', forceResult);
    }
  });
  
});