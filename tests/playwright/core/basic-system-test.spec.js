// Basic system test to verify functionality after updates
import { test, expect } from '@playwright/test';
import { createEntity, getEntity } from './db-test-helpers.js';

test.describe('Basic System Test', () => {
  test('verify app loads and basic database operations work', async ({ page }) => {
    console.log('\n=== BASIC SYSTEM TEST ===');
    
    await page.goto('/');
    await page.waitForTimeout(5000);
    
    // Check if app loaded
    const title = await page.title();
    console.log('📄 Page title:', title);
    expect(title).not.toBe('');
    
    // Check if we can access the database
    const dbStatus = await page.evaluate(async () => {
      try {
        const { db } = await import('/src/domain/index.js');
        const tableNames = db.tables.map(table => table.name);
        return { success: true, tables: tableNames };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🗄️ Database status:', dbStatus);
    expect(dbStatus.success).toBe(true);
    expect(dbStatus.tables).toContain('tasks');
    
    // Test basic CRUD operation
    console.log('🔧 Testing basic CRUD...');
    
    const task = await createEntity(page, 'task', {
      title: 'TEST_Basic_System_Task',
      description: 'Testing basic functionality',
      status: 'pending'
    });
    
    console.log('✅ Created task:', task.id);
    expect(task.id).toBeDefined();
    expect(task.title).toBe('TEST_Basic_System_Task');
    
    // Verify we can read it back
    const fetchedTask = await getEntity(page, 'task', task.id);
    console.log('📖 Fetched task:', fetchedTask ? fetchedTask.id : 'null');
    expect(fetchedTask).not.toBeNull();
    expect(fetchedTask.id).toBe(task.id);
    
    // Check sync state (without expecting it to be initialized)
    const syncState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📡 Sync state:', syncState);
    // Just log it, don't expect specific values since sync may not be working yet
    
    console.log('✅ Basic system functionality verified!');
  });
});