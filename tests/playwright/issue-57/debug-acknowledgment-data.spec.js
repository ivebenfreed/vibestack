import { test, expect } from '../fixtures/persistent-context.js';
import { waitForSyncInitialized, waitForSyncLive } from '../core/sync-test-helpers.js';

test.describe('Debug Acknowledgment Data Structure', () => {
  
  test('examine what data is stored in localChanges vs server response', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 10000 }
    );
    
    await waitForSyncInitialized(page, 30000);
    await waitForSyncLive(page, 30000);
    
    console.log('\n=== DEBUGGING ACKNOWLEDGMENT DATA STRUCTURE ===');
    
    // Clear existing changes
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      await db.localChanges.clear();
    });
    
    // Create one task and inspect the data structure
    const taskData = await page.evaluate(async () => {
      const { domainServices, db } = await import('/src/domain/index.js');
      
      console.log('[DEBUG] Creating test task...');
      const taskId = crypto.randomUUID();
      const task = await domainServices.task.create({
        id: taskId,
        title: 'Debug Test Task',
        description: 'For debugging acknowledgments',
        status: 'todo'
      });
      
      console.log('[DEBUG] Created task:', { id: task.id, title: task.title });
      
      // Wait for change tracking
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the localChanges entry
      const changes = await db.localChanges.toArray();
      console.log('[DEBUG] localChanges entries:', changes.length);
      
      if (changes.length > 0) {
        const change = changes[0];
        console.log('[DEBUG] Change structure:', {
          id: change.id,
          table: change.table,
          operation: change.operation,
          processedSync: change.processedSync,
          sendAttempts: change.sendAttempts || 0,
          dataKeys: Object.keys(change.data || {}),
          dataId: change.data?.id,
          dataType: typeof change.data?.id,
          fullData: change.data
        });
        
        return {
          taskId: task.id,
          changeId: change.id,
          changeDataId: change.data?.id,
          changeData: change.data,
          taskObject: task
        };
      }
      
      return { error: 'No changes found' };
    });
    
    console.log('\n=== TASK DATA COMPARISON ===');
    console.log('Task created with ID:', taskData.taskId);
    console.log('Change data.id:', taskData.changeDataId);
    console.log('IDs match:', taskData.taskId === taskData.changeDataId);
    
    if (taskData.error) {
      console.log('Error:', taskData.error);
      return;
    }
    
    // Wait a bit longer to see if server processes it
    console.log('\n=== WAITING FOR SERVER PROCESSING ===');
    await page.waitForTimeout(5000);
    
    // Check if change was processed
    const finalState = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      const changes = await db.localChanges.toArray();
      return {
        totalChanges: changes.length,
        changes: changes.map(c => ({
          id: c.id,
          table: c.table,
          operation: c.operation,
          processedSync: c.processedSync,
          sendAttempts: c.sendAttempts || 0,
          dataId: c.data?.id
        }))
      };
    });
    
    console.log('\n=== FINAL STATE ===');
    console.log('Total changes:', finalState.totalChanges);
    finalState.changes.forEach((change, i) => {
      console.log(`  ${i + 1}. ${change.table}:${change.operation} (processed: ${change.processedSync}, attempts: ${change.sendAttempts}, dataId: ${change.dataId})`);
    });
    
    expect(finalState.totalChanges).toBeGreaterThan(0);
  });
  
});