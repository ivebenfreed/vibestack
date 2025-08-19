/**
 * Test: Debug Sync Error in Detail
 * Scenario: Get detailed error information from sync machine
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug Sync Error', () => {
  test('should debug the sync machine error in detail', async ({ page }) => {
    console.log('🔍 Debugging sync machine error...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for sync to attempt and potentially fail
    await page.waitForTimeout(5000);
    
    // Get detailed sync machine state
    const syncDetails = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const summary = inspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      
      if (!syncMachine) return { hasInspector: true, hasSyncMachine: false };
      
      const events = inspector.getEvents('sync-machine-v3');
      const transitions = inspector.getTransitions('sync-machine-v3');
      const currentState = inspector.getCurrentState('sync-machine-v3');
      
      // Get error-related events
      const errorEvents = events.filter(e => 
        e.event.type.toLowerCase().includes('error') ||
        e.event.type.toLowerCase().includes('fail')
      );
      
      // Get connection-related events
      const connectionEvents = events.filter(e =>
        e.event.type.toLowerCase().includes('connect') ||
        e.event.type.toLowerCase().includes('socket') ||
        e.event.type.toLowerCase().includes('ws')
      );
      
      // Get all event types for analysis
      const allEventTypes = events.map(e => e.event.type);
      
      // Get context if available
      const context = syncMachine.context || {};
      
      return {
        hasInspector: true,
        hasSyncMachine: true,
        currentState,
        context,
        totalEvents: events.length,
        errorEvents: errorEvents.map(e => ({
          type: e.event.type,
          data: e.event.data,
          timestamp: e.timestamp
        })),
        connectionEvents: connectionEvents.map(e => ({
          type: e.event.type,
          data: e.event.data,
          timestamp: e.timestamp
        })),
        allEventTypes,
        transitions: transitions.map(t => ({
          from: t.from,
          to: t.to,
          event: t.event?.type
        }))
      };
    });
    
    console.log('\n🔧 Sync Machine Details:');
    console.log(`   Current State: ${JSON.stringify(syncDetails.currentState)}`);
    console.log(`   Total Events: ${syncDetails.totalEvents}`);
    console.log(`   Error Events: ${syncDetails.errorEvents?.length || 0}`);
    console.log(`   Connection Events: ${syncDetails.connectionEvents?.length || 0}`);
    
    if (syncDetails.context && Object.keys(syncDetails.context).length > 0) {
      console.log('\n📊 Sync Context:');
      Object.entries(syncDetails.context).forEach(([key, value]) => {
        if (key === 'error' && value) {
          console.log(`   ${key}: ${JSON.stringify(value)}`);
        } else if (typeof value === 'object') {
          console.log(`   ${key}: ${JSON.stringify(value)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
    
    if (syncDetails.errorEvents?.length > 0) {
      console.log('\n❌ Error Events:');
      syncDetails.errorEvents.forEach(event => {
        console.log(`   ${event.type}`);
        if (event.data) {
          console.log(`     Data: ${JSON.stringify(event.data)}`);
        }
      });
    }
    
    if (syncDetails.connectionEvents?.length > 0) {
      console.log('\n🔗 Connection Events:');
      syncDetails.connectionEvents.forEach(event => {
        console.log(`   ${event.type}`);
        if (event.data) {
          console.log(`     Data: ${JSON.stringify(event.data)}`);
        }
      });
    }
    
    console.log('\n📋 All Event Types:');
    const uniqueEvents = [...new Set(syncDetails.allEventTypes)];
    uniqueEvents.forEach(type => {
      const count = syncDetails.allEventTypes.filter(t => t === type).length;
      console.log(`   ${type} (${count}x)`);
    });
    
    if (syncDetails.transitions?.length > 0) {
      console.log('\n🔄 State Transitions:');
      syncDetails.transitions.forEach(transition => {
        console.log(`   ${transition.from} → ${transition.to} (${transition.event})`);
      });
    }
    
    // Check WebSocket connection attempts in browser
    const wsStatus = await page.evaluate(() => {
      // Try to get any WebSocket connection info
      return {
        hasWebSocketAttempts: !!window.wsConnectionAttempts && window.wsConnectionAttempts.length > 0,
        wsAttempts: window.wsConnectionAttempts || [],
        hasSocketManager: !!window.socketManager,
        syncConfig: window.syncConfig || null
      };
    });
    
    console.log('\n🌐 WebSocket Status:');
    console.log(`   Has WS Attempts: ${wsStatus.hasWebSocketAttempts ? '✅' : '❌'}`);
    console.log(`   Socket Manager: ${wsStatus.hasSocketManager ? '✅' : '❌'}`);
    console.log(`   Sync Config: ${wsStatus.syncConfig ? '✅' : '❌'}`);
    
    if (wsStatus.wsAttempts.length > 0) {
      console.log('\n📡 WebSocket Attempts:');
      wsStatus.wsAttempts.forEach((attempt, index) => {
        console.log(`   ${index + 1}. ${attempt.url}`);
      });
    }
    
    // Check app init machine state
    const appInitDetails = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return null;
      
      const summary = inspector.getSummary();
      const appInitMachine = summary.machines['app-init-machine'];
      
      if (!appInitMachine) return null;
      
      return {
        currentState: inspector.getCurrentState('app-init-machine'),
        context: appInitMachine.context
      };
    });
    
    if (appInitDetails) {
      console.log('\n🤖 App Init Machine:');
      console.log(`   State: ${appInitDetails.currentState}`);
      console.log(`   Database Ready: ${appInitDetails.context?.isDatabaseInitialized || false}`);
      console.log(`   Sync Ready: ${appInitDetails.context?.isSyncReady || false}`);
      console.log(`   LiveStore Ready: ${appInitDetails.context?.isLiveStoreReady || false}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-error-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/sync-error-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('Sync error debug completed');
    console.log('='.repeat(60));
  });
});