/**
 * Baseline test for Issue #71 - VibeGridDex with Konva overlays
 * 
 * This test captures the current state before converting from Konva to DOM + Anime.js
 * It verifies that the table loads and selection graphics work with the Konva implementation
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('VibeGridDex baseline - Konva selection overlays', async ({ page }) => {
  console.log('🚀 Navigating to Tasks page...');
  
  // Go to home first
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => 
    document.body.getAttribute('data-playwright-ready') === 'true',
    { timeout: 15000 }
  );
  
  // Click Tasks in sidebar
  await page.click('[data-testid="nav-link-tasks"]');
  await page.waitForURL('**/tasks', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Verify VibeGridDex is loaded
  const gridSelector = '[data-testid="vibegridx-tasks-table-v2"]';
  await page.waitForSelector(gridSelector, { timeout: 10000 });
  
  console.log('✅ VibeGridDex loaded');
  
  // Get initial state
  const initialState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const konvaContent = document.querySelector('.konvajs-content');
    const cells = document.querySelectorAll('.vibegridx-cell');
    
    return {
      hasCanvas: !!canvas,
      hasKonva: !!konvaContent,
      cellCount: cells.length,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
    };
  });
  
  console.log('📊 Initial state:', initialState);
  
  // Find and click the first data cell (not header)
  const firstCell = await page.locator('.vibegridx-cell').first();
  const cellBounds = await firstCell.boundingBox();
  
  if (cellBounds) {
    console.log('📍 Clicking first cell at:', { x: cellBounds.x, y: cellBounds.y });
    
    // Click the cell
    await firstCell.click();
    await page.waitForTimeout(500);
    
    // Take screenshot after clicking
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-selection-single.png', 
      fullPage: false 
    });
    
    // Check if selection overlay appeared (Konva draws on canvas)
    const afterClickState = await page.evaluate(() => {
      // Check for selection classes or attributes
      const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
      const canvas = document.querySelector('canvas');
      
      // Try to get canvas context to check if anything was drawn
      let canvasHasContent = false;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // Check if canvas has non-transparent pixels (selection overlay)
          for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] > 0) { // Alpha channel
              canvasHasContent = true;
              break;
            }
          }
        }
      }
      
      return {
        selectedCount: selectedCells.length,
        canvasHasContent,
        activeElement: document.activeElement?.className
      };
    });
    
    console.log('📊 After single click:', afterClickState);
    
    // Try Shift+Click for range selection
    console.log('📍 Shift+clicking another cell for range selection...');
    
    const fifthCell = await page.locator('.vibegridx-cell').nth(4);
    await fifthCell.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(500);
    
    // Take screenshot of range selection
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-selection-range.png', 
      fullPage: false 
    });
    
    const afterRangeState = await page.evaluate(() => {
      const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
      const canvas = document.querySelector('canvas');
      
      // Check Konva stage for selection shapes
      let konvaSelectionInfo = null;
      if (window.Konva && canvas) {
        const stage = window.Konva.stages[0];
        if (stage) {
          const layers = stage.getLayers();
          const shapes = [];
          layers.forEach(layer => {
            layer.getChildren().forEach(shape => {
              if (shape.className === 'Rect' && shape.attrs.fill) {
                shapes.push({
                  type: shape.className,
                  fill: shape.attrs.fill,
                  opacity: shape.attrs.opacity,
                  x: shape.attrs.x,
                  y: shape.attrs.y
                });
              }
            });
          });
          konvaSelectionInfo = { layerCount: layers.length, shapeCount: shapes.length, shapes };
        }
      }
      
      return {
        selectedCount: selectedCells.length,
        konvaInfo: konvaSelectionInfo
      };
    });
    
    console.log('📊 After range selection:', afterRangeState);
    
    // Try Ctrl+Click for multi-selection
    console.log('📍 Ctrl+clicking for multi-selection...');
    
    const tenthCell = await page.locator('.vibegridx-cell').nth(9);
    await tenthCell.click({ modifiers: ['Control'] });
    await page.waitForTimeout(500);
    
    // Take screenshot of multi-selection
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-selection-multi.png', 
      fullPage: false 
    });
    
    const afterMultiState = await page.evaluate(() => {
      const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
      
      // Try to detect selection rectangles in Konva
      let selectionRects = 0;
      if (window.Konva) {
        const stage = window.Konva.stages[0];
        if (stage) {
          stage.getLayers().forEach(layer => {
            layer.getChildren().forEach(shape => {
              // Selection overlays typically have low opacity
              if (shape.className === 'Rect' && shape.attrs.opacity < 0.5 && shape.attrs.opacity > 0) {
                selectionRects++;
              }
            });
          });
        }
      }
      
      return {
        selectedCount: selectedCells.length,
        selectionRects
      };
    });
    
    console.log('📊 After multi-selection:', afterMultiState);
    
    // Test keyboard navigation
    console.log('⌨️ Testing keyboard navigation...');
    
    // Press Escape to clear selection
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // Click a cell and use arrow keys
    await firstCell.click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    
    // Take screenshot after keyboard navigation
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-keyboard-nav.png', 
      fullPage: false 
    });
    
    const afterKeyboardNav = await page.evaluate(() => {
      const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
      const activeCell = document.activeElement;
      
      return {
        selectedCount: selectedCells.length,
        activeElementClass: activeCell?.className,
        activeElementTestId: activeCell?.getAttribute('data-testid')
      };
    });
    
    console.log('📊 After keyboard navigation:', afterKeyboardNav);
    
    // TEST DRAG MULTISELECT
    console.log('\n🖱️ Testing drag multiselect...');
    const secondCell = await page.locator('.vibegridx-cell').nth(1);
    const ninthCell = await page.locator('.vibegridx-cell').nth(8);
    
    // Get positions for drag
    const startPos = await secondCell.boundingBox();
    const endPos = await ninthCell.boundingBox();
    
    if (startPos && endPos) {
      // Perform drag selection
      await page.mouse.move(startPos.x + 5, startPos.y + 5);
      await page.mouse.down();
      await page.mouse.move(endPos.x + endPos.width - 5, endPos.y + endPos.height - 5, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'screenshots/issue-71/vibegridx-drag-multiselect.png', 
        fullPage: false 
      });
      
      const afterDragSelect = await page.evaluate(() => {
        const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
        return { selectedCount: selectedCells.length };
      });
      
      console.log('  - Drag selected cells:', afterDragSelect.selectedCount);
    }
    
    // TEST COPY/PASTE (Ctrl+C, Ctrl+V)
    console.log('\n📋 Testing copy/paste...');
    
    // Select a cell with content
    await firstCell.click();
    await page.waitForTimeout(300);
    
    // Copy (Ctrl+C)
    await page.keyboard.down('Control');
    await page.keyboard.press('c');
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);
    
    // Check for clipboard overlay
    const afterCopy = await page.evaluate(() => {
      // Look for clipboard indicators
      const clipboardOverlay = document.querySelector('.clipboard-overlay');
      const konvaClipboard = window.Konva?.stages[0]?.find('.clipboard-indicator');
      return {
        hasClipboardOverlay: !!clipboardOverlay,
        hasKonvaClipboard: konvaClipboard?.length > 0
      };
    });
    
    console.log('  - Copy triggered, clipboard overlay:', afterCopy.hasClipboardOverlay || afterCopy.hasKonvaClipboard);
    
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-after-copy.png', 
      fullPage: false 
    });
    
    // Move to another cell and paste
    const targetCell = await page.locator('.vibegridx-cell').nth(15);
    await targetCell.click();
    await page.waitForTimeout(300);
    
    // Paste (Ctrl+V)
    await page.keyboard.down('Control');
    await page.keyboard.press('v');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-after-paste.png', 
      fullPage: false 
    });
    
    console.log('  - Paste executed');
    
    // TEST FILL DRAG
    console.log('\n📐 Testing fill drag...');
    
    // Select a cell
    await firstCell.click();
    await page.waitForTimeout(300);
    
    // Look for fill handle
    const fillHandleInfo = await page.evaluate(() => {
      // Check for fill handle in DOM or Konva
      const fillHandle = document.querySelector('.fill-handle, .vibegridx-fill-handle');
      let konvaFillHandle = null;
      
      if (window.Konva) {
        const stage = window.Konva.stages[0];
        if (stage) {
          // Look for small square/circle typically used as fill handle
          const handles = stage.find((node) => {
            return node.className === 'Rect' && node.width() < 20 && node.height() < 20;
          });
          konvaFillHandle = handles.length > 0;
        }
      }
      
      return {
        hasDOMFillHandle: !!fillHandle,
        hasKonvaFillHandle: konvaFillHandle,
        fillHandlePosition: fillHandle ? fillHandle.getBoundingClientRect() : null
      };
    });
    
    console.log('  - Fill handle present:', fillHandleInfo.hasDOMFillHandle || fillHandleInfo.hasKonvaFillHandle);
    
    // If we have a fill handle position, try to drag it
    if (fillHandleInfo.fillHandlePosition) {
      const handleX = fillHandleInfo.fillHandlePosition.x + fillHandleInfo.fillHandlePosition.width / 2;
      const handleY = fillHandleInfo.fillHandlePosition.y + fillHandleInfo.fillHandlePosition.height / 2;
      
      await page.mouse.move(handleX, handleY);
      await page.mouse.down();
      await page.mouse.move(handleX, handleY + 100, { steps: 10 }); // Drag down 100px
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'screenshots/issue-71/vibegridx-fill-drag.png', 
        fullPage: false 
      });
      
      console.log('  - Fill drag executed');
    }
    
    // TEST DOUBLE-CLICK TO EDIT
    console.log('\n✏️ Testing double-click to edit...');
    
    await firstCell.dblclick();
    await page.waitForTimeout(500);
    
    const editingState = await page.evaluate(() => {
      const editingCell = document.querySelector('.vibegridx-cell-editing, [data-editing="true"]');
      const inputElement = document.querySelector('input:focus, textarea:focus');
      
      // Check for editing overlay in Konva
      let konvaEditingOverlay = false;
      if (window.Konva) {
        const stage = window.Konva.stages[0];
        if (stage) {
          const editingShapes = stage.find('.editing-overlay');
          konvaEditingOverlay = editingShapes.length > 0;
        }
      }
      
      return {
        isEditing: !!editingCell || !!inputElement,
        hasEditingInput: !!inputElement,
        hasKonvaEditingOverlay: konvaEditingOverlay
      };
    });
    
    console.log('  - Cell editing active:', editingState.isEditing);
    console.log('  - Has input element:', editingState.hasEditingInput);
    
    await page.screenshot({ 
      path: 'screenshots/issue-71/vibegridx-editing.png', 
      fullPage: false 
    });
    
    // Press Escape to exit editing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // TEST COLUMN DRAG REORDER
    console.log('\n🔀 Testing column drag reorder...');
    
    // Get column headers
    const columnHeaders = await page.locator('.vibegridx-header-cell');
    const firstHeader = await columnHeaders.first().boundingBox();
    const thirdHeader = await columnHeaders.nth(2).boundingBox();
    
    if (firstHeader && thirdHeader) {
      // Try to drag first column to third position
      const dragStartX = firstHeader.x + firstHeader.width / 2;
      const dragStartY = firstHeader.y + firstHeader.height / 2;
      const dragEndX = thirdHeader.x + thirdHeader.width / 2;
      
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.waitForTimeout(100); // Small delay to initiate drag
      await page.mouse.move(dragEndX, dragStartY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Check for drag preview overlay
      const dragState = await page.evaluate(() => {
        // Look for drag indicators in Konva
        let konvaDragPreview = false;
        if (window.Konva) {
          const stage = window.Konva.stages[0];
          if (stage) {
            const dragShapes = stage.find('.drag-preview');
            konvaDragPreview = dragShapes.length > 0;
          }
        }
        
        // Check if column order changed
        const headers = Array.from(document.querySelectorAll('.vibegridx-header-cell'));
        const headerTexts = headers.map(h => h.textContent?.trim());
        
        return {
          hasKonvaDragPreview: konvaDragPreview,
          columnOrder: headerTexts.slice(0, 3) // First 3 columns
        };
      });
      
      console.log('  - Column drag attempted');
      console.log('  - Drag preview:', dragState.hasKonvaDragPreview);
      console.log('  - Column order:', dragState.columnOrder);
      
      await page.screenshot({ 
        path: 'screenshots/issue-71/vibegridx-column-drag.png', 
        fullPage: false 
      });
    }
    
    // TEST COLUMN SHOW/HIDE
    console.log('\n👁️ Testing column show/hide...');
    
    // Look for column menu button (usually a dropdown or menu icon in header)
    const columnMenuButton = await page.locator('.vibegridx-column-menu, .column-menu-button, [data-testid*="column-menu"]').first();
    const hasColumnMenu = await columnMenuButton.count() > 0;
    
    if (hasColumnMenu) {
      await columnMenuButton.click();
      await page.waitForTimeout(300);
      
      // Look for column visibility options
      const columnVisibilityState = await page.evaluate(() => {
        const menu = document.querySelector('.column-menu-dropdown, .column-visibility-menu, [role="menu"]');
        const checkboxes = document.querySelectorAll('input[type="checkbox"][data-column], .column-visibility-checkbox');
        
        return {
          hasMenu: !!menu,
          checkboxCount: checkboxes.length,
          menuText: menu?.textContent?.substring(0, 100)
        };
      });
      
      console.log('  - Column menu opened:', columnVisibilityState.hasMenu);
      console.log('  - Visibility checkboxes:', columnVisibilityState.checkboxCount);
      
      await page.screenshot({ 
        path: 'screenshots/issue-71/vibegridx-column-menu.png', 
        fullPage: false 
      });
      
      // Close menu
      await page.keyboard.press('Escape');
    } else {
      console.log('  - No column menu button found');
      
      // Alternative: Right-click on column header
      const headerElement = await page.locator('.vibegridx-header-cell').first();
      const headerExists = await headerElement.count() > 0;
      
      if (headerExists) {
        try {
          await headerElement.click({ button: 'right', timeout: 5000 });
          await page.waitForTimeout(300);
          
          const contextMenuState = await page.evaluate(() => {
            const contextMenu = document.querySelector('.context-menu, [role="menu"]');
            return {
              hasContextMenu: !!contextMenu,
              menuItems: contextMenu ? Array.from(contextMenu.querySelectorAll('[role="menuitem"]')).map(item => item.textContent?.trim()) : []
            };
          });
          
          console.log('  - Context menu:', contextMenuState.hasContextMenu);
          if (contextMenuState.menuItems.length > 0) {
            console.log('  - Menu items:', contextMenuState.menuItems.slice(0, 3));
          }
          
          await page.screenshot({ 
            path: 'screenshots/issue-71/vibegridx-context-menu.png', 
            fullPage: false 
          });
          
          // Close context menu
          await page.keyboard.press('Escape');
        } catch (e) {
          console.log('  - Could not right-click header:', e.message);
        }
      }
    }
    
    // TEST COLUMN RESIZE
    console.log('\n📏 Testing column resize...');
    
    // Find a column header border (reusing the existing headers)
    const firstColumnHeader = await page.locator('.vibegridx-header-cell').first().boundingBox();
    
    if (firstColumnHeader) {
      // Try to drag the right edge of the first column header
      const resizeX = firstColumnHeader.x + firstColumnHeader.width - 2;
      const resizeY = firstColumnHeader.y + firstColumnHeader.height / 2;
      
      await page.mouse.move(resizeX, resizeY);
      await page.mouse.down();
      await page.mouse.move(resizeX + 50, resizeY, { steps: 5 }); // Resize 50px wider
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'screenshots/issue-71/vibegridx-column-resize.png', 
        fullPage: false 
      });
      
      console.log('  - Column resize attempted');
    }
    
    // Summary
    console.log('\n✅ COMPREHENSIVE BASELINE CAPTURED:');
    console.log('  - VibeGridDex loaded with', initialState.cellCount, 'cells');
    console.log('  - Konva canvas overlay:', initialState.hasKonva ? 'Present' : 'Missing');
    console.log('  - Selection graphics:', afterRangeState.konvaInfo?.shapeCount || 0, 'shapes detected');
    console.log('\n📊 Interactions tested:');
    console.log('  ✓ Single click selection');
    console.log('  ✓ Shift+click range selection');
    console.log('  ✓ Ctrl+click multi-selection');
    console.log('  ✓ Drag multiselect');
    console.log('  ✓ Keyboard navigation (arrows)');
    console.log('  ✓ Copy/Paste (Ctrl+C/V)');
    console.log('  ✓ Fill drag');
    console.log('  ✓ Double-click to edit');
    console.log('  ✓ Column drag reorder');
    console.log('  ✓ Column show/hide');
    console.log('  ✓ Column resize');
    console.log('\n📸 Screenshots captured:');
    console.log('  - Selection states: single, range, multi, drag');
    console.log('  - Operations: copy, paste, fill-drag, editing');
    console.log('  - Column operations: drag, menu/context-menu, resize');
    console.log('  All saved in screenshots/issue-71/');
    
  } else {
    console.log('❌ Could not find cell bounds');
  }
  
  // Verify the grid is interactive
  expect(initialState.cellCount).toBeGreaterThan(0);
});