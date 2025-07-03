/**
 * MessageProcessor - Extracted message processing logic from sync-machine-v3.ts
 * 
 * Handles all WebSocket message routing and processing to reduce sync machine size.
 * Maintains clean separation between state machine orchestration and message handling.
 */

import { syncLogger } from './SyncLogger';
import type { SyncMachineV3Context } from '../../state-machines/machines/sync-machine-v3';

export interface MessageProcessorServices {
  webSocket: any;
  incoming: any;
  outgoing: any;
  integrity: any;
}

export class MessageProcessor {
  /**
   * Process incoming WebSocket message and route to appropriate services
   */
  static processWebSocketMessage(
    message: any,
    context: SyncMachineV3Context,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    if (!message) {
      console.log(`[MessageProcessor] ⚠️ Missing message`);
      return;
    }

    const messageType = message.type || 'unknown';
    
    // Only log non-heartbeat message types to reduce noise
    if (messageType !== 'srv_heartbeat') {
      console.log(`[MessageProcessor] 📨 Processing message type: ${messageType}`);
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[MessageProcessor] 🔍 Integrity validation response:`, {
          isValid: message.isValid,
          issues: message.issues?.length || 0,
          recommendedAction: message.recommendedAction,
          messageId: message.messageId
        });
      }
    } else {
      // Silent heartbeat processing with occasional milestone logging  
      const hasLSN = !!message?.serverLSN;
      const lsnInfo = hasLSN ? ` (LSN: ${message.serverLSN})` : '';
      
      // Only log heartbeats with LSN changes or every 1000th heartbeat to reduce noise
      if (hasLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 💓 Heartbeat LSN drift - Server: ${message.serverLSN}, Client: ${context.currentLSN}`);
      }
    }

    // Route incoming change messages to IncomingChangeService
    if (messageType === 'srv_init_changes' || 
        messageType === 'srv_catchup_changes' || 
        messageType === 'srv_live_changes') {
      this.handleChangeMessages(message, messageType, context, services, sendEvent);
      return;
    }

    // Route integrity validation responses
    if (messageType === 'srv_integrity_validation_response') {
      this.handleIntegrityResponse(message, services, sendEvent);
      return;
    }

    // Route server integrity reset commands
    if (messageType === 'srv_integrity_reset') {
      this.handleIntegrityReset(message, services, sendEvent);
      return;
    }

    // Route outgoing change acknowledgments
    if (messageType === 'srv_changes_received' || 
        messageType === 'srv_changes_applied' || 
        (messageType === 'srv_error' && message.context === 'outgoing_changes')) {
      this.handleOutgoingResponses(message, messageType, services, sendEvent);
      return;
    }

    // Handle sync phase transitions
    if (messageType === 'srv_init_start' || 
        messageType === 'srv_init_complete' || 
        messageType === 'srv_catchup_completed' || 
        messageType === 'srv_live_start' || 
        messageType === 'srv_sync_completed') {
      this.handlePhaseTransitions(message, messageType, context, services, sendEvent);
      return;
    }

    // Handle LSN updates
    if (messageType === 'srv_lsn_update' || 
        (messageType === 'srv_heartbeat' && message.serverLSN)) {
      this.handleLSNUpdates(message, messageType, context, sendEvent);
      return;
    }
  }

  /**
   * Handle incoming change messages
   */
  private static handleChangeMessages(
    message: any,
    messageType: string,
    context: SyncMachineV3Context,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    const changes = message.changes || [];
    if (changes.length === 0) return;

    console.log(`[MessageProcessor] 📥 Sending INCOMING_CHANGES event for ${changes.length} changes (${messageType})`);
    
    // Send INCOMING_CHANGES event to state machine for all change types
    sendEvent({ 
      type: 'INCOMING_CHANGES', 
      changes, 
      messageType,
      sequence: message.sequence,
      lastLSN: message.lastLSN // Pass through the LSN for acknowledgments
    });
    
    // Update LSN from lastLSN in change messages (for catchup and live changes)
    if ((messageType === 'srv_catchup_changes' || messageType === 'srv_live_changes')) {
      console.log(`[MessageProcessor] 🔍 LSN check for ${messageType}:`, {
        hasLastLSN: !!message.lastLSN,
        lastLSN: message.lastLSN,
        currentLSN: context.currentLSN,
        different: message.lastLSN !== context.currentLSN,
        messageKeys: Object.keys(message)
      });
      
      if (message.lastLSN && message.lastLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update from ${messageType}: ${context.currentLSN} → ${message.lastLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.lastLSN, source: messageType });
      } else if (!message.lastLSN) {
        console.warn(`[MessageProcessor] ⚠️ ${messageType} message missing lastLSN field!`);
      } else {
        console.log(`[MessageProcessor] ✅ LSN already current for ${messageType}: ${message.lastLSN}`);
      }
    }
    
    // CRITICAL: Send immediate chunk acknowledgment for catchup changes
    // Server expects individual chunk ACKs during catchup sync flow control
    if (messageType === 'srv_catchup_changes' && message.sequence) {
      const ackMessage = {
        type: 'clt_catchup_received',
        messageId: `catchup_chunk_ack_${Date.now()}`,
        timestamp: Date.now(),
        clientId: context.clientId,
        chunk: message.sequence.chunk,
        lsn: context.currentLSN
      };
      
      services.webSocket.send(ackMessage);
      console.log(`[MessageProcessor] 📤 Sent catchup chunk acknowledgment: chunk ${message.sequence.chunk}/${message.sequence.total}`);
    }
    
    // Other acknowledgments will be sent by the state machine after processing completes
  }


  /**
   * Handle integrity validation responses
   */
  private static handleIntegrityResponse(
    message: any,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    console.log(`[MessageProcessor] 🔍 Routing integrity validation response to IntegrityService`);
    
    try {
      services.integrity.handleValidationResponse(message).then((result: any) => {
        console.log(`[MessageProcessor] ✅ Integrity validation response processed:`, {
          isValid: result.isValid,
          issueCount: result.issues.length,
          recommendedAction: result.recommendedAction
        });
      }).catch((error: any) => {
        console.error(`[MessageProcessor] ❌ Error handling validation response:`, error);
        syncLogger.serviceError('IntegrityService', error as Error, 'validation response routing');
        sendEvent({ type: 'SERVICE_ERROR', service: 'integrity', error: error as Error });
      });
    } catch (error) {
      console.error(`[MessageProcessor] ❌ Error handling validation response:`, error);
      syncLogger.serviceError('IntegrityService', error as Error, 'validation response routing');
      sendEvent({ type: 'SERVICE_ERROR', service: 'integrity', error: error as Error });
    }
  }

  /**
   * Handle server integrity reset commands
   */
  private static handleIntegrityReset(
    message: any,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    console.log(`[MessageProcessor] 🚨 Received server-initiated integrity reset command`);
    
    try {
      services.integrity.handleServerResetCommand(message);
    } catch (error) {
      syncLogger.serviceError('IntegrityService', error as Error, 'server reset command routing');
    }
    
    sendEvent({ 
      type: 'INTEGRITY_RESET_REQUIRED', 
      reason: message.reason || 'Server-initiated reset'
    });
  }

  /**
   * Handle outgoing change server responses
   */
  private static handleOutgoingResponses(
    message: any,
    messageType: string,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    try {
      if (messageType === 'srv_changes_received') {
        syncLogger.info('message', 'Server acknowledged receipt of changes');
        services.outgoing.handleChangesReceived(message);
      } else if (messageType === 'srv_changes_applied') {
        syncLogger.info('message', 'Server confirmed changes were applied');
        services.outgoing.handleChangesApplied(message)
          .catch((error: any) => {
            syncLogger.serviceError('OutgoingChanges', error, 'changes applied');
            sendEvent({ type: 'SERVICE_ERROR', service: 'outgoing', error });
          });
      } else if (messageType === 'srv_error' && message.context === 'outgoing_changes') {
        syncLogger.warn('message', 'Server reported error for outgoing changes');
        services.outgoing.handleServerError(message);
      }
    } catch (error) {
      syncLogger.serviceError('OutgoingChanges', error as Error, messageType);
      sendEvent({ type: 'SERVICE_ERROR', service: 'outgoing', error: error as Error });
    }
  }

  /**
   * Handle sync phase transition messages
   */
  private static handlePhaseTransitions(
    message: any,
    messageType: string,
    context: SyncMachineV3Context,
    services: MessageProcessorServices,
    sendEvent: (event: any) => void
  ): void {
    if (messageType === 'srv_init_start') {
      console.log('[MessageProcessor] 🚀 Server started initial sync');
      
      // Update LSN from server at start of initial sync
      if (message.serverLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update at init start: ${context.currentLSN} → ${message.serverLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.serverLSN, source: 'init_start' });
      }
      
      // Send acknowledgment
      const ackMessage = {
        type: 'clt_init_received',
        messageId: `init_start_ack_${Date.now()}`,
        timestamp: Date.now(),
        clientId: context.clientId
      };
      services.webSocket.send(ackMessage);
      console.log(`[MessageProcessor] 📤 Sent acknowledgment: ${ackMessage.type}`);
      
      sendEvent({ type: 'START_INITIAL_SYNC' });
      
    } else if (messageType === 'srv_init_complete') {
      console.log('[MessageProcessor] ✅ Initial sync completed');
      
      // CRITICAL: Update LSN to server's LSN at end of initial sync
      if (message.serverLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 CRITICAL LSN update at init complete: ${context.currentLSN} → ${message.serverLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.serverLSN, source: 'init_complete' });
      } else if (message.serverLSN) {
        console.log(`[MessageProcessor] ✅ LSN already matches server LSN: ${message.serverLSN}`);
      } else {
        console.warn(`[MessageProcessor] ⚠️ srv_init_complete missing serverLSN field`);
      }
      
      // Send acknowledgment
      const ackMessage = {
        type: 'clt_init_processed',
        messageId: `init_complete_ack_${Date.now()}`,
        timestamp: Date.now(),
        clientId: context.clientId,
        serverLSN: message.serverLSN || context.currentLSN
      };
      services.webSocket.send(ackMessage);
      console.log(`[MessageProcessor] 📤 Sent acknowledgment: ${ackMessage.type}`);
      
      sendEvent({ type: 'INITIAL_SYNC_COMPLETE' });
      
    } else if (messageType === 'srv_catchup_completed') {
      console.log('[MessageProcessor] ✅ Catchup sync completed');
      
      // Update LSN from server at end of catchup sync
      if (message.serverLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update at catchup complete: ${context.currentLSN} → ${message.serverLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.serverLSN, source: 'catchup_complete' });
      }
      
      // Send acknowledgment
      const ackMessage = {
        type: 'clt_catchup_received',
        messageId: `catchup_complete_ack_${Date.now()}`,
        timestamp: Date.now(),
        clientId: context.clientId,
        serverLSN: message.serverLSN || context.currentLSN
      };
      services.webSocket.send(ackMessage);
      console.log(`[MessageProcessor] 📤 Sent acknowledgment: ${ackMessage.type}`);
      
      sendEvent({ type: 'CATCHUP_SYNC_COMPLETE' });
      
    } else if (messageType === 'srv_live_start') {
      console.log('[MessageProcessor] 🔄 Server confirmed live sync start');
      
      // Update LSN from server at start of live sync
      if (message.serverLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update at live start: ${context.currentLSN} → ${message.serverLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.serverLSN, source: 'live_start' });
      }
      
      sendEvent({ type: 'START_LIVE_SYNC' });
      
    } else if (messageType === 'srv_sync_completed') {
      console.log('[MessageProcessor] ✅ Server reported sync completed');
      
      // Update LSN if provided
      if (message.serverLSN && message.serverLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update from sync completion: ${context.currentLSN} → ${message.serverLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: message.serverLSN, source: 'sync_completion' });
      }
    }
  }

  /**
   * Handle LSN update messages
   */
  private static handleLSNUpdates(
    message: any,
    messageType: string,
    context: SyncMachineV3Context,
    sendEvent: (event: any) => void
  ): void {
    if (messageType === 'srv_lsn_update') {
      const newLSN = message.lsn;
      if (newLSN && newLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 📊 LSN update: ${context.currentLSN} → ${newLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: newLSN, source: 'server' });
      }
    } else if (messageType === 'srv_heartbeat' && message.serverLSN) {
      // Update LSN from heartbeat if provided and different
      const newLSN = message.serverLSN;
      if (newLSN && newLSN !== context.currentLSN) {
        console.log(`[MessageProcessor] 💓 LSN update from heartbeat: ${context.currentLSN} → ${newLSN}`);
        sendEvent({ type: 'LSN_UPDATE', lsn: newLSN, source: 'heartbeat' });
      }
      // Send heartbeat response if not already handled by WebSocketService
      sendEvent({ type: 'HEARTBEAT_RECEIVED' });
    } else if (messageType === 'srv_heartbeat') {
      // Silent heartbeat - no action needed for routine heartbeats without LSN
      sendEvent({ type: 'HEARTBEAT_RECEIVED' });
    }
  }

  /**
   * Create appropriate acknowledgment message for server message type
   */
  public static createAckMessage(messageType: string, message: any, context: SyncMachineV3Context): any {
    const baseAck = {
      messageId: `${messageType.replace('srv_', '')}_ack_${Date.now()}`,
      timestamp: Date.now(),
      clientId: context.clientId
    };

    switch (messageType) {
      case 'srv_init_changes':
        return {
          ...baseAck,
          type: 'clt_init_received',
          chunk: message.sequence?.chunk,
          table: message.sequence?.table,
          lsn: context.currentLSN
        };
        
      case 'srv_catchup_changes':
        return {
          ...baseAck,
          type: 'clt_catchup_received',
          chunk: message.sequence?.chunk,
          lsn: context.currentLSN
        };
        
      case 'srv_live_changes':
        return {
          ...baseAck,
          type: 'clt_changes_received',
          lsn: message.lastLSN || context.currentLSN, // Use the updated LSN from the message
          lastProcessedLSN: message.lastLSN
        };
        
      default:
        return null;
    }
  }
}