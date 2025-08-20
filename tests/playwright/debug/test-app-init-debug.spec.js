/**
 * Debug Test: Check current app initialization state
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug app initialization state', async ({ page }) => {
  console.log('🔍 Debugging app initialization state...');
  
  // Setup logging BEFORE page loads
  const logs = [];
  const allLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(`${msg.type()}: ${text}`);
    console.log(`[Browser ${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      logs.push(text);
    }
  });
  
  // Capture page errors  
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log(`[Page Error] ${error.message}`);
  });
  
  await page.goto('/');
  
  // Wait a bit for any initial loading and logging
  await page.waitForTimeout(3000);
  
  // Check what actors exist
  const actors = await page.evaluate(() => {
    return {
      authMachineActor: !!window.authMachineActor,
      appInitActor: !!window.appInitActor,
      pureLiveStoreSyncMachineActor: !!window.pureLiveStoreSyncMachineActor,
      authState: window.authMachineActor?.getSnapshot?.()?.value,
      authContext: window.authMachineActor?.getSnapshot?.()?.context,
      appInitState: window.appInitActor?.getSnapshot?.()?.value,
      appInitContext: window.appInitActor?.getSnapshot?.()?.context,
      playwrightReady: document.body.getAttribute('data-playwright-ready'),
      currentUrl: window.location.href,
      title: document.title
    };
  });
  
  console.log('🎭 Actors state:', actors);
  
  if (logs.length > 0) {
    console.log('❌ Console errors found:', logs);
  } else {
    console.log('✅ No console errors detected');
  }
  
  if (pageErrors.length > 0) {
    console.log('💥 Page errors found:', pageErrors);
  }
  
  // Check if dashboard is visible
  const dashboardVisible = await page.locator('[data-testid="dashboard-content"]').isVisible();
  console.log('📊 Dashboard visible:', dashboardVisible);
  
  // Check loading screens  
  const loadingScreens = await page.evaluate(() => {
    const unifiedLoading = document.querySelector('.unified-loading-screen');
    return {
      unifiedLoadingVisible: !!unifiedLoading && !unifiedLoading.hidden,
      hasUnifiedLoadingScreen: !!unifiedLoading
    };
  });
  
  console.log('⏳ Loading state:', loadingScreens);
  
  // Show summary
  console.log('\n📋 Summary:', {
    actorsCreated: actors.authMachineActor && actors.appInitActor,
    dashboardVisible: dashboardVisible,
    errorsFound: logs.length > 0,
    pageErrors: pageErrors.length > 0
  });
  
  // Always pass - this is diagnostic
  expect(true).toBe(true);
});