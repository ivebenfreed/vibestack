/**
 * Basic load test to debug app initialization
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('basic app load', async ({ page }) => {
  console.log('[Test] Starting basic load test');
  
  // Navigate to the app with error logging
  page.on('pageerror', err => {
    console.error('[Page Error]', err.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[Console Error]', msg.text());
    }
  });
  
  await page.goto('/', { waitUntil: 'networkidle', timeout: 10000 });
  
  console.log('[Test] Page loaded, checking for errors');
  
  // Check if app has any major errors
  const hasErrors = await page.evaluate(() => {
    return window.__APP_ERROR__ || false;
  });
  
  if (hasErrors) {
    console.error('[Test] App has errors:', hasErrors);
  }
  
  // Check if data-playwright-ready is set
  const isReady = await page.evaluate(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  });
  
  console.log('[Test] App ready status:', isReady);
  
  expect(isReady).toBe(true);
});