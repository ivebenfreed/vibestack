import { LocalChanges } from '@repo/dataforge/client-entities';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
/**
 * @deprecated This class is being replaced by OutgoingChangeService in the pure services architecture.
 * Use OutgoingChangeService instead for new implementations.
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { IMessageSender } from './interfaces';
import { ClientMessage } from './SyncManager';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import type {
  TableChange,
  ServerMessage as BaseServerMessage,
  ServerAppliedMessage,
  ServerReceivedMessage,
  SrvMessageType
} from '@repo/sync-types';

// Constants for batch processing
const BATCH_DELAY = 50; // ms
const MAX_CHANGES_PER_BATCH = 50;
const INITIAL_TIMEOUT = 30000; // 30 seconds - more reasonable for server processing
const MAX_TIMEOUT = 300000; // 5 minutes - maximum timeout
const TIMEOUT_MULTIPLIER = 2; // Exponential backoff multiplier
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of retries before giving up

// A more specific type for server error messages if not covered by sync-types
interface ServerErrorResponseMessage extends BaseServerMessage {
  type: 'srv_error';
  errorCode?: string | number;
  errorMessage?: string;
  originalMessageId?: string;
}

// Enhanced interface for tracking sent changes with retry logic
interface SentChangeInfo {
  timestamp: number;
  attempt: number;
  timeout: number;
}

export class OutgoingChangeProcessor {
  private localChangesRepo: Repository<LocalChanges>;
  private events: SyncEventEmitter;
  private messageSender: IMessageSender;
  private dataSource: NewPGliteDataSource;

  private changeQueue: Set<string> = new Set(); // Stores LocalChanges.id
  private isProcessing: boolean = false;
  private processTimer: NodeJS.Timeout | null = null;
  private sentChanges: Map<string, SentChangeInfo> = new Map(); // Enhanced tracking with retry info
  private pendingChangesCount: number = 0;

  private debouncedUpdatePendingChangesCountTimer: NodeJS.Timeout | null = null;
  private lastPendingChangesCountUpdateTime = 0;
  private readonly MIN_PENDING_CHANGES_UPDATE_INTERVAL = 3000;
  private readonly PENDING_CHANGES_UPDATE_DEBOUNCE_DELAY = 1000;
  
  // Add tracking for recent changes to detect duplicates
  private recentTracks = new Map<string, number>(); // key: `${table}:${entityId}:${operation}`, value: timestamp

  constructor(
    dataSource: NewPGliteDataSource,
    eventEmitter: SyncEventEmitter,
    messageSender: IMessageSender
  ) {
    this.events = eventEmitter;
    this.messageSender = messageSender;
    this.dataSource = dataSource;

    if (!this.dataSource.isInitialized) {
      throw new Error("DataSource not initialized when OutgoingChangeProcessor is constructed.");
    }
    
    this.localChangesRepo = this.dataSource.getRepository(LocalChanges);
    console.log('[OutgoingChangeProcessor] Using shared DataSource from PGliteProvider context');

    this.initializeEventListeners();
  }

  /**
   * Update the datasource reference (for HMR compatibility)
   */
  public updateDataSource(dataSource: NewPGliteDataSource): void {
    if (!dataSource.isInitialized) {
      throw new Error("Cannot update to uninitialized DataSource");
    }
    
    console.log('[OutgoingChangeProcessor] 🔥 HMR: Updating datasource reference');
    this.dataSource = dataSource;
    this.localChangesRepo = this.dataSource.getRepository(LocalChanges);
    console.log('[OutgoingChangeProcessor] 🔥 HMR: DataSource and repository references updated');
  }

  private initializeEventListeners(): void {
    // Assuming 'stateChange' from IMessageSender is now 'websocket:status' or similar
    // Or SyncManager translates 'websocket:status' to a 'connection:stateChanged' if needed by OCP
    this.events.on('websocket:status', (status: 'connected' | 'disconnected' | 'connecting' | 'error') => {
        // OCP might be interested in 'connected' to trigger processing
        if (status === 'connected') {
            this.handleConnectionStateChange('live'); // Assuming 'connected' means 'live' for OCP's purpose
        } else {
            // Handle other statuses if necessary, e.g. stop processing if 'disconnected'
            // For now, only 'live' state triggers processing.
        }
    });
    this.events.on('process_all_outgoing_changes', () => {
      console.log('[OutgoingChangeProcessor] Received process_all_outgoing_changes event.');
      
      // Quick check: if we already know there are no pending changes and no queued changes,
      // skip the expensive database query
      if (this.pendingChangesCount === 0 && this.changeQueue.size === 0) {
        console.log('[OutgoingChangeProcessor] No pending or queued changes, skipping database query.');
        return;
      }
      
      this.loadUnprocessedChanges().then(() => {
        this.scheduleProcessing();
      }).catch(error => {
        console.error('[OutgoingChangeProcessor] Error processing all changes event:', error);
      });
    });

    // Listen for server messages forwarded by SyncMessageHandler
    this.events.on('server_message:srv_changes_received', (message: BaseServerMessage) => {
      this.handleChangesReceived(message);
    });
    this.events.on('server_message:srv_changes_applied', (message: BaseServerMessage) => {
      this.handleChangesApplied(message).catch(error => {
        console.error('[OutgoingChangeProcessor] Error in handleChangesApplied after event:', error);
      });
    });
    this.events.on('server_message:srv_error', (message: BaseServerMessage) => {
      // Ensure the message is cast or validated if ServerErrorResponseMessage is more specific
      this.handleServerError(message as ServerErrorResponseMessage | BaseServerMessage);
    });
  }


  private handleConnectionStateChange(state: string): void {
    console.log(`[OutgoingChangeProcessor] Connection state changed to: ${state}`);
    if (state === 'live') {
      console.log('[OutgoingChangeProcessor] Connection state is live. Scheduling change processing.');
      setTimeout(() => {
        this.loadUnprocessedChanges().then(() => {
          this.scheduleProcessing();
        }).catch(error => {
          console.error('[OutgoingChangeProcessor] Error loading unprocessed changes on connection state live:', error);
        });
      }, 1000);
    }
  }

  /**
   * Get the current client ID from the message sender
   */
  private getClientId(): string {
    // Access client ID through the IMessageSender interface
    try {
      const clientId = this.messageSender.getClientId() || '';
      // Add debugging for client ID tracking
      if (!clientId) {
        console.error('[OutgoingChangeProcessor] getClientId() returning empty string - this will break anti-echo!');
      } else {
        console.debug(`[OutgoingChangeProcessor] getClientId() returning: "${clientId}"`);
      }
      return clientId;
    } catch (error) {
      console.warn('[OutgoingChangeProcessor] Failed to get client ID from message sender:', error);
      return '';
    }
  }

  public async trackChange(
    tableName: string, // Renamed from 'table' to avoid conflict with LocalChanges.table
    operationType: 'insert' | 'update' | 'delete', // Renamed from 'operation'
    dataPayload: Record<string, any>, // Renamed from 'data'
    originalData?: Record<string, any>,
    metadata?: {
      relationshipUpdates?: Array<{
        relationName: string;
        operation: 'set' | 'add' | 'remove';
        targetIds: string[];
      }>;
      entityRelations?: string[];
    }
  ): Promise<string> {
    const trackCallId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const entityId = dataPayload.id || (originalData ? originalData.id : null) || '';
    console.log(`[OutgoingChangeProcessor] 🔄 trackChange called: ${trackCallId} for ${tableName}:${entityId} operation:${operationType}`);
    
    // Check for rapid duplicate tracking attempts
    const trackKey = `${tableName}:${entityId}:${operationType}`;
    const now = Date.now();
    const lastTrackTime = this.recentTracks.get(trackKey);
    
    if (lastTrackTime && (now - lastTrackTime) < 1000) { // Within 1 second
      console.warn(`[OutgoingChangeProcessor] ⚠️ DUPLICATE TRACK DETECTED: ${trackCallId} - Same entity tracked ${now - lastTrackTime}ms ago!`);
      console.warn(`[OutgoingChangeProcessor] ⚠️ Track key: ${trackKey}`);
      console.trace(`[OutgoingChangeProcessor] ⚠️ Duplicate track call stack:`);
    }
    
    this.recentTracks.set(trackKey, now);
    
    // Clean up old entries (older than 10 seconds)
    for (const [key, timestamp] of this.recentTracks.entries()) {
      if (now - timestamp > 10000) {
        this.recentTracks.delete(key);
      }
    }
    
    try {
      if (!this.dataSource) {
        throw new Error('Database not initialized');
      }

      // Extract entity ID for tracking
      
      // Process different operation types with enhanced CRDT support
      let processedData = { ...dataPayload };
      let changedFieldsCount = 0;
      let changedFields: string[] = [];

      if (operationType === 'update') {
        // Enhanced update handling for better CRDT processing
        // Instead of just sending changed fields, we now send:
        // 1. Full entity state for proper upsert handling
        // 2. Change metadata for conflict resolution
        // 3. Both changed and unchanged fields for complete CRDT context
        
        if (originalData) {
          // Calculate changed fields for metadata
          const changedFieldsMap: Record<string, any> = {};
          const unchangedFields: Record<string, any> = {};
          let hasChanges = false;
          
          for (const [key, value] of Object.entries(dataPayload)) {
            if (JSON.stringify(value) !== JSON.stringify(originalData[key])) {
              changedFieldsMap[key] = value;
              hasChanges = true;
            } else {
              unchangedFields[key] = value;
            }
          }
          
          // Ensure entity ID is always included
          if (dataPayload.id && !changedFieldsMap.id) {
            changedFieldsMap.id = dataPayload.id;
          }
          
          // Preserve clientId if it exists
          if (dataPayload.clientId && !changedFieldsMap.clientId) {
            changedFieldsMap.clientId = dataPayload.clientId;
          }
          
          if (!hasChanges && dataPayload.id) {
            console.log(`[OutgoingChangeProcessor] Skipping tracking update for ${tableName}:${dataPayload.id} as no data changed.`);
            return dataPayload.id; // Return entity id
          }
          
          changedFieldsCount = Object.keys(changedFieldsMap).length;
          changedFields = Object.keys(changedFieldsMap).filter(k => k !== 'id' && k !== 'clientId');
          
          // Enhanced: Send FULL entity state with change metadata for better CRDT processing
          processedData = {
            ...dataPayload, // Full current entity state
            __changeMetadata: {
              changedFields: changedFields,
              originalUpdatedAt: originalData.updatedAt,
              changeTimestamp: new Date().toISOString(),
              hasPartialUpdate: changedFieldsCount < Object.keys(dataPayload).length
            }
          };
        }
        
        // Ensure entity ID is in the final data for update
        if (!processedData.id && dataPayload.id) {
          processedData.id = dataPayload.id;
        } else if (!processedData.id) {
          console.warn(`[OutgoingChangeProcessor] Update operation for table ${tableName} is missing an 'id' in the data. LocalChange ID will be generated.`);
        }
      } else if (operationType === 'insert' && !dataPayload.id) {
        console.warn(`[OutgoingChangeProcessor] Insert operation for table ${tableName} is missing an 'id' in dataPayload.`);
      }

      // Add clientId to the processed data for anti-echo functionality
      const clientId = this.getClientId();
      
      if (clientId) {
        processedData.clientId = clientId;
      } else {
        console.error(`[OutgoingChangeProcessor] ❌ NO CLIENT_ID AVAILABLE! Anti-echo will not work!`);
      }

      // Store the complete change data including metadata
      const changeDataToStore = {
        ...processedData,
        ...(metadata && {
          __metadata: metadata  // Store metadata in a special field
        })
      };

      const localChangeId = uuidv4(); // This is the ID for the LocalChanges record itself
      const now = new Date();
      const newChange = this.localChangesRepo.create({
        id: localChangeId, // Primary key for LocalChanges table
        table: tableName,
        operation: operationType,
        // data field in LocalChanges stores the actual data payload plus metadata
        data: changeDataToStore,
        lsn: '', // LSN must be a string; use empty if not applicable for client-originated changes
        // createdAt will be set by DB or TypeORM
        updatedAt: now, // Explicitly set updatedAt
        processedSync: 0, // 0 for false, 1 for true
        // source: 'client' // Add if 'source' column exists in LocalChanges entity
      });

      await this.localChangesRepo.save(newChange);
      this.changeQueue.add(localChangeId);
      
      // Consolidated logging - all essential information in one log
      console.log(`[OutgoingChangeProcessor] Tracked ${operationType} ${tableName}:${entityId} → ${localChangeId} | Fields: ${changedFieldsCount || Object.keys(dataPayload).length}${changedFields.length > 0 ? ` (changed: ${changedFields.join(',')})` : ''} | ClientId: ${clientId ? '✓' : '✗'} | Metadata: ${!!metadata || '__changeMetadata' in processedData ? '✓' : '✗'}`);
      
      this.scheduleProcessing();
      this.events.emit('local_change_tracked', { changeId: localChangeId, table: tableName, operation: operationType, entityId });
      this.pendingChangesCount++;
      this.triggerDebouncedUpdatePendingChangesCount();
      return localChangeId;
    } catch (error) {
      console.error('[OutgoingChangeProcessor] Error tracking change:', error);
      throw error;
    }
  }

  private triggerDebouncedUpdatePendingChangesCount(): void {
    const now = Date.now();
    if (this.debouncedUpdatePendingChangesCountTimer) {
      clearTimeout(this.debouncedUpdatePendingChangesCountTimer);
    }
    const timeSinceLastUpdate = now - this.lastPendingChangesCountUpdateTime;
    if (timeSinceLastUpdate >= this.MIN_PENDING_CHANGES_UPDATE_INTERVAL) {
      this.updatePendingChangesCount();
    } else {
      this.debouncedUpdatePendingChangesCountTimer = setTimeout(() => {
        this.updatePendingChangesCount();
      }, Math.max(0, this.PENDING_CHANGES_UPDATE_DEBOUNCE_DELAY, this.MIN_PENDING_CHANGES_UPDATE_INTERVAL - timeSinceLastUpdate));
    }
  }

  private updatePendingChangesCount(): void {
    this.lastPendingChangesCountUpdateTime = Date.now();
    if (this.debouncedUpdatePendingChangesCountTimer) {
      clearTimeout(this.debouncedUpdatePendingChangesCountTimer);
      this.debouncedUpdatePendingChangesCountTimer = null;
    }
    // Reduced logging - only log when count changes significantly or for debugging
    // console.log(`[OutgoingChangeProcessor] Pending changes count updated to: ${this.pendingChangesCount}`);
    this.events.emit('pending_outgoing_changes_count_updated', this.pendingChangesCount);
  }

  private scheduleProcessing(): void {
    if (this.processTimer !== null) return;
    if (this.isProcessing) return;
    if (this.changeQueue.size === 0 && this.pendingChangesCount === 0) {
      if (this.pendingChangesCount > 0) {
        this.loadUnprocessedChanges().then(() => {
          if (this.changeQueue.size > 0) this.scheduleProcessingActual();
        }).catch(err => console.error("Error loading unprocessed in scheduleProcessing:", err));
      }
      return;
    }
    this.scheduleProcessingActual();
  }

  private scheduleProcessingActual(): void {
    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      this.processChanges().catch(error => {
        console.error('[OutgoingChangeProcessor] Error during scheduled processChanges:', error);
      });
    }, BATCH_DELAY);
  }

  private async processChanges(): Promise<void> {
    if (this.isProcessing || this.changeQueue.size === 0) return;
    if (!this.dataSource) {
      console.error("[OutgoingChangeProcessor] Cannot process changes, DB not ready.");
      return;
    }
    // Revert to getStatus() as defined in the current interface (will update interface next)
    const senderStatus = this.messageSender.getStatus();
    // Assuming 'connected' is the status string indicating readiness to send
    if (!this.messageSender.isConnected() || senderStatus !== 'connected') {
      console.log(`[OutgoingChangeProcessor] Not processing: connection not ready. Status: ${senderStatus}, Connected: ${this.messageSender.isConnected()}`);
      return;
    }

    this.isProcessing = true;
    console.log(`[OutgoingChangeProcessor] Starting to process ${this.changeQueue.size} queued changes.`);

    let currentBatchLocalChangeIds: string[] = [];

    try {
      currentBatchLocalChangeIds = Array.from(this.changeQueue).slice(0, MAX_CHANGES_PER_BATCH);
      currentBatchLocalChangeIds.forEach(id => this.changeQueue.delete(id));

      const changesFromDb = await this.localChangesRepo.find({
        where: { id: In(currentBatchLocalChangeIds), processedSync: 0 }, // Use camelCase
        order: { createdAt: 'ASC' } // Use camelCase
      });

      if (changesFromDb.length === 0) {
        console.log('[OutgoingChangeProcessor] No unprocessed changes found in DB for the current batch IDs.');
        this.isProcessing = false;
        if (this.changeQueue.size > 0) this.scheduleProcessing();
        return;
      }

      const optimizedChanges = await this.optimizeOutgoingChanges(changesFromDb);
      console.log(`[OutgoingChangeProcessor] Optimized ${changesFromDb.length} changes to ${optimizedChanges.length}`);

      if (optimizedChanges.length === 0) {
        console.log('[OutgoingChangeProcessor] All changes were optimized out, nothing to send.');
        const optimizedOutIds = changesFromDb.map(c => c.id);
        await this.markLocalChangesAsProcessed(optimizedOutIds, true, 'optimized_out');
        this.isProcessing = false;
        if (this.changeQueue.size > 0) this.scheduleProcessing();
        return;
      }

      // Get current client ID for anti-echo
      const currentClientId = this.getClientId();

      console.log(`[OutgoingChangeProcessor] processChanges() - About to process ${optimizedChanges.length} changes with currentClientId: "${currentClientId}"`);

      // ClientId will be added by WebSocketConnector.send() for the message envelope
      const tableChangesPayload: TableChange[] = optimizedChanges.map((change, index) => {
        let rowData = change.data;
        if (typeof rowData === 'string') {
          try {
            rowData = JSON.parse(rowData);
          } catch (e) {
            console.error(`[OutgoingChangeProcessor] Failed to parse LocalChanges.data for change ${change.id}:`, e);
            rowData = {}; // default to empty object on parse error
          }
        }
        
        // Extract metadata if present, but preserve the TypeORM entity structure
        const { __metadata, __changeMetadata, ...entityData } = (rowData as Record<string, any>) || {};
        const metadata = __metadata;
        
        console.log(`[OutgoingChangeProcessor] Processing change ${index + 1}/${optimizedChanges.length}:`, {
          localChangeId: change.id,
          table: change.table,
          operation: change.operation,
          originalKeys: Object.keys(entityData),
          hasClientId: !!entityData?.clientId
        });
        
        const entityId = entityData?.id;
        if (!entityId && change.operation !== 'delete') {
            console.warn(`[OutgoingChangeProcessor] Entity ID missing in data for change ${change.id}, table ${change.table}, op ${change.operation}`);
        }

        // Preserve TypeORM entity structure - no conversions needed
        // The data should already be in camelCase with proper types from the client
        const finalData: Record<string, any> = {
          ...entityData,
          id: entityId,
        };
        
        // Ensure clientId is included for anti-echo functionality
        if (currentClientId && !finalData.clientId) {
          finalData.clientId = currentClientId;
          console.log(`[OutgoingChangeProcessor] ✅ Added clientId "${currentClientId}" to entity data`);
        }
        
        console.log(`[OutgoingChangeProcessor] Final entity data for ${change.table}:${entityId}:`, {
          dataType: typeof finalData,
          keys: Object.keys(finalData),
          hasClientId: !!finalData.clientId,
          hasUpdatedAt: !!finalData.updatedAt,
          updatedAtType: typeof finalData.updatedAt
        });
        
        // Construct TableChange with preserved TypeORM entity structure
        const tableChange: TableChange = {
          table: change.table,
          operation: change.operation as 'insert' | 'update' | 'delete',
          data: finalData, // Preserve TypeORM entity structure with proper types
          updatedAt: change.updatedAt.toISOString(), // TableChange.updatedAt is the sync timestamp
          clientId: finalData.clientId || currentClientId,
          ...(metadata?.relationshipUpdates && { relationshipUpdates: metadata.relationshipUpdates }),
          ...(metadata?.entityRelations && { entityRelations: metadata.entityRelations })
        };
        
        return tableChange;
      });

      console.log(`[OutgoingChangeProcessor] About to send ${tableChangesPayload.length} changes to server. Summary:`);
      tableChangesPayload.forEach((change, index) => {
        console.log(`  Change ${index + 1}: ${change.table} ${change.operation} entity=${change.data.id} dataClientId=${(change.data as any).clientId || 'MISSING'} tableChangeClientId=${change.clientId || 'MISSING'}`);
      });

      // Add detailed clientId debugging for anti-echo tracking
      console.log(`[OutgoingChangeProcessor] 🔍 CLIENT ID VERIFICATION:`);
      console.log(`  - Current client ID from messageSender: "${currentClientId}"`);
      console.log(`  - Expected server to filter these as echoes when they come back`);
      tableChangesPayload.forEach((change, index) => {
        const dataClientId = (change.data as any).clientId;
        const tableClientId = change.clientId;
        console.log(`  - Change ${index + 1}: data.clientId="${dataClientId}" table.clientId="${tableClientId}" (server checks data.clientId)`);
        
        if (dataClientId !== currentClientId) {
          console.error(`  ❌ Change ${index + 1}: data.clientId "${dataClientId}" doesn't match current "${currentClientId}" - ANTI-ECHO WILL FAIL!`);
        }
      });

      // Construct the message payload *without* common fields, as per IMessageSender
      // Client ID will be added by the layer calling the sender (e.g., SyncManager or WebSocketConnector)
      const messagePayloadToSend: Omit<ClientMessage, 'clientId' | 'messageId' | 'timestamp'> = {
          type: 'clt_send_changes',
          // clientId: clientId, // Removed: Not part of the payload sent via IMessageSender.send
          messageId: `changes_${Date.now()}_${uuidv4().substring(0, 6)}`, // Generate unique message ID
          timestamp: Date.now(),
          changes: tableChangesPayload
          // lsn: this.currentLsn, // Add LSN if applicable for outgoing changes
      };

      console.log(`[OutgoingChangeProcessor] Final message payload being sent:`, {
        type: messagePayloadToSend.type,
        messageId: messagePayloadToSend.messageId,
        changesCount: messagePayloadToSend.changes.length,
        currentClientId: currentClientId,
        changesWithDataClientId: messagePayloadToSend.changes.filter((c: TableChange) => (c.data as any).clientId).length,
        changesWithoutDataClientId: messagePayloadToSend.changes.filter((c: TableChange) => !(c.data as any).clientId).length,
        changesWithTableChangeClientId: messagePayloadToSend.changes.filter((c: TableChange) => c.clientId).length,
        changesWithoutTableChangeClientId: messagePayloadToSend.changes.filter((c: TableChange) => !c.clientId).length
      });

      // Call send, which returns void. Assume success if no error is thrown by the sender.
      this.messageSender.send(messagePayloadToSend);

      // Assume send was successful if no error was thrown. Track locally.
      const now = Date.now();
      optimizedChanges.forEach(optChange => {
        const existingInfo = this.sentChanges.get(optChange.id);
        const attempt = existingInfo ? existingInfo.attempt + 1 : 1;
        const timeout = existingInfo ? 
          Math.min(existingInfo.timeout * TIMEOUT_MULTIPLIER, MAX_TIMEOUT) : 
          INITIAL_TIMEOUT;
          
        this.sentChanges.set(optChange.id, { 
          timestamp: now, 
          attempt: attempt, 
          timeout: timeout 
        });
        
        console.log(`[OutgoingChangeProcessor] Tracking change ${optChange.id} (attempt ${attempt}, timeout ${timeout}ms)`);
      });

      // Emit event - messageId is not available here as it's added by the sender implementation.
      // The consumer (e.g., SyncManager) that adds the messageId might emit a more complete event.
      this.events.emit('outgoing_changes_payload_sent', { // Changed event name slightly
          changeIds: optimizedChanges.map(c => c.id),
          numChanges: optimizedChanges.length
      });
      console.log(`[OutgoingChangeProcessor] Sent payload for ${optimizedChanges.length} changes to message sender.`);

    } catch (error) {
      console.error('[OutgoingChangeProcessor] Error processing changes:', error);
      if (currentBatchLocalChangeIds.length > 0) {
        currentBatchLocalChangeIds.forEach(id => this.changeQueue.add(id));
      }
    } finally {
      this.isProcessing = false;
      if (this.changeQueue.size > 0) {
        this.scheduleProcessing();
      }
      this.checkSentChanges();
    }
  }

  private async optimizeOutgoingChanges(changes: LocalChanges[]): Promise<LocalChanges[]> {
    const entityChangeMap = new Map<string, LocalChanges[]>(); // key: table:entityId
    
    for (const change of changes) {
        const entityId = (change.data as Record<string, any>)?.id;
        if (!entityId) {
            console.warn(`[OutgoingChangeProcessor] Change ${change.id} missing entity_id in data during optimization.`);
            // Decide how to handle: skip, or include as is if it's a delete without full data
            if (change.operation === 'delete' && change.data && Object.keys(change.data).length === 1 && (change.data as Record<string,any>).id) {
                // If it's a delete and data only contains id, it's probably fine.
            } else {
                 // finalChanges.push(change); // Or push as is if cannot determine entityId
                 continue;
            }
        }
        const key = `${change.table}:${entityId}`;
        if (!entityChangeMap.has(key)) {
            entityChangeMap.set(key, []);
        }
        entityChangeMap.get(key)!.push(change);
    }

    const finalChanges: LocalChanges[] = [];
    const processedDueToOptimization: string[] = [];

    for (const [_, entityChanges] of entityChangeMap.entries()) {
        entityChanges.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        let currentChangeData: Record<string, any> | null = null;
        let firstOpType = entityChanges[0].operation;
        const firstLocalChangeId = entityChanges[0].id; // ID of the LocalChanges record
        const entityIdForOp = (entityChanges[0].data as Record<string, any>)?.id;
        
        // Extract clientId from the first change to ensure it's preserved
        const clientId = (entityChanges[0].data as Record<string, any>)?.clientId;

        if (firstOpType === 'insert') {
            currentChangeData = { ...(entityChanges[0].data as Record<string, any>) };
        }

        for (let i = 0; i < entityChanges.length; i++) {
            const currentLocalChange = entityChanges[i];
            if (currentLocalChange.id !== firstLocalChangeId) processedDueToOptimization.push(currentLocalChange.id);

            if (currentLocalChange.operation === 'insert') {
                currentChangeData = { ...(currentLocalChange.data as Record<string, any>) };
                firstOpType = 'insert';
            } else if (currentLocalChange.operation === 'update') {
                if (firstOpType === 'insert') {
                    currentChangeData = { ...currentChangeData, ...(currentLocalChange.data as Record<string, any>) };
                } else {
                    if (currentChangeData === null) currentChangeData = {}; // Should have original data
                    currentChangeData = { ...currentChangeData, ...(currentLocalChange.data as Record<string, any>) };
                    if (firstOpType !== 'insert') firstOpType = 'update';
                }
            } else if (currentLocalChange.operation === 'delete') {
                if (firstOpType === 'insert') {
                    currentChangeData = null; // No-op
                    if (!processedDueToOptimization.includes(firstLocalChangeId)) processedDueToOptimization.push(firstLocalChangeId);
                    break;
                } else {
                    // For delete, preserve both entity ID and clientId
                    currentChangeData = { 
                        id: entityIdForOp,
                        clientId: clientId || (currentLocalChange.data as Record<string, any>)?.clientId
                    };
                    firstOpType = 'delete';
                    for(let j=0; j < i; j++) {
                        if (!processedDueToOptimization.includes(entityChanges[j].id)) {
                            processedDueToOptimization.push(entityChanges[j].id);
                        }
                    }
                    break; 
                }
            }
        }

        if (currentChangeData) {
            // Ensure clientId is always present in the final optimized data
            if (clientId && !currentChangeData.clientId) {
                currentChangeData.clientId = clientId;
                console.log(`[OutgoingChangeProcessor] ✅ Preserved clientId "${clientId}" during optimization for ${firstOpType} operation`);
            }
            
            const representativeChange = { ...entityChanges[0] }; // Base LocalChanges record
            representativeChange.id = firstLocalChangeId; // Use the ID of the first LocalChanges record
            representativeChange.operation = firstOpType as 'insert' | 'update' | 'delete';
            representativeChange.data = currentChangeData; // The merged/final data
            representativeChange.updatedAt = entityChanges[entityChanges.length -1].updatedAt;
            finalChanges.push(representativeChange);
        }
    }
    
    if (processedDueToOptimization.length > 0) {
        console.log(`[OutgoingChangeProcessor] ${processedDueToOptimization.length} changes were optimized out or merged.`);
        await this.markLocalChangesAsProcessed(processedDueToOptimization, true, 'optimized_merged');
    }
    return finalChanges;
  }

  private checkSentChanges(): void {
    const now = Date.now();
    const toRetry: string[] = [];
    const permanentlyFailed: string[] = [];
    
    this.sentChanges.forEach((info, localChangeId) => {
      if (now - info.timestamp > info.timeout) {
        if (info.attempt >= MAX_RETRY_ATTEMPTS) {
          // Permanently failed after max attempts
          console.error(`[OutgoingChangeProcessor] Change ${localChangeId} permanently failed after ${info.attempt} attempts. Marking as failed.`);
          this.sentChanges.delete(localChangeId);
          permanentlyFailed.push(localChangeId);
        } else {
          // Retry with exponential backoff
          const nextAttempt = info.attempt + 1;
          const nextTimeout = Math.min(info.timeout * TIMEOUT_MULTIPLIER, MAX_TIMEOUT);
          
          console.warn(`[OutgoingChangeProcessor] Change ${localChangeId} timed out (attempt ${info.attempt}). Retrying with ${nextTimeout}ms timeout.`);
          
          this.sentChanges.delete(localChangeId);
          toRetry.push(localChangeId);
          
          // Will be re-tracked when processChanges() runs again with updated attempt/timeout
        }
      }
    });
    
    // Re-queue changes for retry
    if (toRetry.length > 0) {
      toRetry.forEach(id => this.changeQueue.add(id));
      this.scheduleProcessing();
    }
    
    // Mark permanently failed changes as processed with error
    if (permanentlyFailed.length > 0) {
      this.markLocalChangesAsProcessed(permanentlyFailed, false, `timeout_after_${MAX_RETRY_ATTEMPTS}_attempts`)
        .catch(error => {
          console.error('[OutgoingChangeProcessor] Error marking permanently failed changes:', error);
        });
    }
  }

  // Use specific message types from sync-types
  public handleChangesReceived(message: BaseServerMessage): void {
    if (message.type !== 'srv_changes_received') return;
    const receivedMessage = message as ServerReceivedMessage; // Narrow type
    // Reduced logging - uncomment below for debugging if needed
    // console.log(`[OutgoingChangeProcessor] Server acknowledged receipt of changes. Original Msg ID (from server): ${ (receivedMessage as any).originalMessageId || 'N/A'}. ChangeIDs from server: ${receivedMessage.changeIds?.join(', ')}`);
    // The `changeIds` in `ServerReceivedMessage` are the `LocalChanges.id`s that the server received.
    // This is a direct ACK for those specific changes.
    // However, the prompt's original SyncChangeManager used originalMessageId.
    // If server sends `originalMessageId` corresponding to `ClientMessage.messageId`, mapping is needed.
    // For now, assume `message.changeIds` are the `LocalChanges.id`s.
  }

  public async handleChangesApplied(message: BaseServerMessage): Promise<void> {
    if (message.type !== 'srv_changes_applied') return;
    const appliedMessage = message as ServerAppliedMessage; // Narrow type

    const appliedLocalChangeIds = appliedMessage.appliedChanges || []; // These are LocalChanges.id
    // The ServerAppliedMessage in sync-types doesn't have failedChangeIds directly.
    // It has a single `success: boolean` and `error?: string` for the whole batch.

    // Reduced logging - uncomment below for debugging if needed
    // console.log(`[OutgoingChangeProcessor] Server applied changes. Success: ${appliedMessage.success}. Applied: ${appliedLocalChangeIds.length}. Error: ${appliedMessage.error || 'None'}`);

    const successfullyAppliedLocalChangeIds: string[] = [];
    const permanentlyFailedLocalChangeIds: string[] = [];

    if (appliedMessage.success) {
        appliedLocalChangeIds.forEach((localId: string) => { // Explicitly type localId
            successfullyAppliedLocalChangeIds.push(localId);
            this.sentChanges.delete(localId);
        });
    } else {
        // If the whole batch failed, all `appliedChangeIds` (which are the ones attempted) are considered failed.
        appliedLocalChangeIds.forEach((localId: string) => { // Explicitly type localId
            console.error(`[OutgoingChangeProcessor] Server failed to apply change ${localId} (part of failed batch): ${appliedMessage.error}`);
            this.sentChanges.delete(localId);
            permanentlyFailedLocalChangeIds.push(localId);
            this.events.emit('outgoing_change_failed_on_server', { id: localId, error: appliedMessage.error });
        });
    }
    
    if (successfullyAppliedLocalChangeIds.length > 0) {
        await this.markLocalChangesAsProcessed(successfullyAppliedLocalChangeIds, true, 'applied_by_server');
    }
    if (permanentlyFailedLocalChangeIds.length > 0) {
        await this.markLocalChangesAsProcessed(permanentlyFailedLocalChangeIds, true, `server_rejection: ${appliedMessage.error || 'Unknown error'}`);
    }
  }
  
