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
import { IncomingChangeService, IncomingChangeServiceConfig } from '../IncomingChangeService';
import { OutgoingChangeService, OutgoingChangeServiceConfig } from '../OutgoingChangeService';
import { IntegrityService, IntegrityServiceConfig } from '../IntegrityService';
import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { syncLogger } from './SyncLogger';

export interface Services {
  webSocket: WebSocketService;
  incoming: IncomingChangeService;
  outgoing: OutgoingChangeService;
  integrity: IntegrityService;
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
}

/**
 * Simplified service management for autonomous sync machine
 * 
 * No orchestrator dependencies - initializes services with sync machine context only
 */
export class ServiceCoordinator {
  private services: {
    webSocket: WebSocketService | null;
    incoming: IncomingChangeService | null;
    outgoing: OutgoingChangeService | null;
    integrity: IntegrityService | null;
  } = {
    webSocket: null,
    incoming: null,
    outgoing: null,
    integrity: null
  };

  private config: ServiceCoordinatorConfig | null = null;
  private dataSource: NewPGliteDataSource | null = null;
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
      // Get dataSource (should be ready since app-init only invokes us after database init)
      const { getNewPGliteDataSource } = await import('../../db/newtypeorm/NewDataSource');
      this.dataSource = await getNewPGliteDataSource();
      
      if (!this.dataSource || !this.dataSource.isInitialized) {
        throw new Error('DataSource not available - app-init should only invoke sync after database is ready');
      }

      syncLogger.serviceInitialized('DataSource', { isInitialized: this.dataSource.isInitialized });

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

      const incomingConfig: IncomingChangeServiceConfig = {
        clientId: config.clientId,
        enableBatching: config.enableBatching ?? true,
        batchSize: config.batchSize || 50,
        batchTimeoutMs: config.batchTimeoutMs || 1000
      };

      const outgoingConfig: OutgoingChangeServiceConfig = {
        clientId: config.clientId,
        enableBatching: config.enableBatching ?? true,
        batchSize: config.batchSize || 50,
        batchTimeoutMs: config.batchTimeoutMs || 1000
      };

      const integrityConfig: IntegrityServiceConfig = {
        clientId: config.clientId,
        enableServerValidation: config.enableServerValidation ?? true,
        validationTimeoutMs: config.validationTimeoutMs || 30000,
        autoResetOnFailure: config.autoResetOnFailure ?? false
      };

      // Initialize services with sync machine context only
      syncLogger.info('service', 'Creating WebSocketService...');
      this.services.webSocket = new WebSocketService(wsConfig);
      
      syncLogger.info('service', 'Creating IncomingChangeService...');
      this.services.incoming = new IncomingChangeService(incomingConfig, this.dataSource);
      
      syncLogger.info('service', 'Creating OutgoingChangeService...');
      this.services.outgoing = new OutgoingChangeService(outgoingConfig, this.dataSource);
      
      syncLogger.info('service', 'Creating IntegrityService...');
      this.services.integrity = new IntegrityService(integrityConfig, this.dataSource);

      // Validate all services created successfully
      if (!this.services.webSocket || !this.services.incoming || 
          !this.services.outgoing || !this.services.integrity) {
        throw new Error('Failed to create one or more services');
      }

      // Set WebSocketService as message sender for IntegrityService (enables server validation)
      this.services.integrity.setMessageSender(this.services.webSocket);
      syncLogger.info('service', 'WebSocketService configured as message sender for IntegrityService');

      syncLogger.serviceInitialized('ServiceCoordinator', {
        webSocket: !!this.services.webSocket,
        incoming: !!this.services.incoming,
        outgoing: !!this.services.outgoing,
        integrity: !!this.services.integrity,
        autonomous: true // No orchestrator dependencies
      });

