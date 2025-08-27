#!/usr/bin/env tsx

/**
 * Script to add 10,000 Client records for UltraTable performance testing
 * 
 * This script generates realistic test data to verify:
 * - UltraTable virtualization performance with large datasets
 * - Legend State sync behavior with massive data
 * - Filtering and sorting performance
 * - Memory usage with 10k+ records
 */

import { db } from '../apps/server/src/lib/db'
import { clients } from '../apps/server/src/schema'
import { generateId } from '../apps/server/src/lib/utils'

// Sample company names and suffixes for realistic test data
const companyTypes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Co', 'Solutions', 'Technologies', 'Systems', 'Group', 'Enterprises']
const companyWords = [
  'Tech', 'Data', 'Cloud', 'Digital', 'Smart', 'Global', 'Prime', 'Elite', 'Pro', 'Max',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Apex', 'Core', 'Edge', 'Nova', 'Zen',
  'Rapid', 'Swift', 'Agile', 'Dynamic', 'Quantum', 'Fusion', 'Matrix', 'Vector', 'Pixel', 'Vortex'
]

const businessTypes = ['client', 'customer', 'prospect', 'lead']
const statusTypes = ['active', 'inactive', 'pending', 'deleted']

function generateRandomCompanyName(): string {
  const word1 = companyWords[Math.floor(Math.random() * companyWords.length)]
  const word2 = companyWords[Math.floor(Math.random() * companyWords.length)]
  const type = companyTypes[Math.floor(Math.random() * companyTypes.length)]
  
  return Math.random() > 0.5 
    ? `${word1} ${word2} ${type}`
    : `${word1} ${type}`
}

function generateRandomEmail(companyName: string): string {
  const domains = ['example.com', 'test.org', 'demo.net', 'sample.co', 'mockdata.io']
  const prefixes = ['contact', 'info', 'sales', 'support', 'admin', 'office']
  
  const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const domain = domains[Math.floor(Math.random() * domains.length)]
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  
  return `${prefix}@${cleanName.slice(0, 10)}.${domain}`
}

function generateRandomDate(startDays: number = 365, endDays: number = 0): Date {
  const start = Date.now() - (startDays * 24 * 60 * 60 * 1000)
  const end = Date.now() - (endDays * 24 * 60 * 60 * 1000)
  return new Date(start + Math.random() * (end - start))
}

async function addBatchOfClients(batchSize: number, startIndex: number) {
  const records = []
  
  for (let i = 0; i < batchSize; i++) {
    const recordIndex = startIndex + i
    const companyName = generateRandomCompanyName()
    const createdAt = generateRandomDate(365, 30) // Created 30-365 days ago
    const updatedAt = new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()))
    
    records.push({
      id: generateId(),
      organization_id: '01920000-1000-7000-8000-000000000001', // Wide Corp Solutions
      name: companyName,
      email: generateRandomEmail(companyName),
      phone: `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      address: `${Math.floor(Math.random() * 9999 + 1)} ${companyWords[Math.floor(Math.random() * companyWords.length)]} St`,
      city: `City${Math.floor(Math.random() * 100 + 1)}`,
      state: `ST${Math.floor(Math.random() * 50 + 1)}`,
      zip_code: `${Math.floor(Math.random() * 90000 + 10000)}`,
      country: 'USA',
      website: `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      record_type: businessTypes[Math.floor(Math.random() * businessTypes.length)],
      status: statusTypes[Math.floor(Math.random() * statusTypes.length)],
      notes: `Test client record #${recordIndex + 1} for performance testing. Generated automatically.`,
      metadata: {
        test_data: true,
        batch_number: Math.floor(recordIndex / batchSize) + 1,
        record_index: recordIndex + 1,
        generated_at: new Date().toISOString()
      },
      created_by: 'script',
      updated_by: 'script',
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: null,
    })
  }
  
  await db.insert(clients).values(records)
  console.log(`✅ Added batch ${Math.floor(startIndex / batchSize) + 1}: ${records.length} records (${startIndex + 1}-${startIndex + records.length})`)
}

async function main() {
  console.log('🚀 Starting to add 10,000 Client records for UltraTable performance testing...')
  console.log('📊 This will test virtualization, sorting, filtering, and sync performance\n')
  
  const totalRecords = 8000  // We already have ~3000, add 8000 more = 11k total
  const batchSize = 2000 // Large batches for maximum speed
  const totalBatches = Math.ceil(totalRecords / batchSize)
  
  console.log(`📦 Processing ${totalRecords} records in ${totalBatches} batches of ${batchSize} records each\n`)
  
  const startTime = Date.now()
  
  try {
    for (let batch = 0; batch < totalBatches; batch++) {
      const startIndex = batch * batchSize
      const currentBatchSize = Math.min(batchSize, totalRecords - startIndex)
      
      await addBatchOfClients(currentBatchSize, startIndex)
      
      // Show progress every 10 batches
      if ((batch + 1) % 10 === 0) {
        const progress = ((batch + 1) / totalBatches * 100).toFixed(1)
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`📈 Progress: ${progress}% (${batch + 1}/${totalBatches} batches) - ${elapsed}s elapsed`)
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    const recordsPerSecond = (totalRecords / parseFloat(totalTime)).toFixed(0)
    
    console.log(`\n🎉 Successfully added ${totalRecords} Client records!`)
    console.log(`⏱️  Total time: ${totalTime} seconds`)
    console.log(`⚡ Rate: ${recordsPerSecond} records/second`)
    console.log('\n📋 Test the performance at: http://localhost:5173/debug/ultra-table')
    console.log('🔍 Try sorting, filtering, and scrolling through the massive dataset')
    
  } catch (error) {
    console.error('❌ Error adding client records:', error)
    process.exit(1)
  }
}

// Cleanup function to remove test data
async function cleanup() {
  console.log('🧹 Cleaning up test data...')
  
  try {
    // Delete all test records (those with metadata.test_data = true)
    const result = await db
      .delete(clients)
      .where(
        // In a real implementation, you'd use a proper JSON query
        // For now, delete recent records that match our pattern
        clients.created_by.eq('script')
      )
    
    console.log(`🗑️  Removed test records`)
    console.log('✨ Cleanup complete!')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  }
}

// Check command line arguments
const args = process.argv.slice(2)

if (args.includes('--cleanup')) {
  cleanup()
} else if (args.includes('--help')) {
  console.log(`
📖 Usage:
  npx tsx scripts/add-10k-client-records.ts          # Add 10k test records
  npx tsx scripts/add-10k-client-records.ts --cleanup # Remove test records
  npx tsx scripts/add-10k-client-records.ts --help    # Show this help

🎯 Purpose:
  Generate 10,000 realistic Client records to test UltraTable performance:
  - Virtualization with large datasets (10k+ rows)
  - Sorting and filtering performance
  - Legend State sync behavior with massive data
  - Memory usage and scrolling smoothness

🔧 Test scenarios after running:
  1. Open http://localhost:5173/debug/ultra-table
  2. Switch to "Legend State Data" mode
  3. Test scrolling performance through 10k+ records  
  4. Try sorting by different columns
  5. Test filtering and search functionality
  6. Monitor memory usage and FPS during interaction
`)
} else {
  main()
}