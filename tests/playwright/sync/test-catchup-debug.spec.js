import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Debug Catchup Sync', () => {
  
  test('debug why sync is not connecting', async ({ page }) => {
    console.log('\n=== DEBUG SYNC CONNECTION ===');
    
    // Set old LSN before navigation
    await page.goto('/');
    
    // Check if sync is even initializing
    const syncStatus = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return {
        hasState: !!state,
        currentLSN: state.currentLSN,
        clientId: state.clientId,
        syncMachineExists: typeof window.syncMachine !== 'undefined',
        webSocketExists: typeof window.syncWebSocket !== 'undefined'
      };
    });
    
    console.log('Initial sync status:', syncStatus);
    
    // Set old LSN
    await page.evaluate(() => {
      const oldState = {
        clientId: crypto.randomUUID(),
        currentLSN: '0/1000000'
      };
      localStorage.setItem('sync-machine-state', JSON.stringify(oldState));
      console.log('Set old LSN:', oldState);
    });
    
    // Reload and capture network traffic
    console.log('Reloading page...');
    
    // Monitor WebSocket connections
    page.on('websocket', ws => {
      console.log('📡 WebSocket created:', ws.url());
      ws.on('framesent', frame => {
        const payload = frame.payload;
        if (payload && payload.includes('lsn') || payload.includes('LSN')) {
          console.log('→ Sent:', payload.substring(0, 200));
        }
      });
      ws.on('framereceived', frame => {
        const payload = frame.payload;
        if (payload && payload.includes('lsn') || payload.includes('LSN')) {
          console.log('← Received:', payload.substring(0, 200));
        }
      });
    });
    
    // Monitor console
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('sync') || text.includes('Sync') || text.includes('LSN') || text.includes('WebSocket')) {
        console.log('🖥️ Console:', text.substring(0, 150));
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for sync to initialize
    await page.waitForTimeout(3000);
    
    // Check sync status after reload
    const afterReload = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      
      // Try to find sync-related objects in window
      const syncObjects = [];
      for (const key in window) {
        if (key.toLowerCase().includes('sync') || key.toLowerCase().includes('websocket')) {
          syncObjects.push(key);
        }
      }
      
      return {
        state: state,
        syncObjects: syncObjects,
        hasSyncMachine: typeof window.syncMachine !== 'undefined',
        hasWebSocket: typeof window.WebSocket !== 'undefined',
        locationHref: window.location.href
      };
    });
    
    console.log('After reload status:', afterReload);
    
    // Check if /api/sync endpoint is being called
    const networkRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/sync') || request.url().includes('ws://') || request.url().includes('wss://')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
        console.log('📡 Network request to sync:', request.url());
      }
    });
    
    // Wait a bit more and check
    await page.waitForTimeout(2000);
    
    console.log('Network requests captured:', networkRequests.length);
    
    // Final check
    const finalCheck = await page.evaluate(() => {
      return {
        localStorage: JSON.parse(localStorage.getItem('sync-machine-state') || '{}'),
        syncClientId: localStorage.getItem('syncClientId'),
        allLocalStorageKeys: Object.keys(localStorage)
      };
    });
    
    console.log('Final localStorage state:', finalCheck);
    
    // Check if the app is even running properly
    const appStatus = await page.evaluate(() => {
      return {
        hasDB: typeof window.db !== 'undefined',
        hasDexie: typeof window.Dexie !== 'undefined',
        hasReact: typeof window.React !== 'undefined',
        title: document.title,
        bodyText: document.body.innerText.substring(0, 100)
      };
    });
    
    console.log('App status:', appStatus);
  });
});