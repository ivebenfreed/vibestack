/**
 * Quick test for fill handle with viewport fix
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Fill Handle Quick Test', () => {
  
  test('should test fill handle with viewport fix', async ({ page }) => {
    const fillMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Fill') || text.includes('FILL') || 
          text.includes('viewport') || text.includes('Viewport') || 
          text.includes('drag') || text.includes('preview') || text.includes('complete')) {
        fillMessages.push(text);
      }
    });
    
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(3000); // Wait longer for initialization
    
    console.log('📊 Initialization messages:');
    fillMessages.forEach((msg, i) => {
      if (i < 10) { // Show first 10 messages
        console.log(`   ${i + 1}. ${msg}`);
      }
    });
    fillMessages.length = 0; // Clear for fill test
    
    // Select a cell
    const cells = page.locator('.vibegridx-cell');
    await cells.nth(1).click();
    await page.waitForTimeout(1000);
    
    // Test fill operation
    console.log('🖱️ Testing fill operation...');
    const fillHandle = page.locator('.vibegridx-fill-handle').first();
    
    if (await fillHandle.isVisible()) {
      const boundingBox = await fillHandle.boundingBox();
      if (boundingBox) {
        const x = boundingBox.x + boundingBox.width / 2;
        const y = boundingBox.y + boundingBox.height / 2;
        
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 120); // 3 rows down
        await page.waitForTimeout(1000);
        await page.mouse.up();
        await page.waitForTimeout(1000);
        
        console.log('📊 Fill operation messages:');
        fillMessages.forEach((msg, i) => {
          console.log(`   ${i + 1}. ${msg}`);
        });
        
        // Check results
        const previewCount = await page.locator('.vibegridx-fill-preview').count();
        const hasCompleteEvent = fillMessages.some(msg => 
          msg.includes('FILL_COMPLETE') || msg.includes('Fill complete') || msg.includes('onFillComplete')
        );
        const hasPreviewEvent = fillMessages.some(msg => 
          msg.includes('FILL_PREVIEW') || msg.includes('Fill preview') || msg.includes('onFillPreview')
        );
        const hasViewportMessage = fillMessages.some(msg => 
          msg.includes('viewport') && msg.includes('returning')
        );
        
        console.log('📊 Test Results:');
        console.log(`   Fill preview elements: ${previewCount}`);
        console.log(`   Has complete event: ${hasCompleteEvent}`);
        console.log(`   Has preview event: ${hasPreviewEvent}`);
        console.log(`   Has viewport available: ${!hasViewportMessage || !hasViewportMessage.includes('null')}`);
        
        if (previewCount > 0 || hasCompleteEvent) {
          console.log('✅ SUCCESS: Fill operation is working!');
        } else if (hasPreviewEvent) {
          console.log('🔄 PARTIAL: Preview events working, complete might need fix');
        } else {
          console.log('❌ Still not working - need more debugging');
        }
      }
    }
  });
});