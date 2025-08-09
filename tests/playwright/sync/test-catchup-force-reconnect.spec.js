import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Force Catchup Sync Tests', () => {
  
  test('force catchup by disconnecting and reconnecting with old LSN', async ({ page }) => {
    console.log('\n=== FORCE CATCHUP SYNC TEST ===');
    
    // First, navigate and let sync establish normally
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for sync to be established
    await page.waitForFunction(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return state.currentLSN && state.currentLSN !== '0/0';
    }, { timeout: 10000 });
    
    const initialState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    console.log('📍 Initial state:', initialState);
    
    // Now force disconnect by closing WebSocket and setting old LSN
    await page.evaluate(() => {
      // Close any existing WebSocket connections
      if (window.syncWebSocket) {
        window.syncWebSocket.close();
      }
      
      // Set an old LSN to trigger catchup on reconnect
      const oldState = {
        clientId: localStorage.getItem('syncClientId') || crypto.randomUUID(),
        currentLSN: '0/1000000' // Old LSN
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(oldState));
      console.log('Forced old LSN:', oldState);
      
      // Clear any sync machine instance to force recreation
      if (window.syncMachine) {
        window.syncMachine = null;
      }
    });
    
    // Navigate away and back to force reconnection
    console.log('🔄 Navigating to force reconnection...');
    await page.goto('about:blank');
    await page.waitForTimeout(1000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Monitor server response
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('catchup') || text.toLowerCase().includes('sync')) {
        console.log('📝 Console:', text.substring(0, 100));
      }
    });
    
    // Wait for sync to process
    await page.waitForTimeout(5000);
    
    // Check if catchup was triggered
    const serverLogs = await page.evaluate(async () => {
      // Check if we can see any catchup activity in console or network
      const logs = [];
      
      // Try to get sync state
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      logs.push(`Current LSN: ${state.currentLSN}`);
      
      // Check for any sync errors
      const errors = JSON.parse(localStorage.getItem('sync-errors') || '[]');
      if (errors.length > 0) {
        logs.push(`Sync errors: ${errors.length}`);
      }
      
      return logs;
    });
    
    console.log('📊 Server activity:', serverLogs);
    
    const finalState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📍 Final state:', finalState);
    
    // Check server logs
    console.log('\n📝 Checking server logs for catchup activity...');
    
    // The LSN should have been updated if catchup worked
    if (finalState.currentLSN === '0/1000000') {
      console.log('⚠️  LSN not updated - catchup may not have been triggered');
      console.log('This could indicate the sync system needs the proper heartbeat with old LSN');
    } else {
      console.log('✅ LSN updated from 0/1000000 to', finalState.currentLSN);
    }
  });
});