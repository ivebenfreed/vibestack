/**
 * Test organization selection and LiveStore debug page access
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('organization selection and debug page access', async ({ page }) => {
  console.log('🌐 Testing organization selection...');
  
  // Start from the home page
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  
  // Check if we need to select an organization
  const orgSelector = page.locator('text=Select Organization');
  if (await orgSelector.isVisible()) {
    console.log('🏢 Organization selection required...');
    
    // Wait for the organization option to be clickable
    const orgOption = page.locator('text=Playwright Test Organization');
    await orgOption.waitFor({ state: 'visible' });
    
    console.log('👆 Clicking on test organization...');
    await orgOption.click();
    
    // Wait for navigation to complete
    await page.waitForTimeout(5000);
    
    // Check if we're now past the organization selection
    const stillSelecting = await orgSelector.isVisible();
    console.log(`🔍 Still showing org selection: ${stillSelecting}`);
    
    if (!stillSelecting) {
      console.log('✅ Organization selected successfully');
    } else {
      console.log('❌ Organization selection did not complete');
    }
  } else {
    console.log('✅ Organization already selected');
  }
  
  // Take screenshot after org selection
  await page.screenshot({ path: 'after-org-selection.png' });
  
  // Now try to navigate to the debug page
  console.log('🔧 Navigating to debug page...');
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(3000);
  
  // Take screenshot of debug page
  await page.screenshot({ path: 'debug-page-attempt.png' });
  
  // Check current page content
  const currentUrl = page.url();
  console.log(`🌐 Current URL: ${currentUrl}`);
  
  const pageTitle = await page.title();
  console.log(`📄 Page title: ${pageTitle}`);
  
  // Check for LiveStore debug content
  const hasDebugContent = await page.locator('text=LiveStore').isVisible();
  console.log(`🧪 Has LiveStore debug content: ${hasDebugContent}`);
  
  // Check if still showing org selection
  const stillShowingOrgSelection = await orgSelector.isVisible();
  console.log(`🏢 Still showing org selection: ${stillShowingOrgSelection}`);
  
  console.log('✅ Test completed');
});