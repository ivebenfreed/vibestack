/**
 * Debug test to verify we can control sync state
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('debug sync state control', async ({ page }) => {
  console.log('🔬 Testing sync state control...\n');
  
  // Navigate to app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Test 1: Get current state
  const currentState = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      return window.testSyncHelpers.getSyncState();
    }
    return null;
  });
  console.log('📊 Current state:', currentState);
  
  // Test 2: Reset to fresh state
  console.log('\n🧹 Testing reset to fresh state...');
  const resetSuccess = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      return window.testSyncHelpers.resetToFreshState();
    }
    return false;
  });
  console.log('   Reset success:', resetSuccess);
  
  // Verify state is cleared
  const afterReset = await page.evaluate(() => {
    return localStorage.getItem('sync-machine-state');
  });
  console.log('   State after reset:', afterReset);
  
  // Test 3: Force set specific state
  console.log('\n🔧 Testing force set state...');
  const forceSetSuccess = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      return window.testSyncHelpers.forceSetSyncState('0/1000000', 'test-client-123');
    }
    return false;
  });
  console.log('   Force set success:', forceSetSuccess);
  
  // Verify new state
  const newState = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      return window.testSyncHelpers.getSyncState();
    }
    return null;
  });
  console.log('   New state:', newState);
  
  // Test 4: Reload and check persistence
  console.log('\n🔄 Testing persistence after reload...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  const stateAfterReload = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      return window.testSyncHelpers.getSyncState();
    }
    return null;
  });
  console.log('   State after reload:', stateAfterReload);
  
  // Verify we can control the state
  expect(stateAfterReload).toBeTruthy();
  expect(stateAfterReload.currentLSN).toBe('0/1000000');
  expect(stateAfterReload.clientId).toBe('test-client-123');
  
  console.log('\n✅ Sync state control working!');
});