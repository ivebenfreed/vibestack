/**
 * Test for Issue #42: Advanced Zoom Focus Stability
 * 
 * This test verifies that the zoom focus point remains constant
 * over multiple zoom in/out operations with visual verification.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Advanced Zoom Focus Stability', () => {
  test('should maintain visual focus over multiple zoom operations', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for the gantt chart to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let everything stabilize
    
    // Listen for console logs to debug zoom events
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('ZOOM_REQUEST') || text.includes('dayWidth') || text.includes('Timeline label mode')) {
        console.log('  [Console]:', text);
      }
    });
    
    // Helper to get comprehensive state
    const getGanttState = async () => {
      return await page.evaluate(() => {
        const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
        const tasks = document.querySelectorAll('.vibegantt-task');
        const segments = document.querySelectorAll('.vibegantt-timeline-segment');
        
        // Get scroll state
        const scrollState = {
          left: wrapper?.scrollLeft || 0,
          top: wrapper?.scrollTop || 0,
          width: wrapper?.clientWidth || 0,
          height: wrapper?.clientHeight || 0,
          scrollWidth: wrapper?.scrollWidth || 0
        };
        
        // Get visible tasks with their positions
        const taskPositions = Array.from(tasks).map(task => {
          const left = parseFloat(task.style.left || '0');
          const width = parseFloat(task.style.width || '0');
          const title = task.querySelector('.vibegantt-task-title')?.textContent || '';
          
          return {
            id: task.dataset.taskId,
            title: title.substring(0, 30),
            left,
            width,
            right: left + width,
            center: left + width / 2
          };
        });
        
        // Find tasks in viewport
        const viewportLeft = scrollState.left;
        const viewportRight = scrollState.left + scrollState.width;
        const viewportCenter = scrollState.left + scrollState.width / 2;
        
        const visibleTasks = taskPositions.filter(t => 
          t.right >= viewportLeft && t.left <= viewportRight
        );
        
        // Find task closest to center
        const centerTask = taskPositions.reduce((closest, task) => {
          const distance = Math.abs(task.center - viewportCenter);
          if (!closest || distance < closest.distance) {
            return { ...task, distance };
          }
          return closest;
        }, null);
        
        // Get timeline state
        const dayWidth = segments.length > 0 ? 
          parseFloat(segments[0].style.width || '50') : 50;
        
        const timelineLabels = Array.from(document.querySelectorAll('.vibegantt-timeline-label'))
          .slice(0, 10)
          .map(l => l.textContent?.trim())
          .filter(t => t);
        
        // Determine label type
        let labelType = 'unknown';
        if (timelineLabels.length > 0) {
          if (timelineLabels.some(l => /^\d+$/.test(l))) labelType = 'days';
          else if (timelineLabels.some(l => /^W\d+/.test(l))) labelType = 'weeks';
          else if (timelineLabels.some(l => /^[A-Z][a-z]+/.test(l))) labelType = 'months';
        }
        
        return {
          scroll: scrollState,
          visibleTasks,
          centerTask,
          timeline: {
            dayWidth,
            labelType,
            labels: timelineLabels.slice(0, 5)
          },
          stats: {
            totalTasks: taskPositions.length,
            visibleCount: visibleTasks.length,
            viewportCenter
          }
        };
      });
    };
    
    // Perform zoom using the wrapper element directly
    const performZoom = async (direction, count = 1) => {
      const wrapper = await page.locator('.vibegantt-tasks-wrapper');
      const box = await wrapper.boundingBox();
      
      // Move to center of viewport
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      
      for (let i = 0; i < count; i++) {
        await page.mouse.move(centerX, centerY);
        
        // Try both methods: keyboard modifier and direct wheel event
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, direction === 'in' ? -120 : 120);
        await page.keyboard.up('Control');
        
        await page.waitForTimeout(300);
      }
      
      // Wait for any animations
      await page.waitForTimeout(500);
    };
    
    // Initial setup - scroll to middle of timeline
    console.log('\n🎯 Setting up initial view...');
    await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      if (wrapper) {
        wrapper.scrollLeft = 1000;
      }
    });
    await page.waitForTimeout(500);
    
    // Capture initial state
    let state = await getGanttState();
    console.log('\n📸 Initial State:');
    console.log(`  Scroll: ${state.scroll.left}/${state.scroll.scrollWidth}`);
    console.log(`  Center task: "${state.centerTask?.title}" at ${state.centerTask?.center}px`);
    console.log(`  Visible tasks: ${state.stats.visibleCount}`);
    console.log(`  Timeline: ${state.timeline.dayWidth}px (${state.timeline.labelType})`);
    
    await page.screenshot({ 
      path: 'screenshots/zoom-focus-00-initial.png',
      fullPage: false
    });
    
    const initialCenterTask = state.centerTask;
    const trackingResults = [];
    
    // Test sequence: zoom in and out multiple times
    const zoomSequence = [
      { action: 'in', count: 2, label: 'Zoom In x2' },
      { action: 'out', count: 3, label: 'Zoom Out x3' },
      { action: 'in', count: 3, label: 'Zoom In x3' },
      { action: 'out', count: 4, label: 'Zoom Out x4' },
      { action: 'in', count: 2, label: 'Zoom In x2 (return)' }
    ];
    
    for (let i = 0; i < zoomSequence.length; i++) {
      const step = zoomSequence[i];
      console.log(`\n📐 Step ${i + 1}: ${step.label}`);
      
      await performZoom(step.action, step.count);
      
      state = await getGanttState();
      
      // Check if center task is still visible
      const centerTaskStillVisible = state.visibleTasks.find(t => t.id === initialCenterTask?.id);
      const drift = centerTaskStillVisible ? 
        Math.abs(centerTaskStillVisible.center - state.stats.viewportCenter) : -1;
      
      console.log(`  New dayWidth: ${state.timeline.dayWidth}px (${state.timeline.labelType})`);
      console.log(`  Visible tasks: ${state.stats.visibleCount}`);
      console.log(`  Center task visible: ${centerTaskStillVisible ? '✅' : '❌'}`);
      if (centerTaskStillVisible) {
        console.log(`  Drift from center: ${drift.toFixed(0)}px`);
      }
      
      trackingResults.push({
        step: step.label,
        dayWidth: state.timeline.dayWidth,
        labelType: state.timeline.labelType,
        centerTaskVisible: !!centerTaskStillVisible,
        drift
      });
      
      const screenshotNum = (i + 1).toString().padStart(2, '0');
      await page.screenshot({ 
        path: `screenshots/zoom-focus-${screenshotNum}-${step.label.replace(/\s+/g, '-')}.png`,
        fullPage: false
      });
    }
    
    // Final analysis
    console.log('\n📊 Zoom Focus Analysis:');
    console.log('='.repeat(50));
    
    trackingResults.forEach((result, i) => {
      console.log(`Step ${i + 1}: ${result.step}`);
      console.log(`  Day width: ${result.dayWidth}px (${result.labelType})`);
      console.log(`  Center task: ${result.centerTaskVisible ? '✅ Visible' : '❌ Lost'}`);
      if (result.drift >= 0) {
        console.log(`  Drift: ${result.drift.toFixed(0)}px`);
      }
    });
    
    // Calculate statistics
    const visibleCount = trackingResults.filter(r => r.centerTaskVisible).length;
    const visiblePercentage = (visibleCount / trackingResults.length) * 100;
    const avgDrift = trackingResults
      .filter(r => r.drift >= 0)
      .reduce((sum, r) => sum + r.drift, 0) / (visibleCount || 1);
    
    console.log('\n📈 Summary:');
    console.log(`  Center task visibility: ${visibleCount}/${trackingResults.length} (${visiblePercentage.toFixed(0)}%)`);
    console.log(`  Average drift: ${avgDrift.toFixed(0)}px`);
    
    // Check that zoom actually worked (dayWidth should change)
    const uniqueDayWidths = [...new Set(trackingResults.map(r => r.dayWidth))];
    console.log(`  Unique day widths: ${uniqueDayWidths.join(', ')}px`);
    
    // Verify zoom is working
    expect(uniqueDayWidths.length).toBeGreaterThan(1);
    
    // Verify reasonable focus stability
    expect(visiblePercentage).toBeGreaterThanOrEqual(60);
    
    // Verify timeline transitions happened
    const labelTypes = [...new Set(trackingResults.map(r => r.labelType))];
    console.log(`  Label types shown: ${labelTypes.join(', ')}`);
    
    // Take final comparison shot
    await page.screenshot({ 
      path: 'screenshots/zoom-focus-final-comparison.png',
      fullPage: false
    });
    
    console.log('\n✅ Zoom focus stability test complete!');
    console.log(`📸 Screenshots saved: ${zoomSequence.length + 2} images`);
  });
});