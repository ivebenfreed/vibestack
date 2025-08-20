/**
 * Message Handler Registry
 * 
 * Centralized message handler registration and management for SyncDO.
 * Extracts complex message handling logic from the main SyncDO class.
 */

import { IncomingChangeProcessor } from './incoming-changes/IncomingChangeProcessor';
import type { 
  ServerMessage, 
  ClientMessage,
  ClientChangesMessage,
  TableChange
} from '@repo/sync-types';
import type { MinimalContext } from '../types/hono';
import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';
import type { WebSocketHandler } from './types';
import { getDBClient } from '../lib/db';
import { getLatestChangeHistoryLSN } from '../lib/sync-common';

const MODULE_NAME = 'MessageHandlerRegistry';

export interface MessageHandlerContext {
  env: Env;
  clientId: string;
  getContext: () => MinimalContext;
  broadcastChangesToOtherSyncDOs: (changes: TableChange[], clientId: string) => Promise<void>;
  broadcastConflictResolution: (changes: TableChange[], originClientId: string) => Promise<void>;
  ensureReplicationActive: () => Promise<void>;
  notifyClientChangesComplete: (messageId: string) => Promise<void>;
  stateManager: any; // StateManager type
  // NOTE: Removed heartbeat-triggered sync methods - organization context is required
  analyzeLSNGap: (clientLSN: string, serverLSN: string) => { shouldTriggerCatchup: boolean; gapSize: number; threshold: number };
  state: DurableObjectState;
  // Unified client registry and organization context access
  unifiedClientRegistry: any; // UnifiedClientRegistry type
  getOrganizationContext: () => { organizationId: string } | null;
}

export class MessageHandlerRegistry {
  private context: MessageHandlerContext;
  private webSocketHandler: WebSocketHandler;
  private isHandlerRegistered: boolean = false;

  constructor(context: MessageHandlerContext, webSocketHandler: WebSocketHandler) {
    this.context = context;
    this.webSocketHandler = webSocketHandler;
  }

  /**
   * Register all message handlers
   */
  registerHandlers(): void {
    if (this.isHandlerRegistered) {
      syncLogger.debug('Message handlers already registered, skipping', {
        clientId: this.context.clientId,
      }, MODULE_NAME);
      return;
    }

    this.registerClientChangesHandler();
    this.registerCatchupReceivedHandler();
    this.registerHeartbeatHandler();
    this.registerIntegrityValidationHandler();
    this.registerBaselineIntegrityValidationHandler();

    this.isHandlerRegistered = true;
    syncLogger.debug('Message handlers registered', {
      clientId: this.context.clientId,
    }, MODULE_NAME);
  }

