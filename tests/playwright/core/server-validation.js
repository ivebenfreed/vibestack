// Server validation helpers for Playwright tests

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Get server base URL from environment or defaults
 * @returns {string} Server URL
 */
function getServerUrl() {
  // Check if we're in a worktree and get the appropriate port
  const cwd = process.cwd();
  let port = '8787'; // Default main port
  
  const match = cwd.match(/issue-(\d+)/);
  if (match) {
    const issueNum = parseInt(match[1]);
    port = String(8787 + (issueNum * 10)); // Calculate port based on issue number
  }
  
  return `http://localhost:${process.env.SERVER_PORT || port}`;
}

/**
 * Make a request to the server API
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function serverRequest(endpoint, options = {}) {
  const url = `${getServerUrl()}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Get an entity from the server
 * @param {string} entityType - Type of entity
 * @param {string} id - Entity ID
 * @returns {Promise<object|null>} Entity or null if not found
 */
export async function getServerEntity(entityType, id) {
  try {
    // TODO: Update when server has proper entity endpoints
    const data = await serverRequest(`/api/${entityType}s/${id}`);
    return data;
  } catch (error) {
    console.error(`Failed to get ${entityType} ${id} from server:`, error);
    return null;
  }
}

/**
 * Get entity count from server
 * @param {string} entityType - Type of entity
 * @returns {Promise<number>} Count
 */
export async function getServerEntityCount(entityType) {
  try {
    // TODO: Update when server has proper count endpoints
    const data = await serverRequest(`/api/${entityType}s/count`);
    return data.count || 0;
  } catch (error) {
    console.error(`Failed to get ${entityType} count from server:`, error);
    return 0;
  }
}

/**
 * Validate that client and server have the same entity state
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {string} id - Entity ID
 * @returns {Promise<object>} Validation result
 */
export async function validateClientServerParity(page, entityType, id) {
  // Get entity from client
  const clientEntity = await page.evaluate(async ({ entityType, id }) => {
    const { domainServices } = await import('/src/domain/index.js');
    const service = domainServices[entityType];
    if (!service) return null;
    return await service.getById(id);
  }, { entityType, id });
  
  // Get entity from server
  const serverEntity = await getServerEntity(entityType, id);
  
  // Compare key fields
  const result = {
    clientExists: !!clientEntity,
    serverExists: !!serverEntity,
    matches: false,
    differences: []
  };
  
  if (clientEntity && serverEntity) {
    // Compare common fields
    const fieldsToCompare = ['id', 'title', 'name', 'status', 'description'];
    
    for (const field of fieldsToCompare) {
      if (field in clientEntity && field in serverEntity) {
        if (clientEntity[field] !== serverEntity[field]) {
          result.differences.push({
            field,
            client: clientEntity[field],
            server: serverEntity[field]
          });
        }
      }
    }
    
    result.matches = result.differences.length === 0;
  }
  
  return result;
}

/**
 * Get current LSN from server
 * @returns {Promise<string>} Server LSN
 */
export async function getServerLSN() {
  try {
    // TODO: Update when server has proper LSN endpoint
    const data = await serverRequest('/api/sync/lsn');
    return data.lsn || '0/0';
  } catch (error) {
    console.error('Failed to get server LSN:', error);
    return '0/0';
  }
}

/**
 * Get server sync state
 * @returns {Promise<object>} Server sync state
 */
export async function getServerSyncState() {
  try {
    // TODO: Update when server has proper sync state endpoint
    const data = await serverRequest('/api/sync/state');
    return data;
  } catch (error) {
    console.error('Failed to get server sync state:', error);
    return { error: error.message };
  }
}

/**
 * Capture server logs using tmux scripts
 * @param {number} lines - Number of lines to capture (default: 50)
 * @returns {Promise<string>} Server logs
 */
export async function captureServerLogs(lines = 50) {
  try {
    // Determine the correct session name based on current directory
    const cwd = process.cwd();
    let sessionName = 'vibestack-dev-main';
    
    // Check if we're in a worktree
    const match = cwd.match(/issue-(\d+)/);
    if (match) {
      sessionName = `vibestack-dev-issue-${match[1]}`;
    }
    
    // Use the dev-logs script
    const { stdout } = await execPromise(`./scripts/dev-logs.sh ${lines}`);
    return stdout;
  } catch (error) {
    console.error('Failed to capture server logs:', error);
    return '';
  }
}

