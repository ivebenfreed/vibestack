import { test, expect } from '../fixtures/persistent-context.js';

test('test localChanges table operations', async ({ page }) => {
  await page.goto('/');
  
  // Wait for app ready
  await page.waitForFunction(() => {
    return document.body?.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Test different ways to clear localChanges
  const results = await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    const results = {
      initialCount: 0,
      afterDeleteCount: 0,
      methods: {}
    };
    
    // Get initial count
    results.initialCount = await db.localChanges.count();
    
    // Test if clear() method exists
    results.methods.hasClear = typeof db.localChanges.clear === 'function';
    
    // Test if delete() method exists  
    results.methods.hasDelete = typeof db.localChanges.delete === 'function';
    
    // Test if toCollection().delete() works
    try {
      await db.localChanges.toCollection().delete();
      results.methods.toCollectionDelete = 'success';
      results.afterDeleteCount = await db.localChanges.count();
    } catch (e) {
      results.methods.toCollectionDelete = e.message;
    }
    
    return results;
  });
  
  console.log('LocalChanges operations test:', JSON.stringify(results, null, 2));
  
  // Verify we can clear the table
  expect(results.afterDeleteCount).toBe(0);
});