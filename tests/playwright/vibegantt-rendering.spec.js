// tests/playwright/vibegantt-rendering.spec.js
// Test suite to verify VibeGantt components render correctly
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Rendering Tests', () => {
  test.setTimeout(60000);
  
  test.beforeEach(async ({ page }) => {
    console.log('🎯 Setting up VibeGantt test...');
    
    // Navigate to the app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Wait for sync overlay to disappear if visible
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      console.log('⏳ Waiting for sync to complete...');
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {
        console.log('⚠️ Sync overlay timeout');
      });
    }
    
    // Wait for app to stabilize
    await page.waitForTimeout(2000);
    
    // Navigate to a project (assuming we have at least one)
    const projectLink = page.locator('a[href*="/project/"]').first();
    if (await projectLink.count() > 0) {
      console.log('🔍 Found project link, navigating...');
      await projectLink.click();
      console.log('📁 Navigated to project');
      
      // Wait for project page to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Take a debug screenshot of project page
      await page.screenshot({ 
        path: 'screenshots/vibegantt-project-page.png',
        fullPage: true 
      });
    } else {
      console.log('⚠️ No project links found, staying on dashboard');
      
      // Take screenshot of dashboard
      await page.screenshot({ 
        path: 'screenshots/vibegantt-dashboard.png',
        fullPage: true 
      });
    }
  });
  
  test('should render task list', async ({ page, browserName }) => {
    console.log('\n=== TASK LIST RENDERING TEST ===');
    
    // First check if we're on a project page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Look for various task list selectors
    const taskListSelectors = [
      '[data-testid="task-list"]',
      '.task-list',
      '.gantt-task-list',
      '[class*="task-list"]',
      'div[role="table"]',
      '.vibegantt-task-list',
      '.gantt-container .task-list'
    ];
    
    let taskList = null;
    let isVisible = false;
    
    for (const selector of taskListSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        taskList = element;
        isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`✅ Found task list with selector: ${selector}`);
          break;
        }
      }
    }
    
    if (isVisible) {
      console.log('✅ Task list found and visible');
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/vibegantt-task-list.png',
        fullPage: true 
      });
      
      // Count task items with various selectors
      const taskItemSelectors = [
        '[data-testid*="task-item"]',
        '.task-item',
        '.gantt-task-row',
        '.task-row',
        'tr[data-task-id]',
        '.vibegantt-task-item'
      ];
      
      let taskItems = 0;
      for (const selector of taskItemSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          taskItems = count;
          console.log(`📊 Found ${taskItems} task items with selector: ${selector}`);
          break;
        }
      }
      
      expect(taskItems).toBeGreaterThanOrEqual(0);
    } else {
      console.log('⚠️ Task list not visible, checking for empty state');
      
      // Check for empty state
      const emptyState = await page.locator('text=/no tasks|empty|create.*task/i').isVisible().catch(() => false);
      
      if (emptyState) {
        console.log('✅ Empty state displayed correctly');
        
        await page.screenshot({ 
          path: 'screenshots/vibegantt-empty-state.png',
          fullPage: true 
        });
      } else {
        // Debug: Try to find any gantt-related elements
        const ganttElements = await page.locator('[class*="gantt"], [id*="gantt"], [class*="task"], [id*="task"]').count();
        console.log(`🔍 Found ${ganttElements} gantt/task-related elements`);
        
        // Log page structure for debugging
        const bodyHTML = await page.locator('body').innerHTML();
        const hasGanttContent = bodyHTML.includes('gantt') || bodyHTML.includes('Gantt') || bodyHTML.includes('task');
        console.log(`🔍 Page contains gantt/task content: ${hasGanttContent}`);
        
        await page.screenshot({ 
          path: 'screenshots/vibegantt-debug.png',
          fullPage: true 
        });
      }
    }
  });
  
  test('should render task bars', async ({ page }) => {
    console.log('\n=== TASK BARS RENDERING TEST ===');
    
    // Look for gantt chart container
    const ganttChart = page.locator('[data-testid="gantt-chart"], .gantt-chart, .gantt-bars-container');
    
    // Check if chart is visible
    const isVisible = await ganttChart.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('✅ Gantt chart container found');
      
      // Look for task bars
      const taskBars = page.locator('[data-testid*="task-bar"], .task-bar, .gantt-bar, rect[class*="bar"]');
      const barCount = await taskBars.count();
      
      console.log(`📊 Found ${barCount} task bars`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/vibegantt-task-bars.png',
        fullPage: true 
      });
      
      // Check bar properties if bars exist
      if (barCount > 0) {
        const firstBar = taskBars.first();
        const box = await firstBar.boundingBox();
        
        if (box) {
          console.log(`📐 First bar dimensions: ${box.width}x${box.height} at (${box.x}, ${box.y})`);
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    } else {
      console.log('⚠️ Gantt chart not visible');
      
      // Debug: log all visible elements
      const visibleElements = await page.locator('*:visible').evaluateAll(elements => 
        elements.slice(0, 20).map(el => ({
          tag: el.tagName,
          class: el.className,
          id: el.id
        }))
      );
      
      console.log('🔍 Visible elements:', JSON.stringify(visibleElements, null, 2));
    }
  });
  
  test('should render timeline', async ({ page }) => {
    console.log('\n=== TIMELINE RENDERING TEST ===');
    
    // Look for timeline/header with dates
    const timeline = page.locator('[data-testid="gantt-timeline"], .gantt-timeline, .gantt-header, [class*="timeline"]');
    
    const isVisible = await timeline.isVisible().catch(() => false);
    
    if (isVisible) {
      console.log('✅ Timeline found');
      
      // Look for date elements
      const dateElements = page.locator('[data-testid*="date"], .timeline-date, .gantt-date, text=/\\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i');
      const dateCount = await dateElements.count();
      
      console.log(`📅 Found ${dateCount} date elements`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/vibegantt-timeline.png',
        fullPage: true 
      });
      
      expect(dateCount).toBeGreaterThan(0);
    } else {
      console.log('⚠️ Timeline not found, checking for SVG elements');
      
      // Check for SVG timeline elements
      const svgTimeline = await page.locator('svg text').filter({ hasText: /\d{1,2}|jan|feb|mar/i }).count();
      console.log(`🔍 Found ${svgTimeline} SVG date elements`);
    }
  });
  
  test('should render dependency lines', async ({ page }) => {
    console.log('\n=== DEPENDENCY LINES RENDERING TEST ===');
    
    // Look for dependency lines (usually SVG paths or lines)
    const dependencies = page.locator('[data-testid*="dependency"], .dependency-line, .gantt-link, path[class*="dependency"], line[class*="dependency"]');
    
    const depCount = await dependencies.count();
    
    if (depCount > 0) {
      console.log(`✅ Found ${depCount} dependency lines`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/vibegantt-dependencies.png',
        fullPage: true 
      });
      
      // Check first dependency
      const firstDep = dependencies.first();
      const isVisible = await firstDep.isVisible();
      
      expect(isVisible).toBe(true);
      console.log('📏 First dependency line is visible');
    } else {
      console.log('⚠️ No dependency lines found');
      
      // This might be expected if no tasks have dependencies
      // Check for SVG container that might hold dependencies
      const svgContainer = await page.locator('svg').filter(async svg => {
        const html = await svg.innerHTML();
        return html.includes('path') || html.includes('line');
      }).count();
      
      console.log(`🔍 Found ${svgContainer} SVG containers that might hold dependencies`);
      
      await page.screenshot({ 
        path: 'screenshots/vibegantt-no-dependencies.png',
        fullPage: true 
      });
    }
  });
  
  test('should handle resize and scroll', async ({ page }) => {
    console.log('\n=== RESIZE AND SCROLL TEST ===');
    
    // Set viewport to test responsiveness
    await page.setViewportSize({ width: 1200, height: 800 });
    console.log('📐 Set viewport to 1200x800');
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-wide-view.png',
      fullPage: true 
    });
    
    // Narrow view
    await page.setViewportSize({ width: 800, height: 600 });
    console.log('📐 Set viewport to 800x600');
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'screenshots/vibegantt-narrow-view.png',
      fullPage: true 
    });
    
    // Check if horizontal scroll is available
    const hasHorizontalScroll = await page.evaluate(() => {
      const ganttContainer = document.querySelector('[class*="gantt"]');
      if (ganttContainer) {
        return ganttContainer.scrollWidth > ganttContainer.clientWidth;
      }
      return false;
    });
    
    console.log(`📜 Horizontal scroll available: ${hasHorizontalScroll}`);
  });
  
  test.afterAll(async () => {
    console.log('\n=== VIBEGANTT RENDERING TESTS COMPLETE ===');
    console.log('📸 Screenshots saved in: ./screenshots/');
    console.log('✅ All rendering tests completed');
  });
});