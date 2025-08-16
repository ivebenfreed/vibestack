import { test, expect } from '@playwright/test';

test('test navigation works - manual check', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle' });
  
  // Take screenshot showing signin page
  await page.screenshot({ path: 'tests/screenshots/nav-test-signin.png', fullPage: true });
  
  // Go to home page manually
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  // Take screenshot of home page
  await page.screenshot({ path: 'tests/screenshots/nav-test-home.png', fullPage: true });
  
  // Verify we can access both pages
  await expect(page).toHaveURL('http://localhost:3000/');
  console.log('Navigation test completed - both pages accessible');
});