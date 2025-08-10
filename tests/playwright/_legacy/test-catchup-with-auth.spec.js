import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Catchup Sync with Authentication', () => {
  
  test('login and test catchup sync with old LSN', async ({ page }) => {
    console.log('\n=== CATCHUP SYNC TEST WITH AUTH ===');
    
    // First ensure we're logged in
    await page.goto('/');
    
    // Check if we're on the login page
    const isLoginPage = await page.evaluate(() => window.location.pathname.includes('sign-in'));
    
    if (isLoginPage) {
      console.log('📝 Logging in...');
      
      // Fill in login form
      await page.fill('input[type="email"]', 'ben+persistent@benfreed.com');
      await page.fill('input[type="password"]', 'root123');
      await page.click('button[type="submit"]');
      
      // Wait for redirect to main app
      await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
      console.log('✅ Logged in successfully');
    }
    
    // Now we should be in the main app
    // Set old LSN to trigger catchup
    await page.evaluate(() => {
      const oldState = {
        clientId: crypto.randomUUID(),
        currentLSN: '0/1000000'  // Old LSN
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(oldState));
      console.log('Set old LSN:', oldState);
    });
    
    // Monitor WebSocket and console
    page.on('websocket', ws => {
      console.log('📡 WebSocket connected:', ws.url());
    });
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.toLowerCase().includes('catchup') || text.includes('LSN')) {
        console.log('🖥️ Console:', text.substring(0, 150));
      }
    });
    
    // Reload to trigger sync with old LSN
    console.log('🔄 Reloading to trigger sync...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait for sync to process
    await page.waitForTimeout(5000);
    
    // Check final state
    const finalState = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return {
        ...state,
        location: window.location.pathname,
        authenticated: !window.location.pathname.includes('sign-in')
      };
    });
    
    console.log('📍 Final state:', finalState);
    
    // Check if catchup was triggered
    if (finalState.currentLSN !== '0/1000000') {
      console.log('✅ LSN updated from 0/1000000 to', finalState.currentLSN);
      console.log('✅ Catchup sync likely triggered!');
    } else {
      console.log('⚠️ LSN still at 0/1000000');
    }
    
    // Also check server logs
    console.log('\n📝 Check server logs with:');
    console.log('./scripts/bg-logs.sh vibestack-dev-main 100 | grep -i "catchup\\|0/1000000"');
  });
});