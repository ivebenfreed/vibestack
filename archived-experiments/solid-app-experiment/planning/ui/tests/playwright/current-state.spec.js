import { test, expect } from '@playwright/test';

test('capture current state', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/current-signin.png', fullPage: true });
  
  // Check if VS logo exists
  const hasVSLogo = await page.locator('text=VS').count() > 0;
  console.log('VS Logo present:', hasVSLogo);
  
  // Check if classes are applied
  const primaryButton = page.locator('.button-primary').first();
  const hasPrimaryButton = await primaryButton.count() > 0;
  console.log('Primary button with class found:', hasPrimaryButton);
  
  // Check computed styles
  if (hasPrimaryButton) {
    const bgColor = await primaryButton.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log('Button background color:', bgColor);
  }
});