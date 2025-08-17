/**
 * Test CTO Admin Debug Access
 * 
 * Test if the CTO admin user can successfully login and access the debug route
 */

import { test, expect } from '@playwright/test';

test('CTO admin can login and access debug route', async ({ page }) => {
  console.log('🔐 Testing CTO admin access to debug route...');
  console.log('');
  
  // Step 1: Go to sign-in page
  console.log('1️⃣ Going to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForLoadState('networkidle');
  
  // Step 2: Fill in CTO admin credentials
  console.log('2️⃣ Entering CTO admin credentials...');
  
  // Wait for form to be ready
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  
  // Clear and fill email
  await page.fill('input[name="email"]', '');
  await page.fill('input[name="email"]', 'cto@widecorp.com');
  
  // Clear and fill password
  await page.fill('input[name="password"]', '');
  await page.fill('input[name="password"]', 'WideCorp2024!CTO');
  
  console.log('   📧 Email: cto@widecorp.com');
  console.log('   🔒 Password: WideCorp2024!CTO');
  
  // Step 3: Submit the form
  console.log('3️⃣ Submitting login form...');
  
  // Take screenshot before submitting
  await page.screenshot({ path: 'cto-before-login-submit.png' });
  
  // Click the submit button
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  console.log('   🔄 Submit button clicked');
  
  // Wait for navigation or authentication to complete
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  
  // Check where we ended up
  const postLoginUrl = page.url();
  console.log(`   📍 Post-login URL: ${postLoginUrl}`);
  
  // Take screenshot after login attempt
  await page.screenshot({ path: 'cto-after-login-attempt.png' });
  
  // Step 4: Check if we're successfully logged in
  console.log('4️⃣ Checking login status...');
  
  const isSignInPage = postLoginUrl.includes('/sign-in');
  const pageTitle = await page.locator('h1').first().textContent();
  
  if (isSignInPage) {
    console.log('   ❌ Still on sign-in page');
    
    // Check for error messages or rate limiting
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('try again')) {
      console.log('   ⏰ Rate limiting detected');
    }
    
    // Check for form validation errors
    const errorElements = await page.locator('[class*="error"], .text-red-600, .text-destructive').allTextContents();
    if (errorElements.length > 0) {
      console.log(`   ❌ Error messages: ${JSON.stringify(errorElements)}`);
    }
    
  } else {
    console.log('   ✅ Successfully logged in!');
    console.log(`   📍 Current page: ${pageTitle}`);
  }
  
  // Step 5: Navigate to debug page
  console.log('5️⃣ Navigating to debug page...');
  
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  const debugUrl = page.url();
  const debugPageTitle = await page.locator('h1').first().textContent();
  
  console.log(`   📍 Debug page URL: ${debugUrl}`);
  console.log(`   📝 Debug page title: ${debugPageTitle}`);
  
  // Step 6: Check debug page access
  console.log('6️⃣ Checking debug page access...');
  
  if (debugUrl.includes('/sign-in')) {
    console.log('   ❌ Redirected back to sign-in - authentication required');
    
  } else if (debugPageTitle?.includes('LiveStore Integration Debug')) {
    console.log('   🎉 SUCCESS! CTO admin can access debug page!');
    
    // Take comprehensive screenshot of debug page
    await page.screenshot({ 
      path: 'CTO-ADMIN-DEBUG-ACCESS-SUCCESS.png', 
      fullPage: true 
    });
    
    // Check for specific debug content
    const hasTableSection = await page.locator('text=Live Data Tables (Via Sync System)').count() > 0;
    const hasWideCorpBadge = await page.locator('text=Wide Corp Solutions').count() > 0;
    const hasTabInterface = await page.locator('button[role="tab"]:has-text("Projects")').count() > 0;
    
    console.log(`   ✅ Table section present: ${hasTableSection}`);
    console.log(`   ✅ Wide Corp badge present: ${hasWideCorpBadge}`);
    console.log(`   ✅ Tab interface present: ${hasTabInterface}`);
    
    // Test clicking refresh data button
    console.log('7️⃣ Testing data loading functionality...');
    
    try {
      const refreshButton = page.locator('button:has-text("Refresh Data")').first();
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        console.log('   🔄 Refresh Data button clicked');
        
        await page.waitForTimeout(3000);
        
        // Check for results
        const hasData = await page.locator('text=records loaded successfully').count() > 0;
        const hasError = await page.locator('text=❌ Error:').count() > 0;
        
        console.log(`   📊 Data loading success: ${hasData}`);
        console.log(`   ❌ Data loading error: ${hasError}`);
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'CTO-ADMIN-DEBUG-AFTER-DATA-TEST.png', 
          fullPage: true 
        });
      }
    } catch (error) {
      console.log(`   ❌ Data loading test failed: ${error.message}`);
    }
    
  } else {
    console.log('   ❓ Unexpected page - investigating...');
    const pageContent = await page.textContent('body');
    console.log(`   📄 Page content preview: ${pageContent?.substring(0, 200)}...`);
  }
  
  console.log('');
  console.log('🎯 CTO ADMIN TEST SUMMARY:');
  console.log('=========================');
  console.log(`   Login attempt: ${isSignInPage ? 'Failed' : 'Success'}`);
  console.log(`   Debug access: ${debugPageTitle?.includes('LiveStore') ? 'Success' : 'Failed'}`);
  console.log(`   Screenshots: cto-*.png and CTO-ADMIN-*.png`);
  console.log('');
});