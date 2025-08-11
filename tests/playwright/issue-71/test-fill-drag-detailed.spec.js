/**
 * Detailed test for fill handle drag events - step by step
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Fill Handle Drag Detailed', () => {
  
  test('should test each step of fill handle drag operation', async ({ page }) => {
    const fillMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Fill') || text.includes('FILL') || text.includes('drag') || 
          text.includes('Drag') || text.includes('DRAG') || text.includes('preview') ||
          text.includes('Preview') || text.includes('PREVIEW') || text.includes('complete') ||
          text.includes('Complete') || text.includes('COMPLETE')) {
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
    
    console.log('🎯 Starting detailed fill drag test...');
    
    // Step 1: Select a cell
    const cells = page.locator('.vibegridx-cell');
    const firstContentCell = cells.nth(1); // Skip selection column
    
    await firstContentCell.click();
    await page.waitForTimeout(500);
    
    console.log('📍 Step 1: Cell selected');
    
    // Step 2: Find and hover fill handle
    const fillHandle = page.locator('.vibegridx-fill-handle').first();
    const isVisible = await fillHandle.isVisible();
    
    if (!isVisible) {
      console.log('❌ Fill handle not visible');
      return;
    }
    
    const boundingBox = await fillHandle.boundingBox();
    if (!boundingBox) {
      console.log('❌ Fill handle has no bounding box');
      return;
    }
    
    console.log(`📍 Step 2: Fill handle found at (${boundingBox.x}, ${boundingBox.y})`);
    
    // Clear messages to focus on drag operation
    fillMessages.length = 0;
    
    // Step 3: Start drag
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;
    
    console.log('📍 Step 3: Starting drag at', { startX, startY });
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    
    console.log('📋 Messages after mousedown:');
    fillMessages.forEach(msg => console.log(`   ${msg}`));
    fillMessages.length = 0;
    
    // Step 4: Drag incrementally to see preview updates
    const steps = [
      { y: startY + 40, name: '1 row down' },
      { y: startY + 80, name: '2 rows down' },
      { y: startY + 120, name: '3 rows down' }
    ];
    
    for (const step of steps) {
      console.log(`📍 Step 4: Dragging to ${step.name} (${startX}, ${step.y})`);
      await page.mouse.move(startX, step.y, { steps: 3 });
      await page.waitForTimeout(200);
      
      console.log(`📋 Messages after ${step.name}:`);
      fillMessages.forEach(msg => console.log(`   ${msg}`));
      fillMessages.length = 0;
      
      // Check for preview elements
      const previewElements = await page.locator('.vibegridx-fill-preview').count();
      console.log(`📊 Preview elements: ${previewElements}`);
    }
    
    // Step 5: Complete drag
    console.log('📍 Step 5: Completing drag (mouse up)');
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    console.log('📋 Messages after mouseup:');
    fillMessages.forEach(msg => console.log(`   ${msg}`));
    
    // Step 6: Check final state
    console.log('📍 Step 6: Checking final state...');
    
    // Check if any cells were actually updated
    const updatedCells = await page.$$eval('.vibegridx-cell', (cells) => {
      return cells.slice(1, 10).map((cell, i) => ({
        index: i,
        text: cell.textContent?.trim() || '',
        hasChanged: cell.style.backgroundColor !== '' || cell.classList.contains('updated')
      }));
    });
    
    console.log('📊 Cell states after fill:');
    updatedCells.forEach((cell, i) => {
      console.log(`   Cell ${i}: "${cell.text}" (changed: ${cell.hasChanged})`);
    });
    
    // Summary
    const totalMessages = fillMessages.length;
    console.log(`📊 Total fill messages: ${totalMessages}`);
  });
  
  test('should test slow drag for better event capture', async ({ page }) => {
    const allMessages = [];
    page.on('console', msg => {
      allMessages.push(msg.text());
    });
    
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    console.log('🐌 Testing slow drag for better event capture...');
    
    // Select cell
    const cells = page.locator('.vibegridx-cell');
    await cells.nth(1).click(); // Skip selection checkbox
    await page.waitForTimeout(500);
    
    // Find fill handle
    const fillHandle = page.locator('.vibegridx-fill-handle').first();
    const boundingBox = await fillHandle.boundingBox();
    
    if (!boundingBox) {
      console.log('❌ No fill handle bounding box');
      return;
    }
    
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;
    const endY = startY + 120;
    
    // Very slow drag with many steps
    console.log('🐌 Starting very slow drag...');
    allMessages.length = 0; // Clear previous messages
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    
    // Move very slowly with many intermediate steps
    const totalSteps = 20;
    for (let i = 1; i <= totalSteps; i++) {
      const currentY = startY + ((endY - startY) * i / totalSteps);
      await page.mouse.move(startX, currentY);
      await page.waitForTimeout(50); // Wait between each step
      
      if (i % 5 === 0) { // Log every 5th step
        console.log(`🐌 Step ${i}/${totalSteps} at y=${currentY}`);
      }
    }
    
    await page.mouse.up();
    await page.waitForTimeout(1000);
    
    // Filter and show relevant messages
    const relevantMessages = allMessages.filter(msg => 
      msg.includes('Fill') || msg.includes('FILL') || msg.includes('drag') || 
      msg.includes('Drag') || msg.includes('preview') || msg.includes('complete')
    );
    
    console.log(`📋 Relevant messages from slow drag (${relevantMessages.length} total):`);
    relevantMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg}`);
    });
  });
});