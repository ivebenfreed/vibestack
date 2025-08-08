import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Sync Initialization Debug', () => {
  
  test('check what happens during sync initialization', async ({ page }) => {
    // Capture ALL console logs during page load
    const allLogs = [];
    page.on('console', msg => {
      allLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Capture errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.toString());
    });
    
    console.log('🔍 Loading page and capturing all logs...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for page to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 15000 }
    );
    
    console.log('\n=== ALL CONSOLE LOGS DURING INITIALIZATION ===');
    allLogs.forEach((log, i) => {
      console.log(`${i + 1}. ${log}`);
    });
    
    if (errors.length > 0) {
      console.log('\n=== PAGE ERRORS ===');
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    // Check if sync-related modules are loaded
    const syncModuleCheck = await page.evaluate(async () => {
      try {
        // Check what sync-related modules can be imported
        const results = {};
        
        try {
          const changeTracking = await import('/src/db/dexie-change-tracking.js');
          results.changeTracking = {
            available: true,
            functions: Object.keys(changeTracking)
          };
        } catch (e) {
          results.changeTracking = { available: false, error: e.message };
        }
        
        try {
          const serviceCoordinator = await import('/src/sync/utils/ServiceCoordinator.js');
          results.serviceCoordinator = {
            available: true,
            exports: Object.keys(serviceCoordinator)
          };
        } catch (e) {
          results.serviceCoordinator = { available: false, error: e.message };
        }
        
        try {
          const dexieService = await import('/src/sync/DexieOutgoingChangeService.js');
          results.dexieService = {
            available: true,
            exports: Object.keys(dexieService)
          };
        } catch (e) {
          results.dexieService = { available: false, error: e.message };
        }
        
        try {
          const syncMachine = await import('/src/state-machines/machines/sync-machine-v3.js');
          results.syncMachine = {
            available: true,
            exports: Object.keys(syncMachine)
          };
        } catch (e) {
          results.syncMachine = { available: false, error: e.message };
        }
        
        return results;
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('\n=== SYNC MODULE AVAILABILITY ===');
    console.log(JSON.stringify(syncModuleCheck, null, 2));
    
    // Try to find any sync-related global state
    const globalCheck = await page.evaluate(() => {
      const globals = [];
      
      // Check for common sync-related global variables
      const checkKeys = ['syncMachine', 'vibestackSync', 'sync', 'dexie', 'services'];
      checkKeys.forEach(key => {
        if (window[key]) {
          globals.push(`window.${key}: ${typeof window[key]}`);
        }
      });
      
      return globals;
    });
    
    console.log('\n=== GLOBAL SYNC STATE ===');
    if (globalCheck.length > 0) {
      globalCheck.forEach(global => console.log(`  ${global}`));
    } else {
      console.log('  No sync-related globals found');
    }
    
    // Basic assertion - just verify the page loaded
    expect(allLogs.length).toBeGreaterThan(0);
  });
  
});