import type { TableChange } from '@/types/sync';
import type { Env } from '../types/env';
import { replicationLogger } from '../middleware/logger';
import { UnifiedClientRegistry } from '../sync/unified-client-registry';

const MODULE_NAME = 'org-aware-broadcasting';

interface BroadcastResult {
  success: boolean;
  totalClients: number;
  successfulNotifications: number;
  failedNotifications: number;
  organizationBreakdown: Record<string, { clients: number; changes: number }>;
}

/**
 * Get active client IDs for a specific organization using OrgAwareClientRegistry
 */
async function getOrganizationClientIds(env: Env, organizationId: string): Promise<string[]> {
  try {
    const unifiedRegistry = new UnifiedClientRegistry({ env });
    return await unifiedRegistry.getOrgActiveClients(organizationId);
  } catch (error) {
    replicationLogger.error('Failed to get organization client IDs', {
      organizationId,
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
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
  }, MODULE_NAME);

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
        }, MODULE_NAME);
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
        }, MODULE_NAME);
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
      }, MODULE_NAME);

    } catch (error) {
      replicationLogger.error('Organization broadcast failed', {
        organizationId: orgId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
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

  replicationLogger.info('Organization broadcasting completed', result, MODULE_NAME);

  return result;
}

async function getAllActiveClientIds(env: Env): Promise<string[]> {
  try {
    const unifiedRegistry = new UnifiedClientRegistry({ env });
    const stats = await unifiedRegistry.getRegistryStats();
    
    // Get all active clients from all organizations
    const allClientIds: string[] = [];
    for (const [orgId] of Object.entries(stats.organizationClients)) {
      const orgClients = await unifiedRegistry.getOrgActiveClients(orgId);
      allClientIds.push(...orgClients);
    }
    
    return allClientIds;
  } catch (error) {
    replicationLogger.error('Failed to get all active client IDs', {
      error: error instanceof Error ? error.message : String(error)
    }, MODULE_NAME);
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