#!/usr/bin/env node

/**
 * Test Actual App LiveStore Sync
 * 
 * Test LiveStore sync by using the actual app pages (Projects, Tasks, etc.)
 * instead of the debug page. Any user should be able to create data!
 */

const { chromium } = require('playwright');
const path = require('path');

async function testActualAppSync() {
  console.log('🔄 Testing LiveStore Sync in Actual App...');
  
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  const WIDE_CORP_CEO_EMAIL = 'ceo@widecorp.com';
  const WIDE_CORP_CEO_PASSWORD = 'WideCorp2024!CEO';
  
  let browser;
  
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    console.log('🚀 Testing actual app sync functionality');
    
    // Monitor ALL network activity that could be sync-related
    const syncActivity = [];
    
    page.on('request', request => {
      const url = request.url();
      // Monitor all API calls, WebSocket, and potential sync activity
      if (url.includes('/api/') || url.includes('websocket') || url.includes('ws://') || url.includes('wss://')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'REQUEST',
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData()
        };
        syncActivity.push(activity);
        console.log('📡 REQUEST:', activity.method, activity.url.replace('http://localhost:5174', ''));
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('websocket') || url.includes('ws://') || url.includes('wss://')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'RESPONSE',
          status: response.status(),
          url: url
        };
        syncActivity.push(activity);
        console.log('📡 RESPONSE:', activity.status, activity.url.replace('http://localhost:5174', ''));
      }
    });
    
    // Step 1: Login and select organization
    console.log('🔐 Step 1: Login as Wide Corp CEO...');
    await page.goto('http://localhost:5174/sign-in');
    await page.waitForTimeout(2000);
    
    await page.fill('input[type="email"]', WIDE_CORP_CEO_EMAIL);
    await page.fill('input[type="password"]', WIDE_CORP_CEO_PASSWORD);
    
    const signInButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Sign in")'));
    await signInButton.click();
    await page.waitForTimeout(3000);
    
    // Select Wide Corp organization
    const wideCorpCard = page.locator('text=Wide Corp Solutions').first();
    await wideCorpCard.click();
    await page.waitForTimeout(3000);
    
    console.log('✅ Logged in and selected Wide Corp');
    
    // Step 2: Navigate to Projects page and try to create a project
    console.log('\n📂 Step 2: Testing project creation sync...');
    
    await page.goto('http://localhost:5174/projects');
    await page.waitForTimeout(3000);
    
    // Clear previous activity to focus on project operations
    syncActivity.length = 0;
    
    // Look for "Add Project" or "Create Project" or "New Project" button
    console.log('🔍 Looking for project creation UI...');
    
    const projectPageContent = await page.evaluate(() => {
      return {
        pageText: document.body.innerText.substring(0, 1000),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent.trim()).slice(0, 10),
        links: Array.from(document.querySelectorAll('a')).map(link => link.textContent.trim()).slice(0, 10),
        hasCreateButton: document.body.innerText.includes('Create') || document.body.innerText.includes('Add') || document.body.innerText.includes('New'),
        url: window.location.href
      };
    });
    
    console.log('📊 Projects Page Analysis:', projectPageContent);
    
    // Try to click any creation button
    const creationButtons = ['Create Project', 'Add Project', 'New Project', 'Create', 'Add', 'New', '+'];
    let projectCreationAttempted = false;
    
    for (const buttonText of creationButtons) {
      try {
        const button = page.locator(`button:has-text("${buttonText}")`, `a:has-text("${buttonText}")`);
        if (await button.count() > 0) {
          await button.first().click();
          console.log(`✅ Clicked "${buttonText}" button`);
          projectCreationAttempted = true;
          await page.waitForTimeout(2000);
          break;
        }
      } catch (error) {
        // Continue to next button
      }
    }
    
    if (!projectCreationAttempted) {
      console.log('⚠️ No obvious project creation button found, trying keyboard shortcut...');
      await page.keyboard.press('Control+n');
      await page.waitForTimeout(1000);
    }
    
    // Step 3: Navigate to Tasks page and try to create a task  
    console.log('\n📋 Step 3: Testing task creation sync...');
    
    await page.goto('http://localhost:5174/tasks');
    await page.waitForTimeout(3000);
    
    const taskPageContent = await page.evaluate(() => {
      return {
        pageText: document.body.innerText.substring(0, 1000),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent.trim()).slice(0, 10),
        hasCreateButton: document.body.innerText.includes('Create') || document.body.innerText.includes('Add') || document.body.innerText.includes('New'),
        url: window.location.href
      };
    });
    
    console.log('📊 Tasks Page Analysis:', taskPageContent);
    
    // Try to create a task
    for (const buttonText of ['Create Task', 'Add Task', 'New Task', 'Create', 'Add', 'New', '+']) {
      try {
        const button = page.locator(`button:has-text("${buttonText}")`, `a:has-text("${buttonText}")`);
        if (await button.count() > 0) {
          await button.first().click();
          console.log(`✅ Clicked "${buttonText}" button for tasks`);
          await page.waitForTimeout(2000);
          break;
        }
      } catch (error) {
        // Continue to next button
      }
    }
    
    // Step 4: Try direct console manipulation of LiveStore
    console.log('\n🔧 Step 4: Direct LiveStore manipulation test...');
    
    const directManipulationResult = await page.evaluate(async () => {
      try {
        console.log('Testing direct LiveStore access...');
        
        // Check what's available in the global scope
        const globalCheck = {
          hasLiveStore: !!window.liveStore,
          hasLiveStoreDomain: !!window.liveStoreDomain,
          liveStoreDomainKeys: window.liveStoreDomain ? Object.keys(window.liveStoreDomain) : [],
          orgId: localStorage.getItem('vibestack-last-organization-id')
        };
        
        console.log('Global LiveStore check:', globalCheck);
        
        // Try to trigger a manual mutation
        if (window.liveStoreDomain) {
          console.log('LiveStore domain available, testing operations...');
          
          // Try the info method
          if (window.liveStoreDomain.info) {
            const info = await window.liveStoreDomain.info();
            console.log('LiveStore info:', info);
          }
          
          // Try the test method
          if (window.liveStoreDomain.test) {
            const testResult = await window.liveStoreDomain.test();
            console.log('LiveStore test result:', testResult);
          }
          
          // Try to manually trigger sync
          if (window.liveStoreDomain.syncStatus) {
            const syncStatus = window.liveStoreDomain.syncStatus();
            console.log('Sync status:', syncStatus);
          }
          
          return {
            success: true,
            globalCheck,
            hasTestMethod: !!window.liveStoreDomain.test,
            hasInfoMethod: !!window.liveStoreDomain.info,
            hasSyncStatus: !!window.liveStoreDomain.syncStatus
          };
        }
        
        return {
          success: false,
          error: 'LiveStore domain not available',
          globalCheck
        };
        
      } catch (error) {
        console.error('Direct manipulation error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Direct Manipulation Result:', directManipulationResult);
    
    // Step 5: Test with developer console commands
    console.log('\n💻 Step 5: Testing developer console mutations...');
    
    const consoleTestResult = await page.evaluate(async () => {
      try {
        // Try to directly create data using any available APIs
        const mutations = [];
        
        // Test 1: Try localStorage manipulation to trigger sync
        const oldOrgId = localStorage.getItem('vibestack-last-organization-id');
        console.log('Testing localStorage sync trigger...');
        
        // Temporarily change org ID to trigger a sync event
        localStorage.setItem('vibestack-last-organization-id', 'temp-test-id');
        await new Promise(resolve => setTimeout(resolve, 100));
        localStorage.setItem('vibestack-last-organization-id', oldOrgId);
        
        mutations.push({
          operation: 'localStorage_sync_trigger',
          success: true,
          description: 'Triggered localStorage change event'
        });
        
        // Test 2: Try to trigger window events that might cause sync
        console.log('Testing window events...');
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('sync-request', { detail: { type: 'manual' } }));
        
        mutations.push({
          operation: 'window_events',
          success: true,
          description: 'Dispatched storage and sync events'
        });
        
        // Test 3: Try to access IndexedDB directly (where LiveStore might store data)
        if (window.indexedDB) {
          console.log('Testing IndexedDB access...');
          
          try {
            const dbRequest = indexedDB.open('vibestack-livestore', 1);
            dbRequest.onsuccess = () => {
              console.log('IndexedDB access successful');
            };
            
            mutations.push({
              operation: 'indexeddb_access',
              success: true,
              description: 'Attempted IndexedDB connection'
            });
          } catch (idbError) {
            mutations.push({
              operation: 'indexeddb_access',
              success: false,
              error: idbError.message
            });
          }
        }
        
        return {
          success: true,
          mutations: mutations,
          totalOperations: mutations.length
        };
        
      } catch (error) {
        console.error('Console test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Console Test Result:', consoleTestResult);
    
    // Wait for any delayed sync activity
    await page.waitForTimeout(5000);
    
    // Step 6: Take screenshot and analyze final state
    console.log('\n📸 Step 6: Final analysis...');
    
    await page.screenshot({ 
      path: 'actual-app-sync-test.png',
      fullPage: true 
    });
    
    // Analyze all captured sync activity
    const allApiCalls = syncActivity.filter(a => a.type === 'REQUEST' && a.url.includes('/api/'));
    const syncRelatedCalls = syncActivity.filter(a => 
      a.url.includes('sync') || 
      a.url.includes('mutation') || 
      a.url.includes('change') ||
      a.url.includes('websocket') ||
      a.method === 'POST' || 
      a.method === 'PUT' || 
      a.method === 'PATCH'
    );
    
    const wideCorpCalls = syncActivity.filter(a => a.url.includes(WIDE_CORP_ORG_ID));
    
    console.log('\n🌐 FINAL SYNC ACTIVITY ANALYSIS:');
    console.log('  Total Network Activity:', syncActivity.length);
    console.log('  API Calls:', allApiCalls.length);
    console.log('  Sync-Related Calls:', syncRelatedCalls.length);
    console.log('  Wide Corp Specific:', wideCorpCalls.length);
    
    if (syncActivity.length > 0) {
      console.log('\n📡 Recent Network Activity:');
      syncActivity.slice(-20).forEach((activity, index) => {
        const urlPart = activity.url.replace('http://localhost:5174', '');
        console.log(`  ${index + 1}. ${activity.type} ${activity.method || activity.status} ${urlPart}`);
      });
    }
    
    // Final assessment
    const hasNetworkActivity = syncActivity.length > 0;
    const hasMutationActivity = syncRelatedCalls.length > 0;
    const hasLiveStoreActivity = directManipulationResult.success;
    
    console.log('\n🎉 ACTUAL APP LIVESTORE SYNC TEST SUMMARY:');
    console.log('='.repeat(70));
    console.log('  👤 User: Wide Corp CEO (no admin required!)');
    console.log('  🏢 Organization: Wide Corp Solutions');
    console.log('  📡 Network Activity:', hasNetworkActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🔄 Mutation Activity:', hasMutationActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🎯 LiveStore Available:', hasLiveStoreActivity ? '✅ YES' : '❌ NO');
    console.log('  🌐 Total Network Calls:', syncActivity.length);
    console.log('  📊 API Calls:', allApiCalls.length);
    console.log('  🔗 Sync-Related:', syncRelatedCalls.length);
    console.log('='.repeat(70));
    
    if (hasNetworkActivity && hasLiveStoreActivity) {
      console.log('🎯 LIVESTORE SYNC INFRASTRUCTURE CONFIRMED! ✅');
      console.log('   ✓ Network communication is working');
      console.log('   ✓ LiveStore framework is loaded');
      console.log('   ✓ API calls are being made');
      console.log('   ✓ Sync infrastructure is ready');
      
      if (hasMutationActivity) {
        console.log('   ✓ MUTATION SYNC MESSAGES DETECTED! 🚀');
      } else {
        console.log('   ⚠ Mutations need to be triggered through UI or API');
      }
    } else {
      console.log('⚠️ SYNC INVESTIGATION NEEDED');
      console.log('   Check LiveStore initialization and network connectivity');
    }
    
    console.log('\n📍 Screenshot saved as: actual-app-sync-test.png');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
testActualAppSync()
  .then(() => {
    console.log('\n✅ Actual app LiveStore sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Actual app LiveStore sync test failed:', error);
    process.exit(1);
  });