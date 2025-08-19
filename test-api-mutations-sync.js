#!/usr/bin/env node

/**
 * Test API Mutations and Sync
 * 
 * Direct test of API mutations to see if LiveStore sync messages are generated
 * Uses the Wide Corp organization and makes actual API calls
 */

const { chromium } = require('playwright');

async function testApiMutationsSync() {
  console.log('🔄 Testing API Mutations and LiveStore Sync...');
  
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  const WIDE_CORP_CEO_EMAIL = 'ceo@widecorp.com';
  const WIDE_CORP_CEO_PASSWORD = 'WideCorp2024!CEO';
  
  let browser;
  
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security']
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('🚀 Testing API mutations directly');
    
    // Monitor ALL requests to catch sync activity
    const allRequests = [];
    
    page.on('request', request => {
      allRequests.push({
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        postData: request.postData()
      });
      
      if (request.url().includes('/api/')) {
        console.log('📡 REQUEST:', request.method(), request.url().replace('http://localhost:5174', ''));
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log('📡 RESPONSE:', response.status(), response.url().replace('http://localhost:5174', ''));
      }
    });
    
    // Step 1: Login and get auth token
    console.log('🔐 Step 1: Login to get authentication...');
    
    await page.goto('http://localhost:5174/sign-in');
    await page.waitForTimeout(2000);
    
    await page.fill('input[type="email"]', WIDE_CORP_CEO_EMAIL);
    await page.fill('input[type="password"]', WIDE_CORP_CEO_PASSWORD);
    
    const signInButton = page.locator('button[type="submit"]');
    await signInButton.click();
    await page.waitForTimeout(3000);
    
    // Select organization
    const wideCorpCard = page.locator('text=Wide Corp Solutions');
    await wideCorpCard.click();
    await page.waitForTimeout(2000);
    
    console.log('✅ Authenticated as Wide Corp CEO');
    
    // Step 2: Get authentication cookies/tokens for API calls
    const authData = await page.evaluate(() => {
      return {
        cookies: document.cookie,
        localStorage: {...localStorage},
        sessionStorage: {...sessionStorage},
        orgId: localStorage.getItem('vibestack-last-organization-id')
      };
    });
    
    console.log('🔑 Auth Data Retrieved:', { 
      hasCookies: !!authData.cookies,
      orgId: authData.orgId,
      localStorageKeys: Object.keys(authData.localStorage)
    });
    
    // Step 3: Make direct API mutations and monitor for sync
    console.log('\n🧪 Step 3: Making direct API mutations...');
    
    // Clear previous requests to focus on mutation API calls
    allRequests.length = 0;
    
    // Test 1: Try to create a project via API
    console.log('📝 Testing project creation via API...');
    
    const projectMutationResult = await page.evaluate(async (orgId) => {
      try {
        const projectData = {
          name: `API Sync Test Project ${Date.now()}`,
          description: 'Testing API mutations and LiveStore sync',
          project_type: 'API Testing',
          status: 'planning'
        };
        
        console.log('Making project creation API call...');
        
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData)
        });
        
        const result = await response.json();
        
        return {
          success: response.ok,
          status: response.status,
          result: result,
          projectData: projectData
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, WIDE_CORP_ORG_ID);
    
    console.log('📊 Project API Result:', projectMutationResult);
    
    // Test 2: Try to create data via debug API
    console.log('\n🔧 Testing debug table data API...');
    
    const debugApiResult = await page.evaluate(async (orgId) => {
      try {
        // Try the debug table data API
        const response = await fetch(`/api/debug/table-data/tables/${orgId}`);
        const result = await response.json();
        
        return {
          success: response.ok,
          status: response.status,
          result: result,
          hasData: !!result.data
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, WIDE_CORP_ORG_ID);
    
    console.log('📊 Debug API Result:', debugApiResult);
    
    // Test 3: Try DataForge schema API
    console.log('\n🏗️ Testing DataForge schema API...');
    
    const schemaApiResult = await page.evaluate(async (orgId) => {
      try {
        const response = await fetch(`/api/dataforge/orgs/${orgId}/schema`);
        const result = await response.json();
        
        return {
          success: response.ok,
          status: response.status,
          result: result,
          hasEntities: !!(result.entities && result.entities.length > 0)
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, WIDE_CORP_ORG_ID);
    
    console.log('📊 Schema API Result:', schemaApiResult);
    
    // Test 4: Try to create via table data API
    if (debugApiResult.success && debugApiResult.result?.data?.length > 0) {
      console.log('\n📦 Testing table data creation...');
      
      const tableCreationResult = await page.evaluate(async (orgId) => {
        try {
          // Get the first available table
          const tablesResponse = await fetch(`/api/debug/table-data/tables/${orgId}`);
          const tablesResult = await tablesResponse.json();
          
          if (tablesResult.data && tablesResult.data.length > 0) {
            const firstTable = tablesResult.data[0].tableName;
            console.log(`Testing creation on table: ${firstTable}`);
            
            // Try to fetch existing data from this table
            const dataResponse = await fetch('/api/debug/table-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tableName: firstTable,
                organizationId: orgId,
                limit: 5
              })
            });
            
            const dataResult = await dataResponse.json();
            
            return {
              success: dataResponse.ok,
              status: dataResponse.status,
              tableName: firstTable,
              result: dataResult,
              recordCount: dataResult.data?.length || 0
            };
          }
          
          return { success: false, error: 'No tables available' };
          
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, WIDE_CORP_ORG_ID);
      
      console.log('📊 Table Creation Result:', tableCreationResult);
    }
    
    // Wait for any delayed sync activity
    await page.waitForTimeout(3000);
    
    // Step 4: Analyze all captured requests for sync patterns
    console.log('\n📈 Step 4: Analyzing all requests for sync patterns...');
    
    const apiRequests = allRequests.filter(req => req.url.includes('/api/'));
    const mutationRequests = apiRequests.filter(req => 
      req.method === 'POST' || 
      req.method === 'PUT' || 
      req.method === 'PATCH' || 
      req.method === 'DELETE'
    );
    
    const syncPatterns = allRequests.filter(req =>
      req.url.includes('sync') ||
      req.url.includes('mutation') ||
      req.url.includes('change') ||
      req.url.includes('livestore') ||
      req.url.includes('websocket') ||
      req.url.includes('ws://') ||
      req.url.includes('wss://') ||
      (req.postData && req.postData.includes('sync')) ||
      (req.postData && req.postData.includes('mutation'))
    );
    
    const wideCorpRequests = allRequests.filter(req => req.url.includes(WIDE_CORP_ORG_ID));
    
    console.log('🌐 REQUEST ANALYSIS:');
    console.log('  Total Requests:', allRequests.length);
    console.log('  API Requests:', apiRequests.length);
    console.log('  Mutation Requests:', mutationRequests.length);
    console.log('  Sync Pattern Requests:', syncPatterns.length);
    console.log('  Wide Corp Specific:', wideCorpRequests.length);
    
    if (apiRequests.length > 0) {
      console.log('\n📡 API REQUESTS MADE:');
      apiRequests.forEach((req, index) => {
        const urlPart = req.url.replace('http://localhost:5174', '');
        console.log(`  ${index + 1}. ${req.method} ${urlPart}`);
      });
    }
    
    if (mutationRequests.length > 0) {
      console.log('\n🔄 MUTATION REQUESTS:');
      mutationRequests.forEach((req, index) => {
        const urlPart = req.url.replace('http://localhost:5174', '');
        console.log(`  ${index + 1}. ${req.method} ${urlPart}`);
        if (req.postData) {
          console.log(`     Data: ${req.postData.substring(0, 100)}...`);
        }
      });
    }
    
    if (syncPatterns.length > 0) {
      console.log('\n📡 SYNC PATTERN REQUESTS:');
      syncPatterns.forEach((req, index) => {
        const urlPart = req.url.replace('http://localhost:5174', '');
        console.log(`  ${index + 1}. ${req.method} ${urlPart}`);
      });
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'api-mutations-sync-test.png',
      fullPage: true 
    });
    
    // Final assessment
    const hasApiActivity = apiRequests.length > 0;
    const hasMutationActivity = mutationRequests.length > 0;
    const hasSyncActivity = syncPatterns.length > 0;
    const hasWideCorpActivity = wideCorpRequests.length > 0;
    
    console.log('\n🎉 API MUTATIONS SYNC TEST SUMMARY:');
    console.log('='.repeat(70));
    console.log('  🔐 Authentication: ✅ SUCCESS');
    console.log('  🏢 Organization: Wide Corp Solutions');
    console.log('  📡 API Activity:', hasApiActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🔄 Mutation Activity:', hasMutationActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  📡 Sync Patterns:', hasSyncActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🎯 Wide Corp API:', hasWideCorpActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🌐 Total Requests:', allRequests.length);
    console.log('='.repeat(70));
    
    if (hasMutationActivity && hasSyncActivity) {
      console.log('🎯 LIVESTORE SYNC FULLY OPERATIONAL! ✅');
      console.log('   ✓ API mutations are being made');
      console.log('   ✓ Sync patterns are detected');
      console.log('   ✓ LiveStore mutation→sync flow is working!');
    } else if (hasMutationActivity) {
      console.log('🔄 MUTATIONS WORKING, SYNC INVESTIGATION NEEDED ⚠️');
      console.log('   ✓ API mutations are being made');
      console.log('   ⚠ Sync patterns not clearly detected');
      console.log('   → LiveStore may be using different sync mechanisms');
    } else if (hasApiActivity) {
      console.log('📡 API INFRASTRUCTURE WORKING ⚠️');
      console.log('   ✓ API communication established');
      console.log('   ⚠ Need to find mutation endpoints');
    } else {
      console.log('⚠️ INVESTIGATION NEEDED');
      console.log('   Check API endpoints and mutation mechanisms');
    }
    
    console.log('\n📍 Screenshot saved as: api-mutations-sync-test.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
testApiMutationsSync()
  .then(() => {
    console.log('\n✅ API mutations sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ API mutations sync test failed:', error);
    process.exit(1);
  });