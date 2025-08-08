import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Debug Lost Changes', () => {
  
  test('investigate why changes are not processed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 10000 }
    );
    
    await waitForSyncInitialized(page, 30000);
    await waitForSyncLive(page, 30000);
    
    console.log('\n=== INVESTIGATING LOST CHANGES ===');
    
    // Clear existing changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.clear();
    });
    
    // Create a higher volume to reproduce the issue
    console.log('\n--- Creating 50 test tasks ---');
    const creationResult = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      const results = [];
      
      for (let i = 0; i < 50; i++) {
        const taskId = crypto.randomUUID();
        console.log(`[DEBUG] Creating task ${i + 1}: ${taskId}`);
        
        try {
          const task = await domainServices.task.create({
            id: taskId,
            title: `Debug Task ${i + 1}`,
            description: `Debug task for tracking ${i}`,
            status: 'todo'
          });
          
          results.push({
            index: i + 1,
            taskId: task.id,
            success: true
          });
        } catch (error) {
          results.push({
            index: i + 1,
            taskId,
            success: false,
            error: error.message
          });
        }
      }
      
      return results;
    });
    
    console.log('Creation results:', creationResult);
    
    // Wait for tracking to settle
    await page.waitForTimeout(2000);
    
    // Check localChanges status after creation
    const afterCreation = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const allChanges = await db.localChanges.toArray();
      
      return {
        totalChanges: allChanges.length,
        byStatus: {
          unprocessed: allChanges.filter(c => c.processedSync === 0).length,
          processed: allChanges.filter(c => c.processedSync === 1).length
        },
        bySendAttempts: {
          never: allChanges.filter(c => !c.sendAttempts || c.sendAttempts === 0).length,
          attempted: allChanges.filter(c => c.sendAttempts && c.sendAttempts > 0).length
        },
        details: allChanges.map(c => ({
          id: c.id.substring(0, 8),
          table: c.table,
          operation: c.operation,
          processedSync: c.processedSync,
          sendAttempts: c.sendAttempts || 0,
          dataId: c.data?.id?.substring(0, 8)
        }))
      };
    });
    
    console.log('\n--- After Creation Analysis ---');
    console.log('Total changes:', afterCreation.totalChanges);
    console.log('By status:', afterCreation.byStatus);
    console.log('By send attempts:', afterCreation.bySendAttempts);
    
    console.log('\nDetailed breakdown:');
    afterCreation.details.forEach((change, i) => {
      console.log(`  ${i + 1}. ${change.table}:${change.operation} (id: ${change.id}, processed: ${change.processedSync}, attempts: ${change.sendAttempts}, dataId: ${change.dataId})`);
    });
    
    // Wait longer to see if more changes get processed
    console.log('\n--- Waiting 10 seconds for processing ---');
    await page.waitForTimeout(10000);
    
    // Check again
    const afterWaiting = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const allChanges = await db.localChanges.toArray();
      
      return {
        totalChanges: allChanges.length,
        byStatus: {
          unprocessed: allChanges.filter(c => c.processedSync === 0).length,
          processed: allChanges.filter(c => c.processedSync === 1).length
        },
        bySendAttempts: {
          never: allChanges.filter(c => !c.sendAttempts || c.sendAttempts === 0).length,
          attempted: allChanges.filter(c => c.sendAttempts && c.sendAttempts > 0).length
        }
      };
    });
    
    console.log('\n--- After 10 Second Wait ---');
    console.log('Total changes:', afterWaiting.totalChanges);
    console.log('By status:', afterWaiting.byStatus);
    console.log('By send attempts:', afterWaiting.bySendAttempts);
    
    const lostChanges = afterWaiting.byStatus.unprocessed;
    console.log(`\n🚨 LOST CHANGES: ${lostChanges}/${afterWaiting.totalChanges} changes not processed!`);
    
    if (lostChanges > 0) {
      console.log(`❌ DATA LOSS: ${lostChanges} changes will never be sent to server!`);
      
      // Get details of lost changes
      const lostDetails = await page.evaluate(async () => {
        const { db } = await import('/src/domain/index.js');
        
        const unprocessedChanges = await db.localChanges
          .where('processedSync')
          .equals(0)
          .toArray();
          
        return unprocessedChanges.map(c => ({
          id: c.id,
          table: c.table,
          operation: c.operation,
          sendAttempts: c.sendAttempts || 0,
          lastSendAttempt: c.lastSendAttempt,
          lastError: c.lastError,
          dataId: c.data?.id
        }));
      });
      
      console.log('\n--- LOST CHANGE DETAILS ---');
      lostDetails.forEach((change, i) => {
        console.log(`  ${i + 1}. ${change.table}:${change.operation}`);
        console.log(`      ID: ${change.id}`);
        console.log(`      Data ID: ${change.dataId}`);
        console.log(`      Send attempts: ${change.sendAttempts}`);
        console.log(`      Last attempt: ${change.lastSendAttempt || 'never'}`);
        console.log(`      Last error: ${change.lastError || 'none'}`);
      });
    }
    
    expect(lostChanges).toBe(0); // This should pass - no data loss allowed
  });
  
});