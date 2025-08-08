/**
 * ServiceCoordinator - Simplified Service Management for Autonomous Sync
 * 
 * Replaces complex orchestrator-dependent service management with a clean,
 * autonomous coordination pattern. No orchestrator dependencies - everything
 * from sync machine context only.
 * 
 * Part of Phase 3: Streamline Service Management
 */

import { WebSocketService, WebSocketServiceConfig } from '../WebSocketService';
// DISABLED: TypeORM services - migrating to Dexie-only
import { IncomingChangeService, IncomingChangeServiceConfig } from '../IncomingChangeService';
// import { OutgoingChangeService, OutgoingChangeServiceConfig } from '../OutgoingChangeService';
import { DexieOutgoingChangeService, DexieOutgoingChangeServiceConfig } from '../DexieOutgoingChangeService';
// import { IntegrityService, IntegrityServiceConfig } from '../IntegrityService';
// import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { syncLogger } from './SyncLogger';

export interface Services {
  webSocket: WebSocketService;
  incoming?: IncomingChangeService; // Has Dexie implementation
  outgoing?: any; // OutgoingChangeService - DISABLED for TypeORM removal
  dexieOutgoing?: DexieOutgoingChangeService; // Primary sync service for Dexie
  integrity?: any; // IntegrityService - DISABLED for TypeORM removal
}

export interface ServiceCoordinatorConfig {
  clientId: string;
  currentLSN: string;
  serverUrl: string;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeoutMs?: number;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  enableServerValidation?: boolean;
  validationTimeoutMs?: number;
  autoResetOnFailure?: boolean;
  enableDexieSync?: boolean; // Enable parallel Dexie sync
}

/**
 * Simplified service management for autonomous sync machine
 * 
 * No orchestrator dependencies - initializes services with sync machine context only
 */
export class ServiceCoordinator {
  private services: {
    webSocket: WebSocketService | null;
    incoming: IncomingChangeService | null; // Has Dexie implementation
    outgoing: any | null; // OutgoingChangeService - DISABLED for TypeORM removal
    dexieOutgoing: DexieOutgoingChangeService | null;
    integrity: any | null; // IntegrityService - DISABLED for TypeORM removal
  } = {
    webSocket: null,
    incoming: null,
    outgoing: null,
    dexieOutgoing: null,
    integrity: null
  };

  private config: ServiceCoordinatorConfig | null = null;
  // private dataSource: NewPGliteDataSource | null = null; // DISABLED - TypeORM removal
  private eventHandler: ((event: any) => void) | null = null;

  constructor() {
    syncLogger.info('service', 'ServiceCoordinator created for autonomous sync');
  }

