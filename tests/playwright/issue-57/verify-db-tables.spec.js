import { test, expect } from '../fixtures/persistent-context.js';

test('verify database tables exist', async ({ page }) => {
  await page.goto('/');
  
  // Wait for app to be ready
  await page.waitForFunction(() => {
    return document.body?.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Check what tables exist in the database
  const dbInfo = await page.evaluate(async () => {
    try {
      const { db } = await import('/src/domain/index.js');
      
      // Get database info
      const info = {
        dbName: db.name,
        version: db.verno,
        tables: db.tables.map(t => t.name),
        hasLocalChanges: false,
        localChangesError: null
      };
      
      // Try to access localChanges table
      try {
        const count = await db.localChanges.count();
        info.hasLocalChanges = true;
        info.localChangesCount = count;
      } catch (e) {
        info.localChangesError = e.message;
      }
      
      return info;
    } catch (error) {
      return { error: error.message, stack: error.stack };
    }
  });
  
  console.log('Database info:', JSON.stringify(dbInfo, null, 2));
  
  // Verify essential tables exist
  expect(dbInfo.tables).toContain('tasks');
  expect(dbInfo.tables).toContain('projects');
  expect(dbInfo.tables).toContain('users');
  expect(dbInfo.tables).toContain('localChanges');
  
  // Verify localChanges is accessible
  expect(dbInfo.hasLocalChanges).toBe(true);
});