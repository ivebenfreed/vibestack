/**
 * Centralized Computed Observable System for All Reference Options
 * Manages system and custom options with reactive caching and resolution
 */

import { observable, computed } from '@legendapp/state'
import { synced, syncedCrud } from '@legendapp/state/sync'
import { universeOrgId$, universeSchema$, universeContext$ } from '../observables'
import { log } from '@/logger';
const fileLog = log('legend-state/reference-system/options-manager.ts');

// Types
export interface SystemOption {
  value: string
  label: string
  color?: string
  icon?: string
  description?: string
  order: number
}

export interface SystemOptionSet {
  id: string
  name: string
  archetype: string
  optionType: string
  options: SystemOption[]
}

export interface CustomOption {
  value: string
  label: string
  color?: string
  icon?: string
  description?: string
  order: number
  organizationId: string
}

export interface CustomOptionSet {
  id: string
  name: string
  organizationId: string
  options: CustomOption[]
}

// Central options store - using synced observables for automatic deduplication
const optionsStore$ = observable({
  systemOptions: {} as Record<string, SystemOptionSet>, // key: "priority_task"
  customOptions: {} as Record<string, CustomOptionSet>, // key: "departments_org123"
})

/**
 * Helper function to get a real organization ID instead of "universe"
 */
function getValidOrgId(preferredOrgId?: string): string | null {
  // First try provided org ID
  if (preferredOrgId && preferredOrgId !== 'universe') {
    return preferredOrgId
  }
  
  // Try URL-based orgId
  let orgId = universeOrgId$.peek()
  if (orgId && orgId !== 'universe') {
    return orgId
  }
  
  // Fall back to first available organization from universe context
  const universeContext = universeContext$.peek()
  const organizations = universeContext?.organizations || {}
  const orgIds = Object.keys(organizations)
  
  if (orgIds.length === 0) {
    return null
  }
  
  return orgIds[0]
}

/**
 * Get or create system options observable with synced() for automatic deduplication
 */
function getSystemOptionsObservable(optionType: string, archetype: string) {
  const key = `${optionType}_${archetype}`

  // Check if observable exists - if not, create it SYNCHRONOUSLY to prevent race conditions
  let existing = optionsStore$.systemOptions[key].peek()

  if (!existing) {
    // Immediately set a placeholder to prevent duplicate creation
    const placeholder: SystemOptionSet = {
      id: key,
      name: `${optionType} (${archetype})`,
      archetype,
      optionType,
      options: []
    }
    optionsStore$.systemOptions[key].set(placeholder)

    // Now create and configure the synced observable
    optionsStore$.systemOptions[key].set(
      synced({
        get: async () => {
          // Get a real organization ID from universe context instead of "universe"
          const orgId = getValidOrgId()
          if (!orgId) {
            throw new Error('No organizations available for loading options')
          }

          fileLog.debug(`[OptionsManager] Fetching options for ${key} using org ${orgId}`)

          // Use unified options API endpoint
          const response = await fetch(`/api/dataforge/orgs/${orgId}/options/${optionType}`)
          if (!response.ok) {
            throw new Error(`Failed to fetch options: ${response.status}`)
          }

          const data = await response.json()

          // Transform unified API response to our format
          const transformedOptions = (data.data || []).map((option: any) => ({
            value: option.option_key || option.value,
            label: option.label,
            color: option.color,
            icon: option.icon,
            description: option.description,
            order: option.sort_order || 0
          }))

          const optionSet: SystemOptionSet = {
            id: key,
            name: `${optionType} (${archetype})`,
            archetype,
            optionType,
            options: transformedOptions
          }

          fileLog.info(`[OptionsManager] Loaded options for ${key}:`, optionSet)
          return optionSet
        },
        initial: placeholder
      })
    )
  }

  return optionsStore$.systemOptions[key]
}

/**
 * Get or create custom options observable with synced() for automatic deduplication
 */
