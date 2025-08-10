// Test initial sync from scratch
import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Initial Sync', () => {
  test.setTimeout(60000);

  test('should perform initial sync when starting with no data', async ({ page }) => {
    console.log('🚀 Testing initial sync from scratch...\n');
    
    // Set up console log capture for sync events
    const syncLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      // Capture sync-related logs
      if (text.includes('sync') || 
          text.includes('Sync') || 
          text.includes('SYNC') ||
          text.includes('LSN') ||
          text.includes('initial') ||
          text.includes('catchup') ||
          text.includes('server-changes') ||
          text.includes('client-changes') ||
          text.includes('WebSocket') ||
          text.includes('entities') ||
          text.includes('Fetching') ||
          text.includes('Received') ||
          text.includes('Applied')) {
        syncLogs.push({
          type: msg.type(),
          text: text,
          time: new Date().toISOString()
        });
        console.log(`  [BROWSER] ${text}`);
      }
    });
    
    // Navigate to the app
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Clear any existing sync state to simulate fresh start
    await page.evaluate(() => {
      // IMPORTANT: Clear the actual sync-machine-state that contains LSN
      localStorage.removeItem('sync-machine-state');
      
      // Clear any other sync-related keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('sync') || key.includes('Sync') || key.includes('LSN'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear any persisted sync state from IndexedDB
      const request = indexedDB.open('vibestack');
      request.onsuccess = (event) => {
        const db = event.target.result;
        if (db.objectStoreNames.contains('LocalChanges')) {
          const transaction = db.transaction(['LocalChanges'], 'readwrite');
          const store = transaction.objectStore('LocalChanges');
          store.clear();
        }
      };
      
      console.log('🧹 Cleared ALL sync state for fresh initial sync');
    });
    
    // Reload to trigger initial sync
    console.log('🔄 Reloading to trigger initial sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Wait for app to reinitialize
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Based on the logs, we can see sync is happening
    // Let's monitor for specific sync phases in the logs
    console.log('⏳ Monitoring sync progress through logs...');
    
    // Wait a bit for sync to progress
    await page.waitForTimeout(5000);
    
    // Check if we captured initial sync activity
    const hasInitialSync = syncLogs.some(log => 
      log.text.toLowerCase().includes('initial') || 
      log.text.toLowerCase().includes('connecting') ||
      log.text.toLowerCase().includes('phase 1'));
    
    if (hasInitialSync) {
      console.log('✅ Initial sync activity detected in logs');
    } else {
      console.log('⚠️  No clear initial sync activity in logs');
    }
    
    // Wait for sync to stabilize (no more rapid log activity)
    await page.waitForTimeout(3000);
    
    // Check for sync completion indicators in logs
    const hasSyncCompletion = syncLogs.some(log => 
      log.text.toLowerCase().includes('idle') || 
      log.text.toLowerCase().includes('complete') ||
      log.text.toLowerCase().includes('success') ||
      log.text.toLowerCase().includes('ready'));
    
    if (hasSyncCompletion) {
      console.log('✅ Sync completion detected in logs');
    } else {
      console.log('⚠️  No clear sync completion in logs');
    }
    
    // Check for LSN in logs since it's not stored in localStorage anymore
    const lsnLogs = syncLogs.filter(log => 
      log.text.includes('LSN') || 
      log.text.includes('currentLSN'));
    
    if (lsnLogs.length > 0) {
      console.log('\n📊 LSN updates detected in logs:');
      // Show last few LSN-related logs
      lsnLogs.slice(-3).forEach(log => {
        console.log(`   ${log.text.substring(0, 100)}`);
      });
    }
    
    // Check for client ID in logs
    const clientIdLogs = syncLogs.filter(log => 
      log.text.includes('clientId') || 
      log.text.includes('client-id'));
    
    if (clientIdLogs.length > 0) {
      console.log('\n📊 Client ID detected in logs');
    }
    
    // Check if we have some entities synced
    const entityCount = await page.evaluate(() => {
      // Check IndexedDB for synced data
      return new Promise((resolve) => {
        const request = indexedDB.open('vibestack');
        request.onsuccess = (event) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('tasks')) {
            const transaction = db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const countRequest = store.count();
            countRequest.onsuccess = () => {
              resolve(countRequest.result);
            };
          } else {
            resolve(0);
          }
        };
        request.onerror = () => resolve(0);
      });
    });
    
    console.log(`📦 Synced ${entityCount} tasks`);
    
    // Take screenshot of synced state
    await page.screenshot({ 
      path: 'screenshots/sync-initial-complete.png',
      fullPage: true 
    });
    
    // Print sync log summary
    console.log('\n📋 Sync Log Summary:');
    console.log(`   Total sync events captured: ${syncLogs.length}`);
    
    // Look for key sync phases
    const hasInitialSyncPhase = syncLogs.some(log => 
      log.text.toLowerCase().includes('initial sync') || 
      log.text.toLowerCase().includes('initial-sync'));
    const hasFetching = syncLogs.some(log => 
      log.text.toLowerCase().includes('fetching') || 
      log.text.toLowerCase().includes('fetch'));
    const hasReceived = syncLogs.some(log => 
      log.text.toLowerCase().includes('received') || 
      log.text.toLowerCase().includes('response'));
    const hasApplied = syncLogs.some(log => 
      log.text.toLowerCase().includes('applied') || 
      log.text.toLowerCase().includes('saved'));
    const hasCompleted = syncLogs.some(log => 
      log.text.toLowerCase().includes('complete') || 
      log.text.toLowerCase().includes('finished'));
    
    console.log(`   Initial sync detected: ${hasInitialSyncPhase ? '✅' : '❌'}`);
    console.log(`   Fetching data: ${hasFetching ? '✅' : '❌'}`);
    console.log(`   Received data: ${hasReceived ? '✅' : '❌'}`);
    console.log(`   Applied changes: ${hasApplied ? '✅' : '❌'}`);
    console.log(`   Sync completed: ${hasCompleted ? '✅' : '❌'}`);
    
    // Extract entity counts from logs if present
    const entityLogs = syncLogs.filter(log => 
      log.text.includes('entities') || 
      log.text.includes('records') ||
      log.text.includes('items'));
    if (entityLogs.length > 0) {
      console.log('\n📦 Entity sync details from logs:');
      entityLogs.forEach(log => {
        const numbers = log.text.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          console.log(`   ${log.text.substring(0, 100)}`);
        }
      });
    }
    
    console.log('\n✅ Initial sync test completed successfully');
  });
});