/**
 * Debug test to see what's preventing app from loading
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug app initialization', async ({ page }) => {
  // Capture all console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  // Capture errors
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  
  // Navigate to app
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  // Wait a bit for any async initialization
  await page.waitForTimeout(3000);
  
  // Check what's in the console
  console.log('=== Console Logs ===');
  consoleLogs.forEach(log => console.log(log));
  
  console.log('\n=== Page Errors ===');
  errors.forEach(err => console.log(err));
  
  // Check if hooks are causing issues
  const hookStatus = await page.evaluate(() => {
    try {
      // Check if db is available
      const hasDb = typeof window !== 'undefined' && window.db;
      
      // Check if domainServices exists
      const hasDomainServices = typeof window !== 'undefined' && window.domainServices;
      
      // Check localStorage for any errors
      const storedErrors = localStorage.getItem('app-errors');
      
      return {
        hasDb,
        hasDomainServices,
        storedErrors,
        readyState: document.readyState,
        bodyReady: document.body?.getAttribute('data-playwright-ready')
      };
    } catch (err) {
      return { error: err.message };
    }
  });
  
  console.log('\n=== Hook Status ===');
  console.log(JSON.stringify(hookStatus, null, 2));
  
  // Try to manually check if change tracking is breaking things
  const changeTrackingTest = await page.evaluate(async () => {
    try {
      // Try to access the db directly through the module
      const module = await import('@repo/dataforge/dexie-schema');
      const db = module.db;
      
      // Check if localChanges table exists
      const hasLocalChanges = db && db.localChanges;
      
      // Try to count records
      let count = -1;
      if (hasLocalChanges) {
        count = await db.localChanges.count();
      }
      
      return {
        dbAvailable: !!db,
        hasLocalChanges: !!hasLocalChanges,
        changeCount: count
      };
    } catch (err) {
      return { error: err.message };
    }
  });
  
  console.log('\n=== Change Tracking Test ===');
  console.log(JSON.stringify(changeTrackingTest, null, 2));
  
  // Don't fail the test, just report
  expect(true).toBe(true);
});