#!/usr/bin/env node

/**
 * Script to add 10,000 Client records via DataForge API for UltraTable performance testing
 * 
 * This script generates realistic test data to verify:
 * - UltraTable virtualization performance with large datasets
 * - Legend State sync behavior with massive data
 * - Filtering and sorting performance
 * - API rate limiting and bulk operation limits
 * - Memory usage with 10k+ records
 */

const https = require('https');
const http = require('http');
const { readFileSync } = require('fs');

// Configuration
const API_BASE = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001'; // Wide Corp Solutions
const COOKIES_FILE = './cookies.txt';
const TOTAL_RECORDS = 10000;
const BATCH_SIZE = 50; // Optimized batch size based on testing (avoid timeouts)

// Sample data for realistic test records
const companyTypes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Co', 'Solutions', 'Technologies', 'Systems', 'Group', 'Enterprises'];
const companyWords = [
  'Tech', 'Data', 'Cloud', 'Digital', 'Smart', 'Global', 'Prime', 'Elite', 'Pro', 'Max',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Apex', 'Core', 'Edge', 'Nova', 'Zen',
  'Rapid', 'Swift', 'Agile', 'Dynamic', 'Quantum', 'Fusion', 'Matrix', 'Vector', 'Pixel', 'Vortex'
];

const businessTypes = ['client', 'customer', 'prospect', 'lead'];
const statusTypes = ['active', 'inactive', 'pending'];
const categoryTypes = ['premium', 'standard', 'basic'];

function generateRandomCompanyName() {
  const word1 = companyWords[Math.floor(Math.random() * companyWords.length)];
  const word2 = companyWords[Math.floor(Math.random() * companyWords.length)];
  const type = companyTypes[Math.floor(Math.random() * companyTypes.length)];
  
  return Math.random() > 0.5 
    ? `${word1} ${word2} ${type}`
    : `${word1} ${type}`;
}

function generateRandomEmail(companyName) {
  const domains = ['example.com', 'test.org', 'demo.net', 'sample.co', 'mockdata.io'];
  const prefixes = ['contact', 'info', 'sales', 'support', 'admin', 'office'];
  
  const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  
  return `${prefix}@${cleanName.slice(0, 10)}.${domain}`;
}

function generateTestRecord(index) {
  const companyName = generateRandomCompanyName();
  const status = statusTypes[Math.floor(Math.random() * statusTypes.length)];
  const recordType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const category = categoryTypes[Math.floor(Math.random() * categoryTypes.length)];
  
  return {
    name: companyName,
    email: generateRandomEmail(companyName),
    record_type: recordType,
    status: status,
    score: String(Math.floor(Math.random() * 100) + 1),
    category: category,
    notes: `Performance test record #${index + 1}. Generated for UltraTable testing.`
  };
}

function readCookies() {
  try {
    const cookieData = readFileSync(COOKIES_FILE, 'utf8');
    
    // Extract the session token using regex - simpler and more reliable
    const sessionTokenMatch = cookieData.match(/better-auth\.session_token\s+([^\s\n]+)/);
    
    if (sessionTokenMatch && sessionTokenMatch[1]) {
      const sessionToken = decodeURIComponent(sessionTokenMatch[1]);
      const cookieString = `better-auth.session_token=${sessionToken}`;
      console.log('🔐 Found session token');
      return cookieString;
    } else {
      throw new Error('Session token not found in cookies.txt');
    }
  } catch (error) {
    console.error('❌ Error reading cookies.txt. Please run the authentication first:');
    console.error('curl -X POST "http://localhost:8787/api/auth/sign-in/email" \\');
    console.error('  -H "Content-Type: application/json" \\');
    console.error('  -d "{\\"email\\": \\"ceo@widecorp.com\\", \\"password\\": \\"WideCorp2024!CEO\\"}" \\');
    console.error('  -c cookies.txt');
    process.exit(1);
  }
}

