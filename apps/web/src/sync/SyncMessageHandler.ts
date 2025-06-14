/**
 * @deprecated This class is being phased out. Message handling logic will be integrated directly into sync-machine.
 */

import { SyncEventEmitter } from './SyncEventEmitter';
import { WebSocketConnector } from './WebSocketConnector'; // Or IMessageSender if preferred
import { IncomingChangeProcessor } from './IncomingChangeProcessor';
import { IntegrityManager } from './IntegrityManager';
import { LSNManager } from './LSNManager';
// Remove SyncState import from SyncManager, import SyncStatus from interfaces
import { ServerMessage, ClientMessage, ServerLiveStartMessage } from './SyncManager';
import { SyncStatus } from './interfaces';

// Temporary interface for initial state sync (compatibility)
interface ISyncInitialState {
  clientId: string;
  currentLsn: string;
  syncState: SyncStatus;
}

export class SyncMessageHandler {
  private events: SyncEventEmitter;
  private wsConnector: WebSocketConnector; // Use concrete class or IMessageSender
  private incomingProcessor: IncomingChangeProcessor;
  private integrityManager: IntegrityManager | null = null; // Optional dependency
  private lsnManager: LSNManager | null = null; // Centralized LSN management

  // Internal state needed for workflow management
  private currentSyncState: SyncStatus = 'disconnected'; // Ensure this uses the imported SyncStatus
  private clientId: string = '';

  constructor(
    eventEmitter: SyncEventEmitter,
    wsConnector: WebSocketConnector, // Inject dependencies
    incomingProcessor: IncomingChangeProcessor,
    _statePersister?: any, // DEPRECATED: No longer used, accessing orchestrator directly
    integrityManager?: IntegrityManager, // Optional parameter
    lsnManager?: LSNManager // Centralized LSN management
  ) {
    this.events = eventEmitter;
    this.wsConnector = wsConnector;
    this.incomingProcessor = incomingProcessor;
    // Note: statePersister parameter is ignored - using orchestrator state now
    this.integrityManager = integrityManager || null;
    this.lsnManager = lsnManager || null;

    // Listen for raw messages from the connector
    this.events.on('websocket:message', this.handleRawMessage.bind(this));
  }

  /**
   * Get orchestrator actor
   */
  private getOrchestrator() {
    const orchestrator = (window as any).orchestratorActor;
    if (!orchestrator) {
      throw new Error('Orchestrator actor not available');
    }
    return orchestrator;
  }

  private getOrchestratorSnapshot() {
    return this.getOrchestrator().getSnapshot();
  }

  // Called after initial state is loaded (compatibility method)
  public syncInitialState(initialState: ISyncInitialState): void {
      this.clientId = initialState.clientId;
      // LSN is now managed by LSNManager, so we sync it there if available
      if (this.lsnManager) {
        this.lsnManager.updateLSN(initialState.currentLsn, 'sync_initial_state');
      }
      this.currentSyncState = initialState.syncState; // Should be 'disconnected' initially
      console.log(`SyncMessageHandler: Initial state synced - ClientID: ${this.clientId}, LSN: ${initialState.currentLsn}`);
  }

  private handleRawMessage(rawData: string | Buffer | ArrayBuffer | Blob): void {
    try {
      let message: ServerMessage;

      if (typeof rawData === 'string') {
        message = JSON.parse(rawData);
      } else {
        console.warn("SyncMessageHandler: Received binary message data, decoding as UTF-8 string.");
        const decoder = new TextDecoder('utf-8');
        message = JSON.parse(decoder.decode(rawData as BufferSource)); // Assuming BufferSource
      }

      // Reduced logging - only log for debugging if needed
      // console.log(`[SyncMessageHandler] Received message: ${message.type}`);
      
      // Basic validation
      if (!message.type || !message.messageId) {
          console.error("[SyncMessageHandler] Invalid message received (missing type or messageId):", message);
          return;
      }

      this.processDecodedMessage(message);

    } catch (error) {
      console.error('[SyncMessageHandler] Error processing raw message:', error);
      console.error('[SyncMessageHandler] Raw data:', rawData);
    }
  }

