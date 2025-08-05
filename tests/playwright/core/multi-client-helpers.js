// Multi-client test helpers for Playwright tests

import { waitForLSN, waitForSyncState, waitForSyncInitialized, getCurrentLSN } from './sync-test-helpers.js';
import path from 'path';
import { execSync } from 'child_process';

// Get issue number for profile directory
function getIssueNumber() {
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  try {
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    // Silent fail
  }
  
  return 'main';
}

/**
 * Create a single synced client with separate persistent context
 * @param {Browser} browser - Playwright browser object  
 * @param {string} profileSuffix - Required suffix for profile directory (must be unique)
 * @returns {Promise<object>} Client object with context and page
 */
export async function createSyncedClient(browser, profileSuffix) {
  if (!profileSuffix) {
    throw new Error('profileSuffix is required for multi-client testing to ensure separate profiles');
  }
  
  // Use separate profile for each client
  const issueNumber = getIssueNumber();
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', `profile-${issueNumber}${profileSuffix}`);
  
  console.log(`🔧 Creating client with profile: ${userDataDir}`);
  
  // Create persistent context with separate profile
  const context = await browser.browserType().launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
  });
  
  // Get the first page (persistent context might already have one)
  const page = context.pages()[0] || await context.newPage();
  
  // Navigate to app
  await page.goto('/');
  
  // Check if we need to login (new profile)
  await page.waitForTimeout(2000);
  const isLoggedIn = await page.evaluate(() => {
    return !!localStorage.getItem('sync-machine-state');
  });
  
  if (!isLoggedIn) {
    console.log(`🔐 Logging in new client profile...`);
    
    // Wait for login form and fill it
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'ben@getelevra.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForURL('/', { timeout: 15000 });
    await page.waitForTimeout(3000);
  }
  
  // Wait for sync to initialize  
  await page.waitForTimeout(5000);
  
  // Wait for sync to initialize first
  try {
    await waitForSyncInitialized(page, 15000);
    console.log(`✅ Client sync initialized`);
  } catch (error) {
    console.log(`⚠️  Client sync not initialized yet: ${error.message}`);
  }
  
  return {
    context,
    page,
    id: Math.random().toString(36).substring(7) // Simple client ID
  };
}

/**
 * Create multiple synced clients
 * @param {Browser} browser - Playwright browser object
 * @param {number} count - Number of clients to create
 * @param {object} options - Options for client creation
 * @returns {Promise<array>} Array of client objects
 */
export async function createSyncedClients(browser, count, options = {}) {
  const {
    staggerDelay = 1000, // Delay between client creation to avoid overwhelming server
    waitForSync = true
  } = options;
  
  const clients = [];
  
  for (let i = 0; i < count; i++) {
    // Stagger client creation
    if (i > 0 && staggerDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, staggerDelay));
    }
    
    const client = await createSyncedClient(browser, `-client-${i}`);
    client.index = i;
    client.name = `Client_${i}`;
    clients.push(client);
    
    console.log(`✅ Created ${client.name} (${client.id})`);
  }
  
  // Wait for all clients to be in sync
  if (waitForSync && clients.length > 1) {
    await waitForAllClientsSync(clients);
  }
  
  return clients;
}

/**
 * Wait for all clients to reach the same sync state
 * @param {array} clients - Array of client objects
 * @param {string} targetLSN - Optional specific LSN to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<void>}
 */
export async function waitForAllClientsSync(clients, targetLSN = null, timeout = 30000) {
  const startTime = Date.now();
  
  // If no target LSN, use the highest LSN among all clients
  if (!targetLSN) {
    const lsns = await Promise.all(
      clients.map(client => getCurrentLSN(client.page))
    );
    targetLSN = lsns.reduce((max, lsn) => lsn > max ? lsn : max, '0/0');
  }
  
  // Wait for all clients to reach target LSN
  const waitPromises = clients.map(async (client) => {
    const remainingTimeout = timeout - (Date.now() - startTime);
    if (remainingTimeout <= 0) {
      throw new Error(`Timeout waiting for ${client.name} to sync`);
    }
    
    await waitForLSN(client.page, targetLSN, remainingTimeout);
    console.log(`✅ ${client.name} reached LSN ${targetLSN}`);
  });
  
  await Promise.all(waitPromises);
}

/**
 * Perform an action on a specific client
 * @param {object} client - Client object
 * @param {Function} actionFn - Async function to execute (receives page as argument)
 * @returns {Promise<any>} Result of action function
 */
export async function performOnClient(client, actionFn) {
  console.log(`🔄 Performing action on ${client.name}`);
  const result = await actionFn(client.page);
  return result;
}

/**
 * Perform concurrent actions on multiple clients
 * @param {array} clients - Array of client objects
 * @param {array|Function} actionFns - Array of functions or single function to run on all
 * @returns {Promise<array>} Array of results
 */
