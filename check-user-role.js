/**
 * Check current authenticated user's role
 */

import { test, expect } from './tests/playwright/fixtures/persistent-context.js';

test('Check authenticated user role', async ({ page }) => {
  console.log('🔍 Checking user authentication and role...');
  
  // Navigate to main page
  await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'main-page.png', fullPage: true });
  
  console.log('📍 Current URL:', page.url());
  
  // Try to access debug route and see what happens
  console.log('🔄 Attempting to access debug route...');
  await page.goto('/debug', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const debugUrl = page.url();
  console.log('📍 Debug route URL:', debugUrl);
  
  // Take screenshot of debug route attempt
  await page.screenshot({ path: 'debug-route-attempt.png', fullPage: true });
  
  // Check page content
  const pageText = await page.textContent('body');
  console.log('📄 Page contains "Access Denied"?', pageText.includes('Access Denied'));
  console.log('📄 Page contains "admin"?', pageText.includes('admin'));
  console.log('📄 Page contains "role"?', pageText.includes('role'));
  
  // Try to get user info from console
  const userInfo = await page.evaluate(() => {
    try {
      // Try to access any global auth state
      return {
        localStorage: Object.keys(localStorage).length > 0 ? Object.keys(localStorage) : 'empty',
        sessionStorage: Object.keys(sessionStorage).length > 0 ? Object.keys(sessionStorage) : 'empty',
        cookies: document.cookie ? 'has cookies' : 'no cookies'
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('🔍 Storage info:', JSON.stringify(userInfo, null, 2));
});