  /**
   * Initialize all services with sync machine context only
   * No orchestrator dependencies - everything from context
   */
  async initialize(config: ServiceCoordinatorConfig): Promise<Services> {
    this.config = config;
    
    syncLogger.info('service', 'Initializing services with autonomous coordination', {
      clientId: config.clientId,
      currentLSN: config.currentLSN,
      serverUrl: config.serverUrl
    });

    try {
      // DISABLED: TypeORM DataSource initialization - using Dexie only
      // const { getNewPGliteDataSource } = await import('../../db/newtypeorm/NewDataSource');
      // this.dataSource = await getNewPGliteDataSource();
      // 
      // if (!this.dataSource || !this.dataSource.isInitialized) {
      //   throw new Error('DataSource not available - app-init should only invoke sync after database is ready');
      // }
      //
      // syncLogger.serviceInitialized('DataSource', { isInitialized: this.dataSource.isInitialized });
      
      syncLogger.info('service', 'Skipping TypeORM DataSource - using Dexie-only mode');

      // Create service configurations using autonomous pattern (no orchestrator)
      const wsConfig: WebSocketServiceConfig = {
        serverUrl: config.serverUrl,
        clientId: config.clientId,
        lsn: config.currentLSN,
        enableHeartbeat: true,
        heartbeatInterval: config.heartbeatInterval || 30000,
        reconnectDelay: config.reconnectDelay || 1000,
        maxReconnectAttempts: config.maxReconnectAttempts || 5
      };

      // DISABLED: TypeORM service configurations
      // const incomingConfig: IncomingChangeServiceConfig = {
      //   clientId: config.clientId,
      //   enableBatching: config.enableBatching ?? true,
      //   batchSize: config.batchSize || 50,
      //   batchTimeoutMs: config.batchTimeoutMs || 1000
      // };

      // const outgoingConfig: OutgoingChangeServiceConfig = {
      //   clientId: config.clientId,
      //   enableBatching: config.enableBatching ?? true,
      //   batchSize: config.batchSize || 50,
      //   batchTimeoutMs: config.batchTimeoutMs || 1000
      // };

      // const integrityConfig: IntegrityServiceConfig = {
      //   clientId: config.clientId,
      //   enableServerValidation: config.enableServerValidation ?? true,
      //   validationTimeoutMs: config.validationTimeoutMs || 30000,
      //   autoResetOnFailure: config.autoResetOnFailure ?? false
      // };

      // Initialize services in correct order with proper dependencies
      syncLogger.info('service', 'Creating WebSocketService...');
      this.services.webSocket = new WebSocketService(wsConfig);
      
      // DISABLED: TypeORM services - using Dexie-only mode
      // syncLogger.info('service', 'Creating IncomingChangeService...');
      // this.services.incoming = new IncomingChangeService(incomingConfig, this.dataSource);
      
      // // Only create old OutgoingChangeService if Dexie sync is disabled
      // if (!config.enableDexieSync) {
      //   syncLogger.info('service', 'Creating OutgoingChangeService with WebSocket message sender...');
      //   this.services.outgoing = new OutgoingChangeService(outgoingConfig, this.dataSource, this.services.webSocket);
      // } else {
      //   syncLogger.info('service', 'Skipping OutgoingChangeService - using Dexie sync instead');
      // }
      
      // syncLogger.info('service', 'Creating IntegrityService with WebSocket message sender...');
      // this.services.integrity = new IntegrityService(integrityConfig, this.dataSource);
      // this.services.integrity.setMessageSender(this.services.webSocket);
      
      syncLogger.info('service', 'Creating IncomingChangeService with Dexie implementation...');
      
      // Create IncomingChangeService with a null DataSource since it uses Dexie internally
      const incomingConfig: IncomingChangeServiceConfig = {
        clientId: config.clientId,
        enableOptimisticUpdates: false,
        batchSize: config.batchSize || 50,
        conflictResolution: 'server-wins'
      };
      this.services.incoming = new IncomingChangeService(incomingConfig, null as any);
      // IncomingChangeService created in Dexie mode

      // Initialize Dexie outgoing service if enabled
      if (config.enableDexieSync) {
        syncLogger.info('service', 'Creating DexieOutgoingChangeService for parallel sync...');
        const dexieOutgoingConfig: DexieOutgoingChangeServiceConfig = {
          clientId: config.clientId,
          batchSize: config.batchSize || 100,
          maxRetries: 3,
          retryDelay: 1000
        };
        this.services.dexieOutgoing = new DexieOutgoingChangeService(dexieOutgoingConfig);
        // DexieOutgoingChangeService created successfully
      } else {
        // DexieOutgoingChangeService disabled
      }

      // Validate all services created successfully
      // In Dexie-only mode, we require WebSocketService and IncomingChangeService
      const requiredServices = [this.services.webSocket, this.services.incoming];
      
      if (requiredServices.some(service => !service)) {
        throw new Error('Failed to create required services (WebSocketService or IncomingChangeService)');
      }
      
      syncLogger.info('service', 'Dexie-only mode: WebSocketService, IncomingChangeService and DexieOutgoingChangeService are active');

      syncLogger.serviceInitialized('ServiceCoordinator', {
        webSocket: !!this.services.webSocket,
        incoming: !!this.services.incoming,
        outgoing: !!this.services.outgoing,
        dexieOutgoing: !!this.services.dexieOutgoing,
        integrity: !!this.services.integrity,
        autonomous: true // No orchestrator dependencies
      });

      return {
        webSocket: this.services.webSocket,
        incoming: this.services.incoming,
        outgoing: this.services.outgoing,
        dexieOutgoing: this.services.dexieOutgoing,
        integrity: this.services.integrity
      };

    } catch (error) {
      syncLogger.serviceError('ServiceCoordinator', error as Error, 'initialization');
      throw error;
    }
  }

