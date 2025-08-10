import { test, expect } from '../fixtures/persistent-context.js';

test('VibeGantt debug route ready logging', async ({ page }) => {
  // Enable console logging to see our ready messages
  page.on('console', msg => {
    if (msg.text().includes('[PLAYWRIGHT_READY]')) {
      console.log('✅', msg.text());
    }
  });

  // Navigate to VibeGantt debug route
  await page.goto('/debug/vibegantt');
  
  // Wait for our ready indicator
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 10000 });
  
  // Verify we're on the right route
  const route = await page.evaluate(() => document.body.getAttribute('data-playwright-route'));
  expect(route).toBe('/debug/vibegantt');
  
  // Verify the page has the VibeGantt component
  await expect(page.locator('.vibegantt')).toBeVisible({ timeout: 5000 });
  
  console.log('VibeGantt debug page is ready!');
});