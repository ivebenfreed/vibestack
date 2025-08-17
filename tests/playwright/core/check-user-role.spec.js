/**
 * Check current authenticated user's role
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('Check authenticated user role and debug access', async ({ page }) => {
  console.log('🔍 Checking user authentication and role...');
  
  // Navigate to main page
  await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  console.log('📍 Current URL:', page.url());
  
  // Try to access debug route and see what happens
  console.log('🔄 Attempting to access debug route...');
  await page.goto('/debug', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const debugUrl = page.url();
  console.log('📍 Debug route URL:', debugUrl);
  
  // Take screenshot of debug route attempt
  await page.screenshot({ path: 'screenshots/debug-route-attempt.png', fullPage: true });
  
  // Check page content
  const pageText = await page.textContent('body');
  console.log('📄 Page contains "Access Denied"?', pageText.includes('Access Denied'));
  console.log('📄 Page contains "admin"?', pageText.includes('admin'));
  console.log('📄 Page contains "role"?', pageText.includes('role'));
  console.log('📄 Page contains "Debug Section"?', pageText.includes('Debug Section'));
  
  if (pageText.includes('Access Denied')) {
    console.log('❌ User does not have admin access to debug routes');
    console.log('💡 Need to either:');
    console.log('   1. Update user role to admin in database');
    console.log('   2. Create admin test user');
    console.log('   3. Modify debug route to allow current user role');
  } else if (pageText.includes('Debug Section')) {
    console.log('✅ User has admin access to debug routes');
  } else {
    console.log('⚠️ Unexpected page content');
  }
});