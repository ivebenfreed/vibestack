/**
 * Debug Authentication - Switch to Wide Corp CEO
 */

import { test, expect } from '@playwright/test';

test('switch to Wide Corp CEO authentication', async ({ page }) => {
  console.log('🧪 Switching to Wide Corp CEO authentication...');
  
  // Navigate to sign-in page
  console.log('🌐 Navigating to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForTimeout(2000);
  
  // Clear localStorage to force fresh auth
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log('🧹 Cleared all storage');
  } catch (error) {
    console.log('⚠️ Could not clear storage, continuing...');
  }
  
  // Sign in as Wide Corp CEO
  console.log('🔐 Signing in as Wide Corp CEO...');
  
  // Wait for form fields to be available
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  
  // Clear and fill email
  await page.fill('input[name="email"]', '');
  await page.fill('input[name="email"]', 'ceo@widecorp.com');
  
  // Clear and fill password
  await page.fill('input[name="password"]', '');
  await page.fill('input[name="password"]', 'WideCorp2024!CEO');
  
  console.log('   📧 Email: ceo@widecorp.com');
  console.log('   🔒 Password: WideCorp2024!CEO');
  
  console.log('🚀 Clicking sign in button...');
  await page.click('button[type="submit"]');
  
  // Wait for organization loading to complete
  console.log('⏳ Waiting for organization loading...');
  
  try {
    // Wait for the loading text to disappear
    await page.waitForFunction(() => !document.body.innerText.includes('Loading your organizations'), { timeout: 10000 });
    console.log('✅ Organization loading completed');
  } catch (error) {
    console.log('⚠️ Timeout waiting for organization loading');
  }
  
  await page.waitForTimeout(2000);
  
  // Look for organization selection UI
  console.log('🏢 Looking for organization selection...');
  
  // Try different selectors for organization selection
  const widecorpSelectors = [
    'text=Wide Corp Solutions',
    'text=Wide Corp', 
    'button:has-text("Wide Corp")',
    '[data-testid*="wide-corp"]',
    '[data-testid*="widecorp"]'
  ];
  
  let orgSelected = false;
  for (const selector of widecorpSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        console.log(`🎯 Found Wide Corp with selector: ${selector}`);
        await element.click();
        console.log('✅ Clicked Wide Corp option');
        orgSelected = true;
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }
  
  if (!orgSelected) {
    console.log('🔍 No Wide Corp selector found, taking screenshot...');
    await page.screenshot({ path: 'screenshots/org-selection-debug.png' });
    
    // Try to see what organizations are available
    const pageText = await page.textContent('body');
    console.log('📄 Page content includes:', pageText.substring(0, 500));
  }
  
  await page.waitForTimeout(3000);
  
  // Verify we're authenticated and on dashboard
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);
  
  if (currentUrl.includes('/dashboard')) {
    console.log('✅ Successfully authenticated as Wide Corp CEO');
    
    // Check organization in localStorage
    const orgInfo = await page.evaluate(() => {
      return {
        selectedOrg: localStorage.getItem('vibestack-last-organization-id'),
        authState: localStorage.getItem('auth-machine-state')
      };
    });
    
    console.log('🏢 Organization info:', orgInfo);
  } else {
    console.log('❌ Authentication may have failed');
    await page.screenshot({ path: 'screenshots/auth-debug.png' });
  }
});