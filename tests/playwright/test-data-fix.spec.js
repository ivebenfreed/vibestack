/**
 * Test Data Fix - Quick test to see if credentials fix allows data sync
 */
import { test, expect } from './tests/playwright/helpers/fixtures/persistent-context.js';

test('quick data sync test', async ({ page }) => {
  console.log('🚀 Testing if auth fix allows data sync...');
  
  await page.goto('/');
  await page.waitForTimeout(5000); // Wait a bit for initialization
  
  // Check if any API calls are now succeeding
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Loading data') || text.includes('Server returned') || text.includes('api/dataforge')) {
      logs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  await page.waitForTimeout(5000);
  
  console.log('API call logs captured:', logs.length);
});