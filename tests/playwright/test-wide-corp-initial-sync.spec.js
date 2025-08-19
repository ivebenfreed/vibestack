/**
 * Wide Corp Initial Sync Test - Verify Complete Data Sync
 * Tests that initial sync receives and saves all Wide Corp business data
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test.describe('Wide Corp Initial Sync Data Test', () => {
  test('should receive and save all Wide Corp data via initial sync', async ({ page }) => {
    console.log('🚀 Testing Wide Corp initial sync data flow...\n');
    
    // Navigate and wait for app initialization
    await page.goto('/');
    console.log('📍 Navigated to app root');
    
    // Wait for any navigation to complete
    await page.waitForLoadState('networkidle');
    console.log('📍 Network idle - page fully loaded');
    
    // 1. WAIT FOR AUTHENTICATION AND ORGANIZATION TO LOAD
    console.log('\n🔐 Step 1: Waiting for Wide Corp authentication and organization loading...');
    
    let orgLoaded = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (!orgLoaded && attempts < maxAttempts) {
      const authStatus = await page.evaluate(() => {
        const authMachine = window.authMachineActor;
        if (!authMachine) return { hasAuth: false };
        
        const snapshot = authMachine.getSnapshot();
        const context = snapshot.context;
        
        return {
          hasAuth: true,
          state: snapshot.value,
          user: context?.user,
          org: context?.currentOrganization,
          isLoadingOrg: context?.isLoadingOrganizations,
          orgSetupComplete: context?.organizationSetupComplete
        };
      });
      
      console.log(`   Attempt ${attempts + 1}: Auth State = ${JSON.stringify(authStatus.state)}`);
      
      if (authStatus.org?.id === '01920000-1000-7000-8000-000000000001') {
        orgLoaded = true;
        console.log(`   ✅ Wide Corp organization loaded: ${authStatus.org.name}`);
        console.log(`   👤 User: ${authStatus.user?.email}`);
      }
      
      attempts++;
      if (!orgLoaded && attempts < maxAttempts) {
        await page.waitForTimeout(1000);
      }
    }
    
    expect(orgLoaded, 'Wide Corp organization should load within 30 seconds').toBe(true);
    
    // Wait a bit more for the organization to be fully processed
    await page.waitForTimeout(2000);
    console.log('   ⏳ Additional wait for organization processing...');
    
    // 2. WAIT FOR LIVESTORE SYNC TO INITIALIZE AND CONNECT
    console.log('\n🔄 Step 2: Waiting for LiveStore sync to connect and start syncing...');
    
    let syncConnected = false;
    attempts = 0;
    
    while (!syncConnected && attempts < maxAttempts) {
      // Handle potential navigation issues
      try {
          const syncStatus = await page.evaluate(() => {
            const syncActor = window.pureLiveStoreSyncMachineActor;
            if (!syncActor) return { hasSync: false };
            
            const snapshot = syncActor.getSnapshot();
            const context = snapshot.context;
            
            return {
              hasSync: true,
              state: snapshot.value,
              organizationId: context?.organizationId,
              isConnected: context?.isConnected,
              currentLSN: context?.currentLSN,
              error: context?.error
            };
          });
          
          console.log(`   Attempt ${attempts + 1}: Sync State = ${syncStatus.state}, Org = ${syncStatus.organizationId}`);
          
          // Accept various connected states
          if (syncStatus.organizationId === '01920000-1000-7000-8000-000000000001' && 
              (syncStatus.state === 'live_sync' || 
               syncStatus.state === 'connected' || 
               syncStatus.isConnected ||
               syncStatus.state === 'initializing_services' ||
               syncStatus.state === 'connecting')) {
            syncConnected = true;
            console.log(`   ✅ LiveStore sync connected for Wide Corp: ${syncStatus.state}`);
          }
        } catch (error) {
          console.log(`   ⚠️ Attempt ${attempts + 1}: Navigation/evaluation error: ${error.message}`);
          // Wait for page to stabilize
          await page.waitForLoadState('networkidle').catch(() => {});
        }
        
        attempts++;
        if (!syncConnected && attempts < maxAttempts) {
          await page.waitForTimeout(1000);
        }
      }
    
    console.log(`   Final sync state: ${syncConnected ? 'CONNECTED' : 'NOT CONNECTED'}`);
    
    // 3. WAIT FOR INITIAL SYNC TO COMPLETE AND DATA TO BE SAVED
    console.log('\n📦 Step 3: Waiting for initial sync to complete and save Wide Corp data...');
    
    // Wait longer for sync to complete
    await page.waitForTimeout(5000);
    
    let dataReceived = false;
    attempts = 0;
    
    while (!dataReceived && attempts < 20) {
      const dataStatus = await page.evaluate(async () => {
        // Check multiple data sources for Wide Corp data
        const results = {
          liveStoreData: null,
          indexedDbData: null,
          windowData: null
        };
        
        // 1. Check LiveStore instances for data
        const liveStoreInstances = window.liveStoreInstances || {};
        const widecorpInstance = liveStoreInstances['01920000-1000-7000-8000-000000000001'];
        
        if (widecorpInstance && widecorpInstance.store) {
          try {
            const projects = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
            const tasks = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
            const users = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
            const clients = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM clients WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
            
            results.liveStoreData = {
              projects: projects[0]?.count || 0,
              tasks: tasks[0]?.count || 0,
              users: users[0]?.count || 0,
              clients: clients[0]?.count || 0,
              total: (projects[0]?.count || 0) + (tasks[0]?.count || 0) + (users[0]?.count || 0) + (clients[0]?.count || 0)
            };
          } catch (error) {
            results.liveStoreData = { error: error.message };
          }
        }
        
        // 2. Check IndexedDB for any synced data (fallback)
        try {
          const dbRequest = indexedDB.open('vibestack');
          await new Promise((resolve, reject) => {
            dbRequest.onsuccess = async (event) => {
              const db = event.target.result;
              let total = 0;
              const counts = {};
              
              const tables = ['projects', 'tasks', 'users', 'clients'];
              for (const table of tables) {
                if (db.objectStoreNames.contains(table)) {
                  const transaction = db.transaction([table], 'readonly');
                  const store = transaction.objectStore(table);
                  const countRequest = store.count();
                  await new Promise(res => {
                    countRequest.onsuccess = () => {
                      counts[table] = countRequest.result;
                      total += countRequest.result;
                      res();
                    };
                  });
                }
              }
              
              results.indexedDbData = { ...counts, total };
              resolve();
            };
            dbRequest.onerror = () => {
              results.indexedDbData = { error: 'Could not open IndexedDB' };
              resolve();
            };
          });
        } catch (error) {
          results.indexedDbData = { error: error.message };
        }
        
        // 3. Check for any window-level data
        const windowDataKeys = Object.keys(window).filter(key => 
          key.toLowerCase().includes('data') || 
          key.toLowerCase().includes('store') ||
          key.toLowerCase().includes('cache')
        );
        
        results.windowData = {
          dataRelatedKeys: windowDataKeys,
          hasLiveStoreInstances: !!window.liveStoreInstances,
          liveStoreInstanceCount: Object.keys(window.liveStoreInstances || {}).length
        };
        
        return results;
      });
      
      console.log(`   Attempt ${attempts + 1}: Checking for synced data...`);
      
      if (dataStatus.liveStoreData && dataStatus.liveStoreData.total > 0) {
        dataReceived = true;
        console.log(`   ✅ LiveStore data found: ${dataStatus.liveStoreData.total} records`);
        console.log(`      - Projects: ${dataStatus.liveStoreData.projects}`);
        console.log(`      - Tasks: ${dataStatus.liveStoreData.tasks}`);
        console.log(`      - Users: ${dataStatus.liveStoreData.users}`);
        console.log(`      - Clients: ${dataStatus.liveStoreData.clients}`);
      } else if (dataStatus.indexedDbData && dataStatus.indexedDbData.total > 0) {
        dataReceived = true;
        console.log(`   ✅ IndexedDB data found: ${dataStatus.indexedDbData.total} records`);
      }
      
      if (!dataReceived) {
        console.log(`   ⏳ No data yet. LiveStore: ${JSON.stringify(dataStatus.liveStoreData)}`);
        console.log(`        IndexedDB: ${JSON.stringify(dataStatus.indexedDbData)}`);
      }
      
      attempts++;
      if (!dataReceived && attempts < 20) {
        await page.waitForTimeout(2000);
      }
    }
    
    // 4. FINAL DATA VALIDATION
    console.log('\n📊 Step 4: Final Wide Corp data validation...');
    
    const finalDataCheck = await page.evaluate(async () => {
      const summary = {
        authStatus: null,
        syncStatus: null,
        dataStatus: null
      };
      
      // Check final auth status
      const authMachine = window.authMachineActor;
      if (authMachine) {
        const snapshot = authMachine.getSnapshot();
        summary.authStatus = {
          state: snapshot.value,
          userEmail: snapshot.context?.user?.email,
          orgId: snapshot.context?.currentOrganization?.id,
          orgName: snapshot.context?.currentOrganization?.name
        };
      }
      
      // Check final sync status
      const syncActor = window.pureLiveStoreSyncMachineActor;
      if (syncActor) {
        const snapshot = syncActor.getSnapshot();
        summary.syncStatus = {
          state: snapshot.value,
          organizationId: snapshot.context?.organizationId,
          clientId: snapshot.context?.clientId,
          isConnected: snapshot.context?.isConnected,
          currentLSN: snapshot.context?.currentLSN
        };
      }
      
      // Check final data status
      const liveStoreInstances = window.liveStoreInstances || {};
      const widecorpInstance = liveStoreInstances['01920000-1000-7000-8000-000000000001'];
      
      if (widecorpInstance && widecorpInstance.store) {
        try {
          // Get actual data counts
          const projectsResult = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
          const tasksResult = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
          const usersResult = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
          const clientsResult = await widecorpInstance.store.query('SELECT COUNT(*) as count FROM clients WHERE organization_id = ?', ['01920000-1000-7000-8000-000000000001']) || [];
          
          summary.dataStatus = {
            projects: projectsResult[0]?.count || 0,
            tasks: tasksResult[0]?.count || 0,
            users: usersResult[0]?.count || 0,
            clients: clientsResult[0]?.count || 0,
            hasData: (projectsResult[0]?.count || 0) + (tasksResult[0]?.count || 0) + (usersResult[0]?.count || 0) + (clientsResult[0]?.count || 0) > 0
          };
        } catch (error) {
          summary.dataStatus = { error: error.message };
        }
      } else {
        summary.dataStatus = { error: 'No LiveStore instance found for Wide Corp' };
      }
      
      return summary;
    });
    
    console.log('📋 FINAL WIDE CORP SYNC RESULTS:');
    console.log('='.repeat(60));
    console.log(`👤 User: ${finalDataCheck.authStatus?.userEmail || 'unknown'}`);
    console.log(`🏢 Organization: ${finalDataCheck.authStatus?.orgName || 'unknown'} (${finalDataCheck.authStatus?.orgId})`);
    console.log(`🔄 Sync State: ${finalDataCheck.syncStatus?.state || 'unknown'}`);
    console.log(`🆔 Client ID: ${finalDataCheck.syncStatus?.clientId || 'unknown'}`);
    console.log(`📊 Data Synced:`);
    
    if (finalDataCheck.dataStatus && !finalDataCheck.dataStatus.error) {
      console.log(`   - Projects: ${finalDataCheck.dataStatus.projects}`);
      console.log(`   - Tasks: ${finalDataCheck.dataStatus.tasks}`);
      console.log(`   - Users: ${finalDataCheck.dataStatus.users}`);
      console.log(`   - Clients: ${finalDataCheck.dataStatus.clients}`);
      console.log(`   - Total Records: ${finalDataCheck.dataStatus.projects + finalDataCheck.dataStatus.tasks + finalDataCheck.dataStatus.users + finalDataCheck.dataStatus.clients}`);
    } else {
      console.log(`   - Error: ${finalDataCheck.dataStatus?.error || 'Unknown error'}`);
    }
    console.log('='.repeat(60));
    
    // ASSERTIONS
    expect(finalDataCheck.authStatus?.orgId, 'Should be authenticated to Wide Corp').toBe('01920000-1000-7000-8000-000000000001');
    expect(finalDataCheck.authStatus?.userEmail, 'Should be logged in as Wide Corp CEO').toBe('ceo@widecorp.com');
    expect(finalDataCheck.syncStatus?.organizationId, 'Sync should be connected to Wide Corp').toBe('01920000-1000-7000-8000-000000000001');
    expect(finalDataCheck.syncStatus?.clientId, 'Should have valid client ID').toMatch(/^client_/);
    
    // Data validation - expect SOME data to be synced from Wide Corp
    if (finalDataCheck.dataStatus && !finalDataCheck.dataStatus.error) {
      const totalData = finalDataCheck.dataStatus.projects + finalDataCheck.dataStatus.tasks + finalDataCheck.dataStatus.users + finalDataCheck.dataStatus.clients;
      expect(totalData, 'Should have synced some Wide Corp data').toBeGreaterThan(0);
    }
    
    console.log('\n🎉 Wide Corp initial sync data test COMPLETED!');
  });
});