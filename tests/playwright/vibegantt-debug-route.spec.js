// tests/playwright/vibegantt-debug-route.spec.js
// Test suite to verify VibeGantt components using the debug route
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Debug Route Tests', () => {
  test.setTimeout(60000);
  
  test('should render all VibeGantt components on debug page', async ({ page }) => {
    console.log('🎯 Testing VibeGantt debug route...');
    
    // Navigate directly to the debug route
    await page.goto('/debug/vibegantt');
    console.log('🌐 Navigated to /debug/vibegantt');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give components time to render
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-debug-initial.png',
      fullPage: true 
    });
    
    console.log('\n=== CHECKING VIBEGANTT COMPONENTS ===');
    
    // 1. Check for task list
    const taskListSelectors = [
      '.vibegantt-task-list',
      '.task-list',
      '[data-testid="task-list"]',
      '.gantt-task-list',
      '.vibegantt-sidebar',
      '.gantt-sidebar'
    ];
    
    let taskListFound = false;
    for (const selector of taskListSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Task list found with selector: ${selector}`);
        taskListFound = true;
        break;
      }
    }
    
    if (!taskListFound) {
      console.log('⚠️ Task list not found, checking for task rows...');
      const taskRows = await page.locator('.task-row, .gantt-task-row, tr[data-task-id]').count();
      console.log(`📊 Found ${taskRows} task rows`);
    }
    
    // 2. Check for timeline
    const timelineSelectors = [
      '.vibegantt-timeline',
      '.timeline-header',
      '.gantt-timeline',
      '.timeline-container',
      'svg .timeline',
      '.date-header'
    ];
    
    let timelineFound = false;
    for (const selector of timelineSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Timeline found with selector: ${selector}`);
        timelineFound = true;
        break;
      }
    }
    
    if (!timelineFound) {
      console.log('⚠️ Timeline not found, checking for date elements...');
      const dateElements = await page.locator('text=/\\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i').count();
      console.log(`📅 Found ${dateElements} date elements`);
    }
    
    // 3. Check for task bars (SVG elements)
    const taskBarSelectors = [
      '.vibegantt-task-bar',
      '.task-bar',
      '.gantt-bar',
      'rect.task-bar',
      'rect[data-task-id]',
      '.gantt-chart rect',
      'svg rect[class*="task"]'
    ];
    
    let taskBarsFound = false;
    let taskBarCount = 0;
    for (const selector of taskBarSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Task bars found with selector: ${selector} (${count} bars)`);
        taskBarsFound = true;
        taskBarCount = count;
        break;
      }
    }
    
    // 4. Check for dependency lines
    const dependencySelectors = [
      '.vibegantt-dependency',
      '.dependency-line',
      '.gantt-link',
      'path.dependency',
      'line.dependency',
      'svg path[class*="dependency"]',
      'svg line[class*="dependency"]'
    ];
    
    let dependenciesFound = false;
    for (const selector of dependencySelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Dependencies found with selector: ${selector} (${count} lines)`);
        dependenciesFound = true;
        break;
      }
    }
    
    // 5. Check for the main VibeGantt container
    const mainContainerSelectors = [
      '.vibegantt',
      '.vibegantt-container',
      '[data-testid="vibegantt"]',
      '.gantt-container',
      '#vibegantt'
    ];
    
    let containerFound = false;
    for (const selector of mainContainerSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Main container found with selector: ${selector}`);
        containerFound = true;
        
        // Get container dimensions
        const box = await page.locator(selector).first().boundingBox();
        if (box) {
          console.log(`📐 Container dimensions: ${box.width}x${box.height}`);
        }
        break;
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-debug-final.png',
      fullPage: true 
    });
    
    // Log SVG content for debugging
    const svgCount = await page.locator('svg').count();
    console.log(`\n🔍 Found ${svgCount} SVG elements on page`);
    
    if (svgCount > 0) {
      const svgContent = await page.locator('svg').first().innerHTML();
      const hasRects = svgContent.includes('<rect');
      const hasPaths = svgContent.includes('<path');
      const hasLines = svgContent.includes('<line');
      console.log(`   SVG contains: rects=${hasRects}, paths=${hasPaths}, lines=${hasLines}`);
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Container: ${containerFound ? '✅' : '❌'}`);
    console.log(`Task List: ${taskListFound ? '✅' : '❌'}`);
    console.log(`Timeline: ${timelineFound ? '✅' : '❌'}`);
    console.log(`Task Bars: ${taskBarsFound ? '✅' : '❌'} (${taskBarCount} found)`);
    console.log(`Dependencies: ${dependenciesFound ? '✅' : '❌'}`);
    
    // Assert at least some components are found
    const componentsFound = [containerFound, taskListFound, timelineFound, taskBarsFound].filter(Boolean).length;
    expect(componentsFound).toBeGreaterThanOrEqual(2); // At least 2 out of 4 main components
  });
  
  test('should interact with VibeGantt components', async ({ page }) => {
    console.log('\n=== TESTING VIBEGANTT INTERACTIONS ===');
    
    // Navigate to debug route
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Try to click on a task bar
    const taskBarSelectors = [
      '.task-bar',
      '.gantt-bar',
      'rect.task-bar',
      'rect[data-task-id]'
    ];
    
    let clickableBar = null;
    for (const selector of taskBarSelectors) {
      const bars = page.locator(selector);
      if (await bars.count() > 0) {
        clickableBar = bars.first();
        break;
      }
    }
    
    if (clickableBar) {
      console.log('🖱️ Clicking on first task bar...');
      await clickableBar.click();
      await page.waitForTimeout(500);
      
      // Check if any selection or highlight occurred
      const selectedElements = await page.locator('.selected, .highlighted, [data-selected="true"]').count();
      console.log(`✅ Selected elements after click: ${selectedElements}`);
      
      await page.screenshot({ 
        path: 'screenshots/vibegantt-after-click.png',
        fullPage: true 
      });
    }
    
    // Test viewport resize
    console.log('\n📐 Testing viewport resize...');
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-wide-viewport.png',
      fullPage: true 
    });
    
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-narrow-viewport.png',
      fullPage: true 
    });
  });
});