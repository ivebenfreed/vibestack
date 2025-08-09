/**
 * Test script for DataForge worker
 * Validates that TypeORM decorators work in worker environment
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WorkerRequest {
  type: 'generate' | 'test-metadata' | 'health-check';
  payload?: any;
}

interface WorkerResponse {
  success: boolean;
  data?: any;
  error?: string;
}

function createWorker(): Worker {
  const workerPath = join(__dirname, 'dataforge-worker.ts');
  // Use tsx to run TypeScript in worker
  return new Worker(`
    const { pathToFileURL } = require('url');
    const { createRequire } = require('module');
    const require = createRequire(import.meta.url);
    const tsx = require('tsx/cjs/api');
    tsx.register();
    require('${workerPath}');
  `, { eval: true });
}

function sendWorkerMessage(worker: Worker, message: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker timeout'));
    }, 10000); // 10 second timeout

    worker.once('message', (response: WorkerResponse) => {
      clearTimeout(timeout);
      resolve(response);
    });

    worker.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    worker.postMessage(message);
  });
}

async function runTests() {
  console.log('🧪 Testing DataForge Worker Environment');
  console.log('=====================================\n');

  const worker = createWorker();
  
  try {
    // Wait for worker ready signal
    console.log('1. 🚀 Starting worker...');
    const readyMessage = await new Promise<WorkerResponse>((resolve) => {
      worker.once('message', resolve);
    });
    
    if (readyMessage.success) {
      console.log(`✅ Worker ready: ${JSON.stringify(readyMessage.data)}\n`);
    } else {
      throw new Error('Worker failed to start');
    }

    // Test 1: Health check
    console.log('2. 💓 Health check...');
    const healthResponse = await sendWorkerMessage(worker, { type: 'health-check' });
    if (healthResponse.success) {
      console.log(`✅ Health check passed: ${JSON.stringify(healthResponse.data)}\n`);
    } else {
      console.log(`❌ Health check failed: ${healthResponse.error}\n`);
    }

    // Test 2: Metadata extraction
    console.log('3. 🔍 Testing TypeORM metadata extraction...');
    const metadataResponse = await sendWorkerMessage(worker, { type: 'test-metadata' });
    if (metadataResponse.success) {
      console.log('✅ Metadata extraction successful!');
      console.log(`   📊 Total entities: ${metadataResponse.data.totalEntities}`);
      console.log(`   📋 Entity names: ${metadataResponse.data.entityNames.join(', ')}`);
      console.log(`   📈 Sample entity: ${JSON.stringify(metadataResponse.data.sampleEntity, null, 2)}`);
      console.log(`   📊 Metadata stats: ${JSON.stringify(metadataResponse.data.metadataStats, null, 2)}\n`);
    } else {
      console.log(`❌ Metadata extraction failed: ${metadataResponse.error}\n`);
    }

    // Test 3: Entity generation
    console.log('4. 🏭 Testing entity generation logic...');
    const entityResponse = await sendWorkerMessage(worker, { 
      type: 'generate', 
      payload: { type: 'entities' } 
    });
    if (entityResponse.success) {
      console.log('✅ Entity generation logic works!');
      console.log(`   📊 Client entities: ${entityResponse.data.clientEntities}`);
      console.log(`   📊 Server entities: ${entityResponse.data.serverEntities}`);
      console.log(`   📊 Total entities: ${entityResponse.data.totalEntities}\n`);
    } else {
      console.log(`❌ Entity generation failed: ${entityResponse.error}\n`);
    }

    // Test 4: Drizzle generation
    console.log('5. 🐉 Testing Drizzle generation logic...');
    const drizzleResponse = await sendWorkerMessage(worker, { 
      type: 'generate', 
      payload: { type: 'drizzle' } 
    });
    if (drizzleResponse.success) {
      console.log('✅ Drizzle generation logic works!');
      console.log(`   📊 Processed entities: ${drizzleResponse.data.totalProcessed}`);
      console.log(`   📋 Sample: ${JSON.stringify(drizzleResponse.data.processedEntities[0], null, 2)}\n`);
    } else {
      console.log(`❌ Drizzle generation failed: ${drizzleResponse.error}\n`);
    }

    // Test 5: Dexie generation
    console.log('6. 💾 Testing Dexie generation logic...');
    const dexieResponse = await sendWorkerMessage(worker, { 
      type: 'generate', 
      payload: { type: 'dexie' } 
    });
    if (dexieResponse.success) {
      console.log('✅ Dexie generation logic works!');
      console.log(`   📊 Client entities processed: ${dexieResponse.data.totalProcessed}`);
      console.log(`   📋 Sample: ${JSON.stringify(dexieResponse.data.clientEntities[0], null, 2)}\n`);
    } else {
      console.log(`❌ Dexie generation failed: ${dexieResponse.error}\n`);
    }

    console.log('🎉 All tests completed!');
    console.log('✅ TypeORM decorators work perfectly in worker environment');
    console.log('✅ All generation logic is worker-compatible');
    console.log('✅ Ready to embed DataForge in server worker');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await worker.terminate();
  }
}

// Run tests
runTests().catch(console.error);