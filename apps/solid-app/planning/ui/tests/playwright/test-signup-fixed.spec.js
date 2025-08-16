import { test, expect } from '@playwright/test';

test('test fixed signup page styling', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/screenshots/signup-fixed.png', fullPage: true });
  
  console.log('Signup page updated - check signup-fixed.png');
});