import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Quick Sync Tests', () => {
  test.setTimeout(15000); // Set a reasonable timeout for each test

  test('Quick Test 1: Sync initialized', async ({ page }) => {
    await page.goto('/');
    
    // Just wait for basic app load
    await page.waitForLoadState('domcontentloaded');
    
    // Check sync state
    const syncState = await page.evaluate(() => {
      const state = localStorage.getItem('sync-machine-state');
      return state ? JSON.parse(state) : null;
    });
    
    console.log('Sync state:', syncState);
    expect(syncState).toBeTruthy();
    expect(syncState.currentLSN).toBeTruthy();
  });

  test('Quick Test 2: LocalChanges table exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const result = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        const count = await db.localChanges.count();
        return { success: true, count };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('LocalChanges check:', result);
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  test('Quick Test 3: Create task and track', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Get initial count
    const before = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    // Create task
    const createResult = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        await domainServices.task.create({
          id: crypto.randomUUID(),
          title: 'Quick Test Task',
          status: 'todo'
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(createResult.success).toBe(true);
    
    // Check count increased
    const after = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`LocalChanges: ${before} -> ${after}`);
    expect(after).toBeGreaterThan(before);
  });

  test('Quick Test 4: ProcessedSync flag check', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const stats = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const total = await db.localChanges.count();
      const unprocessed = await db.localChanges.where('processedSync').equals(0).count();
      const processed = await db.localChanges.where('processedSync').equals(1).count();
      return { total, unprocessed, processed };
    });
    
    console.log('ProcessedSync stats:', stats);
    expect(stats.total).toBe(stats.unprocessed + stats.processed);
  });

  test('Quick Test 5: Batch operations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const before = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    // Create 3 tasks quickly
    const batchResult = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        for (let i = 0; i < 3; i++) {
          await domainServices.task.create({
            id: crypto.randomUUID(),
            title: `Batch Task ${i}`,
            status: 'todo'
          });
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(batchResult.success).toBe(true);
    
    const after = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      return await db.localChanges.count();
    });
    
    console.log(`Batch create: ${before} -> ${after} (added ${after - before})`);
    expect(after).toBeGreaterThanOrEqual(before + 3);
  });
});