  private processDecodedMessage(message: ServerMessage): void {
    // Reduced logging - only log for debugging if needed
    // console.log(`[SyncMessageHandler] processDecodedMessage ENTERED for type: "${message.type}" (ID: ${message.messageId}).`);
    
    // Logic from SyncManager.processMessage
    // Dispatch based on type
     switch (message.type) {
       case 'srv_state_change':
         this.handleStateChangeMessage(message);
         break;
       case 'srv_lsn_update':
         this.handleLSNUpdateMessage(message);
         break;
       case 'srv_send_changes': // Fallthrough
       case 'srv_live_changes':
       case 'srv_catchup_changes':
       case 'srv_init_changes':
         this.handleTableChangesMessage(message);
         break;
       case 'srv_init_start':
         this.handleInitStartMessage(message);
         break;
       case 'srv_init_complete':
         this.handleInitCompleteMessage(message);
         break;
       case 'srv_catchup_completed':
         this.handleCatchupCompletedMessage(message);
         break;
       case 'srv_live_start':
         this.handleLiveStartMessage(message);
         break;
       case 'srv_sync_stats':
         this.handleSyncStatsMessage(message);
         break;
       case 'srv_heartbeat':
         // Heartbeat responses are handled directly by WebSocketConnector
         // But we can also emit an event for other components that might need it
         this.events.emit('heartbeat:server_response', message);
         break;
       case 'srv_changes_received':
         this.events.emit('server_message:srv_changes_received', message);
         break;
       case 'srv_changes_applied':
         // Reduced logging - only log for debugging if needed
         // console.log(`[SyncMessageHandler] Matched CASE 'srv_changes_applied' for ID: ${message.messageId}`);
         this.events.emit('server_message:srv_changes_applied', message);
         // console.log(`[SyncMessageHandler] AFTER EMIT 'server_message:srv_changes_applied' for ID: ${message.messageId}`);
         break;
       case 'srv_error':
         this.events.emit('server_message:srv_error', message);
         break;
       case 'srv_integrity_validation_response':
         this.handleIntegrityValidationResponse(message);
         break;
       // Messages like srv_changes_received, srv_changes_applied, srv_error are now emitted
       // for OutgoingChangeProcessor to handle.
       default:
         // This will now only catch types not explicitly handled above or in other cases.
         console.warn(`[SyncMessageHandler] DEFAULT CASE: Received unhandled message type: "${message.type}" (ID: ${message.messageId})`);
     }
  }

  // --- Message Handlers (Adapted from SyncManager) ---

  private handleStateChangeMessage(message: ServerMessage): void {
    const state = message.state; // message.state is already SyncStatus | undefined
    if (state) {
        const previousState = this.currentSyncState;
        console.log(`[SyncMessageHandler] State transition: ${previousState} → ${state}`);
        
        // 🔥 ALWAYS update state and emit event, even if "same"
        // This ensures external listeners (like XState) get notified
        this.currentSyncState = state;
        this.events.emit('stateChange', state);
        
        // 🔥 FORCE emit sync:statusChanged for external coordination
        this.events.emit('sync:statusChanged', state);
        
        console.log(`[SyncMessageHandler] ✅ Emitted stateChange and sync:statusChanged events for: ${state}`);
        
        // Persist the state change to orchestrator
        try {
          this.getOrchestrator().send({ type: 'SYNC_STATE_UPDATE', syncState: state });
        } catch (error) {
          console.warn('Error saving state to orchestrator:', error);
        }
    }
  }

  private handleLSNUpdateMessage(message: ServerMessage): void {
    const lsn = message.lsn;
    if (lsn) {
        const currentLsn = this.lsnManager?.getCurrentLSN() || '0/0';
        if (currentLsn !== lsn) {
            console.log(`[SyncMessageHandler] LSN changing from ${currentLsn} to ${lsn}`);
            
            // Update LSN through centralized manager
            if (this.lsnManager) {
                this.lsnManager.updateLSN(lsn, 'server_lsn_update');
            } else {
                // Fallback to orchestrator LSN update
                try {
                  this.getOrchestrator().send({ type: 'LSN_UPDATE', lsn });
                } catch (error) {
                  console.warn('Error updating LSN in orchestrator:', error);
                }
            }
            
            // 🔥 CRITICAL: Update WebSocketConnector's LSN for heartbeats
            this.wsConnector.setConnectionParams(this.clientId, lsn);
            console.log(`[SyncMessageHandler] ✅ Updated WebSocketConnector LSN to ${lsn} for heartbeats`);
            
            this.events.emit('lsnUpdate', lsn); // Emit for UI/SyncManager orchestrator
        }
    }
  }

