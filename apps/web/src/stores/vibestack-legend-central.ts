/**
 * DEPRECATED - Legacy import location
 * 
 * This file has been moved and simplified. Import from the new location:
 * 
 * import { store$, loadOrgContext, getEntity$ } from '@/legend-state'
 * 
 * The old complex "store registry" pattern has been replaced with proper
 * Legend State patterns using direct observables and syncedCrud.
 */

export * from '@/legend-state'

console.warn('DEPRECATED: Import from @/legend-state instead of vibestack-legend-central')