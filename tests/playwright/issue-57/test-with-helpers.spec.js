/**
 * Test automatic hooks using existing test helpers
 */

import { test, expect } from '../fixtures/persistent-context.js';
import { createEntity, updateEntity, deleteEntity } from '../core/db-test-helpers.js';

test('verify automatic change tracking with test helpers', async ({ page }) => {
  console.log('[Test] Testing automatic change tracking');
  
  // Navigate to app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Let it partially load
  
  // Get initial change count using the helper pattern
  const initialCount = await page.evaluate(async () => {
    try {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.where('processedSync').equals(0).count();
    } catch (err) {
      return -1;
    }
  });
  
  console.log('[Test] Initial change count:', initialCount);
  
  // Create a task using the helper
  const task = await createEntity(page, 'task', {
    title: 'Automatic Hook Test',
    description: 'Testing automatic change tracking',
    status: 'TODO'
  });
  
  console.log('[Test] Created task:', task.id);
  
  // Wait a bit for async hook
  await page.waitForTimeout(200);
  
  // Check if change was tracked
  const afterCreateCount = await page.evaluate(async () => {
    try {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.where('processedSync').equals(0).count();
    } catch (err) {
      return -1;
    }
  });
  
  console.log('[Test] Change count after create:', afterCreateCount);
  
  // The count should have increased if hooks are working
  const changesTracked = afterCreateCount > initialCount;
  console.log('[Test] Changes tracked:', changesTracked);
  
  if (changesTracked) {
    console.log('✅ SUCCESS: Automatic change tracking IS working!');
    console.log(`   - Initial changes: ${initialCount}`);
    console.log(`   - After create: ${afterCreateCount}`);
    console.log(`   - New changes tracked: ${afterCreateCount - initialCount}`);
  } else {
    console.log('❌ FAILURE: Changes not being tracked automatically');
  }
  
  expect(changesTracked).toBe(true);
});