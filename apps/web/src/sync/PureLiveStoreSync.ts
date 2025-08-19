/**
 * Pure LiveStore Sync Services - Complete Dexie Replacement
 * 
 * Replaces DexieOutgoingChangeService, DexieIntegrityService, and IncomingChangeService
 * with pure LiveStore implementations that use native LiveStore capabilities.
 */

import { createLiveStoreNativeSync, type LiveStoreNativeSync } from '../lib/livestore-native-sync'
import { liveStoreSchemaClient } from '../lib/livestore-schema-client'
import type { WebSocketService } from './WebSocketService'
import type { TableChange } from '@repo/sync-types'
import { syncLogger } from './utils/SyncLogger'

export interface PureLiveStoreSyncConfig {
  organizationId: string
  clientId: string
  userId: string
  webSocketService: WebSocketService
}

export interface PureLiveStoreSyncCallbacks {
  onOutgoingChange?: (change: TableChange) => void
  onIncomingChangesProcessed?: (changes: TableChange[], results: any[]) => void
  onSyncError?: (error: Error, context?: string) => void
  onSyncProgress?: (sent: number, total: number) => void
}

/**
 * Pure LiveStore Outgoing Sync Service
 * Replaces DexieOutgoingChangeService with native LiveStore subscriptions
 */
export class LiveStoreOutgoingService {
  private subscriptions: Map<string, () => void> = new Map()
  private callbacks: PureLiveStoreSyncCallbacks = {}

  constructor(
    private config: PureLiveStoreSyncConfig
  ) {}

  setCallbacks(callbacks: PureLiveStoreSyncCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  async initialize() {
    syncLogger.info('service', 'Initializing pure LiveStore outgoing service', {
      organizationId: this.config.organizationId
    })

    try {
      const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(this.config.organizationId)
      const orgSchema = await liveStoreSchemaClient.getOrgSchema(this.config.organizationId)

      if (!liveStoreInstance || !orgSchema) {
        throw new Error('LiveStore or schema not available')
      }

      // Subscribe to ALL entity tables for this organization
      const entities = Object.keys(orgSchema.entities || {})
      
      for (const entityName of entities) {
        await this.subscribeToEntity(liveStoreInstance, entityName)
      }

      syncLogger.info('service', `LiveStore outgoing service initialized for ${entities.length} entities`)

    } catch (error) {
      syncLogger.serviceError('LiveStoreOutgoing', error as Error, 'initialization')
      throw error
    }
  }

  private async subscribeToEntity(liveStoreInstance: any, entityName: string) {
    const tableName = `org_${this.config.organizationId}_${entityName}`
    
    syncLogger.info('service', `Setting up LiveStore subscription for: ${tableName}`)

    const unsubscribe = liveStoreInstance.store.subscribe(tableName, (changes: any[]) => {
      this.handleNativeChange(entityName, tableName, changes)
    })

    this.subscriptions.set(entityName, unsubscribe)
  }

  private async handleNativeChange(entityName: string, tableName: string, changes: any[]) {
    try {
      syncLogger.info('sync', `LiveStore change detected for ${entityName}:`, changes.length, 'records')

      for (const record of changes) {
        const tableChange = await this.convertToTableChange(entityName, tableName, record)
        
        if (tableChange) {
          // Send directly via WebSocket
          await this.sendChangeToServer(tableChange)
          
          // Notify callback
          this.callbacks.onOutgoingChange?.(tableChange)
        }
      }

    } catch (error) {
      syncLogger.serviceError('LiveStoreOutgoing', error as Error, `change_handling_${entityName}`)
      this.callbacks.onSyncError?.(error as Error, `outgoing_${entityName}`)
    }
  }

  private async convertToTableChange(entityName: string, tableName: string, record: any): Promise<TableChange | null> {
    try {
      // Determine operation type based on record state
      const operation = this.determineOperation(record)
      
      const tableChange: TableChange = {
        id: `change_${Date.now()}_${record.id}_${Math.random().toString(36).substring(7)}`,
        table: tableName.replace(`org_${this.config.organizationId}_`, ''), // Clean table name
        entity_id: record.id,
        operation,
        changes: this.formatChangeData(operation, record),
        organization_id: this.config.organizationId,
        created_at: new Date().toISOString(),
        synced: false,
        client_id: this.config.clientId,
        user_id: this.config.userId,
        lsn: null // Will be set by server
      }

      return tableChange

    } catch (error) {
      syncLogger.serviceError('LiveStoreOutgoing', error as Error, 'change_conversion')
      return null
    }
  }

  private determineOperation(record: any): 'insert' | 'update' | 'delete' {
    // LiveStore provides current state, determine operation based on timestamps
    if (!record.created_at) {
      return 'delete' // Likely a deletion
    }
    
    if (record.created_at === record.updated_at) {
      return 'insert' // Just created
    }
    
    return 'update' // Modified
  }

  private formatChangeData(operation: string, record: any): any {
    switch (operation) {
      case 'insert':
        return {
          type: 'insert',
          data: record
        }
      
      case 'update':
        return {
          type: 'update',
          data: record,
          // TODO: Include old data when available from LiveStore events
          oldData: null
        }
      
      case 'delete':
        return {
          type: 'delete',
          id: record.id
        }
      
      default:
        return { type: operation, data: record }
    }
  }

  private async sendChangeToServer(change: TableChange) {
    try {
      const message = {
        type: 'clt_send_changes',
        messageId: Date.now().toString(),
        changes: [change],
        clientId: this.config.clientId,
        organizationId: this.config.organizationId,
        timestamp: Date.now()
      }

      syncLogger.info('sync', `Sending change to server: ${change.operation} ${change.table}:${change.entity_id}`)
      
      this.config.webSocketService.send(message)

    } catch (error) {
      syncLogger.serviceError('LiveStoreOutgoing', error as Error, 'send_to_server')
      throw error
    }
  }

  destroy() {
    syncLogger.info('service', 'Destroying LiveStore outgoing service')
    
    // Unsubscribe from all entity tables
    this.subscriptions.forEach((unsubscribe, entityName) => {
      try {
        unsubscribe()
        syncLogger.info('service', `Unsubscribed from ${entityName}`)
      } catch (error) {
        syncLogger.serviceError('LiveStoreOutgoing', error as Error, `unsubscribe_${entityName}`)
      }
    })
    
    this.subscriptions.clear()
  }
}

/**
 * Pure LiveStore Incoming Sync Service
 * Replaces IncomingChangeService with LiveStore mutations
 */
export class LiveStoreIncomingService {
  private nativeSync: LiveStoreNativeSync | null = null
  private callbacks: PureLiveStoreSyncCallbacks = {}

