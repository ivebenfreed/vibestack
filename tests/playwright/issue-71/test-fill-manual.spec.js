/**
 * Manual test for fill handle - run with --headed to inspect visually
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Fill Handle Manual Test', () => {
  
  test('should allow manual inspection of fill handle behavior', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🎯 Manual fill handle test - inspect in browser');
    
    // Select a cell with content
    const cells = page.locator('.vibegridx-cell');
    const targetCell = cells.nth(1); // Skip selection checkbox column
    
    console.log('📍 Clicking on first content cell...');
    await targetCell.click();
    await page.waitForTimeout(1000);
    
    // Log all elements that might be fill handles
    const fillHandleInfo = await page.evaluate(() => {
      const handles = document.querySelectorAll('.vibegridx-fill-handle');
      const containers = document.querySelectorAll('.vibegridx-fill-handle-container');
      const overlayContainer = document.querySelector('.vibegridx-overlay-container');
      
      return {
        fillHandles: Array.from(handles).map(handle => ({
          className: handle.className,
          visible: handle.offsetWidth > 0 && handle.offsetHeight > 0,
          style: {
            display: handle.style.display,
            left: handle.style.left,
            top: handle.style.top,
            width: handle.style.width,
            height: handle.style.height,
            pointerEvents: handle.style.pointerEvents,
            zIndex: handle.style.zIndex
          },
          boundingRect: handle.getBoundingClientRect(),
          parent: handle.parentElement?.className || 'no parent'
        })),
        containers: Array.from(containers).map(container => ({
          className: container.className,
          childCount: container.children.length,
          style: {
            position: container.style.position,
            pointerEvents: container.style.pointerEvents
          }
        })),
        overlayContainer: overlayContainer ? {
          className: overlayContainer.className,
          childCount: overlayContainer.children.length,
          children: Array.from(overlayContainer.children).map(child => child.className)
        } : null
      };
    });
    
    console.log('🔍 Fill handle investigation:');
    console.log('📊 Fill handles found:', fillHandleInfo.fillHandles.length);
    fillHandleInfo.fillHandles.forEach((handle, i) => {
      console.log(`   Handle ${i + 1}:`, {
        visible: handle.visible,
        position: `${handle.style.left}, ${handle.style.top}`,
        size: `${handle.style.width} x ${handle.style.height}`,
        pointerEvents: handle.style.pointerEvents,
        boundingRect: handle.boundingRect,
        parent: handle.parent
      });
    });
    
    console.log('📊 Container info:', fillHandleInfo.containers);
    console.log('📊 Overlay container:', fillHandleInfo.overlayContainer);
    
    // Wait for manual inspection
    console.log('⏳ Waiting 10 seconds for manual inspection...');
    console.log('   - Look for the fill handle (small square at bottom-right of selection)');
    console.log('   - Try dragging it down to fill cells');
    console.log('   - Check browser console for any error messages');
    
    await page.waitForTimeout(10000);
    
    // Test programmatic interaction
    const firstHandle = fillHandleInfo.fillHandles[0];
    if (firstHandle && firstHandle.visible && firstHandle.boundingRect.width > 0) {
      console.log('🖱️ Attempting programmatic drag...');
      
      const rect = firstHandle.boundingRect;
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      
      console.log(`   Dragging from (${centerX}, ${centerY}) down 120px`);
      
      try {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX, centerY + 120, { steps: 10 });
        await page.waitForTimeout(1000);
        await page.mouse.up();
        
        console.log('✅ Programmatic drag completed');
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.log('❌ Programmatic drag failed:', error.message);
      }
    } else {
      console.log('❌ No visible fill handle found for programmatic test');
    }
    
    // Final state check
    console.log('📊 Final test results:');
    const finalMessages = await page.evaluate(() => {
      // Return any relevant console messages that were logged
      return 'Check browser console for fill operation messages';
    });
    console.log(finalMessages);
  });
  
  test('should test different selection scenarios', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🎯 Testing different selection scenarios...');
    
    const cells = page.locator('.vibegridx-cell');
    
    // Test 1: Single cell selection
    console.log('📍 Test 1: Single cell selection');
    await cells.nth(1).click();
    await page.waitForTimeout(1000);
    
    let handleCount = await page.locator('.vibegridx-fill-handle').count();
    console.log(`   Fill handles visible: ${handleCount}`);
    
    // Test 2: Multi-cell selection
    console.log('📍 Test 2: Multi-cell drag selection');
    await cells.nth(1).click();
    await page.keyboard.down('Shift');
    await cells.nth(2).click();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(1000);
    
    handleCount = await page.locator('.vibegridx-fill-handle').count();
    console.log(`   Fill handles visible: ${handleCount}`);
    
    // Test 3: Different cell with data
    console.log('📍 Test 3: Cell with rich data');
    
    // Find a cell with actual content
    const cellsWithContent = await page.$$eval('.vibegridx-cell', (cells) => {
      return cells.slice(1, 20).map((cell, i) => ({
        index: i + 1,
        text: cell.textContent?.trim() || '',
        hasContent: (cell.textContent?.trim().length || 0) > 5
      })).filter(cell => cell.hasContent);
    });
    
    if (cellsWithContent.length > 0) {
      const targetCell = cellsWithContent[0];
      console.log(`   Selecting cell ${targetCell.index} with content: "${targetCell.text}"`);
      
      await cells.nth(targetCell.index).click();
      await page.waitForTimeout(1000);
      
      handleCount = await page.locator('.vibegridx-fill-handle').count();
      console.log(`   Fill handles visible: ${handleCount}`);
      
      // Try a quick drag test on this cell
      const fillHandle = page.locator('.vibegridx-fill-handle').first();
      if (await fillHandle.isVisible()) {
        console.log('   ✅ Fill handle is visible, attempting drag...');
        
        try {
          const boundingBox = await fillHandle.boundingBox();
          if (boundingBox) {
            const x = boundingBox.x + boundingBox.width / 2;
            const y = boundingBox.y + boundingBox.height / 2;
            
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x, y + 80); // 2 rows down
            await page.waitForTimeout(500);
            await page.mouse.up();
            await page.waitForTimeout(1000);
            
            console.log('   ✅ Drag operation completed');
            
            // Check if any cells were modified
            const modifiedCells = await page.$$eval('.vibegridx-cell', (cells) => {
              return cells.slice(1, 10).map((cell, i) => ({
                index: i,
                text: cell.textContent?.trim() || '',
                highlighted: cell.style.backgroundColor !== ''
              })).filter(cell => cell.highlighted || cell.text === targetCell.text);
            });
            
            console.log('   📊 Potentially modified cells:', modifiedCells.length);
            modifiedCells.forEach((cell, i) => {
              if (i < 5) { // Log first 5
                console.log(`      Cell ${cell.index}: "${cell.text}" (highlighted: ${cell.highlighted})`);
              }
            });
          }
        } catch (error) {
          console.log('   ❌ Drag test failed:', error.message);
        }
      } else {
        console.log('   ❌ Fill handle not visible');
      }
    } else {
      console.log('   ⚠️ No cells with rich content found');
    }
  });
});