# WAL Polling & Change History RLS Integration Plan

## Executive Summary

Design and implement a **fully organization-aware WAL polling and change history system** that integrates seamlessly with the existing RLS multi-tenant architecture. This ensures perfect tenant isolation at the database replication level while maintaining high-performance real-time sync.

## Current Architecture Gap

### Problem Statement
- WAL polling captures ALL database changes globally
- Change history table has no organization context
- Sync queries bypass organization isolation
- Potential cross-tenant data leakage in real-time sync

### Target Architecture
```
PostgreSQL WAL → Org-Aware Processing → Org-Partitioned Storage → Org-Scoped Sync → Tenant Clients
```

## Phase 1: Organization-Aware Change History Schema

### 1.1 Enhanced Change History Table

**New Schema Design:**
```sql
CREATE TABLE change_history (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    lsn TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    data JSONB NOT NULL,
    client_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Performance indexes
    CONSTRAINT change_history_lsn_check CHECK (lsn ~ '^[0-9A-F]+/[0-9A-F]+$')
);

-- Critical indexes for performance
CREATE INDEX idx_change_history_org_lsn ON change_history(organization_id, lsn);
CREATE INDEX idx_change_history_org_timestamp ON change_history(organization_id, created_at);
CREATE INDEX idx_change_history_table_org ON change_history(table_name, organization_id);
CREATE INDEX idx_change_history_client_id ON change_history(client_id) WHERE client_id IS NOT NULL;

-- Enable RLS for perfect tenant isolation
ALTER TABLE change_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see changes from their current organization
CREATE POLICY "change_history_organization_isolation" ON change_history
    USING (organization_id = get_current_organization_id());

-- Special policy for system operations (no organization context)
CREATE POLICY "change_history_system_access" ON change_history
    USING (organization_id IS NULL AND current_setting('app.system_mode', true) = 'true');
```

### 1.2 Organization Context Functions

**Enhanced RLS Helper Functions:**
```sql
-- Get current organization from session context
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set organization context for session
CREATE OR REPLACE FUNCTION set_current_organization_id(org_id UUID) 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable system mode for cross-org operations
CREATE OR REPLACE FUNCTION enable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable system mode
CREATE OR REPLACE FUNCTION disable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Phase 2: Organization-Aware WAL Processing

### 2.1 Enhanced ProcessChanges Logic

**File: `src/replication/org-aware-process-changes.ts`**
```typescript
import type { TableChange } from '@repo/sync-types';
import type { WALData, PostgresWALMessage } from '../types/wal';
import { replicationLogger } from '../middleware/logger';

interface OrganizationContext {
  organizationId: string | null;
  isSystemTable: boolean;
  entityName?: string;
}

/**
 * Extract organization context from WAL table change
 */
function extractOrganizationContext(tableName: string, data: Record<string, unknown>): OrganizationContext {
  // Case 1: Organization-scoped tables (org_{orgId}_{entity})
  const orgMatch = tableName.match(/^org_([a-fA-F0-9\-]+)_(.+)$/);
  if (orgMatch) {
    return {
      organizationId: orgMatch[1],
      isSystemTable: false,
      entityName: orgMatch[2]
    };
  }
  
  // Case 2: Base tables with organization_id field
  const baseTables = ['users', 'organization_member', 'session', 'account'];
  if (baseTables.includes(tableName)) {
    const orgId = data.organization_id || data.organizationId;
    return {
      organizationId: orgId ? String(orgId) : null,
      isSystemTable: false
    };
  }
  
  // Case 3: Pure system tables (organizations, billing, etc.)
  const systemTables = ['organizations', 'organization_billing_events', 'subscription_limits'];
  if (systemTables.includes(tableName)) {
    // For organizations table, use the record's own ID
    if (tableName === 'organizations') {
      const orgId = data.id;
      return {
        organizationId: orgId ? String(orgId) : null,
        isSystemTable: false
      };
    }
    
    // For billing events, extract from organization_id field
    if (tableName === 'organization_billing_events') {
      const orgId = data.organization_id || data.organizationId;
      return {
        organizationId: orgId ? String(orgId) : null,
        isSystemTable: false
      };
    }
    
    // Other system tables have no org context
    return {
      organizationId: null,
      isSystemTable: true
    };
  }
  
  // Case 4: Unknown table - try to extract from data
  const orgId = data.organization_id || data.organizationId;
  return {
    organizationId: orgId ? String(orgId) : null,
    isSystemTable: !orgId
  };
}

