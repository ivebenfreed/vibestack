import { Hono } from 'hono';
import { getDb, sql } from '../lib/drizzle.js';
import * as schema from '@repo/dataforge/drizzle-schema';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all database routes
app.use('*', requireAuth);

// GET /db/health - Database health check
app.get('/health', async (c) => {
  try {
    const db = getDb();
    
    // Simple query to check database connectivity
    const result = await db.execute(sql`SELECT 1 as health`);
    
    return c.json({
      status: 'healthy',
      connected: true,
      timestamp: new Date().toISOString(),
      orm: 'drizzle'
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return c.json({
      status: 'unhealthy',
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// GET /db/stats - Get database statistics
app.get('/stats', async (c) => {
  try {
    const db = getDb();
    
    // Get table counts for domain entities
    const stats: Record<string, number> = {};
    
    for (const tableName of schema.tableCategories.domain) {
      const table = (schema as any)[tableName];
      if (!table) continue;
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(table);
      
      stats[tableName] = result[0]?.count || 0;
    }
    
    return c.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching database stats:', error);
    return c.json({ 
      error: 'Failed to fetch database stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /db/reset - Reset database (development only)
app.post('/reset', async (c) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Database reset not allowed in production' }, 403);
    }
    
    const db = getDb();
    
    // Delete all data from domain tables
    for (const tableName of schema.tableCategories.domain) {
      const table = (schema as any)[tableName];
      if (!table) continue;
      
      await db.delete(table);
    }
    
    return c.json({
      success: true,
      message: 'Database reset successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    return c.json({ 
      error: 'Failed to reset database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /db/schema - Get database schema information
app.get('/schema', async (c) => {
  try {
    const db = getDb();
    
    // Query information schema for table and column info
    const tables = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    
    // Group columns by table
    const schemaInfo: Record<string, any[]> = {};
    
    for (const row of tables) {
      const tableName = row.table_name as string;
      
      if (!schemaInfo[tableName]) {
        schemaInfo[tableName] = [];
      }
      
      schemaInfo[tableName].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default
      });
    }
    
    return c.json({
      success: true,
      schema: schemaInfo,
      tableCategories: schema.tableCategories,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching database schema:', error);
    return c.json({ 
      error: 'Failed to fetch database schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /db/query - Execute raw query (development only, read-only)
app.post('/query', async (c) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Raw queries not allowed in production' }, 403);
    }
    
    const { query } = await c.req.json();
    
    if (!query || typeof query !== 'string') {
      return c.json({ error: 'Invalid query' }, 400);
    }
    
    // Only allow SELECT queries
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return c.json({ error: 'Only SELECT queries are allowed' }, 403);
    }
    
    const db = getDb();
    const result = await db.execute(sql.raw(query));
    
    return c.json({
      success: true,
      result,
      rowCount: Array.isArray(result) ? result.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing query:', error);
    return c.json({ 
      error: 'Failed to execute query',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;