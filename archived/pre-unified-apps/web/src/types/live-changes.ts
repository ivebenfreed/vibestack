/**
 * Live Changes Manager Types
 * 
 * Centralized type definitions for the background live changes system
 */

// Basic change operations from PGlite
export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE'

// Raw change event from PGlite live changes
export interface ChangeEvent {
  __op__: ChangeOperation
  __changed_columns__?: string[]
  __after__?: any
  [key: string]: any // Dynamic fields based on table columns
}

// Atom actions interface that entities must implement
export interface AtomActions {
  // Load initial data (bulk)
  loadItems?: (items: any[]) => void
  
  // Update single item (INSERT/UPDATE)
  updateItem: (id: string, updates: Partial<any>) => void
  
  // Remove single item (DELETE)  
  removeItem: (id: string) => void
  
  // Optional: Check if item exists (for smart processing)
  hasItem?: (id: string) => boolean
}

// Entity configuration for live changes
export interface EntityConfig {
  // TypeORM entity class
  entity: any
  
  // Atom actions for this entity
  atomActions: AtomActions
  
  // Optional: Custom primary key field name (defaults to 'id')
  primaryKey?: string
  
  // Optional: Custom table name (defaults to entity metadata)
  tableName?: string
}

// Live changes manager status
export type LiveChangesStatus = 'initializing' | 'active' | 'error' | 'stopped'

// Custom error for live changes failures
export class LiveChangesError extends Error {
  constructor(
    message: string,
    public readonly actions?: {
      retry?: () => Promise<void>
      refresh?: () => void
    }
  ) {
    super(message)
    this.name = 'LiveChangesError'
  }
}

// Internal subscription tracking
export interface LiveChangesSubscription {
  entityName: string
  tableName: string
  unsubscribe: () => Promise<void>
  config: EntityConfig
} 