/**
 * Transform WAL changes with organization awareness
 */
export async function transformWALChangesWithOrg(
  changes: WALData[], 
  context: MinimalContext
): Promise<{ 
  tableChanges: TableChange[], 
  filteredReasons: Record<string, number>,
  organizationStats: Record<string, number>
}> {
  const tableChanges: TableChange[] = [];
  const filteredReasons: Record<string, number> = {};
  const organizationStats: Record<string, number> = {};

  replicationLogger.info('Processing WAL changes with organization context', {
    walEntries: changes.length
  });

  for (const wal of changes) {
    if (!wal.data) {
      addFilterReason(filteredReasons, 'No WAL data');
      continue;
    }

    let parsedData: PostgresWALMessage;
    try {
      parsedData = JSON.parse(wal.data);
    } catch (error) {
      addFilterReason(filteredReasons, 'JSON parse error');
      continue;
    }

    if (!parsedData?.change || !Array.isArray(parsedData.change)) {
      addFilterReason(filteredReasons, 'Invalid WAL structure');
      continue;
    }

    for (const change of parsedData.change) {
      try {
        // Early validation
        if (!change?.schema || !change?.table) {
          addFilterReason(filteredReasons, 'Missing schema/table');
          continue;
        }

        // Check if table should be tracked
        if (!shouldTrackTableSync(change.table)) {
          addFilterReason(filteredReasons, `Table ${change.table} not tracked`);
          continue;
        }

        // Extract data from WAL
        const snakeCaseData = extractWALData(change);
        const camelCaseData = convertSnakeToCamelCase(snakeCaseData);
        
        // Extract organization context
        const orgContext = extractOrganizationContext(change.table, snakeCaseData);
        
        // Track organization statistics
        const orgKey = orgContext.organizationId || 'system';
        organizationStats[orgKey] = (organizationStats[orgKey] || 0) + 1;
        
        // Filter out changes without organization context (unless system table)
        if (!orgContext.organizationId && !orgContext.isSystemTable) {
          addFilterReason(filteredReasons, 'No organization context');
          replicationLogger.warn('Change without organization context', {
            table: change.table,
            operation: change.kind,
            dataKeys: Object.keys(camelCaseData)
          });
          continue;
        }

        // Extract client ID for anti-echo
        const clientId = extractClientId(camelCaseData);
        
        // Create organization-aware table change
        const tableChange: TableChange & { organizationId?: string } = {
          table: change.table,
          operation: change.kind,
          data: camelCaseData,
          organizationId: orgContext.organizationId || undefined,
          lsn: wal.lsn,
          clientId,
          updatedAt: snakeCaseData.updated_at as string || new Date().toISOString()
        };

        tableChanges.push(tableChange);

        replicationLogger.debug('Processed change with organization context', {
          table: change.table,
          operation: change.kind,
          organizationId: orgContext.organizationId,
          isSystemTable: orgContext.isSystemTable,
          entityName: orgContext.entityName
        });

      } catch (error) {
        addFilterReason(filteredReasons, `Processing error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  replicationLogger.info('WAL processing completed', {
    totalChanges: tableChanges.length,
    organizationBreakdown: organizationStats,
    filteredCount: Object.values(filteredReasons).reduce((sum, count) => sum + count, 0)
  });

  return { tableChanges, filteredReasons, organizationStats };
}

function addFilterReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

function extractWALData(change: any): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  
  // Extract column data
  if (change.columnnames && change.columnvalues) {
    for (let i = 0; i < Math.min(change.columnnames.length, change.columnvalues.length); i++) {
      data[change.columnnames[i]] = change.columnvalues[i];
    }
  }
  
  // Extract old keys for deletes
  if (change.kind === 'delete' && change.oldkeys) {
    for (let i = 0; i < Math.min(change.oldkeys.keynames.length, change.oldkeys.keyvalues.length); i++) {
      data[change.oldkeys.keynames[i]] = change.oldkeys.keyvalues[i];
    }
  }
  
  return data;
}

function extractClientId(data: Record<string, unknown>): string | undefined {
  const clientId = data.clientId || data.client_id;
  if (clientId && typeof clientId === 'string' && clientId.trim() !== '') {
    return clientId;
  }
  return undefined;
}

function convertSnakeToCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    converted[camelKey] = value;
  }
  return converted;
}

function shouldTrackTableSync(tableName: string): boolean {
  const normalizedTableName = tableName.replace(/"/g, '');
  
  // System tables - never track
  const systemTables = ['change_history', 'sync_statistics', 'system_logs', 'replication_slot_status'];
  if (systemTables.includes(normalizedTableName) || normalizedTableName.startsWith('pg_')) {
    return false;
  }
  
  // Base tables - always track
  const baseTables = ['users', 'organizations', 'organization_member', 'session', 'account', 'verification'];
  if (baseTables.includes(normalizedTableName)) {
    return true;
  }
  
  // Organization-specific tables - track if matches pattern
  return normalizedTableName.match(/^org_[a-fA-F0-9\-]+_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null;
}
```

### 2.2 Organization-Aware Storage

**File: `src/replication/org-aware-storage.ts`**
```typescript
import type { TableChange } from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import { replicationLogger } from '../middleware/logger';
import { getDBClient } from '../lib/db';

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
  });

  const client = getDBClient(context);
  let connected = false;

  try {
    await client.connect();
    connected = true;
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
        });

      } catch (batchError) {
        const errorMsg = batchError instanceof Error ? batchError.message : String(batchError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMsg}`);
        
        replicationLogger.error('Batch storage failed', {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          error: errorMsg
        });
      }
    }

    await client.query('COMMIT');

    replicationLogger.info('Organization-aware storage completed', {
      storedCount,
      totalChanges: changes.length,
      successRate: `${((storedCount / changes.length) * 100).toFixed(1)}%`,
      organizationBreakdown,
      errors: errors.length
    });

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
      } catch (rollbackError) {
        // Ignore rollback errors
      }
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    replicationLogger.error('Organization-aware storage failed', {
      error: errorMsg,
      changeCount: changes.length
    });

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
        });
      }
    }
  }
}
```

## Phase 3: Organization-Scoped Sync Queries

### 3.1 RLS-Aware Sync Functions

**File: `src/sync/org-aware-sync-queries.ts`**
```typescript
import type { MinimalContext } from '../types/hono';
import type { SyncConnection } from './org-aware-sync-manager';
import type { TableChange } from '@repo/sync-types';
import { getDBClient } from '../lib/db';
import { syncLogger } from '../middleware/logger';

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
    });
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
    });

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
      WHERE lsn > $1::pg_lsn 
        AND lsn <= $2::pg_lsn
      ORDER BY lsn ASC
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
        });
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
    });

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
    });

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
```

### 3.2 Enhanced SyncDO Integration

**Updates to `src/sync/SyncDO.ts`:**
```typescript
// Add to SyncDO class

