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
  entityGroups$
} from './observables'