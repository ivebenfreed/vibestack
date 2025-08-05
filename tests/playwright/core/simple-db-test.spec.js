// Simple test to verify we can access the database from Playwright
import { test, expect } from '@playwright/test';

test('simple database access test', async ({ page }) => {
  console.log('🔍 Testing simple database access...');
  
  // Navigate to the app
  await page.goto('/');
  
  // Wait for app to initialize
  await page.waitForTimeout(5000);
  
  // Run a simple query in the browser context
  const result = await page.evaluate(async () => {
    try {
      // Import the database from the domain module
      const { db } = await import('/src/domain/index.js');
      
      // Check if db is available
      if (db) {
        const taskCount = await db.tasks.count();
        const projectCount = await db.projects.count();
        const userCount = await db.users.count();
        
        return { 
          success: true, 
          taskCount,
          projectCount,
          userCount,
          dbExists: true,
          dbTables: db.tables.map(t => t.name)
        };
      }
      
      return { 
        success: false, 
        dbExists: false,
        message: 'Database not found after import'
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        stack: error.stack
      };
    }
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('✅ Database accessed successfully!');
    console.log(`📊 Task count: ${result.taskCount}`);
    console.log(`📁 Project count: ${result.projectCount}`);
    console.log(`👤 User count: ${result.userCount}`);
    if (result.dbTables) {
      console.log(`📋 Tables: ${result.dbTables.join(', ')}`);
    }
  } else {
    console.log('❌ Could not access database');
    if (result.error) {
      console.log('Error:', result.error);
    }
  }
  
  // Basic assertions
  expect(result.success).toBe(true);
  expect(result.dbExists).toBe(true);
  expect(result.taskCount).toBeGreaterThanOrEqual(0);
});