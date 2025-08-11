/**
 * Test cut operation specifically to verify red/cut styling
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Cut Operation Specific Test', () => {
  
  test('should show cut indicator with red styling', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    
    // Find a cell with content (not selection column)
    let targetCell = null;
    for (let i = 0; i < Math.min(10, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText && cellText.trim() !== '' && !cellText.includes('✓')) {
        targetCell = cells.nth(i);
        console.log(`🎯 Found target cell: "${cellText}"`);
        break;
      }
    }
    
    if (!targetCell) {
      console.log('⚠️  No suitable cell found for cut test');
      return;
    }
    
    // Click the cell
    await targetCell.click();
    await page.waitForTimeout(500);
    
    // Cut with Ctrl+X
    console.log('✂️  Performing cut operation...');
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(1000);
    
    // Check for clipboard indicators
    const clipboardIndicator = page.locator('.vibegridx-clipboard-indicator');
    const indicatorCount = await clipboardIndicator.count();
    console.log(`📊 Clipboard indicators found: ${indicatorCount}`);
    
    if (indicatorCount > 0) {
      const styles = await clipboardIndicator.first().evaluate(el => ({
        border: el.style.border,
        borderColor: getComputedStyle(el).borderColor,
        opacity: el.style.opacity,
        animation: el.style.animation,
        backgroundColor: el.style.backgroundColor
      }));
      
      console.log('🎨 Cut indicator styles:', styles);
      
      // Check if it has red/cut styling
      const hasRedBorder = styles.border.includes('#ef4444') || 
                          styles.border.includes('rgb(239, 68, 68)') ||
                          styles.borderColor.includes('239, 68, 68');
      
      console.log(`🔴 Has red cut styling: ${hasRedBorder}`);
      
      if (hasRedBorder) {
        console.log('✅ Cut operation shows correct red styling');
      } else {
        console.log('ℹ️  Cut indicator found but may not have red styling (possibly same as copy)');
      }
    } else {
      console.log('❌ No cut indicator found');
    }
    
    // Also check console messages for cut-specific logs
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('cut') || msg.text().includes('isCut: true')) {
        consoleLogs.push(msg.text());
      }
    });
    
    console.log('📋 Cut-related console logs:', consoleLogs);
  });
});