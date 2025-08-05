// Sync test helpers for Playwright tests

/**
 * Get current sync state from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<object>} Sync state object
 */
export async function getSyncState(page) {
  return await page.evaluate(() => {
    const syncState = localStorage.getItem('sync-machine-state');
    return syncState ? JSON.parse(syncState) : { state: 'not_initialized', currentLSN: '0/0' };
  });
}

/**
 * Wait for a specific LSN value
 * @param {Page} page - Playwright page object
 * @param {string} targetLSN - Target LSN to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<void>}
 */
export async function waitForLSN(page, targetLSN, timeout = 30000) {
  await page.waitForFunction(
    (lsn) => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return state.currentLSN && state.currentLSN >= lsn;
    },
    targetLSN,
    { timeout }
  );
}

/**
 * Wait for a specific sync state
 * @param {Page} page - Playwright page object
 * @param {string} state - State to wait for (e.g., 'live', 'catchup', 'initial')
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<void>}
 */
export async function waitForSyncState(page, state, timeout = 30000) {
  await page.waitForFunction(
    (expectedState) => {
      const syncState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return syncState.state === expectedState;
    },
    state,
    { timeout }
  );
}

/**
 * Force a sync catchup operation
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function forceSyncCatchup(page) {
  await page.evaluate(async () => {
    const { domainServices } = await import('/src/domain/index.js');
    // Trigger sync by creating a dummy operation
    const timestamp = Date.now();
    await domainServices.task.createUI({
      title: `_SYNC_TRIGGER_${timestamp}`,
      status: 'pending'
    });
    // Immediately delete to avoid test pollution
    const tasks = await domainServices.task.getAll();
    const triggerTask = tasks.find(t => t.title === `_SYNC_TRIGGER_${timestamp}`);
    if (triggerTask) {
      await domainServices.task.deleteUI(triggerTask.id);
    }
  });
}

/**
 * Disconnect sync (simulate offline)
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function disconnectSync(page) {
  await page.evaluate(() => {
    // Set offline in service worker if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE', offline: true });
    }
    
    // Trigger offline event
    window.dispatchEvent(new Event('offline'));
    
    // Update sync state to reflect disconnection
    const currentState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    currentState.isConnected = false;
    currentState.state = 'offline';
    localStorage.setItem('sync-machine-state', JSON.stringify(currentState));
  });
}

/**
 * Reconnect sync (simulate online)
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function reconnectSync(page) {
  await page.evaluate(() => {
    // Set online in service worker if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE', offline: false });
    }
    
    // Trigger online event
    window.dispatchEvent(new Event('online'));
    
    // Update sync state to reflect reconnection
    const currentState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    currentState.isConnected = true;
    currentState.state = 'catchup';
    localStorage.setItem('sync-machine-state', JSON.stringify(currentState));
  });
}

/**
 * Get sync metrics and statistics
 * @param {Page} page - Playwright page object
 * @returns {Promise<object>} Sync metrics
 */
export async function getSyncMetrics(page) {
  return await page.evaluate(async () => {
    const { db } = await import('/src/domain/index.js');
    const syncState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
    
    const metrics = {
      currentLSN: syncState.currentLSN || '0/0',
      state: syncState.state || 'unknown',
      isConnected: syncState.isConnected !== false,
      lastSyncTime: syncState.lastSyncTime,
      pendingChanges: 0,
      totalChanges: 0,
      changesByOperation: {}
    };
    
    try {
      // Count pending changes
      metrics.pendingChanges = await db.outgoing_change_queue.count();
      
      // Count total changes
      metrics.totalChanges = await db.change_history.count();
      
      // Group changes by operation
      await db.change_history.each(change => {
        metrics.changesByOperation[change.operation] = 
          (metrics.changesByOperation[change.operation] || 0) + 1;
      });
    } catch (error) {
      console.error('Error getting sync metrics:', error);
    }
    
    return metrics;
  });
}

/**
 * Wait for a specific entity to sync
 * @param {Page} page - Playwright page object
 * @param {string} entityId - Entity ID to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<void>}
 */
export async function waitForEntitySync(page, entityId, timeout = 10000) {
  await page.waitForFunction(
    async (id) => {
      const { db } = await import('/src/domain/index.js');
      // Check if entity exists in change history
      const change = await db.change_history
        .where('entity_id')
        .equals(id)
        .last();
      return !!change;
    },
    entityId,
    { timeout }
  );
}

/**
 * Monitor sync events during a callback execution
 * @param {Page} page - Playwright page object
 * @param {Function} callback - Async function to execute while monitoring
 * @returns {Promise<object>} Captured sync events
 */
export async function monitorSyncEvents(page, callback) {
  // Set up event monitoring
  await page.evaluate(() => {
    window.syncEventLog = [];
    window.syncEventHandlers = {
      stateChange: (event) => {
        window.syncEventLog.push({
          type: 'stateChange',
          timestamp: new Date().toISOString(),
          oldState: event.oldState,
          newState: event.newState
        });
      },
      lsnUpdate: (event) => {
        window.syncEventLog.push({
          type: 'lsnUpdate',
          timestamp: new Date().toISOString(),
          oldLSN: event.oldLSN,
          newLSN: event.newLSN
        });
      },
      syncError: (event) => {
        window.syncEventLog.push({
          type: 'error',
          timestamp: new Date().toISOString(),
          error: event.error
        });
      }
    };
    
    // TODO: Hook into actual sync events when available
    // For now, poll localStorage for changes
    window.syncMonitorInterval = setInterval(() => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      const lastState = window.lastSyncState || {};
      
      if (state.state !== lastState.state) {
        window.syncEventHandlers.stateChange({
          oldState: lastState.state,
          newState: state.state
        });
      }
      
      if (state.currentLSN !== lastState.currentLSN) {
        window.syncEventHandlers.lsnUpdate({
          oldLSN: lastState.currentLSN,
          newLSN: state.currentLSN
        });
      }
      
      window.lastSyncState = { ...state };
    }, 100);
  });
  
  // Execute callback
  let result;
  try {
    result = await callback();
  } finally {
    // Clean up and get events
    const events = await page.evaluate(() => {
      clearInterval(window.syncMonitorInterval);
      const log = window.syncEventLog;
      delete window.syncEventLog;
      delete window.syncEventHandlers;
      delete window.syncMonitorInterval;
      delete window.lastSyncState;
      return log;
    });
    
    return {
      result,
      events
    };
  }
}

/**
 * Get the current LSN from sync state
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} Current LSN value
 */
export async function getCurrentLSN(page) {
  const syncState = await getSyncState(page);
  return syncState?.currentLSN || '0/0';
}

/**
 * Check if sync is in live state
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if in live state
 */
export async function isSyncLive(page) {
  const syncState = await getSyncState(page);
  return syncState?.state === 'live';
}

/**
 * Wait for sync to complete initial load
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in milliseconds (default: 60000)
 * @returns {Promise<void>}
 */
export async function waitForInitialSync(page, timeout = 60000) {
  // First wait for any sync state
  await page.waitForFunction(
    () => {
      const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return state.state && state.state !== 'initial';
    },
    { timeout }
  );
  
  // Then wait for live state
  await waitForSyncState(page, 'live', timeout);
}