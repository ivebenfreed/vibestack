/**
 * Simple App Init Performance Test
 * 
 * Tests the ultra-fast local-first initialization after login.
 * Does not rely on persistent auth - logs in fresh each time.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('measure app initialization performance after login', async ({ page }) => {
  console.log('🎯 Testing app initialization performance after login...');
  
  // Go to sign-in page
  await page.goto('/sign-in');
  
  // Fill in credentials
  await page.fill('input[name="email"]', 'ceo@widecorp.com');
  await page.fill('input[name="password"]', 'WideCorp2024!CEO');
  
  // Start timing from login submission
  console.log('⏱️ Starting timing from login submission...');
  const startTime = Date.now();
  
  await page.click('button[type="submit"]');
  
  // Wait for auth state to be authenticated
  await page.waitForFunction(() => {
    return window.authMachineActor?.getSnapshot?.()?.matches?.('authenticated') === true;
  }, { timeout: 10000 });
  
  const authTime = Date.now() - startTime;
  console.log(`✅ Auth completed in: ${authTime}ms`);
  
  // Wait for organization to be available
  await page.waitForFunction(() => {
    const authSnapshot = window.authMachineActor?.getSnapshot?.();
    return authSnapshot?.context?.currentOrganization?.id;
  }, { timeout: 5000 });
  
  const orgTime = Date.now() - startTime;
  console.log(`🏢 Organization ready in: ${orgTime}ms`);
  
  // Wait for app init to start (should trigger automatically)
  await page.waitForFunction(() => {
    const appInitActor = window.appInitActor;
    const snapshot = appInitActor?.getSnapshot?.();
    return snapshot?.value !== 'idle';
  }, { timeout: 3000 });
  
  const appInitStartTime = Date.now() - startTime;
  console.log(`🚀 App init started in: ${appInitStartTime}ms`);
  
  // Check what path the app init takes (local vs API)
  const appInitState = await page.evaluate(() => {
    const appInitActor = window.appInitActor;
    const snapshot = appInitActor?.getSnapshot?.();
    return {
      state: snapshot?.value,
      hasLocalData: snapshot?.context?.hasLocalData,
      localDataChecked: snapshot?.context?.localDataChecked,
      localSchemaAvailable: snapshot?.context?.localSchemaAvailable
    };
  });
  
  console.log(`📊 App init state: ${appInitState.state}`, {
    hasLocalData: appInitState.hasLocalData,
    localDataChecked: appInitState.localDataChecked,
    localSchemaAvailable: appInitState.localSchemaAvailable
  });
  
  // Wait for app init to reach ready state
  await page.waitForFunction(() => {
    const appInitActor = window.appInitActor;
    return appInitActor?.getSnapshot?.()?.value === 'ready';
  }, { timeout: 30000 });
  
  const systemReadyTime = Date.now() - startTime;
  console.log(`🎉 System ready in: ${systemReadyTime}ms`);
  
  // Wait for dashboard to be visible
  await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible({ timeout: 5000 });
  
  const dashboardTime = Date.now() - startTime;
  console.log(`📊 Dashboard visible in: ${dashboardTime}ms`);
  
  // Check final state
  const finalState = await page.evaluate(() => {
    const appInitSnapshot = window.appInitActor?.getSnapshot?.();
    const authSnapshot = window.authMachineActor?.getSnapshot?.();
    return {
      appInitState: appInitSnapshot?.value,
      authState: authSnapshot?.value,
      hasLocalData: appInitSnapshot?.context?.hasLocalData,
      organizationId: appInitSnapshot?.context?.organizationId,
      playwrightReady: document.body.getAttribute('data-playwright-ready')
    };
  });
  
  console.log('\n📈 Performance Summary:');
  console.log(`   Auth: ${authTime}ms`);
  console.log(`   Organization: ${orgTime}ms`);
  console.log(`   App Init Start: ${appInitStartTime}ms`);
  console.log(`   System Ready: ${systemReadyTime}ms`);
  console.log(`   Dashboard Visible: ${dashboardTime}ms`);
  console.log(`   Used Local Data: ${finalState.hasLocalData ? 'YES' : 'NO'}`);
  console.log(`   Final State: ${finalState.appInitState}`);
  
  // Performance assertions
  if (finalState.hasLocalData) {
    // With local data, should be faster
    expect(systemReadyTime).toBeLessThan(5000); // Under 5 seconds total
    expect(dashboardTime - orgTime).toBeLessThan(2000); // Dashboard after org under 2s
    console.log('✅ LOCAL-FIRST: Used cached data for fast loading!');
  } else {
    // Without local data, should still be reasonable
    expect(systemReadyTime).toBeLessThan(10000); // Under 10 seconds total
    expect(dashboardTime).toBeLessThan(15000); // Dashboard under 15s
    console.log('⚡ API-FIRST: No local data, used API schema');
  }
  
  // Verify system is fully functional
  expect(finalState.appInitState).toBe('ready');
  expect(finalState.authState).toBe('authenticated');
  expect(finalState.organizationId).toBeTruthy();
  expect(finalState.playwrightReady).toBe('true');
  
  console.log('🎉 Ultra-fast initialization test completed successfully!');
});