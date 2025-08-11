/**
 * Debug test for DOM overlay selection
 * 
 * This test debugs why selections aren't rendering with DOM overlays
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('Debug DOM overlay selection - check event flow', async ({ page }) => {
  console.log('🔍 Debugging DOM overlay selection...');
  
  // Capture ALL console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('CanvasActor') || text.includes('CanvasOverlay') || 
        text.includes('Selection') || text.includes('UPDATE') ||
        text.includes('selection') || text.includes('click')) {
      console.log(`[Browser] ${text}`);
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
  
  // Check XState inspector
  const xstateInfo = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    const summary = window.xstateTestInspector.getSummary();
    return {
      machines: Object.keys(summary.machines),
      totalEvents: summary.totalEvents,
      totalTransitions: summary.totalTransitions
    };
  });
  
  console.log('📊 XState info:', xstateInfo);
  
  // Try to click a cell and watch for events
  console.log('\n🖱️ Clicking first data cell...');
  
  // Find first data cell (not header, not checkbox)
  const firstDataCell = await page.locator('.vibegridx-cell').nth(1);
  const cellInfo = await firstDataCell.evaluate(el => ({
    rowId: el.dataset.rowId,
    columnId: el.dataset.columnId,
    classList: Array.from(el.classList),
    textContent: el.textContent?.trim()
  }));
  
  console.log('📍 Cell info:', cellInfo);
  
  // Clear console logs before click
  consoleLogs.length = 0;
  
  // Click the cell
  await firstDataCell.click();
  await page.waitForTimeout(1000);
  
  // Check what events were fired
  const eventInfo = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    const events = window.xstateTestInspector.getEvents();
    const recentEvents = events.slice(-10);
    
    // Check for selection events
    const selectionEvents = events.filter(e => 
      e.event.type?.includes('selection') || 
      e.event.type?.includes('SELECT') ||
      e.event.type?.includes('click')
    );
    
    return {
      totalEvents: events.length,
      recentEvents: recentEvents.map(e => ({
        type: e.event.type,
        machineId: e.machineId
      })),
      selectionEvents: selectionEvents.map(e => ({
        type: e.event.type,
        machineId: e.machineId,
        data: e.event
      }))
    };
  });
  
  console.log('\n📊 Event info after click:');
  console.log('  - Total events:', eventInfo.totalEvents);
  console.log('  - Selection events:', eventInfo.selectionEvents.length);
  if (eventInfo.selectionEvents.length > 0) {
    console.log('  - Selection event types:', eventInfo.selectionEvents.map(e => e.type));
  }
  console.log('  - Recent events:', eventInfo.recentEvents);
  
  // Check if canvas actor received UPDATE_SELECTION
  const canvasLogs = consoleLogs.filter(log => 
    log.includes('CanvasActor') || 
    log.includes('CanvasOverlay') ||
    log.includes('UPDATE_SELECTION')
  );
  
  console.log('\n📜 Canvas-related logs:', canvasLogs.length);
  canvasLogs.forEach(log => console.log('  -', log));
  
  // Check DOM state
  const domState = await page.evaluate(() => {
    const overlayContainer = document.querySelector('.vibegridx-overlay-container');
    const selectionContainer = document.querySelector('.vibegridx-selection-container');
    const selectionOverlays = document.querySelectorAll('.vibegridx-selection-overlay');
    
    // Check if any cells are marked as selected
    const selectedCells = document.querySelectorAll('.vibegridx-cell-selected, [data-selected="true"]');
    
    return {
      hasOverlayContainer: !!overlayContainer,
      hasSelectionContainer: !!selectionContainer,
      selectionOverlayCount: selectionOverlays.length,
      selectedCellCount: selectedCells.length,
      overlayChildren: overlayContainer ? overlayContainer.children.length : 0
    };
  });
  
  console.log('\n📊 DOM state after click:', domState);
  
  // Try to manually trigger selection through XState
  console.log('\n🔧 Manually triggering selection through XState...');
  
  const manualTriggerResult = await page.evaluate((cellInfo) => {
    // Find the table machine
    const actors = window.__xstate_actors__ || [];
    const tableMachine = actors.find(a => a.id?.includes('table'));
    
    if (!tableMachine) {
      // Try through xstateTestInspector
      const inspector = window.xstateTestInspector;
      if (!inspector) return { error: 'No XState access' };
      
      // Try to find table machine through inspector
      const summary = inspector.getSummary();
      const tableMachineId = Object.keys(summary.machines).find(id => 
        id.includes('table') || id.includes('Table')
      );
      
      return { 
        error: 'Table machine not directly accessible',
        availableMachines: Object.keys(summary.machines)
      };
    }
    
    // Send selection event
    tableMachine.send({
      type: 'selection.cell.select',
      rowId: cellInfo.rowId,
      columnId: cellInfo.columnId,
      ctrlKey: false,
      shiftKey: false
    });
    
    return { success: true, sentTo: tableMachine.id };
  }, cellInfo);
  
  console.log('📊 Manual trigger result:', manualTriggerResult);
  
  await page.waitForTimeout(1000);
  
  // Final DOM check
  const finalDomState = await page.evaluate(() => {
    const selectionContainer = document.querySelector('.vibegridx-selection-container');
    const selectionOverlays = document.querySelectorAll('.vibegridx-selection-overlay');
    
    return {
      hasSelectionContainer: !!selectionContainer,
      selectionOverlayCount: selectionOverlays.length
    };
  });
  
  console.log('\n📊 Final DOM state:', finalDomState);
  
  // Summary
  console.log('\n🔍 Debug Summary:');
  console.log('  - XState machines found:', xstateInfo.machines?.length || 0);
  console.log('  - Selection events captured:', eventInfo.selectionEvents?.length || 0);
  console.log('  - Canvas logs found:', canvasLogs.length);
  console.log('  - Selection container created:', finalDomState.hasSelectionContainer);
  console.log('  - Selection overlays rendered:', finalDomState.selectionOverlayCount);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'screenshots/issue-71/dom-overlay-debug.png', 
    fullPage: false 
  });
});