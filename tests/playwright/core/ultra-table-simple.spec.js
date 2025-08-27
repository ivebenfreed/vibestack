/**
 * Simple UltraTable Investigation
 * 
 * Basic test to investigate why UltraTable tests are failing
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('UltraTable Investigation', () => {
  test('investigate ultra-table debug page loading', async ({ page }) => {
    console.log('🔍 Starting UltraTable investigation...');
    
    // Navigate to debug index first
    console.log('📍 Navigating to /debug...');
    await page.goto('/debug');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of debug index
    await page.screenshot({ path: '.playwright-mcp/debug-index.png', fullPage: true });
    
    // Look for ultra-table link
    const ultraTableLink = page.locator('a[href="/debug/ultra-table"]');
    const ultraTableExists = await ultraTableLink.count();
    
    console.log(`📊 Ultra-table links found: ${ultraTableExists}`);
    
    if (ultraTableExists === 0) {
      // List all debug links
      const debugLinks = await page.locator('a[href^="/debug/"]').allTextContents();
      console.log('🔗 Available debug links:', debugLinks);
    } else {
      // Navigate to ultra-table page
      console.log('📍 Navigating to /debug/ultra-table...');
      await page.goto('/debug/ultra-table');
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: '.playwright-mcp/ultra-table-page.png', fullPage: true });
      
      // Check for any errors
      const title = await page.title();
      console.log('📄 Page title:', title);
      
      // Look for table elements
      const tableExists = await page.locator('table').count();
      const ultraTableExists = await page.locator('[class*="ultra"]').count();
      
      console.log(`📊 Tables found: ${tableExists}`);
      console.log(`📊 Ultra-related elements: ${ultraTableExists}`);
      
      // Check for any JavaScript errors
      const errors = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      
      await page.waitForTimeout(2000);
      
      if (errors.length > 0) {
        console.log('❌ JavaScript errors:', errors);
      } else {
        console.log('✅ No JavaScript errors detected');
      }
    }
  });
});