/**
 * Centralized Computed Observable System for All Reference Options
 * Manages system and custom options with reactive caching and resolution
 */

import { observable, computed } from '@legendapp/state'
import { orgContext$ } from '../observables'

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

// Central options store
const optionsStore$ = observable({
  systemOptions: {} as Record<string, SystemOptionSet>, // key: "priority_task"
  customOptions: {} as Record<string, CustomOptionSet>, // key: "departments_org123"
  loading: new Set<string>(),
  errors: {} as Record<string, string>
})

/**
 * Get or create system options observable for a specific type/archetype
 */
function getSystemOptionsObservable(optionType: string, archetype: string) {
  const key = `${optionType}_${archetype}`
  
  if (!optionsStore$.systemOptions[key].peek()) {
    // Create observable for this option set
    optionsStore$.systemOptions[key].set({
      id: key,
      name: `${optionType} (${archetype})`,
      archetype,
      optionType,
      options: []
    })
    
    // Load data asynchronously
    loadSystemOptions(optionType, archetype, key)
  }
  
  return optionsStore$.systemOptions[key]
}

/**
 * Async function to load system options
 */
async function loadSystemOptions(optionType: string, archetype: string, key: string) {
  try {
    optionsStore$.loading.set(prev => new Set([...prev, key]))
    
    const response = await fetch(`/api/dataforge/system-options/${optionType}/${archetype}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch system options: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Transform API response to our format
    const optionSet: SystemOptionSet = {
      id: key,
      name: `${optionType} (${archetype})`,
      archetype,
      optionType,
      options: data.data || []
    }
    
    console.log(`[OptionsManager] Loaded system options for ${key}:`, optionSet)
    optionsStore$.systemOptions[key].set(optionSet)
    
  } catch (error) {
    console.error(`[OptionsManager] Error loading system options for ${key}:`, error)
    optionsStore$.errors[key].set(error.message)
    optionsStore$.systemOptions[key].set({
      id: key,
      name: `${optionType} (${archetype})`,
      archetype,
      optionType,
      options: []
    })
  } finally {
    optionsStore$.loading.set(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }
}

/**
 * Get or create custom options observable for an organization option set
 */
function getCustomOptionsObservable(optionSetName: string, organizationId?: string) {
  const orgId = organizationId || orgContext$.currentOrganization.id.peek()
  const key = `${optionSetName}_${orgId}`
  
  if (!optionsStore$.customOptions[key].peek()) {
    // Create observable for this option set
    optionsStore$.customOptions[key].set({
      id: key,
      name: optionSetName,
      organizationId: orgId,
      options: []
    })
    
    // Load data asynchronously
    loadCustomOptions(optionSetName, orgId, key)
  }
  
  return optionsStore$.customOptions[key]
}

/**
 * Async function to load custom options
 */
async function loadCustomOptions(optionSetName: string, orgId: string, key: string) {
  try {
    optionsStore$.loading.set(prev => new Set([...prev, key]))
    
    const response = await fetch(`/api/dataforge/custom-options/${orgId}/${optionSetName}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch custom options: ${response.status}`)
    }
    
    const data = await response.json()
    
    const optionSet: CustomOptionSet = {
      id: key,
      name: optionSetName,
      organizationId: orgId,
      options: data.data || []
    }
    
    console.log(`[OptionsManager] Loaded custom options for ${key}:`, optionSet)
    optionsStore$.customOptions[key].set(optionSet)
    
  } catch (error) {
    console.error(`[OptionsManager] Error loading custom options for ${key}:`, error)
    optionsStore$.errors[key].set(error.message)
    optionsStore$.customOptions[key].set({
      id: key,
      name: optionSetName,
      organizationId: orgId,
      options: []
    })
  } finally {
    optionsStore$.loading.set(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }
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
    const orgId = organizationId || orgContext$.currentOrganization.id.peek()
    const key = `custom:${optionSetName}_${orgId}`
    const resolvers = optionResolvers$.peek()
    const resolver = resolvers.get(key)
    return resolver ? resolver(value) : null
  },
  
  /**
   * Get loading state for options
   */
  isLoading(key?: string) {
    const loading = optionsStore$.loading.peek()
    return key ? loading.has(key) : loading.size > 0
  },
  
  /**
   * Get error state for options  
   */
  getError(key?: string) {
    const errors = optionsStore$.errors.peek()
    return key ? errors[key] : Object.values(errors).find(Boolean)
  },
  
  /**
   * Preload commonly used system options
   */
  preloadSystemOptions() {
    const commonTypes = ['priority', 'status', 'category']
    const commonArchetypes = ['task', 'project', 'record', 'document']
    
    for (const type of commonTypes) {
      for (const archetype of commonArchetypes) {
        // This will create the observable and trigger async loading
        getSystemOptionsObservable(type, archetype)
      }
    }
    
    console.log('[OptionsManager] Preloading system options for common combinations')
  },
  
  /**
   * Clear all cached options (for testing/debugging)
   */
  clearCache() {
    optionsStore$.systemOptions.set({})
    optionsStore$.customOptions.set({})
    optionsStore$.loading.set(new Set())
    optionsStore$.errors.set({})
    console.log('[OptionsManager] Cache cleared')
  },
  
  // Internal observables for debugging
  _store$: optionsStore$,
  _resolvers$: optionResolvers$
}

// Auto-preload on initialization
if (typeof window !== 'undefined') {
  // Wait for org context to be ready
  orgContext$.schema.onChange((schema) => {
    if (schema) {
      OptionsManager.preloadSystemOptions()
    }
  })
}