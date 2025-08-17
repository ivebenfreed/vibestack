/**
 * Quick debug page check after WASM fix
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('quick debug page check', async ({ page }) => {
  console.log('🌐 Navigating to debug page...');
  
  // Navigate to debug page
  await page.goto('http://localhost:5173/debug/livestore-test');
  
  console.log('⏱️ Waiting for page to load...');
  await page.waitForTimeout(3000);
  
  // Check if we need to select an organization
  const orgSelector = page.locator('text=Select Organization');
  if (await orgSelector.isVisible()) {
    console.log('🏢 Organization selection required, selecting test org...');
    
    // Click on the test organization
    await page.locator('text=Playwright Test Organization').click();
    
    console.log('⏱️ Waiting for org selection to complete...');
    await page.waitForTimeout(3000);
  }
  
  // Check if page loaded
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);
  
  // Check if debug page content exists
  try {
    const debugContent = await page.locator('h1').first().textContent({ timeout: 5000 });
    console.log(`📊 Debug page header: ${debugContent || 'NOT FOUND'}`);
  } catch (e) {
    console.log('📊 Debug page header: NOT FOUND OR TIMEOUT');
  }
  
  // Check for any error messages
  const errorElements = await page.locator('[class*="error"], .error, .text-red').count();
  console.log(`❌ Error elements found: ${errorElements}`);
  
  // Check if LiveStore test buttons exist
  const testButtons = await page.locator('button').count();
  console.log(`🔘 Test buttons found: ${testButtons}`);
  
  // Take a quick screenshot
  await page.screenshot({ path: 'debug-page-quick-check.png' });
  console.log('📸 Screenshot saved as debug-page-quick-check.png');
});