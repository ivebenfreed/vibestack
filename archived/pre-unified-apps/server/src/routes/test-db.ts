/**
 * Test Database API
 * 
 * Provides database query capabilities for testing real data integration.
 * ONLY for testing - should not be used in production.
 */

import { Hono } from 'hono';
import type { AppContext } from '../types/hono';

export const testDbRouter = new Hono<AppContext>();

// Execute raw SQL queries for testing
testDbRouter.post('/query', async (c) => {
  try {
    const { sql, params = [] } = await c.req.json();
    
    if (!sql) {
      return c.json({ error: 'SQL query required' }, 400);
    }
    
    console.log('[Test DB] Executing query:', sql);
    console.log('[Test DB] With params:', params);
    
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    await client.connect();
    
    try {
      const result = await client.query(sql, params);
      
      return c.json({
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command
      });
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('[Test DB] Query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Health check for test database connectivity
testDbRouter.get('/health', async (c) => {
  try {
    const { getDBClient } = await import('../lib/db');
    const client = getDBClient(c);
    
    await client.connect();
    
    try {
      const result = await client.query('SELECT NOW() as current_time, version()');
      
      return c.json({
        status: 'ok',
        database: 'connected',
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version
      });
    } finally {
      await client.end();
    }
    
  } catch (error) {
    return c.json({
      status: 'error',
      database: 'connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});