/**
 * Perform organization-aware catchup sync with RLS filtering
 */
private async performOrgAwareCatchupSync(
  clientId: string,
  clientLSN: string,
  serverLSN: string
): Promise<void> {
  if (!this.syncConnection) return;

  syncLogger.info('Starting organization-aware catchup sync', {
    clientId,
    userId: this.syncConnection.userId,
    organizationId: this.syncConnection.organizationId,
    clientLSN,
    serverLSN
  });

  try {
    // Get organization-scoped changes using RLS
    const changes = await getOrganizationChanges(
      this.getContext(),
      this.syncConnection,
      clientLSN,
      serverLSN,
      5000 // limit
    );

    if (changes.length === 0) {
      await this.send({
        type: 'catchup-complete',
        organizationId: this.syncConnection.organizationId,
        serverLSN,
        changeCount: 0
      });
      return;
    }

    // Send changes in batches to avoid overwhelming the client
    const batchSize = 100;
    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const isLastBatch = i + batchSize >= changes.length;

      await this.send({
        type: 'catchup-changes',
        organizationId: this.syncConnection.organizationId,
        changes: batch,
        batchNumber: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(changes.length / batchSize),
        isLastBatch,
        serverLSN: isLastBatch ? serverLSN : undefined
      });

      // Small delay between batches to prevent overwhelming
      if (!isLastBatch) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    syncLogger.info('Organization-aware catchup sync completed', {
      clientId,
      organizationId: this.syncConnection.organizationId,
      changeCount: changes.length,
      finalLSN: serverLSN
    });

  } catch (error) {
    syncLogger.error('Organization-aware catchup sync failed', {
      clientId,
      organizationId: this.syncConnection.organizationId,
      error: error instanceof Error ? error.message : String(error)
    });

    await this.send({
      type: 'sync-error',
      error: 'Catchup sync failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

## Phase 4: Organization-Aware Broadcasting

### 4.1 Smart Change Broadcasting

**File: `src/replication/org-aware-broadcasting.ts`**
```typescript
import type { TableChange } from '@repo/sync-types';
import type { Env } from '../types/env';
import { replicationLogger } from '../middleware/logger';

interface BroadcastResult {
  success: boolean;
  totalClients: number;
  successfulNotifications: number;
  failedNotifications: number;
  organizationBreakdown: Record<string, { clients: number; changes: number }>;
}

/**
 * Get active client IDs for a specific organization
 */
async function getOrganizationClientIds(env: Env, organizationId: string): Promise<string[]> {
  try {
    const { keys } = await env.CLIENT_REGISTRY.list({ prefix: 'client:' });
    const orgClientIds: string[] = [];

    for (const key of keys) {
      const clientId = key.name.replace('client:', '');
      
      // Get client's organization context
      const authData = await env.CLIENT_REGISTRY.get(`auth:${clientId}`);
      if (authData) {
        try {
          const authContext = JSON.parse(authData);
          if (authContext.organizationId === organizationId && authContext.active === true) {
            orgClientIds.push(clientId);
          }
        } catch (parseError) {
          replicationLogger.warn('Failed to parse client auth context', {
            clientId,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          });
        }
      }
    }

    return orgClientIds;
  } catch (error) {
    replicationLogger.error('Failed to get organization client IDs', {
      organizationId,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Broadcast changes to organization-specific clients
 */
export async function broadcastChangesToOrganizations(
  changes: (TableChange & { organizationId?: string })[],
  env: Env,
  lastLSN: string
): Promise<BroadcastResult> {
  if (changes.length === 0) {
    return {
      success: true,
      totalClients: 0,
      successfulNotifications: 0,
      failedNotifications: 0,
      organizationBreakdown: {}
    };
  }

  // Group changes by organization
  const changesByOrg = changes.reduce((acc, change) => {
    const orgId = change.organizationId || 'system';
    if (!acc[orgId]) acc[orgId] = [];
    acc[orgId].push(change);
    return acc;
  }, {} as Record<string, (TableChange & { organizationId?: string })[]>);

  replicationLogger.info('Broadcasting changes to organizations', {
    totalChanges: changes.length,
    organizationCount: Object.keys(changesByOrg).length,
    organizations: Object.keys(changesByOrg)
  });

  const organizationBreakdown: Record<string, { clients: number; changes: number }> = {};
  let totalClients = 0;
  let successfulNotifications = 0;
  let failedNotifications = 0;

  // Process each organization
  for (const [orgId, orgChanges] of Object.entries(changesByOrg)) {
    try {
      // Filter out client-originated changes (only broadcast system changes)
      const systemChanges = orgChanges.filter(change => !change.clientId);

      if (systemChanges.length === 0) {
        replicationLogger.debug('No system changes for organization, skipping broadcast', {
          organizationId: orgId,
          totalChanges: orgChanges.length
        });
        continue;
      }

      // Get clients for this organization
      const orgClientIds = orgId === 'system' 
        ? await getAllActiveClientIds(env) // System changes go to all clients
        : await getOrganizationClientIds(env, orgId);

      if (orgClientIds.length === 0) {
        replicationLogger.debug('No active clients for organization', {
          organizationId: orgId,
          changeCount: systemChanges.length
        });
        continue;
      }

      organizationBreakdown[orgId] = {
        clients: orgClientIds.length,
        changes: systemChanges.length
      };
      totalClients += orgClientIds.length;

      // Broadcast to all clients in this organization
      const orgResults = await Promise.allSettled(
        orgClientIds.map(clientId => broadcastToClient(env, clientId, systemChanges, lastLSN))
      );

      const orgSuccessful = orgResults.filter(r => r.status === 'fulfilled').length;
      const orgFailed = orgResults.filter(r => r.status === 'rejected').length;

      successfulNotifications += orgSuccessful;
      failedNotifications += orgFailed;

      replicationLogger.info('Organization broadcast completed', {
        organizationId: orgId,
        changes: systemChanges.length,
        clients: orgClientIds.length,
        successful: orgSuccessful,
        failed: orgFailed
      });

    } catch (error) {
      replicationLogger.error('Organization broadcast failed', {
        organizationId: orgId,
        error: error instanceof Error ? error.message : String(error)
      });
      failedNotifications += 1;
    }
  }

  const result: BroadcastResult = {
    success: successfulNotifications > 0,
    totalClients,
    successfulNotifications,
    failedNotifications,
    organizationBreakdown
  };

  replicationLogger.info('Organization broadcasting completed', result);

  return result;
}

async function getAllActiveClientIds(env: Env): Promise<string[]> {
  // Implementation similar to existing getAllClientIds but for all orgs
  try {
    const { keys } = await env.CLIENT_REGISTRY.list({ prefix: 'client:' });
    const activeClientIds: string[] = [];

    for (const key of keys) {
      const value = await env.CLIENT_REGISTRY.get(key.name);
      if (!value) continue;

      try {
        const state = JSON.parse(value);
        if (state.active === true) {
          const clientId = key.name.replace('client:', '');
          activeClientIds.push(clientId);
        }
      } catch (parseError) {
        // Skip invalid entries
      }
    }

    return activeClientIds;
  } catch (error) {
    replicationLogger.error('Failed to get all active client IDs', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

async function broadcastToClient(
  env: Env,
  clientId: string,
  changes: TableChange[],
  lsn: string
): Promise<void> {
  const clientDoId = env.SYNC.idFromName(`client:${clientId}`);
  const clientDo = env.SYNC.get(clientDoId);

  const response = await clientDo.fetch(
    `https://internal/new-changes?clientId=${encodeURIComponent(clientId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lsn,
        changeCount: changes.length,
        changes,
        organizationAware: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Broadcast failed: ${response.status}`);
  }
}
```

## Phase 5: Migration & Deployment

### 5.1 Database Migration

**File: `src/migrations/server/006_wal_rls_integration.sql`**
```sql
-- WAL Polling & Change History RLS Integration
-- This migration creates an organization-aware change history system

-- ===================================
-- PART 1: DROP EXISTING CHANGE_HISTORY (if exists)
-- ===================================

-- Drop existing table if it exists (greenfield deployment)
DROP TABLE IF EXISTS change_history CASCADE;

-- ===================================
-- PART 2: CREATE ORGANIZATION-AWARE CHANGE_HISTORY
-- ===================================

CREATE TABLE change_history (
    -- Primary key and LSN
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    lsn TEXT NOT NULL,
    
    -- Organization context (NULL for system tables)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Change metadata
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    data JSONB NOT NULL,
    
    -- Anti-echo support
    client_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT change_history_lsn_format CHECK (lsn ~ '^[0-9A-F]+/[0-9A-F]+$')
);

-- ===================================
-- PART 3: PERFORMANCE INDEXES
-- ===================================

-- Primary query indexes (organization + LSN)
CREATE INDEX idx_change_history_org_lsn ON change_history(organization_id, lsn) 
    WHERE organization_id IS NOT NULL;

-- System changes index (no organization)
CREATE INDEX idx_change_history_system_lsn ON change_history(lsn) 
    WHERE organization_id IS NULL;

-- Time-based queries
CREATE INDEX idx_change_history_org_time ON change_history(organization_id, created_at) 
    WHERE organization_id IS NOT NULL;

-- Table-specific queries
CREATE INDEX idx_change_history_table_org ON change_history(table_name, organization_id);

-- Client anti-echo filtering
CREATE INDEX idx_change_history_client_id ON change_history(client_id) 
    WHERE client_id IS NOT NULL;

-- LSN ordering for sync queries
CREATE INDEX idx_change_history_lsn_pg ON change_history(lsn::pg_lsn);

-- ===================================
-- PART 4: ROW LEVEL SECURITY
-- ===================================

-- Enable RLS for perfect tenant isolation
ALTER TABLE change_history ENABLE ROW LEVEL SECURITY;

-- Policy 1: Organization members can only see their org's changes
CREATE POLICY "change_history_organization_isolation" ON change_history
    FOR ALL
    TO PUBLIC
    USING (
        organization_id IS NULL OR  -- System changes visible to all
        organization_id = get_current_organization_id()  -- Org changes only to members
    );

-- Policy 2: System mode access for replication processes
CREATE POLICY "change_history_system_mode" ON change_history
    FOR ALL
    TO PUBLIC
    USING (
        current_setting('app.system_mode', true) = 'true'
    );

-- ===================================
-- PART 5: RLS HELPER FUNCTIONS
-- ===================================

-- Get current organization ID from session context
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set organization context for current session
CREATE OR REPLACE FUNCTION set_current_organization_id(org_id UUID) 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable system mode for cross-organization operations
CREATE OR REPLACE FUNCTION enable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable system mode
CREATE OR REPLACE FUNCTION disable_system_mode() 
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.system_mode', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 6: CHANGE HISTORY UTILITY FUNCTIONS
-- ===================================

-- Get organization change statistics
CREATE OR REPLACE FUNCTION get_organization_change_stats(
    org_id UUID,
    hours_back INTEGER DEFAULT 24
) RETURNS TABLE(
    change_count BIGINT,
    latest_lsn TEXT,
    last_change_at TIMESTAMP,
    tables_affected TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as change_count,
        MAX(ch.lsn) as latest_lsn,
        MAX(ch.created_at) as last_change_at,
        ARRAY_AGG(DISTINCT ch.table_name) as tables_affected
    FROM change_history ch
    WHERE ch.organization_id = org_id
      AND ch.created_at > NOW() - (hours_back || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old change history (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_change_history(
    days_to_keep INTEGER DEFAULT 30
) RETURNS BIGINT AS $$
DECLARE
    deleted_count BIGINT;
BEGIN
    DELETE FROM change_history 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================
-- PART 7: VALIDATION QUERIES
-- ===================================

-- Validation function to check WAL RLS schema
CREATE OR REPLACE FUNCTION validate_wal_rls_schema() 
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if change_history table exists with correct columns
    RETURN QUERY SELECT 
        'Change history table structure'::TEXT,
        CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 7 expected columns'
    FROM information_schema.columns 
    WHERE table_name = 'change_history' 
    AND column_name IN (
        'id', 'lsn', 'organization_id', 'table_name', 
        'operation', 'data', 'client_id'
    );
    
    -- Check if RLS is enabled
    RETURN QUERY SELECT 
        'Row Level Security'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relname = 'change_history' 
            AND n.nspname = 'public' 
            AND c.relrowsecurity = true
        ) THEN 'PASS' ELSE 'FAIL' END,
        'RLS enabled on change_history table'::TEXT;
    
    -- Check if RLS policies exist
    RETURN QUERY SELECT 
        'RLS policies'::TEXT,
        CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' RLS policies'
    FROM pg_policies 
    WHERE tablename = 'change_history';
    
    -- Check if indexes exist
    RETURN QUERY SELECT 
        'Performance indexes'::TEXT,
        CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' performance indexes'
    FROM pg_indexes 
    WHERE tablename = 'change_history';
    
    -- Check if helper functions exist
    RETURN QUERY SELECT 
        'RLS helper functions'::TEXT,
        CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END,
        'Found ' || COUNT(*) || ' of 4 RLS helper functions'
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' 
    AND p.proname IN (
        'get_current_organization_id', 'set_current_organization_id',
        'enable_system_mode', 'disable_system_mode'
    );
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- PART 8: RUN VALIDATION
-- ===================================

-- Run validation and show results
SELECT * FROM validate_wal_rls_schema();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'WAL Polling & Change History RLS Integration Complete!';
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'Change History: Organization-aware with perfect RLS isolation';
    RAISE NOTICE 'Indexes: 6 performance indexes for fast org-scoped queries';
    RAISE NOTICE 'RLS Policies: 2 policies for tenant isolation + system access';
    RAISE NOTICE 'Helper Functions: 4 functions for organization context management';
    RAISE NOTICE 'Utility Functions: 3 functions for stats and maintenance';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for organization-aware WAL polling and sync!';
END
$$;
```

### 5.2 Application Integration Plan

**Implementation Steps:**

1. **Database Migration:**
   ```bash
   # Run the migration
   npx tsx src/migrations/run-migration.ts 006_wal_rls_integration.sql
   ```

2. **Update ReplicationDO:**
   - Replace `process-changes.ts` with `org-aware-process-changes.ts`
   - Replace storage logic with `org-aware-storage.ts`
   - Update broadcasting with `org-aware-broadcasting.ts`

3. **Update SyncDO:**
   - Replace sync queries with RLS-aware versions
   - Integrate organization context setting
   - Update catchup sync logic

4. **Testing:**
   - Multi-organization WAL processing tests
   - RLS isolation verification tests
   - Performance benchmarks for organization-scoped queries

5. **Monitoring:**
   - Organization-specific sync health metrics
   - Change volume per organization
   - RLS policy performance monitoring

## Benefits

### Security
- **Perfect Tenant Isolation:** RLS ensures zero cross-org data leakage
- **Defense in Depth:** Multiple layers of organization filtering
- **Audit Trail:** Complete change history with organization context

### Performance
- **Optimized Indexes:** Fast organization-scoped queries
- **Smart Broadcasting:** Only notify relevant clients
- **Efficient Storage:** Batched organization-aware inserts

### Scalability
- **Organization Partitioning:** Natural data partitioning by tenant
- **Selective Sync:** Only sync relevant changes per organization
- **KV Caching:** Fast organization context lookups

### Maintainability
- **Clean Architecture:** Clear separation of concerns
- **Type Safety:** Full TypeScript support with organization context
- **Monitoring:** Built-in health checks and statistics

This plan provides a complete organization-aware WAL polling and change history system that integrates seamlessly with your existing RLS multi-tenant architecture while maintaining high performance and perfect security isolation.