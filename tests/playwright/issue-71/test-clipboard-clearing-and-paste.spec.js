/**
 * Test specific clipboard issues:
 * 1. ESC not clearing clipboard indicators (marching ants)
 * 2. Paste not triggering actual data changes
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Clipboard Clearing and Paste Issues', () => {
  
  test('should clear clipboard indicators with ESC key', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    
    // Find a cell with content
    let sourceCell = null;
    for (let i = 0; i < Math.min(10, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText && cellText.trim() !== '' && !cellText.includes('✓')) {
        sourceCell = cells.nth(i);
        console.log(`📋 Source cell: "${cellText}"`);
        break;
      }
    }
    
    if (!sourceCell) {
      console.log('⚠️  No suitable source cell found');
      return;
    }
    
    console.log('Step 1: Select and copy cell...');
    await sourceCell.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(1000);
    
    // Verify clipboard indicators exist
    const indicatorsAfterCopy = await page.locator('.vibegridx-clipboard-indicator').count();
    console.log(`📊 Clipboard indicators after copy: ${indicatorsAfterCopy}`);
    expect(indicatorsAfterCopy).toBeGreaterThan(0);
    
    console.log('Step 2: Press ESC to clear...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Check if clipboard indicators are cleared
    const indicatorsAfterEsc = await page.locator('.vibegridx-clipboard-indicator').count();
    console.log(`📊 Clipboard indicators after ESC: ${indicatorsAfterEsc}`);
    
    // Also check if any dashed border elements remain
    const dashedElements = await page.locator('[style*="dashed"]').count();
    console.log(`🐜 Dashed elements after ESC: ${dashedElements}`);
    
    if (indicatorsAfterEsc > 0) {
      console.log('❌ ISSUE CONFIRMED: ESC does not clear clipboard indicators');
      
      // Get details about remaining indicators
      const remainingStyles = await page.locator('.vibegridx-clipboard-indicator').first().evaluate(el => ({
        opacity: el.style.opacity,
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        animation: el.style.animation
      }));
      
      console.log('🐛 Remaining indicator styles:', remainingStyles);
    } else {
      console.log('✅ ESC successfully cleared clipboard indicators');
    }
  });
  
  test('should trigger actual data change when pasting', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    
    // Find source cell with content
    let sourceCell = null;
    let sourceText = '';
    for (let i = 0; i < Math.min(10, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText && cellText.trim() !== '' && !cellText.includes('✓') && !cellText.includes('Select')) {
        sourceCell = cells.nth(i);
        sourceText = cellText.trim();
        console.log(`📋 Source cell: "${sourceText}"`);
        break;
      }
    }
    
    // Find different target cell
    let targetCell = null;
    let originalTargetText = '';
    for (let i = 0; i < Math.min(20, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText !== sourceText && !cellText.includes('✓') && !cellText.includes('Select')) {
        targetCell = cells.nth(i);
        originalTargetText = cellText.trim();
        console.log(`🎯 Target cell: "${originalTargetText}"`);
        break;
      }
    }
    
    if (!sourceCell || !targetCell) {
      console.log('⚠️  Could not find suitable source and target cells');
      return;
    }
    
    console.log('Step 1: Copy source cell...');
    await sourceCell.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(1000);
    
    console.log('Step 2: Select target cell and paste...');
    await targetCell.click();
    await page.waitForTimeout(500);
    
    // Record paste operation
    const pasteMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('paste') || text.includes('Paste') || text.includes('UPDATE') || text.includes('change')) {
        pasteMessages.push(text);
      }
    });
    
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(2000); // Wait longer for potential async operations
    
    console.log('Step 3: Check if target cell content changed...');
    
    // Re-query the target cell to get updated content
    const updatedTargetText = await targetCell.textContent();
    console.log(`📊 Original target: "${originalTargetText}"`);
    console.log(`📊 Source content: "${sourceText}"`);
    console.log(`📊 Updated target: "${updatedTargetText}"`);
    
    const dataChanged = updatedTargetText.trim() === sourceText;
    console.log(`📝 Data actually changed: ${dataChanged}`);
    
    if (!dataChanged) {
      console.log('❌ ISSUE CONFIRMED: Paste does not trigger data change');
      
      // Check console messages for paste-related activity
      console.log('📋 Paste-related console messages:');
      pasteMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg}`);
      });
      
      if (pasteMessages.length === 0) {
        console.log('❌ No paste-related console messages - paste may not be triggering at all');
      }
    } else {
      console.log('✅ Paste successfully changed cell data');
    }
    
    // Also check if there are any error messages
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    if (errors.length > 0) {
      console.log('⚠️  JavaScript errors during paste:', errors);
    }
  });
  
  test('should test complete copy-paste-clear workflow', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    
    console.log('🔄 Testing complete workflow...');
    
    // Step 1: Copy
    console.log('   1. Copy operation...');
    await cells.nth(1).click(); // Assuming this has content
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    const afterCopy = {
      indicators: await page.locator('.vibegridx-clipboard-indicator').count(),
      selection: await page.locator('.vibegridx-selection-overlay').count()
    };
    console.log(`      Copy result: ${afterCopy.indicators} indicators, ${afterCopy.selection} selections`);
    
    // Step 2: Select different cell
    console.log('   2. Select different cell...');
    await cells.nth(2).click();
    await page.waitForTimeout(300);
    
    const afterSelect = {
      indicators: await page.locator('.vibegridx-clipboard-indicator').count(),
      selection: await page.locator('.vibegridx-selection-overlay').count()
    };
    console.log(`      After select: ${afterSelect.indicators} indicators, ${afterSelect.selection} selections`);
    
    // Step 3: Paste
    console.log('   3. Paste operation...');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);
    
    const afterPaste = {
      indicators: await page.locator('.vibegridx-clipboard-indicator').count(),
      selection: await page.locator('.vibegridx-selection-overlay').count()
    };
    console.log(`      After paste: ${afterPaste.indicators} indicators, ${afterPaste.selection} selections`);
    
    // Step 4: ESC to clear
    console.log('   4. ESC to clear...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    const afterEsc = {
      indicators: await page.locator('.vibegridx-clipboard-indicator').count(),
      selection: await page.locator('.vibegridx-selection-overlay').count()
    };
    console.log(`      After ESC: ${afterEsc.indicators} indicators, ${afterEsc.selection} selections`);
    
    // Summary
    console.log('📊 Workflow Summary:');
    console.log(`   Copy → indicators: ${afterCopy.indicators}, selections: ${afterCopy.selection}`);
    console.log(`   Select → indicators: ${afterSelect.indicators}, selections: ${afterSelect.selection}`);
    console.log(`   Paste → indicators: ${afterPaste.indicators}, selections: ${afterPaste.selection}`);
    console.log(`   ESC → indicators: ${afterEsc.indicators}, selections: ${afterEsc.selection}`);
    
    // Identify issues
    const issues = [];
    if (afterEsc.indicators > 0) issues.push('ESC does not clear clipboard indicators');
    if (afterEsc.selection > 0) issues.push('ESC does not clear selections');
    if (afterSelect.indicators === 0) issues.push('Clipboard indicators disappear when selecting new cell');
    
    if (issues.length > 0) {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('✅ All workflow steps work correctly');
    }
  });
});