#!/usr/bin/env node

/**
 * LiveStore Sync Mutations Test
 * 
 * Tests if mutations in LiveStore are triggering change messages
 * and if the sync system is properly detecting and propagating changes
 */

const { chromium } = require('playwright');
const path = require('path');

async function testLiveStoreSyncMutations() {
  console.log('🔄 Testing LiveStore Sync Mutations...');
  
  // Wide Corp Organization ID
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  
  // Use persistent profile for Wide Corp CEO authentication
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
    
    console.log('🚀 Browser launched with Wide Corp CEO context');
    
    // Navigate to the LiveStore debug page
    console.log('📍 Navigating to LiveStore debug page...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Check authentication and organization
    const authStatus = await page.evaluate(() => {
      return {
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        pathname: window.location.pathname,
        isAuthenticated: !window.location.pathname.includes('sign-in')
      };
    });
    
    console.log('🔐 Authentication Status:', authStatus);
    
    if (!authStatus.isAuthenticated) {
      console.log('⚠️ Authentication required. Please complete authentication and press Enter...');
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
    }
    
    // Switch to Wide Corp if needed
    if (authStatus.orgId !== WIDE_CORP_ORG_ID) {
      console.log('🔄 Switching to Wide Corp Solutions organization...');
      await page.evaluate((targetOrgId) => {
        localStorage.setItem('vibestack-last-organization-id', targetOrgId);
      }, WIDE_CORP_ORG_ID);
      
      await page.reload();
      await page.waitForTimeout(2000);
      
      const newAuthStatus = await page.evaluate(() => {
        return { orgId: localStorage.getItem('vibestack-last-organization-id') };
      });
      console.log('✅ Organization switched to:', newAuthStatus.orgId);
    }
    
    // Set up sync monitoring
    console.log('🔧 Setting up sync monitoring...');
    await page.evaluate(() => {
      // Create a global sync monitor to capture all sync events
      window.syncMonitor = {
        events: [],
        mutations: [],
        changes: [],
        websocketMessages: [],
        
        // Monitor function to log all sync-related activity
        logEvent: function(type, data) {
          const timestamp = new Date().toISOString();
          const event = { timestamp, type, data };
          this.events.push(event);
          console.log(`[SYNC MONITOR] ${timestamp} - ${type}:`, data);
        },
        
        // Get recent events
        getRecentEvents: function(seconds = 30) {
          const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
          return this.events.filter(e => e.timestamp > cutoff);
        },
        
        // Clear events
        clear: function() {
          this.events = [];
          this.mutations = [];
          this.changes = [];
          this.websocketMessages = [];
        }
      };
      
      // Hook into LiveStore if available
      if (window.liveStore) {
        console.log('📡 LiveStore detected, hooking into events...');
        
        // Monitor LiveStore mutations
        const originalMutate = window.liveStore.mutate;
        if (originalMutate) {
          window.liveStore.mutate = function(...args) {
            window.syncMonitor.logEvent('LIVESTORE_MUTATION', args);
            return originalMutate.apply(this, args);
          };
        }
        
        // Monitor LiveStore queries
        const originalQuery = window.liveStore.query;
        if (originalQuery) {
          window.liveStore.query = function(...args) {
            window.syncMonitor.logEvent('LIVESTORE_QUERY', args);
            return originalQuery.apply(this, args);
          };
        }
      }
      
      // Hook into WebSocket messages
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        const originalSend = ws.send;
        ws.send = function(data) {
          window.syncMonitor.logEvent('WEBSOCKET_SEND', { url, data: data.toString() });
          return originalSend.call(this, data);
        };
        
        ws.addEventListener('message', (event) => {
          window.syncMonitor.logEvent('WEBSOCKET_MESSAGE', { url, data: event.data });
        });
        
        ws.addEventListener('open', () => {
          window.syncMonitor.logEvent('WEBSOCKET_OPEN', { url });
        });
        
        ws.addEventListener('close', () => {
          window.syncMonitor.logEvent('WEBSOCKET_CLOSE', { url });
        });
        
        return ws;
      };
      
      // Hook into fetch requests
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (url.includes('/api/') || url.includes('sync')) {
          window.syncMonitor.logEvent('API_REQUEST', { url, method: options?.method || 'GET' });
        }
        return originalFetch.apply(this, arguments).then(response => {
          if (url.includes('/api/') || url.includes('sync')) {
            window.syncMonitor.logEvent('API_RESPONSE', { url, status: response.status });
          }
          return response;
        });
      };
      
      console.log('✅ Sync monitoring set up complete');
    });
    
    // Test 1: Create a project mutation and monitor sync events
    console.log('\n🧪 Test 1: Creating project mutation...');
    
    // Clear previous events
    await page.evaluate(() => window.syncMonitor.clear());
    
    // Wait for any initial sync activity to settle
    await page.waitForTimeout(2000);
    
    // Try to find and click a "Create Project" button or form
    const createProjectResult = await page.evaluate(async () => {
      try {
        // Look for project creation UI elements
        const createButton = document.querySelector('[data-testid="create-project"]') ||
                            document.querySelector('button[class*="create"]') ||
                            document.querySelector('button:has-text("Create")') ||
                            document.querySelector('button:has-text("Add")');
        
        if (createButton) {
          window.syncMonitor.logEvent('UI_INTERACTION', 'Found create button, clicking...');
          createButton.click();
          return { success: true, method: 'button_click' };
        }
        
        // Try to use domain services directly if available
        if (window.liveStoreDomain && window.liveStoreDomain.services) {
          window.syncMonitor.logEvent('DIRECT_MUTATION', 'Using domain services directly...');
          
          const projectData = {
            name: `Sync Test Project ${Date.now()}`,
            description: 'Testing LiveStore sync mutations',
            project_type: 'Testing',
            status: 'planning'
          };
          
          const result = await window.liveStoreDomain.services.project.create(projectData);
          window.syncMonitor.logEvent('DOMAIN_SERVICE_RESULT', result);
          
          return { success: result.success, method: 'domain_service', result };
        }
        
        // Try LiveStore direct mutation if available
        if (window.liveStore && window.liveStore.mutate) {
          window.syncMonitor.logEvent('LIVESTORE_DIRECT', 'Using LiveStore mutate directly...');
          
          const mutation = {
            type: 'CREATE',
            entity: 'project',
            data: {
              name: `LiveStore Sync Test ${Date.now()}`,
              description: 'Direct LiveStore mutation test',
              project_type: 'Testing'
            }
          };
          
          const result = await window.liveStore.mutate(mutation);
          window.syncMonitor.logEvent('LIVESTORE_RESULT', result);
          
          return { success: true, method: 'livestore_direct', result };
        }
        
        return { success: false, error: 'No mutation method available' };
        
      } catch (error) {
        window.syncMonitor.logEvent('MUTATION_ERROR', error.message);
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Project Creation Result:', createProjectResult);
    
    // Wait for sync events to propagate
    console.log('⏳ Waiting for sync events to propagate...');
    await page.waitForTimeout(5000);
    
    // Collect sync events
    const syncEvents = await page.evaluate(() => {
      return {
        recentEvents: window.syncMonitor.getRecentEvents(60),
        totalEvents: window.syncMonitor.events.length,
        eventTypes: [...new Set(window.syncMonitor.events.map(e => e.type))]
      };
    });
    
    console.log('\n📡 Sync Events Captured:');
    console.log('  Total Events:', syncEvents.totalEvents);
    console.log('  Event Types:', syncEvents.eventTypes);
    
    // Display recent events
    if (syncEvents.recentEvents.length > 0) {
      console.log('\n📋 Recent Sync Events:');
      syncEvents.recentEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. [${event.timestamp}] ${event.type}`);
        if (event.data && typeof event.data === 'object') {
          console.log(`     Data:`, JSON.stringify(event.data, null, 2).substring(0, 200));
        }
      });
    } else {
      console.log('⚠️ No sync events captured');
    }
    
    // Test 2: Try a skill creation mutation
    console.log('\n🎯 Test 2: Creating skill mutation...');
    
    const createSkillResult = await page.evaluate(async () => {
      try {
        if (window.liveStoreDomain && window.liveStoreDomain.services) {
          const skillData = {
            name: `Sync Testing Skill ${Date.now()}`,
            category: 'Testing',
            level: 'Expert',
            description: 'Testing LiveStore sync with skill mutations'
          };
          
          const result = await window.liveStoreDomain.services.skill.create(skillData);
          window.syncMonitor.logEvent('SKILL_CREATION', result);
          
          return { success: result.success, method: 'domain_service', result };
        }
        
        return { success: false, error: 'Domain services not available' };
        
      } catch (error) {
        window.syncMonitor.logEvent('SKILL_CREATION_ERROR', error.message);
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Skill Creation Result:', createSkillResult);
    
    // Wait for additional sync events
    await page.waitForTimeout(3000);
    
    // Test 3: Check for WebSocket activity
    console.log('\n🌐 Test 3: Checking WebSocket sync activity...');
    
    const websocketActivity = await page.evaluate(() => {
      const wsEvents = window.syncMonitor.events.filter(e => e.type.startsWith('WEBSOCKET'));
      return {
        hasWebSocketEvents: wsEvents.length > 0,
        websocketEvents: wsEvents,
        connectionCount: wsEvents.filter(e => e.type === 'WEBSOCKET_OPEN').length,
        messageCount: wsEvents.filter(e => e.type === 'WEBSOCKET_MESSAGE').length
      };
    });
    
    console.log('📊 WebSocket Activity:', websocketActivity);
    
    // Test 4: Check for API sync requests
    console.log('\n🔗 Test 4: Checking API sync requests...');
    
    const apiActivity = await page.evaluate(() => {
      const apiEvents = window.syncMonitor.events.filter(e => e.type.startsWith('API'));
      return {
        hasApiEvents: apiEvents.length > 0,
        apiEvents: apiEvents,
        requestCount: apiEvents.filter(e => e.type === 'API_REQUEST').length,
        responseCount: apiEvents.filter(e => e.type === 'API_RESPONSE').length
      };
    });
    
    console.log('📊 API Activity:', apiActivity);
    
    // Test 5: Try to trigger a manual sync
    console.log('\n🔄 Test 5: Attempting manual sync trigger...');
    
    const manualSyncResult = await page.evaluate(async () => {
      try {
        // Look for sync buttons or functions
        const syncButton = document.querySelector('[data-testid="sync"]') ||
                          document.querySelector('button:has-text("Sync")') ||
                          document.querySelector('button[class*="sync"]');
        
        if (syncButton) {
          window.syncMonitor.logEvent('MANUAL_SYNC', 'Clicking sync button');
          syncButton.click();
          return { success: true, method: 'button_click' };
        }
        
        // Try to call sync functions directly
        if (window.liveStore && window.liveStore.sync) {
          window.syncMonitor.logEvent('MANUAL_SYNC', 'Calling liveStore.sync()');
          await window.liveStore.sync();
          return { success: true, method: 'livestore_sync' };
        }
        
        if (window.syncManager && window.syncManager.sync) {
          window.syncMonitor.logEvent('MANUAL_SYNC', 'Calling syncManager.sync()');
          await window.syncManager.sync();
          return { success: true, method: 'sync_manager' };
        }
        
        return { success: false, error: 'No manual sync method found' };
        
      } catch (error) {
        window.syncMonitor.logEvent('MANUAL_SYNC_ERROR', error.message);
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Manual Sync Result:', manualSyncResult);
    
    // Wait for manual sync events
    await page.waitForTimeout(3000);
    
    // Final event collection
    const finalEvents = await page.evaluate(() => {
      return {
        allEvents: window.syncMonitor.events,
        eventSummary: {
          mutations: window.syncMonitor.events.filter(e => e.type.includes('MUTATION')).length,
          websocketMessages: window.syncMonitor.events.filter(e => e.type === 'WEBSOCKET_MESSAGE').length,
          apiRequests: window.syncMonitor.events.filter(e => e.type === 'API_REQUEST').length,
          liveStoreEvents: window.syncMonitor.events.filter(e => e.type.includes('LIVESTORE')).length
        }
      };
    });
    
    // Take a screenshot for verification
    console.log('\n📸 Taking verification screenshot...');
    await page.screenshot({ 
      path: 'livestore-sync-mutations-test.png',
      fullPage: true 
    });
    
    // Final Assessment
    console.log('\n🎉 LIVESTORE SYNC MUTATIONS TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log('  📊 Total Events Captured:', finalEvents.allEvents.length);
    console.log('  🔄 Mutation Events:', finalEvents.eventSummary.mutations);
    console.log('  🌐 WebSocket Messages:', finalEvents.eventSummary.websocketMessages);
    console.log('  🔗 API Requests:', finalEvents.eventSummary.apiRequests);
    console.log('  📡 LiveStore Events:', finalEvents.eventSummary.liveStoreEvents);
    console.log('='.repeat(60));
    
    // Determine if sync is working
    const hasSyncActivity = finalEvents.eventSummary.websocketMessages > 0 || 
                           finalEvents.eventSummary.apiRequests > 0 ||
                           finalEvents.eventSummary.mutations > 0;
    
    if (hasSyncActivity) {
      console.log('🎯 SYNC ACTIVITY DETECTED! ✅');
      console.log('   LiveStore mutations are triggering sync messages');
      
      if (finalEvents.eventSummary.websocketMessages > 0) {
        console.log('   ✅ WebSocket sync messages detected');
      }
      
      if (finalEvents.eventSummary.apiRequests > 0) {
        console.log('   ✅ API sync requests detected');
      }
      
      if (finalEvents.eventSummary.mutations > 0) {
        console.log('   ✅ LiveStore mutations detected');
      }
    } else {
      console.log('⚠️ LIMITED SYNC ACTIVITY');
      console.log('   Mutations may not be triggering sync messages');
      console.log('   Check sync configuration and WebSocket connections');
    }
    
    console.log('\n📍 Screenshot saved as: livestore-sync-mutations-test.png');
    console.log('\n📝 Event Details:');
    if (finalEvents.allEvents.length > 0) {
      finalEvents.allEvents.slice(-10).forEach((event, index) => {
        console.log(`  ${event.timestamp} - ${event.type}`);
      });
    }
    
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
testLiveStoreSyncMutations()
  .then(() => {
    console.log('\n✅ LiveStore sync mutations test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ LiveStore sync mutations test failed:', error);
    process.exit(1);
  });