/**
 * Test for Issue #42: Zoom Focus Stability
 * 
 * This test verifies that the zoom focus point remains constant
 * over multiple zoom in/out operations, ensuring content doesn't
 * jump or drift during repeated zooming.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Zoom Focus Stability', () => {
  test('should maintain focus point over 5+ zoom operations', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for the gantt chart to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let everything stabilize
    
    // Helper to capture visual state
    const captureState = async (label) => {
      // Get scroll position
      const scrollInfo = await page.evaluate(() => {
        const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
        return {
          scrollLeft: wrapper?.scrollLeft || 0,
          scrollTop: wrapper?.scrollTop || 0,
          clientWidth: wrapper?.clientWidth || 0,
          scrollWidth: wrapper?.scrollWidth || 0
        };
      });
      
      // Get task positions and visibility
      const taskInfo = await page.evaluate(() => {
        const tasks = document.querySelectorAll('.vibegantt-task');
        const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
        const scrollLeft = wrapper?.scrollLeft || 0;
        const viewportWidth = wrapper?.clientWidth || 0;
        
        const taskData = Array.from(tasks).map(task => {
          const left = parseFloat(task.style.left || '0');
          const width = parseFloat(task.style.width || '0');
          const title = task.querySelector('.vibegantt-task-title')?.textContent || '';
          const isVisible = (left + width >= scrollLeft) && (left <= scrollLeft + viewportWidth);
          
          return {
            id: task.dataset.taskId,
            title: title.substring(0, 20), // First 20 chars
            left,
            width,
            isVisible,
            centerX: left + width / 2
          };
        });
        
        // Find the task closest to viewport center
        const viewportCenterX = scrollLeft + viewportWidth / 2;
        const centerTask = taskData.reduce((closest, task) => {
          const distance = Math.abs(task.centerX - viewportCenterX);
          if (!closest || distance < closest.distance) {
            return { ...task, distance };
          }
          return closest;
        }, null);
        
        return {
          tasks: taskData.filter(t => t.isVisible),
          centerTask,
          totalTasks: taskData.length
        };
      });
      
      // Get timeline info
      const timelineInfo = await page.evaluate(() => {
        const segments = document.querySelectorAll('.vibegantt-timeline-segment');
        const dayWidth = segments.length > 0 ? parseFloat(segments[0].style.width || '50') : 50;
        
        // Get visible timeline labels
        const labels = Array.from(document.querySelectorAll('.vibegantt-timeline-label'))
          .filter(label => {
            const rect = label.getBoundingClientRect();
            return rect.left < window.innerWidth && rect.right > 0;
          })
          .map(label => label.textContent?.trim())
          .filter(text => text)
          .slice(0, 5);
        
        return { dayWidth, visibleLabels: labels };
      });
      
      console.log(`\n=== ${label} ===`);
      console.log(`Scroll: ${scrollInfo.scrollLeft}/${scrollInfo.scrollWidth}`);
      console.log(`Center task: ${taskInfo.centerTask?.title || 'none'} at x=${taskInfo.centerTask?.centerX}`);
      console.log(`Visible tasks: ${taskInfo.tasks.length}`);
      console.log(`Day width: ${timelineInfo.dayWidth}px`);
      console.log(`Timeline labels: ${timelineInfo.visibleLabels.join(', ')}`);
      
      return {
        scroll: scrollInfo,
        tasks: taskInfo,
        timeline: timelineInfo,
        centerTask: taskInfo.centerTask
      };
    };
    
    // Scroll to a specific position in the middle of the timeline
    await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      if (wrapper) {
        // Scroll to roughly the middle of the content
        wrapper.scrollLeft = 1000;
      }
    });
    await page.waitForTimeout(500);
    
    // Capture initial state
    const initialState = await captureState('Initial State');
    await page.screenshot({ 
      path: 'screenshots/zoom-stability-00-initial.png',
      fullPage: false
    });
    
    // Store the initial center task for reference
    const initialCenterTask = initialState.centerTask;
    console.log(`\n🎯 Tracking task: "${initialCenterTask?.title}" at position ${initialCenterTask?.centerX}px`);
    
    // Perform zoom operations and track focus stability
    const zoomOperations = [
      { direction: 'in', description: 'Zoom In #1' },
      { direction: 'in', description: 'Zoom In #2' },
      { direction: 'out', description: 'Zoom Out #1' },
      { direction: 'out', description: 'Zoom Out #2' },
      { direction: 'out', description: 'Zoom Out #3' },
      { direction: 'in', description: 'Zoom In #3' },
      { direction: 'in', description: 'Zoom In #4' },
      { direction: 'in', description: 'Zoom In #5' },
      { direction: 'out', description: 'Zoom Out #4' },
      { direction: 'out', description: 'Zoom Out #5' }
    ];
    
    const states = [initialState];
    const focusShifts = [];
    
    // Position mouse at center of viewport for zoom anchor
    const chartArea = await page.locator('.vibegantt-tasks-wrapper');
    const box = await chartArea.boundingBox();
    const anchorX = box.x + box.width / 2;
    const anchorY = box.y + box.height / 2;
    
    for (let i = 0; i < zoomOperations.length; i++) {
      const op = zoomOperations[i];
      console.log(`\n📐 Performing: ${op.description}`);
      
      // Move mouse to anchor point
      await page.mouse.move(anchorX, anchorY);
      
      // Perform zoom
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, op.direction === 'in' ? -120 : 120);
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);
      
      // Capture state after zoom
      const newState = await captureState(op.description);
      states.push(newState);
      
      // Take screenshot
      const screenshotNum = (i + 1).toString().padStart(2, '0');
      await page.screenshot({ 
        path: `screenshots/zoom-stability-${screenshotNum}-${op.direction}.png`,
        fullPage: false
      });
      
      // Check if the center task is still visible and calculate drift
      if (initialCenterTask && newState.tasks.tasks.find(t => t.id === initialCenterTask.id)) {
        const currentTask = newState.tasks.tasks.find(t => t.id === initialCenterTask.id);
        const viewportCenterX = newState.scroll.scrollLeft + newState.scroll.clientWidth / 2;
        const drift = Math.abs(currentTask.centerX - viewportCenterX);
        
        console.log(`  Focus drift: ${drift.toFixed(0)}px from viewport center`);
        console.log(`  Task still visible: ✅`);
        
        focusShifts.push({
          operation: op.description,
          drift,
          taskVisible: true
        });
      } else {
        console.log(`  ⚠️ Original center task no longer visible`);
        focusShifts.push({
          operation: op.description,
          drift: -1,
          taskVisible: false
        });
      }
    }
    
    // Analyze focus stability
    console.log('\n=== Focus Stability Analysis ===');
    const visibleCount = focusShifts.filter(s => s.taskVisible).length;
    const avgDrift = focusShifts
      .filter(s => s.drift >= 0)
      .reduce((sum, s) => sum + s.drift, 0) / visibleCount;
    
    console.log(`Operations where center task remained visible: ${visibleCount}/${zoomOperations.length}`);
    console.log(`Average drift when visible: ${avgDrift.toFixed(0)}px`);
    
    // Final comparison screenshot - zoom back to original level
    console.log('\n🔄 Returning to original zoom level...');
    
    // Calculate how many zoom operations needed to return to original
    const currentDayWidth = states[states.length - 1].timeline.dayWidth;
    const targetDayWidth = initialState.timeline.dayWidth;
    const zoomSteps = Math.round((targetDayWidth - currentDayWidth) / 10);
    
    console.log(`Current: ${currentDayWidth}px, Target: ${targetDayWidth}px, Steps: ${zoomSteps}`);
    
    for (let i = 0; i < Math.abs(zoomSteps); i++) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, zoomSteps > 0 ? -120 : 120);
      await page.keyboard.up('Control');
      await page.waitForTimeout(300);
    }
    
    const finalState = await captureState('Final State (returned to original zoom)');
    await page.screenshot({ 
      path: 'screenshots/zoom-stability-final.png',
      fullPage: false
    });
    
    // Verify focus remained relatively stable
    // Allow some drift but it should be reasonable (< 200px average)
    expect(avgDrift).toBeLessThan(200);
    
    // Most operations should keep the center task visible
    expect(visibleCount).toBeGreaterThanOrEqual(zoomOperations.length * 0.7);
    
    // Check if we can still see the original center task after returning to original zoom
    const finalCenterTaskVisible = finalState.tasks.tasks.find(t => t.id === initialCenterTask?.id);
    if (finalCenterTaskVisible) {
      console.log('✅ Original center task still visible after all operations');
    } else {
      console.log('⚠️ Original center task lost after zoom operations');
    }
    
    console.log('\n=== Zoom Focus Stability Test Complete ===');
    console.log(`Screenshots saved: ${zoomOperations.length + 2} images in screenshots/`);
  });
});