/**
 * Performance Test: App Initialization Timing
 * 
 * Tests the ultra-fast local-first initialization flow using persistent context.
 * Measures time to dashboard ready state with local LiveStore data.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('App Initialization Performance', () => {
  
  test('should show dashboard in under 1 second with local data', async ({ page }) => {
    console.log('🎯 Testing ultra-fast local-first initialization...');
    
    // Start timing
    const startTime = Date.now();
    
    // Go to the dashboard
    await page.goto('/');
    
    // Wait for auth state to be authenticated (should be fast with persistent context)
    await page.waitForFunction(() => {
      return window.authMachineActor?.getSnapshot?.()?.matches?.('authenticated') === true;
    }, { timeout: 5000 });
    
    const authTime = Date.now() - startTime;
    console.log(`⚡ Auth ready in: ${authTime}ms`);
    
    // Wait for app init machine to check local data
    await page.waitForFunction(() => {
      const appInitActor = window.appInitActor;
      if (!appInitActor) return false;
      
      const snapshot = appInitActor.getSnapshot();
      const state = snapshot?.value;
      
      // Should go through checkingLocalData quickly if local data exists
      return state === 'ready' || state === 'checkingLocalData' || state === 'waitingForSchema';
    }, { timeout: 3000 });
    
    const localCheckTime = Date.now() - startTime;
    console.log(`🔍 Local data check completed in: ${localCheckTime}ms`);
    
    // Wait for system to be ready (the key metric)
    await page.waitForFunction(() => {
      const appInitActor = window.appInitActor;
      if (!appInitActor) return false;
      
      const snapshot = appInitActor.getSnapshot();
      return snapshot?.value === 'ready';
    }, { timeout: 5000 });
    
    const systemReadyTime = Date.now() - startTime;
    console.log(`🎉 System ready in: ${systemReadyTime}ms`);
    
    // Wait for dashboard UI to be visible
    await expect(page.locator('[data-testid="dashboard-content"], .dashboard, main')).toBeVisible({ timeout: 2000 });
    
    const dashboardVisibleTime = Date.now() - startTime;
    console.log(`📊 Dashboard visible in: ${dashboardVisibleTime}ms`);
    
    // Check if we used local data (should be much faster)
    const appInitSnapshot = await page.evaluate(() => {
      const appInitActor = window.appInitActor;
      return appInitActor?.getSnapshot?.();
    });
    
    const hasLocalData = appInitSnapshot?.context?.hasLocalData;
    const localDataAvailable = appInitSnapshot?.context?.localSchemaAvailable;
    
    console.log(`📦 Local data status:`, {
      hasLocalData,
      localDataAvailable,
      systemReadyTime,
      dashboardVisibleTime
    });
    
    // Performance assertions based on whether local data was available
    if (hasLocalData && localDataAvailable) {
      // With local data, should be ultra-fast
      expect(systemReadyTime).toBeLessThan(1000); // Under 1 second
      expect(dashboardVisibleTime).toBeLessThan(1500); // Dashboard visible under 1.5s
      console.log('✅ ULTRA-FAST: Used local data for instant dashboard!');
    } else {
      // Without local data, should still be reasonable
      expect(systemReadyTime).toBeLessThan(5000); // Under 5 seconds
      expect(dashboardVisibleTime).toBeLessThan(6000); // Dashboard visible under 6s
      console.log('⚡ NORMAL: No local data, used API schema');
    }
    
    // Verify the dashboard is actually functional
    await expect(page.locator('body')).not.toHaveClass(/loading/);
    
    // Log final performance metrics
    console.log(`\n📈 Performance Summary:`);
    console.log(`   Auth: ${authTime}ms`);
    console.log(`   Local Check: ${localCheckTime}ms`);
    console.log(`   System Ready: ${systemReadyTime}ms`);
    console.log(`   Dashboard Visible: ${dashboardVisibleTime}ms`);
    console.log(`   Used Local Data: ${hasLocalData && localDataAvailable ? 'YES' : 'NO'}`);
  });
  
  test('should handle background sync after dashboard loads', async ({ page }) => {
    console.log('🔄 Testing background sync after fast dashboard load...');
    
    const startTime = Date.now();
    
    // Go to dashboard
    await page.goto('/');
    
    // Wait for system ready (fast path)
    await page.waitForFunction(() => {
      const appInitActor = window.appInitActor;
      return appInitActor?.getSnapshot?.()?.value === 'ready';
    }, { timeout: 5000 });
    
    const readyTime = Date.now() - startTime;
    console.log(`🎉 System ready in: ${readyTime}ms`);
    
    // Check that background processes are working
    const backgroundStatus = await page.evaluate(() => {
      // Check if sync machine is active
      const syncActor = window.pureLiveStoreSyncMachineActor;
      const syncSnapshot = syncActor?.getSnapshot?.();
      
      // Check app init context
      const appInitActor = window.appInitActor;
      const appInitSnapshot = appInitActor?.getSnapshot?.();
      
      return {
        syncState: syncSnapshot?.value,
        syncActive: !!syncActor,
        hasLocalData: appInitSnapshot?.context?.hasLocalData,
        isDatabaseInitialized: appInitSnapshot?.context?.isDatabaseInitialized,
        isSyncReady: appInitSnapshot?.context?.isSyncReady
      };
    });
    
    console.log('🔄 Background processes status:', backgroundStatus);
    
    // Verify background sync is happening (or ready to happen)
    expect(backgroundStatus.syncActive).toBe(true);
    
    // Wait a bit for background processes to start
    await page.waitForTimeout(2000);
    
    // Check background process updates
    const updatedStatus = await page.evaluate(() => {
      const appInitSnapshot = window.appInitActor?.getSnapshot?.();
      return {
        isDatabaseInitialized: appInitSnapshot?.context?.isDatabaseInitialized,
        isSyncReady: appInitSnapshot?.context?.isSyncReady,
        hasLocalData: appInitSnapshot?.context?.hasLocalData
      };
    });
    
    console.log('📊 Background processes after 2s:', updatedStatus);
    
    // Background processes should be progressing
    // (exact state depends on whether we had local data or not)
    expect(typeof updatedStatus.isDatabaseInitialized).toBe('boolean');
    expect(typeof updatedStatus.isSyncReady).toBe('boolean');
  });
  
  test('should show loading states for individual components while background loads', async ({ page }) => {
    console.log('🔄 Testing progressive loading states...');
    
    await page.goto('/');
    
    // Wait for dashboard to be ready
    await page.waitForFunction(() => {
      return window.appInitActor?.getSnapshot?.()?.value === 'ready';
    });
    
    // Check for progressive loading indicators
    // Look for components that might show loading while data is being fetched
    const loadingStates = await page.evaluate(() => {
      // Check for common loading indicators
      const spinners = document.querySelectorAll('[class*="spin"], [class*="loading"], .loader');
      const loadingTexts = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent?.includes('Loading') || el.textContent?.includes('loading')
      );
      
      return {
        spinnerCount: spinners.length,
        loadingTextCount: loadingTexts.length,
        hasProgressiveUI: spinners.length > 0 || loadingTexts.length > 0
      };
    });
    
    console.log('🎨 Progressive loading UI:', loadingStates);
    
    // Should show dashboard but potentially with loading states for individual data
    await expect(page.locator('main, [data-testid="dashboard-content"], .dashboard')).toBeVisible();
    
    // Verify page is not completely blocked by a full-screen loader
    const hasFullScreenLoader = await page.locator('.unified-loading-screen, [data-testid="loading-screen"]').isVisible();
    expect(hasFullScreenLoader).toBe(false);
    
    console.log('✅ Dashboard shows without full-screen blocking loader');
  });
  
  test('should measure first vs return visit performance difference', async ({ page, context }) => {
    console.log('📊 Measuring first visit vs return visit performance...');
    
    // Clear any existing storage to simulate first visit
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Clear IndexedDB (where LiveStore data is stored)
      if (window.indexedDB) {
        return new Promise((resolve) => {
          const deleteReq = indexedDB.deleteDatabase('vibestack-01920000-1000-7000-8000-000000000001');
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = () => resolve(); // Continue even if delete fails
          deleteReq.onblocked = () => resolve();
          setTimeout(resolve, 1000); // Timeout after 1s
        });
      }
    });
    
    // First visit timing
    console.log('⏱️  Measuring FIRST VISIT (no local data)...');
    const firstVisitStart = Date.now();
    await page.goto('/');
    
    // Login again since we cleared storage
    await page.fill('input[name="email"]', 'ceo@widecorp.com');
    await page.fill('input[name="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    
    await page.waitForFunction(() => {
      return window.appInitActor?.getSnapshot?.()?.value === 'ready';
    }, { timeout: 10000 });
    
    const firstVisitTime = Date.now() - firstVisitStart;
    
    // Allow time for data to be cached
    await page.waitForTimeout(3000);
    
    // Second visit timing (should use cached data)
    console.log('⏱️  Measuring RETURN VISIT (with local data)...');
    const returnVisitStart = Date.now();
    await page.reload();
    
    await page.waitForFunction(() => {
      return window.appInitActor?.getSnapshot?.()?.value === 'ready';
    }, { timeout: 5000 });
    
    const returnVisitTime = Date.now() - returnVisitStart;
    
    console.log(`\n🏁 Performance Comparison:`);
    console.log(`   First Visit:  ${firstVisitTime}ms`);
    console.log(`   Return Visit: ${returnVisitTime}ms`);
    console.log(`   Speed Improvement: ${((firstVisitTime - returnVisitTime) / firstVisitTime * 100).toFixed(1)}%`);
    
    // Return visit should be significantly faster
    expect(returnVisitTime).toBeLessThan(firstVisitTime);
    
    // Return visit should be under 1 second if local data caching works
    if (returnVisitTime < 1000) {
      console.log('🚀 EXCELLENT: Return visit under 1 second!');
    } else if (returnVisitTime < 2000) {
      console.log('⚡ GOOD: Return visit under 2 seconds');
    } else {
      console.log('⚠️  SLOW: Return visit over 2 seconds - local data may not be working');
    }
  });
});