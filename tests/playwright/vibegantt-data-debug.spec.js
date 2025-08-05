// tests/playwright/vibegantt-data-debug.spec.js
// Debug test to check what data is actually loaded in VibeGantt
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Data Loading Debug', () => {
  test.setTimeout(60000);
  
  test('should debug what data is loaded and why chart is empty', async ({ page }) => {
    console.log('🎯 Starting VibeGantt data debug test...');
    
    // Navigate to debug page
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check the gantt machine state
    const machineState = await page.evaluate(() => {
      if (window.__vibegantt_store_actor) {
        const snapshot = window.__vibegantt_store_actor.getSnapshot();
        return {
          value: snapshot.value,
          context: {
            loading: snapshot.context.loading,
            error: snapshot.context.error,
            taskCount: Object.keys(snapshot.context.tasks || {}).length,
            dependencyCount: Object.keys(snapshot.context.dependencies || {}).length,
            hasRelationships: !!snapshot.context.relationships,
            visibleDateRange: snapshot.context.visibleDateRange,
            zoom: snapshot.context.zoom,
            expandedTasks: Array.from(snapshot.context.expandedTasks || []),
            selectedTasks: Array.from(snapshot.context.selectedTasks || []),
            taskTree: snapshot.context.taskTree?.length || 0,
            taskMapSize: snapshot.context.taskMap?.size || 0
          }
        };
      }
      return { error: 'Store actor not found' };
    });
    
    console.log('🔍 Gantt Machine State:', JSON.stringify(machineState, null, 2));
    
    // Check actual database content
    const dbData = await page.evaluate(async () => {
      try {
        const { db } = await import('@repo/dataforge/dexie-schema');
        
        const taskCount = await db.tasks.count();
        const depCount = await db.entityDependencies.count();
        
        // Get a few sample tasks
        const sampleTasks = await db.tasks.limit(5).toArray();
        const sampleDeps = await db.entityDependencies.limit(5).toArray();
        
        return {
          taskCount,
          depCount,
          sampleTasks: sampleTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            projectId: t.projectId,
            startDate: t.startDate,
            endDate: t.endDate
          })),
          sampleDeps: sampleDeps.map(d => ({
            id: d.id,
            entityType: d.entityType,
            predecessorId: d.predecessorId,
            successorId: d.successorId
          }))
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('🔍 Database Data:', JSON.stringify(dbData, null, 2));
    
    // Check if the component is waiting for any specific data
    const rendererState = await page.evaluate(() => {
      return {
        hasRendererOptions: '__vibegantt_renderer_options' in window,
        rendererOptions: window.__vibegantt_renderer_options || null
      };
    });
    
    console.log('🔍 Renderer State:', JSON.stringify(rendererState, null, 2));
    
    // Check DOM content more thoroughly
    const domAnalysis = await page.evaluate(() => {
      const container = document.querySelector('.vibegantt');
      if (!container) return { error: 'Container not found' };
      
      return {
        containerHTML: container.innerHTML.substring(0, 1000),
        childElements: Array.from(container.children).map(child => ({
          tagName: child.tagName,
          className: child.className,
          textContent: child.textContent?.substring(0, 100),
          style: {
            width: child.style.width,
            height: child.style.height,
            display: child.style.display
          }
        })),
        computedStyles: {
          width: getComputedStyle(container).width,
          height: getComputedStyle(container).height,
          display: getComputedStyle(container).display
        }
      };
    });
    
    console.log('🔍 DOM Analysis:', JSON.stringify(domAnalysis, null, 2));
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-data-debug.png',
      fullPage: true 
    });
    
    // Summary report
    console.log('\n=== VIBEGANTT DATA DEBUG SUMMARY ===');
    console.log(`Machine State: ${machineState.value || 'unknown'}`);
    console.log(`Loading: ${machineState.context?.loading || 'unknown'}`);
    console.log(`Error: ${machineState.context?.error || 'none'}`);
    console.log(`Tasks in machine: ${machineState.context?.taskCount || 0}`);
    console.log(`Dependencies in machine: ${machineState.context?.dependencyCount || 0}`);
    console.log(`Tasks in DB: ${dbData.taskCount || 0}`);
    console.log(`Dependencies in DB: ${dbData.depCount || 0}`);
    console.log(`Task tree items: ${machineState.context?.taskTree || 0}`);
    console.log(`Task map size: ${machineState.context?.taskMapSize || 0}`);
    
    if (dbData.taskCount > 0 && machineState.context?.taskCount === 0) {
      console.log('❌ ISSUE: Tasks exist in DB but not loaded in machine state');
    }
    
    if (machineState.context?.loading) {
      console.log('⏳ Component is still in loading state');
    }
    
    if (machineState.context?.error) {
      console.log('❌ Error in machine state:', machineState.context.error);
    }
    
    // Test passes if we can gather debug info
    expect(container).toBeVisible();
  });
});