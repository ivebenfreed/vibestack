/**
 * Test LiveStore Async Initialization
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Verify LiveStore initializes asynchronously after sync machine', async ({ page }) => {
  console.log('🧪 Testing LiveStore async initialization...');
  
  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }

  // Wait for sync machine to connect
  console.log('⏳ Waiting for sync machine to connect...');
  let syncConnected = false;
  let attempts = 0;
  
  while (!syncConnected && attempts < 10) {
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
    
    if (syncState && syncState.isConnected && syncState.organizationId) {
      syncConnected = true;
      console.log('✅ Sync machine connected successfully!');
      console.log(`🏢 Organization ID: ${syncState.organizationId}`);
    } else {
      attempts++;
      await page.waitForTimeout(2000);
    }
  }

  if (!syncConnected) {
    throw new Error('Sync machine failed to connect');
  }

  // Now wait for LiveStore async initialization (should happen after 2 seconds)
  console.log('⏳ Waiting for LiveStore async initialization (up to 15 seconds)...');
  
  let liveStoreReady = false;
  let liveStoreAttempts = 0;
  
  // Listen for LiveStore ready event
  await page.evaluate(() => {
    window.liveStoreReadyPromise = new Promise((resolve) => {
      const handler = (event) => {
        console.log('🎉 LiveStore async ready event received:', event.detail);
        resolve(event.detail);
        window.removeEventListener('livestore:async:ready', handler);
      };
      window.addEventListener('livestore:async:ready', handler);
      
      // Also listen for the original ready event
      const originalHandler = (event) => {
        console.log('🎉 LiveStore ready event received:', event.detail);
        resolve(event.detail);
        window.removeEventListener('livestore:ready', originalHandler);
      };
      window.addEventListener('livestore:ready', originalHandler);
    });
  });

  // Wait for LiveStore to become available or timeout
  const liveStoreResult = await page.evaluate(async () => {
    try {
      // Wait for ready event or timeout after 15 seconds
      const readyEventPromise = window.liveStoreReadyPromise;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LiveStore initialization timeout')), 15000)
      );
      
      const result = await Promise.race([readyEventPromise, timeoutPromise]);
      
      // Additional verification that LiveStore is actually available
      const liveStoreAvailable = typeof window.LiveStore !== 'undefined';
      
      return {
        success: true,
        liveStoreAvailable,
        eventData: result,
        liveStoreType: typeof window.LiveStore
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        liveStoreAvailable: typeof window.LiveStore !== 'undefined',
        liveStoreType: typeof window.LiveStore
      };
    }
  });

  console.log('🎯 LiveStore async initialization result:', liveStoreResult);

  if (liveStoreResult.success && liveStoreResult.liveStoreAvailable) {
    console.log('✅ LiveStore initialized successfully asynchronously!');
    
    // Test basic LiveStore functionality
    const functionalityTest = await page.evaluate(async () => {
      try {
        if (!window.LiveStore) {
          return { success: false, error: 'LiveStore not available' };
        }

        // Test ready method
        await window.LiveStore.ready();
        
        // Test basic query
        const tables = await window.LiveStore.query(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        return {
          success: true,
          tableCount: tables.length,
          tables: tables.slice(0, 5) // First 5 tables
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    console.log('🧪 LiveStore functionality test:', functionalityTest);
    
    if (functionalityTest.success) {
      console.log(`✅ LiveStore is fully functional with ${functionalityTest.tableCount} tables!`);
    } else {
      console.warn('⚠️ LiveStore available but functionality test failed:', functionalityTest.error);
    }
  } else {
    console.error('❌ LiveStore async initialization failed:', liveStoreResult.error);
    
    // Check if there were any console errors during initialization
    const consoleErrors = await page.evaluate(() => {
      return window.liveStoreInitErrors || [];
    });
    
    if (consoleErrors.length > 0) {
      console.error('🚨 LiveStore initialization errors:', consoleErrors);
    }
    
    throw new Error(`LiveStore async initialization failed: ${liveStoreResult.error}`);
  }

  console.log('🎉 LiveStore async initialization test completed successfully!');
});