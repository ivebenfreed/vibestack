/**
 * Final comprehensive LiveStore debug test
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('comprehensive LiveStore debug test', async ({ page }) => {
  console.log('🌐 Starting comprehensive LiveStore debug test...');
  
  // Navigate to debug page
  await page.goto('http://localhost:5173/debug/livestore-test');
  await page.waitForTimeout(2000);
  
  // Select organization if required
  const orgSelector = page.locator('text=Select Organization');
  if (await orgSelector.isVisible()) {
    console.log('🏢 Selecting test organization...');
    await page.locator('text=Playwright Test Organization').click();
    await page.waitForTimeout(3000);
  }
  
  // Wait for the debug page to fully load
  console.log('⏱️ Waiting for debug page to load...');
  await page.waitForTimeout(5000);
  
  // Take screenshot of loaded page
  await page.screenshot({ path: 'livestore-debug-loaded.png' });
  console.log('📸 Screenshot saved: livestore-debug-loaded.png');
  
  // Check if we have the LiveStore debug content
  const pageContent = await page.content();
  const hasLiveStoreContent = pageContent.includes('LiveStore') || pageContent.includes('Table Contents');
  console.log(`🔍 Has LiveStore content: ${hasLiveStoreContent}`);
  
  // Look for test buttons
  const buttons = await page.locator('button').all();
  console.log(`🔘 Found ${buttons.length} buttons on the page`);
  
  // Try to find specific LiveStore test buttons
  const liveStoreButtons = await page.locator('button:has-text("Test"), button:has-text("LiveStore"), button:has-text("Sync")').count();
  console.log(`🧪 Found ${liveStoreButtons} potential test buttons`);
  
  // Check for any obvious errors
  const errorText = await page.locator('text=/error|Error|ERROR|failed|Failed|FAILED/i').count();
  console.log(`❌ Error indicators found: ${errorText}`);
  
  // Get page URL to verify we're on the right page
  const currentUrl = page.url();
  console.log(`🌐 Current URL: ${currentUrl}`);
  
  // Get some text content to understand what's showing
  const bodyText = await page.locator('body').textContent();
  const relevantText = bodyText?.substring(0, 500) || 'NO TEXT FOUND';
  console.log(`📄 Page content preview: ${relevantText.replace(/\s+/g, ' ')}`);
  
  console.log('✅ LiveStore debug test completed successfully');
});