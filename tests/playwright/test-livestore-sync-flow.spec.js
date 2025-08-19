/**
 * Test LiveStore sync initialization with Wide Corp data
 */

import { test } from './helpers/fixtures/persistent-context.js';

test.describe('LiveStore Sync Flow', () => {
  test('verify Wide Corp sync initialization', async ({ page }) => {
    console.log('🚀 Testing LiveStore sync flow with Wide Corp...');
    
    // Navigate to root and wait for app initialization
    await page.goto('/');
    await page.waitForTimeout(5000); // Give more time for sync initialization
    
    // Monitor LiveStore initialization in browser console
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('LiveStore') || text.includes('sync') || text.includes('initialized')) {
        logs.push(text);
        console.log('📱 Browser:', text);
      }
    });
    
    // Wait for sync to initialize
    await page.waitForTimeout(10000);
    
    // Check if LiveStore instances were created
    const liveStoreStatus = await page.evaluate(() => {
      // Access sync machine state if available
      const syncMachine = window.__SYNC_MACHINE_DEBUG__;
      if (syncMachine) {
        return {
          state: syncMachine.getSnapshot?.()?.value || 'unknown',
          context: syncMachine.getSnapshot?.()?.context || {}
        };
      }
      
      return { error: 'Sync machine not available' };
    });
    
    console.log('🎰 Sync Machine State:', JSON.stringify(liveStoreStatus, null, 2));
    
    // Check database for Wide Corp data
    const wideCorp = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/db/kysely-test', {
          credentials: 'include'
        });
        const result = await response.json();
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('🏢 Wide Corp Database Check:', JSON.stringify(wideCorp, null, 2));
    
    // Check for any LiveStore instances
    const liveStoreInstances = await page.evaluate(() => {
      // Look for any LiveStore instances in global scope
      const instances = [];
      if (window.liveStore) instances.push('window.liveStore');
      if (window.__LIVESTORE_INSTANCES__) instances.push('window.__LIVESTORE_INSTANCES__');
      
      return instances;
    });
    
    console.log('🔍 LiveStore Instances Found:', liveStoreInstances);
    
    console.log('📊 Summary:');
    console.log('  - Sync State:', liveStoreStatus.state);
    console.log('  - Database Users:', wideCorp.data?.userCount || 'unknown');
    console.log('  - LiveStore Instances:', liveStoreInstances.length);
  });
});