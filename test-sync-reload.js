#!/usr/bin/env node

/**
 * Test script to verify sync behavior on reload with valid LSN
 * This will help us see what the server determines for sync strategy
 */

const { chromium } = require('playwright');

async function testSyncReload() {
  console.log('🚀 Starting sync reload test...\n');
  
  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext({
    userDataDir: './.playwright/profiles/profile-0',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('sync') || msg.text().includes('LSN') || msg.text().includes('machine')) {
      console.log(`[BROWSER] ${msg.text()}`);
    }
  });
  
  console.log('📱 Loading app for first time...');
  await page.goto('http://localhost:5173');
  
  // Wait for app to load and sync
  await page.waitForTimeout(5000);
  
  // Get current sync state from localStorage
  const syncState = await page.evaluate(() => {
    const state = localStorage.getItem('syncMachineState');
    const lsn = localStorage.getItem('currentLSN');
    const clientId = localStorage.getItem('clientId');
    return { state, lsn, clientId };
  });
  
  console.log('\n📊 Current sync state before reload:');
  console.log('  LSN:', syncState.lsn);
  console.log('  Client ID:', syncState.clientId);
  console.log('  State:', syncState.state ? JSON.parse(syncState.state).value : 'none');
  
  console.log('\n🔄 Reloading page with valid LSN...');
  console.log('⚠️  WATCH THE SERVER LOGS NOW!\n');
  
  // Clear console to see fresh logs
  await page.evaluate(() => console.clear());
  
  // Reload and watch what happens
  await page.reload();
  
  // Wait a bit to see initial messages
  await page.waitForTimeout(3000);
  
  // Check state after reload
  const newSyncState = await page.evaluate(() => {
    const state = localStorage.getItem('syncMachineState');
    const lsn = localStorage.getItem('currentLSN');
    return { state, lsn };
  });
  
  console.log('\n📊 Sync state after reload:');
  console.log('  LSN:', newSyncState.lsn);
  console.log('  State:', newSyncState.state ? JSON.parse(newSyncState.state).value : 'none');
  
  console.log('\n✅ Test complete - check server logs above for sync strategy');
  console.log('Press Ctrl+C to exit when done reviewing...');
  
  // Keep browser open for inspection
  await page.waitForTimeout(60000);
  
  await browser.close();
}

testSyncReload().catch(console.error);