  constructor(
    private config: PureLiveStoreSyncConfig
  ) {}

  setCallbacks(callbacks: PureLiveStoreSyncCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  async initialize() {
    syncLogger.info('service', 'Initializing pure LiveStore incoming service', {
      organizationId: this.config.organizationId
    })

    try {
      const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(this.config.organizationId)
      const orgSchema = await liveStoreSchemaClient.getOrgSchema(this.config.organizationId)

      if (!liveStoreInstance || !orgSchema) {
        throw new Error('LiveStore or schema not available')
      }

      // Create native sync integration
      this.nativeSync = await createLiveStoreNativeSync({
        organizationId: this.config.organizationId,
        clientId: this.config.clientId,
        userId: this.config.userId,
        store: liveStoreInstance.store,
        orgSchema,
        outgoingChangeService: null, // Not needed for incoming
        incomingChangeService: {
          onChangesReceived: (handler: Function) => {
            // We'll call handler directly in processChanges
          }
        }
      })

      syncLogger.info('service', 'LiveStore incoming service initialized')

    } catch (error) {
      syncLogger.serviceError('LiveStoreIncoming', error as Error, 'initialization')
      throw error
    }
  }

  async processChanges(changes: TableChange[], messageType: string) {
    if (!this.nativeSync) {
      throw new Error('LiveStore incoming service not initialized')
    }

    try {
      syncLogger.info('sync', `Processing ${changes.length} incoming changes (${messageType})`)

      // Apply changes using native sync (with sync mode to prevent loops)
      await this.nativeSync.applyIncomingChanges(changes)

      // Create success results
      const results = changes.map(change => ({
        change,
        success: true,
        applied: true
      }))

      // Notify callback
      this.callbacks.onIncomingChangesProcessed?.(changes, results)

      syncLogger.info('sync', `Successfully processed ${changes.length} incoming changes`)
      
      return results

    } catch (error) {
      syncLogger.serviceError('LiveStoreIncoming', error as Error, 'process_changes')
      this.callbacks.onSyncError?.(error as Error, 'incoming_changes')
      throw error
    }
  }

  destroy() {
    syncLogger.info('service', 'Destroying LiveStore incoming service')
    
    if (this.nativeSync) {
      this.nativeSync.shutdown()
      this.nativeSync = null
    }
  }
}

/**
 * Pure LiveStore Integrity Service
 * Replaces DexieIntegrityService with LiveStore validation
 */
export class LiveStoreIntegrityService {
  private callbacks: PureLiveStoreSyncCallbacks = {}

