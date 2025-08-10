// Check for console errors in the app
import { test, expect } from '../fixtures/persistent-context.js';

test('check for console errors', async ({ page }) => {
  const errors = [];
  const warnings = [];
  const logs = [];
  
  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    } else if (msg.type() === 'log' && msg.text().includes('[')) {
      // Capture logs with brackets (likely debug logs)
      logs.push(msg.text());
    }
  });
  
  // Navigate to app
  await page.goto('/');
  
  // Wait a bit for app to initialize
  await page.waitForTimeout(5000);
  
  // Check sync-related items in window
  const syncInfo = await page.evaluate(() => {
    return {
      hasSyncActor: !!window.syncMachineActor,
      hasAuthActor: !!window.authMachineActor,
      syncState: localStorage.getItem('sync-machine-state'),
      authState: localStorage.getItem('auth-machine-state'),
      hasWebSocket: typeof WebSocket !== 'undefined',
      wsReadyState: window.ws?.readyState,
    };
  });
  
  console.log('🔍 Sync Info:', syncInfo);
  console.log('❌ Console Errors:', errors);
  console.log('⚠️ Console Warnings:', warnings);
  console.log('📝 Debug Logs (first 10):', logs.slice(0, 10));
  
  // Check if sync is disabled
  if (!syncInfo.hasSyncActor) {
    console.log('⚠️ Sync machine actor not found in window');
  }
  
  if (!syncInfo.syncState) {
    console.log('⚠️ No sync state in localStorage');
  }
  
  // Look for XState or auth-related logs
  const xstateLogs = logs.filter(log => log.includes('[XSTATE]') || log.includes('[Auth]'));
  if (xstateLogs.length > 0) {
    console.log('🎯 XState/Auth Logs:', xstateLogs);
  }
  
  expect(errors.length).toBe(0);
  expect(warnings.length).toBe(0);
});