/**
 * Find sync events in server logs
 * @param {string} entityId - Entity ID to search for (optional)
 * @param {number} lines - Number of log lines to search (default: 200)
 * @returns {Promise<array>} Array of matching log lines
 */
export async function findSyncEventsInLogs(entityId = null, lines = 200) {
  const logs = await captureServerLogs(lines);
  const logLines = logs.split('\n');
  
  // If entityId provided, look for it specifically
  if (entityId) {
    return logLines.filter(line => 
      line.includes(entityId) && 
      (line.includes('sync') || line.includes('replication') || line.includes('LSN'))
    );
  }
  
  // Otherwise, return all sync-related logs
  return logLines.filter(line => 
    line.includes('sync') || 
    line.includes('replication') || 
    line.includes('LSN') ||
    line.includes('catchup') ||
    line.includes('live mode') ||
    line.includes('server-changes')
  );
}

/**
 * Get the latest sync operation from logs
 * @param {number} lines - Number of log lines to search (default: 100)
 * @returns {Promise<object>} Latest sync operation details
 */
export async function getLatestSyncOperation(lines = 100) {
  const syncLogs = await findSyncEventsInLogs(null, lines);
  
  // Parse sync operation logs
  const operations = [];
  
  for (const log of syncLogs) {
    // Match catchup sync start
    if (log.includes('Starting catchup sync')) {
      const lsnMatch = log.match(/"clientLSN":\s*"([^"]+)"/);
      const clientMatch = log.match(/"clientId":\s*"([^"]+)"/);
      operations.push({
        type: 'catchup_start',
        clientId: clientMatch ? clientMatch[1] : null,
        clientLSN: lsnMatch ? lsnMatch[1] : null,
        log
      });
    }
    
    // Match catchup completion
    if (log.includes('Catchup sync completed')) {
      const startMatch = log.match(/"startLSN":\s*"([^"]+)"/);
      const finalMatch = log.match(/"finalLSN":\s*"([^"]+)"/);
      const countMatch = log.match(/"totalChangeCount":\s*(\d+)/);
      operations.push({
        type: 'catchup_complete',
        startLSN: startMatch ? startMatch[1] : null,
        finalLSN: finalMatch ? finalMatch[1] : null,
        changeCount: countMatch ? parseInt(countMatch[1]) : 0,
        log
      });
    }
    
    // Match replication polling
    if (log.includes('replication:polling')) {
      const lsnMatch = log.match(/"currentStoredLSN":\s*"([^"]+)"/);
      operations.push({
        type: 'replication_poll',
        currentLSN: lsnMatch ? lsnMatch[1] : null,
        log
      });
    }
  }
  
  return operations.length > 0 ? operations[operations.length - 1] : null;
}

/**
 * Validate sync sequence in server logs
 * @param {string} entityId - Entity ID to validate
 * @returns {Promise<object>} Validation result
 */
export async function validateSyncSequence(entityId) {
  const logs = await captureServerLogs(500);
  
  // Expected sequence patterns
  const expectedPatterns = [
    `entity_id.*${entityId}`,
    `Processing.*${entityId}`,
    'LSN advanced',
    'Broadcast.*change'
  ];
  
  const result = {
    valid: true,
    foundPatterns: [],
    missingPatterns: [],
    relevantLogs: []
  };
  
  // Find relevant logs
  const logLines = logs.split('\n');
  result.relevantLogs = logLines.filter(line => line.includes(entityId));
  
  // Check for expected patterns
  for (const pattern of expectedPatterns) {
    const regex = new RegExp(pattern, 'i');
    const found = result.relevantLogs.some(line => regex.test(line));
    
    if (found) {
      result.foundPatterns.push(pattern);
    } else {
      result.missingPatterns.push(pattern);
      result.valid = false;
    }
  }
  
  return result;
}

/**
 * Get server database statistics
 * @returns {Promise<object>} Database statistics
 */
export async function getServerDatabaseStats() {
  try {
    // TODO: Update when server has proper stats endpoint
    const data = await serverRequest('/api/debug/db-stats');
    return data;
  } catch (error) {
    console.error('Failed to get server database stats:', error);
    return { error: error.message };
  }
}