export async function performConcurrentActions(clients, actionFns) {
  // If single function provided, use it for all clients
  if (typeof actionFns === 'function') {
    actionFns = clients.map(() => actionFns);
  }
  
  // Ensure we have the right number of functions
  if (actionFns.length !== clients.length) {
    throw new Error(`Expected ${clients.length} action functions, got ${actionFns.length}`);
  }
  
  console.log(`🔄 Performing concurrent actions on ${clients.length} clients`);
  
  // Execute all actions concurrently
  const promises = clients.map((client, index) => 
    performOnClient(client, actionFns[index])
  );
  
  return await Promise.all(promises);
}

/**
 * Verify consistency across all clients
 * @param {array} clients - Array of client objects
 * @param {Function} verifyFn - Function to extract state from each client
 * @returns {Promise<object>} Verification results
 */
export async function verifyClientConsistency(clients, verifyFn) {
  console.log(`🔍 Verifying consistency across ${clients.length} clients`);
  
  // Get state from all clients
  const states = await Promise.all(
    clients.map(async (client) => ({
      clientName: client.name,
      state: await verifyFn(client.page)
    }))
  );
  
  // Compare states
  const referenceState = JSON.stringify(states[0].state);
  const inconsistencies = [];
  
  for (let i = 1; i < states.length; i++) {
    const currentState = JSON.stringify(states[i].state);
    if (currentState !== referenceState) {
      inconsistencies.push({
        client1: states[0].clientName,
        client2: states[i].clientName,
        state1: states[0].state,
        state2: states[i].state
      });
    }
  }
  
  return {
    consistent: inconsistencies.length === 0,
    inconsistencies,
    states
  };
}

/**
 * Clean up all client contexts
 * @param {array} clients - Array of client objects
 * @returns {Promise<void>}
 */
export async function cleanupClients(clients) {
  console.log(`🧹 Cleaning up ${clients.length} clients`);
  
  const closePromises = clients.map(async (client) => {
    try {
      await client.context.close();
      console.log(`✅ Closed ${client.name}`);
    } catch (error) {
      console.error(`❌ Error closing ${client.name}:`, error);
    }
  });
  
  await Promise.all(closePromises);
}

/**
 * Wait for a specific client to see an entity
 * @param {object} client - Client object
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<object>} The entity when found
 */
export async function waitForClientToSeeEntity(client, entityType, entityId, timeout = 10000) {
  return await client.page.waitForFunction(
    async ({ entityType, entityId }) => {
      const { domainServices } = await import('/src/domain/index.js');
      const service = domainServices[entityType];
      if (!service) return null;
      
      const entity = await service.getById(entityId);
      return entity || null;
    },
    { entityType, entityId },
    { timeout }
  );
}

/**
 * Simulate network conditions for a client
 * @param {object} client - Client object
 * @param {object} conditions - Network conditions
 * @returns {Promise<void>}
 */
export async function setClientNetworkConditions(client, conditions) {
  const {
    offline = false,
    downloadThroughput = -1, // bytes/sec, -1 for no limit
    uploadThroughput = -1,
    latency = 0 // additional latency in ms
  } = conditions;
  
  // Set network conditions
  await client.page.context().route('**/*', async (route) => {
    if (offline) {
      await route.abort();
    } else {
      // Add latency
      if (latency > 0) {
        await new Promise(resolve => setTimeout(resolve, latency));
      }
      await route.continue();
    }
  });
  
  console.log(`🌐 Set network conditions for ${client.name}:`, conditions);
}

/**
 * Create clients with different network conditions
 * @param {Browser} browser - Playwright browser object
 * @param {array} configs - Array of client configurations
 * @returns {Promise<array>} Array of client objects
 */
export async function createClientsWithConditions(browser, configs) {
  const clients = [];
  
  for (const config of configs) {
    const client = await createSyncedClient(browser, config.authState);
    client.name = config.name || `Client_${clients.length}`;
    
    if (config.networkConditions) {
      await setClientNetworkConditions(client, config.networkConditions);
    }
    
    clients.push(client);
  }
  
  return clients;
}

/**
 * Get sync statistics from all clients
 * @param {array} clients - Array of client objects
 * @returns {Promise<array>} Array of sync stats per client
 */
export async function getClientSyncStats(clients) {
  return await Promise.all(
    clients.map(async (client) => {
      const lsn = await getCurrentLSN(client.page);
      const syncState = await client.page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
        return {
          state: state.state,
          isConnected: state.isConnected,
          lastSyncTime: state.lastSyncTime
        };
      });
      
      return {
        clientName: client.name,
        currentLSN: lsn,
        ...syncState
      };
    })
  );
}