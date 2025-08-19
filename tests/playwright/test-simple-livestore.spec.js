/**
 * Simple LiveStore Test - Verify basic LiveStore functionality works
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Simple LiveStore test - direct initialization', async ({ page }) => {
  console.log('🧪 Testing simple LiveStore initialization...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }

  // Test LiveStore directly in browser
  const liveStoreTest = await page.evaluate(async () => {
    try {
      console.log('📦 Testing LiveStore schema client import...');
      
      // Import LiveStore schema client
      const { liveStoreSchemaClient } = await import('./src/lib/livestore-schema-client.js');
      
      if (!liveStoreSchemaClient) {
        return { success: false, error: 'liveStoreSchemaClient not found' };
      }
      
      console.log('✅ LiveStore schema client imported');
      
      // Test schema loading
      const orgId = '01920000-1000-7000-8000-000000000001';
      const clientId = 'test-simple-client';
      
      console.log('📋 Loading LiveStore schema...');
      const schemaResult = await liveStoreSchemaClient.loadLiveStoreSchema(orgId);
      
      if (!schemaResult.success) {
        return { success: false, error: `Schema loading failed: ${schemaResult.error}` };
      }
      
      console.log('✅ LiveStore schema loaded successfully');
      
      // Test LiveStore instance creation
      console.log('🚀 Creating LiveStore instance...');
      const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(orgId, clientId);
      
      if (!liveStoreInstance) {
        return { success: false, error: 'LiveStore instance creation returned null' };
      }
      
      console.log('✅ LiveStore instance created');
      
      // Test basic functionality
      await liveStoreInstance.ready();
      console.log('✅ LiveStore ready');
      
      const tables = await liveStoreInstance.query("SELECT name FROM sqlite_master WHERE type='table'");
      console.log(`✅ LiveStore query successful - found ${tables.length} tables`);
      
      // Clean up
      await liveStoreInstance.close();
      console.log('✅ LiveStore closed');
      
      return {
        success: true,
        tablesFound: tables.length,
        schemaLoaded: true
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
    throw new Error(`LiveStore test failed: ${liveStoreTest.error}`);
  }

  console.log('🎉 Simple LiveStore test completed successfully!');
  console.log(`✅ Found ${liveStoreTest.tablesFound} tables in LiveStore`);
});