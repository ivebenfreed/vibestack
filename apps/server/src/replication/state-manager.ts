import type { DurableObjectState } from '../types/cloudflare';
import type { MinimalContext } from '../types/hono';
import { replicationLogger } from '../middleware/logger';
import { getDBClient } from '../lib/db';
import type { ReplicationConfig } from './types';
import { getDomainTables } from './types';
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
    let client;
    try {
      replicationLogger.debug('Creating database client for slot check', {
        slot: this.config.slot,
        publication: this.config.publication
      }, MODULE_NAME);
      
      client = getDBClient(c);
      
      replicationLogger.debug('Attempting to connect to database', {
        databaseUrl: 'env' in c && c.env ? (c.env as any).DATABASE_URL : 'no env'
      }, MODULE_NAME);
      
      console.log('[DEBUG] About to call client.connect()');
      try {
        await client.connect();
        console.log('[DEBUG] client.connect() succeeded');
      } catch (connectError) {
        console.error('[DEBUG] client.connect() failed:', connectError);
        console.error('[DEBUG] connectError type:', typeof connectError);
        console.error('[DEBUG] connectError constructor:', connectError?.constructor?.name);
        console.error('[DEBUG] connectError message:', (connectError as any)?.message);
        console.error('[DEBUG] connectError stack:', (connectError as any)?.stack);
        throw connectError;
      }
      
      try {
        // Get current WAL position
        const walResult = await client.query('SELECT pg_current_wal_lsn();');
        const currentWAL = walResult.rows[0].pg_current_wal_lsn;

        // Get slot status
        const slotResult = await client.query(`
          SELECT confirmed_flush_lsn 
          FROM pg_replication_slots 
          WHERE slot_name = $1;
        `, [this.config.slot]);

        let exists = slotResult.rows.length > 0;
        let slotLSN = exists ? slotResult.rows[0].confirmed_flush_lsn : undefined;
        
        // If slot doesn't exist, create it
        if (!exists) {
          replicationLogger.info('Creating replication slot and resources', {
            slot: this.config.slot,
            publication: this.config.publication
          }, MODULE_NAME);
          
          // Create slot with wal2json plugin
          await client.query(`
            SELECT pg_create_logical_replication_slot(
              $1,
              'wal2json',
              false
            );
          `, [this.config.slot]);

          // Create publication if it doesn't exist
          const pubResult = await client.query(`
            SELECT pubname 
            FROM pg_publication 
            WHERE pubname = $1;
          `, [this.config.publication]);

          if (pubResult.rows.length === 0) {
            const domainTables = getDomainTables().join(', ');
            await client.query(`
              CREATE PUBLICATION $1 FOR TABLE ${domainTables};
            `, [this.config.publication]);
          }

          replicationLogger.info('Created replication resources', {
            slot: this.config.slot,
            publication: this.config.publication,
            tableCount: getDomainTables().length
          }, MODULE_NAME);

          // Get the new slot status after creation
          const newSlotResult = await client.query(`
            SELECT confirmed_flush_lsn 
            FROM pg_replication_slots 
            WHERE slot_name = $1;
          `, [this.config.slot]);

          exists = newSlotResult.rows.length > 0;
          slotLSN = exists ? newSlotResult.rows[0].confirmed_flush_lsn : undefined;
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
      } finally {
        await client.end();
      }
    } catch (err) {
      // Aggressive error debugging - try multiple approaches
      let errorMessage = 'Unknown error';
      let errorStack = undefined;
      let errorName = 'unknown';
      let debugInfo = {};
      
      try {
        // Try different ways to extract error information
        errorMessage = err instanceof Error ? err.message : String(err);
        errorStack = err instanceof Error ? err.stack : undefined;
        errorName = err instanceof Error ? err.constructor.name : typeof err;
        
        // Try to extract all properties using multiple methods
        if (err && typeof err === 'object') {
          // Method 1: getOwnPropertyNames
          const ownProps = Object.getOwnPropertyNames(err);
          debugInfo = { ...debugInfo, ownPropertyNames: ownProps };
          
          // Method 2: for...in loop
          const forInProps: any = {};
          for (const key in err) {
            try {
              forInProps[key] = (err as any)[key];
            } catch (e) {
              forInProps[key] = '[Unserializable]';
            }
          }
          debugInfo = { ...debugInfo, forInProps };
          
          // Method 3: Try to stringify the error directly
          try {
            debugInfo = { ...debugInfo, jsonStringify: JSON.stringify(err) };
          } catch (e) {
            debugInfo = { ...debugInfo, jsonStringify: '[Not JSON serializable]' };
          }
          
          // Method 4: toString method
          try {
            debugInfo = { ...debugInfo, toString: err.toString() };
          } catch (e) {
            debugInfo = { ...debugInfo, toString: '[toString failed]' };
          }
          
          // Method 5: valueOf method
          try {
            debugInfo = { ...debugInfo, valueOf: (err as any).valueOf() };
          } catch (e) {
            debugInfo = { ...debugInfo, valueOf: '[valueOf failed]' };
          }
        }
      } catch (debugError) {
        debugInfo = { debugError: String(debugError) };
      }
      
      const errorDetails = {
        error: errorMessage,
        errorType: errorName,
        slot: this.config.slot,
        publication: this.config.publication,
        stack: errorStack,
        debugInfo,
        // Also include the original error reference info
        errorConstructor: err && err.constructor ? err.constructor.name : 'no constructor',
        errorPrototype: err && Object.getPrototypeOf(err) ? Object.getPrototypeOf(err).constructor.name : 'no prototype'
      };
      
      replicationLogger.error('Slot check failed', errorDetails, MODULE_NAME);
      
      // If it's a connection error, log additional context
      if (err instanceof Error) {
        if (err.message.includes('connect') || err.message.includes('timeout')) {
          replicationLogger.error('Database connection failed - check DATABASE_URL and proxy', {
            possibleCauses: [
              'DATABASE_URL environment variable not set correctly',
              'Neon HTTP proxy not running or misconfigured',
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
      const client = getDBClient(c);
      await client.connect();
      try {
        await client.query(`
          SELECT pg_drop_replication_slot($1);
        `, [this.config.slot]);

        replicationLogger.info('Slot dropped', {
          slot: this.config.slot
        }, MODULE_NAME);
      } finally {
        await client.end();
      }
    } catch (err) {
      replicationLogger.error('Slot drop failed', {
        error: err instanceof Error ? err.message : String(err),
        slot: this.config.slot
      }, MODULE_NAME);
      throw err;
    }
  }
} 