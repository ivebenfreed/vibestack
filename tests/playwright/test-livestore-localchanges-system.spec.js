/**
 * Test LiveStore LocalChanges System
 * 
 * Verify what LocalChanges implementation is available and working
 */

import { test, expect } from '@playwright/test';

test('LiveStore LocalChanges system check', async ({ page }) => {
  console.log('🔍 Testing LiveStore LocalChanges system...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('LocalChanges') || 
        text.includes('LiveStore') ||
        text.includes('sync') ||
        text.includes('Wide Corp')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Quick auth and navigate to debug page
  console.log('🔐 Quick setup...');
  await page.goto('http://localhost:5173/sign-in');
  
  await page.evaluate(() => {
    localStorage.removeItem('vibestack-last-organization-id');
    localStorage.removeItem('auth-machine-state');
  });
  
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  // Wait for org selection
  let orgSelected = false;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const hasOrgSelection = await page.locator('text=Wide Corp Solutions').isVisible().catch(() => false);
    if (hasOrgSelection) {
      await page.locator('text=Wide Corp Solutions').click();
      orgSelected = true;
      break;
    }
  }
  
  if (orgSelected) {
    console.log('✅ Organization selected');
    await page.waitForTimeout(3000);
  }
  
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  // Test LocalChanges systems
  console.log('🧪 Testing LocalChanges implementations...');
  
  const localChangesAnalysis = await page.evaluate(async () => {
    const results = {
      timestamp: Date.now(),
      systems: {}
    };
    
    try {
      // Test 1: Check for old Dexie-based LocalChanges
      console.log('[BROWSER] Testing old Dexie LocalChanges...');
      if (window.db && window.db.localChanges) {
        results.systems.dexieLocalChanges = {
          available: true,
          type: 'dexie',
          count: await window.db.localChanges.count()
        };
        console.log('[BROWSER] ✅ Old Dexie LocalChanges available');
      } else if (window.db && window.db.local_changes) {
        results.systems.dexieLocalChanges = {
          available: true,
          type: 'dexie_underscore',
          count: await window.db.local_changes.count()
        };
        console.log('[BROWSER] ✅ Old Dexie local_changes available');
      } else {
        results.systems.dexieLocalChanges = {
          available: false,
          reason: 'No db.localChanges or db.local_changes'
        };
        console.log('[BROWSER] ❌ Old Dexie LocalChanges not available');
      }
      
      // Test 2: Check for LiveStore-based LocalChanges
      console.log('[BROWSER] Testing LiveStore LocalChanges...');
      if (window.liveStoreClient) {
        try {
          // Try to query a LocalChanges table in LiveStore
          const localChangesTableName = 'org_01920000_1000_7000_8000_000000000001_local_changes';
          
          // This might fail if table doesn't exist - that's okay
          try {
            const liveStoreLocalChanges = await window.liveStoreClient.query(
              `SELECT COUNT(*) as count FROM ${localChangesTableName}`
            );
            results.systems.liveStoreLocalChanges = {
              available: true,
              tableName: localChangesTableName,
              count: liveStoreLocalChanges[0]?.count || 0
            };
            console.log('[BROWSER] ✅ LiveStore LocalChanges table found');
          } catch (queryError) {
            // Check if we can create the table
            try {
              await window.liveStoreClient.execute(`
                CREATE TABLE IF NOT EXISTS ${localChangesTableName} (
                  id TEXT PRIMARY KEY,
                  table_name TEXT NOT NULL,
                  operation TEXT NOT NULL,
                  record_id TEXT NOT NULL,
                  data TEXT NOT NULL,
                  is_processed BOOLEAN DEFAULT FALSE,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
              `);
              console.log('[BROWSER] ✅ Created LiveStore LocalChanges table');
              
              const count = await window.liveStoreClient.query(
                `SELECT COUNT(*) as count FROM ${localChangesTableName}`
              );
              results.systems.liveStoreLocalChanges = {
                available: true,
                tableName: localChangesTableName,
                count: count[0]?.count || 0,
                created: true
              };
            } catch (createError) {
              results.systems.liveStoreLocalChanges = {
                available: false,
                reason: 'Cannot create LocalChanges table',
                error: createError.message
              };
              console.log('[BROWSER] ❌ Cannot create LiveStore LocalChanges table:', createError.message);
            }
          }
        } catch (error) {
          results.systems.liveStoreLocalChanges = {
            available: false,
            reason: 'LiveStore client error',
            error: error.message
          };
          console.log('[BROWSER] ❌ LiveStore LocalChanges error:', error.message);
        }
      } else {
        results.systems.liveStoreLocalChanges = {
          available: false,
          reason: 'No LiveStore client'
        };
        console.log('[BROWSER] ❌ No LiveStore client for LocalChanges');
      }
      
      // Test 3: Check for any LocalChanges-related functions
      console.log('[BROWSER] Checking LocalChanges functions...');
      const localChangesFunctions = [];
      
      if (window.trackOutgoingChange) {
        localChangesFunctions.push('trackOutgoingChange');
      }
      
      if (window.getAllChanges) {
        localChangesFunctions.push('getAllChanges');
      }
      
      if (window.getPendingChanges) {
        localChangesFunctions.push('getPendingChanges');
      }
      
      results.systems.localChangesFunctions = {
        available: localChangesFunctions.length > 0,
        functions: localChangesFunctions
      };
      
      console.log(`[BROWSER] LocalChanges functions: ${localChangesFunctions.join(', ')}`);
      
      // Test 4: Try to create a test LocalChanges record
      console.log('[BROWSER] Testing LocalChanges creation...');
      
      const testTimestamp = Date.now();
      const testRecord = {
        id: `test_localchange_${testTimestamp}`,
        table_name: 'org_01920000_1000_7000_8000_000000000001_clients',
        operation: 'INSERT',
        record_id: `test_client_${testTimestamp}`,
        data: JSON.stringify({
          id: `test_client_${testTimestamp}`,
          name: `Test Client ${testTimestamp}`,
          email: `test.${testTimestamp}@test.com`
        }),
        is_processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      let testResults = {};
      
      // Try LiveStore first
      if (results.systems.liveStoreLocalChanges?.available) {
        try {
          const tableName = results.systems.liveStoreLocalChanges.tableName;
          await window.liveStoreClient.insert(tableName, testRecord);
          console.log('[BROWSER] ✅ Successfully created LiveStore LocalChanges record');
          testResults.liveStore = { success: true, recordId: testRecord.id };
        } catch (error) {
          console.log('[BROWSER] ❌ Failed to create LiveStore LocalChanges record:', error.message);
          testResults.liveStore = { success: false, error: error.message };
        }
      }
      
      // Try Dexie as fallback
      if (results.systems.dexieLocalChanges?.available) {
        try {
          const table = window.db.localChanges || window.db.local_changes;
          await table.add(testRecord);
          console.log('[BROWSER] ✅ Successfully created Dexie LocalChanges record');
          testResults.dexie = { success: true, recordId: testRecord.id };
        } catch (error) {
          console.log('[BROWSER] ❌ Failed to create Dexie LocalChanges record:', error.message);
          testResults.dexie = { success: false, error: error.message };
        }
      }
      
      results.testCreation = testResults;
      
      console.log('[BROWSER] LocalChanges analysis complete');
      return results;
      
    } catch (error) {
      console.log('[BROWSER] LocalChanges analysis error:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  await page.screenshot({ path: 'livestore-localchanges-system.png' });
  
  // Analyze results
  console.log('\n=== LOCALCHANGES SYSTEM ANALYSIS ===');
  
  const systems = localChangesAnalysis.systems || {};
  
  console.log(`🗄️ Dexie LocalChanges: ${systems.dexieLocalChanges?.available ? '✅' : '❌'}`);
  if (systems.dexieLocalChanges?.available) {
    console.log(`   Type: ${systems.dexieLocalChanges.type}`);
    console.log(`   Count: ${systems.dexieLocalChanges.count}`);
  }
  
  console.log(`🔗 LiveStore LocalChanges: ${systems.liveStoreLocalChanges?.available ? '✅' : '❌'}`);
  if (systems.liveStoreLocalChanges?.available) {
    console.log(`   Table: ${systems.liveStoreLocalChanges.tableName}`);
    console.log(`   Count: ${systems.liveStoreLocalChanges.count}`);
    if (systems.liveStoreLocalChanges.created) {
      console.log(`   ✨ Created new table`);
    }
  } else if (systems.liveStoreLocalChanges?.reason) {
    console.log(`   Reason: ${systems.liveStoreLocalChanges.reason}`);
  }
  
  console.log(`🔧 LocalChanges Functions: ${systems.localChangesFunctions?.available ? '✅' : '❌'}`);
  if (systems.localChangesFunctions?.functions?.length > 0) {
    console.log(`   Functions: ${systems.localChangesFunctions.functions.join(', ')}`);
  }
  
  // Test creation results
  const testResults = localChangesAnalysis.testCreation || {};
  console.log('\n📝 LocalChanges Creation Test:');
  
  if (testResults.liveStore) {
    console.log(`   LiveStore: ${testResults.liveStore.success ? '✅' : '❌'}`);
    if (!testResults.liveStore.success) {
      console.log(`      Error: ${testResults.liveStore.error}`);
    }
  }
  
  if (testResults.dexie) {
    console.log(`   Dexie: ${testResults.dexie.success ? '✅' : '❌'}`);
    if (!testResults.dexie.success) {
      console.log(`      Error: ${testResults.dexie.error}`);
    }
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  
  const hasWorkingLiveStore = systems.liveStoreLocalChanges?.available && testResults.liveStore?.success;
  const hasWorkingDexie = systems.dexieLocalChanges?.available && testResults.dexie?.success;
  
  if (hasWorkingLiveStore) {
    console.log('🎉 RECOMMENDATION: Use LiveStore-based LocalChanges system');
    console.log('   ✅ LiveStore LocalChanges table is working');
    console.log('   ✅ Can create and store LocalChanges records');
    console.log('   🔧 Update sync bridge to use LiveStore LocalChanges');
  } else if (hasWorkingDexie) {
    console.log('⚠️ RECOMMENDATION: Fix DataForge imports to use Dexie LocalChanges');
    console.log('   ✅ Dexie LocalChanges table is working');
    console.log('   ❌ LiveStore LocalChanges not available');
    console.log('   🔧 Fix import paths in sync bridge');
  } else {
    console.log('❌ PROBLEM: No working LocalChanges system found');
    console.log('   🔧 Need to implement proper LocalChanges system');
    console.log('   🔧 Either fix DataForge imports or implement LiveStore LocalChanges');
  }
  
  console.log('========================================');
  
  // Test passes if we found at least one working system
  expect(hasWorkingLiveStore || hasWorkingDexie).toBe(true);
});