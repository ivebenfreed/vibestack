/**
 * Debug Browser Logs for Authentication Issue
 * 
 * Capture detailed browser console logs and network requests
 * to understand why the login form gets stuck in loading state
 * despite successful server authentication.
 */

import { test, expect } from '@playwright/test';

test('capture browser logs during authentication', async ({ page }) => {
  console.log('🔍 CAPTURING BROWSER LOGS FOR AUTH DEBUG');
  console.log('==========================================');
  console.log('');
  
  const consoleLogs = [];
  const networkRequests = [];
  const networkResponses = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString()
    };
    consoleLogs.push(logEntry);
    console.log(`🖥️ CONSOLE [${msg.type().toUpperCase()}]: ${msg.text()}`);
  });
  
  // Capture network requests
  page.on('request', request => {
    const requestData = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
      timestamp: new Date().toISOString()
    };
    networkRequests.push(requestData);
    
    if (request.url().includes('auth') || request.url().includes('sign-in')) {
      console.log(`🌐 REQUEST: ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log(`   📊 POST Data: ${request.postData()}`);
      }
    }
  });
  
  // Capture network responses
  page.on('response', response => {
    const responseData = {
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      timestamp: new Date().toISOString()
    };
    networkResponses.push(responseData);
    
    if (response.url().includes('auth') || response.url().includes('sign-in')) {
      console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`❌ PAGE ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  });
  
  // Capture unhandled promise rejections
  page.on('requestfailed', request => {
    console.log(`❌ REQUEST FAILED: ${request.method()} ${request.url()}`);
    console.log(`   Failure: ${request.failure()?.errorText}`);
  });
  
  console.log('1️⃣ Going to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForLoadState('networkidle');
  
  console.log('2️⃣ Waiting for form to be ready...');
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
  
  console.log('3️⃣ Filling form...');
  await page.fill('input[name="email"]', 'ceo@widecorp.com');
  await page.fill('input[name="password"]', 'WideCorp2024!CEO');
  
  console.log('4️⃣ Checking Better Auth client state before submit...');
  
  // Check if Better Auth client is loaded
  const betterAuthLoaded = await page.evaluate(() => {
    return typeof window.betterAuth !== 'undefined';
  });
  console.log(`   🔍 Better Auth client loaded: ${betterAuthLoaded}`);
  
  // Check auth machine state
  const authMachineState = await page.evaluate(() => {
    if (window.authActor) {
      return window.authActor.getSnapshot?.()?.value || 'unknown';
    }
    return 'not found';
  });
  console.log(`   🔍 Auth machine state: ${authMachineState}`);
  
  console.log('5️⃣ Submitting form and monitoring client-side behavior...');
  
  const submitButton = page.locator('button[type="submit"]');
  
  // Click submit and immediately start monitoring
  await submitButton.click();
  console.log('   🔄 Submit button clicked');
  
  // Wait and monitor state changes
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    
    const buttonText = await submitButton.textContent();
    const buttonDisabled = await submitButton.isDisabled();
    const currentUrl = page.url();
    
    console.log(`   📊 Second ${i + 1}: Button="${buttonText}", Disabled=${buttonDisabled}, URL=${currentUrl.includes('/sign-in') ? 'still on sign-in' : 'redirected'}`);
    
    // Check auth state during the process
    const currentAuthState = await page.evaluate(() => {
      if (window.authActor) {
        const snapshot = window.authActor.getSnapshot?.();
        return {
          value: snapshot?.value || 'unknown',
          context: snapshot?.context || {}
        };
      }
      return 'not available';
    });
    console.log(`   🔍 Auth state: ${JSON.stringify(currentAuthState)}`);
    
    // Check for any React state or errors
    const reactErrors = await page.evaluate(() => {
      const errors = [];
      if (window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__) {
        // Check for React errors
      }
      return errors;
    });
    
    // Break if navigation happened
    if (!currentUrl.includes('/sign-in')) {
      console.log(`   ✅ Navigation detected at second ${i + 1}`);
      break;
    }
  }
  
  console.log('6️⃣ Final state analysis...');
  
  const finalUrl = page.url();
  const finalButtonText = await submitButton.textContent();
  const finalButtonDisabled = await submitButton.isDisabled();
  
  console.log(`   📍 Final URL: ${finalUrl}`);
  console.log(`   🔘 Final button state: "${finalButtonText}" (disabled: ${finalButtonDisabled})`);
  
  // Check for any form validation errors
  const formErrors = await page.locator('[role="alert"], .error, .text-red-500, .text-destructive').allTextContents();
  console.log(`   ❌ Form errors: ${JSON.stringify(formErrors)}`);
  
  // Check local storage and session storage
  const localStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items[key] = localStorage.getItem(key);
    }
    return items;
  });
  console.log(`   💾 LocalStorage keys: ${Object.keys(localStorage).join(', ')}`);
  
  const sessionStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      items[key] = sessionStorage.getItem(key);
    }
    return items;
  });
  console.log(`   💾 SessionStorage keys: ${Object.keys(sessionStorage).join(', ')}`);
  
  console.log('');
  console.log('🔍 DETAILED ANALYSIS SUMMARY');
  console.log('===========================');
  
  // Count auth-related requests
  const authRequests = networkRequests.filter(req => 
    req.url.includes('auth') || req.url.includes('sign-in')
  );
  const authResponses = networkResponses.filter(res => 
    res.url.includes('auth') || res.url.includes('sign-in')
  );
  
  console.log(`📊 Auth Requests: ${authRequests.length}`);
  console.log(`📊 Auth Responses: ${authResponses.length}`);
  
  authRequests.forEach((req, i) => {
    const response = authResponses.find(res => res.url === req.url);
    console.log(`   ${i + 1}. ${req.method} ${req.url} → ${response?.status || 'no response'}`);
  });
  
  // Count console errors
  const errors = consoleLogs.filter(log => log.type === 'error');
  const warnings = consoleLogs.filter(log => log.type === 'warning');
  
  console.log(`⚠️ Console Errors: ${errors.length}`);
  console.log(`⚠️ Console Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('❌ ERROR DETAILS:');
    errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error.text}`);
    });
  }
  
  // Determine the issue
  if (finalUrl.includes('/sign-in')) {
    if (finalButtonDisabled || finalButtonText.includes('...') || finalButtonText.toLowerCase().includes('signing')) {
      console.log('🎯 ISSUE IDENTIFIED: Form stuck in loading state');
      console.log('   - Server authentication is working (based on previous tests)');
      console.log('   - Client-side form handling is not processing the response');
      console.log('   - Likely issue with Better Auth React integration or state management');
    } else {
      console.log('🎯 ISSUE IDENTIFIED: Form reset without error message');
      console.log('   - Form submission completed but no navigation occurred');
      console.log('   - Could be validation error or silent failure');
    }
  } else {
    console.log('✅ SUCCESS: Authentication and navigation working correctly');
  }
  
  console.log('');
  console.log('📋 NEXT DEBUGGING STEPS:');
  console.log('1. Check Better Auth client configuration');
  console.log('2. Verify React form handling and state updates');
  console.log('3. Check for async/promise handling issues');
  console.log('4. Verify cookie/session handling between client and server');
});