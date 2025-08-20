import type { Client } from '@neondatabase/serverless';
import type { Env } from '../types/env';
import type { ReplicationConfig } from './types';
import { replicationLogger } from '../middleware/logger';
import { getDBClient, sql } from '../lib/db';
import type { MinimalContext } from '../types/hono';
import type { TableChange } from '@repo/sync-types';
import { StateManager } from './state-manager';
import type { DurableObjectState } from '../types/cloudflare';
import type { WALData } from '../types/wal';
// ====== Types and Interfaces ======
const MODULE_NAME = 'polling';

// ====== Constants ======
const DEFAULT_POLL_INTERVAL = 1000; // 1 second
const DEFAULT_BATCH_SIZE = 2000;    // Maximum changes to consume per cycle
const HEARTBEAT_INTERVAL = 60;      // Log a heartbeat every 60 polls (approx 1 minute)

// ====== Core Polling Class ======
export class PollingManager {
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  public hasCompletedFirstPoll = false;
  private isPolling = false;
  private pollCounter = 0;

  constructor(
    private readonly state: DurableObjectState,
    private readonly config: ReplicationConfig,
    private readonly c: MinimalContext,
    private readonly env: Env,
    private readonly stateManager: StateManager
  ) {}

  // ====== Public Interface ======
  public getPollCount(): number {
    return this.pollCounter;
  }

  public isPollingActive(): boolean {
    return this.pollingInterval !== null;
  }

