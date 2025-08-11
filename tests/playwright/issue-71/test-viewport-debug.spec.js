/**
 * Test to debug viewport updates for fill handle
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Viewport Debug', () => {
  
  test('should test viewport initialization and updates', async ({ page }) => {
    const viewportMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('viewport') || text.includes('Viewport') || text.includes('VIEWPORT') ||
          text.includes('scroll') || text.includes('Scroll')) {
        viewportMessages.push(text);
      }
    });
    
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(3000); // Wait longer for initialization
    
    console.log('📊 Initial viewport messages:');
    viewportMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    viewportMessages.length = 0;
    
    // Select a cell and see if that triggers viewport updates
    console.log('🎯 Selecting a cell to trigger viewport handling...');
    const cells = page.locator('.vibegridx-cell');
    await cells.first().click();
    await page.waitForTimeout(1000);
    
    console.log('📊 Viewport messages after cell selection:');
    viewportMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    viewportMessages.length = 0;
    
    // Try scrolling to trigger viewport updates
    console.log('📜 Scrolling to trigger viewport updates...');
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(1000);
    
    console.log('📊 Viewport messages after scrolling:');
    viewportMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    viewportMessages.length = 0;
    
    // Test programmatic viewport query
    console.log('🔍 Programmatically checking viewport state...');
    const viewportInfo = await page.evaluate(() => {
      // Check if we can access the table machine
      const actor = window.__vibegridx_table_actor;
      if (actor && actor.getSnapshot) {
        const snapshot = actor.getSnapshot();
        return {
          hasActor: true,
          hasViewport: !!snapshot?.context?.viewport,
          viewport: snapshot?.context?.viewport,
          hasCanvasActor: !!snapshot?.context?.actors?.canvasActor
        };
      } else {
        return { hasActor: false };
      }
    });
    
    console.log('📊 Programmatic viewport info:', viewportInfo);
    
    // Try to manually trigger a viewport update by calling scroll handler
    console.log('🔧 Manually triggering scroll event...');
    await page.evaluate(() => {
      const table = document.querySelector('.vibegridx-table');
      if (table) {
        const scrollEvent = new Event('scroll', { bubbles: true });
        table.dispatchEvent(scrollEvent);
      }
    });
    
    await page.waitForTimeout(1000);
    
    console.log('📊 Viewport messages after manual scroll event:');
    viewportMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    
    // Summary
    const totalMessages = viewportMessages.length;
    console.log(`📊 Total viewport-related messages: ${totalMessages}`);
  });
  
  test('should trigger fill with manual viewport injection', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🔧 Testing fill handle with manual viewport injection...');
    
    // Select a cell
    const cells = page.locator('.vibegridx-cell');
    await cells.nth(1).click();
    await page.waitForTimeout(500);
    
    // Manually inject viewport into canvas overlay
    await page.evaluate(() => {
      // Find the canvas overlay and inject viewport
      const overlayContainer = document.querySelector('.vibegridx-overlay-container');
      if (overlayContainer && window.__vibegridx_canvas_actor) {
        console.log('🔧 Manually sending UPDATE_VIEWPORT to canvas actor');
        
        // Create a mock viewport
        const mockViewport = {
          start: 0,
          end: 10,
          scrollTop: 0,
          containerHeight: 400,
          rowHeight: 40
        };
        
        window.__vibegridx_canvas_actor.send({
          type: 'UPDATE_VIEWPORT',
          viewport: mockViewport
        });
        
        console.log('✅ Manual viewport update sent');
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Now try the fill operation
    console.log('🖱️ Attempting fill operation with injected viewport...');
    const fillHandle = page.locator('.vibegridx-fill-handle').first();
    
    if (await fillHandle.isVisible()) {
      const boundingBox = await fillHandle.boundingBox();
      if (boundingBox) {
        const x = boundingBox.x + boundingBox.width / 2;
        const y = boundingBox.y + boundingBox.height / 2;
        
        const fillMessages = [];
        page.on('console', msg => {
          const text = msg.text();
          if (text.includes('Fill') || text.includes('FILL') || 
              text.includes('preview') || text.includes('complete')) {
            fillMessages.push(text);
          }
        });
        
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 120); // 3 rows down
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.waitForTimeout(1000);
        
        console.log('📊 Fill messages with manual viewport:');
        fillMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg}`);
        });
        
        // Check if preview elements were created
        const previewCount = await page.locator('.vibegridx-fill-preview').count();
        console.log(`📊 Fill preview elements created: ${previewCount}`);
        
        if (previewCount > 0) {
          console.log('✅ Success! Fill preview elements were created with manual viewport');
        } else {
          console.log('❌ Still no fill preview elements even with manual viewport');
        }
      }
    }
  });
});