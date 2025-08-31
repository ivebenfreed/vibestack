/**
 * VibeStack Legend State - Direct Observable API
 * 
 * Simplified Legend State implementation using direct observables.
 * No store abstraction - just pure Legend State patterns.
 */

// Main observable exports - direct Legend State patterns
export {
  orgContext$,
  loadOrgContext,
  getEntity$,
  clearContext,
  handleTableNotification,
  removeEntityFromSchema,
  entityGroups$,
  // Common computed observables
  isLoading$,
  currentOrg$,
  currentSchema$,
  // Enhanced mutation utilities
  batchOperations,
  entityOperations,
  // Error classes
  ValidationError,
  ConflictError
} from './observables'

// Universal hooks for entity access
export {
  useEntity$,
  waitForEntity$,
  useEntities$,
  type UseEntityResult
} from './hooks/use-entity'