function makeRequest(method, path, data = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UltraTable-Bulk-Test-Script/1.0',
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(url, options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(responseBody);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function getCurrentRecordCount(cookies) {
  console.log('📊 Getting current Client record count...');
  
  try {
    const response = await makeRequest(
      'GET', 
      `/api/dataforge/orgs/${ORG_ID}/data/Client?count=true`,
      null,
      cookies
    );
    
    if (response.statusCode === 200 && response.body.success) {
      const count = response.body.total || response.body.data?.length || 0;
      console.log(`📋 Current Client records: ${count}`);
      return count;
    } else {
      console.warn('⚠️  Could not get current record count, proceeding anyway');
      return 0;
    }
  } catch (error) {
    console.warn('⚠️  Error getting record count:', error.message);
    return 0;
  }
}

async function createBatch(cookies, records, batchNumber, totalBatches) {
  const batchPayload = {
    records: records,
    options: {
      batchSize: records.length,
      continueOnError: true
    }
  };

  const startTime = Date.now();
  
  try {
    const response = await makeRequest(
      'POST',
      `/api/dataforge/orgs/${ORG_ID}/bulk/Client/create`,
      batchPayload,
      cookies
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.statusCode === 200 && response.body.success) {
      const summary = response.body.summary;
      console.log(`✅ Batch ${batchNumber}/${totalBatches}: Created ${summary.created}/${summary.total} records (${duration}ms)`);
      
      if (summary.failed > 0) {
        console.log(`⚠️  ${summary.failed} records failed in batch ${batchNumber}`);
        if (response.body.errors && response.body.errors.length > 0) {
          console.log('   Errors:', response.body.errors.slice(0, 3)); // Show first 3 errors
        }
      }
      
      return {
        success: true,
        created: summary.created,
        failed: summary.failed,
        duration: duration
      };
    } else {
      console.error(`❌ Batch ${batchNumber} failed:`, response.body);
      return {
        success: false,
        created: 0,
        failed: records.length,
        duration: duration,
        error: response.body
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Batch ${batchNumber} error:`, error.message);
    return {
      success: false,
      created: 0,
      failed: records.length,
      duration: duration,
      error: error.message
    };
  }
}

async function testBulkLimitsAndRateLimit(cookies) {
  console.log('\n🔬 Testing API bulk limits and rate limiting...\n');
  
  // Test different batch sizes to find optimal size
  const batchSizes = [10, 50, 100, 250, 500];
  
  for (const batchSize of batchSizes) {
    console.log(`\n📦 Testing batch size: ${batchSize}`);
    
    const testRecords = [];
    for (let i = 0; i < batchSize; i++) {
      testRecords.push(generateTestRecord(i));
    }
    
    const result = await createBatch(cookies, testRecords, 1, 1);
    
    if (result.success) {
      const recordsPerSecond = Math.round(result.created / (result.duration / 1000));
      console.log(`   ✅ Success: ${result.created} records in ${result.duration}ms (${recordsPerSecond} records/sec)`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      if (result.error && typeof result.error === 'object' && result.error.error) {
        console.log(`   Error details: ${result.error.error}`);
      }
      break; // Stop testing larger batches if this one failed
    }
    
    // Add a small delay between tests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  console.log('🚀 DataForge API Bulk Testing & 10K Client Record Creation');
  console.log(`📋 Target: Add ${TOTAL_RECORDS.toLocaleString()} Client records for UltraTable performance testing\n`);

  // Read authentication cookies
  const cookies = readCookies();
  console.log('🔐 Authentication cookies loaded\n');

  // Get current record count
  const initialCount = await getCurrentRecordCount(cookies);
  
  // Check if we should proceed based on command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--test-limits-only')) {
    await testBulkLimitsAndRateLimit(cookies);
    return;
  }
  
  if (args.includes('--help')) {
    console.log(`
📖 Usage:
  node scripts/add-10k-client-records-via-api.js                    # Add 10k records
  node scripts/add-10k-client-records-via-api.js --test-limits-only  # Test API limits only
  node scripts/add-10k-client-records-via-api.js --help             # Show this help

🎯 Purpose:
  Generate ${TOTAL_RECORDS.toLocaleString()} realistic Client records to test UltraTable performance:
  - Virtualization with large datasets (${TOTAL_RECORDS.toLocaleString()}+ rows)
  - Sorting and filtering performance
  - Legend State sync behavior with massive data
  - Memory usage and scrolling smoothness

🔧 Test scenarios after running:
  1. Open http://localhost:5173/debug/ultra-table
  2. Switch to "Legend State Data" mode
  3. Test scrolling performance through ${TOTAL_RECORDS.toLocaleString()}+ records  
  4. Try sorting by different columns
  5. Test filtering and search functionality
  6. Monitor memory usage and FPS during interaction

🌟 Features:
  - Uses DataForge bulk API for efficient creation
  - Generates realistic company names and data
  - Includes rate limiting and error handling
  - Provides detailed progress reporting
  - Respects API constraints and best practices
`);
    return;
  }

  // Skip batch testing - we know batch size 50 works at 1-2 records/sec
  // await testBulkLimitsAndRateLimit(cookies);
  
  console.log('\n🎯 Starting 10K record creation...\n');
  
  const totalBatches = Math.ceil(TOTAL_RECORDS / BATCH_SIZE);
  let totalCreated = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  const overallStartTime = Date.now();
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const startIndex = batch * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, TOTAL_RECORDS);
    const batchRecords = [];
    
    // Generate records for this batch
    for (let i = startIndex; i < endIndex; i++) {
      batchRecords.push(generateTestRecord(i));
    }
    
    // Create the batch
    const result = await createBatch(cookies, batchRecords, batch + 1, totalBatches);
    
    totalCreated += result.created;
    totalFailed += result.failed;
    totalDuration += result.duration;
    
    // Progress reporting every 10 batches
    if ((batch + 1) % 10 === 0) {
      const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
      const elapsed = ((Date.now() - overallStartTime) / 1000).toFixed(1);
      const avgRate = Math.round(totalCreated / (totalDuration / 1000));
      console.log(`📈 Progress: ${progress}% (${batch + 1}/${totalBatches} batches) - ${elapsed}s elapsed - ${avgRate} records/sec avg`);
    }
    
    // Add a small delay between batches to be respectful to the API
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const totalTime = ((Date.now() - overallStartTime) / 1000).toFixed(2);
  const finalRate = Math.round(totalCreated / parseFloat(totalTime));
  
  console.log(`\n🎉 Bulk creation complete!`);
  console.log(`📊 Results:`);
  console.log(`   • Total created: ${totalCreated.toLocaleString()} records`);
  console.log(`   • Total failed: ${totalFailed.toLocaleString()} records`);
  console.log(`   • Success rate: ${((totalCreated / (totalCreated + totalFailed)) * 100).toFixed(1)}%`);
  console.log(`   • Total time: ${totalTime} seconds`);
  console.log(`   • Average rate: ${finalRate} records/second`);
  
  // Get final count
  console.log('\n📋 Verifying final record count...');
  const finalCount = await getCurrentRecordCount(cookies);
  const netIncrease = finalCount - initialCount;
  
  console.log(`   • Initial count: ${initialCount.toLocaleString()}`);
  console.log(`   • Final count: ${finalCount.toLocaleString()}`);
  console.log(`   • Net increase: ${netIncrease.toLocaleString()}`);
  
  console.log('\n🔍 Now test the performance at: http://localhost:5173/debug/ultra-table');
  console.log('🎯 Try sorting, filtering, and scrolling through the massive dataset!');
  
  if (totalFailed > 0) {
    console.log(`\n⚠️  Note: ${totalFailed} records failed to create. Check server logs for details.`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}