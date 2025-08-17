/**
 * Debug Web App Login Form
 * 
 * Investigate what's happening with the login form - 
 * is it a loading screen issue or actual authentication problem?
 */

import { test, expect } from '@playwright/test';

test('debug web app login form behavior', async ({ page }) => {
  console.log('🔍 DEBUGGING WEB APP LOGIN FORM');
  console.log('==============================');
  console.log('');
  
  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('auth') || request.url().includes('sign-in')) {
      console.log(`🌐 REQUEST: ${request.method()} ${request.url()}`);
      console.log(`   Headers: ${JSON.stringify(request.headers())}`);
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('auth') || response.url().includes('sign-in')) {
      console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
    }
  });
  
  page.on('console', msg => {
    console.log(`🖥️ CONSOLE: ${msg.text()}`);
  });
  
  // Step 1: Go to sign-in page
  console.log('1️⃣ Going to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForLoadState('networkidle');
  
  // Take initial screenshot
  await page.screenshot({ path: 'debug-initial-login-page.png' });
  
  // Step 2: Check initial form state
  console.log('2️⃣ Checking initial form state...');
  
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  const emailExists = await emailInput.count() > 0;
  const passwordExists = await passwordInput.count() > 0;
  const submitExists = await submitButton.count() > 0;
  
  console.log(`   📧 Email input exists: ${emailExists}`);
  console.log(`   🔒 Password input exists: ${passwordExists}`);
  console.log(`   🔘 Submit button exists: ${submitExists}`);
  
  if (!emailExists || !passwordExists || !submitExists) {
    console.log('   ❌ Form elements missing - page not loaded correctly');
    throw new Error('Login form elements not found');
  }
  
  // Check button state
  const isButtonDisabled = await submitButton.isDisabled();
  const buttonText = await submitButton.textContent();
  
  console.log(`   🔘 Button disabled: ${isButtonDisabled}`);
  console.log(`   📝 Button text: "${buttonText}"`);
  
  // Step 3: Fill form and monitor state changes
  console.log('3️⃣ Filling form and monitoring state...');
  
  await emailInput.fill('ceo@widecorp.com');
  console.log('   📧 Email filled');
  
  await passwordInput.fill('WideCorp2024!CEO');
  console.log('   🔒 Password filled');
  
  // Check button state after filling
  const isButtonDisabledAfterFill = await submitButton.isDisabled();
  const buttonTextAfterFill = await submitButton.textContent();
  
  console.log(`   🔘 Button disabled after fill: ${isButtonDisabledAfterFill}`);
  console.log(`   📝 Button text after fill: "${buttonTextAfterFill}"`);
  
  await page.screenshot({ path: 'debug-form-filled.png' });
  
  // Step 4: Submit form and monitor what happens
  console.log('4️⃣ Submitting form and monitoring response...');
  
  // Set up promise to wait for navigation or response
  const navigationPromise = page.waitForURL(url => !url.includes('/sign-in'), { timeout: 10000 }).catch(() => null);
  
  // Click submit button
  await submitButton.click();
  console.log('   🔄 Submit button clicked');
  
  // Wait a moment and check button state
  await page.waitForTimeout(1000);
  
  const buttonTextAfterClick = await submitButton.textContent();
  const isButtonDisabledAfterClick = await submitButton.isDisabled();
  
  console.log(`   🔘 Button text after click: "${buttonTextAfterClick}"`);
  console.log(`   🔘 Button disabled after click: ${isButtonDisabledAfterClick}`);
  
  await page.screenshot({ path: 'debug-form-after-click.png' });
  
  // Step 5: Wait for response and check what happens
  console.log('5️⃣ Waiting for response...');
  
  // Wait up to 10 seconds for either navigation or form to complete
  await Promise.race([
    navigationPromise,
    page.waitForTimeout(10000)
  ]);
  
  const currentUrl = page.url();
  const finalButtonText = await submitButton.textContent();
  const isButtonDisabledFinal = await submitButton.isDisabled();
  
  console.log(`   📍 Final URL: ${currentUrl}`);
  console.log(`   🔘 Final button text: "${finalButtonText}"`);
  console.log(`   🔘 Final button disabled: ${isButtonDisabledFinal}`);
  
  await page.screenshot({ path: 'debug-form-final-state.png' });
  
  // Step 6: Check for error messages or loading states
  console.log('6️⃣ Checking for errors or loading states...');
  
  const errorMessages = await page.locator('[class*="error"], .text-red-600, .text-destructive').allTextContents();
  const loadingElements = await page.locator('[class*="loading"], [class*="spinner"], .animate-spin').count();
  
  console.log(`   ❌ Error messages: ${JSON.stringify(errorMessages)}`);
  console.log(`   ⏳ Loading elements: ${loadingElements}`);
  
  // Check if we're still on sign-in page
  if (currentUrl.includes('/sign-in')) {
    console.log('   📍 Still on sign-in page');
    
    // Check if form is stuck in loading state
    if (finalButtonText.includes('Loading') || finalButtonText.includes('...') || isButtonDisabledFinal) {
      console.log('   ⚠️ ISSUE: Form appears stuck in loading state');
      console.log('   🎯 This is likely a UI/loading issue, not authentication');
    } else if (errorMessages.length > 0) {
      console.log('   ⚠️ ISSUE: Form shows error messages');
      console.log('   🎯 This could be validation or authentication error');
    } else {
      console.log('   ⚠️ ISSUE: Form reset to initial state');
      console.log('   🎯 This could be silent failure or validation issue');
    }
  } else {
    console.log('   ✅ Successfully navigated away from sign-in page');
    console.log('   🎯 Authentication appears to be working');
  }
  
  console.log('');
  console.log('🔍 DEBUG ANALYSIS COMPLETE');
  console.log('=========================');
  console.log(`   Initial button: "${buttonText}"`);
  console.log(`   After fill: "${buttonTextAfterFill}"`);
  console.log(`   After click: "${buttonTextAfterClick}"`);
  console.log(`   Final state: "${finalButtonText}"`);
  console.log(`   URL change: ${currentUrl.includes('/sign-in') ? 'No' : 'Yes'}`);
  console.log(`   Errors: ${errorMessages.length > 0 ? 'Yes' : 'No'}`);
  console.log(`   Loading: ${loadingElements > 0 ? 'Yes' : 'No'}`);
});