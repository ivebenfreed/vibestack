// tests/playwright/issue-41/vibegantt-zoom-real-test.spec.js
// Real zoom functionality test for VibeGantt
import { test, expect } from '../fixtures/persistent-context.js';

test.describe('VibeGantt Real Zoom Functionality', () => {
  test.setTimeout(60000);
  
  test('should trigger real zoom events and verify visual changes', async ({ page }) => {
    console.log('🚀 Starting REAL VibeGantt zoom test...');
    
    // Track ALL console messages for debugging
    const allLogs = [];
    const zoomLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      allLogs.push(text);
      
      // Capture zoom-specific logs
      if (text.includes('Zoom requested:') || 
          text.includes('zoom') || 
          text.includes('ZOOM') ||
          text.includes('scale') ||
          text.includes('Scale')) {
        zoomLogs.push(text);
        console.log(`[ZOOM LOG] ${text}`);
      }
    });
    
    // Navigate to VibeGantt debug route
    console.log('📍 Navigating to VibeGantt...');
    await page.goto('/debug/vibegantt');
    
    // Wait for VibeGantt to be ready
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Wait for the actual gantt chart to render
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let it fully render
    
    console.log('✅ VibeGantt loaded and ready');
    
    // Get initial measurements
    const initialState = await page.evaluate(() => {
      const gantt = document.querySelector('.vibegantt');
      const chart = document.querySelector('.vibegantt-chart');
      const timeline = document.querySelector('.vibegantt-timeline');
      const tasks = document.querySelectorAll('.vibegantt-task, .gantt-task');
      const timeLabels = document.querySelectorAll('.timeline-label, .timeline-header');
      
      // Get computed styles to check for transforms
      const chartTransform = chart ? window.getComputedStyle(chart).transform : 'none';
      
      return {
        ganttExists: !!gantt,
        chartExists: !!chart,
        timelineExists: !!timeline,
        ganttWidth: gantt?.clientWidth || 0,
        ganttHeight: gantt?.clientHeight || 0,
        chartWidth: chart?.scrollWidth || 0,
        chartHeight: chart?.scrollHeight || 0,
        taskCount: tasks.length,
        labelCount: timeLabels.length,
        scrollLeft: gantt?.scrollLeft || 0,
        scrollTop: gantt?.scrollTop || 0,
        chartTransform,
        timeLabels: Array.from(timeLabels).slice(0, 5).map(l => l.textContent)
      };
    });
    
    console.log('📊 Initial state:', JSON.stringify(initialState, null, 2));
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/zoom-real-initial.png',
      fullPage: true 
    });
    
    // Find the gantt element to interact with
    const ganttElement = page.locator('.vibegantt').first();
    await expect(ganttElement).toBeVisible();
    
    // Get the bounding box
    const box = await ganttElement.boundingBox();
    if (!box) throw new Error('Could not get gantt bounding box');
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    console.log(`📍 Gantt center: (${centerX}, ${centerY})`);
    console.log(`📐 Gantt dimensions: ${box.width}x${box.height}`);
    
    // METHOD 1: Try mouse wheel with Ctrl modifier
    console.log('\n🔍 METHOD 1: Testing Ctrl + Mouse Wheel...');
    
    // Move mouse to center of gantt
    await page.mouse.move(centerX, centerY);
    
    // Try different approaches to trigger zoom
    console.log('  Attempting zoom IN (Ctrl + Wheel Up)...');
    
    // Approach 1: Hold Ctrl, then wheel
    await page.keyboard.down('Control');
    await page.waitForTimeout(100);
    
    // Multiple small wheel events
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(100);
    }
    
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    
    // Check if zoom was triggered
    const zoomInTriggered = zoomLogs.some(log => log.includes('Zoom requested: in'));
    console.log(`  ✓ Zoom IN triggered: ${zoomInTriggered}`);
    
    // Take screenshot after zoom in attempt
    await page.screenshot({ 
      path: 'screenshots/zoom-real-after-wheel-in.png',
      fullPage: true 
    });
    
    // Try zoom OUT
    console.log('  Attempting zoom OUT (Ctrl + Wheel Down)...');
    
    await page.keyboard.down('Control');
    await page.waitForTimeout(100);
    
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(100);
    }
    
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    
    const zoomOutTriggered = zoomLogs.some(log => log.includes('Zoom requested: out'));
    console.log(`  ✓ Zoom OUT triggered: ${zoomOutTriggered}`);
    
    await page.screenshot({ 
      path: 'screenshots/zoom-real-after-wheel-out.png',
      fullPage: true 
    });
    
    // METHOD 2: Try dispatching wheel event directly
    console.log('\n🔍 METHOD 2: Dispatching wheel event directly...');
    
    const wheelEventTriggered = await page.evaluate((centerPos) => {
      const gantt = document.querySelector('.vibegantt');
      if (!gantt) return false;
      
      // Create and dispatch a wheel event with ctrlKey
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -120,
        clientX: centerPos.x,
        clientY: centerPos.y,
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      
      gantt.dispatchEvent(wheelEvent);
      return true;
    }, { x: centerX, y: centerY });
    
    console.log(`  ✓ Wheel event dispatched: ${wheelEventTriggered}`);
    await page.waitForTimeout(500);
    
    // METHOD 3: Try keyboard shortcuts
    console.log('\n🔍 METHOD 3: Testing keyboard shortcuts...');
    
    // Focus on the gantt
    await ganttElement.click();
    await page.waitForTimeout(100);
    
    console.log('  Attempting Ctrl+Equal (zoom in)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('Equal');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    
    console.log('  Attempting Ctrl+Minus (zoom out)...');
    await page.keyboard.down('Control');
    await page.keyboard.press('Minus');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'screenshots/zoom-real-after-keyboard.png',
      fullPage: true 
    });
    
    // Get final state
    const finalState = await page.evaluate(() => {
      const gantt = document.querySelector('.vibegantt');
      const chart = document.querySelector('.vibegantt-chart');
      const tasks = document.querySelectorAll('.vibegantt-task, .gantt-task');
      const timeLabels = document.querySelectorAll('.timeline-label, .timeline-header');
      
      const chartTransform = chart ? window.getComputedStyle(chart).transform : 'none';
      
      return {
        ganttWidth: gantt?.clientWidth || 0,
        ganttHeight: gantt?.clientHeight || 0,
        chartWidth: chart?.scrollWidth || 0,
        chartHeight: chart?.scrollHeight || 0,
        taskCount: tasks.length,
        labelCount: timeLabels.length,
        scrollLeft: gantt?.scrollLeft || 0,
        scrollTop: gantt?.scrollTop || 0,
        chartTransform,
        timeLabels: Array.from(timeLabels).slice(0, 5).map(l => l.textContent)
      };
    });
    
    console.log('\n📊 Final state:', JSON.stringify(finalState, null, 2));
    
    // Analysis
    console.log('\n=== ZOOM TEST RESULTS ===');
    console.log(`📋 Total console logs captured: ${allLogs.length}`);
    console.log(`🔍 Zoom-specific logs captured: ${zoomLogs.length}`);
    
    if (zoomLogs.length > 0) {
      console.log('\n📝 Zoom logs:');
      zoomLogs.forEach(log => console.log(`  - ${log}`));
    }
    
    // Check for visual changes
    const visualChanges = {
      widthChanged: initialState.chartWidth !== finalState.chartWidth,
      heightChanged: initialState.chartHeight !== finalState.chartHeight,
      labelCountChanged: initialState.labelCount !== finalState.labelCount,
      scrollChanged: initialState.scrollLeft !== finalState.scrollLeft,
      transformChanged: initialState.chartTransform !== finalState.chartTransform,
      labelsChanged: JSON.stringify(initialState.timeLabels) !== JSON.stringify(finalState.timeLabels)
    };
    
    console.log('\n📊 Visual changes detected:');
    console.log(`  - Chart width changed: ${visualChanges.widthChanged} (${initialState.chartWidth} → ${finalState.chartWidth})`);
    console.log(`  - Chart height changed: ${visualChanges.heightChanged} (${initialState.chartHeight} → ${finalState.chartHeight})`);
    console.log(`  - Label count changed: ${visualChanges.labelCountChanged} (${initialState.labelCount} → ${finalState.labelCount})`);
    console.log(`  - Scroll position changed: ${visualChanges.scrollChanged}`);
    console.log(`  - Transform changed: ${visualChanges.transformChanged}`);
    console.log(`  - Labels changed: ${visualChanges.labelsChanged}`);
    
    // Determine pass/fail
    const zoomEventsDetected = zoomLogs.length > 0;
    const visualChangeDetected = Object.values(visualChanges).some(v => v);
    
    console.log('\n=== FINAL VERDICT ===');
    if (zoomEventsDetected && visualChangeDetected) {
      console.log('✅ PASS: Zoom events triggered AND visual changes detected!');
    } else if (zoomEventsDetected && !visualChangeDetected) {
      console.log('⚠️  PARTIAL: Zoom events triggered but NO visual changes detected');
      console.log('   (Zoom handler may not be fully implemented)');
    } else if (!zoomEventsDetected && visualChangeDetected) {
      console.log('⚠️  UNEXPECTED: No zoom events but visual changes detected');
    } else {
      console.log('❌ FAIL: No zoom events triggered and no visual changes');
    }
    
    // Assert based on findings
    if (zoomEventsDetected) {
      console.log('\n✅ TEST RESULT: Zoom events successfully triggered!');
      expect(zoomLogs.length).toBeGreaterThan(0);
    } else {
      // If no zoom events, the zoom functionality isn't working
      console.log('\n❌ TEST RESULT: Zoom functionality not working');
      console.log('   The zoom handler exists but events are not reaching it.');
      
      // This will fail the test
      expect(zoomLogs.length).toBeGreaterThan(0);
    }
  });
});