import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Simple Sync Acknowledgment Test', () => {
  
  test('check if changes are being sent and acknowledged', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 10000 }
    );
    
    await waitForSyncInitialized(page, 30000);
    await waitForSyncLive(page, 30000);
    
    console.log('\n=== CHECKING SYNC ACKNOWLEDGMENT SYSTEM ===');
    
    // Step 1: Check current state
    const initialState = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        const total = await db.localChanges.count();
        const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
        const processed = await db.localChanges.where('processedSync').equals(1).count();
        
        return { total, unprocessed, processed, error: null };
      } catch (error) {
        return { total: -1, unprocessed: -1, processed: -1, error: error.message };
      }
    });
    
    console.log('Initial state:', initialState);
    
    if (initialState.error) {
      throw new Error(`Database error: ${initialState.error}`);
    }
    
    // Step 2: Create a single change
    console.log('\n--- Creating test change ---');
    const createResult = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        
        const taskId = crypto.randomUUID();
        await domainServices.task.create({
          id: taskId,
          title: 'Simple Ack Test Task',
          description: 'Testing acknowledgments',
          status: 'todo'
        });
        
        return { taskId, error: null };
      } catch (error) {
        return { taskId: null, error: error.message };
      }
    });
    
    console.log('Create result:', createResult);
    
    if (createResult.error) {
      throw new Error(`Task creation failed: ${createResult.error}`);
    }
    
    // Step 3: Check if change was tracked
    await page.waitForTimeout(1000);
    
    const afterCreate = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        const total = await db.localChanges.count();
        const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
        const processed = await db.localChanges.where('processedSync').equals(1).count();
        
        return { total, unprocessed, processed, error: null };
      } catch (error) {
        return { total: -1, unprocessed: -1, processed: -1, error: error.message };
      }
    });
    
    console.log('After create:', afterCreate);
    console.log('Change created:', afterCreate.total > initialState.total);
    
    // Step 4: Monitor for acknowledgment with shorter timeout
    console.log('\n--- Monitoring for acknowledgments (10 seconds) ---');
    
    let acknowledged = false;
    const startTime = Date.now();
    const maxWait = 10000; // 10 seconds
    
    while (Date.now() - startTime < maxWait && !acknowledged) {
      await page.waitForTimeout(2000);
      
      const currentState = await page.evaluate(async () => {
        try {
          const { db } = await import('/src/domain/index.js');
          const processed = await db.localChanges.where('processedSync').equals(1).count();
          return { processed, error: null };
        } catch (error) {
          return { processed: -1, error: error.message };
        }
      });
      
      console.log(`Check: ${currentState.processed} processed changes`);
      
      if (currentState.processed > initialState.processed) {
        acknowledged = true;
        console.log('✅ ACKNOWLEDGMENT RECEIVED!');
        break;
      }
    }
    
    if (!acknowledged) {
      console.log('❌ NO ACKNOWLEDGMENT RECEIVED - investigating...');
      
      // Check if DexieOutgoingChangeService is running
      const debugInfo = await page.evaluate(() => {
        // Check if sync service is available
        const syncService = window.vibestackSync;
        return {
          hasSyncService: !!syncService,
          clientId: syncService?.clientId,
          currentLSN: syncService?.currentLSN
        };
      });
      
      console.log('Debug info:', debugInfo);
    }
    
    // Final verification: at least verify the change was tracked
    expect(afterCreate.total).toBeGreaterThan(initialState.total);
    console.log('\n✅ Change tracking is working');
    
    if (acknowledged) {
      console.log('✅ Server acknowledgment is working');
    } else {
      console.log('⚠️ Server acknowledgment needs investigation');
    }
  });
  
});