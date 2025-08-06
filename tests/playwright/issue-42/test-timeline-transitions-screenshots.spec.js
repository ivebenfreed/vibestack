/**
 * Test for Issue #42: Timeline Scale Transitions with Screenshots
 * 
 * This test verifies that timeline labels properly transition between
 * day/week/month display based on zoom level and captures screenshots
 * at each transition point.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Timeline Scale Transitions', () => {
  test('should transition timeline labels at different zoom levels', async ({ page }) => {
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for the gantt chart to be ready
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let everything stabilize
    
    // Helper function to get current timeline label info
    const getTimelineInfo = async () => {
      return await page.evaluate(() => {
        // Get timeline labels (the actual day/week/month labels)
        const timelineLabels = document.querySelectorAll('.vibegantt-timeline-label');
        const segments = Array.from(timelineLabels).map(label => {
          const text = label.textContent?.trim() || '';
          return text;
        }).filter(label => label.length > 0);
        
        // Determine label type based on content
        let labelType = 'unknown';
        if (segments.length > 0) {
          // Check multiple labels to determine type
          const firstFewLabels = segments.slice(0, 5);
          const hasNumbers = firstFewLabels.some(label => /^\d+$/.test(label));
          const hasWeeks = firstFewLabels.some(label => /^W\d+/.test(label));
          const hasMonths = firstFewLabels.some(label => /^[A-Z][a-z]+/.test(label));
          
          if (hasNumbers && !hasWeeks && !hasMonths) {
            labelType = 'days';
          } else if (hasWeeks) {
            labelType = 'weeks';
          } else if (hasMonths) {
            labelType = 'months';
          }
        }
        
        // Get dayWidth from timeline segment widths
        let dayWidth = 50; // default
        const timelineSegments = document.querySelectorAll('.vibegantt-timeline-segment');
        if (timelineSegments.length > 0) {
          // Get the first segment that has a width
          for (const segment of timelineSegments) {
            const width = parseFloat(segment.style.width || '0');
            if (width > 0) {
              dayWidth = width;
              break;
            }
          }
        }
        
        return {
          labelType,
          sampleLabels: segments.slice(0, 10),
          segmentCount: segments.length,
          estimatedDayWidth: dayWidth
        };
      });
    };
    
    // Helper function to zoom to a specific level
    const zoomToLevel = async (targetDayWidth) => {
      const chartArea = await page.locator('.vibegantt-tasks-wrapper');
      await chartArea.hover();
      await page.mouse.move(500, 300); // Move to middle of chart
      
      // Get current state
      let currentInfo = await getTimelineInfo();
      let currentDayWidth = currentInfo.estimatedDayWidth;
      
      console.log(`Current dayWidth: ${currentDayWidth}, target: ${targetDayWidth}`);
      
      // Zoom in or out to reach target
      const maxIterations = 20;
      let iteration = 0;
      
      while (Math.abs(currentDayWidth - targetDayWidth) > 5 && iteration < maxIterations) {
        const needZoomIn = currentDayWidth < targetDayWidth;
        
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, needZoomIn ? -120 : 120);
        await page.keyboard.up('Control');
        await page.waitForTimeout(500);
        
        currentInfo = await getTimelineInfo();
        currentDayWidth = currentInfo.estimatedDayWidth;
        console.log(`After zoom ${needZoomIn ? 'in' : 'out'}: dayWidth = ${currentDayWidth}`);
        
        iteration++;
      }
      
      return currentInfo;
    };
    
    // Test 1: Default view (50px) - should show days
    console.log('\n=== Test 1: Default view (50px) - should show days ===');
    let info = await getTimelineInfo();
    console.log('Default view:', info);
    await page.screenshot({ 
      path: 'screenshots/timeline-default-days.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
    expect(info.labelType).toBe('days');
    
    // Test 2: Zoom out slightly to ~30px - should show weeks
    console.log('\n=== Test 2: Zoom out slightly to ~30px - should show weeks ===');
    
    // Zoom out just twice to get to ~30px (50 -> 40 -> 30)
    const chartArea = await page.locator('.vibegantt-tasks-wrapper');
    await chartArea.hover();
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 120); // Positive for zoom out
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);
    }
    
    info = await getTimelineInfo();
    console.log('After zoom out to ~30px:', info);
    await page.screenshot({ 
      path: 'screenshots/timeline-zoomed-weeks.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
    
    // Check label type based on actual dayWidth
    if (info.estimatedDayWidth >= 35) {
      expect(info.labelType).toBe('days');
    } else if (info.estimatedDayWidth >= 15) {
      expect(info.labelType).toBe('weeks');
    } else {
      expect(info.labelType).toBe('months');
    }
    
    // Test 3: Zoom out more to ~10px - should show months
    console.log('\n=== Test 3: Zoom out to ~10px - should show months ===');
    
    // Zoom out more (from 30 to 10, need about 2 more zooms)
    for (let i = 0; i < 2; i++) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 120);
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);
    }
    
    info = await getTimelineInfo();
    console.log('After zoom out to ~10px:', info);
    await page.screenshot({ 
      path: 'screenshots/timeline-zoomed-months.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
    
    // Check label type
    expect(info.labelType).toBe('months');
    
    // Test 4: Zoom in to ~60px - should show days again
    console.log('\n=== Test 4: Zoom in to ~60px - should show days ===');
    
    // Zoom in several times
    for (let i = 0; i < 8; i++) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -120); // Negative for zoom in
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);
    }
    
    info = await getTimelineInfo();
    console.log('After zoom in to ~60px:', info);
    await page.screenshot({ 
      path: 'screenshots/timeline-zoomed-in-days.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 200 }
    });
    expect(info.labelType).toBe('days');
    
    // Final screenshot showing the full gantt with timeline
    await page.screenshot({ 
      path: 'screenshots/timeline-full-view.png',
      fullPage: false
    });
    
    console.log('\n=== Timeline transition test completed ===');
    console.log('Screenshots saved to screenshots/ directory');
  });
});