private async markChangesAsProcessed(entityIds: string[], success: boolean): Promise<void> {
    const dataSource = this.dataSource;
    if (!dataSource) {
      console.error("[OutgoingChangeProcessor]: Cannot mark changes as processed, DataSource not available.");
      return;
    }
    if (entityIds.length === 0) return;

    console.log(`[OutgoingChangeProcessor] Attempting to mark LocalChanges as processed based on ${entityIds.length} received entity IDs (success: ${success})`);

    // This logic needs significant revision. It currently tries to find LocalChanges
    // based on entity IDs within the `data` column, which is inefficient and potentially incorrect.
    // The correct approach depends on whether the server ACKs outgoing changes using
    // the LocalChanges.id or the entity's ID (e.g., Comment.id).
    // Assuming for now this method is primarily for INCOMING changes,
    // and outgoing ACKs are handled differently (e.g., in handleChangesApplied).

    let successfullyMarkedCount = 0;
    try {
      await dataSource.manager.transaction(async transactionalEntityManager => {
        const localChangesRepo = transactionalEntityManager.getRepository(LocalChanges);
        
        for (const entityId of entityIds) {
          const changesToUpdate = await localChangesRepo.createQueryBuilder("lc")
            .where(`lc.data ->> 'id' = :entityId`, { entityId })
            .andWhere("lc.processedSync = 0")
            .getMany();

          if (changesToUpdate.length > 0) {
            for (const changeToUpdate of changesToUpdate) {
              changeToUpdate.processedSync = success ? 1 : 0;
              await localChangesRepo.save(changeToUpdate);
              successfullyMarkedCount++;
            }
          } else {
            console.warn(`[OutgoingChangeProcessor]: No unprocessed LocalChanges found for entity ID ${entityId} to mark as processed.`);
          }
        }
      });

      // After successful transaction, update the pending count
      const currentLocalChangesRepo = this.localChangesRepo;
      this.pendingChangesCount = await currentLocalChangesRepo.count({ where: { processedSync: 0 } });

      entityIds.forEach(id => {
        // Example: this.sentChanges.delete(id); // If entityIds are LocalChanges IDs and this method should interact with sentChanges
      });

      this.triggerDebouncedUpdatePendingChangesCount();
      console.log(`[OutgoingChangeProcessor] Attempted to mark ${successfullyMarkedCount} LocalChanges records as processed based on ${entityIds.length} entity IDs. Final pending count: ${this.pendingChangesCount}`);

    } catch (error) {
      console.error('[OutgoingChangeProcessor]: Error marking changes as processed:', error);
      // Handle error, potentially retry or log for manual intervention
    }
  }
  private async markLocalChangesAsProcessed(entityIdsFromServer: string[], success: boolean, reason: string): Promise<void> {
    if (entityIdsFromServer.length === 0) return;
    if (!this.dataSource) {
        console.error("[OutgoingChangeProcessor] Cannot mark changes, DB not ready.");
        return;
    }
    try {
        const statusToSet = success ? 1 : 0;
        let updatedCount = 0;
        const successfullyProcessedLocalChangeIds: string[] = [];

        for (const entityId of entityIdsFromServer) {
            // Use createQueryBuilder to correctly query against the JSONB field
            const changesToUpdate = await this.localChangesRepo.createQueryBuilder("LocalChanges")
                .where(`("LocalChanges"."data" ->> 'id') = :entityId`, { entityId })
                .andWhere('LocalChanges.processedSync = :processedSyncStatus', { processedSyncStatus: 0 })
                .getMany();

            if (changesToUpdate.length > 0) {
                // Reduced logging - uncomment below for debugging if needed
                // console.log(`[OutgoingChangeProcessor] Found ${changesToUpdate.length} LocalChanges record(s) for entity ID ${entityId} to mark as processedSync=${statusToSet}`);
                for (const change of changesToUpdate) {
                    change.processedSync = statusToSet;
                    await this.localChangesRepo.save(change); // Save each updated entity
                    successfullyProcessedLocalChangeIds.push(change.id); // Store the actual LocalChanges.id
                    updatedCount++;
                }
            } else {
                // Only warn if it seems unexpected - reduce noise for normal operations
                if (reason !== 'applied_by_server') {
                    console.warn(`[OutgoingChangeProcessor] No unprocessed LocalChanges found for entity ID ${entityId} to mark as processedSync=${statusToSet}. This might be okay if changes were optimized out or already processed by another means.`);
                }
            }
        }

        // Reduced logging - only log summary
        if (updatedCount > 0) {
            console.log(`[OutgoingChangeProcessor] Marked ${updatedCount} LocalChanges as processed due to: ${reason}`);
            
            // 🐛 FIX: Clean up sentChanges Map to prevent timeout loops for processed changes
            for (const localChangeId of successfullyProcessedLocalChangeIds) {
                if (this.sentChanges.has(localChangeId)) {
                    this.sentChanges.delete(localChangeId);
                    console.debug(`[OutgoingChangeProcessor] 🧹 Cleaned up sentChanges tracking for processed change ${localChangeId}`);
                }
            }
        }
        
        if (updatedCount > 0) {
            // Recalculate pendingChangesCount more accurately after updates
            this.pendingChangesCount = await this.localChangesRepo.count({ where: { processedSync: 0 } });
            this.triggerDebouncedUpdatePendingChangesCount();
            this.events.emit('outgoing_changes_processed_locally', {
                changeIds: successfullyProcessedLocalChangeIds, // Emit the actual LocalChanges.id that were processed
                success,
                reason,
                newPendingCount: this.pendingChangesCount
            });
        }
    } catch (error) {
        console.error(`[OutgoingChangeProcessor] Error marking LocalChanges as processed (reason: ${reason}):`, error);
    }
  }

  public handleServerError(message: ServerErrorResponseMessage | BaseServerMessage): void {
    if (message.type !== 'srv_error') return;
    // message is now ServerErrorResponseMessage (or your defined specific error type)
    const { errorCode, errorMessage, originalMessageId } = message as ServerErrorResponseMessage;
    console.error(`[OutgoingChangeProcessor] Received server error: ${errorCode} - ${errorMessage}. Original Msg ID: ${originalMessageId}`);
  }

  private async loadUnprocessedChanges(): Promise<void> {
    if (!this.dataSource) {
      console.warn('[OutgoingChangeProcessor] Cannot load unprocessed changes, DB not ready.');
      return;
    }
    try {
      console.log('[OutgoingChangeProcessor] Loading unprocessed changes from DB...');
      const unprocessed = await this.localChangesRepo.find({
        where: { processedSync: 0 }, // Use camelCase
        order: { createdAt: 'ASC' }, // Use camelCase
        take: MAX_CHANGES_PER_BATCH * 5
      });

      let newChangesAddedToQueue = 0;
      unprocessed.forEach(change => {
        if (!this.changeQueue.has(change.id) && !this.sentChanges.has(change.id)) {
          this.changeQueue.add(change.id);
          newChangesAddedToQueue++;
        }
      });
      
      const totalUnprocessedCount = await this.localChangesRepo.count({ where: { processedSync: 0 }}); // Use camelCase
      this.pendingChangesCount = totalUnprocessedCount;
      this.triggerDebouncedUpdatePendingChangesCount();

      if (newChangesAddedToQueue > 0) {
        console.log(`[OutgoingChangeProcessor] Loaded ${newChangesAddedToQueue} unprocessed changes into the queue. Total pending in DB: ${totalUnprocessedCount}. Queue size: ${this.changeQueue.size}`);
        this.scheduleProcessing();
      } else if (unprocessed.length > 0) {
        console.log(`[OutgoingChangeProcessor] Found ${unprocessed.length} unprocessed changes in DB, but they are already in queue or sent map. Total pending in DB: ${totalUnprocessedCount}.`);
      } else {
        console.log('[OutgoingChangeProcessor] No unprocessed changes found in DB.');
      }
    } catch (error) {
      console.error('[OutgoingChangeProcessor] Error loading unprocessed changes:', error);
      setTimeout(() => this.loadUnprocessedChanges(), 5000);
    }
  }

  public async processQueuedChanges(): Promise<void> {
    console.log('[OutgoingChangeProcessor] processQueuedChanges called externally.');
    if (this.isProcessing) {
      console.log('[OutgoingChangeProcessor] Already processing, request to process queued changes ignored.');
      return;
    }
    if (this.changeQueue.size > 0) {
      this.scheduleProcessing();
    } else {
      await this.loadUnprocessedChanges();
      if (this.changeQueue.size > 0) {
        this.scheduleProcessing();
      } else {
        console.log('[OutgoingChangeProcessor] No changes in queue or DB to process.');
      }
    }
  }
  
  public getQueueSize(): number {
    // Return the count reflecting all pending changes, not just those currently in the Set
    return this.pendingChangesCount;
  }

  public getPendingChangesCount(): number {
    return this.pendingChangesCount;
  }

  public async getPendingChanges(): Promise<LocalChanges[]> {
    if (!this.dataSource) {
        console.error("[OutgoingChangeProcessor] Cannot get pending changes, DB not ready.");
        return [];
    }
    return this.localChangesRepo.find({
        where: { processedSync: 0 }, // Use camelCase
        order: { createdAt: 'ASC' } // Use camelCase
    });
  }

  public async clearUnprocessedChanges(): Promise<void> {
    if (!this.dataSource) {
        console.error("[OutgoingChangeProcessor] Cannot clear unprocessed changes, DB not ready.");
        return;
    }
    try {
        const deleteResult = await this.localChangesRepo.delete({ processedSync: 0 }); // Use camelCase
        console.log(`[OutgoingChangeProcessor] Cleared ${deleteResult.affected || 0} unprocessed local changes.`);
        this.changeQueue.clear();
        this.sentChanges.clear();
        this.pendingChangesCount = 0;
        this.triggerDebouncedUpdatePendingChangesCount();
        this.events.emit('all_unprocessed_outgoing_changes_cleared');
    } catch (error) {
        console.error('[OutgoingChangeProcessor] Error clearing unprocessed changes:', error);
    }
  }


/**
   * Handles an LSN reset event.
   * Clears internal queues and state related to outgoing changes,
   * as they are no longer valid with the old LSN.
   */
  public async handleLSNReset(): Promise<void> {
    console.warn("[OutgoingChangeProcessor] Handling LSN reset. Clearing outgoing change queues.");
    
    // Stop any ongoing processing
    this.isProcessing = false;
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }

    // Clear internal state
    this.changeQueue.clear();
    this.sentChanges.clear();
    
    // Reset pending count and notify
    if (this.pendingChangesCount > 0) {
        this.pendingChangesCount = 0;
        this.triggerDebouncedUpdatePendingChangesCount(); // Ensure UI/persister gets updated
    }

    // Note: This does NOT clear the LocalChanges table in the database.
    // Depending on the sync strategy, those entries might need to be marked
    // as processed/obsolete separately or handled during the next sync cycle.
    // For now, we just clear the in-memory processing state.
    console.log("[OutgoingChangeProcessor] Outgoing change queues cleared due to LSN reset.");
  }

  // Removed duplicate handleLSNReset method definition
} // Added missing closing brace for the class