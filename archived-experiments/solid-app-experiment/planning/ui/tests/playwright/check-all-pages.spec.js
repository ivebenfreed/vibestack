import { test, expect } from '@playwright/test';

test('check all pages styling', async ({ page }) => {
  // Check signup page
  await page.goto('http://localhost:3000/auth/signup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-signup.png', fullPage: true });
  
  // Check dashboard page
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-dashboard.png', fullPage: true });
  
  // Check entities page
  await page.goto('http://localhost:3000/entities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-entities.png', fullPage: true });
  
  // Check settings page
  await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-settings.png', fullPage: true });
  
  // Check analytics page
  await page.goto('http://localhost:3000/analytics', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-analytics.png', fullPage: true });
  
  console.log('All pages captured - check the screenshots');
});