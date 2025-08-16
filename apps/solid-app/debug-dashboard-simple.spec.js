import { test, expect } from '@playwright/test';

test('check dashboard layout', async ({ page }) => {
  // Navigate to the dashboard
  await page.goto('http://localhost:3000/dashboard');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for any client-side JS to complete
  await page.waitForTimeout(1000);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'dashboard-debug.png',
    fullPage: true 
  });
  
  // Check if main content is visible
  const mainContent = await page.locator('[data-testid="app-main"]');
  await expect(mainContent).toBeVisible();
  
  // Check if dashboard title is present
  const title = await page.locator('h1:has-text("Dashboard")');
  await expect(title).toBeVisible();
  
  // Log any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  console.log('Dashboard test completed. Screenshot saved as dashboard-debug.png');
});