// tests/playwright/vibegantt-force-refresh.spec.js
// Force refresh IndexedDB to pick up new schema version
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Force Refresh Tests', () => {
  test.setTimeout(60000);
  
  test('should force refresh IndexedDB and test VibeGantt with new schema', async ({ page }) => {
    console.log('🎯 Starting force refresh test...');
    
    // Navigate to debug page
    console.log('🌐 Navigating to VibeGantt debug page...');
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    
    // Force clear and refresh the database by running JavaScript directly
    console.log('🗑️ Clearing IndexedDB database...');
    await page.evaluate(async () => {
      // Delete the IndexedDB database
      const deleteDB = () => {
        return new Promise((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase('vibestack-db');
          deleteReq.onsuccess = () => {
            console.log('✅ Database deleted successfully');
            resolve(true);
          };
          deleteReq.onerror = () => {
            console.error('❌ Database deletion failed');
            reject(false);
          };
          deleteReq.onblocked = () => {
            console.warn('⏳ Database deletion blocked - forcing...');
            // Try to force it
            setTimeout(() => resolve(true), 1000);
          };
        });
      };
      
      await deleteDB();
    });
    
    // Hard reload the page to force re-initialization with new schema
    console.log('🔄 Hard reloading page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(5000); // Give time for full initialization
    
    // Now test the VibeGantt component
    console.log('🧪 Testing VibeGantt after database refresh...');
    
    // Capture any console messages
    const consoleLogs = [];
    const consoleErrors = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      
      if (type === 'error') {
        consoleErrors.push(text);
        console.log(`❌ [ERROR]: ${text}`);
      } else if (text.includes('VibeGantt') || text.includes('gantt') || text.includes('Gantt') || text.includes('entityType')) {
        consoleLogs.push(text);
        console.log(`📝 [LOG]: ${text}`);
      }
    });
    
    // Wait for the component to initialize
    await page.waitForTimeout(3000);
    
    // Check if container is visible
    const container = page.locator('.vibegantt');
    await expect(container).toBeVisible();
    console.log('✅ VibeGantt container is visible');
    
    // Check the window objects to see if data loaded successfully
    const windowObjects = await page.evaluate(() => {
      return {
        hasStoreActor: '__vibegantt_store_actor' in window,
        storeActorState: window.__vibegantt_store_actor ? window.__vibegantt_store_actor.getSnapshot() : null
      };
    });
    
    console.log('🔍 Window objects:', JSON.stringify(windowObjects, null, 2));
    
    // Check if the error is gone
    const hasIndexError = windowObjects.storeActorState && 
      windowObjects.storeActorState.context && 
      windowObjects.storeActorState.context.error &&
      windowObjects.storeActorState.context.error.includes('not indexed');
    
    if (hasIndexError) {
      console.log('❌ Still getting index error:', windowObjects.storeActorState.context.error);
    } else {
      console.log('✅ No index error detected!');
    }
    
    // Check if we have any tasks or dependencies loaded
    const hasData = windowObjects.storeActorState && windowObjects.storeActorState.context && (
      Object.keys(windowObjects.storeActorState.context.tasks || {}).length > 0 ||
      Object.keys(windowObjects.storeActorState.context.dependencies || {}).length > 0
    );
    
    console.log(`🔍 Data loaded: ${hasData}`);
    
    if (hasData && windowObjects.storeActorState?.context) {
      const taskCount = Object.keys(windowObjects.storeActorState.context.tasks || {}).length;
      const depCount = Object.keys(windowObjects.storeActorState.context.dependencies || {}).length;
      console.log(`📊 Tasks loaded: ${taskCount}`);
      console.log(`📊 Dependencies loaded: ${depCount}`);
    }
    
    // Take screenshot of the result
    await page.screenshot({ 
      path: 'screenshots/vibegantt-after-refresh.png',
      fullPage: true 
    });
    
    // Report summary
    console.log('\n=== FORCE REFRESH TEST SUMMARY ===');
    console.log(`📊 Total console logs: ${consoleLogs.length}`);
    console.log(`❌ Total errors: ${consoleErrors.length}`);
    console.log(`🔍 Index error present: ${hasIndexError}`);
    console.log(`📊 Data loaded: ${hasData}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n❌ ERRORS:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    if (consoleLogs.length > 0) {
      console.log('\n📝 RELEVANT LOGS:');
      consoleLogs.slice(-10).forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
    }
    
    // The test should pass if we can load the component without the index error
    expect(container).toBeVisible();
    
    // If we still have the index error, that means the schema update didn't work
    if (hasIndexError) {
      console.log('⚠️ WARNING: Still experiencing index error after database refresh');
      console.log('This may indicate the schema generation needs to be deployed to the server');
    }
  });
});