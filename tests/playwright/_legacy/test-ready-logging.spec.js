import { test, expect } from '../fixtures/persistent-context.js';

test('demonstrate route ready logging', async ({ page }) => {
  // Enable console logging to see our ready messages
  page.on('console', msg => {
    if (msg.text().includes('[PLAYWRIGHT_READY]')) {
      console.log('✅', msg.text());
    }
  });

  // Navigate to dashboard
  await page.goto('/');
  
  // Wait for our ready indicator
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 10000 });
  
  // Alternative: wait for specific log message
  const readyLog = page.waitForEvent('console', {
    predicate: msg => msg.text().includes('[PLAYWRIGHT_READY] Dashboard data loaded'),
    timeout: 10000
  });
  
  await readyLog;
  
  // Verify we're on the dashboard
  const route = await page.evaluate(() => document.body.getAttribute('data-playwright-route'));
  expect(route).toBe('/');
  
  console.log('Dashboard is ready!');
});

test('wait for any route to be ready', async ({ page }) => {
  // Helper function to wait for any route
  const waitForRouteReady = async () => {
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 10000 });
  };
  
  // Navigate and wait
  await page.goto('/tasks');
  await waitForRouteReady();
  
  const route = await page.evaluate(() => document.body.getAttribute('data-playwright-route'));
  console.log(`Route ${route} is ready`);
});