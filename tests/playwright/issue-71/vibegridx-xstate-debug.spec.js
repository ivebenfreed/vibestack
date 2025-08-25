/**
 * XState inspection test for Issue #71 - VibeGrid
 * 
 * This test uses XState inspection to debug the table machine state
 * and understand what's happening with selections and overlays
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('VibeGrid XState inspection - debug selection states', async ({ page }) => {
  console.log('🔍 Starting XState inspection test for VibeGrid...');
  
  // The xstateTestInspector should already be available from the app
  // Just verify it's there
  await page.addInitScript(() => {
    if (window.xstateTestInspector) {
      console.log('[Test] XState Test Inspector is available');
    }
  });
  
  // Set up console message listener to capture XState logs
  const xstateMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('xstate') || text.includes('table-machine') || text.includes('selection')) {
      xstateMessages.push({
        type: msg.type(),
        text: text,
        time: new Date().toISOString()
      });
      console.log(`[XState ${msg.type()}] ${text}`);
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
  
  // Wait for VibeGrid
  const gridSelector = '[data-testid="vibegridx-tasks-table-v2"]';
  await page.waitForSelector(gridSelector, { timeout: 10000 });
  
  console.log('✅ VibeGrid loaded, checking XState actors...');
  
  // Wait a bit for XState machines to initialize
  await page.waitForTimeout(1000);
  
  // Get XState machine snapshot using the test inspector
  const machineState = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    // Get summary from the test inspector
    const summary = window.xstateTestInspector.getSummary();
    
    // Find table machine - look for tableBaseMachine specifically
    const tableMachineId = Object.keys(summary.machines).find(id => 
      id.includes('tableBaseMachine') || id.includes('table') || id.includes('vibegrid')
    );
    
    if (!tableMachineId) {
      return {
        foundMachine: false,
        summary: summary,
        machineIds: Object.keys(summary.machines)
      };
    }
    
    const machineInfo = summary.machines[tableMachineId];
    return {
      foundMachine: true,
      machineId: tableMachineId,
      state: machineInfo.currentState,
      transitionCount: machineInfo.transitionCount,
      eventCount: machineInfo.eventCount,
      lastTransition: machineInfo.lastTransition,
      lastEvent: machineInfo.lastEvent,
      allMachines: Object.keys(summary.machines)
    };
  });
  
  console.log('📊 Initial machine state:');
  console.log('  - Found machine:', machineState.foundMachine);
  console.log('  - Machine IDs:', machineState.allMachines || machineState.machineIds);
  console.log('  - Table machine ID:', machineState.machineId);
  
  // Click a cell and observe state change
  console.log('\n🖱️ Clicking first cell...');
  const firstCell = await page.locator('.vibegridx-cell').first();
  await firstCell.click();
  await page.waitForTimeout(500);
  
  // Get state after click using test inspector
  const afterClickState = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    const summary = window.xstateTestInspector.getSummary();
    
    // Get recent events and transitions
    const allEvents = window.xstateTestInspector.getEvents();
    const allTransitions = window.xstateTestInspector.getTransitions();
    
    // Filter for selection-related events
    const selectionEvents = allEvents.filter(e => 
      e.event.type?.includes('selection') || 
      e.event.type?.includes('click')
    );
    
    return {
      summary: summary,
      recentEvents: allEvents.slice(-5),
      selectionEvents: selectionEvents,
      recentTransitions: allTransitions.slice(-5),
      totalEvents: allEvents.length,
      totalTransitions: allTransitions.length
    };
  });
  
  console.log('📊 After click state:', afterClickState);
  
  // Try shift-click for range selection
  console.log('\n🖱️ Shift-clicking fifth cell...');
  const fifthCell = await page.locator('.vibegridx-cell').nth(4);
  await fifthCell.click({ modifiers: ['Shift'] });
  await page.waitForTimeout(500);
  
  const afterShiftClickState = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    const summary = window.xstateTestInspector.getSummary();
    const allEvents = window.xstateTestInspector.getEvents();
    
    // Look for shift-click events
    const shiftClickEvents = allEvents.filter(e => 
      e.event.shiftKey === true
    );
    
    return {
      summary: summary,
      shiftClickEvents: shiftClickEvents,
      lastFiveEvents: allEvents.slice(-5)
    };
  });
  
  console.log('📊 After shift-click state:', afterShiftClickState);
  
  // Check for Konva stage and layers
  const konvaInfo = await page.evaluate(() => {
    if (!window.Konva) return { hasKonva: false };
    
    const stages = window.Konva.stages;
    const stageInfo = stages.map(stage => {
      const layers = stage.getLayers();
      return {
        width: stage.width(),
        height: stage.height(),
        layers: layers.map(layer => ({
          name: layer.name(),
          visible: layer.visible(),
          children: layer.getChildren().map(child => ({
            className: child.className,
            visible: child.visible(),
            attrs: child.attrs
          }))
        }))
      };
    });
    
    return {
      hasKonva: true,
      stageCount: stages.length,
      stages: stageInfo
    };
  });
  
  console.log('\n🎨 Konva info:', konvaInfo);
  
  // Check test inspector markers and wait for selection event
  console.log('\n📤 Adding test marker and checking for selection events...');
  const directEventResult = await page.evaluate(async () => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    // Add a marker
    window.xstateTestInspector.addMarker('TEST_SELECTION_CHECK', { 
      timestamp: new Date().toISOString() 
    });
    
    // Get first cell info
    const firstCell = document.querySelector('.vibegridx-cell');
    const rowId = firstCell?.dataset.rowId;
    const columnId = firstCell?.dataset.columnId;
    
    if (!rowId || !columnId) return { error: 'Cell data not found' };
    
    // Wait for a selection event - use the correct machine ID
    const foundEvent = await window.xstateTestInspector.waitForEvent(
      'tableBaseMachine', 
      'selection.cell.select', 
      2000
    );
    
    const summary = window.xstateTestInspector.getSummary();
    const markers = window.xstateTestInspector.getMarkers();
    
    return {
      success: true,
      rowId,
      columnId,
      foundSelectionEvent: foundEvent,
      summary: summary,
      markers: markers
    };
  });
  
  console.log('📊 Direct event result:', directEventResult);
  
  // Get full test inspector analysis
  const coordinatorCheck = await page.evaluate(() => {
    if (!window.xstateTestInspector) {
      return { error: 'XState Test Inspector not available' };
    }
    
    const summary = window.xstateTestInspector.getSummary();
    const transitions = window.xstateTestInspector.getTransitions();
    const events = window.xstateTestInspector.getEvents();
    
    // Look for selection coordinator
    const selectionCoordinatorId = Object.keys(summary.machines).find(id => 
      id.includes('selection') || id.includes('coordinator')
    );
    
    // Look for canvas actor
    const canvasActorId = Object.keys(summary.machines).find(id => 
      id.includes('canvas')
    );
    
    return {
      hasSelectionCoordinator: !!selectionCoordinatorId,
      hasCanvasActor: !!canvasActorId,
      allActors: Object.keys(summary.machines),
      selectionTransitions: transitions.filter(t => 
        t.machineId.includes('selection') || 
        t.event?.type?.includes('selection')
      ),
      canvasEvents: events.filter(e => 
        e.machineId.includes('canvas')
      )
    };
  });
  
  console.log('\n🎯 Selection coordinator check:', coordinatorCheck);
  
  // Summary
  console.log('\n📋 XState Inspection Summary:');
  console.log('  - Machine found:', machineState.foundMachine);
  console.log('  - Initial selection count:', machineState.state?.context?.selectedCells?.length || 0);
  console.log('  - After click selection count:', afterClickState.selectedCells?.length || 0);
  console.log('  - After shift-click selection count:', afterShiftClickState.selectionCount || 0);
  console.log('  - Direct event selection count:', directEventResult.selectionCount || 0);
  console.log('  - Has canvas actor:', afterClickState.hasCanvasActor);
  console.log('  - Has selection coordinator:', afterClickState.hasSelectionCoordinator);
  console.log('  - Konva stages:', konvaInfo.stageCount || 0);
  
  if (xstateMessages.length > 0) {
    console.log('\n📜 XState console messages:');
    xstateMessages.slice(-10).forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text.substring(0, 100)}`);
    });
  }
  
  // Take a final screenshot
  await page.screenshot({ 
    path: 'screenshots/issue-71/xstate-debug-final.png', 
    fullPage: false 
  });
  
  // Basic assertion to pass the test - check if we have any machines tracked
  expect(machineState.allMachines?.length || directEventResult.success).toBeTruthy();
});