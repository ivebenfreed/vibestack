/**
 * Simple LiveStore Validation Test
 * 
 * Basic validation that LiveStore migration is working
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Simple LiveStore validation', async ({ page }) => {
  console.log('🧪 Simple LiveStore validation test...');
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('[LiveStore') || 
        text.includes('domain') ||
        text.includes('error') ||
        text.includes('Error') ||
        text.includes('failed') ||
        text.includes('Failed') ||
        text.includes('import') ||
        text.includes('Import')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Also capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });
  
  // Navigate to sign-in page and login with test user
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForLoadState('networkidle');
  
  console.log('🔐 Logging in as Wide Corp CEO...');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete and handle organization selection
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Check if we need to select organization
  const currentUrl = page.url();
  console.log('After login URL:', currentUrl);
  
  // If redirected to organization selection, select Wide Corp
  if (currentUrl.includes('/organization') || await page.locator('text=Wide Corp Solutions').isVisible().catch(() => false)) {
    console.log('📋 Selecting Wide Corp organization...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }
  
  // Navigate to debug page
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Final URL check
  const debugUrl = page.url();
  console.log('Debug page URL:', debugUrl);
  
  if (debugUrl.includes('/sign-in') || debugUrl.includes('/login')) {
    throw new Error('Authentication failed - still redirected to login page');
  }
  
  const validationResults = await page.evaluate(async () => {
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    try {
      console.log('[BROWSER] === SIMPLE LIVESTORE VALIDATION ===');
      
      // Check 1: Domain services available
      console.log('[BROWSER] 1. Checking domain services...');
      
      // Debug what's actually available
      console.log('[BROWSER] Available window properties related to LiveStore:');
      const windowProps = Object.keys(window).filter(key => 
        key.toLowerCase().includes('live') || 
        key.toLowerCase().includes('domain') ||
        key.toLowerCase().includes('store')
      );
      console.log('[BROWSER] Window properties:', windowProps);
      
      // Check if domain services import is available
      try {
        console.log('[BROWSER] Attempting to access window.liveStoreDomain...');
        console.log('[BROWSER] Type of window.liveStoreDomain:', typeof window.liveStoreDomain);
        if (window.liveStoreDomain) {
          console.log('[BROWSER] window.liveStoreDomain keys:', Object.keys(window.liveStoreDomain));
        }
      } catch (error) {
        console.log('[BROWSER] Error accessing window.liveStoreDomain:', error.message);
      }
      
      results.checks.domainServices = !!window.liveStoreDomain;
      if (results.checks.domainServices) {
        console.log('[BROWSER]    ✅ LiveStore domain available');
        results.checks.services = Object.keys(window.liveStoreDomain.services || {});
      } else {
        console.log('[BROWSER]    ❌ LiveStore domain not available');
      }
      
      // Check 2: Schema client available
      console.log('[BROWSER] 2. Checking schema client...');
      results.checks.schemaClient = !!window.liveStoreSchemaClient;
      if (results.checks.schemaClient) {
        console.log('[BROWSER]    ✅ Schema client available');
      } else {
        console.log('[BROWSER]    ❌ Schema client not available');
      }
      
      // Check 3: Test functions available
      console.log('[BROWSER] 3. Checking test functions...');
      results.checks.testFunctions = !!window.testLiveStoreEventSync;
      if (results.checks.testFunctions) {
        console.log('[BROWSER]    ✅ Test functions available');
      } else {
        console.log('[BROWSER]    ❌ Test functions not available');
      }
      
      // Check 4: Organization context
      console.log('[BROWSER] 4. Checking organization context...');
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      results.checks.hasOrganization = !!orgId;
      results.checks.organizationId = orgId;
      
      if (orgId) {
        console.log('[BROWSER]    ✅ Organization:', orgId);
      } else {
        console.log('[BROWSER]    ⚠️ No organization selected');
      }
      
      // Check 5: Basic functionality test
      console.log('[BROWSER] 5. Testing basic functionality...');
      
      if (window.testLiveStoreEventSync && window.testLiveStoreEventSync.testLiveStoreEventSync) {
        try {
          await window.testLiveStoreEventSync.testLiveStoreEventSync();
          results.checks.basicFunctionality = true;
          console.log('[BROWSER]    ✅ Basic functionality test passed');
        } catch (error) {
          results.checks.basicFunctionality = false;
          results.checks.basicFunctionalityError = error.message;
          console.log('[BROWSER]    ❌ Basic functionality test failed:', error.message);
        }
      } else {
        results.checks.basicFunctionality = false;
        console.log('[BROWSER]    ❌ Basic functionality test not available');
      }
      
      // Summary
      const passedChecks = Object.values(results.checks).filter(check => check === true).length;
      const totalChecks = Object.keys(results.checks).filter(key => typeof results.checks[key] === 'boolean').length;
      
      results.summary = {
        passedChecks,
        totalChecks,
        successRate: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0,
        overallPass: passedChecks >= Math.floor(totalChecks * 0.6) // 60% pass rate
      };
      
      console.log('[BROWSER] === VALIDATION SUMMARY ===');
      console.log(`[BROWSER] Passed: ${passedChecks}/${totalChecks}`);
      console.log(`[BROWSER] Success Rate: ${results.summary.successRate.toFixed(1)}%`);
      console.log(`[BROWSER] Overall: ${results.summary.overallPass ? '✅ PASS' : '❌ FAIL'}`);
      
      return results;
      
    } catch (error) {
      console.log('[BROWSER] Validation error:', error.message);
      results.error = error.message;
      return results;
    }
  });
  
  await page.screenshot({ path: 'livestore-simple-validation.png' });
  
  // Analyze results
  console.log('\\n' + '='.repeat(60));
  console.log('🔍 SIMPLE LIVESTORE VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  const { checks, summary, error } = validationResults;
  
  console.log(`\\n📋 VALIDATION CHECKS:`);
  console.log(`   Domain Services: ${checks.domainServices ? '✅' : '❌'}`);
  if (checks.services) {
    console.log(`   Available Services: ${checks.services.join(', ')}`);
  }
  
  console.log(`   Schema Client: ${checks.schemaClient ? '✅' : '❌'}`);
  console.log(`   Test Functions: ${checks.testFunctions ? '✅' : '❌'}`);
  console.log(`   Organization: ${checks.hasOrganization ? '✅' : '❌'} (${checks.organizationId || 'none'})`);
  console.log(`   Basic Functionality: ${checks.basicFunctionality ? '✅' : '❌'}`);
  
  if (checks.basicFunctionalityError) {
    console.log(`      Error: ${checks.basicFunctionalityError}`);
  }
  
  if (summary) {
    console.log(`\\n📊 SUMMARY:`);
    console.log(`   Passed: ${summary.passedChecks}/${summary.totalChecks}`);
    console.log(`   Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`   Overall Result: ${summary.overallPass ? '🎉 PASS' : '❌ FAIL'}`);
    
    if (summary.overallPass) {
      console.log('\\n🚀 LiveStore migration basic validation successful!');
    } else {
      console.log('\\n🔧 LiveStore migration needs attention.');
    }
  }
  
  if (error) {
    console.log(`\\n❌ VALIDATION ERROR: ${error}`);
  }
  
  console.log('\\n' + '='.repeat(60));
  
  // Test assertions for CI
  expect(checks.domainServices).toBe(true);
  expect(checks.schemaClient).toBe(true);
  
  if (summary) {
    expect(summary.successRate).toBeGreaterThan(50); // At least 50% success
  }
  
  return validationResults;
});