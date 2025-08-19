/**
 * Debug WebSocket Connection Lifecycle
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('debug WebSocket connection lifecycle and disconnect causes', async ({ page }) => {
  console.log('🔌 Debugging WebSocket connection lifecycle...');
  
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
  
  // Listen for all WebSocket events from the browser console
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('[SyncMachine') || text.includes('CONNECT') || text.includes('WS_')) {
      consoleMessages.push(`${new Date().toISOString()}: ${text}`);
    }
  });
  
  // Monitor network WebSocket connections
  const wsConnections = [];
  page.on('websocket', ws => {
    console.log('🔌 WebSocket connection detected:', ws.url());
    wsConnections.push({
      url: ws.url(),
      connected: new Date().toISOString()
    });
    
    ws.on('framereceived', event => {
      console.log('📥 WebSocket frame received:', event.payload);
    });
    
    ws.on('framesent', event => {
      console.log('📤 WebSocket frame sent:', event.payload);
    });
    
    ws.on('close', () => {
      console.log('❌ WebSocket connection closed:', ws.url());
      const connection = wsConnections.find(c => c.url === ws.url());
      if (connection) {
        connection.closed = new Date().toISOString();
      }
    });
  });
  
  console.log('⏳ Waiting for app and sync initialization...');
  await page.waitForTimeout(5000);
  
  // Check sync machine state
  const initialState = await page.evaluate(() => {
    if (window.syncMachineActor) {
      const snapshot = window.syncMachineActor.getSnapshot();
      return {
        state: snapshot.value,
        context: {
          clientId: snapshot.context?.clientId,
          organizationId: snapshot.context?.organizationId,
          isConnected: snapshot.context?.isConnected,
          error: snapshot.context?.error
        }
      };
    }
    return null;
  });
  
  console.log('🎯 Initial Sync Machine State:', initialState);
  
  // Force a connection attempt
  console.log('🔄 Forcing sync machine connection...');
  await page.evaluate(() => {
    if (window.syncMachineActor) {
      window.syncMachineActor.send({ type: 'CONNECT' });
    }
  });
  
  // Wait for connection attempt
  await page.waitForTimeout(5000);
  
  // Check state after connection attempt
  const postConnectState = await page.evaluate(() => {
    if (window.syncMachineActor) {
      const snapshot = window.syncMachineActor.getSnapshot();
      return {
        state: snapshot.value,
        context: {
          clientId: snapshot.context?.clientId,
          organizationId: snapshot.context?.organizationId,
          isConnected: snapshot.context?.isConnected,
          error: snapshot.context?.error,
          reconnectAttempts: snapshot.context?.reconnectAttempts
        }
      };
    }
    return null;
  });
  
  console.log('🎯 Post-Connect Sync Machine State:', postConnectState);
  
  // Wait longer to see if connection stays stable
  console.log('⏳ Waiting 10 seconds to monitor connection stability...');
  await page.waitForTimeout(10000);
  
  // Final state check
  const finalState = await page.evaluate(() => {
    if (window.syncMachineActor) {
      const snapshot = window.syncMachineActor.getSnapshot();
      return {
        state: snapshot.value,
        context: {
          clientId: snapshot.context?.clientId,
          organizationId: snapshot.context?.organizationId,
          isConnected: snapshot.context?.isConnected,
          error: snapshot.context?.error,
          reconnectAttempts: snapshot.context?.reconnectAttempts
        }
      };
    }
    return null;
  });
  
  console.log('🎯 Final Sync Machine State:', finalState);
  
  // Report WebSocket connections
  console.log('🔌 WebSocket Connections Summary:');
  wsConnections.forEach((conn, i) => {
    console.log(`   Connection ${i + 1}:`);
    console.log(`      URL: ${conn.url}`);
    console.log(`      Connected: ${conn.connected}`);
    console.log(`      Closed: ${conn.closed || 'Still open'}`);
  });
  
  // Report relevant console messages
  console.log('📝 Relevant Console Messages:');
  consoleMessages.slice(-20).forEach(msg => {
    console.log(`   ${msg}`);
  });
  
  // Get sync events if available
  const syncEvents = await page.evaluate(() => {
    if (window.testSyncHelpers && window.testSyncHelpers.getSyncEvents) {
      const events = window.testSyncHelpers.getSyncEvents() || [];
      return events.map(e => ({
        type: e.type,
        timestamp: e.timestamp || Date.now(),
        details: e.message?.type || e.reason || JSON.stringify(e).substring(0, 100)
      }));
    }
    return [];
  });
  
  console.log('🔄 Sync Events:');
  syncEvents.slice(-10).forEach(event => {
    console.log(`   ${event.type}: ${event.details}`);
  });
  
  console.log('🎯 WebSocket lifecycle debug completed');
});