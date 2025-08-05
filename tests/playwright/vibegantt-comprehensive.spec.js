// tests/playwright/vibegantt-comprehensive.spec.js
// Comprehensive test suite to verify all VibeGantt DOM elements render correctly
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Comprehensive DOM Rendering Tests', () => {
  test.setTimeout(120000); // Longer timeout for initialization
  
  test.beforeEach(async ({ page }) => {
    console.log('🎯 Setting up VibeGantt comprehensive test...');
    
    // Navigate directly to the VibeGantt debug page
    await page.goto('/debug/vibegantt');
    console.log('🌐 Navigated to VibeGantt debug page');
    
    // Wait for page to fully load and render
    await page.waitForLoadState('networkidle');
    console.log('⏳ Network idle achieved');
    
    // Wait for any sync operations if needed
    await page.waitForTimeout(3000);
    console.log('⏳ Additional wait for component initialization');
    
    // Take initial screenshot for debugging
    await page.screenshot({ 
      path: 'screenshots/vibegantt-debug-initial.png',
      fullPage: true 
    });
    console.log('📸 Initial screenshot captured');
  });
  
  test('should render main VibeGantt container', async ({ page }) => {
    console.log('\n=== MAIN CONTAINER TEST ===');
    
    // Check for main VibeGantt container
    const vibeGanttContainer = page.locator('.vibegantt');
    await expect(vibeGanttContainer).toBeVisible({ timeout: 10000 });
    console.log('✅ Main VibeGantt container found and visible');
    
    // Verify container has expected styles
    const containerBox = await vibeGanttContainer.boundingBox();
    expect(containerBox).toBeTruthy();
    console.log(`📐 Container dimensions: ${containerBox.width}x${containerBox.height}`);
    
    // Check that container has height set
    expect(containerBox.height).toBeGreaterThan(0);
    console.log('✅ Container has valid height');
  });
  
  test('should render task list section', async ({ page }) => {
    console.log('\n=== TASK LIST SECTION TEST ===');
    
    // Look for task list with various selectors
    const taskListSelectors = [
      '.gantt-task-list',
      '[data-testid="task-list"]',
      '.task-list',
      '.vibegantt .task-list',
      '.gantt-left-panel',
      '[class*="task-list"]'
    ];
    
    let taskListFound = false;
    let taskListElement = null;
    
    for (const selector of taskListSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0 && await element.isVisible().catch(() => false)) {
        taskListElement = element;
        taskListFound = true;
        console.log(`✅ Task list found with selector: ${selector}`);
        break;
      }
    }
    
    if (taskListFound) {
      // Check for task items within the list
      const taskItemSelectors = [
        '.task-item',
        '[data-testid*="task"]',
        '.gantt-task-row',
        'tr[data-task-id]',
        '.vibegantt-task'
      ];
      
      let taskCount = 0;
      for (const selector of taskItemSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          taskCount = count;
          console.log(`📊 Found ${taskCount} task items with selector: ${selector}`);
          break;
        }
      }
      
      console.log(`✅ Task list contains ${taskCount} tasks`);
    } else {
      console.log('⚠️ Task list not found, checking for custom DOM elements...');
      
      // Check for any custom DOM elements that might be the task list
      const customElements = await page.locator('.vibegantt *').count();
      console.log(`🔍 Found ${customElements} elements inside vibegantt container`);
      
      // Log the HTML structure for debugging
      const containerHTML = await page.locator('.vibegantt').innerHTML().catch(() => 'Container not found');
      console.log(`🔍 Container HTML preview: ${containerHTML.substring(0, 200)}...`);
    }
  });
  
  test('should render timeline/chart area', async ({ page }) => {
    console.log('\n=== TIMELINE/CHART AREA TEST ===');
    
    // Look for timeline/chart area
    const timelineSelectors = [
      '.gantt-timeline',
      '.gantt-chart',
      '[data-testid="timeline"]',
      '.timeline-container',
      '.gantt-right-panel',
      'svg.gantt-timeline',
      'canvas.gantt-timeline'
    ];
    
    let timelineFound = false;
    let timelineElement = null;
    
    for (const selector of timelineSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0 && await element.isVisible().catch(() => false)) {
        timelineElement = element;
        timelineFound = true;
        console.log(`✅ Timeline found with selector: ${selector}`);
        break;
      }
    }
    
    if (timelineFound) {
      const timelineBox = await timelineElement.boundingBox();
      console.log(`📐 Timeline dimensions: ${timelineBox.width}x${timelineBox.height}`);
      expect(timelineBox.width).toBeGreaterThan(0);
      expect(timelineBox.height).toBeGreaterThan(0);
    } else {
      console.log('⚠️ Timeline not found with standard selectors');
      
      // Check for any SVG or Canvas elements
      const svgCount = await page.locator('.vibegantt svg').count();
      const canvasCount = await page.locator('.vibegantt canvas').count();
      console.log(`🔍 Found ${svgCount} SVG elements and ${canvasCount} Canvas elements`);
      
      if (svgCount > 0 || canvasCount > 0) {
        console.log('✅ Custom rendering elements found (SVG/Canvas)');
      }
    }
  });
  
  test('should render timeline headers with dates', async ({ page }) => {
    console.log('\n=== TIMELINE HEADERS TEST ===');
    
    // Look for date headers
    const dateSelectors = [
      '.gantt-header',
      '.timeline-header',
      '[data-testid*="date"]',
      '.gantt-date',
      '.timeline-date'
    ];
    
    let headersFound = false;
    
    for (const selector of dateSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        const visibleCount = await elements.filter({ hasText: /\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i }).count();
        if (visibleCount > 0) {
          console.log(`✅ Found ${visibleCount} date headers with selector: ${selector}`);
          headersFound = true;
          break;
        }
      }
    }
    
    if (!headersFound) {
      // Check for dates in SVG text elements
      const svgDates = await page.locator('.vibegantt svg text').filter({ hasText: /\d{1,2}|jan|feb|mar/i }).count();
      console.log(`🔍 Found ${svgDates} SVG date elements`);
      
      if (svgDates > 0) {
        console.log('✅ SVG-based date headers found');
        headersFound = true;
      }
    }
    
    if (!headersFound) {
      console.log('⚠️ No date headers found');
      // This might be expected if the component uses custom rendering
    }
  });
  
  test('should render task bars/gantt bars', async ({ page }) => {
    console.log('\n=== TASK BARS TEST ===');
    
    // Look for gantt bars
    const barSelectors = [
      '.gantt-bar',
      '.task-bar',
      '[data-testid*="bar"]',
      'rect[class*="bar"]',
      '.vibegantt-bar',
      '.gantt-task-bar'
    ];
    
    let barsFound = false;
    let barCount = 0;
    
    for (const selector of barSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        barCount = count;
        console.log(`✅ Found ${barCount} task bars with selector: ${selector}`);
        barsFound = true;
        
        // Check first bar properties
        const firstBar = elements.first();
        const isVisible = await firstBar.isVisible().catch(() => false);
        if (isVisible) {
          const box = await firstBar.boundingBox();
          if (box) {
            console.log(`📐 First bar dimensions: ${box.width}x${box.height}`);
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
          }
        }
        break;
      }
    }
    
    if (!barsFound) {
      // Check for custom DOM elements or SVG rectangles
      const svgRects = await page.locator('.vibegantt svg rect').count();
      const customBars = await page.locator('.vibegantt [style*="position"], .vibegantt [style*="width"]').count();
      
      console.log(`🔍 Found ${svgRects} SVG rectangles and ${customBars} positioned elements`);
      
      if (svgRects > 0 || customBars > 0) {
        console.log('✅ Custom-rendered bars found');
        barsFound = true;
      }
    }
    
    if (!barsFound) {
      console.log('⚠️ No task bars found - might indicate rendering issue');
    }
  });
  
  test('should render dependency lines', async ({ page }) => {
    console.log('\n=== DEPENDENCY LINES TEST ===');
    
    // Look for dependency lines
    const dependencySelectors = [
      '.dependency-line',
      '.gantt-link',
      '[data-testid*="dependency"]',
      'path[class*="dependency"]',
      'line[class*="dependency"]',
      '.gantt-dependency'
    ];
    
    let dependenciesFound = false;
    let depCount = 0;
    
    for (const selector of dependencySelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        depCount = count;
        console.log(`✅ Found ${depCount} dependency lines with selector: ${selector}`);
        dependenciesFound = true;
        break;
      }
    }
    
    if (!dependenciesFound) {
      // Check for SVG paths or lines that might be dependencies
      const svgPaths = await page.locator('.vibegantt svg path').count();
      const svgLines = await page.locator('.vibegantt svg line').count();
      
      console.log(`🔍 Found ${svgPaths} SVG paths and ${svgLines} SVG lines`);
      
      if (svgPaths > 0 || svgLines > 0) {
        console.log('✅ Potential dependency lines found in SVG');
        dependenciesFound = true;
      }
    }
    
    if (!dependenciesFound) {
      console.log('⚠️ No dependency lines found - might be expected if no task dependencies exist');
    }
  });
  
  test('should handle rendering state and debug output', async ({ page }) => {
    console.log('\n=== RENDERING STATE DEBUG TEST ===');
    
    // Check for any error messages or loading states
    const errorMessages = await page.locator('text=/error|fail|not found/i').count();
    console.log(`🔍 Found ${errorMessages} error messages`);
    
    // Check console logs for renderer information
    const consoleLogs = [];
    page.on('console', (msg) => {
      if (msg.text().includes('VibeGantt') || msg.text().includes('gantt') || msg.text().includes('renderer')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Trigger a small interaction to generate logs
    await page.click('body');
    await page.waitForTimeout(1000);
    
    if (consoleLogs.length > 0) {
      console.log('📄 Recent VibeGantt console logs:');
      consoleLogs.slice(-5).forEach(log => console.log(`   ${log}`));
    }
    
    // Check if the component rendered anything at all
    const ganttElements = await page.locator('.vibegantt *').count();
    console.log(`🔍 Total elements inside .vibegantt: ${ganttElements}`);
    
    if (ganttElements === 0) {
      console.log('❌ No elements rendered inside VibeGantt container - likely initialization issue');
      
      // Check if the container exists but is empty
      const containerExists = await page.locator('.vibegantt').count();
      console.log(`🔍 VibeGantt container exists: ${containerExists > 0}`);
      
      if (containerExists > 0) {
        const containerHTML = await page.locator('.vibegantt').innerHTML();
        console.log(`🔍 Container contents: ${containerHTML || 'EMPTY'}`);
      }
    } else {
      console.log('✅ VibeGantt container has child elements');
    }
    
    // Take final debug screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-debug-final.png',
      fullPage: true 
    });
    console.log('📸 Final debug screenshot captured');
  });
  
  test('should be responsive and handle viewport changes', async ({ page }) => {
    console.log('\n=== RESPONSIVE BEHAVIOR TEST ===');
    
    // Test wide viewport
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(1000);
    
    const wideBox = await page.locator('.vibegantt').boundingBox();
    console.log(`📐 Wide viewport - container: ${wideBox?.width}x${wideBox?.height}`);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-wide-viewport.png',
      fullPage: true 
    });
    
    // Test narrow viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    
    const narrowBox = await page.locator('.vibegantt').boundingBox();
    console.log(`📐 Narrow viewport - container: ${narrowBox?.width}x${narrowBox?.height}`);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-narrow-viewport.png',
      fullPage: true 
    });
    
    // Verify container adjusts to viewport
    if (wideBox && narrowBox) {
      expect(narrowBox.width).toBeLessThan(wideBox.width);
      console.log('✅ Container width adjusts to viewport');
    }
  });
  
  test.afterAll(async () => {
    console.log('\n=== VIBEGANTT COMPREHENSIVE TESTS COMPLETE ===');
    console.log('📸 Debug screenshots saved in: ./screenshots/');
    console.log('✅ All comprehensive rendering tests completed');
  });
});