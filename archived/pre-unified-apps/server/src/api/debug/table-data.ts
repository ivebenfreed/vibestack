/**
 * Debug API endpoint to fetch table data for LiveStore integration testing
 * 
 * This endpoint simulates what the sync system would provide to LiveStore
 * by fetching real data from our sophisticated Wide Corp seeding.
 */

import { Hono } from 'hono';
import { getDBClient } from '../../lib/db';
import type { AppBindings } from '../../types/hono';

const app = new Hono<AppBindings>();

interface TableDataRequest {
  tableName: string;
  organizationId: string;
  limit?: number;
  filter?: Record<string, any>;
}

interface TableDataResponse {
  success: boolean;
  data?: any[];
  error?: string;
  meta?: {
    tableName: string;
    recordCount: number;
    organizationId: string;
  };
}

/**
 * POST /api/debug/table-data
 * 
 * Fetch table data for LiveStore integration testing
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json() as TableDataRequest;
    const { tableName, organizationId, limit = 20, filter } = body;

    if (!tableName || !organizationId) {
      return c.json<TableDataResponse>({
        success: false,
        error: 'tableName and organizationId are required'
      }, 400);
    }

    // Validate table name to prevent SQL injection
    const validTablePattern = /^org_[a-f0-9_]+_[a-z]+$/;
    if (!validTablePattern.test(tableName)) {
      return c.json<TableDataResponse>({
        success: false,
        error: 'Invalid table name format'
      }, 400);
    }

    // Create database connection
    const db = getDBClient(c);
    
    try {
      await db.connect();

      // Check if table exists
      const tableExistsResult = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName]);

      if (!tableExistsResult.rows[0]?.exists) {
        return c.json<TableDataResponse>({
          success: false,
          error: `Table ${tableName} does not exist`
        }, 404);
      }

      // Build query with organization filter and optional additional filters
      let whereConditions = ['organization_id = $1'];
      let queryParams: any[] = [organizationId];
      let paramIndex = 2;
      
      // Add additional filters if provided
      if (filter && typeof filter === 'object') {
        for (const [key, value] of Object.entries(filter)) {
          // Basic validation to prevent SQL injection
          if (typeof key === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            whereConditions.push(`${key} = $${paramIndex}`);
            queryParams.push(value);
            paramIndex++;
          }
        }
      }
      
      queryParams.push(limit); // Add limit as final parameter
      
      const query = `
        SELECT * FROM ${tableName} 
        WHERE ${whereConditions.join(' AND ')} 
        ORDER BY created_at DESC 
        LIMIT $${paramIndex}
      `;

      const result = await db.query(query, queryParams);
      const data = result.rows;

      console.log(`[Debug API] Fetched ${data.length} records from ${tableName} for org ${organizationId}`);

      return c.json<TableDataResponse>({
        success: true,
        data,
        meta: {
          tableName,
          recordCount: data.length,
          organizationId
        }
      });

    } finally {
      try {
        await db.end();
      } catch (err) {
        console.error('[Debug API] Error closing connection:', err);
      }
    }

  } catch (error) {
    console.error('[Debug API] Table data fetch failed:', error);
    
    return c.json<TableDataResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

/**
 * GET /api/debug/table-data/tables
 * 
 * List available tables for an organization
 */
app.get('/tables/:organizationId', async (c) => {
  try {
    const organizationId = c.req.param('organizationId');
    
    if (!organizationId) {
      return c.json({
        success: false,
        error: 'organizationId is required'
      }, 400);
    }

    const db = getDBClient(c);

    try {
      await db.connect();

      // Find all tables for this organization
      const orgIdUnderscores = organizationId.replace(/-/g, '_');
      const tablePattern = `org_${orgIdUnderscores}_%`;

      const result = await db.query(`
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_name LIKE $1
        ORDER BY table_name
      `, [tablePattern]);

      const tables = result.rows.map(row => ({
        tableName: row.table_name,
        displayName: row.table_name.replace(`org_${orgIdUnderscores}_`, ''),
        columnCount: parseInt(row.column_count)
      }));

      return c.json({
        success: true,
        data: tables,
        meta: {
          organizationId,
          tableCount: tables.length
        }
      });

    } finally {
      try {
        await db.end();
      } catch (err) {
        console.error('[Debug API] Error closing connection:', err);
      }
    }

  } catch (error) {
    console.error('[Debug API] Table list fetch failed:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, 500);
  }
});

export default app;