      return {
        webSocket: this.services.webSocket,
        incoming: this.services.incoming,
        outgoing: this.services.outgoing,
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
    
    if (!this.services.webSocket || !this.services.incoming || 
        !this.services.outgoing || !this.services.integrity) {
      throw new Error('Services not initialized - call initialize() first');
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

    // Incoming change service callbacks
    this.services.incoming.setCallbacks({
      onChangesProcessed: (results: any[]) => {
        syncLogger.serviceCallback('IncomingChanges', 'changesProcessed', { count: results.length });
        eventHandler({ type: 'INCOMING_CHANGES_PROCESSED', results });
      },
      onError: (error: Error) => {
        syncLogger.serviceError('IncomingChanges', error);
        eventHandler({ type: 'SERVICE_ERROR', service: 'incoming', error });
      }
    });

    // Outgoing change service callbacks
    this.services.outgoing.setCallbacks({
      onChangesQueued: (count: number) => {
        syncLogger.serviceCallback('OutgoingChanges', 'changesQueued', { count });
        eventHandler({ type: 'OUTGOING_CHANGES_QUEUED', count });
      },
      onChangesSent: (count: number) => {
        syncLogger.serviceCallback('OutgoingChanges', 'changesSent', { count });
        eventHandler({ type: 'OUTGOING_CHANGES_SENT', count });
      },
      onChangesAcknowledged: (changeIds: string[]) => {
        syncLogger.serviceCallback('OutgoingChanges', 'changesAcknowledged', { count: changeIds.length });
        eventHandler({ type: 'OUTGOING_CHANGES_ACKNOWLEDGED', changeIds });
      },
      onError: (error: Error) => {
        syncLogger.serviceError('OutgoingChanges', error);
        eventHandler({ type: 'SERVICE_ERROR', service: 'outgoing', error });
      }
    });

    // Integrity service callbacks
    this.services.integrity.setCallbacks({
      onValidationStarted: (reason: string) => {
        syncLogger.validationStarted(reason);
      },
      onValidationCompleted: (result: any) => {
        syncLogger.validationCompleted(result.isValid, result.issues?.length || 0);
        eventHandler({ type: 'INTEGRITY_VALIDATION_COMPLETED', result });
      },
      onValidationError: (error: Error, reason?: string) => {
        syncLogger.validationError(error, reason);
        eventHandler({ type: 'SERVICE_ERROR', service: 'integrity', error });
      },
      onResetStarted: (reason: string) => {
        syncLogger.info('validation', `Reset started: ${reason}`);
      },
      onResetCompleted: (result: any) => {
        syncLogger.info('validation', `Reset completed successfully`, result);
        eventHandler({ type: 'INTEGRITY_RESET_COMPLETED', result });
      },
      onResetError: (error: Error, reason?: string) => {
        syncLogger.serviceError('IntegrityReset', error, reason);
        eventHandler({ type: 'SERVICE_ERROR', service: 'integrity', error });
      }
    });

    syncLogger.serviceInitialized('Callbacks', {
      webSocket: true,
      incoming: true,
      outgoing: true,
      integrity: true,
      eventHandler: !!this.eventHandler
    });
  }

  /**
   * Get services - simple access pattern
   */
  getServices(): Services | null {
    if (!this.services.webSocket || !this.services.incoming || 
        !this.services.outgoing || !this.services.integrity) {
      return null;
    }

    return {
      webSocket: this.services.webSocket,
      incoming: this.services.incoming,
      outgoing: this.services.outgoing,
      integrity: this.services.integrity
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
      integrity: !!this.services.integrity,
      coordinator: !!this.config,
      dataSource: !!this.dataSource?.isInitialized
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
      dataSource: {
        available: !!this.dataSource,
        initialized: this.dataSource?.isInitialized || false
      }
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

    // IntegrityService doesn't currently have a destroy method
    if (this.services.integrity) {
      syncLogger.info('service', 'IntegrityService cleanup completed');
    }

    // Clear references
    this.services = {
      webSocket: null,
      incoming: null,
      outgoing: null,
      integrity: null
    };

    this.config = null;
    this.dataSource = null;
    this.eventHandler = null;

    syncLogger.serviceInitialized('ServiceCoordinator', { destroyed: true });
  }
}