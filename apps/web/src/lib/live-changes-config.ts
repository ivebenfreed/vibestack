/**
 * Live Changes Configuration - DEPRECATED
 * 
 * This file was for domain-xstate which has been removed.
 * Live changes are now handled directly by Dexie.
 */

import type { EntityConfig } from '@/types/live-changes'

// Stub for backward compatibility
export const ENTITY_CONFIGS: Record<string, EntityConfig> = {}

/**
 * Returns config for all entities
 * DEPRECATED - Using Dexie directly
 */
export function getEntityConfigs(): Record<string, EntityConfig> {
  return ENTITY_CONFIGS
}

/**
 * Returns config for a specific entity
 * DEPRECATED - Using Dexie directly
 */
export function getEntityConfig(entityName: string): EntityConfig | undefined {
  return ENTITY_CONFIGS[entityName]
}