/**
 * Playwright Dashboard Test - Quick verification of dynamic entities
 */

const { chromium } = require('playwright');

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

async function testDynamicDashboard() {
  console.log('🚀 Starting Playwright dashboard test...');
  
  // Launch browser with existing profile using persistent context
  const context = await chromium.launchPersistentContext('./.playwright/profiles/profile-main', {
    headless: false
  });
  const page = await context.newPage();
  
  try {
    // Navigate to dashboard
    console.log('📍 Navigating to dashboard...');
    await page.goto('http://localhost:5173/#/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 10000 });
    console.log('✅ Dashboard loaded');
    
    // Check for entity cards or no entities message
    const entityCards = await page.$$('[data-testid="dashboard-content"] .grid > div');
    const noEntitiesMsg = await page.$('text="No entities found for this organization"');
    
    if (entityCards.length > 0) {
      console.log(`📊 Found ${entityCards.length} entity cards:`);
      
      for (let i = 0; i < entityCards.length; i++) {
        const card = entityCards[i];
        const title = await card.$eval('.text-sm.font-medium', el => el.textContent).catch(() => 'Unknown');
        const count = await card.$eval('.text-2xl.font-bold', el => el.textContent).catch(() => '0');
        const description = await card.$eval('.text-muted-foreground.text-xs', el => el.textContent).catch(() => 'No description');
        console.log(`   ${i + 1}. ${title}: ${count} (${description})`);
      }
    } else if (noEntitiesMsg) {
      console.log('📋 No entities message displayed - this is expected for new organizations');
    } else {
      console.log('⚠️ Dashboard loaded but no entity cards or message found');
    }
    
    // Test schema API directly
    console.log('\n🔍 Testing schema API...');
    const schemaResponse = await page.evaluate(async (orgId) => {
      try {
        const response = await fetch(`/api/archetype/orgs/${orgId}/schema`);
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: error.message };
      }
    }, WIDE_CORP_ORG_ID);
    
    if (schemaResponse.success && schemaResponse.schema) {
      const entities = Object.keys(schemaResponse.schema.entities);
      console.log(`✅ Schema API working: ${entities.length} entities`);
      entities.forEach(entity => {
        const tableName = schemaResponse.schema.entities[entity].tableName;
        console.log(`   - ${entity} (${tableName})`);
      });
    } else {
      console.log(`❌ Schema API failed:`, schemaResponse.error);
    }
    
    // Test LiveStore connectivity with debug info
    console.log('\n🔗 Testing LiveStore...');
    const liveStoreTest = await page.evaluate(async () => {
      console.log('[Test] Checking for LiveStore...');
      
      // Check auth state
      const authActor = window.authMachineActor;
      const appInitActor = window.appInitActor;
      
      const authInfo = authActor ? {
        state: authActor.getSnapshot().value,
        user: authActor.getSnapshot().context.user?.email || 'none',
        org: authActor.getSnapshot().context.currentOrganization?.name || 'none'
      } : 'not available';
      
      const appInitInfo = appInitActor ? {
        state: appInitActor.getSnapshot().value,
        isDatabaseInitialized: appInitActor.getSnapshot().context.isDatabaseInitialized,
        isLiveStoreReady: appInitActor.getSnapshot().context.isLiveStoreReady
      } : 'not available';
      
      console.log('[Test] Auth machine:', authInfo);
      console.log('[Test] App init machine:', appInitInfo);
      
      const liveStore = window.globalLiveStore || window.LiveStore;
      if (!liveStore) {
        console.log('[Test] LiveStore not available, triggering database check...');
        
        // Try to trigger LiveStore initialization
        window.dispatchEvent(new CustomEvent('database:check'));
        
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const liveStoreAfter = window.globalLiveStore || window.LiveStore;
        if (!liveStoreAfter) {
          return { 
            error: 'LiveStore not available after trigger',
            authInfo,
            appInitInfo
          };
        }
        
        // Use the LiveStore we found
        try {
          const tables = await liveStoreAfter.query("SELECT name FROM sqlite_master WHERE type='table'");
          return { 
            success: true, 
            tableCount: tables.length, 
            tables: tables.map(t => t.name),
            triggeredInit: true,
            authInfo,
            appInitInfo
          };
        } catch (error) {
          return { 
            error: error.message,
            triggeredInit: true,
            authInfo,
            appInitInfo
          };
        }
      }
      
      try {
        console.log('[Test] Using existing LiveStore...');
        const tables = await liveStore.query("SELECT name FROM sqlite_master WHERE type='table'");
        return { 
          success: true, 
          tableCount: tables.length, 
          tables: tables.map(t => t.name),
          authInfo,
          appInitInfo
        };
      } catch (error) {
        return { 
          error: error.message,
          authInfo,
          appInitInfo
        };
      }
    });
    
    if (liveStoreTest.success) {
      console.log(`✅ LiveStore connected: ${liveStoreTest.tableCount} tables`);
      const orgTables = liveStoreTest.tables.filter(name => name.includes('01920000'));
      console.log(`📋 Organization tables: ${orgTables.length}`);
      orgTables.slice(0, 5).forEach(table => console.log(`   - ${table}`));
      if (orgTables.length > 5) console.log(`   ... and ${orgTables.length - 5} more`);
    } else {
      console.log(`❌ LiveStore test failed:`, liveStoreTest.error);
    }
    
    console.log('\n🎯 Test completed successfully!');
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser kept open for manual inspection. Close manually when done.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't auto-close for now - keep for manual inspection
    // await context.close();
  }
}

// Run the test
testDynamicDashboard();