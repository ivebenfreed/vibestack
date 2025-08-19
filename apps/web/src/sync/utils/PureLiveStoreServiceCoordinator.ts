/**
 * Pure LiveStore Service Coordinator - Complete ServiceCoordinator Replacement
 * 
 * Replaces the existing ServiceCoordinator with a pure LiveStore implementation.
 * No Dexie dependencies - uses only LiveStore for all database operations.
 */

import { WebSocketService, type WebSocketServiceConfig } from '../WebSocketService'
import { PureLiveStoreSync, type PureLiveStoreSyncConfig } from '../PureLiveStoreSync'
import { syncLogger } from './SyncLogger'
import { liveStoreSchemaClient } from '../../lib/livestore-schema-client'

export interface PureLiveStoreServices {
  webSocket: WebSocketService
  liveStoreSync: PureLiveStoreSync
  liveStore: any // LiveStore instance
}

export interface PureLiveStoreCoordinatorConfig {
  clientId: string
  currentLSN: string
  serverUrl: string
  organizationId: string
  userId: string
  enableHeartbeat?: boolean
  heartbeatInterval?: number
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

/**
 * Pure LiveStore Service Coordinator
 * Manages only WebSocket + LiveStore services (no Dexie)
 */
export class PureLiveStoreServiceCoordinator {
  private services: {
    webSocket: WebSocketService | null
    liveStoreSync: PureLiveStoreSync | null
    liveStore: any | null
  } = {
    webSocket: null,
    liveStoreSync: null,
    liveStore: null
  }

  private config: PureLiveStoreCoordinatorConfig | null = null
  private eventHandler: ((event: any) => void) | null = null
  private currentLSN: string = '0/0'
  private isInitialSyncComplete: boolean = false

  constructor() {
    syncLogger.info('service', 'PureLiveStoreServiceCoordinator created')
  }

  /**
   * Initialize all services with pure LiveStore approach
   */
  async initialize(config: PureLiveStoreCoordinatorConfig): Promise<PureLiveStoreServices> {
    this.config = config
    
    // Initialize LSN tracking from config
    this.currentLSN = config.currentLSN || '0/0'
    this.isInitialSyncComplete = this.currentLSN !== '0/0'
    
    syncLogger.info('service', 'Initializing pure LiveStore services', {
      clientId: config.clientId,
      organizationId: config.organizationId,
      currentLSN: this.currentLSN,
      isInitialSyncComplete: this.isInitialSyncComplete,
      serverUrl: config.serverUrl
    })

    try {
      // 1. Initialize LiveStore first (primary data store)
      await this.initializeLiveStore(config)
      
      // 2. Initialize WebSocket service
      await this.initializeWebSocket(config)
      
      // 3. Initialize pure LiveStore sync services
      await this.initializeLiveStoreSync(config)

      // 4. Validate all services are ready
      if (!this.services.webSocket || !this.services.liveStoreSync || !this.services.liveStore) {
        throw new Error('Failed to initialize required services')
      }

      syncLogger.serviceInitialized('PureLiveStoreServiceCoordinator', {
        webSocket: !!this.services.webSocket,
        liveStoreSync: !!this.services.liveStoreSync,
        liveStore: !!this.services.liveStore,
        pure: true // No Dexie dependencies
      })

      return {
        webSocket: this.services.webSocket,
        liveStoreSync: this.services.liveStoreSync,
        liveStore: this.services.liveStore
      }

    } catch (error) {
      syncLogger.serviceError('PureLiveStoreServiceCoordinator', error as Error, 'initialization')
      throw error
    }
  }

  /**
   * Initialize LiveStore as primary data store
   */
  private async initializeLiveStore(config: PureLiveStoreCoordinatorConfig) {
    syncLogger.info('service', 'Initializing LiveStore instance', {
      organizationId: config.organizationId
    })

    try {
      // Add retry logic for LiveStore initialization
      let retries = 3;
      let lastError = null;
      
      while (retries > 0) {
        try {
          console.log(`[PureLiveStoreServiceCoordinator] Attempting LiveStore init (${4-retries}/3)...`);
          
          // Ensure LiveStore is ready for this organization
          this.services.liveStore = await liveStoreSchemaClient.initializeLiveStore(
            config.organizationId,
            config.clientId
          )

          if (!this.services.liveStore) {
            throw new Error('Failed to initialize LiveStore instance - returned null')
          }

          // Wait for LiveStore to be ready
          await this.services.liveStore.ready()
          
          console.log(`[PureLiveStoreServiceCoordinator] ✅ LiveStore initialized successfully`);
          break; // Success!
          
        } catch (error) {
          lastError = error;
          retries--;
          console.log(`[PureLiveStoreServiceCoordinator] ❌ LiveStore init failed (${retries} retries left):`, error.message);
          
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        }
      }
      
      if (!this.services.liveStore) {
        console.error('[PureLiveStoreServiceCoordinator] All retry attempts failed:', lastError);
        throw lastError || new Error('LiveStore initialization failed after retries');
      }
      
      syncLogger.info('service', 'LiveStore instance ready', {
        organizationId: config.organizationId
      })

    } catch (error) {
      syncLogger.serviceError('LiveStore', error as Error, 'initialization')
      throw error
    }
  }

