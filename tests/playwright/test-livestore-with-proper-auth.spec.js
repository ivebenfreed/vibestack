/**
 * LiveStore Test with Proper Authentication
 */

import { test, expect } from '@playwright/test'; // Use fresh context

test('LiveStore with proper Wide Corp authentication', async ({ page }) => {
  console.log('🧪 Testing LiveStore with proper authentication...');
  
  // Navigate to the app
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Login with Wide Corp CEO credentials
  console.log('🔐 Logging in with Wide Corp CEO credentials...');
  await page.locator('input[type="email"]').fill('ceo@widecorp.com');
  await page.locator('input[type="password"]').fill('WideCorp2024!CEO');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  
  // Select Wide Corp Solutions organization
  const needsOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 5000 });
  if (needsOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }

  // Wait for sync machine to potentially start
  console.log('⏳ Waiting for sync machine to initialize...');
  await page.waitForTimeout(5000);

  // Check sync state
  const syncState = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      return {
        state: snapshot.value,
        organizationId: snapshot.context.organizationId,
        isConnected: snapshot.context.isConnected,
        clientId: snapshot.context.clientId
      };
    }
    return { available: false };
  });

  console.log('🔄 Sync machine state:', syncState);

  // Now test LiveStore with proper authentication
  const liveStoreTest = await page.evaluate(async () => {
    try {
      console.log('📦 Testing LiveStore with authenticated session...');
      
      // Import LiveStore schema client
      const { liveStoreSchemaClient } = await import('./src/lib/livestore-schema-client.js');
      
      if (!liveStoreSchemaClient) {
        return { success: false, error: 'liveStoreSchemaClient not found' };
      }
      
      console.log('✅ LiveStore schema client imported');
      
      // Use Wide Corp organization ID from CLAUDE.md
      const orgId = '01920000-1000-7000-8000-000000000001';
      const clientId = 'test-auth-client';
      
      console.log('📋 Loading LiveStore schema for Wide Corp...');
      const schemaResult = await liveStoreSchemaClient.loadLiveStoreSchema(orgId);
      
      console.log('📋 Schema result:', schemaResult);
      
      if (!schemaResult.success) {
        return { 
          success: false, 
          error: `Schema loading failed: ${schemaResult.error}`,
          schemaResult: schemaResult
        };
      }
      
      console.log('✅ LiveStore schema loaded successfully');
      console.log('📊 Schema details:', {
        cached: schemaResult.cached,
        hasSchema: !!schemaResult.schema,
        hasEvents: !!schemaResult.events
      });
      
      // Test LiveStore instance creation
      console.log('🚀 Creating LiveStore instance for Wide Corp...');
      const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(orgId, clientId);
      
      if (!liveStoreInstance) {
        return { success: false, error: 'LiveStore instance creation returned null' };
      }
      
      console.log('✅ LiveStore instance created successfully');
      
      // Test basic functionality
      await liveStoreInstance.ready();
      console.log('✅ LiveStore ready');
      
      const tables = await liveStoreInstance.query("SELECT name FROM sqlite_master WHERE type='table'");
      console.log(`✅ LiveStore query successful - found ${tables.length} tables`);
      
      // Get some table data for verification
      let recordCounts = {};
      for (const table of tables.slice(0, 3)) { // Test first 3 tables
        try {
          const count = await liveStoreInstance.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
          recordCounts[table.name] = count[0]?.count || 0;
        } catch (error) {
          recordCounts[table.name] = `Error: ${error.message}`;
        }
      }
      
      // Make LiveStore globally available
      window.LiveStore = liveStoreInstance;
      console.log('✅ LiveStore made globally available');
      
      return {
        success: true,
        tablesFound: tables.length,
        tables: tables.map(t => t.name).slice(0, 5),
        recordCounts: recordCounts,
        schemaLoaded: true,
        organizationId: orgId
      };
      
    } catch (error) {
      console.error('❌ LiveStore test failed:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  });

  console.log('🎯 LiveStore test result:', liveStoreTest);

  if (!liveStoreTest.success) {
    console.error('❌ LiveStore test failed with proper auth:', liveStoreTest.error);
    if (liveStoreTest.schemaResult) {
      console.error('📋 Schema result details:', liveStoreTest.schemaResult);
    }
    throw new Error(`LiveStore test failed: ${liveStoreTest.error}`);
  }

  console.log('🎉 LiveStore test with proper auth completed successfully!');
  console.log(`✅ Found ${liveStoreTest.tablesFound} tables in LiveStore`);
  console.log('📋 Sample tables:', liveStoreTest.tables);
  console.log('📊 Record counts:', liveStoreTest.recordCounts);

  // Test that LiveStore is globally available
  const globalTest = await page.evaluate(() => {
    return {
      available: typeof window.LiveStore !== 'undefined',
      type: typeof window.LiveStore
    };
  });

  console.log('🌐 Global LiveStore availability:', globalTest);
  
  if (!globalTest.available) {
    throw new Error('LiveStore not available globally after initialization');
  }

  console.log('🏆 Complete LiveStore integration test PASSED!');
});