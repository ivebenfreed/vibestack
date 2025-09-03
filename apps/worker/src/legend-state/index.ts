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
  loadUniverseContext,
  getEntity$,
  getUniverseEntity$,
  clearContext,
  handleTableNotification,
  removeEntityFromSchema,
  entityGroups$,
  createEntityGroups,
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

// Universe Context - New universe-centric navigation
export {
  universeContext$,
  universeHelpers,
  loadWorkspaceData,
  // Computed observables for universe context
  currentOrganizations$,
  allPersonalWorlds$,
  allBusinessWorlds$,
  allActiveWorlds$,
  allTeams$,
  // Core business logic types
  type Universe,
  type Team,
  type World,
  type OrgInfo,
  type OrganizationContext,
  type UniverseContextData
} from './observables/universe-context'

// Universe Loader - Data loading for universe context
export {
  universeLoader,
  UniverseLoader
} from './loaders/universe-loader'

// Universal hooks for entity access
export {
  useEntity$,
  waitForEntity$,
  useEntities$,
  type UseEntityResult
} from './hooks/use-entity'