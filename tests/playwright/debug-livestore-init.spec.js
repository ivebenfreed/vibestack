/**
 * Debug LiveStore Initialization - Find the exact error
 */
import { test } from './helpers/fixtures/persistent-context.js';

test('debug livestore initialization failure', async ({ page }) => {
  console.log('🔍 Debugging LiveStore initialization...');
  
  // Capture all console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[ERROR] ${msg.text()}`);
    }
  });
  
  await page.goto('/');
  await page.waitForTimeout(8000);
  
  // Check for initialization errors
  const initErrors = await page.evaluate(() => {
    // Look for any stored errors
    const windowErrors = window.liveStoreInitErrors || [];
    const consoleErrors = window.capturedErrors || [];
    
    return {
      windowErrors,
      consoleErrors,
      hasLiveStoreSchemaClient: !!window.liveStoreSchemaClient,
      liveStoreInstancesCount: Object.keys(window.liveStoreInstances || {}).length
    };
  });
  
  console.log('\n🚨 INITIALIZATION ERRORS:');
  console.log('Browser errors:', errors);
  console.log('Window errors:', initErrors.windowErrors);
  console.log('Console errors:', initErrors.consoleErrors);
  console.log(`LiveStore schema client exists: ${initErrors.hasLiveStoreSchemaClient}`);
  console.log(`LiveStore instances: ${initErrors.liveStoreInstancesCount}`);
  
  // Manually try to initialize LiveStore to see the error
  const manualInit = await page.evaluate(async () => {
    try {
      if (window.liveStoreSchemaClient) {
        console.log('🔄 Attempting manual LiveStore initialization...');
        const result = await window.liveStoreSchemaClient.initializeLiveStore(
          '01920000-1000-7000-8000-000000000001',
          'test-client-id'
        );
        return { success: true, result };
      } else {
        return { success: false, error: 'No liveStoreSchemaClient found' };
      }
    } catch (error) {
      return { success: false, error: error.message, stack: error.stack };
    }
  });
  
  console.log('\n🔧 MANUAL INITIALIZATION TEST:');
  console.log('Success:', manualInit.success);
  if (!manualInit.success) {
    console.log('Error:', manualInit.error);
    if (manualInit.stack) {
      console.log('Stack:', manualInit.stack);
    }
  }
});