#!/usr/bin/env node

/**
 * Core Test: Full Initialization Process
 * 
 * Tests the complete ultra-fast initialization flow:
 * 1. Authentication
 * 2. Organization auto-selection (Wide Corp)
 * 3. Schema loading (12 entities)
 * 4. LiveStore initialization
 * 5. Sync machine startup
 * 6. Dashboard readiness
 * 
 * Usage: node tests/playwright/core/test-full-init.js
 */

const { chromium } = require('playwright');

async function testFullInitialization() {
  console.log('🚀 Testing full initialization process...');
  
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track all key events
  const events = [];
  
  page.on('console', msg => {
    const text = msg.text();
    
    // Capture key initialization events
    if (text.includes('[AuthMachine]') || 
        text.includes('[AppInitMachine]') || 
        text.includes('[Schema]') ||
        text.includes('LiveStore') ||
        text.includes('SyncMachine') ||
        text.includes('Organization')) {
      
      const timestamp = new Date().toISOString().substr(11, 12);
      events.push(`${timestamp} ${text}`);
      
      // Real-time logging of critical events
      if (text.includes('✅') || text.includes('🎉') || text.includes('ready') || 
          text.includes('SUCCESS') || text.includes('complete')) {
        console.log(`🔎 ${timestamp} ${text}`);
      }
    }
  });
  
  try {
    const startTime = Date.now();
    
    // 1. Clear preferences to ensure clean test
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      console.log('[TEST] ✅ Cleared all localStorage for clean test');
    });
    
    // 2. Navigate and verify sign-in form loads
    console.log('📝 Step 1: Loading sign-in form...');
    await page.goto('http://localhost:5173');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✅ Sign-in form loaded');
    
    // 3. Authenticate
    console.log('📝 Step 2: Authenticating...');
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    
    const authStartTime = Date.now();
    await page.click('button[type="submit"]');
    
    // 4. Wait for full initialization
    console.log('📝 Step 3: Waiting for full initialization...');
    
    // Wait for key completion indicators
    await Promise.race([
      // Wait for dashboard elements to appear
      page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('h1', { timeout: 15000 }).catch(() => null),
      page.waitForTimeout(15000)
    ]);
    
    const initCompleteTime = Date.now();
    const authDuration = initCompleteTime - authStartTime;
    
    console.log(`⏱️ Total initialization time: ${authDuration}ms`);
    
    // 5. Verify final state
    console.log('📝 Step 4: Verifying final state...');
    
    const finalState = await page.evaluate(() => {
      const results = {};
      
      // Check auth state
      const authState = localStorage.getItem('auth-machine-state');
      if (authState) {
        const parsed = JSON.parse(authState);
        results.authenticated = !!parsed?.context?.user;
        results.organizationName = parsed?.context?.currentOrganization?.name || 'None';
        results.organizationId = parsed?.context?.currentOrganization?.id || 'None';
      }
      
      // Check current URL
      results.currentUrl = window.location.href;
      
      // Check page title
      results.pageTitle = document.title;
      
      // Check if we can see dashboard content
      results.hasDashboardContent = !!(
        document.querySelector('h1') || 
        document.querySelector('[data-testid="dashboard"]') ||
        document.body.innerText.includes('Dashboard') ||
        document.body.innerText.includes('Wide Corp')
      );
      
      // Check for any error messages
      results.hasErrors = !!(
        document.body.innerText.includes('Error') ||
        document.body.innerText.includes('Failed') ||
        document.body.innerText.toLowerCase().includes('something went wrong')
      );
      
      return results;
    });
    
    // 6. API verification
    console.log('📝 Step 5: Verifying API integration...');
    
    const apiTests = await page.evaluate(async () => {
      const tests = {};
      
      try {
        // Test organizations endpoint
        const orgResponse = await fetch('/api/organizations', {
          credentials: 'include'
        });
        tests.organizationsApi = {
          status: orgResponse.status,
          ok: orgResponse.ok
        };
        
        if (orgResponse.ok) {
          const orgs = await orgResponse.json();
          tests.organizationsApi.count = Array.isArray(orgs) ? orgs.length : 0;
        }
      } catch (error) {
        tests.organizationsApi = { error: error.message };
      }
      
      try {
        // Test schema endpoint
        const schemaResponse = await fetch('/api/archetype/orgs/01920000-1000-7000-8000-000000000001/schema', {
          credentials: 'include'
        });
        tests.schemaApi = {
          status: schemaResponse.status,
          ok: schemaResponse.ok
        };
        
        if (schemaResponse.ok) {
          const schema = await schemaResponse.json();
          tests.schemaApi.entityCount = schema?.schema?.entities ? 
            Object.keys(schema.schema.entities).length : 0;
        }
      } catch (error) {
        tests.schemaApi = { error: error.message };
      }
      
      return tests;
    });
    
    // 7. Results summary
    console.log('\n🔍 INITIALIZATION RESULTS:');
    console.log('================================');
    console.log(`⏱️ Total Time: ${authDuration}ms`);
    console.log(`🔐 Authenticated: ${finalState.authenticated}`);
    console.log(`🏢 Organization: ${finalState.organizationName}`);
    console.log(`🌐 Current URL: ${finalState.currentUrl}`);
    console.log(`📄 Page Title: ${finalState.pageTitle}`);
    console.log(`📊 Dashboard Content: ${finalState.hasDashboardContent}`);
    console.log(`❌ Has Errors: ${finalState.hasErrors}`);
    
    console.log('\n🔍 API INTEGRATION:');
    console.log('==================');
    console.log(`🏢 Organizations API: ${apiTests.organizationsApi.ok ? '✅' : '❌'} (${apiTests.organizationsApi.count || 0} orgs)`);
    console.log(`📋 Schema API: ${apiTests.schemaApi.ok ? '✅' : '❌'} (${apiTests.schemaApi.entityCount || 0} entities)`);
    
    // 8. Success criteria
    const success = (
      finalState.authenticated &&
      finalState.organizationName === 'Wide Corp Solutions' &&
      finalState.hasDashboardContent &&
      !finalState.hasErrors &&
      apiTests.organizationsApi.ok &&
      apiTests.schemaApi.ok &&
      apiTests.schemaApi.entityCount === 12 &&
      authDuration < 10000 // Should complete within 10 seconds
    );
    
    console.log('\n🎯 OVERALL RESULT:');
    console.log('==================');
    
    if (success) {
      console.log(`✅ SUCCESS: Full initialization completed in ${authDuration}ms`);
      console.log('✅ All systems ready: Auth ✓ Org ✓ Schema ✓ APIs ✓ Dashboard ✓');
      
      // Keep browser open for 3 seconds to see final state
      await page.waitForTimeout(3000);
      
      await browser.close();
      process.exit(0);
    } else {
      console.log(`❌ FAILURE: Initialization issues detected`);
      console.log('📋 Check the detailed results above for specific issues');
      
      // Save debug info
      console.log('\n🔍 DEBUG EVENTS:');
      events.slice(-10).forEach(event => console.log(`  ${event}`));
      
      // Keep browser open longer for debugging
      await page.waitForTimeout(5000);
      
      await browser.close();
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    console.log('\n🔍 RECENT EVENTS:');
    events.slice(-5).forEach(event => console.log(`  ${event}`));
    
    await browser.close();
    process.exit(1);
  }
}

testFullInitialization().catch(console.error);