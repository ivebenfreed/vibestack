/**
 * Debug Organization Selection - See what orgs are available
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('debug organization selection and force Wide Corp', async ({ page }) => {
  console.log('🔍 Debugging organization selection...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check current URL and what's visible
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);
  
  // Check if we see org selection
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 2000 });
  console.log('🏢 Has org selection:', hasOrgSelection);
  
  if (hasOrgSelection) {
    // List all available organizations
    const orgElements = await page.locator('[data-testid*="org"], .org-option, button:has-text("Corp"), button:has-text("CRM"), button:has-text("Solutions")').all();
    console.log('📋 Found', orgElements.length, 'potential org elements');
    
    // Get all text content to see what's available
    const pageText = await page.textContent('body');
    console.log('📄 Page contains "Wide":', pageText.includes('Wide'));
    console.log('📄 Page contains "Corp":', pageText.includes('Corp'));
    console.log('📄 Page contains "Solutions":', pageText.includes('Solutions'));
    console.log('📄 Page contains "Polymorphic":', pageText.includes('Polymorphic'));
    console.log('📄 Page contains "CRM":', pageText.includes('CRM'));
    
    // Try to click Wide Corp Solutions specifically
    try {
      const widecorpButton = page.locator('text=Wide Corp Solutions').first();
      const isVisible = await widecorpButton.isVisible({ timeout: 1000 });
      console.log('👀 Wide Corp Solutions visible:', isVisible);
      
      if (isVisible) {
        console.log('🎯 Clicking Wide Corp Solutions...');
        await widecorpButton.click();
        console.log('✅ Clicked Wide Corp Solutions');
        
        // Wait for navigation
        await page.waitForTimeout(3000);
        
        const newUrl = page.url();
        console.log('📍 New URL after selection:', newUrl);
        
        // Check localStorage for selected org
        const orgInfo = await page.evaluate(() => {
          return {
            lastOrgId: localStorage.getItem('vibestack-last-organization-id'),
            authState: localStorage.getItem('auth-machine-state'),
            allLocalStorage: Object.keys(localStorage).map(key => `${key}: ${localStorage.getItem(key)?.substring(0, 100)}`)
          };
        });
        
        console.log('💾 Organization info after selection:');
        console.log('   Last Org ID:', orgInfo.lastOrgId);
        console.log('   Auth State:', orgInfo.authState?.substring(0, 100));
        
        // Clear localStorage to see what sync state is set
        const syncInfo = await page.evaluate(() => {
          const syncKeys = Object.keys(localStorage).filter(key => 
            key.includes('sync') || key.includes('lsn') || key.includes('client')
          );
          return syncKeys.map(key => `${key}: ${localStorage.getItem(key)?.substring(0, 100)}`);
        });
        
        console.log('🔄 Sync-related localStorage:');
        syncInfo.forEach(item => console.log('   ', item));
        
      } else {
        console.log('❌ Wide Corp Solutions not visible');
        await page.screenshot({ path: 'screenshots/org-selection-debug-detail.png' });
      }
    } catch (error) {
      console.log('❌ Error clicking Wide Corp:', error.message);
    }
  } else {
    console.log('📊 No org selection needed, checking dashboard...');
    
    // Check what's on the current page
    const hasVibegantt = await page.locator('text=VibeGantt').isVisible({ timeout: 1000 });
    const hasDashboard = await page.locator('text=Dashboard').isVisible({ timeout: 1000 });
    
    console.log('🎯 Has VibeGantt:', hasVibegantt);
    console.log('📊 Has Dashboard:', hasDashboard);
  }
  
  console.log('🎯 Organization debug completed');
});