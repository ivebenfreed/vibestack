/**
 * Detailed debugging of LiveStore initialization
 */

import { test } from './helpers/fixtures/persistent-context.js';

test.describe('LiveStore Detailed Debug', () => {
  test('debug LiveStore initialization step by step', async ({ page }) => {
    console.log('🔍 Detailed LiveStore debugging...');
    
    // Navigate and wait for initial setup
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Listen for all console messages
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log('🖥️  Browser:', text);
    });
    
    // Monitor for errors
    page.on('pageerror', error => {
      console.error('💥 Page Error:', error.message);
    });
    
    // Wait longer for initialization
    await page.waitForTimeout(15000);
    
    // Check if schema loading is working
    const schemaCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/schema', {
          credentials: 'include'
        });
        const data = await response.json();
        return {
          success: response.ok,
          status: response.status,
          entityCount: Object.keys(data.schema?.entities || {}).length,
          entities: Object.keys(data.schema?.entities || {}),
          schema: data.schema
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('📋 Schema Check:', JSON.stringify(schemaCheck, null, 2));
    
    // Try to access LiveStore instances
    const liveStoreDebug = await page.evaluate(() => {
      const debug = {};
      
      // Check for global LiveStore references
      if (window.liveStore) debug.windowLiveStore = 'exists';
      if (window.__LIVESTORE_INSTANCES__) debug.instances = window.__LIVESTORE_INSTANCES__;
      if (window.__SYNC_MACHINE_DEBUG__) {
        const machine = window.__SYNC_MACHINE_DEBUG__;
        debug.syncMachine = {
          exists: true,
          state: machine.getSnapshot?.()?.value,
          context: machine.getSnapshot?.()?.context
        };
      }
      
      // Check for any LiveStore-related objects
      const liveStoreKeys = Object.keys(window).filter(key => 
        key.toLowerCase().includes('livestore') || 
        key.toLowerCase().includes('sync')
      );
      if (liveStoreKeys.length > 0) {
        debug.liveStoreKeys = liveStoreKeys;
      }
      
      return debug;
    });
    
    console.log('🔍 LiveStore Debug:', JSON.stringify(liveStoreDebug, null, 2));
    
    // Check for specific error patterns in logs
    const errors = logs.filter(log => 
      log.includes('error') || 
      log.includes('Error') || 
      log.includes('failed') || 
      log.includes('Failed')
    );
    
    if (errors.length > 0) {
      console.log('❌ Errors found in logs:');
      errors.forEach(error => console.log('   ', error));
    }
    
    // Check for LiveStore-specific logs
    const liveStoreLogs = logs.filter(log => 
      log.includes('LiveStore') || 
      log.includes('livestore') ||
      log.includes('PureLiveStoreServiceCoordinator')
    );
    
    console.log('📝 LiveStore-specific logs:');
    liveStoreLogs.forEach(log => console.log('   ', log));
    
    // Summary
    const hasEntities = schemaCheck.entityCount > 0;
    const hasErrors = errors.length > 0;
    const syncState = liveStoreDebug.syncMachine?.state;
    
    console.log('\n📊 Debug Summary:');
    console.log('   Schema entities:', schemaCheck.entityCount);
    console.log('   Sync machine state:', syncState);
    console.log('   Errors found:', errors.length);
    console.log('   LiveStore instances:', Object.keys(liveStoreDebug).length);
    
    if (hasEntities && !hasErrors && syncState) {
      console.log('✅ Everything looks good - LiveStore should be working');
    } else {
      console.log('⚠️  Issues detected - LiveStore may not be initializing properly');
    }
  });
});