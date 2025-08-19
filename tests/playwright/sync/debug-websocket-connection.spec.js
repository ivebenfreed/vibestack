/**
 * Test: Debug WebSocket Connection for Sync
 * Scenario: Monitor WebSocket connection attempts and sync initialization
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug WebSocket Sync Connection', () => {
  test('should monitor WebSocket connection attempts and sync machine state', async ({ page }) => {
    console.log('🔍 Debug WebSocket sync connection...\n');
    console.log('='.repeat(60));
    
    const networkRequests = [];
    const wsConnections = [];
    const consoleMessages = [];
    
    // Monitor network requests
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Monitor WebSocket creation attempts
    await page.addInitScript(() => {
      const originalWebSocket = window.WebSocket;
      
      window.WebSocket = function(url, protocols) {
        console.log('[DEBUG] WebSocket connection attempt:', url);
        window.wsConnectionAttempts = window.wsConnectionAttempts || [];
        window.wsConnectionAttempts.push({
          url,
          protocols,
          timestamp: Date.now()
        });
        
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('open', () => {
          console.log('[DEBUG] WebSocket opened:', url);
        });
        
        ws.addEventListener('error', (error) => {
          console.log('[DEBUG] WebSocket error:', url, error);
        });
        
        ws.addEventListener('close', (event) => {
          console.log('[DEBUG] WebSocket closed:', url, event.code, event.reason);
        });
        
        return ws;
      };
    });
    
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for potential WebSocket connections
    await page.waitForTimeout(5000);
    
    // Check if any WebSocket connections were attempted
    const wsAttempts = await page.evaluate(() => {
      return window.wsConnectionAttempts || [];
    });
    
    console.log('\n🌐 WebSocket Connection Attempts:');
    if (wsAttempts.length > 0) {
      wsAttempts.forEach((attempt, index) => {
        console.log(`   ${index + 1}. ${attempt.url}`);
        if (attempt.protocols) {
          console.log(`      Protocols: ${JSON.stringify(attempt.protocols)}`);
        }
      });
    } else {
      console.log('   ❌ No WebSocket connection attempts detected');
    }
    
    // Check sync-related network requests
    const syncRequests = networkRequests.filter(req => 
      req.url.includes('/sync') || 
      req.url.includes('/api/sync') ||
      req.url.includes('websocket') ||
      req.url.includes('ws://')
    );
    
    console.log('\n📡 Sync-Related Network Requests:');
    if (syncRequests.length > 0) {
      syncRequests.forEach(req => {
        console.log(`   ${req.method} ${req.url} (${req.type})`);
      });
    } else {
      console.log('   ❌ No sync-related requests detected');
    }
    
    // Get detailed sync machine state
    const syncMachineDetail = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const summary = inspector.getSummary();
      const syncMachine = summary.machines['sync-machine-v3'];
      const events = inspector.getEvents('sync-machine-v3');
      const transitions = inspector.getTransitions('sync-machine-v3');
      
      // Get current state details
      const currentState = inspector.getCurrentState('sync-machine-v3');
      
      // Look for any connection-related events
      const connectionEvents = events.filter(e => 
        e.event.type.toLowerCase().includes('connect') ||
        e.event.type.toLowerCase().includes('init') ||
        e.event.type.toLowerCase().includes('start') ||
        e.event.type.toLowerCase().includes('socket')
      );
      
      return {
        hasInspector: true,
        currentState,
        totalEvents: events.length,
        totalTransitions: transitions.length,
        connectionEvents: connectionEvents.map(e => ({
          type: e.event.type,
          timestamp: e.timestamp
        })),
        allEventTypes: [...new Set(events.map(e => e.event.type))],
        context: syncMachine?.context || {}
      };
    });
    
    console.log('\n🔧 Sync Machine Details:');
    console.log(`   Current State: ${syncMachineDetail.currentState}`);
    console.log(`   Total Events: ${syncMachineDetail.totalEvents}`);
    console.log(`   Total Transitions: ${syncMachineDetail.totalTransitions}`);
    
    if (syncMachineDetail.connectionEvents.length > 0) {
      console.log('\n🔗 Connection-Related Events:');
      syncMachineDetail.connectionEvents.forEach(event => {
        console.log(`   ${event.type}`);
      });
    } else {
      console.log('\n❌ No connection-related events found');
    }
    
    console.log('\n📋 All Event Types:');
    syncMachineDetail.allEventTypes.forEach(type => {
      console.log(`   - ${type}`);
    });
    
    // Check LiveStore initialization
    const liveStoreStatus = await page.evaluate(() => {
      // Check if LiveStore provider is set up
      const hasLiveStoreProvider = !!document.querySelector('[data-livestore-provider]') ||
                                   !!window.liveStoreProvider ||
                                   !!window.LiveStoreProvider;
      
      // Check for any sync configuration
      const hasSyncConfig = !!window.syncConfig;
      
      // Check organization context
      const orgContext = window.currentOrganization || 
                         window.organizationContext ||
                         localStorage.getItem('currentOrganization');
      
      return {
        hasLiveStoreProvider,
        hasSyncConfig,
        orgContext: orgContext ? JSON.parse(orgContext) : null
      };
    });
    
    console.log('\n📱 LiveStore Status:');
    console.log(`   LiveStore Provider: ${liveStoreStatus.hasLiveStoreProvider ? '✅' : '❌'}`);
    console.log(`   Sync Config: ${liveStoreStatus.hasSyncConfig ? '✅' : '❌'}`);
    console.log(`   Organization Context: ${liveStoreStatus.orgContext ? '✅' : '❌'}`);
    
    if (liveStoreStatus.orgContext) {
      console.log(`     Org ID: ${liveStoreStatus.orgContext.id || 'Unknown'}`);
      console.log(`     Org Slug: ${liveStoreStatus.orgContext.slug || 'Unknown'}`);
    }
    
    // Check for any errors in sync initialization
    const syncErrors = consoleMessages.filter(msg => 
      msg.type === 'error' && (
        msg.text.toLowerCase().includes('sync') ||
        msg.text.toLowerCase().includes('websocket') ||
        msg.text.toLowerCase().includes('connection')
      )
    );
    
    if (syncErrors.length > 0) {
      console.log('\n❌ Sync-Related Errors:');
      syncErrors.forEach(error => {
        console.log(`   ${error.text}`);
      });
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/websocket-sync-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/websocket-sync-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('WebSocket sync connection debug completed');
    console.log('='.repeat(60));
  });
});