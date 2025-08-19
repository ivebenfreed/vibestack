/**
 * Debug Schema Sync Initialization
 * 
 * Focuses on debugging the ServiceCoordinator schema sync initialization that's causing sync machine errors.
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test('debug schema sync initialization errors', async ({ page }) => {
  console.log('🔍 Debugging schema sync initialization...');
  
  // Navigate and set up
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }
  
  // Check for console errors related to schema sync
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('Error') || text.includes('Failed')) {
      consoleErrors.push({
        type: msg.type(),
        text: text,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  await page.waitForTimeout(5000);
  
  // Check sync machine state and error details
  const syncDetails = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      return {
        state: snapshot.value,
        context: {
          organizationId: snapshot.context.organizationId,
          clientId: snapshot.context.clientId,
          isConnected: snapshot.context.isConnected,
          error: snapshot.context.error,
          currentLSN: snapshot.context.currentLSN,
          serverLSN: snapshot.context.serverLSN,
          services: snapshot.context.services
        },
        matches: {
          error: snapshot.matches('error'),
          connecting: snapshot.matches('connecting'),
          connected: snapshot.matches('connected')
        }
      };
    }
    return null;
  });
  
  console.log('⚙️ Sync Machine Details:', JSON.stringify(syncDetails, null, 2));
  
  // Check ServiceCoordinator status specifically
  const serviceStatus = await page.evaluate(() => {
    try {
      // Try to access the global sync coordinator if available
      if (window.syncCoordinator) {
        return {
          available: true,
          health: window.syncCoordinator.getHealthStatus(),
          stats: window.syncCoordinator.getServiceStats()
        };
      }
      return { available: false };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('🔧 Service Coordinator Status:', JSON.stringify(serviceStatus, null, 2));
  
  // Look for specific LiveStore schema sync errors
  const schemaErrors = await page.evaluate(() => {
    const errors = [];
    
    // Check for LiveStore availability
    try {
      if (typeof window.LiveStore === 'undefined') {
        errors.push('LiveStore not available globally');
      }
    } catch (e) {
      errors.push(`LiveStore check error: ${e.message}`);
    }
    
    // Check for import/module errors
    try {
      // This will help us see if there are any module loading errors
      const moduleErrors = window.__moduleLoadErrors || [];
      errors.push(...moduleErrors);
    } catch (e) {
      // Module error tracking not available
    }
    
    return errors;
  });
  
  console.log('📦 Schema/Module Errors:', schemaErrors);
  
  // Console errors summary
  console.log(`🚨 Console Errors Found: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. [${error.type}] ${error.text}`);
    });
  }
  
  // Try to manually trigger sync initialization to see specific error
  const manualTriggerResult = await page.evaluate(() => {
    try {
      const syncActor = window.syncMachineActor;
      if (syncActor && syncActor.getSnapshot().matches('error')) {
        // Try to restart from error state
        console.log('Attempting manual sync restart...');
        syncActor.send({ type: 'RETRY' });
        
        // Return immediate state after retry
        const newSnapshot = syncActor.getSnapshot();
        return {
          attempted: true,
          newState: newSnapshot.value,
          newError: newSnapshot.context.error
        };
      }
      return { attempted: false, reason: 'Not in error state or no sync actor' };
    } catch (error) {
      return { attempted: false, error: error.message };
    }
  });
  
  console.log('🔄 Manual Trigger Result:', manualTriggerResult);
  
  // Wait a bit more and check final state
  await page.waitForTimeout(3000);
  
  const finalState = await page.evaluate(() => {
    const syncActor = window.syncMachineActor;
    if (syncActor) {
      const snapshot = syncActor.getSnapshot();
      return {
        state: snapshot.value,
        error: snapshot.context.error,
        isConnected: snapshot.context.isConnected
      };
    }
    return null;
  });
  
  console.log('🎯 Final Sync State:', finalState);
  
  console.log('🔍 Schema sync initialization debug completed');
});