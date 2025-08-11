/**
 * Sync Strategy Analyzer
 * 
 * Analyzes LSN gaps, determines sync strategies, and manages heartbeat-triggered sync operations.
 * Handles the decision logic for initial, catchup, and live sync strategies.
 */

import { performInitialSync } from './initial-sync-generic';
import { performCatchupSync, createLiveSyncConfirmation } from './server-changes-generic';
import type { MinimalContext } from '../types/hono';
import type { WebSocketHandler } from './types';
import { syncLogger } from '../middleware/logger';
import { compareLSN } from '../lib/sync-common';

const MODULE_NAME = 'SyncStrategyAnalyzer';

/**
 * Type of sync to perform based on client state
 */
export enum SyncStrategy {
  INITIAL = 'initial',
  CATCHUP = 'catchup',
  LIVE = 'live'
}

export interface SyncStrategyContext {
  clientId: string;
  stateManager: any; // StateManager type
  getContext: () => MinimalContext;
  webSocketHandler: WebSocketHandler;
}

export class SyncStrategyAnalyzer {
  private context: SyncStrategyContext;

  constructor(context: SyncStrategyContext) {
    this.context = context;
  }

  /**
   * Determine which sync strategy to use based on client state
   */
  async determineSyncStrategy(
    clientId: string, 
    clientLSN: string
  ): Promise<{ strategy: SyncStrategy, serverLSN: string }> {
    syncLogger.info('Determining sync strategy', {
      clientId,
      clientLSN,
      lsnType: typeof clientLSN,
      lsnLength: clientLSN?.length,
      isZero: clientLSN === '0/0',
      isFalsy: !clientLSN
    }, MODULE_NAME);
    
    // Register the client
    await this.context.stateManager.registerClient(clientId);
    
    // Store the client's LSN
    await this.context.stateManager.updateClientLSN(clientId, clientLSN);
    
    // Get the current server LSN from WAL position to match what's sent in srv_init_complete
    const serverLSN = await this.context.stateManager.getServerLSN() || '0/0';
    
    syncLogger.info('LSN comparison', {
      clientLSN,
      serverLSN,
      clientIsZero: clientLSN === '0/0',
      comparison: compareLSN(clientLSN, serverLSN)
    }, MODULE_NAME);
    
    // If client has no LSN (0/0), it needs initial sync
    if (clientLSN === '0/0') {
      syncLogger.info('Client needs initial sync - LSN is 0/0', {
        clientId,
        clientLSN,
        serverLSN
      }, MODULE_NAME);
      return { strategy: SyncStrategy.INITIAL, serverLSN };
    }
    
    // If client LSN is behind server LSN, client needs catchup sync
    if (compareLSN(clientLSN, serverLSN) < 0) {
      syncLogger.info('Client needs catchup sync', {
        clientId,
        clientLSN,
        serverLSN
      }, MODULE_NAME);
      return { strategy: SyncStrategy.CATCHUP, serverLSN };
    }
    
    // If client LSN is ahead of server LSN, server was reset - client needs full reset
    if (compareLSN(clientLSN, serverLSN) > 0) {
      syncLogger.warn('Client is ahead of server - server was likely reset, forcing client reset', {
        clientId,
        clientLSN,
        serverLSN,
        reason: 'server_behind_client'
      }, MODULE_NAME);
      return { strategy: SyncStrategy.INITIAL, serverLSN };
    }
    
    // Client is up to date
    syncLogger.info('Client is up to date', {
      clientId,
      lsn: clientLSN
    }, MODULE_NAME);
    return { strategy: SyncStrategy.LIVE, serverLSN };
  }

