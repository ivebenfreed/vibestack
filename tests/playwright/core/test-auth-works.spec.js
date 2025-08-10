// Simple test to verify authentication and basic app functionality
import { test, expect } from '../fixtures/persistent-context.js';

test('verify authentication and app loads', async ({ page }) => {
  console.log('🔐 Testing authentication state...');
  
  // Navigate to the app
  await page.goto('/');
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  // Check if we're authenticated (not on sign-in page)
  const url = page.url();
  const isAuthenticated = !url.includes('/sign-in') && !url.includes('/handler');
  
  console.log('📍 Current URL:', url);
  console.log('✅ Authenticated:', isAuthenticated);
  
  // Check if the app loaded successfully
  const appLoaded = await page.evaluate(() => {
    // Check if we have the main app container
    const hasApp = document.querySelector('#root') !== null;
    
    // Check if we have localStorage with auth data
    const hasAuth = localStorage.getItem('better-auth.session_token') !== null;
    
    return {
      hasApp,
      hasAuth,
      title: document.title,
      bodyText: document.body.innerText.substring(0, 200)
    };
  });
  
  console.log('📱 App state:', appLoaded);
  
  // Assertions
  expect(isAuthenticated).toBe(true);
  expect(appLoaded.hasApp).toBe(true);
  expect(appLoaded.title).toContain('Vibestack');
  
  console.log('✅ Authentication test passed!');
});