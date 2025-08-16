import { test, expect } from '@playwright/test';

test('fresh test with cache disabled', async ({ page }) => {
  // Clear cache and reload
  await page.context().clearCookies();
  await page.goto('http://localhost:3000/auth/signin', { 
    waitUntil: 'networkidle',
    timeout: 10000
  });
  
  // Force refresh to get latest CSS
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Capture screenshot
  await page.screenshot({ path: 'tests/screenshots/fresh-no-cache.png', fullPage: true });
  
  console.log('Test completed - check fresh-no-cache.png');
});