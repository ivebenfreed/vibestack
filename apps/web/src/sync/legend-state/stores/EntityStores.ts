/**
 * Entity Stores for VibeStack Legend State Integration
 * 
 * Observable stores for all business entity tables with persistence,
 * real-time sync, and optimistic updates.
 */

import { observable, type Observable } from '@legendapp/state'
import { syncLogger } from '../../utils/SyncLogger'
import { PersistenceManager } from '../persistence/PersistenceManager'
import { getVibeStackSync } from '../VibeStackSyncPlugin'

// ============ Entity Type Definitions ============

export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
  // Additional common fields can be added here
}

export interface Project extends BaseEntity {
  name: string
  description?: string
  status?: string
  priority?: string
  start_date?: string
  end_date?: string
  budget?: number
  // Add other project-specific fields
}

export interface Client extends BaseEntity {
  name: string
  email?: string
  company?: string
  phone?: string
  address?: string
  // Add other client-specific fields
}

export interface Task extends BaseEntity {
  title: string
  description?: string
  status?: string
  priority?: string
  assignee_id?: string
  project_id?: string
  due_date?: string
  // Add other task-specific fields
}

export interface Document extends BaseEntity {
  name: string
  description?: string
  file_path?: string
  file_size?: number
  mime_type?: string
  project_id?: string
  // Add other document-specific fields
}

export interface Meeting extends BaseEntity {
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  attendees?: string[]
  project_id?: string
  // Add other meeting-specific fields
}

export interface Invoice extends BaseEntity {
  invoice_number: string
  client_id: string
  project_id?: string
  amount: number
  status: string
  due_date: string
  issued_date: string
  // Add other invoice-specific fields
}

export interface Expense extends BaseEntity {
  description: string
  amount: number
  category: string
  date: string
  project_id?: string
  receipt_url?: string
  // Add other expense-specific fields
}

export interface Timesheet extends BaseEntity {
  user_id: string
  project_id?: string
  hours: number
  date: string
  description?: string
  billable: boolean
  // Add other timesheet-specific fields
}

export interface Contract extends BaseEntity {
  title: string
  client_id: string
  project_id?: string
  start_date: string
  end_date?: string
  value: number
  status: string
  // Add other contract-specific fields
}

export interface Proposal extends BaseEntity {
  title: string
  client_id: string
  description?: string
  value: number
  status: string
  submitted_date: string
  // Add other proposal-specific fields
}

export interface Resource extends BaseEntity {
  name: string
  type: string
  description?: string
  availability: boolean
  cost_per_hour?: number
  // Add other resource-specific fields
}

export interface Skill extends BaseEntity {
  name: string
  description?: string
  category: string
  level: string
  // Add other skill-specific fields
}

export interface Certification extends BaseEntity {
  name: string
  description?: string
  issuer: string
  issued_date: string
  expiry_date?: string
  skill_id?: string
  // Add other certification-specific fields
}

// ============ Store Collections ============

export interface EntityCollections {
  projects: Observable<Record<string, Project>>
  clients: Observable<Record<string, Client>>
  documents: Observable<Record<string, Document>>
  meetings: Observable<Record<string, Meeting>>
  invoices: Observable<Record<string, Invoice>>
  expenses: Observable<Record<string, Expense>>
  timesheets: Observable<Record<string, Timesheet>>
  contracts: Observable<Record<string, Contract>>
  proposals: Observable<Record<string, Proposal>>
  resources: Observable<Record<string, Resource>>
  skills: Observable<Record<string, Skill>>
  certifications: Observable<Record<string, Certification>>
}

// ============ Entity Store Manager ============

export class EntityStoreManager {
  private organizationId: string
  private userId: string
  private persistenceManager: PersistenceManager
  private stores: EntityCollections
  private isInitialized = false
  
  constructor(organizationId: string, userId: string) {
    this.organizationId = organizationId
    this.userId = userId
    this.persistenceManager = new PersistenceManager(organizationId, userId)
    
    // Initialize all entity stores
    this.stores = this.createEntityStores()
    
    syncLogger.info('entity-stores', 'EntityStoreManager created', {
      organizationId,
      userId,
      storeCount: Object.keys(this.stores).length
    })
  }
  