function getCustomOptionsObservable(optionSetName: string, organizationId?: string) {
  const orgId = getValidOrgId(organizationId)
  if (!orgId) {
    throw new Error(`No valid organization ID available for custom options: ${optionSetName}`)
  }
  const key = `${optionSetName}_${orgId}`

  // Check if observable exists - if not, create it SYNCHRONOUSLY to prevent race conditions
  let existing = optionsStore$.customOptions[key].peek()

  if (!existing) {
    // Immediately set a placeholder to prevent duplicate creation
    const placeholder: CustomOptionSet = {
      id: key,
      name: optionSetName,
      organizationId: orgId,
      options: []
    }
    optionsStore$.customOptions[key].set(placeholder)

    // Now create and configure the synced observable
    optionsStore$.customOptions[key].set(
      synced({
        get: async () => {
          fileLog.debug(`[OptionsManager] Fetching custom options for ${key}`)

          // Use unified options API endpoint
          const response = await fetch(`/api/dataforge/orgs/${orgId}/options/${optionSetName}`)
          if (!response.ok) {
            throw new Error(`Failed to fetch options: ${response.status}`)
          }

          const data = await response.json()

          // Transform unified API response to our format
          const transformedOptions = (data.data || []).map((option: any) => ({
            value: option.option_key || option.value,
            label: option.label,
            color: option.color,
            icon: option.icon,
            description: option.description,
            order: option.sort_order || 0,
            organizationId: orgId
          }))

          const optionSet: CustomOptionSet = {
            id: key,
            name: optionSetName,
            organizationId: orgId,
            options: transformedOptions
          }

          fileLog.info(`[OptionsManager] Loaded options for ${key}:`, optionSet)
          return optionSet
        },
        initial: placeholder
      })
    )
  }

  return optionsStore$.customOptions[key]
}

/**
 * Computed observable for option resolution - maps values to option objects
 */
const optionResolvers$ = computed(() => {
  const resolvers = new Map<string, (value: string) => SystemOption | CustomOption | null>()
  
  // Build system option resolvers
  const systemOptions = optionsStore$.systemOptions.peek()
  for (const [key, optionSet] of Object.entries(systemOptions)) {
    if (optionSet?.options) {
      const optionMap = new Map(optionSet.options.map(opt => [opt.value, opt]))
      resolvers.set(`system:${key}`, (value: string) => optionMap.get(value) || null)
    }
  }
  
  // Build custom option resolvers  
  const customOptions = optionsStore$.customOptions.peek()
  for (const [key, optionSet] of Object.entries(customOptions)) {
    if (optionSet?.options) {
      const optionMap = new Map(optionSet.options.map(opt => [opt.value, opt]))
      resolvers.set(`custom:${key}`, (value: string) => optionMap.get(value) || null)
    }
  }
  
  return resolvers
})

/**
 * Main Options Manager API
 */
export const OptionsManager = {
  /**
   * Get system options for a type/archetype combination
   */
  getSystemOptions(optionType: string, archetype: string) {
    return getSystemOptionsObservable(optionType, archetype)
  },
  
  /**
   * Get custom options for an option set name
   */
  getCustomOptions(optionSetName: string, organizationId?: string) {
    return getCustomOptionsObservable(optionSetName, organizationId)
  },
  
  /**
   * Resolve a system option value to its full option object
   */
  resolveSystemOption(optionType: string, archetype: string, value: string) {
    const key = `system:${optionType}_${archetype}`
    const resolvers = optionResolvers$.peek()
    const resolver = resolvers.get(key)
    return resolver ? resolver(value) : null
  },
  
  /**
   * Resolve a custom option value to its full option object
   */
  resolveCustomOption(optionSetName: string, value: string, organizationId?: string) {
    const orgId = getValidOrgId(organizationId)
    if (!orgId) {
      fileLog.warn(`[OptionsManager] No valid organization ID for resolveCustomOption: ${optionSetName}`)
      return null
    }
    const key = `custom:${optionSetName}_${orgId}`
    const resolvers = optionResolvers$.peek()
    const resolver = resolvers.get(key)
    return resolver ? resolver(value) : null
  },
  
  
  /**
   * Preload commonly used system options
   */
  preloadSystemOptions() {
    // Check if we have any organizations available before trying to load options
    const orgId = getValidOrgId()
    if (!orgId) {
      fileLog.debug('[OptionsManager] No organizations available yet, skipping preloadSystemOptions')
      return
    }

    const commonTypes = ['priority', 'status', 'category']
    const commonArchetypes = ['task', 'project', 'record', 'document']

    for (const type of commonTypes) {
      for (const archetype of commonArchetypes) {
        try {
          // This will create the observable and trigger async loading
          getSystemOptionsObservable(type, archetype)
        } catch (error) {
          fileLog.error(`[OptionsManager] Error loading options for ${type}_${archetype}:`, error)
        }
      }
    }

    fileLog.info('[OptionsManager] Preloading system options for common combinations')
  },
  
  /**
   * Clear all cached options (for testing/debugging)
   */
  clearCache() {
    optionsStore$.systemOptions.set({})
    optionsStore$.customOptions.set({})
    fileLog.info('[OptionsManager] Cache cleared')
  },
  
  // Internal observables for debugging
  _store$: optionsStore$,
  _resolvers$: optionResolvers$
}

// Auto-preload on initialization (only once)
if (typeof window !== 'undefined') {
  let hasPreloaded = false
  // Wait for universe schema to be ready
  universeSchema$.onChange((schema) => {
    if (schema && !hasPreloaded) {
      hasPreloaded = true
      OptionsManager.preloadSystemOptions()
    }
  })
}