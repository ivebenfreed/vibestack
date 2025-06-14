import { useCallback } from 'react'
import { toast } from 'sonner'
import { ObjectLiteral } from 'typeorm'

export interface EntityService<T extends ObjectLiteral> {
  update?: (id: string, data: Partial<T>) => Promise<T>
  delete?: (id: string) => Promise<void>
  create?: (data: Partial<T>) => Promise<T>
  bulkUpdate?: (ids: string[], data: Partial<T>) => Promise<void>
  bulkDelete?: (ids: string[]) => Promise<void>
}

export interface EntityOperationsCallbacks<T> {
  onEntityCreated?: (entity: T) => void
  onEntityUpdated?: (entity: T) => void
  onEntityDeleted?: (id: string) => void
}

/**
 * Hook for entity operations - extracted from UniversalEntityTable
 * Provides clean, reusable operation handlers for bulk editing modules
 */
export function useEntityOperations<T extends ObjectLiteral>(
  entityService: EntityService<T> | undefined,
  entityType: string,
  callbacks: EntityOperationsCallbacks<T> = {}
) {
  const { onEntityCreated, onEntityUpdated, onEntityDeleted } = callbacks

  // Single entity operations
  const handleUpdate = useCallback(async (rowId: string, columnId: string, value: any): Promise<void> => {
    if (!entityService?.update) return
    
    const updateData = { [columnId]: value } as Partial<T>
    const updatedEntity = await entityService.update(rowId, updateData)
    onEntityUpdated?.(updatedEntity)
  }, [entityService?.update, onEntityUpdated])

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    if (!entityService?.delete) return
    await entityService.delete(id)
    onEntityDeleted?.(id)
  }, [entityService?.delete, onEntityDeleted])

  const handleCreate = useCallback(async (data: Partial<T>): Promise<T | undefined> => {
    if (!entityService?.create) return
    const newEntity = await entityService.create(data)
    onEntityCreated?.(newEntity)
    return newEntity
  }, [entityService?.create, onEntityCreated])

  // Bulk operations
  const handleBulkDelete = useCallback(async (selectedIds: string[]): Promise<void> => {
    if (selectedIds.length === 0) return

    try {
      if (entityService?.bulkDelete) {
        await entityService.bulkDelete(selectedIds)
      } else if (entityService?.delete) {
        await Promise.allSettled(selectedIds.map(id => entityService.delete!(id)))
      } else {
        throw new Error('No delete method available')
      }
      
      selectedIds.forEach(id => onEntityDeleted?.(id))
      toast.success(`Deleted ${selectedIds.length} ${entityType}(s)`)
    } catch (error: any) {
      toast.error(`Error deleting ${entityType}(s): ${error.message}`)
      throw error
    }
  }, [entityService?.bulkDelete, entityService?.delete, onEntityDeleted, entityType])

  const handleBulkUpdate = useCallback(async (selectedIds: string[], updates: Partial<T>): Promise<void> => {
    if (selectedIds.length === 0) return

    try {
      if (entityService?.bulkUpdate) {
        await entityService.bulkUpdate(selectedIds, updates)
      } else if (entityService?.update) {
        await Promise.allSettled(
          selectedIds.map(id => entityService.update!(id, updates))
        )
      } else {
        throw new Error('No update method available')
      }
      
      selectedIds.forEach(id => onEntityUpdated?.(id as any))
      toast.success(`Updated ${selectedIds.length} ${entityType}(s)`)
    } catch (error: any) {
      toast.error(`Error updating ${entityType}(s): ${error.message}`)
      throw error
    }
  }, [entityService?.bulkUpdate, entityService?.update, onEntityUpdated, entityType])

  return {
    // Single operations
    handleUpdate,
    handleDelete,
    handleCreate,
    // Bulk operations
    handleBulkDelete,
    handleBulkUpdate,
    // Service availability checks
    canCreate: !!entityService?.create,
    canUpdate: !!entityService?.update,
    canDelete: !!entityService?.delete,
    canBulkUpdate: !!(entityService?.bulkUpdate || entityService?.update),
    canBulkDelete: !!(entityService?.bulkDelete || entityService?.delete),
  }
}

/**
 * Enhanced bulk actions component that handles its own operations
 * No need to pass handlers from parent - self-sufficient!
 */
export interface EntityBulkActionsProps<T extends ObjectLiteral> {
  entityType: string
  entityService: EntityService<T>
  selectedIds: string[]
  selectedEntities: T[]
  onClearSelection: () => void
  callbacks?: EntityOperationsCallbacks<T>
  customActions?: Array<{
    id: string
    label: string
    icon?: React.ComponentType<any>
    action: (selectedIds: string[], entities: T[]) => Promise<void>
    variant?: 'default' | 'destructive' | 'outline'
    confirmMessage?: string
  }>
  isLoading?: boolean
}

/**
 * Enhanced bulk edit component that handles its own operations  
 * No need to pass handlers from parent - self-sufficient!
 */
export interface EntityBulkEditProps<T extends ObjectLiteral> {
  entityType: string
  entityService: EntityService<T>
  selectedIds: string[]
  callbacks?: EntityOperationsCallbacks<T>
  fields?: Array<{
    key: string
    label: string
    type: 'enum' | 'text' | 'number' | 'boolean' | 'date' | 'relationship'
    options?: { label: string; value: string }[]
  }>
  isLoading?: boolean
} 