  /**
   * Initialize all entity stores with persistence and sync
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      syncLogger.warn('entity-stores', 'EntityStoreManager already initialized')
      return
    }
    
    try {
      // Register all tables with the sync plugin
      await this.registerTablesWithSyncPlugin()
      
      // Load initial data from persistence
      await this.loadPersistedData()
      
      this.isInitialized = true
      syncLogger.info('entity-stores', '✅ EntityStoreManager initialized successfully')
      
    } catch (error) {
      syncLogger.error('entity-stores', 'Failed to initialize EntityStoreManager', { error })
      throw error
    }
  }
  
  /**
   * Create all entity stores with persistence
   */
  private createEntityStores(): EntityCollections {
    const stores: EntityCollections = {
      projects: this.createPersistentStore<Project>('project'),
      clients: this.createPersistentStore<Client>('client'),
      documents: this.createPersistentStore<Document>('document'),
      meetings: this.createPersistentStore<Meeting>('meeting'),
      invoices: this.createPersistentStore<Invoice>('invoice'),
      expenses: this.createPersistentStore<Expense>('expense'),
      timesheets: this.createPersistentStore<Timesheet>('timesheet'),
      contracts: this.createPersistentStore<Contract>('contract'),
      proposals: this.createPersistentStore<Proposal>('proposal'),
      resources: this.createPersistentStore<Resource>('resource'),
      skills: this.createPersistentStore<Skill>('skill'),
      certifications: this.createPersistentStore<Certification>('certification')
    }
    
    syncLogger.info('entity-stores', 'Created all entity stores', {
      storeNames: Object.keys(stores)
    })
    
    return stores
  }
  
  /**
   * Create a persistent store for an entity type
   */
  private createPersistentStore<T extends BaseEntity>(tableName: string): Observable<Record<string, T>> {
    const store$ = observable<Record<string, T>>({})
    
    // Make it persistent using the persistence manager
    const persistentStore = this.persistenceManager.createPersistentObservable(
      store$,
      tableName,
      {
        local: {
          name: `${this.organizationId}_${tableName}`,
          transform: {
            // Transform data before saving/loading if needed
            save: (data: Record<string, T>) => data,
            load: (data: Record<string, T>) => data || {}
          }
        }
      }
    )
    
    syncLogger.debug('entity-stores', `Created persistent store for: ${tableName}`)
    return persistentStore
  }
  
  /**
   * Register all tables with the sync plugin
   */
  private async registerTablesWithSyncPlugin(): Promise<void> {
    const syncPlugin = getVibeStackSync()
    if (!syncPlugin) {
      throw new Error('VibeStack Sync Plugin not initialized')
    }
    
    const tableNames = Object.keys(this.stores) as (keyof EntityCollections)[]
    
    for (const tableName of tableNames) {
      syncPlugin.registerTable({
        tableName: tableName as string,
        apiEndpoint: `/api/orgs/${this.organizationId}/entities/${tableName}`,
        primaryKey: 'id',
        enableRealTimeSync: true,
        enablePersistence: true,
        conflictResolution: 'server-wins'
      })
    }
    
    syncLogger.info('entity-stores', 'Registered all tables with sync plugin', {
      tableCount: tableNames.length,
      tables: tableNames
    })
  }
  
  /**
   * Load persisted data for all stores
   */
  private async loadPersistedData(): Promise<void> {
    const tableNames = Object.keys(this.stores)
    
    for (const tableName of tableNames) {
      try {
        await this.persistenceManager.loadSyncState(tableName)
        syncLogger.debug('entity-stores', `Loaded persisted data for: ${tableName}`)
      } catch (error) {
        syncLogger.error('entity-stores', `Failed to load persisted data for: ${tableName}`, { error })
      }
    }
  }
  
  /**
   * Get all entity stores
   */
  public getStores(): EntityCollections {
    return this.stores
  }
  
  /**
   * Get a specific store by name
   */
  public getStore<K extends keyof EntityCollections>(storeName: K): EntityCollections[K] {
    return this.stores[storeName]
  }
  
