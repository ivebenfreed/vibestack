import { test } from '@playwright/test';

test('capture dashboard screenshot', async ({ page }) => {
  // Navigate to the dashboard
  await page.goto('http://localhost:3000/dashboard');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ 
    path: 'dashboard-current.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved as dashboard-current.png');
});