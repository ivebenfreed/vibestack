/**
 * Test for Issue #71 - DOM Overlay Implementation
 * 
 * This test verifies that the DOM overlays are rendering instead of Konva canvas
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('DOM overlay implementation - verify DOM elements instead of Konva', async ({ page }) => {
  console.log('🚀 Testing DOM overlay implementation...');
  
  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('Canvas') || msg.text().includes('Selection') || msg.text().includes('DOM')) {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    }
  });
  
  // Navigate to Tasks page
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => 
    document.body.getAttribute('data-playwright-ready') === 'true',
    { timeout: 15000 }
  );
  
  await page.click('[data-testid="nav-link-tasks"]');
  await page.waitForURL('**/tasks', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Wait for VibeGridDex
  const gridSelector = '[data-testid="vibegridx-tasks-table-v2"]';
  await page.waitForSelector(gridSelector, { timeout: 10000 });
  
  console.log('✅ VibeGridDex loaded');
  
  // Check for DOM overlay container
  const overlayInfo = await page.evaluate(() => {
    // Look for DOM overlay container
    const overlayContainer = document.querySelector('.vibegridx-overlay-container');
    const selectionContainer = document.querySelector('.vibegridx-selection-container');
    
    // Check for Konva canvas (should not exist)
    const konvaCanvas = document.querySelector('canvas');
    const konvaContent = document.querySelector('.konvajs-content');
    
    // Count cells
    const cells = document.querySelectorAll('.vibegridx-cell');
    
    return {
      hasDOMOverlayContainer: !!overlayContainer,
      hasSelectionContainer: !!selectionContainer,
      hasKonvaCanvas: !!konvaCanvas,
      hasKonvaContent: !!konvaContent,
      cellCount: cells.length,
      overlayContainerStyle: overlayContainer ? {
        position: overlayContainer.style.position,
        zIndex: overlayContainer.style.zIndex,
        pointerEvents: overlayContainer.style.pointerEvents
      } : null
    };
  });
  
  console.log('📊 Overlay info:', overlayInfo);
  
  // Click a cell to trigger selection (skip checkbox column)
  console.log('🖱️ Clicking first data cell to test selection...');
  // Use nth(2) to skip header row and checkbox column
  const firstDataCell = await page.locator('.vibegridx-cell[data-column-id="title"]').first();
  await firstDataCell.click();
  await page.waitForTimeout(500);
  
  // Check for DOM selection elements
  const selectionInfo = await page.evaluate(() => {
    // Look for DOM selection overlays
    const selectionOverlays = document.querySelectorAll('.vibegridx-selection-overlay');
    
    // Check if any have opacity > 0 (visible)
    const visibleOverlays = Array.from(selectionOverlays).filter(el => {
      const opacity = parseFloat(window.getComputedStyle(el).opacity);
      return opacity > 0;
    });
    
    // Get details of first selection overlay if exists
    const firstOverlay = selectionOverlays[0];
    const overlayDetails = firstOverlay ? {
      position: firstOverlay.style.position,
      opacity: window.getComputedStyle(firstOverlay).opacity,
      backgroundColor: window.getComputedStyle(firstOverlay).backgroundColor,
      border: window.getComputedStyle(firstOverlay).border,
      transform: window.getComputedStyle(firstOverlay).transform,
      transition: window.getComputedStyle(firstOverlay).transition,
      cellKey: firstOverlay.dataset.cellKey
    } : null;
    
    return {
      selectionOverlayCount: selectionOverlays.length,
      visibleOverlayCount: visibleOverlays.length,
      firstOverlayDetails: overlayDetails
    };
  });
  
  console.log('📊 Selection info:', selectionInfo);
  
  // Try shift-click for range selection
  console.log('🖱️ Shift-clicking for range selection...');
  // Click the 5th title cell (5 rows down) with shift held
  const fifthCell = await page.locator('.vibegridx-cell[data-column-id="title"]').nth(4);
  await fifthCell.click({ modifiers: ['Shift'] });
  await page.waitForTimeout(500);
  
  const rangeSelectionInfo = await page.evaluate(() => {
    const selectionOverlays = document.querySelectorAll('.vibegridx-selection-overlay');
    const visibleOverlays = Array.from(selectionOverlays).filter(el => {
      const opacity = parseFloat(window.getComputedStyle(el).opacity);
      return opacity > 0;
    });
    
    return {
      totalOverlays: selectionOverlays.length,
      visibleOverlays: visibleOverlays.length
    };
  });
  
  console.log('📊 Range selection info:', rangeSelectionInfo);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'screenshots/issue-71/dom-overlay-test.png', 
    fullPage: false 
  });
  
  // Summary
  console.log('\n🔍 DOM Overlay Test Results:');
  console.log('  - DOM overlay container:', overlayInfo.hasDOMOverlayContainer ? '✅ Present' : '❌ Missing');
  console.log('  - Selection container:', overlayInfo.hasSelectionContainer ? '✅ Present' : '❌ Missing');
  console.log('  - Konva canvas:', overlayInfo.hasKonvaCanvas ? '❌ Still present' : '✅ Removed');
  console.log('  - Konva content:', overlayInfo.hasKonvaContent ? '❌ Still present' : '✅ Removed');
  console.log('  - DOM selection overlays:', selectionInfo.selectionOverlayCount);
  console.log('  - Visible overlays after click:', selectionInfo.visibleOverlayCount);
  console.log('  - Visible overlays after range:', rangeSelectionInfo.visibleOverlays);
  
  // Assertions
  expect(overlayInfo.hasDOMOverlayContainer).toBeTruthy();
  expect(overlayInfo.hasKonvaCanvas).toBeFalsy();
  expect(overlayInfo.hasKonvaContent).toBeFalsy();
});