  /**
   * Initialize WebSocket service (unchanged from existing implementation)
   */
  private async initializeWebSocket(config: PureLiveStoreCoordinatorConfig) {
    syncLogger.info('service', 'Initializing WebSocket service')

    try {
      const wsConfig: WebSocketServiceConfig = {
        serverUrl: config.serverUrl,
        clientId: config.clientId,
        lsn: config.currentLSN,
        organizationId: config.organizationId,
        enableHeartbeat: config.enableHeartbeat ?? true,
        heartbeatInterval: config.heartbeatInterval || 30000,
        reconnectDelay: config.reconnectDelay || 1000,
        maxReconnectAttempts: config.maxReconnectAttempts || 5
      }

      this.services.webSocket = new WebSocketService(wsConfig)
      
      syncLogger.info('service', 'WebSocket service created')

    } catch (error) {
      syncLogger.serviceError('WebSocket', error as Error, 'initialization')
      throw error
    }
  }

  /**
   * Initialize pure LiveStore sync services
   */
  private async initializeLiveStoreSync(config: PureLiveStoreCoordinatorConfig) {
    if (!this.services.webSocket) {
      throw new Error('WebSocket service must be initialized first')
    }

    syncLogger.info('service', 'Initializing pure LiveStore sync services')

    try {
      const syncConfig: PureLiveStoreSyncConfig = {
        organizationId: config.organizationId,
        clientId: config.clientId,
        userId: config.userId,
        webSocketService: this.services.webSocket
      }

      this.services.liveStoreSync = new PureLiveStoreSync(syncConfig)
      await this.services.liveStoreSync.initialize()

      syncLogger.info('service', 'Pure LiveStore sync services initialized')

    } catch (error) {
      syncLogger.serviceError('PureLiveStoreSync', error as Error, 'initialization')
      throw error
    }
  }

