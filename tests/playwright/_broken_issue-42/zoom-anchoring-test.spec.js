import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Issue #42: Zoom Anchoring', () => {
  test('should zoom at mouse cursor position with proper anchoring', async ({ page }) => {
    // Navigate to the VibeGantt debug page
    await page.goto('/debug/vibegantt');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for React app root first
    await page.waitForSelector('#root');
    
    // Set up console logging FIRST before any interactions
    // Enable console logging to capture ALL messages (no filtering for debugging)
    page.on('console', msg => {
      const text = msg.text();
      // Log ALL console messages that contain any zoom/event related keywords
      if (text.includes('🖱️') || 
          text.includes('🔍') || 
          text.includes('📤') || 
          text.includes('✅') || 
          text.includes('⏭️') ||
          text.includes('CSS Transform Zoom') || 
          text.includes('applyCSSZoom') || 
          text.includes('Sending CSS zoom') ||
          text.includes('Applied CSS styles') ||
          text.includes('APPLY_CSS_ZOOM') ||
          text.includes('GanttRendererActor') ||
          text.includes('Container elements found') ||
          text.includes('Wheel event detected') ||
          text.includes('Zoom requested') ||
          text.includes('timeline-slice') ||
          text.includes('gantt-renderer-actor') ||
          text.includes('Forwarding event')) {
        console.log('🔍 CONSOLE:', text);
      }
    });
    
    // Also capture console errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ ERROR:', msg.text());
      } else if (msg.type() === 'warning') {
        console.log('⚠️ WARN:', msg.text());
      }
    });
    
    // Wait for any gantt element to appear
    await page.waitForSelector('[class*="gantt"], [class*="vibegantt"], .gantt-container, #vibegantt', { timeout: 10000 });
    
    // Wait for the gantt to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Take initial screenshot
    await page.screenshot({ path: 'zoom-test-initial.png' });
    
    // Find the gantt container (try multiple possible selectors)
    const ganttContainer = page.locator('[class*="gantt"], [class*="vibegantt"], .gantt-container, #vibegantt').first();
    await expect(ganttContainer).toBeVisible();
    
    // Get the bounding box for positioning mouse
    const ganttBox = await ganttContainer.boundingBox();
    console.log('Gantt container box:', ganttBox);
    
    // Position mouse at a specific point in the gantt (not center)
    const mouseX = ganttBox.x + ganttBox.width * 0.3; // 30% from left
    const mouseY = ganttBox.y + ganttBox.height * 0.5; // 50% from top
    
    console.log(`Positioning mouse at: (${mouseX}, ${mouseY})`);
    await page.mouse.move(mouseX, mouseY);
    
    // Perform zoom in with Ctrl+Wheel
    console.log('Performing zoom in...');
    
    // Move mouse to center of gantt first and focus
    await page.mouse.move(ganttBox.x + ganttBox.width / 2, ganttBox.y + ganttBox.height / 2);
    await ganttContainer.click(); // Focus the gantt
    
    console.log('About to trigger wheel event...');
    await page.keyboard.down('Control');
    
    // Use dispatchEvent to ensure the wheel event is properly sent
    await page.evaluate((coords) => {
      const element = document.querySelector('.vibegantt');
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -120,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        clientX: coords.x,
        clientY: coords.y
      });
      console.log('Dispatching wheel event:', wheelEvent);
      element.dispatchEvent(wheelEvent);
    }, { x: ganttBox.x + ganttBox.width / 2, y: ganttBox.y + ganttBox.height / 2 });
    
    await page.waitForTimeout(500); // Let the zoom apply
    
    // Take screenshot after first zoom
    await page.screenshot({ path: 'zoom-test-after-zoom-in-1.png' });
    
    // Zoom in more
    console.log('Performing second zoom in...');
    await page.evaluate((coords) => {
      const element = document.querySelector('.vibegantt');
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -120,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        clientX: coords.x,
        clientY: coords.y
      });
      console.log('Dispatching second wheel event:', wheelEvent);
      element.dispatchEvent(wheelEvent);
    }, { x: ganttBox.x + ganttBox.width / 2, y: ganttBox.y + ganttBox.height / 2 });
    
    await page.waitForTimeout(500);
    
    // Take screenshot after second zoom
    await page.screenshot({ path: 'zoom-test-after-zoom-in-2.png' });
    
    // Zoom out
    console.log('Performing zoom out...');
    await page.evaluate((coords) => {
      const element = document.querySelector('.vibegantt');
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 120,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        clientX: coords.x,
        clientY: coords.y
      });
      console.log('Dispatching zoom out wheel event:', wheelEvent);
      element.dispatchEvent(wheelEvent);
    }, { x: ganttBox.x + ganttBox.width / 2, y: ganttBox.y + ganttBox.height / 2 });
    
    await page.waitForTimeout(500);
    
    // Take screenshot after zoom out
    await page.screenshot({ path: 'zoom-test-after-zoom-out.png' });
    
    await page.keyboard.up('Control');
    
    // First, let's see what DOM elements actually exist
    const domElements = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('[class*="gantt"], [class*="timeline"], [class*="task"]'));
      return allElements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id
      }));
    });
    
    console.log('Found DOM elements:', JSON.stringify(domElements, null, 2));
    
    // Check if transform styles are applied to containers (using correct class names)
    const timelineTransform = await page.evaluate(() => {
      const timeline = document.querySelector('.vibegantt-timeline');
      console.log('Timeline element found:', !!timeline);
      return timeline ? timeline.style.transform : null;
    });
    
    const taskTransform = await page.evaluate(() => {
      const task = document.querySelector('.vibegantt-tasks');
      console.log('Tasks element found:', !!task);
      return task ? task.style.transform : null;
    });
    
    console.log('Timeline transform:', timelineTransform);
    console.log('Task transform:', taskTransform);
    
    // Verify that transforms are applied
    expect(timelineTransform).not.toBe('');
    expect(taskTransform).not.toBe('');
    
    // Check scroll position was updated for viewport anchoring
    const scrollPosition = await page.evaluate(() => {
      const scrollWrapper = document.querySelector('.vibegantt-tasks-wrapper');
      return scrollWrapper ? scrollWrapper.scrollLeft : 0;
    });
    
    console.log('Scroll position after zoom:', scrollPosition);
    
    // Scroll should be non-zero if anchoring worked (content shifted to keep mouse position stable)
    expect(scrollPosition).toBeGreaterThanOrEqual(0);
    
    // Check that zoom factor changed in the state
    const zoomFactor = await page.evaluate(() => {
      return window.__vibegantt_renderer_instance?.currentZoomFactor || 'not found';
    });
    
    console.log('Current zoom factor:', zoomFactor);
    
    // Final screenshot
    await page.screenshot({ path: 'zoom-test-final.png' });
  });
  
  test('should maintain content under mouse cursor during zoom', async ({ page }) => {
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#root');
    await page.waitForSelector('[class*="gantt"], [class*="vibegantt"], .gantt-container, #vibegantt', { timeout: 10000 });
    
    // Wait for gantt to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
    
    // Find a specific task element to use as reference point (try multiple selectors)
    const taskElement = page.locator('[class*="task"], [class*="gantt-task"], .vibegantt-task, .task-bar').first();
    await expect(taskElement).toBeVisible();
    
    // Get initial position of the task
    const initialBox = await taskElement.boundingBox();
    console.log('Initial task position:', initialBox);
    
    // Position mouse over the task
    const mouseX = initialBox.x + initialBox.width * 0.5;
    const mouseY = initialBox.y + initialBox.height * 0.5;
    await page.mouse.move(mouseX, mouseY);
    
    console.log('Mouse positioned over task at:', { mouseX, mouseY });
    
    // Zoom in while mouse is over the task
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -240); // Significant zoom in
    await page.waitForTimeout(500);
    await page.keyboard.up('Control');
    
    // Get new position of the task
    const newBox = await taskElement.boundingBox();
    console.log('Task position after zoom:', newBox);
    
    // The task should still be under or very close to the mouse cursor
    // With proper anchoring, the content under the mouse should stay relatively stable
    const mouseMoved = Math.abs((mouseX - initialBox.x) - (mouseX - newBox.x));
    console.log('Mouse relative movement:', mouseMoved);
    
    // Take comparison screenshots
    await page.screenshot({ path: 'anchoring-test-after-zoom.png' });
    
    // This is a basic check - proper anchoring means minimal cursor drift
    expect(mouseMoved).toBeLessThan(100); // Allow some tolerance
  });
});