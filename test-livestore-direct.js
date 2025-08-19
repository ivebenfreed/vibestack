/**
 * Direct LiveStore Test - Identify initialization issues
 */

async function testLiveStoreDirectly() {
  console.log('🧪 Testing LiveStore initialization directly...');

  try {
    // Test basic package imports first
    console.log('📦 Testing package imports...');
    const { Store, createStore } = await import('@livestore/livestore');
    const { makePersistedAdapter } = await import('@livestore/adapter-web');
    console.log('✅ Basic LiveStore packages imported successfully');

    // Test schema client import
    console.log('📋 Testing schema client import...');
    const schemaClientModule = await import('./apps/web/src/lib/livestore-schema-client.js');
    console.log('✅ Schema client module imported:', Object.keys(schemaClientModule));
    
    const { liveStoreSchemaClient } = schemaClientModule;
    console.log('✅ liveStoreSchemaClient extracted:', !!liveStoreSchemaClient);

    // Test organization schema loading
    console.log('🏢 Testing organization schema loading...');
    const orgId = '01920000-1000-7000-8000-000000000001';
    const clientId = 'test-direct-client';

    console.log('🔍 Loading LiveStore schema for org:', orgId);
    const schemaResult = await liveStoreSchemaClient.loadLiveStoreSchema(orgId);
    console.log('📋 Schema result:', schemaResult);

    if (!schemaResult.success) {
      throw new Error(`Schema loading failed: ${schemaResult.error}`);
    }

    // Test LiveStore instance creation
    console.log('🚀 Creating LiveStore instance...');
    const liveStoreInstance = await liveStoreSchemaClient.initializeLiveStore(orgId, clientId);
    console.log('🎯 LiveStore instance result:', !!liveStoreInstance);

    if (liveStoreInstance) {
      console.log('✅ LiveStore instance created successfully!');
      await liveStoreInstance.ready();
      console.log('✅ LiveStore instance ready!');

      // Test query
      const tables = await liveStoreInstance.query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('📊 Tables found:', tables.length);
      
      // Close instance
      await liveStoreInstance.close();
      console.log('✅ LiveStore instance closed successfully');
    } else {
      throw new Error('LiveStore instance creation returned null');
    }

    console.log('🎉 Direct LiveStore test PASSED!');
    return { success: true };

  } catch (error) {
    console.error('❌ Direct LiveStore test FAILED:', error);
    console.error('❌ Error stack:', error.stack);
    return { success: false, error: error.message, stack: error.stack };
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.testLiveStoreDirectly = testLiveStoreDirectly;
}

// Run if called directly
if (typeof process !== 'undefined' && process.argv[1] === __filename) {
  testLiveStoreDirectly().then(result => {
    console.log('Final result:', result);
    process.exit(result.success ? 0 : 1);
  });
}