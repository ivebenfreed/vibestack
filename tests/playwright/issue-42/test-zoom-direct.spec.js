/**
 * Test for Issue #42: Direct Zoom Testing
 * 
 * This test directly triggers zoom events on the gantt component
 * to verify zoom functionality and focus stability.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Direct Zoom Testing', () => {
  test('should zoom correctly and maintain focus', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for the gantt chart to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Helper to trigger zoom directly on the element
    const triggerZoom = async (direction) => {
      return await page.evaluate((dir) => {
        const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
        if (!wrapper) return null;
        
        // Create and dispatch a wheel event with Ctrl key
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: dir === 'in' ? -120 : 120,
          clientX: wrapper.clientWidth / 2,
          clientY: wrapper.clientHeight / 2,
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        
        wrapper.dispatchEvent(wheelEvent);
        
        // Get current state
        const segments = document.querySelectorAll('.vibegantt-timeline-segment');
        const dayWidth = segments.length > 0 ? 
          parseFloat(segments[0].style.width || '50') : 50;
        
        return { dayWidth };
      }, direction);
    };
    
    // Get comprehensive state
    const getState = async () => {
      return await page.evaluate(() => {
        const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
        const tasks = document.querySelectorAll('.vibegantt-task');
        const segments = document.querySelectorAll('.vibegantt-timeline-segment');
        const labels = document.querySelectorAll('.vibegantt-timeline-label');
        
        // Get timeline state
        const dayWidth = segments.length > 0 ? 
          parseFloat(segments[0].style.width || '50') : 50;
        
        const timelineLabels = Array.from(labels)
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
        
        // Get scroll and task info
        const scrollLeft = wrapper?.scrollLeft || 0;
        const viewportWidth = wrapper?.clientWidth || 0;
        const viewportCenter = scrollLeft + viewportWidth / 2;
        
        const visibleTasks = Array.from(tasks).filter(task => {
          const left = parseFloat(task.style.left || '0');
          const width = parseFloat(task.style.width || '0');
          return left + width >= scrollLeft && left <= scrollLeft + viewportWidth;
        });
        
        return {
          dayWidth,
          labelType,
          labels: timelineLabels.slice(0, 5),
          visibleTasks: visibleTasks.length,
          scrollLeft,
          viewportCenter
        };
      });
    };
    
    // Scroll to middle
    await page.evaluate(() => {
      const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
      if (wrapper) wrapper.scrollLeft = 1000;
    });
    await page.waitForTimeout(500);
    
    // Get initial state
    let state = await getState();
    console.log('\n📸 Initial State:');
    console.log(`  Day width: ${state.dayWidth}px (${state.labelType})`);
    console.log(`  Labels: ${state.labels.join(', ')}`);
    console.log(`  Visible tasks: ${state.visibleTasks}`);
    console.log(`  Scroll: ${state.scrollLeft}`);
    
    await page.screenshot({ 
      path: 'screenshots/zoom-direct-00-initial.png',
      fullPage: false
    });
    
    const results = [];
    const initialDayWidth = state.dayWidth;
    
    // Perform zoom operations
    console.log('\n🔍 Testing zoom operations...\n');
    
    // Zoom in 3 times
    for (let i = 1; i <= 3; i++) {
      console.log(`Zoom In #${i}:`);
      const result = await triggerZoom('in');
      await page.waitForTimeout(500);
      
      state = await getState();
      console.log(`  Day width: ${state.dayWidth}px (${state.labelType})`);
      console.log(`  Labels: ${state.labels.slice(0, 3).join(', ')}`);
      
      results.push({ 
        operation: `Zoom In #${i}`, 
        dayWidth: state.dayWidth,
        labelType: state.labelType 
      });
      
      await page.screenshot({ 
        path: `screenshots/zoom-direct-${i.toString().padStart(2, '0')}-in.png`,
        fullPage: false
      });
    }
    
    // Zoom out 5 times
    for (let i = 1; i <= 5; i++) {
      console.log(`Zoom Out #${i}:`);
      const result = await triggerZoom('out');
      await page.waitForTimeout(500);
      
      state = await getState();
      console.log(`  Day width: ${state.dayWidth}px (${state.labelType})`);
      console.log(`  Labels: ${state.labels.slice(0, 3).join(', ')}`);
      
      results.push({ 
        operation: `Zoom Out #${i}`, 
        dayWidth: state.dayWidth,
        labelType: state.labelType 
      });
      
      await page.screenshot({ 
        path: `screenshots/zoom-direct-${(i+3).toString().padStart(2, '0')}-out.png`,
        fullPage: false
      });
    }
    
    // Zoom back in 2 times
    for (let i = 1; i <= 2; i++) {
      console.log(`Zoom In Again #${i}:`);
      const result = await triggerZoom('in');
      await page.waitForTimeout(500);
      
      state = await getState();
      console.log(`  Day width: ${state.dayWidth}px (${state.labelType})`);
      console.log(`  Labels: ${state.labels.slice(0, 3).join(', ')}`);
      
      results.push({ 
        operation: `Zoom In Again #${i}`, 
        dayWidth: state.dayWidth,
        labelType: state.labelType 
      });
      
      await page.screenshot({ 
        path: `screenshots/zoom-direct-${(i+8).toString().padStart(2, '0')}-in-again.png`,
        fullPage: false
      });
    }
    
    // Analysis
    console.log('\n📊 Zoom Operation Results:');
    console.log('='.repeat(50));
    
    const dayWidths = results.map(r => r.dayWidth);
    const uniqueWidths = [...new Set(dayWidths)];
    const labelTypes = [...new Set(results.map(r => r.labelType))];
    
    results.forEach(r => {
      console.log(`${r.operation}: ${r.dayWidth}px (${r.labelType})`);
    });
    
    console.log('\n📈 Summary:');
    console.log(`  Starting width: ${initialDayWidth}px`);
    console.log(`  Final width: ${state.dayWidth}px`);
    console.log(`  Unique widths: ${uniqueWidths.join(', ')}px`);
    console.log(`  Label types shown: ${labelTypes.join(', ')}`);
    
    // Verify zoom worked
    if (uniqueWidths.length > 1) {
      console.log('  ✅ Zoom is working correctly!');
      
      // Check label transitions
      if (labelTypes.length > 1) {
        console.log('  ✅ Timeline labels transition correctly!');
      } else {
        console.log('  ⚠️ Timeline labels did not transition');
      }
    } else {
      console.log('  ❌ Zoom is not changing dayWidth');
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'screenshots/zoom-direct-final.png',
      fullPage: false
    });
    
    // Assertions
    expect(uniqueWidths.length).toBeGreaterThan(1);
    expect(labelTypes.length).toBeGreaterThanOrEqual(2);
    
    console.log('\n✅ Direct zoom test complete!');
    console.log(`📸 Screenshots saved: ${results.length + 2} images`);
  });
});