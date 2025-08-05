// Simple test script to verify Dexie integration works
import { initializeDexieDatabase, getDexieStatus } from './apps/web/src/db/dexie-init.js';

async function testDexie() {
  console.log('Testing Dexie integration...');
  
  try {
    // Initialize database
    await initializeDexieDatabase();
    console.log('✅ Dexie initialized successfully');
    
    // Get status
    const status = getDexieStatus();
    console.log('📊 Database status:', status);
    
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDexie();