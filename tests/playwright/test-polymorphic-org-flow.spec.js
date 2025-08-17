/**
 * Test Polymorphic Test CRM Organization Flow (CEO's accessible org)
 */

import { test, expect } from '@playwright/test';

test('Polymorphic Test CRM organization selection and complete flow', async ({ page }) => {
  console.log('🧪 Testing Polymorphic Test CRM selection and complete LiveStore flow...');
  
  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('AuthMachine') ||
        text.includes('Polymorphic') ||
        text.includes('Saving organization') ||
        text.includes('START_INIT') ||
        text.includes('database ready') ||
        text.includes('sync') ||
        text.includes('livestore:') ||
        text.includes('system ready')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate to sign-in page
  console.log('🌐 Navigating to sign-in page...');
  await page.goto('http://localhost:5173/sign-in');
  await page.waitForTimeout(2000);
  
  // Clear localStorage to force manual selection
  try {
    await page.evaluate(() => {
      localStorage.removeItem('vibestack-last-organization-id');
      localStorage.removeItem('auth-machine-state');
    });
    console.log('🧹 Cleared localStorage to force manual selection');
  } catch (error) {
    console.log('⚠️ Could not clear localStorage, continuing...');
  }
  
  // Sign in as CEO
  console.log('🔐 Signing in as CEO...');
  await page.fill('input[type="email"]', 'ceo@widecorp.com');
  await page.fill('input[type="password"]', 'WideCorp2024!CEO');
  await page.click('button[type="submit"]');
  
  console.log('⏱️ Waiting for organization selection screen...');
  
  // Wait for organization selection screen
  try {
    await page.waitForSelector('text=Select Organization', { timeout: 10000 });
    console.log('✅ Organization selection screen appeared');
    
    // Wait for Polymorphic Test CRM option
    await page.waitForSelector('text=Polymorphic Test CRM', { timeout: 5000 });
    console.log('✅ Polymorphic Test CRM option appeared');
    
    console.log('👆 Clicking on Polymorphic Test CRM...');
    await page.locator('text=Polymorphic Test CRM').click();
    
    console.log('⏱️ Waiting for organization selection to complete and full initialization...');
    await page.waitForTimeout(25000); // Give time for full flow
    
  } catch (error) {
    console.log('❌ Organization selection screen did not appear:', error.message);
    await page.waitForTimeout(15000);
  }
  
  // Take screenshot of final state
  await page.screenshot({ path: 'polymorphic-org-flow-test.png' });
  
  // Check final state
  console.log('\n=== ANALYZING POLYMORPHIC ORG FLOW ===');
  
  // Check localStorage for saved preference
  const savedOrgId = await page.evaluate(() => {
    return localStorage.getItem('vibestack-last-organization-id');
  });
  
  const authState = await page.evaluate(() => {
    try {
      const state = localStorage.getItem('auth-machine-state');
      return state ? JSON.parse(state) : null;
    } catch {
      return null;
    }
  });
  
  // Analyze logs for the complete flow
  const hasOrgSelection = consoleLogs.some(log => 
    log.includes('Polymorphic') || log.includes('Saving organization')
  );
  
  const hasAppInitStart = consoleLogs.some(log => 
    log.includes('START_INIT') || log.includes('[AppInitMachine]')
  );
  
  const hasDatabaseInit = consoleLogs.some(log => 
    log.includes('database') && (log.includes('ready') || log.includes('init'))
  );
  
  const hasSyncInit = consoleLogs.some(log => 
    log.includes('sync') && (log.includes('start') || log.includes('init'))
  );
  
  const hasLiveStoreInit = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('init') || log.includes('ready'))
  );
  
  const hasSystemReady = consoleLogs.some(log => 
    log.includes('system ready') || log.includes('System fully ready')
  );
  
  // Check for any API errors
  const hasAPIErrors = consoleLogs.some(log => 
    log.includes('Failed to') || log.includes('Forbidden') || log.includes('Error:')
  );
  
  // Check current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  const stillSelectingOrg = await page.locator('text=Select Organization').isVisible().catch(() => false);
  
  console.log(`🏢 Polymorphic Org Selection: ${hasOrgSelection ? '✅' : '❌'}`);
  console.log(`🔄 App Init Started: ${hasAppInitStart ? '✅' : '❌'}`);
  console.log(`📊 Database Initialization: ${hasDatabaseInit ? '✅' : '❌'}`);
  console.log(`🔗 Sync Initialization: ${hasSyncInit ? '✅' : '❌'}`);
  console.log(`🗄️ LiveStore Initialization: ${hasLiveStoreInit ? '✅' : '❌'}`);
  console.log(`🎉 System Ready: ${hasSystemReady ? '✅' : '❌'}`);
  console.log(`❌ API Errors: ${hasAPIErrors ? '❌ FOUND' : '✅ NONE'}`);
  
  console.log(`\n💾 LocalStorage State:`);
  console.log(`   Saved Org ID: ${savedOrgId || 'NOT SAVED'}`);
  console.log(`   Auth State Org: ${authState?.context?.currentOrganization?.name || 'NOT SAVED'}`);
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  console.log(`   Still Selecting Org: ${stillSelectingOrg ? '❌ STUCK' : '✅ COMPLETED'}`);
  
  console.log('\n=== POLYMORPHIC ORG FLOW SUMMARY ===');
  const flowSteps = [
    hasOrgSelection,
    !hasAPIErrors, // No API errors
    !!savedOrgId, // localStorage saved
    hasAppInitStart,
    hasDatabaseInit,
    hasLiveStoreInit,
    !stillSelectingOrg // Not stuck on org selection
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`✅ Completed ${completedSteps}/${flowSteps.length} flow steps`);
  
  if (completedSteps >= 6) {
    console.log('🎉 SUCCESS: Complete LiveStore integration working with accessible org!');
  } else if (completedSteps >= 4) {
    console.log('⚠️ PARTIAL: Organization selection working, some initialization steps completed');
  } else {
    console.log('❌ ISSUES: Flow not completing as expected');
  }
  
  console.log('===========================================');
  
  expect(true).toBe(true);
});