  public async startPolling(): Promise<void> {
    try {
      if (this.pollingInterval) {
        replicationLogger.debug('Polling interval exists - clearing and restarting to ensure proper state', {}, MODULE_NAME);
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      
      this.pollCounter = 0;
      replicationLogger.debug('Starting polling process', {}, MODULE_NAME);
      
      this.startContinuousPolling();
      this.hasCompletedFirstPoll = true; // Set flag after polling actually starts
    } catch (err) {
      replicationLogger.error('Start polling error', {
        error: err instanceof Error ? err.message : String(err)
      }, MODULE_NAME);
      throw err;
    }
  }

  /**
   * Start polling and return the results of the first poll
   * This eliminates race conditions by doing everything in one sequence
   */
  public async startPollingWithFirstPollResults(): Promise<{
    success: boolean;
    changesFound: boolean;
    changeCount?: number;
    filteredCount?: number;
    walEntries?: number;
    error?: string;
  }> {
    try {
      if (this.pollingInterval) {
        replicationLogger.debug('Polling interval exists - clearing and restarting to ensure proper state', {}, MODULE_NAME);
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      
      this.pollCounter = 0;
      replicationLogger.debug('Starting polling process with first poll results', {}, MODULE_NAME);
      
      // Perform the first poll immediately and capture results
      const firstPollResults = await this.performFirstPollAndGetResults();
      
      // Now start continuous polling
      this.startContinuousPolling();
      this.hasCompletedFirstPoll = true;
      
      return firstPollResults;
    } catch (err) {
      replicationLogger.error('Start polling with first poll results error', {
        error: err instanceof Error ? err.message : String(err)
      }, MODULE_NAME);
      
      return {
        success: false,
        changesFound: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  /**
   * Perform the first poll and return detailed results
   */
  private async performFirstPollAndGetResults(): Promise<{
    success: boolean;
    changesFound: boolean;
    changeCount?: number;
    filteredCount?: number;
    walEntries?: number;
    error?: string;
  }> {
    // Use the same polling lock as continuous polling to prevent conflicts
    if (this.isPolling) {
      replicationLogger.info('First poll skipped - polling already in progress', {}, MODULE_NAME);
      return {
        success: true,
        changesFound: false,
        changeCount: 0,
        filteredCount: 0,
        walEntries: 0
      };
    }
    
    this.isPolling = true;
    
    try {
      replicationLogger.info('First poll starting - consuming live WAL changes', {
        slot: this.config.slot,
        batchSize: this.config.walBatchSize || DEFAULT_BATCH_SIZE
      }, MODULE_NAME);
      
      const changes = await this.pollForChanges();
      
      if (!changes || changes.length === 0) {
        replicationLogger.info('First poll completed - no new changes to consume', {
          slot: this.config.slot
        }, MODULE_NAME);
        return {
          success: true,
          changesFound: false,
          changeCount: 0,
          filteredCount: 0,
          walEntries: 0
        };
      }

      // Process the changes for table notifications only (consistent with ongoing polling)
      const result = await this.processChangesForNotifications(changes);

      return {
        success: true,
        changesFound: true,
        changeCount: result.clientsNotified,
        filteredCount: result.tablesChanged.length,
        walEntries: changes.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      replicationLogger.error('First poll error', { error: errorMessage }, MODULE_NAME);
      
      return {
        success: false,
        changesFound: false,
        error: errorMessage
      };
    } finally {
      this.isPolling = false;
    }
  }

  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollCounter = 0;
      this.hasCompletedFirstPoll = false;
      replicationLogger.debug('Polling stopped', {}, MODULE_NAME);
    }
  }



  // ====== Private Polling Methods ======
  private startContinuousPolling(): void {
    const pollInterval = this.config.pollingInterval || DEFAULT_POLL_INTERVAL;
    
    this.pollingInterval = setInterval(async () => {
      if (this.isPolling) {
        return;
      }
      
      this.isPolling = true;
      
      try {
        this.pollCounter++;
        
        if (this.pollCounter % HEARTBEAT_INTERVAL === 0) {
          replicationLogger.info('Polling heartbeat - consuming live changes', {
            counter: this.pollCounter,
            intervalMs: pollInterval
          }, MODULE_NAME);
        }
        
        await this.pollAndProcess();
      } catch (error) {
        replicationLogger.error('Polling error', {
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      } finally {
        this.isPolling = false;
      }
    }, pollInterval);
    
    replicationLogger.debug('Polling interval started', { intervalMs: pollInterval }, MODULE_NAME);
  }

  private async pollAndProcess(): Promise<void> {
    try {
      const changes = await this.pollForChanges();
      
      if (changes && changes.length > 0) {
        try {
          // Extract basic info about the WAL entries
          const firstLSN = changes[0]?.lsn;
          const lastLSN = changes[changes.length - 1]?.lsn;
          
          replicationLogger.info('🔥 SIMPLIFIED WAL CHANGES DETECTED', {
            walEntries: changes.length,
            lsnRange: {
              first: firstLSN,
              last: lastLSN
            }
          }, MODULE_NAME);

          // Process changes for table notifications only (no storing in change_history)
          const result = await this.processChangesForNotifications(changes);
          
          replicationLogger.info('✅ SIMPLIFIED NOTIFICATION CYCLE COMPLETED', {
            walEntriesProcessed: changes.length,
            tablesChanged: result.tablesChanged,
            organizationsNotified: result.organizationsNotified,
            clientsNotified: result.clientsNotified,
            nextPollIn: this.config.pollingInterval || DEFAULT_POLL_INTERVAL
          }, MODULE_NAME);
          
        } catch (processError) {
          const errorMsg = processError instanceof Error ? processError.message : String(processError);
          replicationLogger.error('Change processing error', {
            error: errorMsg,
            walEntries: changes.length
          }, MODULE_NAME);
        }
      }
    } catch (error) {
      replicationLogger.error('Poll and process error', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  private async processChangesForNotifications(changes: WALData[]): Promise<{
    tablesChanged: string[];
    organizationsNotified: string[];
    clientsNotified: number;
  }> {
    const tablesChanged = new Set<string>();
    const organizationsNotified = new Set<string>();
    let clientsNotified = 0;

    try {
      // Parse WAL changes to extract table names and organization IDs
      for (const change of changes) {
        try {
          const changeData = JSON.parse(change.data);
          const walChanges = changeData.change || [];

          for (const walChange of walChanges) {
            if (walChange.table) {
              const tableName = walChange.table;
              
              // Extract organization ID from table name (e.g., "org_01920000_1000_7000_8000_000000000001_project")
              const orgMatch = tableName.match(/^org_([0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12})_(.+)$/i);
              if (orgMatch) {
                const orgId = orgMatch[1].replace(/_/g, '-'); // Convert to UUID format
                const entityName = orgMatch[2]; // e.g., "project"
                
                tablesChanged.add(entityName);
                organizationsNotified.add(orgId);
                
                replicationLogger.debug('Extracted table change info', {
                  tableName,
                  orgId,
                  entityName,
                  lsn: change.lsn
                }, MODULE_NAME);
                
                // Send table change notification to connected clients for this org
                const notificationsSent = await this.sendTableChangeNotification(orgId, [entityName], change.lsn);
                clientsNotified += notificationsSent;
              }
            }
          }
        } catch (parseError) {
          replicationLogger.warn('Failed to parse WAL change', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            changeData: change.data.substring(0, 200)
          }, MODULE_NAME);
        }
      }

      return {
        tablesChanged: Array.from(tablesChanged),
        organizationsNotified: Array.from(organizationsNotified),
        clientsNotified
      };

    } catch (error) {
      replicationLogger.error('Error processing changes for notifications', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return {
        tablesChanged: [],
        organizationsNotified: [],
        clientsNotified: 0
      };
    }
  }

  private async sendTableChangeNotification(organizationId: string, tables: string[], lsn: string): Promise<number> {
    try {
      // Use the existing broadcast system - get active clients for org and notify them directly
      const { OrgAwareClientRegistryManager } = await import('../sync/org-aware-client-registry');
      
      const orgRegistry = new OrgAwareClientRegistryManager(this.env);
      const clientIds = await orgRegistry.getOrgActiveClients(organizationId);
      
      if (clientIds.length === 0) {
        replicationLogger.debug('No active clients for organization', {
          organizationId,
          tables
        }, MODULE_NAME);
        return 0;
      }

      // Create the notification message
      const message = {
        type: 'srv_table_change_notification',
        organizationId,
        tables,
        lsn,
        source: 'wal',
        timestamp: Date.now(),
        messageId: `table-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        clientId: 'server'
      };

      // Send to each client directly using existing pattern
      let successCount = 0;
      for (const clientId of clientIds) {
        try {
          replicationLogger.info('🚀 SENDING TABLE CHANGE NOTIFICATION TO CLIENT DO', {
            clientId,
            organizationId,
            tables,
            messageType: message.type,
            messageId: message.messageId
          }, MODULE_NAME);

          const clientDoId = this.env.SYNC.idFromName(`client:${clientId}`);
          const clientDo = this.env.SYNC.get(clientDoId);
          
          const response = await clientDo.fetch(
            `https://internal/table-change-notification?clientId=${encodeURIComponent(clientId)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(message)
            }
          );

          replicationLogger.info('📨 CLIENT DO FETCH RESPONSE', {
            clientId,
            responseStatus: response.status,
            responseOk: response.ok,
            responseStatusText: response.statusText
          }, MODULE_NAME);

          if (response.ok) {
            successCount++;
            replicationLogger.info('✅ TABLE CHANGE NOTIFICATION SENT SUCCESSFULLY', {
              clientId,
              organizationId,
              tables
            }, MODULE_NAME);
          } else {
            const responseText = await response.text().catch(() => 'Unable to read response');
            replicationLogger.warn('❌ TABLE CHANGE NOTIFICATION FAILED', {
              clientId,
              organizationId,
              responseStatus: response.status,
              responseText
            }, MODULE_NAME);
          }
        } catch (clientError) {
          replicationLogger.warn('Failed to notify client of table change', {
            clientId,
            organizationId,
            error: clientError instanceof Error ? clientError.message : String(clientError)
          }, MODULE_NAME);
        }
      }
      
      replicationLogger.debug('Table change notification sent', {
        organizationId,
        tables,
        totalClients: clientIds.length,
        successfulNotifications: successCount
      }, MODULE_NAME);

      return successCount;
    } catch (error) {
      replicationLogger.error('Error broadcasting table change notification', {
        organizationId,
        tables,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return 0;
    }
  }

  private async pollForChanges(): Promise<WALData[] | null> {
    let client;
    
    try {      
      replicationLogger.debug('Polling for changes', {
        slot: this.config.slot,
        batchSize: this.config.walBatchSize || DEFAULT_BATCH_SIZE
      }, MODULE_NAME);
      
      client = getDBClient(this.c);
      await client.connect();
      
      const batchSize = this.config.walBatchSize || DEFAULT_BATCH_SIZE;
      
      // Consume changes and advance LSN automatically - no need to track LSN state
      const query = `
        SELECT data, lsn, xid 
        FROM pg_logical_slot_get_changes(
          $1,
          NULL,
          NULL,
          'include-xids', '1',
          'include-timestamp', 'true'
        )
        LIMIT ${batchSize};
      `;
      
      const result = await client.query(query, [this.config.slot]);
      
      const newChanges = result.rows.map(row => ({
        data: row.data as string,
        lsn: row.lsn as string,
        xid: row.xid as string
      }));
      
      return newChanges.length > 0 ? newChanges : null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorName = err instanceof Error ? err.constructor.name : typeof err;
      
      const errorDetails = {
        error: errorMsg,
        errorType: errorName,
        slot: this.config.slot,
        currentLSN: await this.stateManager.getLSN().catch(() => 'unknown'),
        stack: errorStack,
        // Add raw error for debugging if it has additional properties
        rawError: err && typeof err === 'object' ? Object.getOwnPropertyNames(err).reduce((acc, key) => {
          try {
            acc[key] = (err as any)[key];
          } catch (e) {
            acc[key] = '[Unserializable]';
          }
          return acc;
        }, {} as any) : String(err)
      };
      
      if (errorMsg.includes('replication slot') && errorMsg.includes('is active for PID')) {
        replicationLogger.warn('Replication slot in use by another process during poll', errorDetails, MODULE_NAME);
        return null;
      } else if (errorMsg.includes('connect') || errorMsg.includes('timeout')) {
        replicationLogger.error('Database connection failed during polling', {
          ...errorDetails,
          possibleCauses: [
            'DATABASE_URL misconfigured',
            'Neon HTTP proxy not responding',
            'PostgreSQL database not running',
            'Network connectivity issues'
          ],
          databaseUrl: 'env' in this.c && this.c.env ? (this.c.env as any).DATABASE_URL || 'undefined' : 'context missing env'
        }, MODULE_NAME);
        throw err;
      } else if (errorMsg.includes('does not exist')) {
        replicationLogger.error('Replication slot does not exist', {
          ...errorDetails,
          suggestion: 'Try calling the /api/replication/init endpoint to create the slot'
        }, MODULE_NAME);
        throw err;
      } else {
        replicationLogger.error('Polling error', errorDetails, MODULE_NAME);
        throw err;
      }
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (closeError) {
          replicationLogger.error('Error closing database connection after polling', {
            error: closeError instanceof Error ? closeError.message : String(closeError),
            slot: this.config.slot
          }, MODULE_NAME);
        }
      }
    }
  }
} 