/**
 * Sync API v2 - Generic sync endpoint
 * 
 * Uses the generic sync engine to handle sync for any table
 * without domain-specific code.
 */

import { Hono } from 'hono';
import { GenericSyncAdapter } from '../sync/generic-sync-adapter';
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
  try {
    const { 
      localChanges = [], 
      lastSyncTimestamp,
      clientId 
    } = await c.req.json();

    if (!clientId) {
      return c.json({
        success: false,
        error: 'clientId is required'
      }, 400);
    }

    console.log(`[Generic Sync] Processing sync for client ${clientId} with ${localChanges.length} changes`);

    // Initialize sync adapter with mock WebSocket handler
    const adapter = new GenericSyncAdapter(
      c.env.DATABASE_URL,
      new MockWebSocketHandler(),
      c.env
    );

    // Create a mock ClientChangesMessage for processing
    const message = {
      type: 'client_changes',
      clientId,
      messageId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      changes: localChanges
    };

    // Process incoming changes if any
    if (localChanges.length > 0) {
      await adapter.processIncomingChanges(message);
    }

    // Get server changes
    const lastSync = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);
    const serverChanges = await adapter.getServerChanges(clientId, lastSync);

    // Update sync metadata
    const syncVersion = new Date().toISOString();
    await adapter.updateSyncMetadata(clientId, syncVersion);

    console.log(`[Generic Sync] Completed sync for client ${clientId}: ${Object.keys(serverChanges).length} tables with changes`);

    return c.json({
      success: true,
      serverChanges,
      syncVersion,
      syncTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Generic Sync] Sync error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }, 500);
  }
});

/**
 * Get initial data for a new client
 */
syncV2Router.get('/initial', async (c) => {
  try {
    const clientId = c.req.query('clientId');
    
    if (!clientId) {
      return c.json({
        success: false,
        error: 'clientId query parameter is required'
      }, 400);
    }

    console.log(`[Generic Sync] Getting initial data for client ${clientId}`);

    const adapter = new GenericSyncAdapter(
      c.env.DATABASE_URL,
      new MockWebSocketHandler(),
      c.env
    );

    // Get all data for initial sync (from beginning of time)
    const initialData = await adapter.getServerChanges(clientId, new Date(0));

    return c.json({
      success: true,
      data: initialData,
      syncVersion: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Generic Sync] Initial sync error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Initial sync failed',
    }, 500);
  }
});

/**
 * Get changes since a specific timestamp
 */
syncV2Router.post('/changes', async (c) => {
  try {
    const { lastSyncTimestamp, clientId, tables = [] } = await c.req.json();

    if (!clientId) {
      return c.json({
        success: false,
        error: 'clientId is required'
      }, 400);
    }

    if (!lastSyncTimestamp) {
      return c.json({
        success: false,
        error: 'lastSyncTimestamp is required'
      }, 400);
    }

    console.log(`[Generic Sync] Getting changes for client ${clientId} since ${lastSyncTimestamp}`);

    const adapter = new GenericSyncAdapter(
      c.env.DATABASE_URL,
      new MockWebSocketHandler(),
      c.env
    );

    const changes = await adapter.getServerChanges(
      clientId,
      new Date(lastSyncTimestamp)
    );

    return c.json({
      success: true,
      changes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Generic Sync] Get changes error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get changes',
    }, 500);
  }
});

export default syncV2Router;