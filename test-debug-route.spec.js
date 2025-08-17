/**
 * Quick test to verify debug route accessibility
 */

import { test, expect } from './tests/playwright/fixtures/persistent-context.js';

test('Debug route navigation test', async ({ page }) => {
  console.log('🔄 Testing debug route access...');
  
  // Test /debug route first
  await page.goto('/debug', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  
  const url = page.url();
  console.log('📍 Current URL:', url);
  
  // Take screenshot
  await page.screenshot({ path: 'debug-navigation-test.png', fullPage: true });
  console.log('📸 Screenshot saved');
  
  // Try to navigate to livestore-test
  console.log('🔄 Navigating to livestore-test...');
  await page.goto('/debug/livestore-test', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const finalUrl = page.url();
  console.log('📍 LiveStore test URL:', finalUrl);
  
  // Check if we're on the right page
  const pageContent = await page.textContent('body');
  console.log('📄 Page contains LiveStore?', pageContent.includes('LiveStore'));
  
  await page.screenshot({ path: 'livestore-test-route.png', fullPage: true });
  console.log('📸 LiveStore test screenshot saved');
});