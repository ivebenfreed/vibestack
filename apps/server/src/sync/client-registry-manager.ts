/**
 * Client Registry Manager
 * 
 * Manages KV registry operations for tracking active/inactive clients.
 * Handles batch operations, status updates, and cleanup operations.
 */

import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'ClientRegistryManager';

export interface ClientRegistryData {
  active: boolean;
  lastSeen: number;
  disconnectedAt?: number;
  markedInactiveReason?: string;
  userId?: string;
  userRole?: string;
  userEmail?: string;
  userName?: string;
  organizationId?: string;
  organizationSlug?: string;
}

export interface ClientRegistryManagerContext {
  env: Env;
  state: DurableObjectState;
}

export class ClientRegistryManager {
  private context: ClientRegistryManagerContext;

  constructor(context: ClientRegistryManagerContext) {
    this.context = context;
  }

  /**
   * Get list of active clients from KV registry with optimized batch lookup
   * Uses parallel processing to minimize latency
   */
  async getActiveClients(): Promise<string[]> {
    try {
      // Use list operation to get all client keys in one call
      const listResult = await this.context.env.CLIENT_REGISTRY.list({ prefix: 'client:' });
      
      if (listResult.keys.length === 0) {
        return [];
      }

      // Process clients in parallel batches for better performance
      const BATCH_SIZE = 10;
      const activeClients: string[] = [];
      const failedClients: string[] = [];

      for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
        const batch = listResult.keys.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (key: any) => {
          const clientId = key.name.replace('client:', '');
          
          try {
            const clientData = await this.context.env.CLIENT_REGISTRY.get(key.name);
            if (clientData) {
              const data = JSON.parse(clientData) as ClientRegistryData;
              return data.active === true ? clientId : null;
            }
          } catch (error) {
            failedClients.push(clientId);
            syncLogger.warn('Failed to read client data during registry lookup', {
              clientId,
              error: error instanceof Error ? error.message : String(error)
            }, MODULE_NAME);
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        activeClients.push(...batchResults.filter(Boolean) as string[]);
      }

      // Clean up failed clients by marking them inactive
      if (failedClients.length > 0) {
        this.context.state.waitUntil(this.markClientsInactive(failedClients));
      }

      return activeClients;
    } catch (error) {
      syncLogger.error('Error getting active clients from registry', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Mark multiple clients as inactive in KV registry
   * Used by "mark inactive on fail" approach when clients can't be reached
   */
  async markClientsInactive(clientIds: string[]): Promise<void> {
    const promises = clientIds.map(async (clientId) => {
      try {
        const key = `client:${clientId}`;
        const existingData = await this.context.env.CLIENT_REGISTRY.get(key);
        
        if (existingData) {
          let data: ClientRegistryData;
          try {
            data = JSON.parse(existingData);
          } catch (parseError) {
            // Create new data object if parsing fails
            data = {
              active: false,
              lastSeen: Date.now()
            };
          }
          
          // Mark as inactive and record when it failed
          await this.context.env.CLIENT_REGISTRY.put(
            key,
            JSON.stringify({
              ...data,
              active: false,
              lastSeen: data.lastSeen || Date.now(),
              disconnectedAt: Date.now(),
              markedInactiveReason: 'registry_access_failed'
            })
          );
          
          syncLogger.debug('Marked client inactive due to access failure', {
            clientId,
            reason: 'registry_access_failed'
          }, MODULE_NAME);
        }
      } catch (error) {
        syncLogger.error('Failed to mark client as inactive', {
          clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      }
    });
    
    await Promise.allSettled(promises);
  }

  /**
   * Update client active status and last seen timestamp
   */
  async updateClientStatus(clientId: string, active: boolean, additionalData?: Partial<ClientRegistryData>): Promise<void> {
    const key = `client:${clientId}`;
    
    try {
      const existingData = await this.context.env.CLIENT_REGISTRY.get(key);
      let data: ClientRegistryData;

      if (existingData) {
        try {
          data = JSON.parse(existingData);
        } catch (parseError) {
          data = {
            active,
            lastSeen: Date.now()
          };
        }
      } else {
        data = {
          active,
          lastSeen: Date.now()
        };
      }

      // Update with new values
      const updatedData: ClientRegistryData = {
        ...data,
        active,
        lastSeen: Date.now(),
        ...additionalData
      };

      await this.context.env.CLIENT_REGISTRY.put(
        key,
        JSON.stringify(updatedData),
        {
          // Refresh TTL - 2 hours
          expirationTtl: 2 * 60 * 60
        }
      );
      
      syncLogger.debug('Updated client status in registry', {
        clientId,
        active,
        lastSeen: new Date().toISOString()
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to update client status in registry', {
        clientId,
        active,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Get client data from registry
   */
  async getClientData(clientId: string): Promise<ClientRegistryData | null> {
    const key = `client:${clientId}`;
    
    try {
      const existingData = await this.context.env.CLIENT_REGISTRY.get(key);
      
      if (existingData) {
        try {
          return JSON.parse(existingData) as ClientRegistryData;
        } catch (parseError) {
          syncLogger.warn('Failed to parse client data from registry', {
            clientId,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }, MODULE_NAME);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      syncLogger.error('Failed to get client data from registry', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return null;
    }
  }

  /**
   * Create or update client registry entry
   */
  async upsertClient(clientId: string, data: Partial<ClientRegistryData>): Promise<void> {
    const key = `client:${clientId}`;
    
    try {
      const existingData = await this.context.env.CLIENT_REGISTRY.get(key);
      let currentData: ClientRegistryData;

      if (existingData) {
        try {
          currentData = JSON.parse(existingData);
        } catch (parseError) {
          currentData = {
            active: true,
            lastSeen: Date.now()
          };
        }
      } else {
        currentData = {
          active: true,
          lastSeen: Date.now()
        };
      }

      // Merge with provided data
      const updatedData: ClientRegistryData = {
        ...currentData,
        ...data,
        lastSeen: Date.now() // Always update lastSeen
      };

      await this.context.env.CLIENT_REGISTRY.put(
        key,
        JSON.stringify(updatedData),
        {
          expirationTtl: 2 * 60 * 60 // 2 hours
        }
      );
      
      syncLogger.debug('Upserted client in registry', {
        clientId,
        data: updatedData
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to upsert client in registry', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Remove client from registry
   */
  async removeClient(clientId: string): Promise<void> {
    const key = `client:${clientId}`;
    
    try {
      await this.context.env.CLIENT_REGISTRY.delete(key);
      
      syncLogger.debug('Removed client from registry', {
        clientId
      }, MODULE_NAME);
    } catch (error) {
      syncLogger.error('Failed to remove client from registry', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }

  /**
   * Handle heartbeat by updating client active status
   */
  async handleHeartbeat(clientId: string, additionalData?: Partial<ClientRegistryData>): Promise<void> {
    const existingData = await this.getClientData(clientId);
    
    if (existingData) {
      await this.updateClientStatus(clientId, true, additionalData);
      
      syncLogger.info('Updated client active status on heartbeat', {
        clientId,
        active: true,
        lastSeen: new Date().toISOString()
      }, MODULE_NAME);
    } else {
      syncLogger.warn('Client not found in registry during heartbeat - creating new entry', {
        clientId
      }, MODULE_NAME);
      
      // Create new entry if client doesn't exist
      await this.upsertClient(clientId, {
        active: true,
        ...additionalData
      });
      
      syncLogger.info('Created new client registry entry on heartbeat', {
        clientId
      }, MODULE_NAME);
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats(): Promise<{
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
  }> {
    try {
      const listResult = await this.context.env.CLIENT_REGISTRY.list({ prefix: 'client:' });
      
      let activeCount = 0;
      let inactiveCount = 0;
      
      // Process in batches to avoid overwhelming the system
      const BATCH_SIZE = 20;
      for (let i = 0; i < listResult.keys.length; i += BATCH_SIZE) {
        const batch = listResult.keys.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (key: any) => {
          try {
            const clientData = await this.context.env.CLIENT_REGISTRY.get(key.name);
            if (clientData) {
              const data = JSON.parse(clientData) as ClientRegistryData;
              return data.active === true ? 'active' : 'inactive';
            }
          } catch (error) {
            // Count failed reads as inactive
            return 'inactive';
          }
          return 'inactive';
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(status => {
          if (status === 'active') {
            activeCount++;
          } else {
            inactiveCount++;
          }
        });
      }

      return {
        totalClients: listResult.keys.length,
        activeClients: activeCount,
        inactiveClients: inactiveCount
      };
    } catch (error) {
      syncLogger.error('Error getting registry statistics', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return {
        totalClients: 0,
        activeClients: 0,
        inactiveClients: 0
      };
    }
  }
}