  /**
   * Setup callbacks for all services - simplified callback setup
   * Just relay events to sync machine with no complex orchestrator coordination
   */
  setupCallbacks(eventHandler: (event: any) => void): void {
    this.eventHandler = eventHandler;
    
    // In Dexie-only mode, WebSocketService and IncomingChangeService are required
    if (!this.services.webSocket || !this.services.incoming) {
      throw new Error('Required services not initialized - call initialize() first');
    }

    syncLogger.info('service', 'Setting up simplified service callbacks');

    // WebSocket service callbacks - relay to sync machine
    this.services.webSocket.setCallbacks({
      onStatusChange: (status: string) => {
        syncLogger.serviceCallback('WebSocket', 'statusChange', { status });
        if (status === 'connected') {
          eventHandler({ type: 'WS_CONNECTED', serverLSN: '0/0' });
        } else if (status === 'disconnected') {
          eventHandler({ type: 'WS_DISCONNECTED', reason: 'Connection lost' });
        } else if (status === 'error') {
          eventHandler({ type: 'WS_ERROR', error: new Error('WebSocket connection error') });
        }
      },
      onMessage: (message: any) => {
        syncLogger.messageReceived(message?.type || 'unknown');
        eventHandler({ type: 'WS_MESSAGE', message });
      },
      onError: (error: Error) => {
        syncLogger.serviceError('WebSocket', error);
        eventHandler({ type: 'WS_ERROR', error });
      }
    });

    // Incoming change service callbacks (Dexie implementation)
    if (this.services.incoming) {
      this.services.incoming.setCallbacks({
        onChangesProcessed: (changes: any[], results: any[]) => {
          syncLogger.serviceCallback('IncomingChanges', 'changesProcessed', { 
            changeCount: changes.length,
            resultCount: results.length 
          });
          eventHandler({ type: 'INCOMING_CHANGES_PROCESSED', results });
        },
        onError: (error: Error, context?: string) => {
          syncLogger.serviceError('IncomingChanges', error, context);
          eventHandler({ type: 'SERVICE_ERROR', service: 'incoming', error });
        }
      });
    }

    // // Outgoing change service callbacks (only if using old system)
    // if (this.services.outgoing) {
    //   this.services.outgoing.setCallbacks({
    //   onChangesQueued: (count: number) => {
    //     syncLogger.serviceCallback('OutgoingChanges', 'changesQueued', { count });
    //     eventHandler({ type: 'OUTGOING_CHANGES_QUEUED', count });
    //   },
    //   onChangesSent: (count: number) => {
    //     syncLogger.serviceCallback('OutgoingChanges', 'changesSent', { count });
    //     syncLogger.debug('service', 'ServiceCoordinator sending OUTGOING_CHANGES_SENT event', {
    //       eventType: 'OUTGOING_CHANGES_SENT',
    //       count,
    //       countType: typeof count
    //     });
    //     eventHandler({ type: 'OUTGOING_CHANGES_SENT', count });
    //   },
    //   onChangesAcknowledged: (changeIds: string[]) => {
    //     syncLogger.serviceCallback('OutgoingChanges', 'changesAcknowledged', { count: changeIds.length });
    //     eventHandler({ type: 'OUTGOING_CHANGES_ACKNOWLEDGED', changeIds });
    //   },
    //   onError: (error: Error) => {
    //     syncLogger.serviceError('OutgoingChanges', error);
    //     eventHandler({ type: 'SERVICE_ERROR', service: 'outgoing', error });
    //   }
    // });
    // }

    // // Integrity service callbacks
    // this.services.integrity.setCallbacks({
    //   onValidationStarted: (reason: string) => {
    //     syncLogger.validationStarted(reason);
    //   },
    //   onValidationCompleted: (result: any) => {
    //     syncLogger.validationCompleted(result.isValid, result.issues?.length || 0);
    //     eventHandler({ type: 'INTEGRITY_VALIDATION_COMPLETED', result });
    //   },
    //   onValidationError: (error: Error, reason?: string) => {
    //     syncLogger.validationError(error, reason);
    //     eventHandler({ type: 'SERVICE_ERROR', service: 'integrity', error });
    //   },
    //   onResetStarted: (reason: string) => {
    //     syncLogger.info('validation', `Reset started: ${reason}`);
    //   },
    //   onResetCompleted: (result: any) => {
    //     syncLogger.info('validation', `Reset completed successfully`, result);
    //     eventHandler({ type: 'INTEGRITY_RESET_COMPLETED', result });
    //   },
    //   onResetError: (error: Error, reason?: string) => {
    //     syncLogger.serviceError('IntegrityReset', error, reason);
    //     eventHandler({ type: 'SERVICE_ERROR', service: 'integrity', error });
    //   }
    // });

    // Dexie outgoing service callbacks (if enabled)
    if (this.services.dexieOutgoing) {
      this.services.dexieOutgoing.setCallbacks({
        onChangesSent: (changes, success) => {
          syncLogger.serviceCallback('DexieOutgoingChanges', 'changesSent', { 
            count: changes.length,
            success 
          });
          if (success) {
            eventHandler({ type: 'DEXIE_CHANGES_SENT', count: changes.length });
          }
        },
        onError: (error: Error, context?: string) => {
          syncLogger.serviceError('DexieOutgoingChanges', error, context);
          eventHandler({ type: 'SERVICE_ERROR', service: 'dexieOutgoing', error });
        },
        onProgress: (sent: number, total: number) => {
          syncLogger.serviceCallback('DexieOutgoingChanges', 'progress', { sent, total });
        },
        onSendRequest: async (changes) => {
          // Send changes via WebSocket
          if (this.services.webSocket) {
            try {
              const messageId = Date.now().toString();
              
              // Sending Dexie changes to server (${changes.length} changes)
              
              this.services.webSocket.send({
                type: 'clt_send_changes',
                messageId,
                changes,
                clientId: this.config!.clientId,
                timestamp: Date.now()
              });
              return true;
            } catch (error) {
              syncLogger.serviceError('DexieOutgoingChanges', error as Error, 'send_request');
              return false;
            }
          }
          return false;
        }
      });
    }

    syncLogger.serviceInitialized('Callbacks', {
      webSocket: true,
      incoming: true,
      outgoing: true,
      dexieOutgoing: !!this.services.dexieOutgoing,
      integrity: true,
      eventHandler: !!this.eventHandler
    });
  }