  /**
   * Setup callbacks for all services
   */
  setupCallbacks(eventHandler: (event: any) => void): void {
    this.eventHandler = eventHandler
    
    if (!this.services.webSocket || !this.services.liveStoreSync) {
      throw new Error('Services not initialized - call initialize() first')
    }

    syncLogger.info('service', 'Setting up pure LiveStore service callbacks')

    // WebSocket service callbacks
    this.services.webSocket.setCallbacks({
      onStatusChange: (status: string) => {
        syncLogger.serviceCallback('WebSocket', 'statusChange', { status })
        
        if (status === 'connected') {
          // Use current LSN, only send 0/0 for truly fresh connections
          const lsnToSend = this.isInitialSyncComplete ? this.currentLSN : '0/0'
          eventHandler({ type: 'WS_CONNECTED', serverLSN: lsnToSend })
          syncLogger.info('sync', `WebSocket connected with LSN: ${lsnToSend} (initial sync complete: ${this.isInitialSyncComplete})`)
        } else if (status === 'disconnected') {
          eventHandler({ type: 'WS_DISCONNECTED', reason: 'Connection lost' })
        } else if (status === 'error') {
          eventHandler({ type: 'WS_ERROR', error: new Error('WebSocket connection error') })
        }
      },
      
      onMessage: (message: any) => {
        syncLogger.messageReceived(message?.type || 'unknown')
        
        // Handle incoming changes through LiveStore sync
        if (message.changes && (
          message.type === 'srv_send_changes' || 
          message.type === 'srv_init_changes'
        )) {
          this.handleIncomingChanges(message.changes, message.type)
        }
        
        // Handle init phase start
        if (message.type === 'srv_init_start') {
          syncLogger.info('sync', 'Initial sync started by server')
          // Send acknowledgment
          const ackMessage = {
            type: 'clt_init_received',
            messageId: `init_start_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: this.config?.clientId
          }
          this.services.webSocket?.send(ackMessage)
          syncLogger.info('sync', 'Sent acknowledgment: clt_init_received')
        }
        
        // Handle init phase completion
        if (message.type === 'srv_init_complete') {
          syncLogger.info('sync', 'Initial sync completed by server')
          
          // Update LSN tracking
          const serverLSN = message.serverLSN || message.lsn
          if (serverLSN) {
            this.currentLSN = serverLSN
            this.isInitialSyncComplete = true
            
            syncLogger.info('sync', `Updated LSN after initial sync: ${this.currentLSN} (sync machine will be updated via event)`)
          }
          
          // Send acknowledgment
          const ackMessage = {
            type: 'clt_init_processed',
            messageId: `init_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: this.config?.clientId,
            serverLSN: serverLSN
          }
          this.services.webSocket?.send(ackMessage)
          syncLogger.info('sync', 'Sent acknowledgment: clt_init_processed')
          
          console.log('[PureLiveStoreServiceCoordinator] Sending INITIAL_SYNC_COMPLETE event to sync machine:', {
            type: 'INITIAL_SYNC_COMPLETE', 
            serverLSN: serverLSN,
            coordinatorLSN: this.currentLSN
          });
          eventHandler({ type: 'INITIAL_SYNC_COMPLETE', serverLSN: serverLSN })
          
          // CRITICAL FIX: Send separate LSN_UPDATE event like original sync-machine-v3
          console.log('[PureLiveStoreServiceCoordinator] Sending LSN_UPDATE event to sync machine:', {
            type: 'LSN_UPDATE',
            lsn: serverLSN,
            source: 'initial_sync_completion'
          });
          eventHandler({ type: 'LSN_UPDATE', lsn: serverLSN, source: 'initial_sync_completion' })
        }
        
        // Handle catchup phase completion
        if (message.type === 'srv_catchup_complete') {
          syncLogger.info('sync', 'Catchup sync completed by server')
          
          // Update LSN tracking
          const serverLSN = message.endLSN || message.serverLSN || message.lsn
          if (serverLSN) {
            this.currentLSN = serverLSN
            
            syncLogger.info('sync', `Updated LSN after catchup sync: ${this.currentLSN} (sync machine will be updated via event)`)
          }
          
          // Send acknowledgment
          const ackMessage = {
            type: 'clt_catchup_received',
            messageId: `catchup_complete_ack_${Date.now()}`,
            timestamp: Date.now(),
            clientId: this.config?.clientId,
            serverLSN: serverLSN
          }
          this.services.webSocket?.send(ackMessage)
          syncLogger.info('sync', 'Sent acknowledgment: clt_catchup_received')
          
          eventHandler({ type: 'CATCHUP_SYNC_COMPLETE', serverLSN: serverLSN })
        }
        
        // Forward to sync machine
        eventHandler({ type: 'WS_MESSAGE', message })
      },
      
      onError: (error: Error) => {
        syncLogger.serviceError('WebSocket', error)
        eventHandler({ type: 'WS_ERROR', error })
      }
    })

    // LiveStore sync service callbacks
    this.services.liveStoreSync.setCallbacks({
      onOutgoingChange: (change: any) => {
        syncLogger.serviceCallback('LiveStoreSync', 'outgoingChange', { 
          table: change.table,
          operation: change.operation 
        })
      },
      
      onIncomingChangesProcessed: (changes: any[], results: any[]) => {
        syncLogger.serviceCallback('LiveStoreSync', 'incomingChangesProcessed', { 
          changeCount: changes.length,
          resultCount: results.length 
        })
        eventHandler({ type: 'INCOMING_CHANGES_PROCESSED', results })
      },
      
      onSyncError: (error: Error, context?: string) => {
        syncLogger.serviceError('LiveStoreSync', error, context)
        eventHandler({ type: 'SERVICE_ERROR', service: 'liveStoreSync', error })
      },
      
      onSyncProgress: (sent: number, total: number) => {
        syncLogger.serviceCallback('LiveStoreSync', 'progress', { sent, total })
      }
    })

    syncLogger.serviceInitialized('PureLiveStoreCallbacks', {
      webSocket: true,
      liveStoreSync: true,
      eventHandler: !!this.eventHandler
    })
  }

  /**
   * Handle incoming changes through pure LiveStore sync
   */
  private async handleIncomingChanges(changes: any[], messageType: string) {
    if (!this.services.liveStoreSync) {
      syncLogger.serviceError('LiveStoreSync', new Error('Sync service not available'), 'incoming_changes')
      return
    }

    try {
      await this.services.liveStoreSync.processIncomingChanges(changes, messageType)
    } catch (error) {
      syncLogger.serviceError('LiveStoreSync', error as Error, 'incoming_changes')
    }
  }

  /**
   * Get services - pure LiveStore implementation
   */
  getServices(): PureLiveStoreServices | null {
    if (!this.services.webSocket || !this.services.liveStoreSync || !this.services.liveStore) {
      return null
    }

    return {
      webSocket: this.services.webSocket,
      liveStoreSync: this.services.liveStoreSync,
      liveStore: this.services.liveStore
    }
  }

