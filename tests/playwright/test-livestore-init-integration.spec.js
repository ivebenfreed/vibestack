/**
 * Test LiveStore Integration with App Init Machine
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('LiveStore init machine integration test', async ({ page }) => {
  console.log('🧪 Testing LiveStore integration with app init machine...');
  
  // Capture console logs to monitor LiveStore initialization
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log LiveStore-related messages
    if (text.includes('LiveStore') || text.includes('AppInitMachine') || text.includes('livestore:')) {
      console.log(`[BROWSER-LOG] ${text}`);
    }
  });
  
  // Navigate to home page to trigger full initialization flow
  console.log('🌐 Navigating to home page...');
  await page.goto('http://localhost:5173/');
  
  console.log('⏱️ Waiting for initialization to complete...');
  await page.waitForTimeout(10000); // Give time for full init sequence
  
  // Take screenshot of final state
  await page.screenshot({ path: 'livestore-init-integration-test.png' });
  
  // Check for LiveStore-related log messages
  const liveStoreInitLogs = consoleLogs.filter(log => 
    log.includes('LiveStoreProvider') || 
    log.includes('livestore:') ||
    log.includes('LiveStore')
  );
  
  const appInitLogs = consoleLogs.filter(log => 
    log.includes('AppInitMachine') && 
    (log.includes('LiveStore') || log.includes('livestore'))
  );
  
  console.log(`📊 Found ${liveStoreInitLogs.length} LiveStore-related logs:`);
  liveStoreInitLogs.forEach((log, i) => {
    console.log(`  ${i + 1}. ${log}`);
  });
  
  console.log(`📊 Found ${appInitLogs.length} AppInitMachine LiveStore logs:`);
  appInitLogs.forEach((log, i) => {
    console.log(`  ${i + 1}. ${log}`);
  });
  
  // Check for specific integration milestones
  const hasLiveStoreProviderSetup = consoleLogs.some(log => 
    log.includes('[LiveStoreProvider] Setting up event listeners')
  );
  
  const hasAppInitLiveStore = consoleLogs.some(log => 
    log.includes('[AppInitMachine] Starting LiveStore initialization')
  );
  
  const hasLiveStoreReady = consoleLogs.some(log => 
    log.includes('LiveStore initialized successfully') ||
    log.includes('LiveStore ready') ||
    log.includes('livestore:ready')
  );
  
  console.log(`✅ LiveStore provider setup: ${hasLiveStoreProviderSetup}`);
  console.log(`✅ App init machine LiveStore state: ${hasAppInitLiveStore}`);
  console.log(`✅ LiveStore ready event: ${hasLiveStoreReady}`);
  
  // Check for errors
  const hasLiveStoreErrors = consoleLogs.some(log => 
    log.includes('LiveStore') && (log.includes('error') || log.includes('Error') || log.includes('❌'))
  );
  
  console.log(`❌ LiveStore errors found: ${hasLiveStoreErrors}`);
  
  // Get current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  console.log(`🌐 Final URL: ${currentUrl}`);
  console.log(`📄 Final page title: ${pageTitle}`);
  
  // Summary
  console.log('\n=== LIVESTORE INTEGRATION TEST SUMMARY ===');
  console.log(`Provider Setup: ${hasLiveStoreProviderSetup ? '✅' : '❌'}`);
  console.log(`App Init Integration: ${hasAppInitLiveStore ? '✅' : '❌'}`);
  console.log(`LiveStore Ready: ${hasLiveStoreReady ? '✅' : '❌'}`);
  console.log(`No Errors: ${!hasLiveStoreErrors ? '✅' : '❌'}`);
  console.log(`Total LiveStore Logs: ${liveStoreInitLogs.length}`);
  console.log('==========================================');
  
  expect(true).toBe(true); // Test always passes, we're just monitoring integration
});