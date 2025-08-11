/**
 * Debug paste operation in detail to understand why updates aren't created
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Paste Operation Debug', () => {
  
  test('should debug paste operation step by step', async ({ page }) => {
    const pasteMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('paste') || text.includes('Paste') || text.includes('clipboard') || text.includes('internal') || text.includes('target')) {
        pasteMessages.push(text);
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
    
    // Find a cell with rich content for better copy/paste test
    let sourceCell = null;
    let sourceText = '';
    for (let i = 0; i < Math.min(10, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (cellText && cellText.trim().length > 5 && !cellText.includes('✓') && !cellText.includes('Select')) {
        sourceCell = cells.nth(i);
        sourceText = cellText.trim();
        console.log(`📋 Selected rich source cell: "${sourceText}"`);
        break;
      }
    }
    
    // Find an editable target cell (avoid readonly columns)
    let targetCell = null;
    let targetText = '';
    for (let i = 0; i < Math.min(20, await cells.count()); i++) {
      const cellText = await cells.nth(i).textContent();
      if (i !== 0 && cellText !== sourceText && !cellText.includes('Select') && !cellText.includes('✓')) { // Skip selection column
        targetCell = cells.nth(i);
        targetText = cellText?.trim() || '';
        console.log(`🎯 Selected target cell: "${targetText}"`);
        break;
      }
    }
    
    if (!sourceCell || !targetCell) {
      console.log('⚠️  Could not find suitable source and target cells');
      return;
    }
    
    console.log('Step 1: Copy source cell');
    await sourceCell.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(1000);
    
    console.log('Step 2: Select target and attempt paste');
    await targetCell.click();
    await page.waitForTimeout(500);
    
    // Clear console messages to focus on paste operation
    pasteMessages.length = 0;
    
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(2000);
    
    console.log('📋 Paste operation messages:');
    pasteMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
    
    // Check if data actually changed
    const updatedText = await targetCell.textContent();
    console.log(`📊 Final result:`);
    console.log(`   Source: "${sourceText}"`);
    console.log(`   Target before: "${targetText}"`);
    console.log(`   Target after: "${updatedText?.trim()}"`);
    console.log(`   Data changed: ${updatedText?.trim() === sourceText}`);
    
    // Look for specific error patterns
    const hasInternalClipboard = pasteMessages.some(msg => msg.includes('internal clipboard') || msg.includes('internal paste'));
    const hasColumnTypeError = pasteMessages.some(msg => msg.includes('column types do not match'));
    const hasNoTargets = pasteMessages.some(msg => msg.includes('No valid paste targets'));
    const hasUpdateMechanism = pasteMessages.some(msg => msg.includes('onEntityUpdate') || msg.includes('onBatchEntityUpdate'));
    
    console.log(`🔍 Diagnostic results:`);
    console.log(`   Has internal clipboard: ${hasInternalClipboard}`);
    console.log(`   Has column type error: ${hasColumnTypeError}`);
    console.log(`   Has no targets error: ${hasNoTargets}`);
    console.log(`   Has update mechanism: ${hasUpdateMechanism}`);
    
    if (hasColumnTypeError) {
      console.log('❌ Issue: Column type mismatch preventing paste');
    } else if (hasNoTargets) {
      console.log('❌ Issue: No valid paste targets found (update mechanism missing?)');
    } else if (!hasInternalClipboard) {
      console.log('❌ Issue: Internal clipboard data not available');
    }
  });
  
  test('should test same-column paste to avoid type issues', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    
    console.log('🔄 Testing same-column paste (should avoid type conflicts)...');
    
    // Find two cells in the same column
    const cellCount = await cells.count();
    let sourceCell = null;
    let targetCell = null;
    
    // Try different rows but similar column positions
    for (let sourceRow = 1; sourceRow < Math.min(5, Math.floor(cellCount / 10)); sourceRow++) {
      for (let targetRow = sourceRow + 1; targetRow < Math.min(10, Math.floor(cellCount / 5)); targetRow++) {
        const sourceIndex = sourceRow * 10; // Rough column estimation
        const targetIndex = targetRow * 10; // Same column, different row
        
        if (sourceIndex < cellCount && targetIndex < cellCount) {
          const sourceText = await cells.nth(sourceIndex).textContent();
          const targetText = await cells.nth(targetIndex).textContent();
          
          if (sourceText && sourceText.trim() && sourceText !== targetText) {
            sourceCell = cells.nth(sourceIndex);
            targetCell = cells.nth(targetIndex);
            console.log(`   Source (row ${sourceRow}): "${sourceText}"`);
            console.log(`   Target (row ${targetRow}): "${targetText}"`);
            break;
          }
        }
      }
      if (sourceCell && targetCell) break;
    }
    
    if (!sourceCell || !targetCell) {
      console.log('⚠️  Could not find suitable same-column cells');
      return;
    }
    
    // Test same-column copy/paste
    await sourceCell.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    await targetCell.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1500);
    
    const finalText = await targetCell.textContent();
    const sourceText = await sourceCell.textContent();
    
    console.log(`📊 Same-column paste result:`);
    console.log(`   Source: "${sourceText}"`);
    console.log(`   Target after paste: "${finalText}"`);
    console.log(`   Success: ${finalText?.trim() === sourceText?.trim()}`);
  });
});