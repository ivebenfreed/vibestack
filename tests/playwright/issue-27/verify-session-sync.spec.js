// Verify session is fully logged in and sync system is stabilized
import { test, expect } from '@playwright/test';
import { waitForSync } from '../core/db-test-helpers.js';

test.describe('Session and Sync Verification', () => {
  test.setTimeout(60000);
  
  test('verify logged in session and sync is active', async ({ page }) => {
    console.log('🔍 Starting session and sync verification...');
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Check authentication status
    const isAuthenticated = await page.evaluate(() => {
      const path = window.location.pathname;
      const hasLoginForm = document.querySelector('input[type="email"], input[name="email"]');
      return !(path.includes('/login') || 
               path.includes('/sign-in') ||
               path.includes('/handler') || 
               hasLoginForm);
    });
    
    console.log(`🔐 Authentication status: ${isAuthenticated ? 'Logged in' : 'Not logged in'}`);
    expect(isAuthenticated).toBe(true);
    
    // Wait for sync to stabilize using core helper
    console.log('🔄 Waiting for sync system to stabilize...');
    await waitForSync(page, 15000);
    
    // Get sync state details
    const syncState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📊 Sync State:', {
      currentLSN: syncState.currentLSN,
      clientId: syncState.context?.clientId || syncState.clientId
    });
    
    // Verify sync is working
    expect(syncState.currentLSN).toBeTruthy();
    expect(syncState.currentLSN).not.toBe('0/0');
    
    // Check console logs for sync activity
    const consoleLogs = await page.evaluate(() => {
      return window.consoleLogs || [];
    });
    
    // Take screenshot of verified state
    await page.screenshot({ 
      path: 'screenshots/session-sync-verified.png',
      fullPage: true 
    });
    
    console.log('✅ Session is fully logged in');
    console.log(`✅ Sync system is active with LSN: ${syncState.currentLSN}`);
    console.log('📸 Screenshot saved: screenshots/session-sync-verified.png');
    
    // Summary
    console.log('\n📋 VERIFICATION SUMMARY:');
    console.log('   ✅ Authenticated: YES');
    console.log(`   ✅ Sync LSN: ${syncState.currentLSN}`);
    console.log('   ✅ Sync Active: YES (LSN is not 0/0)');
  });
});