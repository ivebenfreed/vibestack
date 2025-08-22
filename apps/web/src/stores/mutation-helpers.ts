/**
 * DEPRECATED - Legacy mutation helpers
 * 
 * This file uses old complex patterns that are being phased out.
 * With the new simplified Legend State implementation, CRUD operations
 * should be done directly on the observables:
 * 
 * // Instead of mutation helpers, use direct Legend State patterns:
 * const projects$ = getEntity$('project')
 * projects$['new-id'].set({ name: 'New Project' })
 * projects$['existing-id'].name.set('Updated Name')
 * projects$['to-delete'].delete()
 * 
 * TODO: Remove this file and update components to use direct patterns
 */

import { getEntity$ } from '@/legend-state'

export interface EntityMutationOptions {
  optimistic?: boolean
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function createEntitySchema(entityData: any, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] createEntitySchema - Use direct Legend State patterns instead')
  throw new Error('Entity schema operations should be handled through the new simplified API')
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function updateEntitySchema(recordId: string, updates: any, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] updateEntitySchema - Use direct Legend State patterns instead')
  throw new Error('Entity schema operations should be handled through the new simplified API')
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function deleteEntitySchema(recordId: string, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] deleteEntitySchema - Use direct Legend State patterns instead')
  throw new Error('Entity schema operations should be handled through the new simplified API')
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function createEntity(entityName: string, entityData: any, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] createEntity - Use direct Legend State patterns instead')
  const entityStore = getEntity$(entityName)
  if (!entityStore) {
    throw new Error(`Entity store not found for ${entityName}`)
  }
  
  // Generate ID and set directly
  const id = crypto.randomUUID()
  entityStore[id].set({
    id,
    ...entityData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  
  return { id, ...entityData }
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function updateEntity(entityName: string, recordId: string, updates: any, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] updateEntity - Use direct Legend State patterns instead')
  const entityStore = getEntity$(entityName)
  if (!entityStore) {
    throw new Error(`Entity store not found for ${entityName}`)
  }
  
  entityStore[recordId].assign({
    ...updates,
    updated_at: new Date().toISOString()
  })
  
  return updates
}

/**
 * @deprecated Use getEntity$(entityName) and direct CRUD operations instead
 */
export async function deleteEntity(entityName: string, recordId: string, options: EntityMutationOptions = {}) {
  console.warn('[DEPRECATED] deleteEntity - Use direct Legend State patterns instead')
  const entityStore = getEntity$(entityName)
  if (!entityStore) {
    throw new Error(`Entity store not found for ${entityName}`)
  }
  
  entityStore[recordId].delete()
  
  return { success: true }
}