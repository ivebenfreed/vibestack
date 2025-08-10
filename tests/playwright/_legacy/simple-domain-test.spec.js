// Simple test to verify we can use domain services from Playwright
import { test, expect } from '@playwright/test';

test('simple domain service test', async ({ page }) => {
  console.log('🔍 Testing domain service access...');
  
  // Navigate to the app
  await page.goto('/');
  
  // Wait for app to initialize
  await page.waitForTimeout(3000);
  
  // Run a simple domain service operation in the browser context
  const result = await page.evaluate(async () => {
    try {
      // Import domain services
      const { domainServices } = await import('/src/domain/index.js');
      
      // Create a test task using the domain service
      const task = await domainServices.task.createUI({
        title: 'TEST_Playwright_Task',
        description: 'Created from Playwright test',
        status: 'todo',
        priority: 'high'
      });
      
      // Import db to get count
      const { db } = await import('/src/domain/index.js');
      const taskCount = await db.tasks.count();
      
      // Get the created task using Dexie directly
      const fetchedTask = await db.tasks.get(task.id);
      
      // Clean up - delete the test task
      await domainServices.task.deleteUI(task.id);
      
      return { 
        success: true,
        createdTask: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority
        },
        taskCount,
        fetchedTask: fetchedTask ? {
          id: fetchedTask.id,
          title: fetchedTask.title
        } : null,
        deleted: true
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
    console.log('✅ Domain service accessed successfully!');
    console.log('📝 Created task:', result.createdTask);
    console.log('📊 Task count:', result.taskCount);
    console.log('🔍 Fetched task:', result.fetchedTask);
    console.log('🗑️ Deleted:', result.deleted);
  } else {
    console.log('❌ Could not access domain service');
    console.log('Error:', result.error);
  }
  
  // Assertions
  expect(result.success).toBe(true);
  expect(result.createdTask).toBeDefined();
  expect(result.createdTask.title).toBe('TEST_Playwright_Task');
  expect(result.createdTask.status).toBe('todo');
  expect(result.createdTask.priority).toBe('high');
  expect(result.fetchedTask).toBeDefined();
  expect(result.fetchedTask.id).toBe(result.createdTask.id);
});