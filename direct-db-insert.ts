#!/usr/bin/env tsx
import { db } from './apps/server/src/lib/db'
import { clients } from './apps/server/src/schema'

const generateRecords = (count: number, startIndex: number = 0) => {
  const records = [];
  const companies = ['TechCorp', 'DataSystems', 'CloudSolutions', 'DigitalWorks', 'SmartTech', 'GlobalInc', 'PrimeData', 'EliteCloud'];
  const recordTypes = ['client', 'customer', 'prospect', 'lead'] as const;
  const statuses = ['active', 'inactive', 'pending'] as const;
  const categories = ['premium', 'standard', 'basic'];

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const company = companies[idx % companies.length];
    const recordType = recordTypes[idx % recordTypes.length];
    const status = statuses[idx % statuses.length];
    const category = categories[idx % categories.length];
    
    records.push({
      id: crypto.randomUUID(),
      organization_id: '01920000-1000-7000-8000-000000000001',
      name: `${company} ${idx}`,
      email: `contact${idx}@${company.toLowerCase()}.com`,
      phone: `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      address: `${Math.floor(Math.random() * 9999 + 1)} ${company} St`,
      city: `City${Math.floor(Math.random() * 100 + 1)}`,
      state: `ST${Math.floor(Math.random() * 50 + 1)}`,
      zip_code: `${Math.floor(Math.random() * 90000 + 10000)}`,
      country: 'USA',
      website: `https://www.${company.toLowerCase()}.com`,
      record_type: recordType,
      status: status,
      notes: `Direct DB insert record ${idx + 1} - maximum performance`,
      metadata: {
        test_data: true,
        batch_insert: true,
        generated_at: new Date().toISOString()
      },
      created_by: 'direct-db-script',
      updated_by: 'direct-db-script',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    });
  }
  return records;
};

async function insertRecords() {
  console.log('🚀 Direct DB Insert - Maximum Speed Mode');
  
  const batchSize = 2000;
  const totalRecords = 10000;
  const totalBatches = Math.ceil(totalRecords / batchSize);
  
  console.log(`📊 Inserting ${totalRecords} records in ${totalBatches} batches of ${batchSize} each`);
  
  const startTime = Date.now();
  let totalInserted = 0;
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const startIndex = batch * batchSize;
    const currentBatchSize = Math.min(batchSize, totalRecords - startIndex);
    
    console.log(`\n📦 Batch ${batch + 1}/${totalBatches}: Inserting ${currentBatchSize} records...`);
    
    const batchStartTime = Date.now();
    const records = generateRecords(currentBatchSize, startIndex);
    
    try {
      await db.insert(clients).values(records);
      const batchTime = Date.now() - batchStartTime;
      const recordsPerSec = Math.round(currentBatchSize / (batchTime / 1000));
      
      totalInserted += currentBatchSize;
      console.log(`✅ Batch ${batch + 1} complete: ${currentBatchSize} records in ${batchTime}ms (${recordsPerSec} records/sec)`);
      console.log(`📈 Progress: ${totalInserted}/${totalRecords} (${((totalInserted / totalRecords) * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Batch ${batch + 1} failed:`, error);
      break;
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  const avgRecordsPerSec = Math.round(totalInserted / totalTime);
  
  console.log(`\n🎉 Direct DB insert complete!`);
  console.log(`📊 Results: ${totalInserted} records in ${totalTime.toFixed(2)}s (${avgRecordsPerSec} records/sec)`);
  console.log(`🔍 Check UltraTable at: http://localhost:5173/debug/ultra-table`);
}

insertRecords().catch(console.error);