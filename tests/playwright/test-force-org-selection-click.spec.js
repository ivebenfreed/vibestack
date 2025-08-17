/**
 * Force Organization Selection Click
 * 
 * Wait for org selection screen and force the click to debug the 403 issue
 */

import { test, expect } from '@playwright/test';

test('Force organization selection click and debug 403', async ({ page }) => {
  console.log('🔍 Force organization selection click to debug 403...');
  
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
  
  // Wait up to 15 seconds for organization selection to appear
  let orgSelectionFound = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const hasOrgSelection = await page.locator('text=Select Organization').isVisible().catch(() => false);
    if (hasOrgSelection) {
      orgSelectionFound = true;
      console.log(`✅ Organization selection found after ${i + 1} seconds`);
      break;
    }
    console.log(`⏱️ Waiting... ${i + 1}/15 seconds`);
  }
  
  if (!orgSelectionFound) {
    console.log('❌ Organization selection never appeared');
    await page.screenshot({ path: 'no-org-selection.png' });
    expect(orgSelectionFound).toBe(true);
    return;
  }
  
  // Click on Wide Corp Solutions
  console.log('👆 Clicking on Wide Corp Solutions...');
  await page.locator('text=Wide Corp Solutions').click();
  
  // Wait for the API call and response
  console.log('⏱️ Waiting for API response...');
  await page.waitForTimeout(5000);
  
  // Check for 403 errors in console
  const has403Error = consoleLogs.some(log => 
    log.includes('Failed to select organization') || log.includes('Forbidden')
  );
  
  await page.screenshot({ path: 'after-org-click.png' });
  
  console.log('\\n=== ORGANIZATION CLICK ANALYSIS ===');
  console.log(`403 Error Found: ${has403Error ? '🚨 YES' : '✅ NO'}`);
  
  if (has403Error) {
    const errorLogs = consoleLogs.filter(log => 
      log.includes('Failed to') || log.includes('Forbidden') || log.includes('Error:')
    );
    console.log('🚨 Error details:');
    errorLogs.forEach(log => console.log(`   ${log}`));
  }
  
  const finalAuthState = await page.evaluate(() => {
    try {
      const state = localStorage.getItem('auth-machine-state');
      return state ? JSON.parse(state) : null;
    } catch {
      return null;
    }
  });
  
  console.log(`Final Auth State: ${finalAuthState?.value || 'unknown'}`);
  console.log('=======================================');
  
  // Test succeeds if we can demonstrate the click happened
  expect(orgSelectionFound).toBe(true);
});