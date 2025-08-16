import type { TableChange } from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import { replicationLogger } from '../middleware/logger';
import { getDBClient } from '../lib/db';

const MODULE_NAME = 'org-aware-storage';

interface StorageResult {
  success: boolean;
  storedCount: number;
  organizationBreakdown: Record<string, number>;
  errors: string[];
}

/**
 * Store changes in change_history with organization context
 */
export async function storeChangesWithOrganization(
  context: MinimalContext,
  changes: (TableChange & { organizationId?: string })[],
  batchSize: number = 500
): Promise<StorageResult> {
  if (changes.length === 0) {
    return { success: true, storedCount: 0, organizationBreakdown: {}, errors: [] };
  }

  const organizationBreakdown: Record<string, number> = {};
  const errors: string[] = [];
  let storedCount = 0;

  // Group changes by organization for better logging
  const changesByOrg = changes.reduce((acc, change) => {
    const orgKey = change.organizationId || 'system';
    if (!acc[orgKey]) acc[orgKey] = [];
    acc[orgKey].push(change);
    organizationBreakdown[orgKey] = (organizationBreakdown[orgKey] || 0) + 1;
    return acc;
  }, {} as Record<string, (TableChange & { organizationId?: string })[]>);

  replicationLogger.info('Storing changes with organization context', {
    totalChanges: changes.length,
    organizationBreakdown,
    batchSize
  }, MODULE_NAME);

  const client = getDBClient(context);
  let connected = false;

  try {
    await client.connect();
    connected = true;
    
    // Enable system mode for replication writes
    await client.query('SELECT enable_system_mode()');
    await client.query('BEGIN');

    // Process in batches
    const totalBatches = Math.ceil(changes.length / batchSize);
    
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      
      try {
        // Create parameterized multi-row insert
        const valueRows = batch.map((_, idx) => {
          const base = idx * 6;
          return `($${base + 1}, $${base + 2}::UUID, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6})`;
        }).join(',\n');

        const params: any[] = [];
        batch.forEach(change => {
          params.push(
            change.lsn,
            change.organizationId || null, // NULL for system tables
            change.table,
            change.operation,
            JSON.stringify(change.data),
            change.clientId || null
          );
        });

        const query = `
          INSERT INTO change_history 
            (lsn, organization_id, table_name, operation, data, client_id) 
          VALUES ${valueRows}
        `;

        await client.query(query, params);
        storedCount += batch.length;

        replicationLogger.debug('Stored batch successfully', {
          batchNumber: Math.floor(i / batchSize) + 1,
          totalBatches,
          batchSize: batch.length
        }, MODULE_NAME);

      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : String(batchError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMsg}`);
        
        replicationLogger.error('Batch storage failed', {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          error: errorMsg
        }, MODULE_NAME);
      }
    }

    await client.query('COMMIT');
    await client.query('SELECT disable_system_mode()');

    replicationLogger.info('Organization-aware storage completed', {
      storedCount,
      totalChanges: changes.length,
      successRate: `${((storedCount / changes.length) * 100).toFixed(1)}%`,
      organizationBreakdown,
      errors: errors.length
    }, MODULE_NAME);

    return {
      success: storedCount > 0,
      storedCount,
      organizationBreakdown,
      errors
    };

  } catch (error) {
    if (connected) {
      try {
        await client.query('ROLLBACK');
        await client.query('SELECT disable_system_mode()');
      } catch (rollbackError) {
        // Ignore rollback errors
      }
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    replicationLogger.error('Organization-aware storage failed', {
      error: errorMsg,
      changeCount: changes.length
    }, MODULE_NAME);

    return {
      success: false,
      storedCount: 0,
      organizationBreakdown,
      errors: [errorMsg]
    };

  } finally {
    if (connected) {
      try {
        await client.end();
      } catch (endError) {
        replicationLogger.error('Failed to close database connection', {
          error: endError instanceof Error ? endError.message : String(endError)
        }, MODULE_NAME);
      }
    }
  }
}