  /**
   * Perform the appropriate sync based on determined strategy
   */
  async performSync(
    { strategy, serverLSN }: { strategy: SyncStrategy, serverLSN: string },
    clientId: string,
    lsn: string
  ): Promise<void> {
    const context = this.context.getContext();
    
    switch (strategy) {
      case SyncStrategy.INITIAL:
        await this.performInitialSync(context, clientId, serverLSN);
        break;
        
      case SyncStrategy.CATCHUP:
        await this.performCatchupSync(context, clientId, lsn, serverLSN);
        break;
        
      case SyncStrategy.LIVE:
        // Update client sync state to live
        await this.context.stateManager.updateClientSyncState(clientId, 'live');
        
        // Send confirmation message for live sync
        const liveSyncMessage = createLiveSyncConfirmation(clientId, lsn);
        await this.context.webSocketHandler.send(liveSyncMessage);
        
        syncLogger.info('Live sync confirmed', {
          clientId,
          lsn,
          serverLSN
        }, MODULE_NAME);
        break;
        
      default:
        throw new Error(`Unknown sync strategy: ${strategy}`);
    }
  }

  /**
   * Analyze the LSN gap between client and server to determine if catchup is needed
   */
  analyzeLSNGap(clientLSN: string, serverLSN: string): {
    gapSize: number;
    shouldTriggerCatchup: boolean;
    threshold: number;
  } {
    // Calculate the gap size by converting LSN hex values to decimal
    const clientDecimal = this.lsnToDecimal(clientLSN);
    const serverDecimal = this.lsnToDecimal(serverLSN);
    const gapSize = serverDecimal - clientDecimal;
    
    // Threshold for triggering catchup sync
    // ~16MB worth of WAL (typical for significant missed changes)
    const CATCHUP_THRESHOLD = 16 * 1024 * 1024; // 16MB in bytes
    
    return {
      gapSize,
      shouldTriggerCatchup: gapSize > CATCHUP_THRESHOLD,
      threshold: CATCHUP_THRESHOLD
    };
  }

