import type { TableChange } from '@repo/sync-types';
import type { WALData, PostgresWALMessage } from '../types/wal';
import { replicationLogger } from '../middleware/logger';
import type { MinimalContext } from '../types/hono';
import { parsePostgreSQLValue } from '../lib/postgresql-type-parser';

const MODULE_NAME = 'org-aware-process-changes';

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
  // Matches full UUIDv7 format: org_0198ab70_1000_7000_8000_000000000001_entity
  const orgMatch = tableName.match(/^org_([0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12})_(.+)$/);
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
  tableChanges: (TableChange & { organizationId?: string })[], 
  filteredReasons: Record<string, number>,
  organizationStats: Record<string, number>
}> {
  const tableChanges: (TableChange & { organizationId?: string })[] = [];
  const filteredReasons: Record<string, number> = {};
  const organizationStats: Record<string, number> = {};

  replicationLogger.info('Processing WAL changes with organization context', {
    walEntries: changes.length
  }, MODULE_NAME);

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
          }, MODULE_NAME);
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
        }, MODULE_NAME);

      } catch (error) {
        addFilterReason(filteredReasons, `Processing error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  replicationLogger.info('WAL processing completed', {
    totalChanges: tableChanges.length,
    organizationBreakdown: organizationStats,
    filteredCount: Object.values(filteredReasons).reduce((sum, count) => sum + count, 0)
  }, MODULE_NAME);

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
      const columnName = change.columnnames[i];
      let columnValue = change.columnvalues[i];
      
      // Parse PostgreSQL-specific data types
      columnValue = parsePostgreSQLValue(columnName, columnValue || '', change.table);
      data[columnName] = columnValue;
    }
  }
  
  // Extract old keys for deletes
  if (change.kind === 'delete' && change.oldkeys) {
    for (let i = 0; i < Math.min(change.oldkeys.keynames.length, change.oldkeys.keyvalues.length); i++) {
      const keyName = change.oldkeys.keynames[i];
      let keyValue = change.oldkeys.keyvalues[i];
      
      // Parse PostgreSQL-specific data types for old keys
      keyValue = parsePostgreSQLValue(keyName, keyValue || '', change.table);
      data[keyName] = keyValue;
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
  const baseTables = ['users', 'organizations', 'organization_member', 'session', 'account', 'verification', 'organization_billing_events'];
  if (baseTables.includes(normalizedTableName)) {
    return true;
  }
  
  // Organization-specific tables - track if matches UUIDv7 pattern
  return normalizedTableName.match(/^org_[0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12}_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null;
}