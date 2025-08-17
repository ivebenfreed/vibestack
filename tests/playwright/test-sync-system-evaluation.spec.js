/**
 * Complete Sync System Evaluation
 * 
 * Comprehensive assessment of the current sync architecture with:
 * - Dynamic schema system
 * - LiveStore implementation 
 * - Organization-scoped data
 * - Existing sync infrastructure
 */

import { test, expect } from '@playwright/test';

test('Complete sync system evaluation', async ({ page }) => {
  console.log('🔍 Evaluating complete sync system architecture...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('sync') || 
        text.includes('LiveStore') ||
        text.includes('schema') ||
        text.includes('LocalChanges') ||
        text.includes('Wide Corp')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Setup authentication and organization
  console.log('🔐 Setting up authenticated session...');
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
  await page.waitForTimeout(5000);
  
  // Comprehensive sync system evaluation
  console.log('🧪 Evaluating sync system components...');
  
  const syncEvaluation = await page.evaluate(async () => {
    const evaluation = {
      timestamp: Date.now(),
      organization: {
        id: '01920000-1000-7000-8000-000000000001',
        name: 'Wide Corp Solutions'
      },
      components: {}
    };
    
    try {
      console.log('[BROWSER] === SYNC SYSTEM EVALUATION ===');
      
      // 1. AUTHENTICATION & ORGANIZATION
      console.log('[BROWSER] 1. Authentication & Organization State');
      const authState = localStorage.getItem('auth-machine-state');
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      
      evaluation.components.authentication = {
        hasAuthState: !!authState,
        authValue: authState ? JSON.parse(authState).value : null,
        organizationPersisted: !!orgId,
        organizationId: orgId
      };
      
      console.log(`[BROWSER]    Auth State: ${evaluation.components.authentication.authValue}`);
      console.log(`[BROWSER]    Organization: ${evaluation.components.authentication.organizationId}`);
      
      // 2. DYNAMIC SCHEMA SYSTEM
      console.log('[BROWSER] 2. Dynamic Schema System');
      
      // Check for schema client
      const hasSchemaClient = !!window.schemaClient;
      const hasOrgSchema = !!window.orgSchema;
      
      evaluation.components.dynamicSchema = {
        schemaClientAvailable: hasSchemaClient,
        orgSchemaAvailable: hasOrgSchema,
        schemaDetails: hasOrgSchema ? {
          entities: Object.keys(window.orgSchema?.entities || {}),
          orgId: window.orgSchema?.orgId
        } : null
      };
      
      console.log(`[BROWSER]    Schema Client: ${hasSchemaClient ? '✅' : '❌'}`);
      console.log(`[BROWSER]    Org Schema: ${hasOrgSchema ? '✅' : '❌'}`);
      if (hasOrgSchema) {
        console.log(`[BROWSER]    Entities: ${evaluation.components.dynamicSchema.schemaDetails.entities.join(', ')}`);
      }
      
      // 3. LIVESTORE SYSTEM
      console.log('[BROWSER] 3. LiveStore System');
      
      const hasLiveStoreClient = !!window.liveStoreClient;
      const hasLiveStoreTest = !!window.testLiveStoreInBrowser;
      
      evaluation.components.liveStore = {
        clientAvailable: hasLiveStoreClient,
        testFunctionAvailable: hasLiveStoreTest,
        clientMethods: hasLiveStoreClient ? Object.keys(window.liveStoreClient) : []
      };
      
      console.log(`[BROWSER]    Client Available: ${hasLiveStoreClient ? '✅' : '❌'}`);
      console.log(`[BROWSER]    Test Function: ${hasLiveStoreTest ? '✅' : '❌'}`);
      
      if (hasLiveStoreClient) {
        console.log(`[BROWSER]    Client Methods: ${evaluation.components.liveStore.clientMethods.join(', ')}`);
      }
      
      // 4. LEGACY DEXIE SYSTEM
      console.log('[BROWSER] 4. Legacy Dexie System');
      
      const hasDexieDb = !!window.db;
      const hasDexieLocalChanges = !!(window.db && window.db.local_changes);
      
      evaluation.components.dexie = {
        dbAvailable: hasDexieDb,
        localChangesAvailable: hasDexieLocalChanges,
        dbTables: hasDexieDb ? Object.keys(window.db) : []
      };
      
      console.log(`[BROWSER]    Dexie DB: ${hasDexieDb ? '✅' : '❌'}`);
      console.log(`[BROWSER]    LocalChanges: ${hasDexieLocalChanges ? '✅' : '❌'}`);
      
      if (hasDexieDb) {
        console.log(`[BROWSER]    Tables: ${evaluation.components.dexie.dbTables.join(', ')}`);
      }
      
      // 5. SYNC INFRASTRUCTURE
      console.log('[BROWSER] 5. Sync Infrastructure');
      
      const hasSyncHelpers = !!window.testSyncHelpers;
      const hasXStateInspector = !!window.xstateTestInspector;
      const hasDexieOutgoing = !!window.DexieOutgoingChangeService;
      
      evaluation.components.syncInfrastructure = {
        syncHelpersAvailable: hasSyncHelpers,
        xstateInspectorAvailable: hasXStateInspector,
        dexieOutgoingAvailable: hasDexieOutgoing,
        syncHelperMethods: hasSyncHelpers ? Object.keys(window.testSyncHelpers) : []
      };
      
      console.log(`[BROWSER]    Sync Helpers: ${hasSyncHelpers ? '✅' : '❌'}`);
      console.log(`[BROWSER]    XState Inspector: ${hasXStateInspector ? '✅' : '❌'}`);
      console.log(`[BROWSER]    Dexie Outgoing: ${hasDexieOutgoing ? '✅' : '❌'}`);
      
      // 6. ORGANIZATION DATA MODEL
      console.log('[BROWSER] 6. Organization Data Model');
      
      // Expected organization-scoped tables
      const expectedTables = [
        'org_01920000_1000_7000_8000_000000000001_clients',
        'org_01920000_1000_7000_8000_000000000001_projects', 
        'org_01920000_1000_7000_8000_000000000001_timesheets',
        'org_01920000_1000_7000_8000_000000000001_skills'
      ];
      
      evaluation.components.dataModel = {
        expectedTables,
        tableAccessibility: {}
      };
      
      // Test if we can access organization data
      for (const table of expectedTables) {
        try {
          if (hasLiveStoreClient) {
            // Try LiveStore access
            const result = await window.liveStoreClient.query(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
            evaluation.components.dataModel.tableAccessibility[table] = {
              accessible: true,
              method: 'LiveStore',
              count: result[0]?.count || 0
            };
          } else {
            evaluation.components.dataModel.tableAccessibility[table] = {
              accessible: false,
              reason: 'No LiveStore client'
            };
          }
        } catch (error) {
          evaluation.components.dataModel.tableAccessibility[table] = {
            accessible: false,
            error: error.message
          };
        }
      }
      
      // 7. LOCAL CHANGES SYSTEMS
      console.log('[BROWSER] 7. LocalChanges Systems');
      
      evaluation.components.localChanges = {
        systems: {}
      };
      
      // Test Dexie LocalChanges
      if (hasDexieLocalChanges) {
        try {
          const dexieCount = await window.db.local_changes.count();
          evaluation.components.localChanges.systems.dexie = {
            available: true,
            count: dexieCount
          };
          console.log(`[BROWSER]    Dexie LocalChanges: ${dexieCount} records`);
        } catch (error) {
          evaluation.components.localChanges.systems.dexie = {
            available: false,
            error: error.message
          };
        }
      }
      
      // Test LiveStore LocalChanges
      if (hasLiveStoreClient) {
        try {
          const liveStoreCount = await window.liveStoreClient.query(
            'SELECT COUNT(*) as count FROM org_01920000_1000_7000_8000_000000000001_local_changes'
          );
          evaluation.components.localChanges.systems.liveStore = {
            available: true,
            count: liveStoreCount[0]?.count || 0
          };
          console.log(`[BROWSER]    LiveStore LocalChanges: ${liveStoreCount[0]?.count || 0} records`);
        } catch (error) {
          evaluation.components.localChanges.systems.liveStore = {
            available: false,
            error: error.message
          };
        }
      }
      
      console.log('[BROWSER] === EVALUATION COMPLETE ===');
      return evaluation;
      
    } catch (error) {
      console.log('[BROWSER] Evaluation error:', error.message);
      evaluation.error = error.message;
      return evaluation;
    }
  });
  
  await page.screenshot({ path: 'sync-system-evaluation.png' });
  
  // Analyze and report findings
  console.log('\n' + '='.repeat(60));
  console.log('🔍 COMPLETE SYNC SYSTEM EVALUATION REPORT');
  console.log('='.repeat(60));
  
  const components = syncEvaluation.components || {};
  
  // 1. Authentication & Organization
  console.log('\n📋 1. AUTHENTICATION & ORGANIZATION');
  const auth = components.authentication || {};
  console.log(`   Auth State: ${auth.hasAuthState ? '✅' : '❌'} (${auth.authValue || 'unknown'})`);
  console.log(`   Organization: ${auth.organizationPersisted ? '✅' : '❌'} (${auth.organizationId || 'none'})`);
  
  // 2. Schema System
  console.log('\n🗂️ 2. DYNAMIC SCHEMA SYSTEM');
  const schema = components.dynamicSchema || {};
  console.log(`   Schema Client: ${schema.schemaClientAvailable ? '✅' : '❌'}`);
  console.log(`   Org Schema: ${schema.orgSchemaAvailable ? '✅' : '❌'}`);
  if (schema.schemaDetails) {
    console.log(`   Entities: ${schema.schemaDetails.entities.join(', ')}`);
  }
  
  // 3. Storage Systems
  console.log('\n🗄️ 3. STORAGE SYSTEMS');
  const liveStore = components.liveStore || {};
  const dexie = components.dexie || {};
  
  console.log(`   LiveStore Client: ${liveStore.clientAvailable ? '✅' : '❌'}`);
  if (liveStore.clientMethods?.length > 0) {
    console.log(`   LiveStore Methods: ${liveStore.clientMethods.join(', ')}`);
  }
  
  console.log(`   Dexie Database: ${dexie.dbAvailable ? '✅' : '❌'}`);
  console.log(`   Dexie LocalChanges: ${dexie.localChangesAvailable ? '✅' : '❌'}`);
  
  // 4. Data Model
  console.log('\n📊 4. ORGANIZATION DATA MODEL');
  const dataModel = components.dataModel || {};
  if (dataModel.tableAccessibility) {
    for (const [table, access] of Object.entries(dataModel.tableAccessibility)) {
      const tableName = table.split('_').pop();
      if (access.accessible) {
        console.log(`   ${tableName}: ✅ (${access.count} records via ${access.method})`);
      } else {
        console.log(`   ${tableName}: ❌ (${access.reason || access.error})`);
      }
    }
  }
  
  // 5. LocalChanges Analysis
  console.log('\n📝 5. LOCALCHANGES SYSTEMS');
  const localChanges = components.localChanges?.systems || {};
  
  if (localChanges.dexie) {
    console.log(`   Dexie LocalChanges: ${localChanges.dexie.available ? '✅' : '❌'}`);
    if (localChanges.dexie.available) {
      console.log(`      Records: ${localChanges.dexie.count}`);
    }
  }
  
  if (localChanges.liveStore) {
    console.log(`   LiveStore LocalChanges: ${localChanges.liveStore.available ? '✅' : '❌'}`);
    if (localChanges.liveStore.available) {
      console.log(`      Records: ${localChanges.liveStore.count}`);
    }
  }
  
  // 6. Sync Infrastructure
  console.log('\n🔄 6. SYNC INFRASTRUCTURE');
  const sync = components.syncInfrastructure || {};
  console.log(`   Sync Helpers: ${sync.syncHelpersAvailable ? '✅' : '❌'}`);
  console.log(`   XState Inspector: ${sync.xstateInspectorAvailable ? '✅' : '❌'}`);
  console.log(`   Dexie Outgoing Service: ${sync.dexieOutgoingAvailable ? '✅' : '❌'}`);
  
  // RECOMMENDATIONS
  console.log('\n' + '='.repeat(60));
  console.log('💡 STRATEGIC RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  const hasWorkingLiveStore = liveStore.clientAvailable;
  const hasWorkingDexie = dexie.dbAvailable && dexie.localChangesAvailable;
  const hasOrgData = Object.values(dataModel.tableAccessibility || {}).some(access => access.accessible);
  
  console.log('\n🎯 MIGRATION STRATEGY:');
  
  if (hasWorkingLiveStore && hasOrgData) {
    console.log('✅ RECOMMENDED: Complete LiveStore migration');
    console.log('   • LiveStore client is working');
    console.log('   • Organization data is accessible');
    console.log('   • Create LiveStore LocalChanges system');
    console.log('   • Update sync bridge to use LiveStore');
    console.log('   • Disable Dexie completely');
  } else if (hasWorkingDexie && !hasWorkingLiveStore) {
    console.log('⚠️ FALLBACK: Continue with Dexie for now');
    console.log('   • Dexie LocalChanges is working');
    console.log('   • Fix LiveStore issues first');
    console.log('   • Migrate incrementally');
  } else if (hasWorkingLiveStore && !hasOrgData) {
    console.log('🔧 PRIORITY: Fix data model access');
    console.log('   • LiveStore client works but data access fails');
    console.log('   • Check schema compatibility');
    console.log('   • Verify table creation');
  } else {
    console.log('❌ BLOCKED: Major issues need resolution');
    console.log('   • Neither system is fully functional');
    console.log('   • Focus on basic connectivity first');
  }
  
  console.log('\n🛠️ IMMEDIATE ACTIONS:');
  
  if (!auth.hasAuthState || !auth.organizationPersisted) {
    console.log('1. Fix authentication and organization persistence');
  }
  
  if (!hasWorkingLiveStore) {
    console.log('2. Debug LiveStore client initialization');
  }
  
  if (!hasOrgData) {
    console.log('3. Fix organization data model access');
  }
  
  if (!localChanges.liveStore?.available && hasWorkingLiveStore) {
    console.log('4. Implement LiveStore LocalChanges system');
  }
  
  if (hasWorkingLiveStore && localChanges.liveStore?.available) {
    console.log('5. Ready to disable Dexie and complete migration!');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Test passes if we have basic authentication working
  expect(auth.hasAuthState).toBe(true);
});