  /**
   * Register handler for client changes
   */
  private registerClientChangesHandler(): void {
    this.webSocketHandler.onMessage('clt_send_changes', async (message: ClientMessage) => {
      syncLogger.info('Received client changes', {
        type: message.type,
        messageId: message.messageId
      }, MODULE_NAME);
      
      try {
        // Ensure replication is active when clients send changes
        await this.context.ensureReplicationActive();
        
        // BROADCAST FIRST: Send changes to other SyncDOs before database write (primary path)
        const clientChangesMessage = message as ClientChangesMessage;
        if (clientChangesMessage.changes && clientChangesMessage.changes.length > 0) {
          await this.context.broadcastChangesToOtherSyncDOs(
            clientChangesMessage.changes, 
            clientChangesMessage.clientId
          );
        }
        
        // Get database connection
        const dbClient = getDBClient(this.context.getContext());
        
        try {
          // Connect to the database before processing
          await dbClient.connect();
          
          // Use the new IncomingChangeProcessor with conflict rebroadcast
          const processor = new IncomingChangeProcessor(
            dbClient, 
            this.webSocketHandler,
            this.context.env,
            undefined, // Use default config
            async (conflictedChanges: TableChange[], originClientId: string) => {
              // Rebroadcast conflicts with isConflictResolution flag
              await this.context.broadcastConflictResolution(conflictedChanges, originClientId);
            }
          );
          
          await processor.processIncomingChanges(message as ClientChangesMessage);
          
          // Small delay to ensure acknowledgments are fully processed by client
          // before we start sending any live updates
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Notify that processing is complete (only after all acknowledgments are sent)
          syncLogger.debug('Notifying client changes complete', {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
          await this.context.notifyClientChangesComplete(message.messageId);
          
        } finally {
          // Ensure we always close the connection
          try {
            await dbClient.end();
          } catch (err) {
            // Just silently close the connection - no need to log errors here
          }
        }
      } catch (error) {
        // Check if this is a WebSocket unavailability error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isWebSocketUnavailable = errorMessage.includes('WebSocketUnavailable') || 
                                     errorMessage.includes('No active WebSocket connections');
        
        if (isWebSocketUnavailable) {
          // Log with more specific error about client disconnection
          syncLogger.warn(`Client appears to be disconnected, cannot acknowledge changes: ${errorMessage}`, {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
        } else {
          // Log regular processing errors
          syncLogger.error('Error processing client changes', {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId,
            error: errorMessage
          }, MODULE_NAME);
        }
        
        // Make sure we still release the lock in case of error
        try {
          await this.context.notifyClientChangesComplete(message.messageId);
        } catch (notifyError) {
          // Just log, don't throw
          syncLogger.error(`Failed to notify client changes completion: ${
            notifyError instanceof Error ? notifyError.message : String(notifyError)
          }`, {
            clientId: (message as ClientChangesMessage).clientId,
            messageId: message.messageId
          }, MODULE_NAME);
        }
      }
    });
  }

  /**
   * Register handler for catchup acknowledgments
   */
  private registerCatchupReceivedHandler(): void {
    this.webSocketHandler.onMessage('clt_catchup_received', async (message: ClientMessage) => {
      // Cast to any to access the lsn property which is specific to this message type
      const catchupMessage = message as any;
      if (catchupMessage.lsn) {
        // Update the state manager with the LSN from each acknowledgment
        await this.context.stateManager.updateClientLSN(catchupMessage.clientId || this.context.clientId, catchupMessage.lsn);
        syncLogger.debug('Updated client LSN from catchup acknowledgment', {
          clientId: catchupMessage.clientId || this.context.clientId,
          lsn: catchupMessage.lsn
        }, MODULE_NAME);
      }
    });
  }

  /**
   * Register handler for client heartbeats
   */
  private registerHeartbeatHandler(): void {
    this.webSocketHandler.onMessage('clt_heartbeat', async (message: ClientMessage) => {
      const heartbeatMessage = message as any;
      
      syncLogger.debug('Received client heartbeat', {
        clientId: heartbeatMessage.clientId || this.context.clientId,
        lsn: heartbeatMessage.lsn,
        state: heartbeatMessage.state,
        active: heartbeatMessage.active
      }, MODULE_NAME);
      
      try {
        // Update client's active status and lastSeen in KV registry
        // Use clientId from message if SyncDO's clientId is empty (hibernation recovery)
        const clientId = heartbeatMessage.clientId || this.context.clientId;
        
        // If SyncDO's clientId is empty but message has one, restore it
        if (!this.context.clientId && heartbeatMessage.clientId) {
          // Note: This would need to be handled by the parent SyncDO class
          syncLogger.debug('Restored clientId from heartbeat message after hibernation', {
            clientId: heartbeatMessage.clientId
          }, MODULE_NAME);
          
          // Check if user context is available after hibernation
          const userContext = await this.context.stateManager.getUserContext();
          if (userContext) {
            syncLogger.debug('User context available after hibernation', {
              clientId: heartbeatMessage.clientId,
              userId: userContext.userId,
              userRole: userContext.userRole,
              userEmail: userContext.userEmail,
              userName: userContext.userName
            }, MODULE_NAME);
          } else {
            syncLogger.warn('No user context found after hibernation', {
              clientId: heartbeatMessage.clientId
            }, MODULE_NAME);
          }
        }
        
        if (clientId) {
          // Update unified client registry with organization context
          const orgContext = this.context.getOrganizationContext();
          
          if (orgContext) {
            try {
              // Update activity in unified registry (this refreshes TTL)
              await this.context.unifiedClientRegistry.updateClientActivity(
                clientId, 
                orgContext.organizationId,
                {
                  lsn: heartbeatMessage.lsn,
                  state: heartbeatMessage.state,
                  active: heartbeatMessage.active
                }
              );
              
              syncLogger.debug('Updated client activity in unified registry on heartbeat', {
                clientId,
                organizationId: orgContext.organizationId,
                active: heartbeatMessage.active,
                lastSeen: new Date().toISOString()
              }, MODULE_NAME);
              
            } catch (registryError) {
              syncLogger.error('Error updating unified client registry on heartbeat', {
                clientId,
                organizationId: orgContext.organizationId,
                error: registryError instanceof Error ? registryError.message : String(registryError)
              }, MODULE_NAME);
            }
          } else {
            syncLogger.warn('No organization context available for heartbeat - cannot update unified registry', {
              clientId
            }, MODULE_NAME);
          }
        }
        
        // Ensure replication is active
        await this.context.ensureReplicationActive();
        
        // Get current server LSN for comparison using existing function
        const context = this.context.getContext();
        const serverLSN = (await getLatestChangeHistoryLSN(context)) || '0/0';
        
        // Send heartbeat response with current server state
        await this.webSocketHandler.send({
          type: 'srv_heartbeat',
          clientId: heartbeatMessage.clientId || this.context.clientId,
          messageId: `hb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        } as any); // Type assertion since ServerHeartbeatMessage doesn't exist yet
        
        // Check for LSN gap and handle accordingly - organization-aware heartbeat
        if (heartbeatMessage.lsn && heartbeatMessage.lsn !== serverLSN) {
          // NOTE: Removed automatic initial sync triggering from heartbeat
          // Initial sync should only be triggered through proper organization-aware WebSocket connection
          if (heartbeatMessage.lsn === '0/0') {
            syncLogger.info('Client LSN is 0/0 in heartbeat - client needs initial sync but heartbeat will not trigger it', {
              clientId: heartbeatMessage.clientId || this.context.clientId,
              clientLSN: heartbeatMessage.lsn,
              serverLSN,
              note: 'Initial sync should be triggered through proper org-aware WebSocket connection'
            }, MODULE_NAME);
            // Do not trigger initial sync from heartbeat - organization context is required
          } else {
            // Normal LSN gap analysis for non-zero LSNs
            const lsnGapResult = this.context.analyzeLSNGap(heartbeatMessage.lsn, serverLSN);
            
            if (lsnGapResult.shouldTriggerCatchup) {
              syncLogger.info('Large LSN gap detected in heartbeat - organization-aware sync required', {
                clientId: heartbeatMessage.clientId || this.context.clientId,
                clientLSN: heartbeatMessage.lsn,
                serverLSN,
                gapSize: lsnGapResult.gapSize,
                threshold: lsnGapResult.threshold,
                note: 'Catchup sync should be triggered through proper org-aware WebSocket connection'
              }, MODULE_NAME);
              
              // NOTE: Removed automatic catchup sync triggering from heartbeat
              // Catchup sync should only be triggered through proper organization-aware sync flow
              // The client should reconnect through WebSocket with organization context
            } else {
              syncLogger.debug('Normal LSN gap in heartbeat - no action needed', {
                clientId: heartbeatMessage.clientId || this.context.clientId,
                clientLSN: heartbeatMessage.lsn,
                serverLSN,
                gapSize: lsnGapResult.gapSize,
                threshold: lsnGapResult.threshold
              }, MODULE_NAME);
            }
          }
        }
        
      } catch (error) {
        syncLogger.error('Error processing heartbeat', {
          clientId: heartbeatMessage.clientId || this.context.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Still try to send a basic heartbeat response even if LSN fetch fails
        try {
          await this.webSocketHandler.send({
            type: 'srv_heartbeat',
            clientId: heartbeatMessage.clientId || this.context.clientId,
            messageId: `hb_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
          } as any);
        } catch (sendError) {
          // If we can't even send a response, the connection might be broken
          syncLogger.error('Failed to send heartbeat response', {
            clientId: heartbeatMessage.clientId || this.context.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });
  }

  /**
   * Register handler for integrity validation requests
   */
  private registerIntegrityValidationHandler(): void {
    this.webSocketHandler.onMessage('clt_integrity_validation', async (message: ClientMessage) => {
      const validationMessage = message as any;
      
      syncLogger.info('Received integrity validation request', {
        clientId: validationMessage.clientId || this.context.clientId,
        currentLSN: validationMessage.currentLSN,
        tableCount: Object.keys(validationMessage.tableFingerprints || {}).length
      }, MODULE_NAME);
      
      try {
        // Import IntegrityManager for validation
        const { IntegrityManager } = await import('./integrity-manager');
        const context = this.context.getContext();
        const integrityManager = new IntegrityManager(context, this.webSocketHandler);
        
        // Perform validation with baseline validation support
        const result = await integrityManager.validateClientIntegrity({
          clientId: validationMessage.clientId || this.context.clientId,
          currentLSN: validationMessage.currentLSN,
          tableFingerprints: validationMessage.tableFingerprints,
          timestamp: validationMessage.timestamp,
          validationType: validationMessage.validationType,
          baselineTimestamp: validationMessage.baselineTimestamp,
          recordCount: validationMessage.recordCount
        });
        
        // Send response back to client
        await this.webSocketHandler.send({
          type: 'srv_integrity_validation_response',
          clientId: validationMessage.clientId || this.context.clientId,
          messageId: `integrity_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isValid: result.isValid,
          issues: result.issues,
          recommendedAction: result.recommendedAction,
          serverFingerprints: result.serverFingerprints,
          validationTimestamp: result.validationTimestamp
        } as any);
        
        syncLogger.info('Integrity validation completed and response sent', {
          clientId: validationMessage.clientId || this.context.clientId,
          isValid: result.isValid,
          issueCount: result.issues.length,
          recommendedAction: result.recommendedAction
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error('Error processing integrity validation', {
          clientId: validationMessage.clientId || this.context.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Send error response
        try {
          await this.webSocketHandler.send({
            type: 'srv_integrity_validation_response',
            clientId: validationMessage.clientId || this.context.clientId,
            messageId: `integrity_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            isValid: false,
            issues: [{
              type: 'data_corruption',
              table: 'unknown',
              severity: 'critical',
              description: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
              details: {}
            }],
            recommendedAction: 'none',
            serverFingerprints: {},
            validationTimestamp: Date.now()
          } as any);
        } catch (sendError) {
          syncLogger.error('Failed to send integrity validation error response', {
            clientId: validationMessage.clientId || this.context.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });
  }

  /**
   * Register handler for baseline integrity validation requests
   */
  private registerBaselineIntegrityValidationHandler(): void {
    this.webSocketHandler.onMessage('clt_integrity_baseline_validation', async (message: ClientMessage) => {
      const validationMessage = message as any;
      
      syncLogger.info('Received baseline integrity validation request', {
        clientId: validationMessage.clientId || this.context.clientId,
        baselineTimestamp: validationMessage.baselineTimestamp,
        recordCount: validationMessage.recordCount,
        tableCount: Object.keys(validationMessage.fingerprints || {}).length
      }, MODULE_NAME);
      
      try {
        // Import IntegrityManager for validation
        const { IntegrityManager } = await import('./integrity-manager');
        const context = this.context.getContext();
        const integrityManager = new IntegrityManager(context, this.webSocketHandler);
        
        // Perform baseline validation with the baseline validation support
        const result = await integrityManager.validateClientIntegrity({
          clientId: validationMessage.clientId || this.context.clientId,
          currentLSN: validationMessage.currentLSN,
          tableFingerprints: validationMessage.fingerprints,
          timestamp: validationMessage.timestamp,
          validationType: 'baseline_incremental', // Force baseline validation type
          baselineTimestamp: validationMessage.baselineTimestamp,
          recordCount: validationMessage.recordCount?.totalChanges || 0
        });
        
        // Send response back to client
        await this.webSocketHandler.send({
          type: 'srv_integrity_validation_response',
          clientId: validationMessage.clientId || this.context.clientId,
          messageId: `baseline_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          isValid: result.isValid,
          issues: result.issues,
          recommendedAction: result.recommendedAction,
          serverFingerprints: result.serverFingerprints,
          validationTimestamp: result.validationTimestamp
        } as any);
        
        syncLogger.info('Baseline integrity validation completed and response sent', {
          clientId: validationMessage.clientId || this.context.clientId,
          isValid: result.isValid,
          issueCount: result.issues.length,
          recommendedAction: result.recommendedAction
        }, MODULE_NAME);
        
      } catch (error) {
        syncLogger.error('Error processing baseline integrity validation', {
          clientId: validationMessage.clientId || this.context.clientId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
        
        // Send error response
        try {
          await this.webSocketHandler.send({
            type: 'srv_integrity_validation_response',
            clientId: validationMessage.clientId || this.context.clientId,
            messageId: `baseline_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            isValid: false,
            issues: [{
              type: 'data_corruption',
              table: 'unknown',
              severity: 'critical',
              description: `Baseline validation failed: ${error instanceof Error ? error.message : String(error)}`,
              details: {}
            }],
            recommendedAction: 'none',
            serverFingerprints: {},
            validationTimestamp: Date.now()
          } as any);
        } catch (sendError) {
          syncLogger.error('Failed to send baseline integrity validation error response', {
            clientId: validationMessage.clientId || this.context.clientId,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }, MODULE_NAME);
        }
      }
    });
  }
}