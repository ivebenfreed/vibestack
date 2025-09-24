/**
 * Unified Client Registry
 * 
 * Single source of truth for all client tracking across the sync system.
 * Replaces the fragmented legacy single-tenant and org-aware dual registry systems.
 * 
 * Key Features:
 * - Organization-native design (no cross-tenant leakage)
 * - Unified TTL policy (2 hours, refreshed by heartbeats)
 * - Complete client context in single record
 * - Hibernation-safe with proper TTL management
 */

import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'unified-client-registry';

export interface UnifiedClientInfo {
  // Identity
  clientId: string;
  organizationId: string;
  organizationSlug: string;
  
  // User context
  userId: string;
  userRole: string;
  userEmail?: string;
  userName?: string;
  
  // Connection tracking
  connectedAt: string;
  lastActivityAt: string;
  active: boolean;
  lastSeen: number;
  
  // Optional metadata
  metadata?: Record<string, any>;
}

export class UnifiedClientRegistry {
  private static readonly CLIENT_PREFIX = 'unified_client:';
  private static readonly ORG_INDEX_PREFIX = 'org_index:';
  private static readonly CLIENT_TTL = 2 * 60 * 60; // 2 hours in seconds (consistent with heartbeat expectations)

  constructor(private env: any) {}

  /**
   * Register a client with complete organization context
   */
  async registerClient(clientInfo: {
    clientId: string;
    organizationId: string;
    organizationSlug: string;
    userId: string;
    userRole: string;
    userEmail?: string;
    userName?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const now = new Date().toISOString();
      const unifiedClientInfo: UnifiedClientInfo = {
        ...clientInfo,
        connectedAt: now,
        lastActivityAt: now,
        active: true,
        lastSeen: Date.now()
      };

      // Universe-scoped storage: Client record with user context (not org-scoped)
      // Key format: unified_client:{clientId} (no org prefix for universe scope)
      const clientKey = `${UnifiedClientRegistry.CLIENT_PREFIX}${clientInfo.clientId}`;

      syncLogger.info('🔧 REGISTRY STORE DEBUG: Storing client with key', {
        clientKey,
        organizationId: clientInfo.organizationId,
        clientId: clientInfo.clientId,
        prefix: UnifiedClientRegistry.CLIENT_PREFIX,
        ttlSeconds: UnifiedClientRegistry.CLIENT_TTL
      }, MODULE_NAME);

      await this.env.CLIENT_REGISTRY.put(clientKey, JSON.stringify(unifiedClientInfo), {
        expirationTtl: UnifiedClientRegistry.CLIENT_TTL
      });

      // Organization index for efficient org-scoped queries
      // Key format: org_index:{orgId}
      await this.addToOrganizationIndex(clientInfo.organizationId, clientInfo.clientId);

      syncLogger.info('Registered client in unified registry', {
        clientId: clientInfo.clientId,
        organizationId: clientInfo.organizationId,
        organizationSlug: clientInfo.organizationSlug,
        userId: clientInfo.userId,
        userRole: clientInfo.userRole
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Failed to register client in unified registry', {
        clientId: clientInfo.clientId,
        organizationId: clientInfo.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Update client activity and refresh TTL (called by heartbeats)
   */
  async updateClientActivity(clientId: string, organizationId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const clientKey = `${UnifiedClientRegistry.CLIENT_PREFIX}${organizationId}:${clientId}`;
      const data = await this.env.CLIENT_REGISTRY.get(clientKey);

      if (data) {
        const clientInfo: UnifiedClientInfo = JSON.parse(data);
        
        // Update activity timestamps
        clientInfo.lastActivityAt = new Date().toISOString();
        clientInfo.lastSeen = Date.now();
        clientInfo.active = true;
        
        // Update metadata if provided
        if (metadata) {
          clientInfo.metadata = { ...clientInfo.metadata, ...metadata };
        }

        // Store with refreshed TTL
        await this.env.CLIENT_REGISTRY.put(clientKey, JSON.stringify(clientInfo), {
          expirationTtl: UnifiedClientRegistry.CLIENT_TTL
        });

        syncLogger.debug('Updated client activity in unified registry', {
          clientId,
          organizationId,
          lastActivityAt: clientInfo.lastActivityAt
        }, MODULE_NAME);

      } else {
        syncLogger.warn('Attempted to update activity for non-existent client', {
          clientId,
          organizationId
        }, MODULE_NAME);
      }

    } catch (error) {
      syncLogger.error('Failed to update client activity', {
        clientId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      // Don't throw - heartbeat should continue even if activity update fails
    }
  }

  /**
   * Get all active clients for an organization
   */
  async getOrgActiveClients(organizationId: string): Promise<string[]> {
    try {
      const prefix = `${UnifiedClientRegistry.CLIENT_PREFIX}${organizationId}:`;

      syncLogger.info('🔧 REGISTRY LOOKUP DEBUG: Searching for clients', {
        organizationId,
        prefix,
        staticPrefix: UnifiedClientRegistry.CLIENT_PREFIX
      }, MODULE_NAME);

      const listResult = await this.env.CLIENT_REGISTRY.list({ prefix });
      
      const activeClientIds: string[] = [];
      
      for (const key of listResult.keys) {
        try {
          const data = await this.env.CLIENT_REGISTRY.get(key.name);
          if (data) {
            const clientInfo: UnifiedClientInfo = JSON.parse(data);
            if (clientInfo.active) {
              activeClientIds.push(clientInfo.clientId);
            }
          }
        } catch (parseError) {
          syncLogger.warn('Failed to parse client data', {
            key: key.name,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }, MODULE_NAME);
        }
      }

      syncLogger.info('🔍 REGISTRY DEBUG: Retrieved org active clients', {
        organizationId,
        activeClientCount: activeClientIds.length,
        clientIds: activeClientIds,
        allKeysFound: listResult.keys.map(k => k.name)
      }, MODULE_NAME);

      return activeClientIds;

    } catch (error) {
      syncLogger.error('Failed to get org active clients', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Get ALL active clients across all organizations (universe scope)
   * Used for sending notifications that will be filtered by frontend permissions
   */
  async getAllActiveClients(): Promise<string[]> {
    try {
      const prefix = UnifiedClientRegistry.CLIENT_PREFIX;
      const listResult = await this.env.CLIENT_REGISTRY.list({ prefix });

      const activeClientIds: string[] = [];

      for (const key of listResult.keys) {
        try {
          const data = await this.env.CLIENT_REGISTRY.get(key.name);
          if (data) {
            const clientInfo: UnifiedClientInfo = JSON.parse(data);
            if (clientInfo.active) {
              activeClientIds.push(clientInfo.clientId);
            }
          }
        } catch (parseError) {
          syncLogger.warn('Failed to parse client data', {
            key: key.name,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }, MODULE_NAME);
        }
      }

      syncLogger.info('🌍 UNIVERSE REGISTRY: Retrieved all active clients', {
        activeClientCount: activeClientIds.length,
        clientIds: activeClientIds,
        allKeysFound: listResult.keys.map(k => k.name)
      }, MODULE_NAME);

      return activeClientIds;

    } catch (error) {
      syncLogger.error('Failed to get all active clients', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Get complete client information
   */
  async getClientInfo(clientId: string, organizationId?: string): Promise<UnifiedClientInfo | null> {
    try {
      // Use universe-scoped key format (no org prefix)
      const clientKey = `${UnifiedClientRegistry.CLIENT_PREFIX}${clientId}`;
      const data = await this.env.CLIENT_REGISTRY.get(clientKey);
      
      if (data) {
        return JSON.parse(data) as UnifiedClientInfo;
      }
      
      return null;

    } catch (error) {
      syncLogger.error('Failed to get client info', {
        clientId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return null;
    }
  }

  /**
   * Mark client as inactive (called on disconnect)
   */
  async markClientInactive(clientId: string, organizationId?: string): Promise<void> {
    try {
      // Use universe-scoped key format (no org prefix)
      const clientKey = `${UnifiedClientRegistry.CLIENT_PREFIX}${clientId}`;
      const data = await this.env.CLIENT_REGISTRY.get(clientKey);

      if (data) {
        const clientInfo: UnifiedClientInfo = JSON.parse(data);
        clientInfo.active = false;
        clientInfo.lastActivityAt = new Date().toISOString();

        // Store with shorter TTL for inactive clients
        await this.env.CLIENT_REGISTRY.put(clientKey, JSON.stringify(clientInfo), {
          expirationTtl: 60 * 60 // 1 hour for inactive clients
        });

        syncLogger.info('Marked client as inactive', {
          clientId,
          organizationId
        }, MODULE_NAME);
      }

    } catch (error) {
      syncLogger.error('Failed to mark client inactive', {
        clientId,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Remove client completely (called on explicit disconnect)
   */
  async removeClient(clientId: string, organizationId?: string): Promise<void> {
    try {
      // Use universe-scoped key format (no org prefix)
      const clientKey = `${UnifiedClientRegistry.CLIENT_PREFIX}${clientId}`;
      await this.env.CLIENT_REGISTRY.delete(clientKey);
      
      // Remove from organization index
      await this.removeFromOrganizationIndex(organizationId, clientId);

      syncLogger.info('Removed client from unified registry', {
        clientId,
        organizationId
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
   * Get all client IDs for an organization (active and inactive)
   */
  async getAllOrgClients(organizationId: string): Promise<string[]> {
    try {
      const prefix = `${UnifiedClientRegistry.CLIENT_PREFIX}${organizationId}:`;
      const listResult = await this.env.CLIENT_REGISTRY.list({ prefix });
      
      const allClientIds: string[] = [];
      
      for (const key of listResult.keys) {
        // Extract clientId from key format: unified_client:{orgId}:{clientId}
        const clientId = key.name.split(':')[2];
        if (clientId) {
          allClientIds.push(clientId);
        }
      }

      return allClientIds;

    } catch (error) {
      syncLogger.error('Failed to get all org clients', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Health check - get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalClients: number;
    activeClients: number;
    organizationCount: number;
  }> {
    try {
      const listResult = await this.env.CLIENT_REGISTRY.list({ prefix: UnifiedClientRegistry.CLIENT_PREFIX });
      
      let totalClients = 0;
      let activeClients = 0;
      const organizations = new Set<string>();
      
      for (const key of listResult.keys) {
        totalClients++;
        
        // Extract orgId from key format: unified_client:{orgId}:{clientId}
        const orgId = key.name.split(':')[1];
        if (orgId) {
          organizations.add(orgId);
        }
        
        try {
          const data = await this.env.CLIENT_REGISTRY.get(key.name);
          if (data) {
            const clientInfo: UnifiedClientInfo = JSON.parse(data);
            if (clientInfo.active) {
              activeClients++;
            }
          }
        } catch (parseError) {
          // Skip malformed entries
        }
      }

      return {
        totalClients,
        activeClients,
        organizationCount: organizations.size
      };

    } catch (error) {
      syncLogger.error('Failed to get registry stats', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return {
        totalClients: 0,
        activeClients: 0,
        organizationCount: 0
      };
    }
  }

  // Private helper methods

  private async addToOrganizationIndex(organizationId: string, clientId: string): Promise<void> {
    try {
      const indexKey = `${UnifiedClientRegistry.ORG_INDEX_PREFIX}${organizationId}`;
      const data = await this.env.CLIENT_REGISTRY.get(indexKey);
      
      let clientSet: Set<string>;
      if (data) {
        const existingClients = JSON.parse(data) as string[];
        clientSet = new Set(existingClients);
      } else {
        clientSet = new Set();
      }
      
      clientSet.add(clientId);
      
      await this.env.CLIENT_REGISTRY.put(indexKey, JSON.stringify(Array.from(clientSet)), {
        expirationTtl: UnifiedClientRegistry.CLIENT_TTL
      });
      
    } catch (error) {
      // Index is optional - don't fail the main operation
      syncLogger.warn('Failed to update organization index', {
        organizationId,
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  private async removeFromOrganizationIndex(organizationId: string, clientId: string): Promise<void> {
    try {
      const indexKey = `${UnifiedClientRegistry.ORG_INDEX_PREFIX}${organizationId}`;
      const data = await this.env.CLIENT_REGISTRY.get(indexKey);
      
      if (data) {
        const existingClients = JSON.parse(data) as string[];
        const clientSet = new Set(existingClients);
        clientSet.delete(clientId);
        
        if (clientSet.size > 0) {
          await this.env.CLIENT_REGISTRY.put(indexKey, JSON.stringify(Array.from(clientSet)), {
            expirationTtl: UnifiedClientRegistry.CLIENT_TTL
          });
        } else {
          await this.env.CLIENT_REGISTRY.delete(indexKey);
        }
      }
      
    } catch (error) {
      // Index is optional - don't fail the main operation
      syncLogger.warn('Failed to remove from organization index', {
        organizationId,
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
}