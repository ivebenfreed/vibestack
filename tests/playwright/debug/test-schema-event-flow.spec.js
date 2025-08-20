/**
 * Test Schema Event Flow
 * 
 * This test captures all browser console logs to see if the SCHEMA_READY
 * event is being sent properly.
 */

import { test, expect } from '../fixtures/persistent-context.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

test('capture schema event flow logs', async ({ page }) => {
  const env = loadEnvFile();
  
  if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
    console.log('⚠️  Skipping test: No credentials');
    test.skip();
    return;
  }

  console.log('📋 Capturing schema event flow...');
  
  // Set up comprehensive console logging
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    
    // Log important messages to Playwright output
    if (text.includes('[Schema]') || 
        text.includes('SCHEMA_READY') || 
        text.includes('[AppInitMachine]') ||
        text.includes('startBackground')) {
      console.log(`🔍 ${text}`);
    }
  });
  
  // Navigate to app
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // If we need to login, do it quickly
  if (page.url().includes('/sign-in')) {
    console.log('🔐 Performing login...');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL);
    await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD);
    await page.click('button:has-text("Login")');
    
    await page.waitForFunction(() => !window.location.pathname.includes('/sign-in'), { timeout: 15000 });
    console.log('✅ Login completed');
    
    // Wait for organizations to load and then auto-select
    await page.waitForFunction(() => {
      const authActor = window.authMachineActor;
      if (authActor) {
        const snapshot = authActor.getSnapshot();
        const orgs = snapshot.context.userOrganizations;
        return orgs && orgs.length > 0;
      }
      return false;
    }, { timeout: 10000 });
    
    // Auto-select organization to trigger schema loading
    const orgSelection = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      if (authActor) {
        const snapshot = authActor.getSnapshot();
        const orgs = snapshot.context.userOrganizations;
        if (orgs && orgs.length > 0) {
          console.log('[Test] Auto-selecting first organization for schema test:', orgs[0].name);
          authActor.send({ type: 'SELECT_ORGANIZATION', organizationId: orgs[0].id });
          return { selected: true, orgName: orgs[0].name, orgId: orgs[0].id };
        }
      }
      return { selected: false, reason: 'No orgs found' };
    });
    
    console.log('Organization selection:', orgSelection);
    
    if (orgSelection.selected) {
      // Wait for organization to be set and schema to start loading
      await page.waitForFunction(() => {
        const authActor = window.authMachineActor;
        return !!authActor?.getSnapshot?.()?.context?.currentOrganization;
      }, { timeout: 10000 });
      
      console.log('✅ Organization selected, waiting for schema loading...');
      
      // Wait longer for schema loading and app init to progress
      await page.waitForTimeout(8000);
    }
  }
  
  // Now check machine states and logs
  const finalState = await page.evaluate(() => {
    return {
      timestamp: Date.now(),
      auth: {
        state: window.authMachineActor?.getSnapshot?.()?.value,
        hasOrg: !!window.authMachineActor?.getSnapshot?.()?.context?.currentOrganization
      },
      appInit: {
        state: window.appInitActor?.getSnapshot?.()?.value,
        organizationId: window.appInitActor?.getSnapshot?.()?.context?.organizationId
      },
      sync: {
        state: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.value
      }
    };
  });
  
  console.log('\n📊 Final machine states:', JSON.stringify(finalState, null, 2));
  
  // Filter and show relevant logs
  const schemaLogs = logs.filter(log => 
    log.includes('[Schema]') || 
    log.includes('SCHEMA_READY') || 
    log.includes('schema loaded') ||
    log.includes('startBackground') ||
    log.includes('Background: Starting sync')
  );
  
  console.log('\n🔍 Relevant schema/sync logs:');
  schemaLogs.forEach(log => console.log(`  ${log}`));
  
  if (schemaLogs.length === 0) {
    console.log('❌ No schema-related logs found - the schema notification may not be working');
  } else {
    console.log(`✅ Found ${schemaLogs.length} schema-related log entries`);
  }
  
  // Check if app init progressed past waiting for schema
  const appInitProgressed = finalState.appInit.state !== 'waitingForSchema' && finalState.appInit.state !== 'idle';
  const syncStarted = finalState.sync.state !== 'idle';
  
  console.log(`\n📋 Results:`);
  console.log(`  App init progressed: ${appInitProgressed ? '✅' : '❌'} (${finalState.appInit.state})`);
  console.log(`  Sync started: ${syncStarted ? '✅' : '❌'} (${finalState.sync.state})`);
  
  expect(true).toBe(true); // Always pass - diagnostic
});