  private handleTableChangesMessage(message: ServerMessage): void {
    const changes = message.changes;
    if (changes && Array.isArray(changes)) {
      // Add detailed logging for debugging null/object conversion issues
      console.log('[SyncMessageHandler] Received table changes:', {
        messageType: message.type,
        changeCount: changes.length,
        changes: changes.map((change, index) => ({
          index,
          table: change.table,
          operation: change.operation,
          dataKeys: Object.keys(change.data || {}),
          estimatedDuration: {
            value: change.data?.estimatedDuration,
            type: typeof change.data?.estimatedDuration,
            isNull: change.data?.estimatedDuration === null,
            isUndefined: change.data?.estimatedDuration === undefined,
            stringified: JSON.stringify(change.data?.estimatedDuration)
          },
          timeRange: {
            value: change.data?.timeRange,
            type: typeof change.data?.timeRange,
            isNull: change.data?.timeRange === null,
            isUndefined: change.data?.timeRange === undefined,
            stringified: JSON.stringify(change.data?.timeRange)
          }
        }))
      });

      // 🔥 NEW: Emit granular sync events for app machine tracking
      const syncEventData = {
        messageType: message.type,
        changes: changes,
        sequence: message.sequence,
        progress: {
          changeCount: changes.length,
          timestamp: Date.now()
        }
      };
      
      // Emit generic sync message event for app machine
      this.events.emit('sync:message', syncEventData);
      
      // Update LSN first if provided (common in catchup/live)
      if (message.lastLSN) {
          const currentLsn = this.lsnManager?.getCurrentLSN() || '0/0';
          if (currentLsn !== message.lastLSN) {
              this.handleLSNUpdateMessage({ ...message, lsn: message.lastLSN }); // Reuse LSN update logic
          }
      }

      // Delegate processing to IncomingChangeProcessor
      this.incomingProcessor.processIncomingChanges(changes, message.type)
        .then(success => {
          if (success) {
            console.log(`[SyncMessageHandler] Incoming changes processed successfully for ${message.type}. Sending ACK.`);
            // Send appropriate acknowledgment
            this.sendMessageAcknowledgment(message);
          } else {
            console.warn(`[SyncMessageHandler] Incoming changes processing failed for ${message.type}.`);
          }
        })
        .catch(error => {
          console.error(`[SyncMessageHandler] Error processing incoming changes for ${message.type}:`, error);
        });
    } else {
      console.warn(`[SyncMessageHandler] Received ${message.type} message without valid changes array.`);
    }
  }

  private handleInitStartMessage(message: ServerMessage): void {
     console.log('[SyncMessageHandler] Initial sync starting', { serverLSN: message.serverLSN });
     // if (message.serverLSN && !message.serverLSN.includes('(resuming)')) {
     //     this.handleLSNUpdateMessage({ ...message, lsn: message.serverLSN });
     // }
     this.handleStateChangeMessage({ ...message, state: 'initial_sync' });
     this.sendInitStartReceivedAck(message.messageId);
  }

  private handleInitCompleteMessage(message: ServerMessage): void {
     console.log('[SyncMessageHandler] Initial sync complete', { serverLSN: message.serverLSN });
     if (message.serverLSN) {
         this.handleLSNUpdateMessage({ ...message, lsn: message.serverLSN });
     }
     this.sendInitProcessedAck(message.messageId);
     
     // Don't automatically transition to 'catchup' state!
     // The server will determine if catchup is needed and send either:
     // - srv_catchup_changes (if catchup needed) 
     // - srv_live_start (if client is up-to-date after initial sync)
     console.log('[SyncMessageHandler] Initial sync acknowledged, waiting for server to determine next phase...');
  }

  private async handleCatchupCompletedMessage(message: ServerMessage): Promise<void> {
     console.log('[SyncMessageHandler] Catchup sync complete', { lastLSN: message.lastLSN });
     if (message.lastLSN) {
         this.handleLSNUpdateMessage({ ...message, lsn: message.lastLSN });
     }
     
     this.handleStateChangeMessage({ ...message, state: 'live' });
     // Persist last sync time to orchestrator
     try {
       this.getOrchestrator().send({ type: 'SYNC_LAST_SYNC_TIME_UPDATE', lastSyncTime: new Date() });
     } catch (error) {
       console.warn('Error updating last sync time in orchestrator:', error);
     }
     
     // Trigger OutgoingChangeProcessor to send pending changes
     this.events.emit('process_all_outgoing_changes', { reason: 'catchup_complete' }); // New event for OutgoingProcessor
  }

  private handleLiveStartMessage(message: ServerMessage): void {
     const liveStartMsg = message as ServerLiveStartMessage;
     console.log('[SyncMessageHandler] Live sync starting', { finalLSN: liveStartMsg.finalLSN });
     if (liveStartMsg.finalLSN) {
         this.handleLSNUpdateMessage({ ...message, lsn: liveStartMsg.finalLSN });
     }
     
     // Only emit process_all_outgoing_changes if we're not already in live state
     // This prevents duplicate emissions when transitioning from catchup_complete -> live_start
     const wasAlreadyLive = this.currentSyncState === 'live';
     console.log(`[SyncMessageHandler] Current state before transition: ${this.currentSyncState}, wasAlreadyLive: ${wasAlreadyLive}`);
     
     this.handleStateChangeMessage({ ...message, state: 'live' });
     // Persist last sync time to orchestrator
     try {
       this.getOrchestrator().send({ type: 'SYNC_LAST_SYNC_TIME_UPDATE', lastSyncTime: new Date() });
     } catch (error) {
       console.warn('Error updating last sync time in orchestrator:', error);
     }
     
     // Only trigger OutgoingChangeProcessor if we weren't already in live state
     if (!wasAlreadyLive) {
       console.log('[SyncMessageHandler] Transitioning to live state, triggering outgoing change processing');
       this.events.emit('process_all_outgoing_changes', { reason: 'live_start' });
     } else {
       console.log('[SyncMessageHandler] Already in live state, skipping duplicate outgoing change processing');
     }
  }

