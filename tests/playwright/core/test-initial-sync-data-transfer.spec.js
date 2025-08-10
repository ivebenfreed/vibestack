/**
 * Test Initial Sync Data Transfer
 * 
 * This test verifies that actual data is transferred during initial sync
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Initial Sync Data Transfer Test', () => {
  test('verify data is actually transferred during initial sync', async ({ page }) => {
    console.log('=== INITIAL SYNC DATA TRANSFER TEST ===');
    
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 30000 }
    );
    
    // Clear IndexedDB to force a fresh sync
    console.log('📦 Clearing IndexedDB to force fresh sync...');
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const deleteReq = indexedDB.deleteDatabase('vibestack');
        deleteReq.onsuccess = () => {
          console.log('IndexedDB cleared successfully');
          resolve();
        };
        deleteReq.onerror = () => {
          console.error('Failed to clear IndexedDB');
          resolve(); // Continue anyway
        };
      });
    });
    
    // Reload to trigger fresh sync
    console.log('🔄 Reloading page to trigger fresh sync...');
    await page.reload();
    
    // Wait for app to be ready again
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 30000 }
    );
    
    // Monitor console logs for sync messages
    const syncLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('sync') || text.includes('Sync') || text.includes('SYNC') || 
          text.includes('changes') || text.includes('records') || text.includes('chunk')) {
        syncLogs.push(text);
        console.log('📡 Sync log:', text);
      }
    });
    
    // Wait a bit for sync to complete
    await page.waitForTimeout(5000);
    
    // Check IndexedDB for synced data
    const dbData = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('vibestack');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const tableCounts = {};
      const tableNames = ['tasks', 'tags', 'tag_sets', 'comments', 'projects', 'task_tags'];
      
      for (const tableName of tableNames) {
        try {
          const transaction = db.transaction([tableName], 'readonly');
          const store = transaction.objectStore(tableName);
          const countRequest = store.count();
          
          await new Promise((resolve, reject) => {
            countRequest.onsuccess = () => {
              tableCounts[tableName] = countRequest.result;
              resolve();
            };
            countRequest.onerror = () => {
              tableCounts[tableName] = 0;
              resolve(); // Continue even if table doesn't exist
            };
          });
        } catch (e) {
          tableCounts[tableName] = 0; // Table doesn't exist
        }
      }
      
      db.close();
      return tableCounts;
    });
    
    console.log('📊 Data in IndexedDB after sync:');
    for (const [table, count] of Object.entries(dbData)) {
      console.log(`   ${table}: ${count} records`);
    }
    
    // Check server logs for DEBUG messages (if available)
    console.log('\n📋 Sync logs captured:');
    syncLogs.forEach(log => console.log(`   ${log}`));
    
    // Verify we got some data
    const totalRecords = Object.values(dbData).reduce((sum, count) => sum + count, 0);
    console.log(`\n✅ Total records synced: ${totalRecords}`);
    
    // Assert that we got at least some data
    expect(totalRecords).toBeGreaterThan(0);
    
    // Specifically check that tasks were synced (we know there are 96 in the DB)
    expect(dbData.tasks).toBeGreaterThan(0);
    console.log(`✅ Tasks synced: ${dbData.tasks}`);
    
    // Check for junction table data
    if (dbData.task_tags !== undefined) {
      console.log(`✅ Junction table task_tags synced: ${dbData.task_tags} records`);
    }
  });
});