/**
 * Organization-Aware Client Registry
 * 
 * Extends the existing client registry with organization context.
 * Clients are tracked by organization to enable:
 * - Organization-scoped broadcasting
 * - Cross-organization isolation 
 * - Organization-specific client filtering
 */

import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'org-aware-client-registry';

interface OrgClientInfo {
  clientId: string;
  organizationId: string;
  organizationSlug: string;
  userId: string;
  userRole: string;
  connectedAt: string;
  lastActivityAt: string;
}

export class OrgAwareClientRegistryManager {
  private static readonly ORG_CLIENT_PREFIX = 'org_clients:';
  private static readonly GLOBAL_CLIENT_PREFIX = 'client:';
  private static readonly CLIENT_EXPIRY = 10 * 60; // 10 minutes in seconds

  constructor(private env: any) {}

  /**
   * Register a client with organization context
   * Uses separate KV namespace per organization for efficient lookups
   */
  async registerClient(clientInfo: {
    clientId: string;
    organizationId: string;
    organizationSlug: string;
    userId: string;
    userRole: string;
  }): Promise<void> {
    try {
      const now = new Date().toISOString();
      const orgClientInfo: OrgClientInfo = {
        ...clientInfo,
        connectedAt: now,
        lastActivityAt: now
      };

      // Primary storage: Organization-specific KV namespace
      // Key format: org_clients:{orgId}:{clientId}
      const orgKvKey = `${OrgAwareClientRegistryManager.ORG_CLIENT_PREFIX}${clientInfo.organizationId}:${clientInfo.clientId}`;
      await this.env.CLIENT_REGISTRY.put(orgKvKey, JSON.stringify(orgClientInfo), {
        expirationTtl: OrgAwareClientRegistryManager.CLIENT_EXPIRY
      });

      // Reverse lookup: Client -> Organization mapping for quick org discovery
      // Key format: client_to_org:{clientId}
      const clientToOrgKey = `client_to_org:${clientInfo.clientId}`;
      await this.env.CLIENT_REGISTRY.put(clientToOrgKey, clientInfo.organizationId, {
        expirationTtl: OrgAwareClientRegistryManager.CLIENT_EXPIRY
      });

      // Backwards compatibility: Global client registry (minimal data)
      const globalKey = `${OrgAwareClientRegistryManager.GLOBAL_CLIENT_PREFIX}${clientInfo.clientId}`;
      await this.env.CLIENT_REGISTRY.put(globalKey, JSON.stringify({
        clientId: clientInfo.clientId,
        connectedAt: now,
        organizationId: clientInfo.organizationId
      }), {
        expirationTtl: OrgAwareClientRegistryManager.CLIENT_EXPIRY
      });

      syncLogger.info('Registered client with org-specific KV namespace', {
        clientId: clientInfo.clientId,
        organizationId: clientInfo.organizationId,
        organizationSlug: clientInfo.organizationSlug,
        userId: clientInfo.userId,
        userRole: clientInfo.userRole
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Failed to register client with organization', {
        clientId: clientInfo.clientId,
        organizationId: clientInfo.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get all active clients for a specific organization (O(1) per org)
   */
  async getOrgActiveClients(organizationId: string): Promise<string[]> {
    try {
      // Efficient: List only keys for this specific organization
      const prefix = `${OrgAwareClientRegistryManager.ORG_CLIENT_PREFIX}${organizationId}:`;
      const keys = await this.env.CLIENT_REGISTRY.list({ prefix });

      const activeClients: string[] = [];

      // Extract clientId from key name (format: org_clients:{orgId}:{clientId})
      for (const key of keys.keys) {
        const keyParts = key.name.split(':');
        if (keyParts.length === 3) {
          const clientId = keyParts[2]; // Extract clientId from key
          activeClients.push(clientId);
        } else {
          syncLogger.warn('Malformed org client key', {
            key: key.name,
            organizationId
          }, MODULE_NAME);
        }
      }

      syncLogger.debug('Retrieved active clients for organization', {
        organizationId,
        clientCount: activeClients.length,
        clients: activeClients.join(', ')
      }, MODULE_NAME);

      return activeClients;

    } catch (error) {
      syncLogger.error('Failed to get organization active clients', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Get all active clients (across all organizations) - backwards compatibility
   */
  async getActiveClients(): Promise<string[]> {
    try {
      // Use global client registry for backwards compatibility
      const globalKeys = await this.env.CLIENT_REGISTRY.list({ prefix: 'client:' });

      const activeClients: string[] = [];

      for (const key of globalKeys.keys) {
        try {
          const data = await this.env.CLIENT_REGISTRY.get(key.name);
          if (data) {
            const clientInfo = JSON.parse(data);
            activeClients.push(clientInfo.clientId);
          }
        } catch (parseError) {
          syncLogger.warn('Failed to parse global client info', {
            key: key.name,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }, MODULE_NAME);
        }
      }

      return activeClients;

    } catch (error) {
      syncLogger.error('Failed to get all active clients', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Get organization context for a client (O(1) lookup via reverse index)
   */
  async getClientOrganization(clientId: string): Promise<{
    organizationId: string;
    organizationSlug: string;
    userId: string;
    userRole: string;
  } | null> {
    try {
      // Step 1: Fast reverse lookup to get organization ID
      const clientToOrgKey = `client_to_org:${clientId}`;
      const organizationId = await this.env.CLIENT_REGISTRY.get(clientToOrgKey);
      
      if (!organizationId) {
        return null;
      }

      // Step 2: Get full client info from org-specific namespace
      const orgKvKey = `${OrgAwareClientRegistryManager.ORG_CLIENT_PREFIX}${organizationId}:${clientId}`;
      const orgData = await this.env.CLIENT_REGISTRY.get(orgKvKey);
      
      if (orgData) {
        const orgClientInfo: OrgClientInfo = JSON.parse(orgData);
        return {
          organizationId: orgClientInfo.organizationId,
          organizationSlug: orgClientInfo.organizationSlug,
          userId: orgClientInfo.userId,
          userRole: orgClientInfo.userRole
        };
      }

      return null;

    } catch (error) {
      syncLogger.error('Failed to get client organization', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return null;
    }
  }

  /**
   * Update client activity timestamp
   */
  async updateClientActivity(clientId: string, organizationId: string): Promise<void> {
    try {
      const kvKey = `${OrgAwareClientRegistryManager.KV_PREFIX}${organizationId}:${clientId}`;
      const data = await this.env.CLIENT_REGISTRY.get(kvKey);

      if (data) {
        const clientInfo: OrgClientInfo = JSON.parse(data);
        clientInfo.lastActivityAt = new Date().toISOString();

        await this.env.CLIENT_REGISTRY.put(kvKey, JSON.stringify(clientInfo), {
          expirationTtl: OrgAwareClientRegistryManager.CLIENT_EXPIRY
        });
      }

    } catch (error) {
      syncLogger.warn('Failed to update client activity', {
        clientId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Remove client from all registries
   */
  async removeClient(clientId: string, organizationId?: string): Promise<void> {
    try {
      // If organizationId not provided, look it up
      if (!organizationId) {
        const clientOrg = await this.getClientOrganization(clientId);
        organizationId = clientOrg?.organizationId;
      }

      // Remove from organization-specific registry
      if (organizationId) {
        const orgKey = `${OrgAwareClientRegistryManager.ORG_CLIENT_PREFIX}${organizationId}:${clientId}`;
        await this.env.CLIENT_REGISTRY.delete(orgKey);
      }

      // Remove from reverse lookup index
      const clientToOrgKey = `client_to_org:${clientId}`;
      await this.env.CLIENT_REGISTRY.delete(clientToOrgKey);

      // Remove from global registry (backwards compatibility)
      const globalKey = `${OrgAwareClientRegistryManager.GLOBAL_CLIENT_PREFIX}${clientId}`;
      await this.env.CLIENT_REGISTRY.delete(globalKey);

      syncLogger.info('Removed client from all registries', {
        clientId,
        organizationId: organizationId || 'unknown'
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Failed to remove client', {
        clientId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Get statistics for organization-aware client registry
   */
  async getRegistryStats(): Promise<{
    totalClients: number;
    organizationClients: { [orgId: string]: number };
    kvStructure: {
      orgSpecificKeys: number;
      reverseIndexKeys: number;
      globalKeys: number;
    };
  }> {
    try {
      const [orgKeys, reverseKeys, globalKeys] = await Promise.all([
        this.env.CLIENT_REGISTRY.list({ prefix: OrgAwareClientRegistryManager.ORG_CLIENT_PREFIX }),
        this.env.CLIENT_REGISTRY.list({ prefix: 'client_to_org:' }),
        this.env.CLIENT_REGISTRY.list({ prefix: OrgAwareClientRegistryManager.GLOBAL_CLIENT_PREFIX })
      ]);

      const organizationClients: { [orgId: string]: number } = {};

      for (const key of orgKeys.keys) {
        // Extract organization ID from key format: org_clients:{orgId}:{clientId}
        const match = key.name.match(/^org_clients:([^:]+):/);
        if (match) {
          const orgId = match[1];
          organizationClients[orgId] = (organizationClients[orgId] || 0) + 1;
        }
      }

      const totalClients = Object.values(organizationClients).reduce((sum, count) => sum + count, 0);

      return {
        totalClients,
        organizationClients,
        kvStructure: {
          orgSpecificKeys: orgKeys.keys.length,
          reverseIndexKeys: reverseKeys.keys.length,
          globalKeys: globalKeys.keys.length
        }
      };

    } catch (error) {
      syncLogger.error('Failed to get registry stats', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return { 
        totalClients: 0, 
        organizationClients: {},
        kvStructure: {
          orgSpecificKeys: 0,
          reverseIndexKeys: 0,
          globalKeys: 0
        }
      };
    }
  }
}