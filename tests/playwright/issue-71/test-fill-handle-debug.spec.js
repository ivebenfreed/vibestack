/**
 * Test to debug fill handle functionality - drag to fill cells with data
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Fill Handle Debug', () => {
  
  test('should test fill handle visibility and drag functionality', async ({ page }) => {
    const fillMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('fill') || text.includes('Fill') || text.includes('FILL') || 
          text.includes('drag') || text.includes('Drag') || text.includes('DRAG')) {
        fillMessages.push(text);
      }
    });
    
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🎯 Testing fill handle behavior...');
    
    // Step 1: Select a cell to see if fill handle appears
    const cells = page.locator('.vibegridx-cell');
    const firstCell = cells.first();
    
    await firstCell.click();
    await page.waitForTimeout(500);
    
    // Look for fill handle element
    const fillHandles = page.locator('.vibegridx-fill-handle, .fill-handle, [data-testid="fill-handle"]');
    const fillHandleCount = await fillHandles.count();
    
    console.log(`📊 Fill handle elements found: ${fillHandleCount}`);
    
    if (fillHandleCount > 0) {
      // Get fill handle details
      const fillHandle = fillHandles.first();
      const isVisible = await fillHandle.isVisible();
      const boundingBox = await fillHandle.boundingBox();
      
      console.log('🎯 Fill handle details:', {
        visible: isVisible,
        boundingBox: boundingBox,
        elementCount: fillHandleCount
      });
      
      if (isVisible && boundingBox) {
        console.log('🖱️ Attempting to drag fill handle...');
        
        // Clear previous messages to focus on drag operation
        fillMessages.length = 0;
        
        // Try to drag down to fill more cells
        await fillHandle.hover();
        await page.waitForTimeout(200);
        
        const startX = boundingBox.x + boundingBox.width / 2;
        const startY = boundingBox.y + boundingBox.height / 2;
        const endY = startY + 120; // Drag down 3 rows (40px each)
        
        console.log(`📍 Drag coordinates: start(${startX}, ${startY}) → end(${startX}, ${endY})`);
        
        // Attempt drag operation
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, endY, { steps: 10 });
        await page.waitForTimeout(500); // Wait for fill preview
        await page.mouse.up();
        
        await page.waitForTimeout(1000);
        
        console.log('🔍 Fill operation messages:');
        fillMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg}`);
        });
      } else {
        console.log('⚠️ Fill handle not visible or no bounding box');
      }
    } else {
      console.log('❌ No fill handle elements found');
    }
    
    // Step 2: Check for fill preview elements
    const fillPreviews = page.locator('.vibegridx-fill-preview, .fill-preview, [data-testid="fill-preview"]');
    const previewCount = await fillPreviews.count();
    console.log(`📊 Fill preview elements: ${previewCount}`);
    
    // Step 3: Look for any overlay containers that might contain fill handles
    const overlayContainers = page.locator('.vibegridx-overlay-container, .vibegridx-fill-container, .canvas-overlay');
    const overlayCount = await overlayContainers.count();
    console.log(`📊 Overlay containers: ${overlayCount}`);
    
    if (overlayCount > 0) {
      for (let i = 0; i < overlayCount; i++) {
        const container = overlayContainers.nth(i);
        const className = await container.getAttribute('class');
        const childCount = await container.locator('*').count();
        console.log(`   Container ${i + 1}: class="${className}", children=${childCount}`);
      }
    }
    
    // Step 4: Check if there are DOM elements in the fill handle layer
    const fillElements = await page.$$eval('*', (elements) => {
      return elements
        .filter(el => {
          const classes = el.className?.toString() || '';
          const id = el.id?.toString() || '';
          return classes.includes('fill') || id.includes('fill') || 
                 classes.includes('handle') || id.includes('handle');
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className?.toString() || '',
          id: el.id?.toString() || '',
          visible: el.offsetHeight > 0 && el.offsetWidth > 0,
          position: {
            left: el.style.left || 'auto',
            top: el.style.top || 'auto',
            position: el.style.position || 'static'
          }
        }));
    });
    
    console.log('🔍 DOM elements with "fill" or "handle" in class/id:');
    fillElements.forEach((el, i) => {
      console.log(`   ${i + 1}. ${el.tagName}.${el.className}#${el.id} (visible: ${el.visible})`);
    });
    
    // Step 5: Test programmatic fill operation by sending events
    console.log('🧪 Testing programmatic fill events...');
    
    // Try to trigger fill events directly
    await page.evaluate(() => {
      // Look for table machine actor
      const actor = window.__vibegridx_table_actor;
      if (actor) {
        console.log('📡 Found table actor, sending FILL_START event');
        actor.send({
          type: 'FILL_START',
          direction: 'vertical',
          startCells: new Set(['some-cell-id:some-column-id'])
        });
      } else {
        console.log('❌ No table actor found on window');
      }
      
      // Also check for canvas actor
      const canvasActor = window.__vibegridx_canvas_actor;
      if (canvasActor) {
        console.log('📡 Found canvas actor');
      } else {
        console.log('❌ No canvas actor found on window');
      }
    });
    
    await page.waitForTimeout(1000);
    
    console.log('📋 Final fill operation debug messages:');
    fillMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    
    // Summary
    console.log('📊 Fill Handle Debug Summary:');
    console.log(`   Fill handles found: ${fillHandleCount}`);
    console.log(`   Fill previews found: ${previewCount}`);
    console.log(`   Overlay containers: ${overlayCount}`);
    console.log(`   DOM fill elements: ${fillElements.length}`);
    console.log(`   Fill messages captured: ${fillMessages.length}`);
  });
  
  test('should test selection and fill handle relationship', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🔗 Testing selection → fill handle relationship...');
    
    // Select a cell with actual content
    const cells = page.locator('.vibegridx-cell');
    let selectedCell = null;
    let selectedText = '';
    
    // Find a cell with content
    for (let i = 0; i < Math.min(10, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText && cellText.trim().length > 2 && !cellText.includes('Select')) {
        selectedCell = cells.nth(i);
        selectedText = cellText.trim();
        console.log(`🎯 Selected cell with content: "${selectedText}"`);
        break;
      }
    }
    
    if (!selectedCell) {
      console.log('⚠️ No suitable cell with content found');
      return;
    }
    
    await selectedCell.click();
    await page.waitForTimeout(1000);
    
    // Check for selection overlays
    const selectionOverlays = page.locator('.vibegridx-selection-overlay, .selection-overlay');
    const selectionCount = await selectionOverlays.count();
    console.log(`📊 Selection overlays: ${selectionCount}`);
    
    // Check for fill handle after selection
    const fillHandles = page.locator('.vibegridx-fill-handle, .fill-handle');
    const fillHandleCount = await fillHandles.count();
    console.log(`📊 Fill handles after selection: ${fillHandleCount}`);
    
    // Look for any element positioned at bottom-right of selection
    const potentialHandles = await page.$$eval('.vibegridx-overlay-container *', (elements) => {
      return elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return rect.width < 20 && rect.height < 20 && // Small element
                 (style.cursor === 'nw-resize' || style.cursor === 'crosshair' ||
                  el.className.includes('handle') || el.className.includes('resize'));
        })
        .map(el => ({
          className: el.className,
          cursor: window.getComputedStyle(el).cursor,
          size: { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height },
          position: { left: el.style.left, top: el.style.top }
        }));
    });
    
    console.log('🔍 Potential handle elements:', potentialHandles);
    
    // Check if fill handle is rendered by CanvasOverlayDOM
    const canvasInfo = await page.evaluate(() => {
      const overlayContainer = document.querySelector('.vibegridx-overlay-container');
      if (overlayContainer) {
        const fillContainer = overlayContainer.querySelector('.vibegridx-fill-container');
        const fillHandle = overlayContainer.querySelector('.vibegridx-fill-handle');
        
        return {
          hasOverlayContainer: true,
          hasFillContainer: !!fillContainer,
          hasFillHandle: !!fillHandle,
          fillContainerChildren: fillContainer ? fillContainer.children.length : 0,
          fillHandleVisible: fillHandle ? fillHandle.offsetHeight > 0 : false
        };
      }
      return { hasOverlayContainer: false };
    });
    
    console.log('🎯 Canvas overlay DOM info:', canvasInfo);
  });
});