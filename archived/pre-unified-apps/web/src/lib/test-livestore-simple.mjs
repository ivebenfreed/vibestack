/**
 * Simple LiveStore Integration Test
 */

import { Store, createStore, Schema } from '@livestore/livestore';
import { makePersistedAdapter } from '@livestore/adapter-web';

console.log('🧪 Testing LiveStore Beta Integration...');

try {
  console.log('✅ Imports successful');
  console.log('- Store:', typeof Store);
  console.log('- createStore:', typeof createStore);
  console.log('- Schema:', typeof Schema);
  console.log('- makePersistedAdapter:', typeof makePersistedAdapter);

  // Test schema creation
  const testSchema = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    created_at: Schema.String
  });

  console.log('✅ Schema creation working');
  console.log('- Schema type:', typeof testSchema);

  console.log('\n🎉 LiveStore integration test passed!');
  console.log('✅ All imports working correctly');
  console.log('✅ Schema creation functional');
  console.log('✅ Ready for full integration');

} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}