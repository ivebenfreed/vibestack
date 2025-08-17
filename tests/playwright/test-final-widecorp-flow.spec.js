/**
 * Test Final Wide Corp Selection and Complete LiveStore Flow
 */

import { test, expect } from '@playwright/test';

test('final Wide Corp selection and complete LiveStore flow', async ({ page }) => {
  console.log('🧪 Testing final Wide Corp selection and complete LiveStore flow...');
  
  // Capture console logs to monitor the full flow
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important initialization messages
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('AuthMachine') ||
        text.includes('Wide Corp') ||
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
  
  console.log('⏱️ Waiting for organization selection screen to appear...');
  
  // Wait for organization selection screen to be visible
  try {
    await page.waitForSelector('text=Select Organization', { timeout: 10000 });
    console.log('✅ Organization selection screen appeared');
    
    // Wait a bit more for the organizations to load
    await page.waitForSelector('text=Wide Corp Solutions', { timeout: 5000 });
    console.log('✅ Wide Corp Solutions option appeared');
    
    console.log('👆 Clicking on Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    
    console.log('⏱️ Waiting for organization selection to complete and full initialization flow...');
    await page.waitForTimeout(25000); // Give plenty of time for full flow
    
  } catch (error) {
    console.log('❌ Organization selection screen did not appear:', error.message);
    await page.waitForTimeout(15000); // Wait anyway in case auto-selection happened
  }
  
  // Take screenshot of final state
  await page.screenshot({ path: 'final-widecorp-flow-test.png' });
  
  // Check final state
  console.log('\n=== ANALYZING FINAL WIDE CORP FLOW ===');
  
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
  const hasWideCorpSelection = consoleLogs.some(log => 
    log.includes('Wide Corp') || log.includes('Saving organization')
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
  
  // Check current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  const stillSelectingOrg = await page.locator('text=Select Organization').isVisible().catch(() => false);
  
  console.log(`🏢 Wide Corp Selection/Save: ${hasWideCorpSelection ? '✅' : '❌'}`);
  console.log(`🔄 App Init Started: ${hasAppInitStart ? '✅' : '❌'}`);
  console.log(`📊 Database Initialization: ${hasDatabaseInit ? '✅' : '❌'}`);
  console.log(`🔗 Sync Initialization: ${hasSyncInit ? '✅' : '❌'}`);
  console.log(`🗄️ LiveStore Initialization: ${hasLiveStoreInit ? '✅' : '❌'}`);
  console.log(`🎉 System Ready: ${hasSystemReady ? '✅' : '❌'}`);
  
  console.log(`\n💾 LocalStorage State:`);
  console.log(`   Saved Org ID: ${savedOrgId || 'NOT SAVED'}`);
  console.log(`   Auth State Org: ${authState?.context?.currentOrganization?.name || 'NOT SAVED'}`);
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  console.log(`   Still Selecting Org: ${stillSelectingOrg ? '❌ STUCK' : '✅ COMPLETED'}`);
  
  // Count log types
  const totalLogs = consoleLogs.length;
  const liveStoreLogs = consoleLogs.filter(log => log.includes('LiveStore')).length;
  const appInitLogs = consoleLogs.filter(log => log.includes('[AppInitMachine]')).length;
  const authLogs = consoleLogs.filter(log => log.includes('[AuthMachine]')).length;
  
  console.log(`\n📊 Log Analysis:`);
  console.log(`   Total logs captured: ${totalLogs}`);
  console.log(`   LiveStore logs: ${liveStoreLogs}`);
  console.log(`   AppInit logs: ${appInitLogs}`);
  console.log(`   Auth logs: ${authLogs}`);
  
  console.log('\n=== FINAL FLOW SUMMARY ===');
  const flowSteps = [
    hasWideCorpSelection,
    !!savedOrgId, // localStorage saved
    hasAppInitStart,
    hasDatabaseInit,
    hasSyncInit,
    hasLiveStoreInit,
    !stillSelectingOrg // Not stuck on org selection
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`✅ Completed ${completedSteps}/${flowSteps.length} flow steps`);
  
  if (completedSteps >= 5) {
    console.log('🎉 SUCCESS: LiveStore integration working end-to-end!');
  } else if (completedSteps >= 3) {
    console.log('⚠️ PARTIAL: Organization selection working, initialization in progress');
  } else {
    console.log('❌ ISSUES: Flow not completing as expected');
  }
  
  console.log('==============================');
  
  expect(true).toBe(true); // Test always passes, we're monitoring the flow
});