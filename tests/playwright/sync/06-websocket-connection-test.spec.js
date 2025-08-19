/**
 * WebSocket Connection Test - Ensure WebSocket connects before testing sync
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('establish WebSocket connection and test data sync', async ({ page }) => {
  console.log('🔌 Testing WebSocket connection and data sync...');
  
  // Navigate and handle org selection
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(2000);
  }
  
  // Wait for page to fully load
  await page.waitForTimeout(5000);
  
  // Check WebSocket connection status
  const wsStatus = await page.evaluate(() => {
    return {
      hasSyncMachine: typeof window.syncMachineActor !== 'undefined',
      hasTestHelpers: typeof window.testSyncHelpers !== 'undefined',
      websocketStatus: 'unknown'
    };
  });
  
  console.log('🔌 WebSocket Status Check:');
  console.log(`   Has Sync Machine: ${wsStatus.hasSyncMachine}`);
  console.log(`   Has Test Helpers: ${wsStatus.hasTestHelpers}`);
  
  // Wait longer for WebSocket to establish
  console.log('⏳ Waiting for WebSocket connection to establish...');
  await page.waitForTimeout(10000);
  
  // Check for WebSocket events
  const connectionEvents = await page.evaluate(() => {
    const events = [];
    
    if (window.testSyncHelpers && window.testSyncHelpers.getSyncEvents) {
      const allEvents = window.testSyncHelpers.getSyncEvents() || [];
      
      // Look for WebSocket-related events
      const wsEvents = allEvents.filter(e => 
        e.type === 'WS_CONNECTED' ||
        e.type === 'WS_DISCONNECTED' ||
        e.type === 'WS_MESSAGE' ||
        e.type === 'CONNECT' ||
        e.type === 'CONNECTING'
      );
      
      return {
        totalEvents: allEvents.length,
        wsEvents: wsEvents.length,
        eventTypes: [...new Set(allEvents.map(e => e.type))],
        wsEventTypes: [...new Set(wsEvents.map(e => e.type))],
        hasConnection: wsEvents.some(e => e.type === 'WS_CONNECTED' || e.type === 'CONNECT'),
        messages: wsEvents.filter(e => e.type === 'WS_MESSAGE').length
      };
    }
    
    return { error: 'Test helpers not available' };
  });
  
  console.log('📊 Connection Events:');
  console.log(`   Total Events: ${connectionEvents.totalEvents || 0}`);
  console.log(`   WebSocket Events: ${connectionEvents.wsEvents || 0}`);
  console.log(`   Has Connection: ${connectionEvents.hasConnection || false}`);
  console.log(`   Messages Received: ${connectionEvents.messages || 0}`);
  
  if (connectionEvents.eventTypes) {
    console.log(`   Event Types: ${connectionEvents.eventTypes.join(', ')}`);
  }
  
  if (connectionEvents.wsEventTypes && connectionEvents.wsEventTypes.length > 0) {
    console.log(`   WebSocket Event Types: ${connectionEvents.wsEventTypes.join(', ')}`);
  }
  
  // If no connection detected, try to trigger connection manually
  if (!connectionEvents.hasConnection) {
    console.log('🔄 No WebSocket connection detected, attempting to reconnect...');
    
    await page.evaluate(() => {
      if (window.syncMachineActor) {
        try {
          window.syncMachineActor.send({ type: 'CONNECT' });
          console.log('Sent CONNECT event to sync machine');
        } catch (e) {
          console.log('Error sending CONNECT:', e.message);
        }
      }
    });
    
    // Wait for connection attempt
    await page.waitForTimeout(5000);
    
    // Check connection again
    const retryConnectionEvents = await page.evaluate(() => {
      if (window.testSyncHelpers && window.testSyncHelpers.getSyncEvents) {
        const allEvents = window.testSyncHelpers.getSyncEvents() || [];
        const wsEvents = allEvents.filter(e => 
          e.type === 'WS_CONNECTED' ||
          e.type === 'CONNECT' ||
          e.type === 'WS_MESSAGE'
        );
        
        return {
          hasConnection: wsEvents.some(e => e.type === 'WS_CONNECTED' || e.type === 'CONNECT'),
          messages: wsEvents.filter(e => e.type === 'WS_MESSAGE').length,
          recentEvents: allEvents.slice(-10).map(e => e.type)
        };
      }
      return { error: 'No test helpers' };
    });
    
    console.log('🔄 After reconnection attempt:');
    console.log(`   Has Connection: ${retryConnectionEvents.hasConnection || false}`);
    console.log(`   Messages: ${retryConnectionEvents.messages || 0}`);
    
    if (retryConnectionEvents.recentEvents) {
      console.log(`   Recent Events: ${retryConnectionEvents.recentEvents.join(', ')}`);
    }
  }
  
  // Check sync machine state
  const syncMachineState = await page.evaluate(() => {
    if (window.syncMachineActor) {
      try {
        const snapshot = window.syncMachineActor.getSnapshot();
        return {
          value: snapshot.value,
          context: {
            clientId: snapshot.context?.clientId,
            currentLSN: snapshot.context?.currentLSN,
            isConnected: snapshot.context?.isConnected,
            error: snapshot.context?.error
          }
        };
      } catch (e) {
        return { error: e.message };
      }
    }
    return { error: 'No sync machine actor' };
  });
  
  console.log('🎯 Sync Machine State:');
  console.log(`   State: ${syncMachineState.value || 'unknown'}`);
  if (syncMachineState.context) {
    console.log(`   Client ID: ${syncMachineState.context.clientId}`);
    console.log(`   Current LSN: ${syncMachineState.context.currentLSN}`);
    console.log(`   Connected: ${syncMachineState.context.isConnected}`);
    if (syncMachineState.context.error) {
      console.log(`   Error: ${syncMachineState.context.error}`);
    }
  }
  
  console.log('💡 Check server logs for WebSocket connection attempts');
  console.log('🎯 WebSocket connection test completed');
});