  /**
   * Add entity to a store with optimistic update
   */
  public async addEntity<T extends BaseEntity>(
    storeName: keyof EntityCollections,
    entity: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<void> {
    try {
      const store = this.stores[storeName] as Observable<Record<string, T>>
      
      // Generate temporary ID for optimistic update
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      const now = new Date().toISOString()
      
      const optimisticEntity: T = {
        ...entity,
        id: tempId,
        created_at: now,
        updated_at: now
      } as T
      
      // Optimistic update
      store[tempId].set(optimisticEntity)
      
      syncLogger.info('entity-stores', `Added entity optimistically to: ${String(storeName)}`, {
        tempId,
        entity: optimisticEntity
      })
      
      // TODO: Make API call to persist on server
      // This will be implemented when we create the sync adapter
      
    } catch (error) {
      syncLogger.error('entity-stores', `Failed to add entity to: ${String(storeName)}`, { error })
      throw error
    }
  }
  
  /**
   * Update entity in store with optimistic update
   */
  public async updateEntity<T extends BaseEntity>(
    storeName: keyof EntityCollections,
    entityId: string,
    updates: Partial<T>
  ): Promise<void> {
    try {
      const store = this.stores[storeName] as Observable<Record<string, T>>
      const currentEntity = store[entityId].get()
      
      if (!currentEntity) {
        throw new Error(`Entity ${entityId} not found in ${String(storeName)}`)
      }
      
      const updatedEntity: T = {
        ...currentEntity,
        ...updates,
        updated_at: new Date().toISOString()
      }
      
      // Optimistic update
      store[entityId].set(updatedEntity)
      
      syncLogger.info('entity-stores', `Updated entity optimistically in: ${String(storeName)}`, {
        entityId,
        updates
      })
      
      // TODO: Make API call to persist on server
      
    } catch (error) {
      syncLogger.error('entity-stores', `Failed to update entity in: ${String(storeName)}`, { error })
      throw error
    }
  }
  
  /**
   * Delete entity from store with optimistic update
   */
  public async deleteEntity(
    storeName: keyof EntityCollections,
    entityId: string
  ): Promise<void> {
    try {
      const store = this.stores[storeName] as Observable<Record<string, any>>
      
      // Optimistic delete
      store[entityId].delete()
      
      syncLogger.info('entity-stores', `Deleted entity optimistically from: ${String(storeName)}`, {
        entityId
      })
      
      // TODO: Make API call to delete on server
      
    } catch (error) {
      syncLogger.error('entity-stores', `Failed to delete entity from: ${String(storeName)}`, { error })
      throw error
    }
  }
  
  /**
   * Get store statistics
   */
  public getStats() {
    const stats: Record<string, any> = {}
    
    for (const [storeName, store] of Object.entries(this.stores)) {
      const data = store.get()
      stats[storeName] = {
        count: Object.keys(data).length,
        lastUpdated: Math.max(...Object.values(data).map((entity: any) => 
          new Date(entity.updated_at || 0).getTime()
        ))
      }
    }
    
    return {
      organizationId: this.organizationId,
      userId: this.userId,
      isInitialized: this.isInitialized,
      stores: stats,
      totalEntities: Object.values(stats).reduce((sum, store) => sum + store.count, 0)
    }
  }
}

// ============ Global Store Manager ============

let globalStoreManager: EntityStoreManager | null = null

/**
 * Initialize global entity store manager
 */
export function initializeEntityStores(organizationId: string, userId: string): EntityStoreManager {
  if (globalStoreManager && globalStoreManager.getStats().organizationId === organizationId) {
    syncLogger.warn('entity-stores', 'EntityStoreManager already exists for this organization')
    return globalStoreManager
  }
  
  globalStoreManager = new EntityStoreManager(organizationId, userId)
  return globalStoreManager
}

/**
 * Get global entity store manager
 */
export function getEntityStores(): EntityStoreManager | null {
  return globalStoreManager
}

/**
 * Reset global store manager (useful for logout)
 */
export function resetEntityStores(): void {
  globalStoreManager = null
  syncLogger.info('entity-stores', 'Global entity store manager reset')
}