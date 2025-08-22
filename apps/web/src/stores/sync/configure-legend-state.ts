/**
 * MIGRATION ALIAS - Temporary compatibility layer
 * 
 * This file provides backwards compatibility during the legend-state migration.
 * All exports now come from the new colocated structure.
 * 
 * TODO: Remove this file after migration is complete
 */

// Re-export everything from the new persistence location
export * from '../legend-state/persistence/configure-legend-state'