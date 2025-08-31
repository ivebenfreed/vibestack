/**
 * Sync API v2 - Generic sync endpoint
 * 
 * Uses the generic sync engine to handle sync for any table
 * without domain-specific code.
 */

import { Hono } from 'hono';
// import { GenericSyncAdapter } from '../sync/generic-sync-adapter';
import type { AppBindings } from '../types/hono';

const syncV2Router = new Hono<AppBindings>();

// Mock WebSocket handler for HTTP endpoints
class MockWebSocketHandler {
  async sendMessage(clientId: string, message: any): Promise<void> {
    // For HTTP endpoints, we don't send WebSocket messages
    console.log(`[HTTP Sync] Would send to ${clientId}:`, message.type);
  }
}

/**
 * Health check for sync service
 */
syncV2Router.get('/health', async (c) => {
  try {
    return c.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Generic sync engine v2 operational'
    });
  } catch (error) {
    return c.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
    }, 500);
  }
});

/**
 * Process sync from client
 * Accepts local changes and returns server changes
 */
syncV2Router.post('/sync', async (c) => {
  return c.json({
    success: false,
    error: 'Sync v2 endpoint temporarily disabled - sync components removed'
  }, 503);
});

/**
 * Get initial data for a new client
 */
syncV2Router.get('/initial', async (c) => {
  return c.json({
    success: false,
    error: 'Initial sync endpoint temporarily disabled - sync components removed'
  }, 503);
});

/**
 * Get changes since a specific timestamp
 */
syncV2Router.post('/changes', async (c) => {
  return c.json({
    success: false,
    error: 'Changes endpoint temporarily disabled - sync components removed'
  }, 503);
});

export default syncV2Router;