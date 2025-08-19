/**
 * Test: Debug App Init Flow and Sync Machine Communication
 * Scenario: Check the full app initialization flow and sync machine events
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug App Init Flow', () => {
  test('should debug the complete app initialization and sync flow', async ({ page }) => {
    console.log('🔍 Debug app init flow and sync machine communication...\n');
    console.log('='.repeat(60));
    
    const eventLog = [];
    
    // Monitor custom events and machine communications
    await page.addInitScript(() => {
      window.eventLog = [];
      window.machineEventLog = [];
      
      // Override dispatchEvent to log all custom events
      const originalDispatchEvent = window.dispatchEvent;
      window.dispatchEvent = function(event) {
        if (event instanceof CustomEvent) {
          console.log(`[EVENT] ${event.type}:`, event.detail);
          window.eventLog.push({
            type: event.type,
            detail: event.detail,
            timestamp: Date.now()
          });
        }
        return originalDispatchEvent.call(this, event);
      };
    });
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for initialization to potentially complete
    await page.waitForTimeout(5000);
    
    // Check app init machine state and events
    const appInitAnalysis = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const summary = inspector.getSummary();
      const appInitMachine = summary.machines['app-init-machine'];
      
      if (!appInitMachine) return { hasInspector: true, hasAppInitMachine: false };
      
      const events = inspector.getEvents('app-init-machine');
      const transitions = inspector.getTransitions('app-init-machine');
      const currentState = inspector.getCurrentState('app-init-machine');
      
      return {
        hasInspector: true,
        hasAppInitMachine: true,
        currentState,
        events: events.map(e => ({
          type: e.event.type,
          timestamp: e.timestamp
        })),
        transitions: transitions.map(t => ({
          from: t.from,
          to: t.to,
          event: t.event?.type
        })),
        context: appInitMachine.context
      };
    });
    
    console.log('\n🤖 App Init Machine Analysis:');
    console.log(`   Current State: ${appInitAnalysis.currentState || 'Unknown'}`);
    console.log(`   Events Count: ${appInitAnalysis.events?.length || 0}`);
    console.log(`   Transitions Count: ${appInitAnalysis.transitions?.length || 0}`);
    
    if (appInitAnalysis.events?.length > 0) {
      console.log('\n📝 App Init Events:');
      appInitAnalysis.events.forEach(event => {
        console.log(`   ${event.type}`);
      });
    }
    
    if (appInitAnalysis.transitions?.length > 0) {
      console.log('\n🔄 App Init Transitions:');
      appInitAnalysis.transitions.forEach(transition => {
        console.log(`   ${transition.from} → ${transition.to} (${transition.event})`);
      });
    }
    
    if (appInitAnalysis.context) {
      console.log('\n📊 App Init Context:');
      console.log(`   Database Initialized: ${appInitAnalysis.context.isDatabaseInitialized}`);
      console.log(`   Sync Ready: ${appInitAnalysis.context.isSyncReady}`);
      console.log(`   LiveStore Ready: ${appInitAnalysis.context.isLiveStoreReady}`);
      console.log(`   Online: ${appInitAnalysis.context.isOnline}`);
    }
    
    // Check sync machine state and events
    const syncAnalysis = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const summary = inspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      
      if (!syncMachine) return { hasInspector: true, hasSyncMachine: false };
      
      const events = inspector.getEvents('sync-machine-v3');
      const transitions = inspector.getTransitions('sync-machine-v3');
      const currentState = inspector.getCurrentState('sync-machine-v3');
      
      // Look for specific events
      const connectEvents = events.filter(e => 
        e.event.type.includes('CONNECT') || 
        e.event.type.includes('connect')
      );
      
      const liveEvents = events.filter(e => 
        e.event.type.includes('LIVE') || 
        e.event.type.includes('live')
      );
      
      return {
        hasInspector: true,
        hasSyncMachine: true,
        currentState,
        events: events.map(e => ({
          type: e.event.type,
          timestamp: e.timestamp
        })),
        transitions: transitions.map(t => ({
          from: t.from,
          to: t.to,
          event: t.event?.type
        })),
        connectEvents: connectEvents.length,
        liveEvents: liveEvents.length,
        context: syncMachine.context
      };
    });
    
    console.log('\n🔗 Sync Machine Analysis:');
    console.log(`   Current State: ${syncAnalysis.currentState || 'Unknown'}`);
    console.log(`   Events Count: ${syncAnalysis.events?.length || 0}`);
    console.log(`   Connect Events: ${syncAnalysis.connectEvents || 0}`);
    console.log(`   Live Events: ${syncAnalysis.liveEvents || 0}`);
    
    if (syncAnalysis.transitions?.length > 0) {
      console.log('\n🔄 Sync Transitions:');
      syncAnalysis.transitions.forEach(transition => {
        console.log(`   ${transition.from} → ${transition.to} (${transition.event})`);
      });
    }
    
    // Check machine communication events
    const machineEvents = await page.evaluate(() => {
      return window.eventLog?.filter(e => 
        e.type.includes('machine') ||
        e.type.includes('database') ||
        e.type.includes('sync') ||
        e.type.includes('livestore') ||
        e.type === 'START_INIT'
      ) || [];
    });
    
    console.log('\n📡 Machine Communication Events:');
    if (machineEvents.length > 0) {
      machineEvents.forEach(event => {
        console.log(`   ${event.type}${event.detail ? ': ' + JSON.stringify(event.detail) : ''}`);
      });
    } else {
      console.log('   ❌ No machine communication events found');
    }
    
    // Check if START_INIT was ever sent to app init machine
    const hasStartInit = appInitAnalysis.events?.some(e => e.type === 'START_INIT') || false;
    console.log(`\n🚀 START_INIT Event: ${hasStartInit ? '✅' : '❌'}`);
    
    // Check if sync machine is getting CONNECT events
    const syncConnectAttempts = syncAnalysis.events?.filter(e => 
      e.type === 'CONNECT' || e.type.includes('connect')
    ) || [];
    
    console.log(`\n🔌 Sync Connect Attempts: ${syncConnectAttempts.length}`);
    
    // Try to manually trigger initialization if it hasn't started
    if (!hasStartInit) {
      console.log('\n🔧 Manually triggering START_INIT...');
      
      const manualStartResult = await page.evaluate(() => {
        try {
          // Try to get the app init machine actor and send START_INIT
          const inspector = window.xstateTestInspector;
          if (inspector) {
            // Dispatch START_INIT event globally
            window.dispatchEvent(new CustomEvent('app:start-init'));
            
            // Also try to find and trigger the machine directly
            if (window.appInitMachineActor) {
              window.appInitMachineActor.send({ type: 'START_INIT' });
              return { manualTrigger: 'sent to actor' };
            }
          }
          return { manualTrigger: 'event dispatched' };
        } catch (e) {
          return { manualTrigger: 'failed', error: e.message };
        }
      });
      
      console.log(`   Manual trigger result: ${JSON.stringify(manualStartResult)}`);
      
      // Wait a bit and check if anything changed
      await page.waitForTimeout(2000);
      
      const postTriggerState = await page.evaluate(() => {
        const inspector = window.xstateTestInspector;
        if (!inspector) return null;
        
        return {
          appInitState: inspector.getCurrentState('app-init-machine'),
          syncState: inspector.getCurrentState('sync-machine-v3')
        };
      });
      
      if (postTriggerState) {
        console.log(`   Post-trigger states: App Init = ${postTriggerState.appInitState}, Sync = ${postTriggerState.syncState}`);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/app-init-flow-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/app-init-flow-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('App init flow debug completed');
    console.log('='.repeat(60));
  });
});