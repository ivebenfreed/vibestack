import { test, expect } from '@playwright/test';

test('test dependency selection with login', async ({ page }) => {
  // Step 1: Login
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  // Check if we need to log in
  const needsLogin = await page.locator('input[type="email"]').isVisible({ timeout: 2000 }).catch(() => false);
  
  if (needsLogin) {
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'ben@getelevra.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }
  
  // Step 2: Navigate to gantt/projects page
  await page.goto('/projects');
  await page.waitForTimeout(3000);
  
  // Step 3: Check if gantt is loaded
  const ganttLoaded = await page.evaluate(() => {
    const ganttContainer = document.querySelector('.vibegantt-container');
    const tasks = document.querySelectorAll('[data-task-id]');
    
    return {
      hasContainer: !!ganttContainer,
      taskCount: tasks.length,
      containerSize: ganttContainer ? {
        width: ganttContainer.offsetWidth,
        height: ganttContainer.offsetHeight
      } : null
    };
  });
  
  console.log('Gantt loaded:', ganttLoaded);
  
  // Step 4: Create test data if needed
  if (ganttLoaded.taskCount === 0) {
    console.log('Creating test data...');
    
    const dataCreated = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        
        // Create two test tasks
        const task1 = await domainServices.task.createUI({ 
          title: 'Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05')
        });
        
        const task2 = await domainServices.task.createUI({ 
          title: 'Task 2',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10')
        });
        
        // Create a dependency
        const dependency = await domainServices.taskDependency.createUI({
          predecessorId: task1.id,
          successorId: task2.id,
          type: 'finish-to-start'
        });
        
        return { success: true, task1: task1.id, task2: task2.id, dependency: dependency.id };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Data creation result:', dataCreated);
    
    // Wait for gantt to re-render
    await page.waitForTimeout(3000);
  }
  
  // Step 5: Look for dependency elements
  const dependencyCheck = await page.evaluate(() => {
    // Test different selectors
    const results = {
      vibeganttDependency: document.querySelectorAll('.vibegantt-dependency').length,
      vibeganttDependencyGroup: document.querySelectorAll('.vibegantt-dependency-group').length,
      dataDependencyId: document.querySelectorAll('[data-dependency-id]').length,
      allDependencyElements: []
    };
    
    // Get details of all dependency elements
    document.querySelectorAll('[data-dependency-id]').forEach(el => {
      results.allDependencyElements.push({
        tagName: el.tagName,
        className: el.className,
        dependencyId: el.getAttribute('data-dependency-id'),
        hasPath: !!el.querySelector('path')
      });
    });
    
    return results;
  });
  
  console.log('Dependency elements found:', dependencyCheck);
  
  // Step 6: If dependencies exist, test clicking
  if (dependencyCheck.dataDependencyId > 0) {
    console.log('Testing dependency click...');
    
    // Click the first dependency
    const firstDep = page.locator('[data-dependency-id]').first();
    await firstDep.click();
    await page.waitForTimeout(1000);
    
    // Check if selection worked
    const selectionResult = await page.evaluate(() => {
      const elements = [];
      document.querySelectorAll('[data-dependency-id]').forEach(el => {
        elements.push({
          dependencyId: el.getAttribute('data-dependency-id'),
          hasSelectedClass: el.classList.contains('selected'),
          pathStroke: el.querySelector('path')?.getAttribute('stroke'),
          pathStrokeWidth: el.querySelector('path')?.getAttribute('stroke-width'),
          hasDeleteButton: !!el.querySelector('.delete-button'),
          hasConnectionHandles: el.querySelectorAll('.connection-handle').length
        });
      });
      return elements;
    });
    
    console.log('Selection result after click:', selectionResult);
    
    // Take a screenshot for visual confirmation
    await page.screenshot({ path: './screenshots/dependency-selection-test.png', fullPage: true });
  }
});