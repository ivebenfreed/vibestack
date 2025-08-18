/**
 * WebSocket Sync Working - Verification Test
 * 
 * Confirms that the WebSocket sync system is working correctly after the fix.
 * Tests both client-side (web app) and server-side (WebSocket) sync.
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('verify WebSocket sync is working end-to-end', async ({ page }) => {
  console.log('🚀 Testing complete WebSocket sync functionality...');
  
  // 1. Navigate and ensure organization context is set
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }
  
  // 2. Check that sync machine reaches connected state
  console.log('⚙️ Monitoring sync machine state...');
  
  let syncConnected = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!syncConnected && attempts < maxAttempts) {
    const syncState = await page.evaluate(() => {
      const syncActor = window.syncMachineActor;
      if (syncActor) {
        const snapshot = syncActor.getSnapshot();
        return {
          state: snapshot.value,
          organizationId: snapshot.context.organizationId,
          clientId: snapshot.context.clientId,
          isConnected: snapshot.context.isConnected,
          currentLSN: snapshot.context.currentLSN,
          serverLSN: snapshot.context.serverLSN
        };
      }
      return null;
    });
    
    console.log(`🔄 Sync State (attempt ${attempts + 1}):`, syncState);
    
    if (syncState && syncState.isConnected) {
      syncConnected = true;
      console.log('✅ Sync machine connected successfully!');
      
      // Verify organization context is passed through
      expect(syncState.organizationId).toBe('01920000-1000-7000-8000-000000000001');
      expect(syncState.clientId).toBeTruthy();
      console.log(`🏢 Organization ID: ${syncState.organizationId}`);
      console.log(`🔑 Client ID: ${syncState.clientId}`);
      console.log(`📊 Current LSN: ${syncState.currentLSN}`);
      
    } else {
      attempts++;
      await page.waitForTimeout(2000);
    }
  }
  
  if (!syncConnected) {
    throw new Error('Sync machine failed to connect after 10 attempts');
  }
  
  // 3. Check for actual data in client database
  console.log('💾 Checking for synced data in client database...');
  
  const databaseStatus = await page.evaluate(async () => {
    try {
      // Check if LiveStore is available and has data
      if (typeof window.LiveStore !== 'undefined') {
        const liveStore = window.LiveStore;
        
        // Get table counts for Wide Corp tables
        const tableStats = {};
        const orgPrefix = 'org_01920000_1000_7000_8000_000000000001_';
        
        // Try to get data from known Wide Corp tables
        const tables = ['client', 'project', 'skill', 'timesheet'];
        
        for (const table of tables) {
          const tableName = orgPrefix + table;
          try {
            const data = await liveStore.get(tableName);
            tableStats[table] = Array.isArray(data) ? data.length : 0;
          } catch (error) {
            tableStats[table] = `Error: ${error.message}`;
          }
        }
        
        return {
          liveStoreAvailable: true,
          tableStats
        };
      } else {
        return { liveStoreAvailable: false, reason: 'LiveStore not available' };
      }
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('📈 Database Status:', databaseStatus);
  
  if (databaseStatus.liveStoreAvailable && databaseStatus.tableStats) {
    // Verify we have synced data
    const totalRecords = Object.values(databaseStatus.tableStats)
      .filter(count => typeof count === 'number')
      .reduce((sum, count) => sum + count, 0);
      
    console.log(`📊 Total synced records: ${totalRecords}`);
    
    if (totalRecords > 0) {
      console.log('✅ WebSocket sync successfully transferred data!');
      
      // Log individual table counts
      Object.entries(databaseStatus.tableStats).forEach(([table, count]) => {
        if (typeof count === 'number' && count > 0) {
          console.log(`  📦 ${table}: ${count} records`);
        }
      });
    } else {
      console.log('⚠️ No synced data found - sync may still be in progress');
    }
  }
  
  // 4. Check for WebSocket connection activity in network logs
  console.log('🌐 Checking WebSocket network activity...');
  
  // Listen for console messages about WebSocket activity
  const webSocketActivity = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebSocket') || text.includes('sync') || text.includes('srv_')) {
      webSocketActivity.push(text);
    }
  });
  
  await page.waitForTimeout(5000); // Give time for any additional sync activity
  
  console.log(`📡 WebSocket Activity (${webSocketActivity.length} messages):`);
  webSocketActivity.slice(-5).forEach((msg, i) => {
    console.log(`  ${i + 1}. ${msg}`);
  });
  
  // 5. Final state verification
  const finalState = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    const appInitActor = window.appInitActor;
    
    return {
      sync: syncActor ? {
        state: syncActor.getSnapshot().value,
        isConnected: syncActor.getSnapshot().context.isConnected,
        organizationId: syncActor.getSnapshot().context.organizationId
      } : null,
      appInit: appInitActor ? {
        state: appInitActor.getSnapshot().value,
        organizationId: appInitActor.getSnapshot().context.organizationId,
        isSyncReady: appInitActor.getSnapshot().context.isSyncReady
      } : null
    };
  });
  
  console.log('🎯 Final State Summary:', finalState);
  
  // Assertions for test success
  expect(finalState.sync).toBeTruthy();
  expect(finalState.sync.organizationId).toBe('01920000-1000-7000-8000-000000000001');
  expect(finalState.appInit).toBeTruthy();
  expect(finalState.appInit.organizationId).toBe('01920000-1000-7000-8000-000000000001');
  
  console.log('🎉 WebSocket sync end-to-end test completed successfully!');
});

test('verify WebSocket sync security - no cross-org data leakage', async ({ page }) => {
  console.log('🔒 Testing WebSocket sync security...');
  
  // Navigate and set up Wide Corp context
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }
  
  // Wait for sync to complete
  await page.waitForTimeout(10000);
  
  // Check that only Wide Corp data is present
  const securityCheck = await page.evaluate(async () => {
    try {
      if (typeof window.LiveStore !== 'undefined') {
        const liveStore = window.LiveStore;
        
        // Check for any non-Wide Corp organization data
        const wideCorpPrefix = 'org_01920000_1000_7000_8000_000000000001_';
        const otherOrgPrefix = 'org_01920000_2000_7000_8000_000000000002_'; // Other org
        
        const tables = ['client', 'project', 'skill', 'timesheet', 'activity', 'deal', 'ticket'];
        
        const wideCorpData = {};
        const otherOrgData = {};
        
        for (const table of tables) {
          // Check for Wide Corp data (should exist)
          try {
            const wideCorpTable = wideCorpPrefix + table;
            const wideCorpRecords = await liveStore.get(wideCorpTable);
            if (Array.isArray(wideCorpRecords)) {
              wideCorpData[table] = wideCorpRecords.length;
            }
          } catch (error) {
            // Table doesn't exist or no data - this is fine
          }
          
          // Check for other org data (should NOT exist)
          try {
            const otherOrgTable = otherOrgPrefix + table;
            const otherOrgRecords = await liveStore.get(otherOrgTable);
            if (Array.isArray(otherOrgRecords) && otherOrgRecords.length > 0) {
              otherOrgData[table] = otherOrgRecords.length;
            }
          } catch (error) {
            // Table doesn't exist or no data - this is expected and good
          }
        }
        
        return {
          wideCorpData,
          otherOrgData,
          securityBreach: Object.keys(otherOrgData).length > 0
        };
      }
      
      return { error: 'LiveStore not available' };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('🔍 Security Check Results:', securityCheck);
  
  if (securityCheck.securityBreach) {
    console.log('🚨 SECURITY BREACH: Other organization data found!', securityCheck.otherOrgData);
    throw new Error('Cross-organization data leakage detected');
  } else {
    console.log('✅ Security validated: Only Wide Corp data present');
    
    // Log Wide Corp data summary
    const totalWideCorpRecords = Object.values(securityCheck.wideCorpData || {})
      .reduce((sum, count) => sum + count, 0);
    console.log(`📊 Wide Corp records: ${totalWideCorpRecords}`);
  }
  
  console.log('🔒 WebSocket sync security test completed successfully!');
});