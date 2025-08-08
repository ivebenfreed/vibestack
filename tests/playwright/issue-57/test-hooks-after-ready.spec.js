/**
 * Test automatic hooks after app is properly loaded
 */

import { test, expect } from '../fixtures/persistent-context.js';
import { createEntity } from '../core/db-test-helpers.js';

test('verify automatic change tracking works when app is ready', async ({ page }) => {
  console.log('[Test] Navigating to app...');
  
  // Navigate to app
  await page.goto('/', { waitUntil: 'networkidle' });
  
  // Wait for dashboard to load (look for actual content)
  console.log('[Test] Waiting for dashboard to load...');
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 30000 });
  
  // Wait a bit more for everything to settle
  await page.waitForTimeout(2000);
  
  // Check if data-playwright-ready is set
  const isReady = await page.evaluate(() => {
    return document.body.getAttribute('data-playwright-ready');
  });
  console.log('[Test] Playwright ready status:', isReady);
  
  // Get initial change count
  const initialCount = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    return await db.localChanges.where('processedSync').equals(0).count();
  });
  console.log('[Test] Initial pending changes:', initialCount);
  
  // Create a task using the helper
  console.log('[Test] Creating task...');
  const task = await createEntity(page, 'task', {
    title: 'Testing Automatic Hooks',
    description: 'This should be tracked automatically by Dexie hooks',
    status: 'TODO'
  });
  console.log('[Test] Created task:', task.id);
  
  // Wait for async hook to process
  await page.waitForTimeout(500);
  
  // Check new change count
  const finalCount = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    return await db.localChanges.where('processedSync').equals(0).count();
  });
  console.log('[Test] Final pending changes:', finalCount);
  
  // Check if a change was tracked
  const changeWasTracked = finalCount > initialCount;
  
  if (changeWasTracked) {
    console.log('✅ SUCCESS: Automatic change tracking IS WORKING!');
    console.log(`   Created 1 task, tracked ${finalCount - initialCount} change(s)`);
    
    // Get details of the tracked change
    const changes = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges
        .where('processedSync').equals(0)
        .and(c => c.table === 'tasks')
        .toArray();
    });
    
    console.log(`   Tracked changes:`, changes.map(c => ({
      operation: c.operation,
      table: c.table,
      id: c.data?.id
    })));
  } else {
    console.log('❌ FAILURE: Change was NOT tracked automatically');
    console.log('   This means hooks are not working or tracking is disabled');
  }
  
  expect(changeWasTracked).toBe(true);
});