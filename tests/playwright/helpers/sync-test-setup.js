/**
 * Modular sync test setup helpers
 * Provides clean, reusable setup for different sync scenarios
 */

/**
 * Clear all sync state for a fresh start
 */
export async function clearAllSyncState(page) {
  const result = await page.evaluate(() => {
    if (window.testSyncHelpers) {
      // Use the proper test helper
      const success = window.testSyncHelpers.resetToFreshState();
      const afterState = localStorage.getItem('sync-machine-state');
      return {
        success,
        afterState,
        method: 'testSyncHelpers'
      };
    } else {
      // Fallback to direct removal
      const beforeState = localStorage.getItem('sync-machine-state');
      localStorage.removeItem('sync-machine-state');
      const afterState = localStorage.getItem('sync-machine-state');
      return {
        success: afterState === null,
        beforeState,
        afterState,
        method: 'direct'
      };
    }
  });
  
  console.log(`🧹 Cleared sync state using ${result.method}:`);
  console.log(`   Success: ${result.success}`);
  console.log(`   After state: ${result.afterState ? 'STILL EXISTS!' : 'cleared'}`);
  
  if (!result.success) {
    throw new Error('Failed to clear sync state!');
  }
}

/**
 * Setup for initial sync test - completely fresh state
 */
export async function setupInitialSync(page) {
  console.log('📦 Setting up for initial sync test (fresh state)...');
  
  // First navigate to the page
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Wait for initial load
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Now clear everything
  await clearAllSyncState(page);
  
  // Reload to start fresh
  await page.reload({ waitUntil: 'domcontentloaded' });
  
  // Wait for app to be ready again
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  console.log('✅ Ready for initial sync test');
}

/**
 * Setup for catchup sync test - set an older LSN
 */
export async function setupCatchupSync(page, targetLSN = '0/100000') {
  console.log(`📦 Setting up for catchup sync test (LSN: ${targetLSN})...`);
  
  // First ensure we have a normal sync state
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Wait for initial sync to complete
  await page.waitForTimeout(3000);
  
  // Force set an older LSN using the proper test helper
  const success = await page.evaluate((lsn) => {
    if (window.testSyncHelpers) {
      // Use forceSetSyncState to ensure we set a valid LSN
      return window.testSyncHelpers.forceSetSyncState(lsn);
    }
    // Fallback
    const state = localStorage.getItem('sync-machine-state');
    if (state) {
      const parsed = JSON.parse(state);
      parsed.currentLSN = lsn;
      localStorage.setItem('sync-machine-state', JSON.stringify(parsed));
      return true;
    }
    return false;
  }, targetLSN);
  
  if (!success) {
    throw new Error('Failed to set LSN for catchup test');
  }
  
  // Reload to trigger catchup
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  console.log('✅ Ready for catchup sync test');
}

/**
 * Setup for live sync test - ensure we're in a synced state
 */
export async function setupLiveSync(page) {
  console.log('📦 Setting up for live sync test...');
  
  // Navigate and wait for sync to stabilize
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    return document.body.getAttribute('data-playwright-ready') === 'true';
  }, { timeout: 30000 });
  
  // Wait for any initial sync to complete
  await page.waitForTimeout(3000);
  
  console.log('✅ Ready for live sync test');
}

/**
 * Setup console log capture for sync events
 */
export function setupSyncLogCapture(page) {
  const syncLogs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    // Capture sync-related logs
    if (text.includes('sync') || 
        text.includes('Sync') || 
        text.includes('SYNC') ||
        text.includes('LSN') ||
        text.includes('catchup') ||
        text.includes('initial') ||
        text.includes('WebSocket') ||
        text.includes('srv_') ||
        text.includes('clt_') ||
        text.includes('Fetching') ||
        text.includes('Received') ||
        text.includes('Applied')) {
      syncLogs.push({
        type: msg.type(),
        text: text,
        time: new Date().toISOString()
      });
      console.log(`  [BROWSER] ${text}`);
    }
  });
  
  return syncLogs;
}

/**
 * Analyze sync logs for specific patterns
 */
export function analyzeSyncLogs(syncLogs) {
  const analysis = {
    hasInitialSync: false,
    hasCatchupSync: false,
    hasLiveSync: false,
    hasWebSocket: false,
    hasFetching: false,
    hasReceived: false,
    hasApplied: false,
    hasCompleted: false,
    entityCounts: {},
    errors: []
  };
  
  syncLogs.forEach(log => {
    const text = log.text.toLowerCase();
    
    // Detect sync phases
    if (text.includes('initial sync') || text.includes('srv_init')) {
      analysis.hasInitialSync = true;
    }
    if (text.includes('catchup') || text.includes('srv_catchup') || text.includes('behind')) {
      analysis.hasCatchupSync = true;
    }
    if (text.includes('live sync') || text.includes('srv_live')) {
      analysis.hasLiveSync = true;
    }
    
    // Detect operations
    if (text.includes('websocket') && text.includes('connected')) {
      analysis.hasWebSocket = true;
    }
    if (text.includes('fetching') || text.includes('fetch')) {
      analysis.hasFetching = true;
    }
    if (text.includes('received')) {
      analysis.hasReceived = true;
    }
    if (text.includes('applied') || text.includes('saved')) {
      analysis.hasApplied = true;
    }
    if (text.includes('complete') || text.includes('finished')) {
      analysis.hasCompleted = true;
    }
    
    // Detect errors
    if (log.type === 'error' || text.includes('error') || text.includes('failed')) {
      analysis.errors.push(log.text);
    }
    
    // Extract entity counts
    const entityMatch = text.match(/(\d+)\s+(tasks?|projects?|users?|comments?)/);
    if (entityMatch) {
      const [, count, entity] = entityMatch;
      analysis.entityCounts[entity] = parseInt(count);
    }
  });
  
  return analysis;
}

/**
 * Wait for sync to stabilize (no more rapid log activity)
 */
export async function waitForSyncToStabilize(page, timeout = 5000) {
  console.log(`⏳ Waiting ${timeout}ms for sync to stabilize...`);
  await page.waitForTimeout(timeout);
}