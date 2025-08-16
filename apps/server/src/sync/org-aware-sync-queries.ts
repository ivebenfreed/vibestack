import type { MinimalContext } from '../types/hono';
import type { SyncConnection } from './org-aware-sync-manager';
import type { TableChange } from '@repo/sync-types';
import { getDBClient } from '../lib/db';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'org-aware-sync-queries';

/**
 * Set organization context for RLS queries
 */
async function setOrganizationContext(
  context: MinimalContext, 
  organizationId: string
): Promise<void> {
  const client = getDBClient(context);
  await client.connect();
  
  try {
    // Set organization context for RLS
    await client.query('SELECT set_current_organization_id($1)', [organizationId]);
    
    syncLogger.debug('Organization context set for RLS', {
      organizationId
    }, MODULE_NAME);
  } finally {
    await client.end();
  }
}

/**
 * Query change history with automatic organization filtering via RLS
 */
export async function getOrganizationChanges(
  context: MinimalContext,
  syncConnection: SyncConnection,
  clientLSN: string,
  serverLSN: string,
  limit: number = 5000
): Promise<TableChange[]> {
  const client = getDBClient(context);
  await client.connect();

  try {
    // Set organization context for RLS
    await client.query('SELECT set_current_organization_id($1)', [syncConnection.organizationId]);

    syncLogger.info('Querying organization-scoped change history', {
      organizationId: syncConnection.organizationId,
      userId: syncConnection.userId,
      clientLSN,
      serverLSN,
      limit
    }, MODULE_NAME);

    // Query with automatic RLS filtering
    // RLS policy ensures only changes for this organization are returned
    const query = `
      SELECT 
        table_name as table,
        operation,
        data,
        lsn,
        created_at as timestamp,
        client_id
      FROM change_history 
      WHERE lsn::pg_lsn > $1::pg_lsn 
        AND lsn::pg_lsn <= $2::pg_lsn
      ORDER BY lsn::pg_lsn ASC
      LIMIT $3
    `;

    const result = await client.query(query, [clientLSN, serverLSN, limit]);

    // Parse JSON data and convert to TableChange format
    const changes: TableChange[] = result.rows.map(row => {
      let parsedData;
      try {
        parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch (error) {
        syncLogger.error('Failed to parse change data', {
          lsn: row.lsn,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        parsedData = row.data;
      }

      return {
        table: row.table,
        operation: row.operation,
        data: parsedData,
        lsn: row.lsn,
        clientId: row.client_id,
        updatedAt: row.timestamp
      };
    });

    syncLogger.info('Organization changes retrieved', {
      organizationId: syncConnection.organizationId,
      userId: syncConnection.userId,
      changeCount: changes.length,
      tables: [...new Set(changes.map(c => c.table))]
    }, MODULE_NAME);

    return changes;

  } finally {
    await client.end();
  }
}

/**
 * Get latest LSN for organization-scoped changes
 */
export async function getOrganizationLatestLSN(
  context: MinimalContext,
  organizationId: string
): Promise<string> {
  const client = getDBClient(context);
  await client.connect();

  try {
    // Set organization context
    await client.query('SELECT set_current_organization_id($1)', [organizationId]);

    // Get latest LSN for this organization (RLS automatically filters)
    const result = await client.query(`
      SELECT MAX(lsn::pg_lsn)::text as latest_lsn 
      FROM change_history 
      WHERE organization_id = $1 OR organization_id IS NULL
    `, [organizationId]);

    const latestLSN = result.rows[0]?.latest_lsn || '0/0';

    syncLogger.debug('Retrieved organization latest LSN', {
      organizationId,
      latestLSN
    }, MODULE_NAME);

    return latestLSN;

  } finally {
    await client.end();
  }
}

/**
 * Check organization sync health
 */
export async function getOrganizationSyncHealth(
  context: MinimalContext,
  organizationId: string
): Promise<{
  latestLSN: string;
  changeCount24h: number;
  lastChangeAt: Date | null;
  healthStatus: 'healthy' | 'stale' | 'inactive';
}> {
  const client = getDBClient(context);
  await client.connect();

  try {
    await client.query('SELECT set_current_organization_id($1)', [organizationId]);

    const result = await client.query(`
      SELECT 
        MAX(lsn::pg_lsn)::text as latest_lsn,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as changes_24h,
        MAX(created_at) as last_change_at
      FROM change_history
      WHERE organization_id = $1 OR organization_id IS NULL
    `, [organizationId]);

    const row = result.rows[0];
    const latestLSN = row.latest_lsn || '0/0';
    const changeCount24h = parseInt(row.changes_24h) || 0;
    const lastChangeAt = row.last_change_at ? new Date(row.last_change_at) : null;

    // Determine health status
    let healthStatus: 'healthy' | 'stale' | 'inactive' = 'inactive';
    if (lastChangeAt) {
      const hoursSinceLastChange = (Date.now() - lastChangeAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastChange < 1) {
        healthStatus = 'healthy';
      } else if (hoursSinceLastChange < 24) {
        healthStatus = 'stale';
      }
    }

    return {
      latestLSN,
      changeCount24h,
      lastChangeAt,
      healthStatus
    };

  } finally {
    await client.end();
  }
}

/**
 * Get organization change statistics for debugging
 */
export async function getOrganizationChangeStats(
  context: MinimalContext,
  organizationId: string,
  hoursBack: number = 24
): Promise<{
  changeCount: number;
  latestLSN: string;
  lastChangeAt: Date | null;
  tablesAffected: string[];
}> {
  const client = getDBClient(context);
  await client.connect();

  try {
    await client.query('SELECT set_current_organization_id($1)', [organizationId]);

    const result = await client.query(`
      SELECT * FROM get_organization_change_stats($1, $2)
    `, [organizationId, hoursBack]);

    const row = result.rows[0];
    
    return {
      changeCount: parseInt(row?.change_count) || 0,
      latestLSN: row?.latest_lsn || '0/0',
      lastChangeAt: row?.last_change_at ? new Date(row.last_change_at) : null,
      tablesAffected: row?.tables_affected || []
    };

  } finally {
    await client.end();
  }
}