  constructor(
    private config: PureLiveStoreSyncConfig
  ) {}

  setCallbacks(callbacks: PureLiveStoreSyncCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  setMessageSender(webSocketService: WebSocketService) {
    // Store reference for sending validation requests
  }

  async validateData() {
    try {
      syncLogger.info('validation', 'Starting LiveStore data validation', {
        organizationId: this.config.organizationId
      })

      const liveStoreInstance = await liveStoreSchemaClient.getLiveStore(this.config.organizationId)
      const orgSchema = await liveStoreSchemaClient.getOrgSchema(this.config.organizationId)

      if (!liveStoreInstance || !orgSchema) {
        throw new Error('LiveStore or schema not available for validation')
      }

      // Validate each entity table
      const validationResults = []
      const entities = Object.keys(orgSchema.entitySchemas)

      for (const entityName of entities) {
        const tableName = `org_${this.config.organizationId}_${entityName}`
        const result = await this.validateEntityTable(liveStoreInstance, tableName, entityName)
        validationResults.push(result)
      }

      const isValid = validationResults.every(r => r.isValid)
      const totalIssues = validationResults.reduce((sum, r) => sum + r.issueCount, 0)

      syncLogger.info('validation', `Validation completed: ${isValid ? 'VALID' : 'INVALID'}`, {
        totalTables: entities.length,
        totalIssues
      })

      return {
        isValid,
        results: validationResults,
        totalIssues
      }

    } catch (error) {
      syncLogger.serviceError('LiveStoreIntegrity', error as Error, 'validation')
      this.callbacks.onSyncError?.(error as Error, 'validation')
      throw error
    }
  }

  private async validateEntityTable(liveStoreInstance: any, tableName: string, entityName: string) {
    try {
      // Basic validation queries
      const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`
      const duplicateQuery = `SELECT id, COUNT(*) as cnt FROM ${tableName} GROUP BY id HAVING cnt > 1`
      const orphanQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE organization_id != ?`

      const [countResult, duplicates, orphans] = await Promise.all([
        liveStoreInstance.store.query(countQuery),
        liveStoreInstance.store.query(duplicateQuery),
        liveStoreInstance.store.query(orphanQuery, [this.config.organizationId])
      ])

      const issues = []
      if (duplicates.length > 0) {
        issues.push(`${duplicates.length} duplicate IDs found`)
      }
      if (orphans[0]?.count > 0) {
        issues.push(`${orphans[0].count} records with wrong organization_id`)
      }

      return {
        tableName,
        entityName,
        recordCount: countResult[0]?.count || 0,
        issueCount: issues.length,
        issues,
        isValid: issues.length === 0
      }

    } catch (error) {
      return {
        tableName,
        entityName,
        recordCount: 0,
        issueCount: 1,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        isValid: false
      }
    }
  }

  destroy() {
    syncLogger.info('service', 'LiveStore integrity service destroyed')
  }
}

/**
 * Unified Pure LiveStore Sync Service
 * Combines outgoing, incoming, and integrity services
 */
export class PureLiveStoreSync {
  private outgoing: LiveStoreOutgoingService
  private incoming: LiveStoreIncomingService
  private integrity: LiveStoreIntegrityService

  constructor(config: PureLiveStoreSyncConfig) {
    this.outgoing = new LiveStoreOutgoingService(config)
    this.incoming = new LiveStoreIncomingService(config)
    this.integrity = new LiveStoreIntegrityService(config)
  }

  async initialize() {
    syncLogger.info('service', 'Initializing unified pure LiveStore sync')
    
    await Promise.all([
      this.outgoing.initialize(),
      this.incoming.initialize()
    ])
    
    syncLogger.info('service', 'Unified pure LiveStore sync initialized')
  }

  setCallbacks(callbacks: PureLiveStoreSyncCallbacks) {
    this.outgoing.setCallbacks(callbacks)
    this.incoming.setCallbacks(callbacks)
    this.integrity.setCallbacks(callbacks)
  }

  // Delegate methods to individual services
  async processIncomingChanges(changes: TableChange[], messageType: string) {
    return await this.incoming.processChanges(changes, messageType)
  }

  async validateData() {
    return await this.integrity.validateData()
  }

  getServices() {
    return {
      outgoing: this.outgoing,
      incoming: this.incoming,
      integrity: this.integrity
    }
  }

  destroy() {
    syncLogger.info('service', 'Destroying unified pure LiveStore sync')
    
    this.outgoing.destroy()
    this.incoming.destroy()
    this.integrity.destroy()
  }
}

export default PureLiveStoreSync