  private handleSyncStatsMessage(message: ServerMessage): void {
    console.log('[SyncMessageHandler] Received sync stats', message);
    this.events.emit('sync_stats', message); // Forward for UI
  }

  private handleIntegrityValidationResponse(message: ServerMessage): void {
    console.log('[SyncMessageHandler] Received integrity validation response', message);
    // Forward to IntegrityManager via the event expected in IntegrityManager.ts
    this.events.emit('server_message:srv_integrity_validation_response', message);
  }

  // --- Acknowledgment Sending Methods (Adapted from SyncManager) ---

  private sendMessageAcknowledgment(message: ServerMessage): void {
    // Logic from SyncManager.sendMessageAcknowledgment
     const type = message.type;
     try {
       console.log(`[SyncMessageHandler] Preparing acknowledgment for ${type} (in reply to ${message.messageId})`);
       switch (type) {
         case 'srv_init_changes':
           this.sendInitChangesAcknowledgment(message);
           break;
         case 'srv_catchup_changes':
           this.sendCatchupAcknowledgment(message);
           break;
         case 'srv_live_changes':
           this.sendLiveChangesAcknowledgment(message);
           break;
         default:
           console.warn(`[SyncMessageHandler] No acknowledgment handler for message type: ${type}`);
       }
     } catch (error) {
       console.error(`[SyncMessageHandler] Error sending acknowledgment for ${type}:`, error);
     }
  }

  private sendInitChangesAcknowledgment(message: ServerMessage): void {
    // Logic from SyncManager.sendInitChangesAcknowledgment
     const sequence = message.sequence;
     const table = sequence?.table;
     const chunk = sequence?.chunk;
     if (!table || chunk === undefined) return;
     const ackMessage: ClientMessage = {
       type: 'clt_init_received', messageId: `init_ack_${table}_${chunk}_${Date.now()}`,
       timestamp: Date.now(), clientId: this.clientId, table: table, chunk: chunk,
       inReplyTo: message.messageId
     };
     this.wsConnector.send(ackMessage);
  }

  private sendCatchupAcknowledgment(message: ServerMessage): void {
    // Logic from SyncManager.sendCatchupAcknowledgment
     const sequence = message.sequence;
     const lastLSN = message.lastLSN || this.lsnManager?.getCurrentLSN() || '0/0';
     const chunk = sequence?.chunk || 1;
     const ackMessage: ClientMessage = {
       type: 'clt_catchup_received', messageId: `catchup_ack_${Date.now()}`,
       timestamp: Date.now(), clientId: this.clientId, chunk: chunk, lsn: lastLSN,
       inReplyTo: message.messageId
     };
     this.wsConnector.send(ackMessage);
  }

  private sendLiveChangesAcknowledgment(message: ServerMessage): void {
    // Logic from SyncManager.sendLiveChangesAcknowledgment
     const changes = message.changes as Array<any> || [];
     const lastLSN = message.lastLSN || this.lsnManager?.getCurrentLSN() || '0/0';
     const changeIds = changes.map(change => change.data?.id).filter(Boolean);
     const ackMessage: ClientMessage = {
       type: 'clt_changes_received', messageId: `live_ack_${Date.now()}`,
       timestamp: Date.now(), clientId: this.clientId, changeIds: changeIds, lastLSN: lastLSN,
       inReplyTo: message.messageId
     };
     this.wsConnector.send(ackMessage);
  }

  private sendInitStartReceivedAck(inReplyTo: string): void {
    // Logic from SyncManager.sendInitStartReceivedAck
     const ackMessage: ClientMessage = {
       type: 'clt_init_received', messageId: `init_start_ack_${Date.now()}`,
       timestamp: Date.now(), clientId: this.clientId, inReplyTo
     };
     this.wsConnector.send(ackMessage);
  }

  private sendInitProcessedAck(inReplyTo: string): void {
    // Logic from SyncManager.sendInitProcessedAck
     const ackMessage: ClientMessage = {
       type: 'clt_init_processed', messageId: `init_processed_${Date.now()}`,
       timestamp: Date.now(), clientId: this.clientId, inReplyTo
     };
     this.wsConnector.send(ackMessage);
  }

  // --- Public Accessors ---

  public getCurrentSyncPhase(): SyncStatus {
    // Returns the handler's internal understanding of the current phase
    return this.currentSyncState;
  }
}