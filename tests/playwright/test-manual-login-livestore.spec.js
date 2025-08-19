/**
 * Manual Login and LiveStore Test
 */

import { test, expect } from '@playwright/test'; // Use fresh context

test('Manual login and LiveStore initialization', async ({ page }) => {
  console.log('🧪 Testing manual login and LiveStore...');
  
  // Navigate to the app
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Check if we need to log in
  const needsLogin = await page.locator('text=Sign in').isVisible({ timeout: 5000 });
  
  if (needsLogin) {
    console.log('🔐 Logging in manually...');
    
    // Click sign in
    await page.locator('text=Sign in').click();
    await page.waitForTimeout(2000);
    
    // Fill in Wide Corp CEO credentials
    await page.locator('input[type="email"]').fill('ceo@widecorp.com');
    await page.locator('input[type="password"]').fill('WideCorp2024!CEO');
    
    // Submit login
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
  } else {
    console.log('🔐 Already logged in');
  }
  
  // Check if we need to select organization
  const needsOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 5000 });
  
  if (needsOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(5000);
  } else {
    console.log('🏢 Organization already selected');
  }
  
  // Now wait for sync machine to connect
  console.log('⏳ Waiting for sync machine...');
  let syncConnected = false;
  let attempts = 0;
  
  while (!syncConnected && attempts < 15) {
    const syncState = await page.evaluate(() => {
      const syncActor = window.syncMachineActor;
      if (syncActor) {
        const snapshot = syncActor.getSnapshot();
        return {
          state: snapshot.value,
          organizationId: snapshot.context.organizationId,
          isConnected: snapshot.context.isConnected
        };
      }
      return null;
    });
    
    console.log(`🔄 Sync State (attempt ${attempts + 1}):`, syncState);
    
    if (syncState && syncState.isConnected && syncState.organizationId) {
      syncConnected = true;
      console.log('✅ Sync machine connected successfully!');
    } else {
      attempts++;
      await page.waitForTimeout(2000);
    }
  }
  
  if (!syncConnected) {
    throw new Error('Sync machine failed to connect after manual login');
  }
  
  // Wait longer for LiveStore async initialization
  console.log('⏳ Waiting for LiveStore async initialization (15 seconds)...');
  await page.waitForTimeout(15000);
  
  // Check LiveStore
  const liveStoreState = await page.evaluate(async () => {
    if (typeof window.LiveStore !== 'undefined') {
      try {
        await window.LiveStore.ready();
        const tables = await window.LiveStore.query("SELECT name FROM sqlite_master WHERE type='table'");
        return {
          available: true,
          tablesFound: tables.length,
          tables: tables.slice(0, 3)
        };
      } catch (error) {
        return {
          available: true,
          error: error.message
        };
      }
    } else {
      return { available: false };
    }
  });
  
  console.log('🎯 LiveStore state:', liveStoreState);
  
  if (liveStoreState.available) {
    console.log('✅ LiveStore is working!');
    if (liveStoreState.tablesFound !== undefined) {
      console.log(`📊 Found ${liveStoreState.tablesFound} tables`);
    }
  } else {
    throw new Error('LiveStore failed to initialize after manual login and sync connection');
  }
});