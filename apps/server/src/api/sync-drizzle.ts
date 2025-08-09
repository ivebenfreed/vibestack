import { Hono } from 'hono';
import { processIncomingChanges, getChangesForSync } from '../sync/incoming-changes-drizzle.js';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all sync routes
app.use('*', requireAuth);

// POST /sync/changes - Process incoming changes from client
app.post('/changes', async (c) => {
  try {
    const changes = await c.req.json();
    
    // Validate the payload structure
    if (!changes.changes || !Array.isArray(changes.changes)) {
      return c.json({ error: 'Invalid changes payload' }, 400);
    }
    
    // Process the changes
    const result = await processIncomingChanges(changes);
    
    return c.json({
      success: true,
      accepted: result.accepted,
      rejected: result.rejected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing sync changes:', error);
    return c.json({ 
      error: 'Failed to process sync changes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /sync/changes - Get changes for initial sync or catch-up sync
app.get('/changes', async (c) => {
  try {
    const { since } = c.req.query();
    
    // Parse the since timestamp if provided
    const sinceDate = since ? new Date(since) : undefined;
    
    if (since && isNaN(sinceDate?.getTime() || 0)) {
      return c.json({ error: 'Invalid since timestamp' }, 400);
    }
    
    // Get changes for sync
    const changes = await getChangesForSync(sinceDate);
    
    return c.json({
      success: true,
      ...changes
    });
  } catch (error) {
    console.error('Error fetching sync changes:', error);
    return c.json({ 
      error: 'Failed to fetch sync changes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /sync/status - Get sync status (health check)
app.get('/status', async (c) => {
  try {
    const user = c.get('user');
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      userId: user?.id,
      drizzle: true,
      typeorm: false
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return c.json({ 
      error: 'Failed to check sync status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /sync/batch - Process batch of changes (for bulk operations)
app.post('/batch', async (c) => {
  try {
    const batches = await c.req.json();
    
    if (!Array.isArray(batches)) {
      return c.json({ error: 'Invalid batch payload - expected array' }, 400);
    }
    
    const results = [];
    
    for (const batch of batches) {
      if (!batch.changes || !Array.isArray(batch.changes)) {
        results.push({
          error: 'Invalid changes in batch',
          accepted: [],
          rejected: []
        });
        continue;
      }
      
      try {
        const result = await processIncomingChanges(batch);
        results.push(result);
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : 'Unknown error',
          accepted: [],
          rejected: batch.changes.map(c => ({ 
            id: c.id, 
            reason: 'Batch processing failed' 
          }))
        });
      }
    }
    
    return c.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing batch sync:', error);
    return c.json({ 
      error: 'Failed to process batch sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;