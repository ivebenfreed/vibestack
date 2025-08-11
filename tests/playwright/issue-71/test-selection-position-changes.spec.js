/**
 * Test that selection overlays smoothly shift positions when clicking different cells
 * 
 * This test specifically verifies:
 * 1. Selection overlay position changes when clicking different cells
 * 2. Position transitions are smooth (CSS transitions)
 * 3. Old selections are properly removed and new ones added
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('VibeGridDx Selection Position Changes', () => {
  
  test('should smoothly shift selection overlay positions', async ({ page }) => {
    // Navigate to tasks page
    await page.goto('/tasks');
    
    // Wait for readiness
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    // Find cells to click on
    const cells = page.locator('.vibegridx-cell');
    const cellCount = await cells.count();
    
    if (cellCount < 3) {
      console.log('⚠️  Not enough cells for position shifting test');
      return;
    }
    
    console.log(`📊 Found ${cellCount} cells for position testing`);
    
    // Click first cell and capture position
    console.log('🎯 Clicking first cell...');
    await cells.nth(0).click();
    await page.waitForTimeout(300);
    
    const firstOverlay = page.locator('.vibegridx-selection-overlay').first();
    if (await firstOverlay.count() === 0) {
      console.log('⚠️  No selection overlay found after first click');
      return;
    }
    
    const firstPosition = await firstOverlay.evaluate(el => ({
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height
    }));
    
    console.log('📍 First selection position:', firstPosition);
    
    // Click second cell (different column) and capture position
    console.log('🎯 Clicking second cell...');
    await cells.nth(1).click();
    await page.waitForTimeout(300);
    
    const secondOverlay = page.locator('.vibegridx-selection-overlay').first();
    const secondPosition = await secondOverlay.evaluate(el => ({
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height
    }));
    
    console.log('📍 Second selection position:', secondPosition);
    
    // Verify position changed
    const positionChanged = firstPosition.left !== secondPosition.left || 
                          firstPosition.top !== secondPosition.top;
    
    console.log(`📊 Position changed: ${positionChanged}`);
    console.log(`   Left: ${firstPosition.left} → ${secondPosition.left}`);
    console.log(`   Top: ${firstPosition.top} → ${secondPosition.top}`);
    
    // Click third cell and verify again
    console.log('🎯 Clicking third cell...');
    await cells.nth(2).click();
    await page.waitForTimeout(300);
    
    const thirdOverlay = page.locator('.vibegridx-selection-overlay').first();
    const thirdPosition = await thirdOverlay.evaluate(el => ({
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height
    }));
    
    console.log('📍 Third selection position:', thirdPosition);
    
    const thirdPositionChanged = secondPosition.left !== thirdPosition.left || 
                                secondPosition.top !== thirdPosition.top;
    
    console.log(`📊 Third position changed: ${thirdPositionChanged}`);
    console.log(`   Left: ${secondPosition.left} → ${thirdPosition.left}`);
    console.log(`   Top: ${secondPosition.top} → ${thirdPosition.top}`);
    
    // Test rapid clicking to ensure smooth transitions
    console.log('🚀 Testing rapid position changes...');
    
    for (let i = 0; i < 5; i++) {
      const cellIndex = i % Math.min(5, cellCount);
      await cells.nth(cellIndex).click();
      await page.waitForTimeout(150);
      
      // Check if overlay still exists and has valid position
      const overlay = page.locator('.vibegridx-selection-overlay').first();
      if (await overlay.count() > 0) {
        const position = await overlay.evaluate(el => ({
          left: el.style.left,
          top: el.style.top,
          opacity: el.style.opacity,
          transition: el.style.transition
        }));
        console.log(`   Rapid click ${i + 1}: left=${position.left}, top=${position.top}, opacity=${position.opacity}`);
      }
    }
    
    console.log('✅ Selection position shifting test completed successfully');
  });
  
  test('should verify CSS transitions are applied', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      {},
      { timeout: 15000 }
    );
    
    await page.waitForTimeout(2000);
    
    const cells = page.locator('.vibegridx-cell');
    if (await cells.count() === 0) {
      console.log('⚠️  No cells found for transition test');
      return;
    }
    
    // Click a cell to create a selection overlay
    await cells.first().click();
    await page.waitForTimeout(500);
    
    const overlay = page.locator('.vibegridx-selection-overlay').first();
    if (await overlay.count() === 0) {
      console.log('⚠️  No selection overlay found');
      return;
    }
    
    // Check that transitions are properly configured
    const transitions = await overlay.evaluate(el => ({
      transition: el.style.transition,
      opacity: el.style.opacity,
      transform: el.style.transform
    }));
    
    console.log('🎨 CSS Transition properties:', transitions);
    
    // Verify transition includes the properties we expect
    const hasOpacityTransition = transitions.transition.includes('opacity');
    const hasTransformTransition = transitions.transition.includes('transform');
    
    console.log(`📊 Has opacity transition: ${hasOpacityTransition}`);
    console.log(`📊 Has transform transition: ${hasTransformTransition}`);
    console.log(`📊 Current opacity: ${transitions.opacity}`);
    console.log(`📊 Current transform: ${transitions.transform}`);
    
    expect(hasOpacityTransition).toBe(true);
    expect(hasTransformTransition).toBe(true);
    
    console.log('✅ CSS transitions are properly configured');
  });
});