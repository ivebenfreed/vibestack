/**
 * Sync Machine V2 - Pure Services Architecture
 * 
 * Phase 3: Enhanced sync machine using pure services
 * 
 * This machine coordinates:
 * - WebSocketService for connections
 * - IncomingChangeService for processing server changes
 * - OutgoingChangeService for sending local changes
 * - LSNService for LSN utilities
 * 
 * No circular dependencies, no global event emitters, pure XState coordination
 */

import { setup, assign, fromPromise, sendParent, log } from 'xstate';
import { WebSocketService, WebSocketServiceConfig } from '../../sync/WebSocketService';
import { IncomingChangeService, IncomingChangeServiceConfig } from '../../sync/IncomingChangeService';
import { OutgoingChangeService, OutgoingChangeServiceConfig } from '../../sync/OutgoingChangeService';
import { IntegrityService, IntegrityServiceConfig } from '../../sync/IntegrityService';
import { LSNService } from '../../sync/LSNService';
import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';

// Service registry outside of XState context to prevent serialization issues
const serviceRegistry = new Map<string, {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
}>();

// Global persistent services - survive sync machine recreation
let globalServices: {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
} | null = null;

// Function to destroy global services (called on app shutdown)
export const destroyGlobalSyncServices = () => {
  console.log('[SyncMachineV2] Destroying global services...');
  if (globalServices) {
    globalServices.webSocketService?.destroy();
    globalServices.incomingChangeService?.destroy();
    globalServices.outgoingChangeService?.destroy();
    globalServices = null;
  }
  serviceRegistry.clear();
  console.log('[SyncMachineV2] Global services destroyed');
};

export interface SyncMachineContext {
  // Service registry key instead of direct service instances
  serviceRegistryKey: string | null;
  
  // Connection info
  serverUrl: string | null;
  clientId: string | null;
  currentLSN: string;
  serverLSN: string | null;
  
  // Sync progress
  syncPhase: 'initial' | 'catchup' | 'live' | null;
  
  // Error handling
  error: string | null;
  lastError: any;
  reconnectAttempts: number;
  integrityRetryAttempts: number;
  
  // Stats (minimal - services handle their own detailed metrics)
  lastSyncTime: number | null;
  messagesProcessed: number;
  
  // Granular phase tracking
  phaseProgress: {
    initial: {
      completedTables: number;
      totalTables: number;
      currentTable: string | null;
      tablesRemaining: string[];
    };
    catchup: {
      batchesProcessed: number;
      changesProcessed: number;
      estimatedRemaining: number;
    };
    live: {
      messagesProcessed: number;
      lastActivity: number | null;
      throughputPerSec: number;
    };
  };
}

// Helper functions to access services
const getServices = (context: SyncMachineContext) => {
  if (!context.serviceRegistryKey) return null;
  return serviceRegistry.get(context.serviceRegistryKey) || null;
};

const setServices = (context: SyncMachineContext, services: {
  webSocketService: WebSocketService | null;
  incomingChangeService: IncomingChangeService | null;
  outgoingChangeService: OutgoingChangeService | null;
  integrityService: IntegrityService | null;
}) => {
  const key = context.serviceRegistryKey || crypto.randomUUID();
  serviceRegistry.set(key, services);
  return key;
};