/**
 * Execute a raw SQL query on the server (dev only)
 * @param {string} query - SQL query
 * @returns {Promise<any>} Query results
 */
export async function executeServerQuery(query) {
  try {
    // TODO: Update when server has proper query endpoint
    const data = await serverRequest('/api/debug/query', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
    return data.results;
  } catch (error) {
    console.error('Failed to execute server query:', error);
    return null;
  }
}

/**
 * Wait for server to process a change
 * @param {string} entityId - Entity ID to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<boolean>} True if change was processed
 */
export async function waitForServerProcessing(entityId, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const events = await findSyncEventsInLogs(entityId, 100);
    if (events.length > 0) {
      return true;
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

/**
 * Compare entity counts between client and server
 * @param {Page} page - Playwright page object
 * @returns {Promise<object>} Comparison results
 */
export async function compareEntityCounts(page) {
  const entityTypes = ['task', 'project', 'user', 'comment'];
  const results = {};
  
  for (const entityType of entityTypes) {
    // Get client count
    const clientCount = await page.evaluate(async (type) => {
      const { db } = await import('/src/domain/index.js');
      const table = db[type + 's'];
      return table ? await table.count() : 0;
    }, entityType);
    
    // Get server count
    const serverCount = await getServerEntityCount(entityType);
    
    results[entityType] = {
      client: clientCount,
      server: serverCount,
      matches: clientCount === serverCount
    };
  }
  
  return results;
}

/**
 * Capture server logs between two timestamps
 * @param {Date} startTime - Start timestamp
 * @param {Date} endTime - End timestamp
 * @returns {Promise<string>} Filtered logs
 */
export async function getLogsBetween(startTime, endTime) {
  const logs = await captureServerLogs(1000);
  const logLines = logs.split('\n');
  
  // Filter logs by timestamp
  // This is a simplified implementation - actual timestamp parsing depends on log format
  const filteredLines = logLines.filter(line => {
    // Extract timestamp from log line (adjust pattern based on actual log format)
    const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    if (!timestampMatch) return false;
    
    const logTime = new Date(timestampMatch[1]);
    return logTime >= startTime && logTime <= endTime;
  });
  
  return filteredLines.join('\n');
}

/**
 * Monitor server health
 * @returns {Promise<object>} Health status
 */
export async function getServerHealth() {
  try {
    const response = await fetch(`${getServerUrl()}/health`);
    return {
      healthy: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Monitor server logs during test execution
 * @param {Function} testFn - Test function to execute
 * @param {object} options - Monitoring options
 * @returns {Promise<object>} Test result and captured logs
 */
export async function monitorServerLogsDuring(testFn, options = {}) {
  const { 
    includePatterns = [], // Patterns to include in logs
    excludePatterns = [], // Patterns to exclude from logs
    captureLines = 100 
  } = options;
  
  // Capture initial log position
  const beforeLogs = await captureServerLogs(10);
  const beforeLineCount = beforeLogs.split('\n').length;
  
  // Execute test function
  const startTime = new Date();
  let testResult;
  let testError;
  
  try {
    testResult = await testFn();
  } catch (error) {
    testError = error;
  }
  
  const endTime = new Date();
  
  // Capture logs after test
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for logs to flush
  const afterLogs = await captureServerLogs(captureLines);
  const allLogLines = afterLogs.split('\n');
  
  // Filter logs from during the test
  let relevantLogs = allLogLines.slice(-captureLines);
  
  // Apply include filters
  if (includePatterns.length > 0) {
    relevantLogs = relevantLogs.filter(line => 
      includePatterns.some(pattern => line.includes(pattern))
    );
  }
  
  // Apply exclude filters
  if (excludePatterns.length > 0) {
    relevantLogs = relevantLogs.filter(line => 
      !excludePatterns.some(pattern => line.includes(pattern))
    );
  }
  
  const result = {
    testResult,
    testError,
    duration: endTime - startTime,
    logs: relevantLogs,
    logSummary: {
      total: relevantLogs.length,
      errors: relevantLogs.filter(l => l.includes('ERROR')).length,
      warnings: relevantLogs.filter(l => l.includes('WARN')).length
    }
  };
  
  // Re-throw error if test failed
  if (testError) {
    result.logs = relevantLogs; // Attach logs to error for debugging
    throw testError;
  }
  
  return result;
}