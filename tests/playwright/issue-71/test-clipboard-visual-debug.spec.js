/**
 * Debug clipboard visual indicators specifically
 * 
 * This test focuses on debugging why clipboard indicators may not be showing properly
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Clipboard Visual Debug', () => {
  
  test('should debug clipboard state step by step', async ({ page }) => {
    // Capture all clipboard-related console messages
    const clipboardMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('clipboard') || text.includes('copy') || text.includes('cut') || text.includes('Clipboard')) {
        clipboardMessages.push(`${msg.type().toUpperCase()}: ${text}`);
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
    const cellCount = await cells.count();
    
    console.log(`📊 Found ${cellCount} cells`);
    
    if (cellCount === 0) {
      console.log('⚠️  No cells found');
      return;
    }
    
    // Step 1: Click a data cell (not selection column)
    console.log('🎯 Step 1: Clicking on a data cell...');
    
    // Try to find a cell that's not the selection column
    let targetCell = null;
    for (let i = 0; i < Math.min(5, cellCount); i++) {
      const cellContent = await cells.nth(i).textContent();
      const cellClass = await cells.nth(i).getAttribute('class');
      console.log(`   Cell ${i}: "${cellContent}" (class: ${cellClass})`);
      
      // Skip selection column cells and empty cells
      if (cellContent && cellContent.trim() !== '' && !cellContent.includes('✓')) {
        targetCell = cells.nth(i);
        console.log(`   → Selected cell ${i} as target`);
        break;
      }
    }
    
    if (!targetCell) {
      console.log('⚠️  No suitable data cell found, using first cell');
      targetCell = cells.first();
    }
    
    await targetCell.click();
    await page.waitForTimeout(500);
    
    // Step 2: Check selection state
    console.log('📊 Step 2: Checking selection state...');
    const selectionOverlays = await page.locator('.vibegridx-selection-overlay').count();
    console.log(`   Selection overlays: ${selectionOverlays}`);
    
    // Step 3: Copy operation
    console.log('📋 Step 3: Performing copy...');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(1000);
    
    // Step 4: Check all clipboard-related elements
    console.log('🔍 Step 4: Searching for clipboard elements...');
    
    const clipboardSelectors = [
      '.vibegridx-clipboard-container',
      '.vibegridx-clipboard-indicator', 
      '[class*="clipboard"]',
      '[class*="copy"]',
      '[class*="cut"]',
      '[style*="dashed"]',
      '[style*="pulse"]'
    ];
    
    for (const selector of clipboardSelectors) {
      const count = await page.locator(selector).count();
      console.log(`   ${selector}: ${count} elements`);
      
      if (count > 0) {
        const element = page.locator(selector).first();
        const styles = await element.evaluate(el => ({
          display: getComputedStyle(el).display,
          visibility: getComputedStyle(el).visibility,
          opacity: getComputedStyle(el).opacity,
          border: el.style.border,
          animation: el.style.animation,
          className: el.className,
          textContent: el.textContent?.substring(0, 50)
        }));
        console.log(`     Styles:`, styles);
      }
    }
    
    // Step 5: Try to manually trigger clipboard indicator
    console.log('🛠️  Step 5: Manual clipboard debugging...');
    
    const manualClipboard = await page.evaluate(() => {
      // Look for canvas overlay instance
      const overlayContainer = document.querySelector('.vibegridx-overlay-container');
      if (overlayContainer) {
        console.log('Found overlay container', overlayContainer);
        
        // Try to find clipboard container
        const clipboardContainer = overlayContainer.querySelector('.vibegridx-clipboard-container');
        if (clipboardContainer) {
          console.log('Found clipboard container', clipboardContainer);
          
          // Check if we can manually create an indicator
          let indicator = clipboardContainer.querySelector('.vibegridx-clipboard-indicator');
          if (!indicator) {
            console.log('Creating manual clipboard indicator');
            indicator = document.createElement('div');
            indicator.className = 'vibegridx-clipboard-indicator manual-test';
            indicator.style.cssText = `
              position: absolute;
              left: 50px;
              top: 50px;
              width: 200px;
              height: 40px;
              border: 2px dashed #10b981;
              opacity: 1;
              pointer-events: none;
              z-index: 100;
            `;
            clipboardContainer.appendChild(indicator);
            console.log('Manual indicator created');
            return true;
          }
        }
      }
      return false;
    });
    
    console.log(`🛠️  Manual clipboard indicator created: ${manualClipboard}`);
    
    if (manualClipboard) {
      await page.waitForTimeout(1000);
      const manualIndicator = page.locator('.manual-test');
      const isVisible = await manualIndicator.isVisible();
      console.log(`   Manual indicator visible: ${isVisible}`);
    }
    
    // Step 6: Report all clipboard messages
    console.log('📝 Step 6: All clipboard-related console messages:');
    clipboardMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    
    console.log('✅ Clipboard debug test completed');
  });
  
  test('should test different cell types for copy', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    const cellCount = await cells.count();
    
    console.log('🧪 Testing different cell types...');
    
    for (let i = 0; i < Math.min(5, cellCount); i++) {
      const cell = cells.nth(i);
      const cellText = await cell.textContent();
      const cellClass = await cell.getAttribute('class');
      
      console.log(`\n📍 Testing cell ${i}: "${cellText}" (${cellClass})`);
      
      // Click and copy
      await cell.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Control+c');
      await page.waitForTimeout(500);
      
      // Check for clipboard elements
      const clipboardElements = await page.locator('[class*="clipboard"]').count();
      console.log(`   Clipboard elements after copy: ${clipboardElements}`);
      
      // Clear selection
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    
    console.log('✅ Different cell types test completed');
  });
});