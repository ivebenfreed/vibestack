// Simple test to verify authentication and basic app functionality
import { test, expect } from '../helpers/fixtures/persistent-context.js';

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
  
  // This is wrong - just because we're not on sign-in doesn't mean we're authenticated!
  // The app might be broken or not rendering at all
  
  // Wait for Playwright ready hook - this is the ONLY reliable way
  console.log('⏳ Waiting for Playwright ready hook...');
  const hasPlaywrightReady = await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  
  if (hasPlaywrightReady) {
    console.log('✅ App is ready and authenticated!');
  } else {
    console.log('❌ App failed to load or not authenticated');
    throw new Error('App not ready - Playwright ready hook not found. Either not authenticated or app failed to load.');
  }
  
  // If we got here, the app is working
  const appState = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.innerText.substring(0, 200),
      hasRoot: !!document.querySelector('#root')
    };
  });
  
  console.log('📱 App state:', appState);
  
  // Basic sanity checks
  expect(appState.hasRoot).toBe(true);
  expect(appState.title).toContain('Vibestack');
  
  console.log('✅ Authentication test passed!');
});