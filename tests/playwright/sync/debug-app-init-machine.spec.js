/**
 * Test: Debug App Init Machine State
 * Scenario: Check if app init machine is triggering LiveStore initialization
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug App Init Machine', () => {
  test('should debug app init machine and LiveStore initialization events', async ({ page }) => {
    console.log('🔍 Debug app init machine and LiveStore events...\n');
    console.log('='.repeat(60));
    
    const eventLog = [];
    
    // Monitor custom events
    await page.addInitScript(() => {
      window.eventLog = [];
      
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
      
      // Listen for specific events
      const eventsToMonitor = [
        'livestore:init',
        'livestore:ready', 
        'livestore:error',
        'auth:ready',
        'app:init',
        'app:ready'
      ];
      
      eventsToMonitor.forEach(eventType => {
        window.addEventListener(eventType, (event) => {
          console.log(`[LISTENER] Caught ${eventType}:`, event.detail);
        });
      });
    });
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for any initialization events
    await page.waitForTimeout(5000);
    
    // Get event log
    const events = await page.evaluate(() => window.eventLog || []);
    
    console.log('\n📝 Custom Events Fired:');
    if (events.length > 0) {
      events.forEach(event => {
        console.log(`   ${event.type}${event.detail ? ': ' + JSON.stringify(event.detail) : ''}`);
      });
    } else {
      console.log('   ❌ No custom events detected');
    }
    
    // Check app init machine state
    const appInitState = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const summary = inspector.getSummary();
      const machines = summary.machines;
      
      // Look for app init machine
      const appInitMachine = machines['app-init-machine'] || 
                            machines['appInitMachine'] ||
                            Object.values(machines).find(m => 
                              m.id?.includes('app') && m.id?.includes('init')
                            );
      
      // Get all machine names for debugging
      const machineNames = Object.keys(machines);
      
      if (appInitMachine) {
        const events = inspector.getEvents(appInitMachine.id);
        const transitions = inspector.getTransitions(appInitMachine.id);
        const currentState = inspector.getCurrentState(appInitMachine.id);
        
        return {
          hasInspector: true,
          hasAppInitMachine: true,
          machineId: appInitMachine.id,
          currentState,
          eventCount: events.length,
          transitionCount: transitions.length,
          events: events.map(e => e.event.type),
          allMachines: machineNames
        };
      }
      
      return {
        hasInspector: true,
        hasAppInitMachine: false,
        allMachines: machineNames
      };
    });
    
    console.log('\n🤖 App Init Machine Status:');
    console.log(`   XState Inspector: ${appInitState.hasInspector ? '✅' : '❌'}`);
    console.log(`   App Init Machine: ${appInitState.hasAppInitMachine ? '✅' : '❌'}`);
    
    if (appInitState.hasAppInitMachine) {
      console.log(`   Machine ID: ${appInitState.machineId}`);
      console.log(`   Current State: ${appInitState.currentState}`);
      console.log(`   Events: ${appInitState.eventCount}`);
      console.log(`   Transitions: ${appInitState.transitionCount}`);
      
      if (appInitState.events.length > 0) {
        console.log('   Event Types:');
        [...new Set(appInitState.events)].forEach(type => {
          console.log(`     - ${type}`);
        });
      }
    }
    
    console.log('   All Machines:');
    appInitState.allMachines.forEach(name => {
      console.log(`     - ${name}`);
    });
    
    // Check auth state and organization context
    const authContext = await page.evaluate(() => {
      // Check auth machine state
      const inspector = window.xstateTestInspector;
      let authMachineState = null;
      
      if (inspector) {
        const summary = inspector.getSummary();
        const authMachine = summary.machines['auth-machine'] || 
                           Object.values(summary.machines).find(m => 
                             m.id?.includes('auth')
                           );
        
        if (authMachine) {
          authMachineState = {
            id: authMachine.id,
            currentState: inspector.getCurrentState(authMachine.id),
            context: authMachine.context
          };
        }
      }
      
      // Check global auth state
      const hasAuth = !!window.useAuth;
      const hasCurrentOrg = !!window.currentOrganization;
      
      // Try to get auth data from hooks or global state
      let authData = null;
      try {
        // This might not work in this context, but worth a try
        authData = {
          user: window.user || 'unknown',
          currentOrganization: window.currentOrganization || 'unknown'
        };
      } catch (e) {
        authData = { error: e.message };
      }
      
      return {
        authMachineState,
        hasAuth,
        hasCurrentOrg,
        authData
      };
    });
    
    console.log('\n👤 Auth Context:');
    console.log(`   Auth Hook Available: ${authContext.hasAuth ? '✅' : '❌'}`);
    console.log(`   Current Organization: ${authContext.hasCurrentOrg ? '✅' : '❌'}`);
    
    if (authContext.authMachineState) {
      console.log(`   Auth Machine: ${authContext.authMachineState.id}`);
      console.log(`   Auth State: ${authContext.authMachineState.currentState}`);
    }
    
    // Check if LiveStore Provider is actually mounted
    const liveStoreProviderStatus = await page.evaluate(() => {
      // Look for LiveStore Provider in DOM
      const hasProviderElement = !!document.querySelector('[data-livestore-provider]');
      
      // Check if the component is loaded/mounted
      const hasGlobalLiveStore = !!window.liveStoreSchemaClient;
      
      // Check React component tree (if accessible)
      const reactRoot = document.querySelector('#root');
      const hasReactRoot = !!reactRoot;
      
      return {
        hasProviderElement,
        hasGlobalLiveStore,
        hasReactRoot
      };
    });
    
    console.log('\n📱 LiveStore Provider Status:');
    console.log(`   Provider Element: ${liveStoreProviderStatus.hasProviderElement ? '✅' : '❌'}`);
    console.log(`   Global LiveStore Client: ${liveStoreProviderStatus.hasGlobalLiveStore ? '✅' : '❌'}`);
    console.log(`   React Root: ${liveStoreProviderStatus.hasReactRoot ? '✅' : '❌'}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/app-init-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/app-init-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('App init machine debug completed');
    console.log('='.repeat(60));
  });
});