import { useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import type { EntityService } from '../core/table-types'

export interface EntityOperationsConfig {
  entityType: string
  onEntityCreated?: (entity: any) => void
  onEntityUpdated?: (entity: any) => void 
  onEntityDeleted?: (entityId: string) => void
}

export interface EntityOperations<T = any> {
  // Create operations
  canCreate: boolean
  handleCreate: (data: Partial<T>) => Promise<T>
  
  // Update operations
  canUpdate: boolean
  handleUpdate: (entityId: string, updates: Partial<T>) => Promise<T>
  
  // Delete operations
  canDelete: boolean
  handleDelete: (entityId: string) => Promise<void>
  
  // Bulk operations
  canBulkUpdate: boolean
  canBulkDelete: boolean
  handleBulkUpdate: (entityIds: string[], updates: Partial<T>) => Promise<T[]>
  handleBulkDelete: (entityIds: string[]) => Promise<void>
}

/**
 * Universal Entity Operations Hook
 * 
 * Provides CRUD operations for any entity type with:
 * - ✅ Performance: Memoized callbacks prevent re-renders
 * - ✅ Error handling: Toast notifications with proper error messages
 * - ✅ Type safety: Generic type support
 * - ✅ Flexible: Works with any service that implements EntityService interface
 * - ✅ Optimistic: Can handle optimistic updates (service-dependent)
 */
export function useEntityOperations<T extends { id: string }>(
  service: EntityService<T> | undefined,
  entityType: string,
  callbacks?: {
    onEntityCreated?: (entity: T) => void
    onEntityUpdated?: (entity: T) => void
    onEntityDeleted?: (entityId: string) => void
  }
): EntityOperations<T> {
  // ✅ Memoize capability checks to prevent re-computations
  const capabilities = useMemo(() => ({
    canCreate: Boolean(service?.create),
    canUpdate: Boolean(service?.update), 
    canDelete: Boolean(service?.delete),
    canBulkUpdate: Boolean(service?.bulkUpdate),
    canBulkDelete: Boolean(service?.bulkDelete),
  }), [service])

  // ✅ Memoized CRUD operations with proper error handling
  const handleCreate = useCallback(async (data: Partial<T>): Promise<T> => {
    if (!service?.create) {
      throw new Error(`Create operation not available for ${entityType}`)
    }

    try {
      const entity = await service.create(data)
      
      // Success feedback
      toast.success(`${entityType} created successfully`)
      
      // Callback notification
      callbacks?.onEntityCreated?.(entity)
      
      return entity
    } catch (error: any) {
      const message = error.message || `Failed to create ${entityType}`
      toast.error(message)
      throw error
    }
  }, [service, entityType, callbacks?.onEntityCreated])

  const handleUpdate = useCallback(async (entityId: string, updates: Partial<T>): Promise<T> => {
    if (!service?.update) {
      throw new Error(`Update operation not available for ${entityType}`)
    }

    try {
      const entity = await service.update(entityId, updates)
      
      // Success feedback
      toast.success(`${entityType} updated successfully`) 
      
      // Callback notification
      callbacks?.onEntityUpdated?.(entity)
      
      return entity
    } catch (error: any) {
      const message = error.message || `Failed to update ${entityType}`
      toast.error(message)
      throw error
    }
  }, [service, entityType, callbacks?.onEntityUpdated])

  const handleDelete = useCallback(async (entityId: string): Promise<void> => {
    if (!service?.delete) {
      throw new Error(`Delete operation not available for ${entityType}`)
    }

    try {
      await service.delete(entityId)
      
      // Success feedback
      toast.success(`${entityType} deleted successfully`)
      
      // Callback notification
      callbacks?.onEntityDeleted?.(entityId)
    } catch (error: any) {
      const message = error.message || `Failed to delete ${entityType}`
      toast.error(message)
      throw error
    }
  }, [service, entityType, callbacks?.onEntityDeleted])

  const handleBulkUpdate = useCallback(async (entityIds: string[], updates: Partial<T>): Promise<T[]> => {
    if (!service?.bulkUpdate) {
      throw new Error(`Bulk update operation not available for ${entityType}`)
    }

    try {
      const entities = await service.bulkUpdate(entityIds, updates)
      
      // Success feedback
      toast.success(`${entityIds.length} ${entityType}(s) updated successfully`)
      
      // Individual callback notifications
      entities.forEach(entity => callbacks?.onEntityUpdated?.(entity))
      
      return entities
    } catch (error: any) {
      const message = error.message || `Failed to bulk update ${entityType}(s)`
      toast.error(message)
      throw error
    }
  }, [service, entityType, callbacks?.onEntityUpdated])

  const handleBulkDelete = useCallback(async (entityIds: string[]): Promise<void> => {
    if (!service?.bulkDelete) {
      throw new Error(`Bulk delete operation not available for ${entityType}`)
    }

    try {
      await service.bulkDelete(entityIds)
      
      // Success feedback
      toast.success(`${entityIds.length} ${entityType}(s) deleted successfully`)
      
      // Individual callback notifications
      entityIds.forEach(id => callbacks?.onEntityDeleted?.(id))
    } catch (error: any) {
      const message = error.message || `Failed to bulk delete ${entityType}(s)`
      toast.error(message)
      throw error
    }
  }, [service, entityType, callbacks?.onEntityDeleted])

  // ✅ Return memoized operations object to prevent re-renders
  return useMemo(() => ({
    // Capabilities
    ...capabilities,
    
    // CRUD operations
    handleCreate,
    handleUpdate,
    handleDelete,
    
    // Bulk operations
    handleBulkUpdate,
    handleBulkDelete,
  }), [
    capabilities,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleBulkUpdate,
    handleBulkDelete,
  ])
} 