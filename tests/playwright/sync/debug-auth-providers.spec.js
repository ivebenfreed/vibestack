/**
 * Test: Debug Auth Providers and LiveStore Mounting
 * Scenario: Check why LiveStore Provider isn't being mounted
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug Auth Providers', () => {
  test('should debug AuthAwareProviders and LiveStore mounting logic', async ({ page }) => {
    console.log('🔍 Debug AuthAwareProviders and LiveStore mounting...\n');
    console.log('='.repeat(60));
    
    const consoleMessages = [];
    
    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[AuthAwareProviders]') || 
          text.includes('[LiveStoreProvider]') ||
          text.includes('[VibestackDexieProvider]')) {
        consoleMessages.push({
          type: msg.type(),
          text: text,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for auth and provider initialization
    await page.waitForTimeout(3000);
    
    // Check auth hook state
    const authHookState = await page.evaluate(() => {
      // Try to access the useAuth hook data from window
      const authData = {
        hasUseAuth: typeof window.useAuth !== 'undefined',
        authMachineState: null,
        reactComponentState: null
      };
      
      // Check XState for auth machine
      if (window.xstateTestInspector) {
        const summary = window.xstateTestInspector.getSummary();
        const authMachine = summary.machines['auth-machine'];
        if (authMachine) {
          authData.authMachineState = {
            currentState: window.xstateTestInspector.getCurrentState('auth-machine'),
            context: authMachine.context
          };
        }
      }
      
      // Try to find React component state
      try {
        // Look for React DevTools data if available
        const reactRoot = document.querySelector('#root');
        if (reactRoot && reactRoot._reactInternalFiber) {
          authData.reactComponentState = 'React DevTools data found';
        }
      } catch (e) {
        // Ignore
      }
      
      return authData;
    });
    
    console.log('\n👤 Auth Hook Debug:');
    console.log(`   useAuth Available: ${authHookState.hasUseAuth ? '✅' : '❌'}`);
    
    if (authHookState.authMachineState) {
      console.log(`   Auth Machine State: ${authHookState.authMachineState.currentState}`);
      if (authHookState.authMachineState.context) {
        console.log(`   Auth Context Keys: ${Object.keys(authHookState.authMachineState.context).join(', ')}`);
      }
    }
    
    // Check DOM structure for providers
    const providerStructure = await page.evaluate(() => {
      const structure = {
        hasRoot: !!document.querySelector('#root'),
        hasAuthAwareProviders: false,
        hasVibestackDexieProvider: false,
        hasLiveStoreProvider: false,
        hasAbilityProvider: false,
        reactFiberData: null
      };
      
      // Look for provider-specific elements or data attributes
      structure.hasAuthAwareProviders = !!document.querySelector('[data-auth-aware-providers]');
      structure.hasVibestackDexieProvider = !!document.querySelector('[data-vibestack-dexie-provider]') || 
                                           !!window.db;
      structure.hasLiveStoreProvider = !!document.querySelector('[data-livestore-provider]') ||
                                      !!window.liveStoreSchemaClient;
      structure.hasAbilityProvider = !!document.querySelector('[data-ability-provider]');
      
      // Check if we can access React component tree
      try {
        const root = document.querySelector('#root');
        if (root && root._reactInternalFiber) {
          structure.reactFiberData = 'React fiber found';
        }
      } catch (e) {
        structure.reactFiberData = 'No React fiber access';
      }
      
      return structure;
    });
    
    console.log('\n🏗️ Provider Structure:');
    console.log(`   React Root: ${providerStructure.hasRoot ? '✅' : '❌'}`);
    console.log(`   AuthAwareProviders: ${providerStructure.hasAuthAwareProviders ? '✅' : '❌'}`);
    console.log(`   VibestackDexieProvider: ${providerStructure.hasVibestackDexieProvider ? '✅' : '❌'}`);
    console.log(`   LiveStoreProvider: ${providerStructure.hasLiveStoreProvider ? '✅' : '❌'}`);
    console.log(`   AbilityProvider: ${providerStructure.hasAbilityProvider ? '✅' : '❌'}`);
    console.log(`   React Fiber: ${providerStructure.reactFiberData || '❌'}`);
    
    // Check console messages from providers
    console.log('\n📝 Provider Console Messages:');
    if (consoleMessages.length > 0) {
      consoleMessages.forEach(msg => {
        console.log(`   [${msg.type}] ${msg.text}`);
      });
    } else {
      console.log('   ❌ No provider console messages found');
    }
    
    // Check if authentication conditions are met
    const authConditions = await page.evaluate(() => {
      // Try to directly check what the auth hook should return
      try {
        // Look for auth events that were fired
        const authReadyFired = window.eventLog?.some(e => e.type === 'auth:ready');
        
        // Check if user and organization are available
        const hasUser = window.eventLog?.some(e => 
          e.type === 'auth:ready' && e.detail?.user
        );
        
        const hasOrganization = window.eventLog?.some(e => 
          e.type === 'auth:ready' && e.detail?.organization
        );
        
        return {
          authReadyFired,
          hasUser,
          hasOrganization,
          eventLogLength: window.eventLog?.length || 0
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('\n✅ Auth Conditions Check:');
    console.log(`   Auth Ready Event: ${authConditions.authReadyFired ? '✅' : '❌'}`);
    console.log(`   Has User: ${authConditions.hasUser ? '✅' : '❌'}`);
    console.log(`   Has Organization: ${authConditions.hasOrganization ? '✅' : '❌'}`);
    console.log(`   Event Log Entries: ${authConditions.eventLogLength}`);
    
    if (authConditions.error) {
      console.log(`   Error: ${authConditions.error}`);
    }
    
    // Check if the app is using the correct root layout
    const layoutCheck = await page.evaluate(() => {
      const bodyClasses = document.body.className;
      const hasMinHeight = document.querySelector('.min-h-screen');
      const hasNavigationProgress = !!document.querySelector('[data-navigation-progress]') ||
                                   !!document.querySelector('*[class*="navigation"]');
      
      return {
        bodyClasses,
        hasMinHeight: !!hasMinHeight,
        hasNavigationProgress,
        totalElements: document.querySelectorAll('*').length
      };
    });
    
    console.log('\n🎨 Layout Check:');
    console.log(`   Body Classes: ${layoutCheck.bodyClasses || 'none'}`);
    console.log(`   Has Min Height: ${layoutCheck.hasMinHeight ? '✅' : '❌'}`);
    console.log(`   Has Navigation: ${layoutCheck.hasNavigationProgress ? '✅' : '❌'}`);
    console.log(`   Total Elements: ${layoutCheck.totalElements}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/auth-providers-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/auth-providers-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('Auth providers debug completed');
    console.log('='.repeat(60));
  });
});