export type SyncMachineEvent =
  // Lifecycle
  | { type: 'CONNECT'; serverUrl: string; clientId: string; currentLSN: string }
  | { type: 'DISCONNECT' }
  | { type: 'RECONNECT' }
  | { type: 'RESET' }
  
  // Phase transition events (internal)
  | { type: 'START_INITIAL_SYNC' }
  | { type: 'START_CATCHUP_SYNC' }
  | { type: 'START_LIVE_SYNC' }
  
  // WebSocket events (from service callbacks)
  | { type: 'WS_CONNECTED'; serverLSN: string }
  | { type: 'WS_DISCONNECTED'; reason: string }
  | { type: 'WS_ERROR'; error: Error }
  | { type: 'WS_MESSAGE'; message: any }
  | { type: 'WS_CONNECTION_RECOVERY'; wasOffline: boolean; durationMs: number }
  
  // Sync phase events (handled by state transitions)
  | { type: 'INITIAL_SYNC_COMPLETE' }
  | { type: 'CATCHUP_SYNC_COMPLETE' }
  
  // Change processing events
  | { type: 'INCOMING_CHANGES'; changes: any[]; messageType: string; sequence?: any }
  | { type: 'INCOMING_CHANGES_PROCESSED'; results: any[] }
  | { type: 'INCOMING_CHANGES_ERROR'; error: Error; changes: any[] }
  | { type: 'OUTGOING_CHANGES_QUEUED'; count: number }
  | { type: 'OUTGOING_CHANGES_SENT'; count: number; messageId: string }
  | { type: 'OUTGOING_CHANGES_ACKNOWLEDGED'; changeIds: string[] }
  
  // LSN events
  | { type: 'LSN_UPDATE'; lsn: string; source: string }
  | { type: 'LSN_SYNC_REQUIRED'; clientLSN: string; serverLSN: string }
  
  // Integrity events
  | { type: 'INTEGRITY_VALIDATE'; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_SUCCESS'; result: any }
  | { type: 'INTEGRITY_VALIDATION_ERROR'; error: Error; reason?: string }
  | { type: 'INTEGRITY_RESET_REQUIRED'; reason: string }
  | { type: 'INTEGRITY_RESET_START'; reason: string; resetType?: 'full_reset' | 'table_reset' }
  | { type: 'INTEGRITY_RESET_COMPLETE'; result: any }
  | { type: 'INTEGRITY_RESET_ERROR'; error: Error }
  | { type: 'RESET_INTEGRITY_BASELINE' }
  
  // Error events
  | { type: 'SERVICE_ERROR'; service: string; error: Error; context?: string }
  | { type: 'RETRY' }
  | { type: 'MAX_RETRIES_REACHED' }
  
  // XState invoke completion events (required for proper typing)
  | { type: 'done.invoke.initializeServices'; output: { webSocketService: WebSocketService; incomingChangeService: IncomingChangeService; outgoingChangeService: OutgoingChangeService; integrityService: IntegrityService } }
  | { type: 'done.invoke.connectWebSocket'; output: { serverLSN: string } }
  | { type: 'done.invoke.processIncomingChanges'; output: { results: any[]; successCount: number; errorCount: number } }
  | { type: 'done.invoke.detectAndSendChanges'; output: { changesSent: number } }
  | { type: 'error.platform.initializeServices'; error: Error }
  | { type: 'error.platform.connectWebSocket'; error: Error }
  | { type: 'error.platform.processIncomingChanges'; error: Error }
  | { type: 'error.platform.detectAndSendChanges'; error: Error }
  // XState v5 actor completion events
  | { type: 'xstate.done.actor.initializeServices'; output: { webSocketService: WebSocketService; incomingChangeService: IncomingChangeService; outgoingChangeService: OutgoingChangeService; integrityService: IntegrityService } }
  | { type: 'xstate.done.actor.connectWebSocket'; output: { serverLSN: string } }
  | { type: 'xstate.done.actor.processIncomingChanges'; output: { results: any[]; successCount: number; errorCount: number } }
  | { type: 'xstate.done.actor.detectAndSendChanges'; output: { changesSent: number } }
  | { type: 'xstate.error.actor.initializeServices'; error: Error }
  | { type: 'xstate.error.actor.connectWebSocket'; error: Error }
  | { type: 'xstate.error.actor.processIncomingChanges'; error: Error }
  | { type: 'xstate.error.actor.detectAndSendChanges'; error: Error };

export const syncMachineV2 = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent,
  },
  
  actors: {
    initializeServices: fromPromise(async ({ input }: {
      input: { serverUrl: string; clientId: string; currentLSN: string } 
    }): Promise<{
      webSocketService: WebSocketService;
      incomingChangeService: IncomingChangeService;
      outgoingChangeService: OutgoingChangeService;
      integrityService: IntegrityService;
    }> => {
      console.log('[SyncMachineV2] 🔧 Initializing services...');
      
      // Check if we can reuse existing global services
      if (globalServices && 
          globalServices.webSocketService && 
          globalServices.incomingChangeService && 
          globalServices.outgoingChangeService &&
          globalServices.integrityService) {
        console.log('[SyncMachineV2] ♻️ Reusing existing global services');
        
        // Update WebSocket service configuration if needed
        globalServices.webSocketService.updateConnectionParams(input.clientId, input.currentLSN);
        
        return {
          webSocketService: globalServices.webSocketService,
          incomingChangeService: globalServices.incomingChangeService,
          outgoingChangeService: globalServices.outgoingChangeService,
          integrityService: globalServices.integrityService
        };
      }
      
      console.log('[SyncMachineV2] 🆕 Creating new services...');
      
      // Get dataSource (should be ready since orchestrator only invokes us after database init)
      const { getNewPGliteDataSource } = await import('../../db/newtypeorm/NewDataSource');
      const dataSource = await getNewPGliteDataSource();
      if (!dataSource || !dataSource.isInitialized) {
        throw new Error('DataSource not available - orchestrator should only invoke sync after database is ready');
      }
      
      // Create service configurations
      const wsConfig: WebSocketServiceConfig = {
        serverUrl: input.serverUrl,
        clientId: input.clientId,
        lsn: input.currentLSN,
        enableHeartbeat: true,
        heartbeatInterval: 30000,
        reconnectDelay: 1000,
        maxReconnectAttempts: 5
      };
      
      const incomingConfig: IncomingChangeServiceConfig = {
        clientId: input.clientId,
        enableOptimisticUpdates: true,
        batchSize: 50,
        conflictResolution: 'timestamp' as const
      };
      
      const outgoingConfig: OutgoingChangeServiceConfig = {
        clientId: input.clientId,
        enableBatching: true,
        batchSize: 50,
        batchTimeoutMs: 1000
      };
      
      const webSocketService = new WebSocketService(wsConfig);
      const incomingChangeService = new IncomingChangeService(incomingConfig, dataSource);
      const outgoingChangeService = new OutgoingChangeService(outgoingConfig, dataSource);
      
      // Create integrity service configuration
      const integrityConfig: IntegrityServiceConfig = {
        clientId: input.clientId,
        enableServerValidation: true, // Re-enabled with adapter
        validationTimeoutMs: 30000,
        autoResetOnFailure: false
      };
      
      const integrityService = new IntegrityService(integrityConfig, dataSource);
      
      // Store as global services for reuse
      globalServices = {
        webSocketService,
        incomingChangeService,
        outgoingChangeService,
        integrityService
      };
      
      console.log('[SyncMachineV2] Services initialized successfully');
      
      return {
        webSocketService,
        incomingChangeService,
        outgoingChangeService,
        integrityService
      };
    }),
    
    connectWebSocket: fromPromise(async ({ input }: {
      input: { context: SyncMachineContext; serverUrl: string }
    }): Promise<{ serverLSN: string }> => {
      console.log('[SyncMachineV2] Connecting to WebSocket...');
      
      const services = getServices(input.context);
      if (!services?.webSocketService) {
        throw new Error('WebSocketService not available');
      }
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        services.webSocketService!.setCallbacks({
          onStatusChange: (status: any) => {
            console.log('[SyncMachineV2] WebSocket status:', status);
            if (status === 'connected') {
              clearTimeout(timeoutId);
              resolve({ serverLSN: '0/0' }); // Placeholder
            } else if (status === 'error') {
              clearTimeout(timeoutId);
              reject(new Error('WebSocket connection failed'));
            }
          },
          onError: (error: any) => {
            clearTimeout(timeoutId);
            reject(error);
          }
        });
        
        services.webSocketService!.connect(input.serverUrl);
      });
    }),
    

    
    detectAndSendChanges: fromPromise(async ({ input }: {
      input: { 
        outgoingChangeService: OutgoingChangeService;
        webSocketService: WebSocketService;
      }
    }): Promise<{ changesSent: number }> => {
      console.log('[SyncMachineV2] Detecting and sending outgoing changes...');
      
      // Set the message sender for the outgoing service
      input.outgoingChangeService.setMessageSender({
        send: (message) => input.webSocketService.send(message)
      });
      
      const changesQueued = await input.outgoingChangeService.detectAndQueueChanges();
      
      if (changesQueued > 0) {
        await input.outgoingChangeService.sendQueuedChanges();
      }
      
      console.log(`[SyncMachineV2] Sent ${changesQueued} changes`);
      
      return { changesSent: changesQueued };
    }),

    // Integrity validation actor
    validateIntegrity: fromPromise(async ({ input }: {
      input: { integrityService: IntegrityService; reason: string }
    }) => {
      console.log('[SyncMachineV2] Running integrity validation...');
      const result = await input.integrityService.validateIntegrity(input.reason);
      return result;
    }),

    // Integrity reset actor
    executeIntegrityReset: fromPromise(async ({ input }: {
      input: { integrityService: IntegrityService; reason: string; resetType: 'full_reset' | 'table_reset' }
    }) => {
      console.log('[SyncMachineV2] Executing integrity reset...');
      const result = await input.integrityService.executeReset(input.reason, input.resetType);
      return result;
    })
  },
  
  guards: {
    hasReconnectAttempts: ({ context }) => context.reconnectAttempts < 5,
    hasIntegrityRetryAttempts: ({ context }) => context.integrityRetryAttempts < 3,
    isValidLSN: ({ event }) => {
      if (event.type !== 'LSN_UPDATE') return false;
      return LSNService.isValid(event.lsn);
    },
    servicesReady: ({ context }) => {
      const services = getServices(context);
      return !!(services?.webSocketService && services?.incomingChangeService && services?.outgoingChangeService);
    }
  },
  
  actions: {
    initializeContext: assign(({ event }) => {
      if (event.type === 'CONNECT') {
        return {
          serverUrl: event.serverUrl,
          clientId: event.clientId,
          currentLSN: event.currentLSN,
          serviceRegistryKey: null, // Will be set when services are initialized
          syncPhase: null,
          error: null,
          reconnectAttempts: 0
        };
      }
      return {};
    }),
    
    storeServices: assign(({ event }) => {
      if (event.type === 'xstate.done.actor.initializeServices' || event.type === 'done.invoke.initializeServices') {
        const services = event.output;
        const key = crypto.randomUUID();
        serviceRegistry.set(key, {
          webSocketService: services.webSocketService,
          incomingChangeService: services.incomingChangeService,
          outgoingChangeService: services.outgoingChangeService,
          integrityService: services.integrityService
        });
        return { serviceRegistryKey: key };
      }
      return {};
    }),
    
    setupServiceCallbacks: ({ context, self }) => {
      const services = getServices(context);
      if (!services?.webSocketService || !services?.incomingChangeService || !services?.outgoingChangeService || !services?.integrityService) {
        console.error('[SyncMachineV2] Cannot setup callbacks - services not initialized');
        return;
      }
      
      console.log('[SyncMachineV2] Setting up service callbacks for actor:', self.id);
      
      // 🔥 FIX: Add actor state checking to prevent sending to stopped actors
      const safeActorSend = (event: any) => {
        try {
          // More robust check - just try to send and catch if failed
          if (!self || typeof self.send !== 'function') {
            // Silently ignore - this is normal during actor lifecycle
            return false;
          }
          
          // Check if actor is stopped before sending
          try {
            if (self.getSnapshot && self.getSnapshot().status === 'stopped') {
              // Silently ignore - this is normal when actor is stopped
              return false;
            }
          } catch (snapshotError) {
            // If we can't get snapshot, actor is probably stopped
            return false;
          }
          
          self.send(event);
          return true;
        } catch (error: any) {
          // Handle various stopped actor error patterns
          const errorMessage = error?.message || '';
          const isStoppedError = errorMessage.includes('stopped') || 
                                errorMessage.includes('final state') ||
                                errorMessage.includes('reached its final state') ||
                                errorMessage.includes('already reached its final state') ||
                                error?.name === 'Error';
          
          if (isStoppedError) {
            // Silently ignore stopped actor errors - this is normal during cleanup
            return false;
          } else {
            console.warn(`[SyncMachineV2] Failed to send ${event.type}:`, error);
            return false;
          }
        }
      };
      
      // WebSocket service callbacks
      services.webSocketService.setCallbacks({
        onMessage: (message: any) => {
          console.log('[SyncMachineV2] WebSocket message received:', message.type);
          safeActorSend({ type: 'WS_MESSAGE', message });
        },
        onStatusChange: (status: any) => {
          console.log('[SyncMachineV2] WebSocket status change:', status);
          if (status === 'connected') {
            safeActorSend({ type: 'WS_CONNECTED', serverLSN: '0/0' });
          } else if (status === 'disconnected') {
            safeActorSend({ type: 'WS_DISCONNECTED', reason: 'connection_lost' });
          }
        },
        onError: (error: any) => {
          console.error('[SyncMachineV2] WebSocket error:', error);
          safeActorSend({ type: 'WS_ERROR', error });
        },
        onConnectionRecovery: (wasOffline: boolean, durationMs?: number) => {
          console.log('[SyncMachineV2] WebSocket connection recovered');
          safeActorSend({ type: 'WS_CONNECTION_RECOVERY', wasOffline, durationMs: durationMs || 0 });
        }
      });
      
      // Incoming change service callbacks
      services.incomingChangeService.setCallbacks({
        onChangesProcessed: (changes: any, results: any) => {
          const successCount = results.filter((r: any) => r.success).length;
          const errorCount = results.filter((r: any) => !r.success).length;
          console.log(`[SyncMachineV2] Changes processed: ${successCount} success, ${errorCount} errors`);
          safeActorSend({ type: 'INCOMING_CHANGES_PROCESSED', results });
        },
        onError: (error: any, context: any) => {
          console.error('[SyncMachineV2] Incoming change service error:', error);
          safeActorSend({ type: 'INCOMING_CHANGES_ERROR', error, changes: [] });
        }
      });
      
      // Outgoing change service callbacks
      services.outgoingChangeService.setCallbacks({
        onChangesQueued: (changes: any, count: number) => {
          console.log(`[SyncMachineV2] Outgoing changes queued: ${count}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_QUEUED', count });
        },
        onChangesSent: (changes: any, messageId: string) => {
          console.log(`[SyncMachineV2] Outgoing changes sent: ${changes.length}, messageId: ${messageId}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_SENT', count: changes.length, messageId });
        },
        onChangesAcknowledged: (changeIds: string[], serverResponse: any) => {
          console.log(`[SyncMachineV2] Outgoing changes acknowledged: ${changeIds.length}`);
          safeActorSend({ type: 'OUTGOING_CHANGES_ACKNOWLEDGED', changeIds });
        },
        onError: (error: any, context: any) => {
          console.error('[SyncMachineV2] Outgoing change service error:', error);
          safeActorSend({ type: 'SERVICE_ERROR', service: 'outgoing', error, context });
        }
      });

      // Integrity service callbacks
      services.integrityService.setCallbacks({
        onValidationStarted: (reason: string) => {
          console.log(`[SyncMachineV2] Integrity validation started: ${reason}`);
        },
        onValidationCompleted: (result: any) => {
          console.log(`[SyncMachineV2] Integrity validation completed:`, result);
          safeActorSend({ type: 'INTEGRITY_VALIDATION_SUCCESS', result });
        },
        onValidationError: (error: Error, context?: string) => {
          console.error('[SyncMachineV2] Integrity validation error:', error);
          safeActorSend({ type: 'INTEGRITY_VALIDATION_ERROR', error, reason: context });
        },
        onResetStarted: (reason: string, resetType: any) => {
          console.log(`[SyncMachineV2] Integrity reset started: ${reason} (${resetType})`);
        },
        onResetCompleted: (result: any) => {
          console.log(`[SyncMachineV2] Integrity reset completed:`, result);
          safeActorSend({ type: 'INTEGRITY_RESET_COMPLETE', result });
        },
        onResetError: (error: Error, context?: string) => {
          console.error('[SyncMachineV2] Integrity reset error:', error);
          safeActorSend({ type: 'INTEGRITY_RESET_ERROR', error });
        }
      });

      // Set up integrity service with WebSocket connection for server validation
      // Create a simple adapter to make WebSocketService work with IntegrityManager
      if (services.webSocketService && services.integrityService) {
        const wsAdapter = {
          send: (message: any) => services.webSocketService!.send(message),
          isConnected: () => services.webSocketService!.isConnected(),
          getStatus: () => services.webSocketService!.getStatus(),
          on: () => {}, // Not used by IntegrityManager
          off: () => {}, // Not used by IntegrityManager
          setConnectionParams: () => {}, // Not used by IntegrityManager
          setAutoReconnect: () => {}, // Not used by IntegrityManager
          isOnline: () => navigator.onLine,
          getClientId: () => context.clientId || ''
        };
        
        console.log('[SyncMachineV2] Setting up integrity service with WebSocket adapter');
        services.integrityService.setMessageSender(wsAdapter as any);
      }
    },
    
    updateLSN: assign(({ event, context }) => {
      const updates: Partial<SyncMachineContext> = {};
      if (event.type === 'LSN_UPDATE') {
        updates.currentLSN = event.lsn;
        
        // ✅ CRITICAL FIX: Update WebSocketService with new LSN for heartbeats
        const services = getServices(context);
        if (services?.webSocketService && context.clientId) {
          console.log(`[SyncMachineV2] Updating WebSocketService LSN for heartbeats: ${context.currentLSN} → ${event.lsn}`);
          services.webSocketService.updateConnectionParams(context.clientId, event.lsn);
        }
      }
      if (event.type === 'WS_CONNECTED') {
        updates.serverLSN = event.serverLSN;
      }
      if (event.type === 'LSN_UPDATE' && event.source === 'server') {
        updates.serverLSN = event.lsn;
      }
      return updates;
    }),
    
    incrementReconnectAttempts: assign({
      reconnectAttempts: ({ context }) => context.reconnectAttempts + 1
    }),
    
    resetReconnectAttempts: assign({
      reconnectAttempts: 0
    }),
    
    // Handle WebSocket messages by sending appropriate events instead of calling services directly
    handleWebSocketMessage: ({ context, event, self }) => {
      console.log(`[SyncMachineV2] 🔍 handleWebSocketMessage called with event:`, event.type);
      
      if (event.type !== 'WS_MESSAGE') {
        console.log(`[SyncMachineV2] ⚠️ Not a WS_MESSAGE event:`, event.type);
        return;
      }
      
      if (!event.message) {
        console.log(`[SyncMachineV2] ⚠️ WS_MESSAGE event missing message property`);
        return;
      }
      
      const services = getServices(context);
      if (!services) {
        console.log(`[SyncMachineV2] ❌ No services available`);
        return;
      }
      
      const message = event.message;
      const messageType = message.type || 'unknown';
      
      console.log(`[SyncMachineV2] 📨 Handling message type: ${messageType}`);
      
      // 🔍 DEBUG: Check if this message should be routed to SyncMessageHandler
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[SyncMachineV2] 🔍 DEBUG: Received integrity validation response, checking routing...`);
        console.log(`[SyncMachineV2] Message details:`, message);
      }
      
      // Send events for change processing instead of calling services directly
      if (messageType === 'srv_init_changes' || 
          messageType === 'srv_catchup_changes' || 
          messageType === 'srv_live_changes') {
        
        const changes = message.changes || [];
        if (changes.length > 0) {
          console.log(`[SyncMachineV2] Sending INCOMING_CHANGES event for ${changes.length} changes`);
          self.send({ 
            type: 'INCOMING_CHANGES', 
            changes, 
            messageType,
            sequence: message.sequence 
          });
        }
      }
      
            // Handle integrity validation responses - route to IntegrityService
      if (messageType === 'srv_integrity_validation_response') {
        console.log(`[SyncMachineV2] 🔍 Processing integrity validation response`);
        console.log(`[SyncMachineV2] Services available:`, !!services);
        console.log(`[SyncMachineV2] IntegrityService available:`, !!services?.integrityService);
        
        if (services?.integrityService) {
          console.log(`[SyncMachineV2] ✅ Routing integrity validation response to IntegrityService`);
          try {
            services.integrityService.handleValidationResponse(message)
              .then((result: any) => {
                console.log('[SyncMachineV2] ✅ Integrity validation response processed successfully:', result);
                self.send({ type: 'INTEGRITY_VALIDATION_SUCCESS', result });
              })
              .catch((error: any) => {
                console.error('[SyncMachineV2] ❌ Error processing integrity validation response:', error);
                self.send({ type: 'INTEGRITY_VALIDATION_ERROR', error, reason: 'response_processing_error' });
              });
          } catch (error) {
            console.error('[SyncMachineV2] ❌ Error routing integrity validation response:', error);
            self.send({ type: 'INTEGRITY_VALIDATION_ERROR', error: error instanceof Error ? error : new Error(String(error)), reason: 'routing_error' });
          }
        } else {
          console.error('[SyncMachineV2] ❌ IntegrityService not available for routing validation response');
        }
      }
      
      // Handle acknowledgments for outgoing changes
      if ((messageType === 'srv_changes_received' || messageType === 'srv_changes_applied') && 
          services.outgoingChangeService) {
        const changeIds = message.changeIds || message.appliedChanges || [];
        console.log(`[SyncMachineV2] Acknowledging ${changeIds.length} outgoing changes`);
        services.outgoingChangeService.acknowledgeChanges(changeIds, message)
          .catch((error: any) => {
            console.error('[SyncMachineV2] Error acknowledging changes:', error);
            self.send({ type: 'SERVICE_ERROR', service: 'outgoing', error, context: 'acknowledge_changes' });
          });
      }
      
      // Update LSN from server messages that contain LSN information
      let lsnToUpdate: string | null = null;
      let lsnSource = messageType;
      
      if (messageType === 'srv_init_start' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_init_complete' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if ((messageType === 'srv_catchup_changes' || messageType === 'srv_live_changes') && message.lastLSN) {
        lsnToUpdate = message.lastLSN;
      } else if (messageType === 'srv_catchup_completed' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_live_start' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_lsn_update' && message.lsn) {
        lsnToUpdate = message.lsn;
      } else if (messageType === 'srv_heartbeat' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      } else if (messageType === 'srv_sync_completed' && message.serverLSN) {
        lsnToUpdate = message.serverLSN;
      }
      
      if (lsnToUpdate && lsnToUpdate !== context.currentLSN) {
        console.log(`[SyncMachineV2] Updating LSN from ${context.currentLSN} to ${lsnToUpdate} (source: ${lsnSource})`);
        self.send({ type: 'LSN_UPDATE', lsn: lsnToUpdate, source: lsnSource });
      }

      // Send WebSocket acknowledgments
      if (services.webSocketService && context.clientId) {
        let ackMessage: any = null;
        
        if (messageType === 'srv_init_start') {
          ackMessage = {
            type: 'clt_init_received',
            messageId: `init_start_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            table: 'start',
            chunk: 0
          };
        } else if (messageType === 'srv_init_changes') {
          const sequence = message.sequence;
          if (sequence) {
            ackMessage = {
              type: 'clt_init_received',
              messageId: `init_ack_${Date.now()}`,
              timestamp: Date.now(),
              clientId: context.clientId,
              table: sequence.table,
              chunk: sequence.chunk,
              lsn: context.currentLSN
            };
          }
        } else if (messageType === 'srv_catchup_changes') {
          const sequence = message.sequence;
          if (sequence) {
            ackMessage = {
              type: 'clt_catchup_received',
              messageId: `catchup_ack_${Date.now()}`,
              timestamp: Date.now(),
              clientId: context.clientId,
              chunk: sequence.chunk,
              lsn: context.currentLSN
            };
          }
        } else if (messageType === 'srv_live_changes') {
          const changes = message.changes || [];
          const changeIds = changes.map((change: any, index: number) => 
            `${change.table}_${change.data?.id || index}_${Date.now()}`
          );
          
          ackMessage = {
            type: 'clt_changes_received',
            messageId: `live_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            changeIds,
            lastLSN: context.currentLSN
          };
        } else if (messageType === 'srv_init_complete') {
          console.log('[SyncMachineV2] Initial sync complete message received');
          
          // Send the INITIAL_SYNC_COMPLETE event to trigger state transition
          self.send({ type: 'INITIAL_SYNC_COMPLETE' });
          
          // Send acknowledgment for the completion message
          ackMessage = {
            type: 'clt_init_complete_ack',
            messageId: `init_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            serverLSN: message.serverLSN || context.currentLSN
          };
        } else if (messageType === 'srv_catchup_complete') {
          console.log('[SyncMachineV2] Catchup sync complete message received');
          
          // Send the CATCHUP_SYNC_COMPLETE event to trigger state transition
          self.send({ type: 'CATCHUP_SYNC_COMPLETE' });
          
          // Send acknowledgment for the completion message
          ackMessage = {
            type: 'clt_catchup_complete_ack',
            messageId: `catchup_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: context.clientId,
            serverLSN: message.serverLSN || context.currentLSN
          };
        }
        
        if (ackMessage) {
          console.log(`[SyncMachineV2] Sending acknowledgment for ${messageType}`);
          services.webSocketService.send(ackMessage);
        }
      }
    },

    // Process incoming changes using the service's internal queuing
    processIncomingChanges: ({ context, event, self }) => {
      if (event.type !== 'INCOMING_CHANGES') return;
      
      const services = getServices(context);
      if (!services?.incomingChangeService) {
        console.error('[SyncMachineV2] IncomingChangeService not available');
        self.send({ type: 'SERVICE_ERROR', service: 'incoming', error: new Error('Service not available'), context: 'process_changes' });
        return;
      }
      
      console.log(`[SyncMachineV2] Processing ${event.changes.length} incoming changes (${event.messageType})`);
      
      // Use the service's processChanges method which now handles queuing internally
      services.incomingChangeService.processChanges(event.changes, event.messageType)
        .then((results: any) => {
          const successCount = results.filter((r: any) => r.success).length;
          const errorCount = results.filter((r: any) => !r.success).length;
          console.log(`[SyncMachineV2] Processing complete: ${successCount} success, ${errorCount} errors`);
          self.send({ type: 'INCOMING_CHANGES_PROCESSED', results });
        })
        .catch((error: any) => {
          console.error('[SyncMachineV2] Error processing changes:', error);
          self.send({ type: 'INCOMING_CHANGES_ERROR', error, changes: event.changes });
        });
    },

    recordError: assign(({ event }) => {
      const updates: Partial<SyncMachineContext> = {};
      if (event.type === 'WS_ERROR') {
        updates.error = event.error.message;
        updates.lastError = event.error;
      }
      if (event.type === 'SERVICE_ERROR') {
        updates.error = `${event.service}: ${event.error.message}`;
        updates.lastError = event.error;
      }
      return updates;
    }),

    // Clear initial sync messages from queue when transitioning to live sync
    clearInitialSyncQueue: ({ context }) => {
      const services = getServices(context);
      if (services?.incomingChangeService) {
        console.log('[SyncMachineV2] Clearing initial sync messages from queue');
        services.incomingChangeService.clearQueueByMessageType('srv_init_changes');
      }
    },

    // Clear catchup sync messages from queue when transitioning to live sync
    clearCatchupSyncQueue: ({ context }) => {
      const services = getServices(context);
      if (services?.incomingChangeService) {
        console.log('[SyncMachineV2] Clearing catchup sync messages from queue');
        services.incomingChangeService.clearQueueByMessageType('srv_catchup_changes');
      }
    },
    
         updateStats: assign(({ context, event }) => {
       const updates: Partial<SyncMachineContext> = {};
       if (event.type === 'WS_MESSAGE') {
         updates.messagesProcessed = context.messagesProcessed + 1;
       }
       if (event.type === 'INCOMING_CHANGES_PROCESSED' || event.type === 'LSN_UPDATE') {
         updates.lastSyncTime = Date.now();
       }
       return updates;
     }),
    
    cleanupServices: ({ context }) => {
      console.log('[SyncMachineV2] 🧹 Cleaning up service registry entry...');
      
      // Only remove from registry, don't destroy global services
      if (context.serviceRegistryKey) {
        serviceRegistry.delete(context.serviceRegistryKey);
        console.log('[SyncMachineV2] ✅ Removed service registry entry:', context.serviceRegistryKey);
      }
      
      // Note: Global services persist across sync machine recreations
      // They will only be destroyed when the app shuts down or explicitly reset
    },
    
    // 🔥 NEW: Enhanced logging for lifecycle tracking
    logState: ({ context, event }) => {
      console.log(`[SyncMachineV2] 🔄 State transition triggered by: ${event.type}`, {
        currentPhase: context.syncPhase,
        serviceKey: context.serviceRegistryKey ? 'present' : 'none',
        reconnectAttempts: context.reconnectAttempts,
        error: context.error
      });
    },
    
    logActorStart: () => {
      console.log('[SyncMachineV2] 🚀 Actor started - machine is now active');
    },
    
    logActorStop: () => {
      console.log('[SyncMachineV2] 🛑 Actor stopping - cleaning up callbacks');
    },
    
    logEvent: log(({ event }) => `[SyncMachineV2] Event: ${event.type}`)
  }
}).createMachine({
  id: 'syncV2',
  initial: 'idle',
  
  // 🔥 NEW: Add entry/exit logging for the entire machine
  entry: ['logActorStart'],
  exit: ['logActorStop'],
  
  context: {
    serviceRegistryKey: null,
    serverUrl: null,
    clientId: null,
    currentLSN: '0/0',
    serverLSN: null,
    syncPhase: null,
    error: null,
    lastError: null,
    reconnectAttempts: 0,
    integrityRetryAttempts: 0,
    lastSyncTime: null,
    messagesProcessed: 0,
    phaseProgress: {
      initial: {
        completedTables: 0,
        totalTables: 0,
        currentTable: null,
        tablesRemaining: []
      },
      catchup: {
        batchesProcessed: 0,
        changesProcessed: 0,
        estimatedRemaining: 0
      },
      live: {
        messagesProcessed: 0,
        lastActivity: null,
        throughputPerSec: 0
      }
    }
  },
  
  states: {
    idle: {
      entry: () => console.log('[SyncMachineV2] 💤 Entered idle state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting idle state'),
      on: {
        CONNECT: {
          target: 'initializing',
          actions: ['initializeContext', 'logState']
        }
      }
    },
    
    initializing: {
      entry: () => console.log('[SyncMachineV2] 🔧 Entered initializing state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting initializing state'),
      invoke: {
        id: 'initializeServices',
        src: 'initializeServices',
        input: ({ context, event }) => ({
          serverUrl: context.serverUrl!,
          clientId: context.clientId!,
          currentLSN: context.currentLSN
        }),
        onDone: {
          target: 'services_ready',
          actions: ['storeServices', 'logState']
        },
        onError: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    services_ready: {
      entry: ['setupServiceCallbacks', () => console.log('[SyncMachineV2] ⚙️ Entered services_ready state')],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting services_ready state'),
      always: {
        target: 'connecting',
        guard: 'servicesReady'
      },
      after: {
        1000: {
          target: 'error',
          actions: assign({ error: 'Services initialization timeout' })
        }
      }
    },
    
    connecting: {
      entry: () => console.log('[SyncMachineV2] 🌐 Entered connecting state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting connecting state'),
      invoke: {
        id: 'connectWebSocket',
        src: 'connectWebSocket',
        input: ({ context }) => ({
          context,
          serverUrl: context.serverUrl!
        }),
        onDone: {
          target: 'determining_sync_phase',
          actions: ['updateLSN', 'resetReconnectAttempts', 'logState']
        },
        onError: {
          target: 'reconnecting',
          actions: ['recordError', 'incrementReconnectAttempts', 'logState']
        }
      },
      on: {
        DISCONNECT: {
          target: 'disconnecting',
          actions: ['logState']
        }
      }
    },
    
    determining_sync_phase: {
      entry: [
        () => console.log('[SyncMachineV2] 🎯 Entered determining_sync_phase state'),
        ({ context, self }) => {
          console.log('[SyncMachineV2] Determining sync phase...', {
            currentLSN: context.currentLSN,
            serverLSN: context.serverLSN
          });
          
          // Determine phase and send appropriate event
          if (LSNService.compare(context.currentLSN, '0/0') === 0) {
            console.log('[SyncMachineV2] Starting initial sync (LSN is 0/0)');
            self.send({ type: 'START_INITIAL_SYNC' });
          } else if (context.serverLSN && LSNService.compare(context.currentLSN, context.serverLSN) < 0) {
            console.log('[SyncMachineV2] Starting catchup sync (client LSN behind server)');
            self.send({ type: 'START_CATCHUP_SYNC' });
          } else {
            console.log('[SyncMachineV2] Starting live sync (client LSN up to date)');
            self.send({ type: 'START_LIVE_SYNC' });
          }
        }
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting determining_sync_phase state'),
      
      on: {
        START_INITIAL_SYNC: {
          target: 'initial_sync',
          actions: [
            assign({ syncPhase: 'initial' }),
            sendParent({ type: 'SYNC_INITIAL_START' }),
            'logState'
          ]
        },
        START_CATCHUP_SYNC: {
          target: 'catchup_sync',
          actions: [
            assign({ syncPhase: 'catchup' }),
            sendParent({ type: 'SYNC_CATCHUP_START' }),
            'logState'
          ]
        },
        START_LIVE_SYNC: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearInitialSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        }
      }
    },
    
    initial_sync: {
      entry: () => console.log('[SyncMachineV2] 📥 Entered initial_sync state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting initial_sync state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: ['updateStats']
        },
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        INITIAL_SYNC_COMPLETE: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearInitialSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN']
        },
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    catchup_sync: {
      entry: () => console.log('[SyncMachineV2] ⏳ Entered catchup_sync state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting catchup_sync state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: ['updateStats']
        },
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        CATCHUP_SYNC_COMPLETE: {
          target: 'live_sync',
          actions: [
            assign({ syncPhase: 'live' }),
            'clearCatchupSyncQueue',
            sendParent({ type: 'SYNC_LIVE' }),
            'logState'
          ]
        },
        LSN_UPDATE: {
          actions: ['updateLSN']
        },
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },
    
    live_sync: {
      entry: () => console.log('[SyncMachineV2] 🟢 Entered live_sync state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting live_sync state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INCOMING_CHANGES: {
          actions: 'processIncomingChanges'
        },
        INCOMING_CHANGES_PROCESSED: {
          actions: ['updateStats']
        },
        INCOMING_CHANGES_ERROR: {
          actions: 'recordError'
        },
        OUTGOING_CHANGES_QUEUED: {
          actions: 'updateStats'
        },
        OUTGOING_CHANGES_SENT: {
          actions: 'updateStats'
        },
        OUTGOING_CHANGES_ACKNOWLEDGED: {
          actions: 'updateStats'
        },
        LSN_UPDATE: {
          actions: ['updateLSN']
        },
        // Integrity validation events
        INTEGRITY_VALIDATE: {
          target: 'validating_integrity',
          actions: ['logState']
        },
        INTEGRITY_RESET_REQUIRED: {
          target: 'resetting_integrity',
          actions: ['logState']
        },

        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      }
    },

    validating_integrity: {
      entry: () => console.log('[SyncMachineV2] 🔍 Entered validating_integrity state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting validating_integrity state'),
      
      on: {
        WS_MESSAGE: {
          actions: ['handleWebSocketMessage', 'updateStats']
        },
        INTEGRITY_VALIDATION_SUCCESS: {
          target: 'live_sync',
          actions: [
            ({ event }) => {
              console.log('[SyncMachineV2] ✅ Integrity validation successful:', event.result);
            },
            sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' }),
            'logState'
          ]
        },
        INTEGRITY_VALIDATION_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        },
        WS_DISCONNECTED: {
          target: 'reconnecting',
          actions: ['logState']
        },
        SERVICE_ERROR: {
          target: 'error',
          actions: ['recordError', 'logState']
        }
      },
      
      // Add timeout for integrity validation
      after: {
        30000: {
          target: 'live_sync',
          actions: [
            () => console.warn('[SyncMachineV2] ⚠️ Integrity validation timeout - proceeding anyway'),
            sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' })
          ]
        }
      },
      
      invoke: {
        src: 'validateIntegrity',
        input: ({ context, event }) => {
          const services = getServices(context);
          const reason = event.type === 'INTEGRITY_VALIDATE' ? event.reason || 'routine check' : 'unknown';
          return {
            integrityService: services?.integrityService!,
            reason
          };
        },
        onDone: [
          {
            target: 'resetting_integrity',
            guard: ({ event }) => {
              const result = event.output;
              return !result.isValid && result.recommendedAction === 'reset';
            },
            actions: [
              ({ event }) => {
                console.error('[SyncMachineV2] 🚨 Integrity validation failed - triggering reset:', event.output);
                if (event.output.issues && event.output.issues.length > 0) {
                  console.error('[SyncMachineV2] 🚨 Integrity issues that triggered reset:');
                  event.output.issues.forEach((issue: any, index: number) => {
                    console.error(`[SyncMachineV2] Reset Issue ${index + 1}:`, issue);
                  });
                }
              },
              sendParent({ type: 'INTEGRITY_RESET_REQUIRED', reason: 'Integrity validation failed' })
            ]
          },
          {
            target: 'validating_integrity',
            guard: ({ event }) => {
              const result = event.output;
              return !result.isValid && result.recommendedAction === 'retry';
            },
            actions: [
              ({ event }) => {
                console.warn('[SyncMachineV2] ⚠️ Integrity validation failed - retrying:', event.output);
                if (event.output.issues && event.output.issues.length > 0) {
                  console.warn('[SyncMachineV2] ⚠️ Integrity issues that triggered retry:');
                  event.output.issues.forEach((issue: any, index: number) => {
                    console.warn(`[SyncMachineV2] Retry Issue ${index + 1}:`, issue);
                  });
                }
              }
            ]
          },
          {
            target: 'live_sync',
            guard: ({ event }) => {
              const result = event.output;
              return result.isValid === true;
            },
            actions: [
              ({ event }) => {
                console.log('[SyncMachineV2] ✅ Integrity validation passed:', event.output);
                if (event.output.issues && event.output.issues.length > 0) {
                  console.log('[SyncMachineV2] ℹ️ Non-critical issues found but validation passed:');
                  event.output.issues.forEach((issue: any, index: number) => {
                    console.log(`[SyncMachineV2] Info Issue ${index + 1}:`, issue);
                  });
                }
              },
              sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' })
            ]
          },
          {
            // Fallback case for unknown integrity states - proceed with warning
            target: 'live_sync',
            actions: [
              ({ event }) => console.warn('[SyncMachineV2] ⚠️ Unknown integrity validation result - proceeding anyway:', event.output),
              sendParent({ type: 'INTEGRITY_VALIDATION_SUCCESS' })
            ]
          }
        ],
        onError: {
          target: 'live_sync',
          actions: [
            ({ event }) => console.error('[SyncMachineV2] Integrity validation error:', event.error),
            'recordError'
          ]
        }
      }
    },

    resetting_integrity: {
      entry: () => console.log('[SyncMachineV2] 🚨 Entered resetting_integrity state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting resetting_integrity state'),
      
      invoke: {
        src: 'executeIntegrityReset',
        input: ({ context, event }) => {
          const services = getServices(context);
          const reason = event.type === 'INTEGRITY_RESET_START' ? event.reason : 'Integrity issues detected';
          const resetType = (event.type === 'INTEGRITY_RESET_START' && event.resetType) ? event.resetType : 'full_reset';
          return {
            integrityService: services?.integrityService!,
            reason,
            resetType
          };
        },
        onDone: {
          target: 'idle', // Reset to idle - orchestrator will restart sync
          actions: [
            ({ event }) => console.log('[SyncMachineV2] Integrity reset completed:', event.output),
            sendParent({ type: 'INTEGRITY_RESET_COMPLETED' })
          ]
        },
        onError: {
          target: 'error',
          actions: [
            ({ event }) => console.error('[SyncMachineV2] Integrity reset failed:', event.error),
            'recordError'
          ]
        }
      }
    },
    
    reconnecting: {
      entry: () => console.log('[SyncMachineV2] 🔄 Entered reconnecting state'),
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting reconnecting state'),
      
      after: {
        2000: [
          {
            target: 'connecting',
            guard: 'hasReconnectAttempts',
            actions: 'logState'
          },
          {
            target: 'error',
            actions: [
              assign({ error: 'Max reconnection attempts reached' }),
              'logState'
            ]
          }
        ]
      },
      
      on: {
        RETRY: {
          target: 'connecting',
          actions: ['logState']
        },
        DISCONNECT: {
          target: 'disconnecting',
          actions: ['logState']
        }
      }
    },
    
    disconnecting: {
      entry: [
        () => console.log('[SyncMachineV2] 🔌 Entered disconnecting state'),
        'cleanupServices'
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting disconnecting state'),
      always: {
        target: 'idle',
        actions: ['logState']
      }
    },
    
    error: {
      entry: [
        () => console.error('[SyncMachineV2] ❌ Entered error state'),
        'cleanupServices'
      ],
      exit: () => console.log('[SyncMachineV2] 🔄 Exiting error state'),
      
      on: {
        RETRY: {
          target: 'connecting',
          actions: ['logState']
        },
        RESET: {
          target: 'idle',
          actions: ['logState']
        },
        CONNECT: {
          target: 'initializing',
          actions: ['initializeContext', 'logState']
        }
      }
    }
  }
});