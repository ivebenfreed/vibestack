/**
 * Debug Auth Persistence
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug auth persistence state', async ({ page }) => {
  console.log('🔍 Debugging auth persistence...');
  
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // Check what's in localStorage and cookies
  const storage = await page.evaluate(() => {
    return {
      authMachineState: localStorage.getItem('auth-machine-state'),
      allLocalStorage: Object.keys(localStorage).reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {}),
      cookies: document.cookie
    };
  });
  
  console.log('💾 Storage state:');
  console.log('  Auth machine state:', storage.authMachineState ? 'EXISTS' : 'MISSING');
  console.log('  All localStorage keys:', Object.keys(storage.allLocalStorage));
  console.log('  Cookies:', storage.cookies ? 'EXISTS' : 'MISSING');
  
  if (storage.authMachineState) {
    try {
      const parsed = JSON.parse(storage.authMachineState);
      console.log('  Parsed auth state:', {
        hasValue: !!parsed.value,
        hasContext: !!parsed.context,
        value: parsed.value,
        contextKeys: parsed.context ? Object.keys(parsed.context) : []
      });
    } catch (e) {
      console.log('  Failed to parse auth state:', e.message);
    }
  }
  
  // Check if we can manually trigger auth
  console.log('\n🔐 Triggering manual auth check...');
  const authResult = await page.evaluate(async () => {
    if (window.authMachineActor) {
      window.authMachineActor.send({ type: 'CHECK_AUTH' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const snapshot = window.authMachineActor.getSnapshot();
      return {
        state: snapshot.value,
        hasUser: !!snapshot.context.user,
        hasToken: !!snapshot.context.authToken,
        hasOrg: !!snapshot.context.currentOrganization
      };
    }
    return { error: 'No auth actor' };
  });
  
  console.log('  Manual auth result:', authResult);
  
  expect(true).toBe(true); // Always pass, this is diagnostic
});