/**
 * Debug Auth UI Disconnect
 * 
 * Figure out why the UI shows login page even when AuthMachine shows needsOrganizationSelection
 */

import { test, expect } from '@playwright/test';

test('Debug auth state vs UI disconnect', async ({ page }) => {
  console.log('🔍 Debugging auth state vs UI disconnect...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[BROWSER] ${text}`);
  });
  
  // Navigate to sign-in
  await page.goto('http://localhost:5173/sign-in');
  
  // Clear localStorage
  await page.evaluate(() => {
    localStorage.removeItem('vibestack-last-organization-id');
    localStorage.removeItem('auth-machine-state');
  });
  
  // Sign in
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  // Wait and check state every 2 seconds
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(2000);
    
    const authState = await page.evaluate(() => {
      try {
        const state = localStorage.getItem('auth-machine-state');
        return state ? JSON.parse(state) : null;
      } catch {
        return null;
      }
    });
    
    const currentUrl = page.url();
    const pageTitle = await page.title();
    const hasLoginForm = await page.locator('input[type="email"]').isVisible().catch(() => false);
    const hasOrgSelection = await page.locator('text=Select Organization').isVisible().catch(() => false);
    
    console.log(`\\n🔍 Check ${i + 1}:`);
    console.log(`   URL: ${currentUrl}`);
    console.log(`   Title: ${pageTitle}`);
    console.log(`   Auth State: ${authState?.value || 'none'}`);
    console.log(`   Has Login Form: ${hasLoginForm}`);
    console.log(`   Has Org Selection: ${hasOrgSelection}`);
    
    if (hasOrgSelection) {
      console.log('✅ Organization selection screen found!');
      break;
    }
    
    if (authState?.value === 'needsOrganizationSelection' && !hasOrgSelection) {
      console.log('🚨 MISMATCH: AuthMachine says needsOrganizationSelection but UI shows login!');
      
      // Check what the body actually contains
      const bodyText = await page.textContent('body');
      console.log(`📄 Body content preview: ${bodyText.substring(0, 300)}...`);
      
      // Check if there are any React errors
      const reactErrors = consoleLogs.filter(log => 
        log.includes('Error:') || log.includes('Warning:') || log.includes('React')
      );
      
      if (reactErrors.length > 0) {
        console.log('⚠️ React errors found:');
        reactErrors.forEach(error => console.log(`   - ${error}`));
      }
    }
  }
  
  // Final analysis
  const finalAuthState = await page.evaluate(() => {
    try {
      const state = localStorage.getItem('auth-machine-state');
      return state ? JSON.parse(state) : null;
    } catch {
      return null;
    }
  });
  
  const finalUrl = page.url();
  const finalHasOrgSelection = await page.locator('text=Select Organization').isVisible().catch(() => false);
  
  await page.screenshot({ path: 'auth-ui-disconnect-debug.png' });
  
  console.log('\\n=== FINAL ANALYSIS ===');
  console.log(`Auth State: ${finalAuthState?.value}`);
  console.log(`URL: ${finalUrl}`);
  console.log(`Org Selection Visible: ${finalHasOrgSelection}`);
  
  if (finalAuthState?.value === 'needsOrganizationSelection' && !finalHasOrgSelection) {
    console.log('🚨 CONFIRMED BUG: Auth state and UI are out of sync!');
  } else if (finalHasOrgSelection) {
    console.log('✅ SUCCESS: Organization selection screen working!');
  } else {
    console.log('⚠️ UNCLEAR: Need to investigate further');
  }
  
  console.log('========================');
  
  // This test always passes - it's just for debugging
  expect(true).toBe(true);
});