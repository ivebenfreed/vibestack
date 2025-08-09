import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Catchup Sync Mode Tests', () => {
  
  test('verify catchup sync triggers when client LSN is behind', async ({ page }) => {
    console.log('\n=== CATCHUP SYNC MODE TEST ===');
    
    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for initial sync to complete
    await page.waitForFunction(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return state.currentLSN && state.currentLSN !== '0/0';
    }, { timeout: 30000 });
    
    // Get the current server LSN
    const currentState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    console.log('📍 Current state:', currentState);
    
    // Simulate a client that's behind by setting an older LSN
    console.log('🔄 Simulating client behind - setting LSN to 0/1000000');
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      state.currentLSN = '0/1000000'; // Set to an old LSN
      localStorage.setItem('sync-machine-state', JSON.stringify(state));
    });
    
    // Reload the page to trigger reconnection with old LSN
    console.log('🔄 Reloading page to trigger catchup sync...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Monitor console logs for catchup sync
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('catchup') || text.includes('Catchup') || text.includes('CATCHUP')) {
        logs.push(text);
        console.log('📝 Console:', text);
      }
    });
    
    // Wait for sync to reinitialize
    await page.waitForFunction(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      // Should get a new LSN after catchup
      return state.currentLSN && state.currentLSN !== '0/1000000';
    }, { timeout: 30000 });
    
    const finalState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📍 Final state after catchup:', finalState);
    console.log('📝 Catchup logs captured:', logs.length);
    
    // Verify LSN was updated
    expect(finalState.currentLSN).not.toBe('0/1000000');
    expect(finalState.currentLSN).not.toBe('0/0');
    
    console.log('✅ Catchup sync mode test completed!');
  });
  
  test('verify initial sync triggers when client LSN is 0/0', async ({ page }) => {
    console.log('\n=== INITIAL SYNC MODE TEST ===');
    
    // Clear sync state to simulate fresh client
    await page.evaluate(() => {
      localStorage.removeItem('sync-machine-state');
      localStorage.removeItem('syncClientId');
    });
    
    // Navigate to trigger sync
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Monitor console logs for initial sync
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('initial') || text.includes('Initial') || text.includes('INITIAL')) {
        logs.push(text);
        console.log('📝 Console:', text);
      }
    });
    
    // Wait for sync to initialize from 0/0
    await page.waitForFunction(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return state.currentLSN && state.currentLSN !== '0/0';
    }, { timeout: 30000 });
    
    const finalState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📍 Final state after initial sync:', finalState);
    console.log('📝 Initial sync logs captured:', logs.length);
    
    // Verify we got a valid LSN
    expect(finalState.currentLSN).not.toBe('0/0');
    expect(finalState.clientId).toBeTruthy();
    
    console.log('✅ Initial sync mode test completed!');
  });
});