/**
 * Test: Debug Sync Initialization Issues
 * Scenario: Capture console logs and debug why sync isn't starting
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug Sync Initialization', () => {
  test('should debug sync initialization and capture console logs', async ({ page }) => {
    console.log('🔍 Debug sync initialization issues...\n');
    console.log('='.repeat(60));
    
    const consoleMessages = [];
    const networkFailures = [];
    
    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Capture network failures
    page.on('requestfailed', request => {
      networkFailures.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      });
    });
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait a bit for any initialization
    await page.waitForTimeout(5000);
    
    // Check sync machine initialization
    const syncDebugInfo = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const machines = inspector.getSummary().machines;
      const syncMachine = machines['sync-machine-v3'];
      
      // Check if sync machine exists and is initialized
      const hasSyncMachine = !!syncMachine;
      const currentState = syncMachine?.currentState || 'unknown';
      const eventCount = syncMachine?.eventCount || 0;
      
      // Check for sync-related globals
      const hasDb = !!window.db;
      const hasSyncHelpers = !!window.testSyncHelpers;
      const hasSocketManager = !!window.socketManager;
      
      // Try to get sync configuration
      let syncConfig = null;
      try {
        if (window.syncConfig) {
          syncConfig = window.syncConfig;
        }
      } catch (e) {
        // Ignore
      }
      
      return {
        hasInspector: true,
        hasSyncMachine,
        currentState,
        eventCount,
        hasDb,
        hasSyncHelpers,
        hasSocketManager,
        syncConfig,
        machineList: Object.keys(machines)
      };
    });
    
    console.log('\n🔧 Sync Initialization Debug:');
    console.log(`   XState Inspector: ${syncDebugInfo.hasInspector ? '✅' : '❌'}`);
    console.log(`   Sync Machine (sync-machine-v3): ${syncDebugInfo.hasSyncMachine ? '✅' : '❌'}`);
    console.log(`   Current State: ${syncDebugInfo.currentState}`);
    console.log(`   Event Count: ${syncDebugInfo.eventCount}`);
    console.log(`   Database (window.db): ${syncDebugInfo.hasDb ? '✅' : '❌'}`);
    console.log(`   Sync Helpers: ${syncDebugInfo.hasSyncHelpers ? '✅' : '❌'}`);
    console.log(`   Socket Manager: ${syncDebugInfo.hasSocketManager ? '✅' : '❌'}`);
    
    if (syncDebugInfo.machineList.length > 0) {
      console.log(`   Available Machines: ${syncDebugInfo.machineList.join(', ')}`);
    }
    
    // Check database connection
    const dbStatus = await page.evaluate(async () => {
      if (!window.db) return { hasDb: false };
      
      try {
        // Test basic DB operations
        const dbInfo = {
          hasDb: true,
          isOpen: window.db.isOpen(),
          name: window.db.name,
          version: window.db.verno
        };
        
        // Try to count records
        try {
          const tables = ['users', 'projects', 'tasks', 'comments'];
          const counts = {};
          for (const table of tables) {
            if (window.db[table]) {
              counts[table] = await window.db[table].count();
            }
          }
          dbInfo.tableCounts = counts;
        } catch (e) {
          dbInfo.tableError = e.message;
        }
        
        return dbInfo;
      } catch (e) {
        return { hasDb: true, error: e.message };
      }
    });
    
    console.log('\n💾 Database Status:');
    if (dbStatus.hasDb) {
      console.log(`   Database Open: ${dbStatus.isOpen ? '✅' : '❌'}`);
      console.log(`   Database Name: ${dbStatus.name || 'Unknown'}`);
      console.log(`   Database Version: ${dbStatus.version || 'Unknown'}`);
      
      if (dbStatus.tableCounts) {
        console.log('   Table Counts:');
        Object.entries(dbStatus.tableCounts).forEach(([table, count]) => {
          console.log(`     ${table}: ${count}`);
        });
      }
      
      if (dbStatus.tableError) {
        console.log(`   Table Error: ${dbStatus.tableError}`);
      }
      
      if (dbStatus.error) {
        console.log(`   DB Error: ${dbStatus.error}`);
      }
    } else {
      console.log('   Database: ❌ Not available');
    }
    
    // Check WebSocket connections
    const wsStatus = await page.evaluate(() => {
      // Look for any WebSocket connections
      const wsConnections = [];
      
      // Check if there are any WebSocket objects
      if (window.WebSocket) {
        // This is a bit tricky - we can't directly inspect existing WebSockets
        // but we can check for any sync-related connection indicators
        return {
          webSocketSupported: true,
          // We'd need to check the actual sync implementation for connection status
        };
      }
      
      return { webSocketSupported: false };
    });
    
    console.log('\n🌐 WebSocket Status:');
    console.log(`   WebSocket Support: ${wsStatus.webSocketSupported ? '✅' : '❌'}`);
    
    // Analyze console messages
    const syncRelatedMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('sync') ||
      msg.text.toLowerCase().includes('websocket') ||
      msg.text.toLowerCase().includes('livestore') ||
      msg.text.toLowerCase().includes('replication')
    );
    
    const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
    const warningMessages = consoleMessages.filter(msg => msg.type === 'warning');
    
    console.log('\n📝 Console Analysis:');
    console.log(`   Total messages: ${consoleMessages.length}`);
    console.log(`   Sync-related: ${syncRelatedMessages.length}`);
    console.log(`   Errors: ${errorMessages.length}`);
    console.log(`   Warnings: ${warningMessages.length}`);
    
    if (syncRelatedMessages.length > 0) {
      console.log('\n🔄 Sync-Related Messages:');
      syncRelatedMessages.slice(-10).forEach(msg => {
        console.log(`   [${msg.type}] ${msg.text}`);
      });
    }
    
    if (errorMessages.length > 0) {
      console.log('\n❌ Error Messages:');
      errorMessages.slice(-5).forEach(msg => {
        console.log(`   ${msg.text}`);
      });
    }
    
    if (networkFailures.length > 0) {
      console.log('\n🚫 Network Failures:');
      networkFailures.forEach(failure => {
        console.log(`   ${failure.method} ${failure.url}: ${failure.failure}`);
      });
    }
    
    // Check for specific sync endpoints
    const syncEndpointTest = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/sync/status', {
          credentials: 'include'
        });
        return {
          statusEndpoint: response.status,
          statusOk: response.ok
        };
      } catch (e) {
        return {
          statusEndpoint: 'error',
          statusError: e.message
        };
      }
    });
    
    console.log('\n🔗 Sync Endpoint Test:');
    console.log(`   /api/sync/status: ${syncEndpointTest.statusEndpoint} ${syncEndpointTest.statusOk ? '✅' : '❌'}`);
    if (syncEndpointTest.statusError) {
      console.log(`   Error: ${syncEndpointTest.statusError}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/sync-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/sync-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('Sync initialization debug completed');
    console.log('='.repeat(60));
  });
});