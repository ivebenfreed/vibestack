/**
 * Broadcast Manager
 * 
 * Handles peer-to-peer communication between SyncDO instances.
 * Manages direct SyncDO-to-SyncDO broadcasts and conflict resolution broadcasting.
 */

import type { TableChange } from '@repo/sync-types';
import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';
import type { ClientRegistryManager } from './client-registry-manager';
import { getLatestChangeHistoryLSN } from '../lib/sync-common';
import type { MinimalContext } from '../types/hono';

const MODULE_NAME = 'BroadcastManager';

export interface BroadcastManagerContext {
  env: Env;
  clientId: string;
  clientRegistryManager: ClientRegistryManager;
  getContext: () => MinimalContext;
}

export class BroadcastManager {
  private context: BroadcastManagerContext;

  constructor(context: BroadcastManagerContext) {
    this.context = context;
  }

  /**
   * Broadcast changes directly to other SyncDO instances via KV registry
   * Primary path for low-latency client-to-client sync with anti-echo filtering
   */
  async broadcastChangesToOtherSyncDOs(changes: TableChange[], originClientId: string): Promise<void> {
    try {
      syncLogger.debug('Starting SyncDO broadcast', {
        changeCount: changes.length,
        originClientId
      }, MODULE_NAME);

      // Get all registered clients from KV registry with optimized lookup
      const activeClients = await this.context.clientRegistryManager.getActiveClients();
      
      syncLogger.debug('Active clients found for broadcast', {
        originClientId,
        activeClients,
        totalActiveClients: activeClients.length
      }, MODULE_NAME);
      
      // Filter out the originating client (anti-echo for primary path)
      const targetClients = activeClients.filter(clientId => clientId !== originClientId);
      
      syncLogger.debug('Target clients after filtering', {
        originClientId,
        targetClients,
        filteredCount: targetClients.length
      }, MODULE_NAME);
      
      if (targetClients.length === 0) {
        syncLogger.debug('No target clients for broadcast', { originClientId }, MODULE_NAME);
        return;
      }

      // Broadcast to each target client's SyncDO
      const broadcastPromises = targetClients.map(async (targetClientId) => {
        try {
          syncLogger.debug('Sending broadcast to target SyncDO', {
            originClientId,
            targetClientId,
            changeCount: changes.length,
            tables: [...new Set(changes.map(change => change.table))].join(', '),
            operations: changes.map(change => `${change.table}:${change.operation}`).join(', ')
          }, MODULE_NAME);
          
          await this.sendChangesToSyncDO(targetClientId, changes);
          
          syncLogger.debug('Broadcast sent successfully', {
            originClientId,
            targetClientId,
            changeCount: changes.length
          }, MODULE_NAME);
        } catch (error) {
          syncLogger.error('Failed to broadcast to SyncDO', {
            originClientId,
            targetClientId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }, MODULE_NAME);
          // Continue with other broadcasts even if one fails
        }
      });

      await Promise.allSettled(broadcastPromises);
      
      syncLogger.debug('SyncDO broadcast completed', {
        originClientId,
        targetCount: targetClients.length,
        changeCount: changes.length
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in SyncDO broadcast', {
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      // Don't throw - this is a best-effort optimization
    }
  }

  /**
   * Broadcast CRDT conflict resolution to ALL clients (including originator)
   * Authoritative path for conflict resolution - no anti-echo filtering
   */
  async broadcastConflictResolution(conflictedChanges: TableChange[], originClientId: string): Promise<void> {
    try {
      syncLogger.info('Starting CRDT conflict resolution broadcast', {
        changeCount: conflictedChanges.length,
        originClientId,
        conflictTables: [...new Set(conflictedChanges.map(c => c.table))]
      }, MODULE_NAME);

      // Get all registered clients from KV registry (including originator for authoritative resolution)
      const activeClients = await this.context.clientRegistryManager.getActiveClients();
      
      if (activeClients.length === 0) {
        syncLogger.debug('No active clients for conflict resolution broadcast', { originClientId }, MODULE_NAME);
        return;
      }

      syncLogger.info('Broadcasting conflict resolution to all clients', {
        originClientId,
        targetClients: activeClients,
        clientCount: activeClients.length,
        changeCount: conflictedChanges.length
      }, MODULE_NAME);

      // Broadcast to ALL clients (no anti-echo filtering for authoritative resolution)
      const broadcastPromises = activeClients.map(async (targetClientId) => {
        try {
          await this.sendConflictResolutionToSyncDO(targetClientId, conflictedChanges, originClientId);
          
          syncLogger.debug('Conflict resolution broadcast sent successfully', {
            originClientId,
            targetClientId,
            changeCount: conflictedChanges.length
          }, MODULE_NAME);
          
        } catch (error) {
          syncLogger.error('Failed to broadcast conflict resolution to SyncDO', {
            originClientId,
            targetClientId,
            error: error instanceof Error ? error.message : String(error)
          }, MODULE_NAME);
          // Continue with other broadcasts even if one fails
        }
      });

      await Promise.allSettled(broadcastPromises);
      
      syncLogger.info('CRDT conflict resolution broadcast completed', {
        originClientId,
        targetCount: activeClients.length,
        changeCount: conflictedChanges.length
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in CRDT conflict resolution broadcast', {
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      // Don't throw - this is a best-effort optimization
    }
  }

  /**
   * Send changes to a specific SyncDO instance
   * Uses current server LSN for proper LSN propagation
   * Implements "mark inactive on fail" approach for failed broadcasts
   */
  private async sendChangesToSyncDO(targetClientId: string, changes: TableChange[]): Promise<void> {
    try {
      // Get the SyncDO instance
      const id = this.context.env.SYNC.idFromName(`client:${targetClientId}`);
      const syncDO = this.context.env.SYNC.get(id);

      // Get current server LSN for proper LSN propagation
      const context = this.context.getContext();
      const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';

      // Create the URL with required parameters
      const url = new URL('http://internal/new-changes');
      url.searchParams.set('clientId', targetClientId);
      url.searchParams.set('lsn', serverLSN);

      // Send peer-to-peer changes via fetch
      syncLogger.debug('About to send fetch to target SyncDO', {
        targetClientId,
        url: url.toString(),
        bodySize: JSON.stringify({ changes, originClientId: this.context.clientId, timestamp: new Date().toISOString() }).length
      }, MODULE_NAME);
      
      const response = await syncDO.fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({ 
          changes,
          directBroadcast: true, // Flag to identify this as direct broadcast vs ReplicationDO
          originClientId: this.context.clientId
        })
      });

      syncLogger.debug('Received response from target SyncDO', {
        targetClientId,
        status: response.status,
        statusText: response.statusText
      }, MODULE_NAME);

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Broadcast failed with status ${response.status}: ${responseText}`);
      }

      syncLogger.debug('Successfully sent direct broadcast', {
        targetClientId,
        originClientId: this.context.clientId,
        changeCount: changes.length,
        responseStatus: response.status
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error sending changes to SyncDO - marking client inactive', {
        targetClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Mark the failed client as inactive using "mark inactive on fail" approach
      await this.context.clientRegistryManager.markClientsInactive([targetClientId]);
      
      throw error;
    }
  }

  /**
   * Send conflict resolution to a specific SyncDO instance with isConflictResolution flag
   * Implements "mark inactive on fail" approach for failed broadcasts
   */
  private async sendConflictResolutionToSyncDO(targetClientId: string, conflictedChanges: TableChange[], originClientId: string): Promise<void> {
    try {
      // Get the SyncDO instance
      const id = this.context.env.SYNC.idFromName(`client:${targetClientId}`);
      const syncDO = this.context.env.SYNC.get(id);

      // Get current server LSN for proper LSN propagation
      const context = this.context.getContext();
      const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';

      // Create the URL with required parameters
      const url = new URL('http://internal/new-changes');
      url.searchParams.set('clientId', targetClientId);
      url.searchParams.set('lsn', serverLSN);

      // Send with conflict resolution flag
      const response = await syncDO.fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({ 
          changes: conflictedChanges,
          isConflictResolution: true, // This flag removes anti-echo filtering
          originClientId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Conflict resolution broadcast failed with status ${response.status}: ${responseText}`);
      }

    } catch (error) {
      syncLogger.error('Error sending conflict resolution to SyncDO - marking client inactive', {
        targetClientId,
        originClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Mark the failed client as inactive using "mark inactive on fail" approach
      await this.context.clientRegistryManager.markClientsInactive([targetClientId]);
      
      throw error;
    }
  }

  /**
   * Send direct broadcast with custom data
   */
  async sendDirectBroadcast(targetClientId: string, data: any): Promise<void> {
    try {
      const id = this.context.env.SYNC.idFromName(`client:${targetClientId}`);
      const syncDO = this.context.env.SYNC.get(id);

      // Get current server LSN for proper LSN propagation
      const context = this.context.getContext();
      const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';

      const url = new URL('http://internal/new-changes');
      url.searchParams.set('clientId', targetClientId);
      url.searchParams.set('lsn', serverLSN);

      const response = await syncDO.fetch(url.toString(), {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          directBroadcast: true,
          originClientId: this.context.clientId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Direct broadcast failed with status ${response.status}: ${responseText}`);
      }

      syncLogger.debug('Direct broadcast sent successfully', {
        targetClientId,
        originClientId: this.context.clientId
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error sending direct broadcast', {
        targetClientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Mark the failed client as inactive
      await this.context.clientRegistryManager.markClientsInactive([targetClientId]);
      
      throw error;
    }
  }

  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(): Promise<{
    activeClientCount: number;
    canBroadcast: boolean;
  }> {
    try {
      const stats = await this.context.clientRegistryManager.getRegistryStats();
      
      return {
        activeClientCount: stats.activeClients,
        canBroadcast: stats.activeClients > 1 // Need at least one other client
      };
    } catch (error) {
      syncLogger.error('Error getting broadcast statistics', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return {
        activeClientCount: 0,
        canBroadcast: false
      };
    }
  }
}