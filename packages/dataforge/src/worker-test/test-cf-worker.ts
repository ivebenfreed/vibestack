/**
 * Test script for Cloudflare Worker
 * Tests DataForge functionality in CF Workers environment
 */

async function testWorker(baseUrl: string) {
  console.log('🧪 Testing DataForge in Cloudflare Worker');
  console.log('==========================================\n');

  const tests = [
    { name: '💓 Health Check', type: 'health' },
    { name: '🔍 Metadata Extraction', type: 'metadata' },
    { name: '🏭 Entity Generation', type: 'generate-entities' },
    { name: '🐉 Drizzle Generation', type: 'generate-drizzle' },
    { name: '💾 Dexie Generation', type: 'generate-dexie' }
  ];

  for (const test of tests) {
    console.log(`${test.name}...`);
    
    try {
      const response = await fetch(`${baseUrl}?type=${test.type}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Success!');
        
        // Log interesting data
        if (test.type === 'health') {
          console.log(`   Environment: ${result.data.environment}`);
          console.log(`   Reflect metadata: ${result.data.hasReflectMetadata}`);
          console.log(`   TypeORM available: ${result.data.hasTypeORM}`);
        } else if (test.type === 'metadata') {
          console.log(`   📊 Total entities: ${result.data.totalEntities}`);
          console.log(`   📋 Entity names: ${result.data.entityNames.slice(0, 5).join(', ')}${result.data.entityNames.length > 5 ? '...' : ''}`);
          console.log(`   📈 Sample entity: ${result.data.sampleEntity.name} (${result.data.sampleEntity.columnCount} cols, ${result.data.sampleEntity.relationCount} rels)`);
        } else if (test.type === 'generate-entities') {
          console.log(`   📊 Total: ${result.data.total}, Client: ${result.data.client}, Server: ${result.data.server}`);
          console.log(`   📊 Domain: ${result.data.domain}, System: ${result.data.system}`);
        } else if (test.type === 'generate-drizzle') {
          console.log(`   📊 Entities: ${result.data.entitiesProcessed}, Junctions: ${result.data.junctionTables}`);
          console.log(`   📋 Sample: ${result.data.sampleEntity.name} (${result.data.sampleEntity.columns.length} columns)`);
        } else if (test.type === 'generate-dexie') {
          console.log(`   📊 Client entities: ${result.data.clientEntities}/${result.data.totalEntities}`);
          console.log(`   📋 Sample: ${result.data.sampleDexieEntity.name} (${result.data.sampleDexieEntity.indexes.length} indexes)`);
        }
        
      } else {
        console.log(`❌ Failed: ${result.error}`);
        if (result.stack) {
          console.log(`   Stack: ${result.stack.split('\n')[0]}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('');
  }

  console.log('🎉 Test completed!');
  console.log('Check results above to verify DataForge works in Cloudflare Workers');
}

// Test with local dev server (wrangler dev)
const baseUrl = process.env.WORKER_URL || 'http://localhost:8790';

console.log(`Testing worker at: ${baseUrl}\n`);

testWorker(baseUrl).catch(console.error);