  /**
   * Update configuration for all services
   */
  updateConfig(updates: Partial<PureLiveStoreCoordinatorConfig>): void {
    if (!this.config) {
      throw new Error('PureLiveStoreServiceCoordinator not initialized')
    }

    this.config = { ...this.config, ...updates }
    
    syncLogger.info('service', 'Updated PureLiveStoreServiceCoordinator configuration', updates)

    // Update WebSocket service configuration if needed
    if (this.services.webSocket && (updates.clientId || updates.currentLSN)) {
      this.services.webSocket.updateConnectionParams(
        updates.clientId || this.config.clientId,
        updates.currentLSN || this.config.currentLSN
      )
    }

    // Handle organization switching
    if (updates.organizationId && updates.organizationId !== this.config.organizationId) {
      this.handleOrganizationSwitch(updates.organizationId)
    }
  }

  /**
   * Handle switching to different organization
   */
  private async handleOrganizationSwitch(newOrgId: string): Promise<void> {
    if (!this.config) return

    const currentOrgId = this.config.organizationId
    
    syncLogger.info('service', 'Switching LiveStore organization', {
      from: currentOrgId,
      to: newOrgId
    })

    try {
      // Destroy current sync services
      if (this.services.liveStoreSync) {
        this.services.liveStoreSync.destroy()
        this.services.liveStoreSync = null
      }

      // Switch LiveStore instance
      this.services.liveStore = await liveStoreSchemaClient.switchOrganization(
        currentOrgId,
        newOrgId,
        this.config.clientId
      )

      // Update config
      this.config.organizationId = newOrgId

      // Reinitialize sync services for new organization
      if (this.services.liveStore && this.services.webSocket) {
        await this.initializeLiveStoreSync(this.config)
      }

      syncLogger.info('service', 'Organization switch completed', {
        newOrganizationId: newOrgId
      })

    } catch (error) {
      syncLogger.serviceError('PureLiveStoreServiceCoordinator', error as Error, 'organization_switch')
      throw error
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): { [serviceName: string]: boolean } {
    return {
      webSocket: !!this.services.webSocket,
      liveStoreSync: !!this.services.liveStoreSync,
      liveStore: !!this.services.liveStore,
      coordinator: !!this.config,
      pure: true // Indicates this is pure LiveStore (no Dexie)
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats(): any {
    const health = this.getHealthStatus()
    
    return {
      coordinator: {
        initialized: !!this.config,
        pure: true, // No Dexie dependencies
        type: 'PureLiveStoreServiceCoordinator',
        config: this.config ? {
          clientId: this.config.clientId,
          organizationId: this.config.organizationId,
          serverUrl: this.config.serverUrl
        } : null
      },
      services: health,
      liveStore: {
        available: !!this.services.liveStore,
        organizationId: this.config?.organizationId,
        ready: !!this.services.liveStore
      }
    }
  }

  /**
   * Trigger manual sync for testing
   */
  async triggerManualSync(): Promise<void> {
    if (this.services.liveStoreSync) {
      // LiveStore sync handles this automatically through subscriptions
      syncLogger.info('service', 'Manual sync triggered - LiveStore handles automatically')
    } else {
      syncLogger.info('service', 'LiveStore sync not available for manual trigger')
    }
  }

  /**
   * Destroy/cleanup all services
   */
  destroy(): void {
    syncLogger.info('service', 'PureLiveStoreServiceCoordinator destroying all services...')

    if (this.services.webSocket) {
      try {
        this.services.webSocket.destroy()
        syncLogger.info('service', 'WebSocket service destroyed')
      } catch (error) {
        syncLogger.serviceError('WebSocket', error as Error, 'destruction')
      }
    }

    if (this.services.liveStoreSync) {
      try {
        this.services.liveStoreSync.destroy()
        syncLogger.info('service', 'LiveStore sync service destroyed')
      } catch (error) {
        syncLogger.serviceError('LiveStoreSync', error as Error, 'destruction')
      }
    }

    if (this.services.liveStore && this.config) {
      try {
        liveStoreSchemaClient.closeLiveStore(this.config.organizationId)
        syncLogger.info('service', 'LiveStore instance closed')
      } catch (error) {
        syncLogger.serviceError('LiveStore', error as Error, 'destruction')
      }
    }

    // Clear references
    this.services = {
      webSocket: null,
      liveStoreSync: null,
      liveStore: null
    }

    this.config = null
    this.eventHandler = null

    syncLogger.serviceInitialized('PureLiveStoreServiceCoordinator', { destroyed: true, pure: true })
  }
}

/**
 * Factory function to create pure LiveStore ServiceCoordinator
 */
export async function createPureLiveStoreServiceCoordinator(): Promise<PureLiveStoreServiceCoordinator> {
  return new PureLiveStoreServiceCoordinator()
}

// Type compatibility with existing ServiceCoordinator interface
export interface Services extends PureLiveStoreServices {}
export interface ServiceCoordinatorConfig extends PureLiveStoreCoordinatorConfig {}

export default PureLiveStoreServiceCoordinator