  /**
   * Trigger initial sync from heartbeat when client LSN is 0/0 (integrity reset scenario)
   */
  async triggerInitialSyncFromHeartbeat(
    clientId: string, 
    serverLSN: string
  ): Promise<void> {
    try {
      syncLogger.info('Triggering initial sync from heartbeat for LSN 0/0', {
        clientId,
        serverLSN
      }, MODULE_NAME);

      // Send state change to initial to the client
      await this.context.webSocketHandler.send({
        type: 'srv_state_change',
        clientId,
        messageId: `initial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        state: 'initial',
        lsn: serverLSN
      } as any);

      // Perform initial sync (client LSN is 0/0)
      await this.performSync(
        { strategy: SyncStrategy.INITIAL, serverLSN },
        clientId,
        '0/0'
      );

      syncLogger.info('Heartbeat-triggered initial sync completed', {
        clientId,
        startLSN: '0/0',
        endLSN: serverLSN
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in heartbeat-triggered initial sync', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Trigger catchup sync from heartbeat when large LSN gap is detected
   */
  async triggerCatchupFromHeartbeat(
    clientId: string, 
    clientLSN: string, 
    serverLSN: string
  ): Promise<void> {
    try {
      syncLogger.info('Triggering catchup sync from heartbeat', {
        clientId,
        clientLSN,
        serverLSN
      }, MODULE_NAME);

      // Send state change to catchup to the client
      await this.context.webSocketHandler.send({
        type: 'srv_state_change',
        clientId,
        messageId: `catchup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        state: 'catchup',
        lsn: serverLSN
      } as any);

      // Perform catchup sync
      await performCatchupSync(
        this.context.getContext(),
        clientId,
        clientLSN,
        serverLSN,
        this.context.webSocketHandler,
        this.context.stateManager
      );

      syncLogger.info('Heartbeat-triggered catchup sync completed', {
        clientId,
        startLSN: clientLSN,
        endLSN: serverLSN
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error in heartbeat-triggered catchup sync', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Perform initial sync with automatic catchup if needed
   */
  private async performInitialSync(
    context: MinimalContext,
    clientId: string,
    serverLSN: string
  ): Promise<void> {
    // Update sync state
    await this.context.stateManager.updateClientSyncState(clientId, 'initial');
    
    // Perform initial sync and get the LSNs
    const { startLSN, endLSN } = await performInitialSync(
      this.context.webSocketHandler,
      context,
      clientId,
      this.context.stateManager
    );
    
    syncLogger.info('Initial sync completed, checking if catchup sync is needed', {
      clientId,
      startLSN,
      endLSN
    }, MODULE_NAME);
    
    // Only perform catchup if the server LSN changed during initial sync
    // (i.e., new changes came in while we were syncing)
    if (compareLSN(startLSN, endLSN) < 0) {
      syncLogger.info('Starting automatic catchup sync after initial sync', {
        clientId,
        reason: 'Changes occurred during initial sync',
        startLSN,
        endLSN
      }, MODULE_NAME);
      
      // Client is now at startLSN (the point where initial sync started)
      // and needs to catch up to endLSN
      await this.performCatchupSync(context, clientId, startLSN, endLSN);
    } else {
      syncLogger.info('No catchup sync needed after initial sync', {
        clientId,
        reason: 'No changes during initial sync',
        lsn: endLSN
      }, MODULE_NAME);
      
      // Update client sync state to live
      await this.context.stateManager.updateClientSyncState(clientId, 'live');
    }
  }

  /**
   * Perform catchup sync
   */
  private async performCatchupSync(
    context: MinimalContext,
    clientId: string,
    clientLSN: string,
    serverLSN: string
  ): Promise<void> {
    // Update client's sync state in storage
    await this.context.stateManager.updateClientSyncState(clientId, 'catchup');
    
    // Perform catchup sync with both LSNs
    await performCatchupSync(
      context,
      clientId,
      clientLSN,
      serverLSN,
      this.context.webSocketHandler,
      this.context.stateManager
    );
    
    // Update client sync state to live after catchup completes
    await this.context.stateManager.updateClientSyncState(clientId, 'live');
    
    syncLogger.info('Catchup sync completed, client now in live mode', {
      clientId,
      startLSN: clientLSN,
      endLSN: serverLSN
    }, MODULE_NAME);
  }

  /**
   * Convert LSN string to decimal for gap calculation
   */
  private lsnToDecimal(lsn: string): number {
    const [major, minor] = lsn.split('/');
    // PostgreSQL LSN: major part * 16MB + minor part
    return parseInt(major || '0', 16) * 0x1000000 + parseInt(minor || '0', 16);
  }

  /**
   * Get sync strategy statistics
   */
  async getSyncStats(): Promise<{
    currentStrategy: SyncStrategy | null;
    clientLSN: string;
    serverLSN: string;
    gapInfo?: {
      gapSize: number;
      shouldTriggerCatchup: boolean;
      threshold: number;
    };
  }> {
    try {
      const clientLSN = await this.context.stateManager.getLSN() || '0/0';
      const serverLSN = await this.context.stateManager.getServerLSN() || '0/0';
      const syncState = await this.context.stateManager.getClientSyncState(this.context.clientId);
      
      // Determine current strategy based on state
      let currentStrategy: SyncStrategy | null = null;
      switch (syncState) {
        case 'initial':
          currentStrategy = SyncStrategy.INITIAL;
          break;
        case 'catchup':
          currentStrategy = SyncStrategy.CATCHUP;
          break;
        case 'live':
          currentStrategy = SyncStrategy.LIVE;
          break;
      }
      
      const stats = {
        currentStrategy,
        clientLSN,
        serverLSN
      };
      
      // Add gap info if there's a gap
      if (clientLSN !== '0/0' && compareLSN(clientLSN, serverLSN) < 0) {
        return {
          ...stats,
          gapInfo: this.analyzeLSNGap(clientLSN, serverLSN)
        };
      }
      
      return stats;
    } catch (error) {
      syncLogger.error('Error getting sync statistics', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return {
        currentStrategy: null,
        clientLSN: '0/0',
        serverLSN: '0/0'
      };
    }
  }
}