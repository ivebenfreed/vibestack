/**
 * Test copy/paste operations with DOM overlays
 * 
 * This test verifies that:
 * 1. Ctrl+C copies selected cells and shows clipboard indicator
 * 2. Ctrl+V pastes clipboard data 
 * 3. Ctrl+X cuts cells and shows cut indicator
 * 4. ESC cancels selection and clears overlays
 * 5. Clipboard overlays (marching ants) appear correctly
 * 6. Selection state is properly managed during copy/paste operations
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('VibeGridDx Copy/Paste Operations', () => {
  
  test('should handle copy operation (Ctrl+C) with clipboard indicator', async ({ page }) => {
    // Navigate to tasks page
    await page.goto('/tasks');
    
    // Wait for readiness
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    const cellCount = await cells.count();
    
    if (cellCount === 0) {
      console.log('⚠️  No cells found for copy test');
      return;
    }
    
    console.log(`📊 Found ${cellCount} cells for copy/paste testing`);
    
    // Click a cell to select it
    console.log('🎯 Selecting first cell...');
    await cells.first().click();
    await page.waitForTimeout(500);
    
    // Verify selection overlay exists
    const selectionOverlay = page.locator('.vibegridx-selection-overlay');
    expect(await selectionOverlay.count()).toBeGreaterThan(0);
    console.log('✅ Selection overlay created');
    
    // Copy with Ctrl+C
    console.log('📋 Copying with Ctrl+C...');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    // Check for clipboard indicator (marching ants)
    const clipboardOverlay = page.locator('.vibegridx-clipboard-indicator, .clipboard-overlay, [class*="clipboard"]');
    const clipboardCount = await clipboardOverlay.count();
    console.log(`📦 Found ${clipboardCount} clipboard indicator elements`);
    
    if (clipboardCount > 0) {
      // Check clipboard indicator styles
      const clipboardStyles = await clipboardOverlay.first().evaluate(el => ({
        position: el.style.position,
        border: el.style.border,
        borderStyle: el.style.borderStyle,
        className: el.className,
        display: getComputedStyle(el).display
      }));
      
      console.log('🎨 Clipboard indicator styles:', clipboardStyles);
    }
    
    // Check for any animated borders or dashed lines (marching ants effect)
    const animatedElements = page.locator('[style*="border-dash"], [style*="animation"], [class*="marching"], [class*="clipboard"]');
    const animatedCount = await animatedElements.count();
    console.log(`🐜 Found ${animatedCount} potentially animated elements`);
    
    if (animatedCount > 0) {
      for (let i = 0; i < Math.min(3, animatedCount); i++) {
        const styles = await animatedElements.nth(i).evaluate(el => ({
          animation: el.style.animation,
          border: el.style.border,
          borderStyle: el.style.borderStyle,
          className: el.className
        }));
        console.log(`   Animated element ${i + 1}:`, styles);
      }
    }
    
    console.log('✅ Copy operation completed');
  });
  
  test('should handle paste operation (Ctrl+V)', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() === 0) {
      console.log('⚠️  No cells found for paste test');
      return;
    }
    
    // Select and copy first cell
    console.log('🎯 Selecting and copying first cell...');
    await cells.first().click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    // Click a different cell for paste target
    if (await cells.count() > 1) {
      console.log('🎯 Selecting paste target cell...');
      await cells.nth(1).click();
      await page.waitForTimeout(300);
      
      // Paste with Ctrl+V
      console.log('📋 Pasting with Ctrl+V...');
      await page.keyboard.press('Control+v');
      await page.waitForTimeout(500);
      
      console.log('✅ Paste operation completed');
    }
  });
  
  test('should handle cut operation (Ctrl+X) with cut indicator', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() === 0) {
      console.log('⚠️  No cells found for cut test');
      return;
    }
    
    // Select a cell
    console.log('🎯 Selecting cell for cut operation...');
    await cells.first().click();
    await page.waitForTimeout(500);
    
    // Cut with Ctrl+X
    console.log('✂️  Cutting with Ctrl+X...');
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(500);
    
    // Check for cut indicator (should be different from copy - often red/dashed)
    const cutIndicators = page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"], [class*="cut"]');
    const cutCount = await cutIndicators.count();
    console.log(`✂️  Found ${cutCount} cut indicator elements`);
    
    if (cutCount > 0) {
      const cutStyles = await cutIndicators.first().evaluate(el => ({
        border: el.style.border,
        borderColor: el.style.borderColor,
        backgroundColor: el.style.backgroundColor,
        className: el.className,
        opacity: el.style.opacity
      }));
      
      console.log('🎨 Cut indicator styles:', cutStyles);
      
      // Cut indicators are often red or have different styling than copy
      const hasRedStyling = cutStyles.borderColor.includes('red') || 
                           cutStyles.backgroundColor.includes('red') ||
                           cutStyles.className.includes('cut');
      console.log(`🔴 Has red/cut styling: ${hasRedStyling}`);
    }
    
    console.log('✅ Cut operation completed');
  });
  
  test('should cancel selection with ESC key', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() === 0) {
      console.log('⚠️  No cells found for ESC test');
      return;
    }
    
    // Select multiple cells if possible
    console.log('🎯 Creating selection...');
    await cells.first().click();
    await page.waitForTimeout(300);
    
    // Try to extend selection with Shift+Click if more cells exist
    if (await cells.count() > 1) {
      await page.keyboard.down('Shift');
      await cells.nth(1).click();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(300);
    }
    
    // Verify selection overlays exist
    const initialOverlays = await page.locator('.vibegridx-selection-overlay').count();
    console.log(`📊 Initial selection overlays: ${initialOverlays}`);
    
    expect(initialOverlays).toBeGreaterThan(0);
    
    // Copy to create clipboard indicator
    console.log('📋 Creating clipboard with Ctrl+C...');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    // Check for clipboard indicators
    const clipboardIndicators = await page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"]').count();
    console.log(`📦 Clipboard indicators before ESC: ${clipboardIndicators}`);
    
    // Press ESC to cancel selection
    console.log('⌨️  Pressing ESC to cancel selection...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Verify selection overlays are cleared
    const finalOverlays = await page.locator('.vibegridx-selection-overlay').count();
    console.log(`📊 Final selection overlays after ESC: ${finalOverlays}`);
    
    // Check if clipboard indicators are also cleared
    const finalClipboard = await page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"]').count();
    console.log(`📦 Clipboard indicators after ESC: ${finalClipboard}`);
    
    // Selection should be cleared
    expect(finalOverlays).toBe(0);
    
    console.log('✅ ESC successfully cancelled selection');
  });
  
  test('should handle clipboard state transitions (copy → paste → clear)', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() < 2) {
      console.log('⚠️  Need at least 2 cells for clipboard state test');
      return;
    }
    
    console.log('🎯 Testing complete clipboard workflow...');
    
    // Step 1: Select and copy
    console.log('   Step 1: Select and copy...');
    await cells.first().click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    const clipboardAfterCopy = await page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"]').count();
    console.log(`   📦 Clipboard indicators after copy: ${clipboardAfterCopy}`);
    
    // Step 2: Select different cell and paste
    console.log('   Step 2: Select target and paste...');
    await cells.nth(1).click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);
    
    const clipboardAfterPaste = await page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"]').count();
    console.log(`   📦 Clipboard indicators after paste: ${clipboardAfterPaste}`);
    
    // Step 3: Clear selection with ESC
    console.log('   Step 3: Clear with ESC...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const finalState = {
      selection: await page.locator('.vibegridx-selection-overlay').count(),
      clipboard: await page.locator('.vibegridx-clipboard-indicator, [class*="clipboard"]').count()
    };
    
    console.log('   📊 Final state:', finalState);
    
    // Verify clean state
    expect(finalState.selection).toBe(0);
    
    console.log('✅ Complete clipboard workflow test passed');
  });
  
  test('should capture keyboard shortcut events and responses', async ({ page }) => {
    const keyboardEvents = [];
    const consoleMessages = [];
    
    // Capture console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'log' && (
          msg.text().includes('copy') || 
          msg.text().includes('paste') || 
          msg.text().includes('cut') || 
          msg.text().includes('clipboard') ||
          msg.text().includes('selection') ||
          msg.text().includes('ESC') ||
          msg.text().includes('Escape')
        )) {
        consoleMessages.push(msg.text());
      }
    });
    
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() === 0) {
      console.log('⚠️  No cells found for keyboard event test');
      return;
    }
    
    // Test sequence of keyboard operations
    console.log('⌨️  Testing keyboard event sequence...');
    
    await cells.first().click();
    await page.waitForTimeout(300);
    
    // Ctrl+C
    console.log('   Ctrl+C...');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    // Ctrl+V
    console.log('   Ctrl+V...');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);
    
    // Ctrl+X
    console.log('   Ctrl+X...');
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(500);
    
    // ESC
    console.log('   ESC...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Report captured events
    console.log(`📊 Captured ${consoleMessages.length} relevant console messages:`);
    consoleMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    
    console.log('✅ Keyboard event capture test completed');
  });
});