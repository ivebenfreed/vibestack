import type { DurableObjectState } from '../types/cloudflare';
import type { MinimalContext } from '../types/hono';
import { replicationLogger } from '../middleware/logger';
import { withPostgresClient } from '../lib/database-manager';
import type { ReplicationConfig } from './types';
import { compareLSN } from '../lib/sync-common';

const MODULE_NAME = 'state-manager';

export class StateManager {
  private static readonly LSN_KEY = 'current_lsn';

  constructor(
    private readonly state: DurableObjectState,
    private readonly config: ReplicationConfig
  ) {}

  /**
   * Get current LSN from storage
   */
  public async getLSN(): Promise<string> {
    const lsn = await this.state.storage.get<string>(StateManager.LSN_KEY);
    return lsn || '0/0';
  }

  /**
   * Set current LSN in storage
   */
  public async setLSN(lsn: string): Promise<void> {
    if (!lsn) return;
    await this.state.storage.put(StateManager.LSN_KEY, lsn);
  }

  /**
   * Compare two LSNs
   * @returns -1 if lsn1 < lsn2, 0 if equal, 1 if lsn1 > lsn2
   * Delegates to the common compareLSN function for consistency
   */
  public compareLSN(lsn1: string, lsn2: string): number {
    return compareLSN(lsn1, lsn2);
  }

  /**
   * Check status of replication slot and create if needed
   */
  public async checkSlotStatus(c: MinimalContext): Promise<{ exists: boolean; lsn?: string }> {
    try {
      replicationLogger.debug('Checking replication slot status with safe connection', {
        slot: this.config.slot,
        publication: this.config.publication
      }, MODULE_NAME);
      
      return await withPostgresClient(async (client) => {
        // Get current WAL position
        const walResult = await client.unsafe('SELECT pg_current_wal_lsn()');
        const currentWAL = walResult[0].pg_current_wal_lsn;

        // Get slot status
        const slotResult = await client.unsafe(`
          SELECT confirmed_flush_lsn 
          FROM pg_replication_slots 
          WHERE slot_name = $1
        `, [this.config.slot]);

        let exists = slotResult.length > 0;
        let slotLSN = exists ? slotResult[0].confirmed_flush_lsn : undefined;
        
        // If slot doesn't exist, create it
        if (!exists) {
          replicationLogger.info('Creating replication slot and resources', {
            slot: this.config.slot,
            publication: this.config.publication
          }, MODULE_NAME);
          
          // Create slot with wal2json plugin
          await client.unsafe(`
            SELECT pg_create_logical_replication_slot(
              $1,
              'wal2json',
              false
            );
          `, [this.config.slot]);

          // Create publication if it doesn't exist
          const pubResult = await client.unsafe(`
            SELECT pubname 
            FROM pg_publication 
            WHERE pubname = $1;
          `, [this.config.publication]);

          if (pubResult.length === 0) {
            // Create publication for all tables (dynamic discovery)
            await client.unsafe(`
              CREATE PUBLICATION ${this.config.publication} FOR ALL TABLES;
            `);
          }

          replicationLogger.info('Created replication resources', {
            slot: this.config.slot,
            publication: this.config.publication,
            tableCount: 'all-tables'
          }, MODULE_NAME);

          // Get the new slot status after creation
          const newSlotResult = await client.unsafe(`
            SELECT confirmed_flush_lsn 
            FROM pg_replication_slots 
            WHERE slot_name = $1;
          `, [this.config.slot]);

          exists = newSlotResult.length > 0;
          slotLSN = exists ? newSlotResult[0].confirmed_flush_lsn : undefined;
        } else {
          // Log at debug level for routine status checks to reduce log noise
          replicationLogger.debug('Replication slot exists', {
            slot: this.config.slot,
            slotLSN,
            currentWAL
          }, MODULE_NAME);
        }

        // Log detailed status at debug level to reduce noise
        replicationLogger.debug('Slot status details', {
          slot: this.config.slot,
          exists,
          slotLSN,
          currentWAL
        }, MODULE_NAME);

        return { exists, lsn: slotLSN };
      });
    } catch (err) {
      const errorDetails = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        slot: this.config.slot,
        publication: this.config.publication,
        stack: err instanceof Error ? err.stack : undefined
      };
      
      replicationLogger.error('Slot check failed', errorDetails, MODULE_NAME);
      
      // If it's a connection error, log additional context
      if (err instanceof Error) {
        if (err.message.includes('connect') || err.message.includes('timeout')) {
          replicationLogger.error('Database connection failed - check DATABASE_URL and proxy', {
            possibleCauses: [
              'DATABASE_URL environment variable not set correctly',
              'PostgreSQL database not accessible',
              'Network connectivity issues'
            ],
            databaseUrl: 'env' in c && c.env ? (c.env as any).DATABASE_URL || 'undefined' : 'context missing env'
          }, MODULE_NAME);
        }
      }
      
      throw err;
    }
  }

  /**
   * Drop replication slot if it exists
   */
  public async dropSlot(c: MinimalContext): Promise<void> {
    try {
      await withPostgresClient(async (client) => {
        await client.unsafe(`
          SELECT pg_drop_replication_slot($1);
        `, [this.config.slot]);

        replicationLogger.info('Slot dropped', {
          slot: this.config.slot
        }, MODULE_NAME);
      });
    } catch (err) {
      replicationLogger.error('Slot drop failed', {
        error: err instanceof Error ? err.message : String(err),
        slot: this.config.slot
      }, MODULE_NAME);
      throw err;
    }
  }
} 