/**
 * @file verify-org-ui-simple.spec.js
 * 
 * Simple test to verify that the organization is visible in the UI
 * after successful creation. Based on the error context showing
 * the organization selection screen working correctly.
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify organization appears in UI after creation', async ({ page }) => {
  console.log('🔍 Starting simple organization UI verification...');

  // Step 1: Navigate to the application
  console.log('\n📱 Step 1: Navigate to application');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Check if we need to sign in
  const currentUrl = page.url();
  if (currentUrl.includes('/sign-in')) {
    console.log('🔑 Need to sign in first');
    
    // Fill in login form
    await page.fill('input[type="email"]', 'test-playwright-1755347086@gmail.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect after login
    await page.waitForURL('**/', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('✅ Successfully signed in');
  }
  
  // Wait for page to settle
  await page.waitForTimeout(3000);

  // Step 2: Take screenshot to see current state
  await page.screenshot({ 
    path: `./screenshots/simple-org-ui-check-${Date.now()}.png`,
    fullPage: true 
  });

  // Step 3: Check for organization presence in UI
  console.log('\n🔍 Step 3: Check for organization in UI');
  
  const uiCheck = await page.evaluate(() => {
    const bodyText = document.body.textContent || '';
    const hasOrgSelection = bodyText.includes('Select Organization');
    const hasPlaywrightOrg = bodyText.includes('Playwright Test Organization');
    const hasCreateNewOrg = bodyText.includes('Create New Organization');
    
    // Look for organization-related buttons
    const orgButtons = Array.from(document.querySelectorAll('button'))
      .map(btn => btn.textContent?.trim())
      .filter(text => text && text.includes('Playwright Test Organization'));
    
    return {
      hasOrgSelection,
      hasPlaywrightOrg,
      hasCreateNewOrg,
      orgButtons,
      pageTitle: document.title,
      currentUrl: window.location.href,
      mainHeadings: Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.textContent?.trim())
        .filter(Boolean)
    };
  });

  console.log('📋 UI Check Results:', JSON.stringify(uiCheck, null, 2));

  // Step 4: Verify organization visibility
  console.log('\n✅ Step 4: Verify organization visibility');
  
  if (uiCheck.hasOrgSelection && uiCheck.hasPlaywrightOrg) {
    console.log('✅ SUCCESS: Organization selection screen is displayed');
    console.log('✅ SUCCESS: Playwright Test Organization is visible in UI');
    console.log(`✅ SUCCESS: Found ${uiCheck.orgButtons.length} organization button(s)`);
    
    // Verify the organization button exists
    const orgButton = page.locator('button:has-text("Playwright Test Organization")');
    await expect(orgButton).toBeVisible();
    console.log('✅ SUCCESS: Organization button is clickable');
    
  } else if (uiCheck.hasCreateNewOrg && !uiCheck.hasPlaywrightOrg) {
    console.log('❌ ISSUE: Still showing organization creation flow');
    console.log('ℹ️ This suggests organization creation may not have completed successfully');
    
  } else {
    console.log('❓ UNKNOWN: UI state needs investigation');
    console.log('ℹ️ May be in a different flow or main app already');
  }

  // Step 5: Check if we can interact with the organization
  if (uiCheck.hasPlaywrightOrg && uiCheck.orgButtons.length > 0) {
    console.log('\n🖱️  Step 5: Test organization interaction');
    
    try {
      // Click the organization button to select it
      const orgButton = page.locator('button:has-text("Playwright Test Organization")').first();
      await orgButton.click();
      console.log('✅ Successfully clicked organization button');
      
      // Wait for navigation/state change
      await page.waitForTimeout(2000);
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: `./screenshots/after-org-selection-${Date.now()}.png`,
        fullPage: true 
      });
      
      // Check if we're now in the main app
      const afterClickState = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        return {
          hasMainApp: bodyText.includes('Dashboard') || bodyText.includes('Projects') || bodyText.includes('Tasks'),
          currentUrl: window.location.href,
          pageContent: bodyText.substring(0, 500)
        };
      });
      
      console.log('📊 After click state:', JSON.stringify(afterClickState, null, 2));
      
      if (afterClickState.hasMainApp) {
        console.log('✅ SUCCESS: Organization selection led to main application');
      } else {
        console.log('ℹ️ Organization selected but may need additional setup');
      }
      
    } catch (error) {
      console.log('⚠️ Could not interact with organization button:', error.message);
    }
  }

  console.log('\n🏁 Simple organization UI verification completed');
  
  // Final verification - organization should be visible
  expect(uiCheck.hasPlaywrightOrg).toBe(true);
});