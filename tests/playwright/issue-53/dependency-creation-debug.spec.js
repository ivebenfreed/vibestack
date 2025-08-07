import { test, expect } from '@playwright/test';

test('debug dependency creation and gantt loading', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(5000); // Wait longer for sync
  
  // Check if gantt chart is loaded
  const ganttInfo = await page.evaluate(() => {
    const ganttContainer = document.querySelector('.vibegantt-container');
    const taskElements = document.querySelectorAll('.vibegantt-task, [data-task-id]');
    
    return {
      hasGanttContainer: !!ganttContainer,
      taskCount: taskElements.length,
      ganttDimensions: ganttContainer ? {
        width: ganttContainer.offsetWidth,
        height: ganttContainer.offsetHeight
      } : null
    };
  });
  
  console.log('Gantt chart info:', ganttInfo);
  
  // Check database for tasks and dependencies
  const dbInfo = await page.evaluate(async () => {
    try {
      // Import database
      const { db } = await import('/src/domain/index.js');
      
      const tasks = await db.tasks.toArray();
      const dependencies = await db.taskDependencies.toArray();
      
      return {
        taskCount: tasks.length,
        dependencyCount: dependencies.length,
        tasks: tasks.map(t => ({ id: t.id, title: t.title })),
        dependencies: dependencies.map(d => ({ 
          id: d.id, 
          predecessorId: d.predecessorId, 
          successorId: d.successorId,
          type: d.type 
        }))
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('Database info:', dbInfo);
  
  // If no dependencies exist, create some test data
  if (dbInfo.dependencyCount === 0 && dbInfo.taskCount >= 2) {
    console.log('Creating test dependency...');
    
    const result = await page.evaluate(async () => {
      try {
        const { domainServices } = await import('/src/domain/index.js');
        
        // Get first two tasks
        const { db } = await import('/src/domain/index.js');
        const tasks = await db.tasks.limit(2).toArray();
        
        if (tasks.length >= 2) {
          // Create a dependency between first two tasks
          const dependency = await domainServices.taskDependency.createUI({
            predecessorId: tasks[0].id,
            successorId: tasks[1].id,
            type: 'finish-to-start'
          });
          
          return { success: true, dependency };
        } else {
          return { error: 'Not enough tasks to create dependency' };
        }
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Dependency creation result:', result);
    
    if (result.success) {
      // Wait a bit for the gantt to re-render
      await page.waitForTimeout(2000);
      
      // Check for dependency elements again
      const postCreateInfo = await page.evaluate(() => {
        const deps = document.querySelectorAll('[data-dependency-id]');
        return {
          dependencyElements: deps.length,
          elements: Array.from(deps).map(el => ({
            tagName: el.tagName,
            className: el.className,
            dependencyId: el.getAttribute('data-dependency-id')
          }))
        };
      });
      
      console.log('Post-creation dependency elements:', postCreateInfo);
    }
  }
});