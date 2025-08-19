#!/usr/bin/env node

/**
 * LiveStore Debug Sync Test
 * 
 * Direct test of the LiveStore debug page to check if mutations 
 * are triggering sync messages and change events
 */

const { chromium } = require('playwright');
const path = require('path');

async function testLiveStoreDebugSync() {
  console.log('🔄 Testing LiveStore Debug Sync...');
  
  // Use persistent profile
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', 'profile-main');
  
  let browser;
  
  try {
    // Launch browser with persistent context
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const page = await browser.newPage();
    
    console.log('🚀 Browser launched with persistent context');
    
    // Navigate to the LiveStore debug page
    console.log('📍 Navigating to LiveStore debug page...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    
    // Wait for the page to load completely
    await page.waitForTimeout(5000);
    
    // Check what's available on the page
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasLiveStore: !!window.liveStore,
        hasLiveStoreDomain: !!window.liveStoreDomain,
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        pageText: document.body.innerText.substring(0, 500),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent.trim(),
          id: btn.id,
          className: btn.className,
          dataset: {...btn.dataset}
        }))
      };
    });
    
    console.log('📊 Page Info:', pageInfo);
    
    // Set up comprehensive sync monitoring
    console.log('🔧 Setting up comprehensive sync monitoring...');
    await page.evaluate(() => {
      // Create enhanced sync monitor
      window.syncMonitor = {
        events: [],
        startTime: Date.now(),
        
        log: function(type, data) {
          const timestamp = new Date().toISOString();
          const event = { timestamp, type, data, relativeTime: Date.now() - this.startTime };
          this.events.push(event);
          console.log(`[SYNC] ${timestamp} - ${type}:`, data);
        },
        
        getEvents: function() {
          return this.events;
        }
      };
      
      // Monitor console messages for LiveStore activity
      const originalConsoleLog = console.log;
      console.log = function(...args) {
        if (args.some(arg => 
          typeof arg === 'string' && 
          (arg.includes('LiveStore') || arg.includes('sync') || arg.includes('mutation'))
        )) {
          window.syncMonitor.log('CONSOLE_LOG', args.join(' '));
        }
        return originalConsoleLog.apply(this, args);
      };
      
      // Monitor window events that might indicate sync activity
      ['storage', 'message', 'beforeunload'].forEach(eventType => {
        window.addEventListener(eventType, (event) => {
          window.syncMonitor.log(`WINDOW_EVENT_${eventType.toUpperCase()}`, {
            type: event.type,
            data: event.data || event.key || 'event_triggered'
          });
        });
      });
      
      console.log('✅ Enhanced sync monitoring activated');
    });
    
    // Test 1: Look for existing mutation buttons and test them
    console.log('\n🧪 Test 1: Testing existing mutation buttons...');
    
    const buttonTestResults = await page.evaluate(async () => {
      const results = [];
      const buttons = Array.from(document.querySelectorAll('button'));
      
      for (const button of buttons) {
        const buttonText = button.textContent.trim().toLowerCase();
        
        // Look for buttons that might trigger mutations
        if (buttonText.includes('create') || 
            buttonText.includes('add') || 
            buttonText.includes('test') ||
            buttonText.includes('mutation') ||
            buttonText.includes('sync')) {
          
          window.syncMonitor.log('BUTTON_FOUND', {
            text: buttonText,
            id: button.id,
            className: button.className
          });
          
          try {
            // Click the button and wait for events
            button.click();
            
            // Give it time to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            results.push({
              success: true,
              buttonText,
              clicked: true
            });
            
            window.syncMonitor.log('BUTTON_CLICKED', buttonText);
            
          } catch (error) {
            results.push({
              success: false,
              buttonText,
              error: error.message
            });
            
            window.syncMonitor.log('BUTTON_ERROR', {
              buttonText,
              error: error.message
            });
          }
        }
      }
      
      return results;
    });
    
    console.log('📊 Button Test Results:', buttonTestResults);
    
    // Wait for any async operations to complete
    await page.waitForTimeout(3000);
    
    // Test 2: Try direct LiveStore API calls
    console.log('\n🔧 Test 2: Testing direct LiveStore API calls...');
    
    const directApiResult = await page.evaluate(async () => {
      try {
        // Check what LiveStore APIs are available
        const liveStoreInfo = {
          hasLiveStore: !!window.liveStore,
          liveStoreMethods: window.liveStore ? Object.keys(window.liveStore) : [],
          hasLiveStoreDomain: !!window.liveStoreDomain,
          liveStoreDomainMethods: window.liveStoreDomain ? Object.keys(window.liveStoreDomain) : []
        };
        
        window.syncMonitor.log('LIVESTORE_INFO', liveStoreInfo);
        
        // Try to make a test mutation
        if (window.liveStoreDomain && window.liveStoreDomain.test) {
          window.syncMonitor.log('CALLING_LIVESTORE_TEST', 'Attempting liveStoreDomain.test()');
          const testResult = await window.liveStoreDomain.test();
          window.syncMonitor.log('LIVESTORE_TEST_RESULT', testResult);
          return { success: true, method: 'test', result: testResult };
        }
        
        // Try to access domain services
        if (window.liveStoreDomain && window.liveStoreDomain.services) {
          window.syncMonitor.log('DOMAIN_SERVICES_AVAILABLE', Object.keys(window.liveStoreDomain.services));
          
          // Try to create a test project
          if (window.liveStoreDomain.services.project) {
            window.syncMonitor.log('CREATING_TEST_PROJECT', 'Using domain services');
            
            const projectData = {
              name: `LiveStore Sync Test ${Date.now()}`,
              description: 'Testing sync functionality'
            };
            
            const createResult = await window.liveStoreDomain.services.project.create(projectData);
            window.syncMonitor.log('PROJECT_CREATE_RESULT', createResult);
            
            return { success: createResult.success, method: 'project_create', result: createResult };
          }
        }
        
        return { success: false, error: 'No LiveStore APIs available' };
        
      } catch (error) {
        window.syncMonitor.log('DIRECT_API_ERROR', error.message);
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Direct API Result:', directApiResult);
    
    // Wait for sync events to propagate
    await page.waitForTimeout(5000);
    
    // Test 3: Check for network activity
    console.log('\n🌐 Test 3: Monitoring network activity...');
    
    // Set up network monitoring
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('/api/') || url.includes('sync') || url.includes('websocket')) {
        console.log('📡 Network Request:', route.request().method(), url);
      }
      route.continue();
    });
    
    // Trigger another test to see network activity
    await page.evaluate(async () => {
      window.syncMonitor.log('TRIGGERING_NETWORK_TEST', 'Making test API call');
      
      try {
        // Try to fetch from the debug API
        const response = await fetch('/api/debug/table-data/tables/01920000-1000-7000-8000-000000000001');
        const data = await response.json();
        window.syncMonitor.log('DEBUG_API_RESULT', { status: response.status, data });
      } catch (error) {
        window.syncMonitor.log('DEBUG_API_ERROR', error.message);
      }
    });
    
    await page.waitForTimeout(3000);
    
    // Test 4: Collect all sync events and analyze
    console.log('\n📊 Test 4: Analyzing all captured sync events...');
    
    const allSyncEvents = await page.evaluate(() => {
      return {
        events: window.syncMonitor.getEvents(),
        totalEvents: window.syncMonitor.events.length,
        eventTypes: [...new Set(window.syncMonitor.events.map(e => e.type))],
        timespan: Date.now() - window.syncMonitor.startTime
      };
    });
    
    console.log('\n📈 Sync Event Analysis:');
    console.log('  Total Events:', allSyncEvents.totalEvents);
    console.log('  Event Types:', allSyncEvents.eventTypes);
    console.log('  Timespan:', `${allSyncEvents.timespan}ms`);
    
    if (allSyncEvents.events.length > 0) {
      console.log('\n📋 All Captured Events:');
      allSyncEvents.events.forEach((event, index) => {
        console.log(`  ${index + 1}. [+${event.relativeTime}ms] ${event.type}`);
        if (event.data && typeof event.data === 'object') {
          console.log(`     ${JSON.stringify(event.data, null, 2).substring(0, 200)}`);
        } else if (event.data) {
          console.log(`     ${event.data.toString().substring(0, 100)}`);
        }
      });
    }
    
    // Take a screenshot
    console.log('\n📸 Taking verification screenshot...');
    await page.screenshot({ 
      path: 'livestore-debug-sync-test.png',
      fullPage: true 
    });
    
    // Final assessment
    const hasMutationActivity = allSyncEvents.eventTypes.some(type => 
      type.includes('MUTATION') || 
      type.includes('CREATE') || 
      type.includes('PROJECT') ||
      type.includes('LIVESTORE')
    );
    
    const hasNetworkActivity = allSyncEvents.eventTypes.some(type =>
      type.includes('API') ||
      type.includes('NETWORK') ||
      type.includes('FETCH')
    );
    
    const hasSyncEvents = allSyncEvents.eventTypes.some(type =>
      type.includes('SYNC') ||
      type.includes('CHANGE') ||
      type.includes('UPDATE')
    );
    
    console.log('\n🎉 LIVESTORE DEBUG SYNC TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log('  📊 Total Events:', allSyncEvents.totalEvents);
    console.log('  🔄 Mutation Activity:', hasMutationActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🌐 Network Activity:', hasNetworkActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  📡 Sync Events:', hasSyncEvents ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  ⏱️ Test Duration:', `${allSyncEvents.timespan}ms`);
    console.log('='.repeat(60));
    
    if (hasMutationActivity || hasNetworkActivity || hasSyncEvents) {
      console.log('🎯 SYNC FUNCTIONALITY WORKING! ✅');
      console.log('   LiveStore mutations are triggering sync activity');
    } else {
      console.log('⚠️ LIMITED SYNC ACTIVITY DETECTED');
      console.log('   Check LiveStore integration and sync configuration');
    }
    
    console.log('\n📍 Screenshot saved as: livestore-debug-sync-test.png');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
testLiveStoreDebugSync()
  .then(() => {
    console.log('\n✅ LiveStore debug sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ LiveStore debug sync test failed:', error);
    process.exit(1);
  });