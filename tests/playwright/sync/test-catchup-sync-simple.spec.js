import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Catchup Sync Tests', () => {
  
  test('trigger catchup sync by setting old LSN before connection', async ({ page, context }) => {
    console.log('\n=== CATCHUP SYNC TEST (OLD LSN) ===');
    
    // Set an old LSN in localStorage BEFORE navigating
    await page.goto('/'); // Need to be on the domain first
    await page.evaluate(() => {
      const oldState = {
        clientId: crypto.randomUUID(),
        currentLSN: '0/1000000' // Old LSN that will trigger catchup
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(oldState));
      console.log('Set old LSN in localStorage:', oldState);
    });
    
    // Now reload to establish connection with the old LSN
    console.log('🔄 Reloading with old LSN to trigger catchup...');
    await page.reload();
    
    // Monitor console for catchup messages
    const catchupLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('catchup')) {
        catchupLogs.push(text);
        console.log('📝 Catchup log:', text);
      }
    });
    
    // Wait for sync to complete
    await page.waitForTimeout(5000);
    
    // Check final state
    const finalState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📍 Final state:', finalState);
    console.log(`📊 Captured ${catchupLogs.length} catchup-related logs`);
    
    // The LSN should be updated from the old one
    expect(finalState.currentLSN).not.toBe('0/1000000');
    expect(finalState.currentLSN).not.toBe('0/0');
    
    console.log('✅ Catchup sync test completed!');
  });

  test('trigger initial sync by setting LSN to 0/0', async ({ page, context }) => {
    console.log('\n=== INITIAL SYNC TEST (0/0 LSN) ===');
    
    // Set LSN to 0/0 in localStorage BEFORE navigating
    await page.goto('/'); // Need to be on the domain first
    await page.evaluate(() => {
      const freshState = {
        clientId: crypto.randomUUID(),
        currentLSN: '0/0' // This should trigger initial sync
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(freshState));
      console.log('Set LSN to 0/0 in localStorage:', freshState);
    });
    
    // Now reload to establish connection with LSN 0/0
    console.log('🔄 Reloading with LSN 0/0 to trigger initial sync...');
    await page.reload();
    
    // Monitor console for initial sync messages
    const initialLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('initial')) {
        initialLogs.push(text);
        console.log('📝 Initial sync log:', text);
      }
    });
    
    // Wait for sync to complete
    await page.waitForTimeout(10000); // Initial sync takes longer
    
    // Check final state
    const finalState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    });
    
    console.log('📍 Final state:', finalState);
    console.log(`📊 Captured ${initialLogs.length} initial sync logs`);
    
    // The LSN should be updated from 0/0
    expect(finalState.currentLSN).not.toBe('0/0');
    
    console.log('✅ Initial sync test completed!');
  });
});