  /**
   * Get services - simple access pattern
   */
  getServices(): Services | null {
    // In Dexie-only mode, only WebSocket is required
    if (!this.services.webSocket) {
      return null;
    }

    return {
      webSocket: this.services.webSocket,
      incoming: this.services.incoming, // Will be null
      outgoing: this.services.outgoing, // Will be null
      dexieOutgoing: this.services.dexieOutgoing,
      integrity: this.services.integrity // Will be null
    };
  }

  /**
   * Update configuration for all services
   */
  updateConfig(updates: Partial<ServiceCoordinatorConfig>): void {
    if (!this.config) {
      throw new Error('ServiceCoordinator not initialized');
    }

    this.config = { ...this.config, ...updates };
    
    syncLogger.info('service', 'Updated ServiceCoordinator configuration', updates);

    // Update WebSocket service configuration if needed
    if (this.services.webSocket && (updates.clientId || updates.currentLSN)) {
      this.services.webSocket.updateConnectionParams(
        updates.clientId || this.config.clientId,
        updates.currentLSN || this.config.currentLSN
      );
    }
  }

  /**
   * Health check for all services
   */
  getHealthStatus(): { [serviceName: string]: boolean } {
    return {
      webSocket: !!this.services.webSocket,
      incoming: !!this.services.incoming,
      outgoing: !!this.services.outgoing,
      dexieOutgoing: !!this.services.dexieOutgoing,
      integrity: !!this.services.integrity,
      coordinator: !!this.config,
      // dataSource: !!this.dataSource?.isInitialized // DISABLED - TypeORM removal
    };
  }

  /**
   * Get service statistics
   */
  getServiceStats(): any {
    const health = this.getHealthStatus();
    
    return {
      coordinator: {
        initialized: !!this.config,
        autonomous: true, // No orchestrator dependencies
        config: this.config ? {
          clientId: this.config.clientId,
          serverUrl: this.config.serverUrl,
          enableBatching: this.config.enableBatching,
          enableServerValidation: this.config.enableServerValidation
        } : null
      },
      services: health,
      // dataSource: { // DISABLED - TypeORM removal
      //   available: !!this.dataSource,
      //   initialized: this.dataSource?.isInitialized || false
      // }
    };
  }

  /**
   * Destroy/cleanup all services
   */
  destroy(): void {
    syncLogger.info('service', 'ServiceCoordinator destroying all services...');

    if (this.services.webSocket) {
      try {
        this.services.webSocket.destroy();
        syncLogger.info('service', 'WebSocketService destroyed');
      } catch (error) {
        syncLogger.serviceError('WebSocket', error as Error, 'destruction');
      }
    }

    if (this.services.incoming) {
      try {
        this.services.incoming.destroy();
        syncLogger.info('service', 'IncomingChangeService destroyed');
      } catch (error) {
        syncLogger.serviceError('IncomingChanges', error as Error, 'destruction');
      }
    }

    if (this.services.outgoing) {
      try {
        this.services.outgoing.destroy();
        syncLogger.info('service', 'OutgoingChangeService destroyed');
      } catch (error) {
        syncLogger.serviceError('OutgoingChanges', error as Error, 'destruction');
      }
    }

    if (this.services.dexieOutgoing) {
      try {
        this.services.dexieOutgoing.destroy();
        syncLogger.info('service', 'DexieOutgoingChangeService destroyed');
      } catch (error) {
        syncLogger.serviceError('DexieOutgoingChanges', error as Error, 'destruction');
      }
    }

    // IntegrityService doesn't currently have a destroy method
    if (this.services.integrity) {
      syncLogger.info('service', 'IntegrityService cleanup completed');
    }

    // Clear references
    this.services = {
      webSocket: null,
      incoming: null,
      outgoing: null,
      dexieOutgoing: null,
      integrity: null
    };

    this.config = null;
    this.dataSource = null;
    this.eventHandler = null;

    syncLogger.serviceInitialized('ServiceCoordinator', { destroyed: true });
  }
}