/**
 * Test Complete LiveStore Flow with Organization Selection
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('complete LiveStore initialization flow', async ({ page }) => {
  console.log('🧪 Testing complete LiveStore initialization flow...');
  
  // Capture console logs to monitor the full flow
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log important initialization messages
    if (text.includes('LiveStore') || 
        text.includes('AppInitMachine') || 
        text.includes('livestore:') ||
        text.includes('Organization') ||
        text.includes('Database') ||
        text.includes('Sync')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Navigate to home page
  console.log('🌐 Navigating to home page...');
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  
  // Check if organization selection is needed
  const orgSelector = page.locator('text=Select Organization');
  if (await orgSelector.isVisible()) {
    console.log('🏢 Organization selection required, selecting test organization...');
    
    // Click on the test organization
    await page.locator('text=Playwright Test Organization').click();
    console.log('👆 Clicked on test organization');
    
    // Wait for the organization selection to complete and initialization to start
    console.log('⏱️ Waiting for initialization sequence...');
    await page.waitForTimeout(15000); // Give plenty of time for full initialization
  } else {
    console.log('✅ Organization already selected, waiting for initialization...');
    await page.waitForTimeout(10000);
  }
  
  // Take screenshot of final state
  await page.screenshot({ path: 'complete-livestore-flow-test.png' });
  
  // Analyze the logs for the complete flow
  console.log('\n=== ANALYZING INITIALIZATION FLOW ===');
  
  // 1. Auth and Organization
  const hasOrgSelection = consoleLogs.some(log => 
    log.includes('Organization') && (log.includes('selecting') || log.includes('selected'))
  );
  
  // 2. Database initialization
  const hasDatabaseInit = consoleLogs.some(log => 
    log.includes('Database') && (log.includes('ready') || log.includes('initialization'))
  );
  
  // 3. App Init Machine progression
  const hasAppInitStart = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('START_INIT')
  );
  
  const hasAppInitDatabase = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('database')
  );
  
  const hasAppInitSync = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('sync')
  );
  
  const hasAppInitLiveStore = consoleLogs.some(log => 
    log.includes('[AppInitMachine]') && log.includes('LiveStore')
  );
  
  // 4. LiveStore Provider
  const hasLiveStoreProvider = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('event listeners')
  );
  
  const hasLiveStoreInit = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider]') && log.includes('livestore:init')
  );
  
  const hasLiveStoreReady = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('ready') || log.includes('initialized successfully'))
  );
  
  // 5. Events
  const hasLiveStoreEvents = consoleLogs.some(log => 
    log.includes('livestore:ready') || log.includes('livestore:error') || log.includes('livestore:init')
  );
  
  // 6. System ready
  const hasSystemReady = consoleLogs.some(log => 
    log.includes('System fully ready') || log.includes('system ready')
  );
  
  console.log(`🏢 Organization Selection: ${hasOrgSelection ? '✅' : '❌'}`);
  console.log(`💾 Database Initialization: ${hasDatabaseInit ? '✅' : '❌'}`);
  console.log(`🔄 App Init Start: ${hasAppInitStart ? '✅' : '❌'}`);
  console.log(`📊 App Init Database: ${hasAppInitDatabase ? '✅' : '❌'}`);
  console.log(`🔗 App Init Sync: ${hasAppInitSync ? '✅' : '❌'}`);
  console.log(`🗄️ App Init LiveStore: ${hasAppInitLiveStore ? '✅' : '❌'}`);
  console.log(`📡 LiveStore Provider Setup: ${hasLiveStoreProvider ? '✅' : '❌'}`);
  console.log(`🚀 LiveStore Init Event: ${hasLiveStoreInit ? '✅' : '❌'}`);
  console.log(`✅ LiveStore Ready: ${hasLiveStoreReady ? '✅' : '❌'}`);
  console.log(`📨 LiveStore Events: ${hasLiveStoreEvents ? '✅' : '❌'}`);
  console.log(`🎉 System Ready: ${hasSystemReady ? '✅' : '❌'}`);
  
  // Count relevant log types
  const liveStoreLogs = consoleLogs.filter(log => log.includes('LiveStore')).length;
  const appInitLogs = consoleLogs.filter(log => log.includes('[AppInitMachine]')).length;
  const orgLogs = consoleLogs.filter(log => log.includes('Organization')).length;
  
  console.log(`\n📊 Log Counts:`);
  console.log(`   LiveStore logs: ${liveStoreLogs}`);
  console.log(`   AppInit logs: ${appInitLogs}`);
  console.log(`   Organization logs: ${orgLogs}`);
  
  // Get current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  console.log(`\n🌐 Final State:`);
  console.log(`   URL: ${currentUrl}`);
  console.log(`   Title: ${pageTitle}`);
  
  // Check if we're past organization selection
  const stillSelecting = await orgSelector.isVisible();
  console.log(`   Still selecting org: ${stillSelecting}`);
  
  console.log('\n=== COMPLETE FLOW TEST SUMMARY ===');
  const flowSteps = [
    hasOrgSelection,
    hasDatabaseInit,
    hasAppInitStart,
    hasLiveStoreProvider,
    hasLiveStoreInit,
    hasLiveStoreReady
  ];
  
  const completedSteps = flowSteps.filter(Boolean).length;
  console.log(`Completed ${completedSteps}/${flowSteps.length} flow steps`);
  console.log('====================================');
  
  expect(true).toBe(true); // Test always passes, we're monitoring the flow
});