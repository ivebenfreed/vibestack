/**
 * Reactive hooks for the centralized options system
 */

import { use$ } from '@legendapp/state/react'
import { OptionsManager, type SystemOption, type CustomOption } from './options-manager'

/**
 * Hook for system options with reactive updates
 */
export function useSystemOptions(optionType: string, archetype: string) {
  const optionSet$ = OptionsManager.getSystemOptions(optionType, archetype)
  const optionSet = use$(optionSet$)
  
  return {
    options: optionSet?.options || [],
    isLoading: OptionsManager.isLoading(`${optionType}_${archetype}`),
    error: OptionsManager.getError(`${optionType}_${archetype}`),
    
    // Helper functions
    getOptionByValue: (value: string): SystemOption | null => {
      return optionSet?.options.find(opt => opt.value === value) || null
    },
    
    getOptionsByValues: (values: string[]): SystemOption[] => {
      if (!optionSet?.options) return []
      const optionMap = new Map(optionSet.options.map(opt => [opt.value, opt]))
      return values.map(value => optionMap.get(value)).filter(Boolean) as SystemOption[]
    },
    
    resolveValue: (value: string) => {
      return OptionsManager.resolveSystemOption(optionType, archetype, value)
    }
  }
}

/**
 * Hook for custom options with reactive updates
 */
export function useCustomOptions(optionSetName: string, organizationId?: string) {
  const optionSet$ = OptionsManager.getCustomOptions(optionSetName, organizationId)
  const optionSet = use$(optionSet$)
  const orgId = organizationId || 'current' // fallback for key
  
  return {
    options: optionSet?.options || [],
    isLoading: OptionsManager.isLoading(`${optionSetName}_${orgId}`),
    error: OptionsManager.getError(`${optionSetName}_${orgId}`),
    
    // Helper functions
    getOptionByValue: (value: string): CustomOption | null => {
      return optionSet?.options.find(opt => opt.value === value) || null
    },
    
    getOptionsByValues: (values: string[]): CustomOption[] => {
      if (!optionSet?.options) return []
      const optionMap = new Map(optionSet.options.map(opt => [opt.value, opt]))
      return values.map(value => optionMap.get(value)).filter(Boolean) as CustomOption[]
    },
    
    resolveValue: (value: string) => {
      return OptionsManager.resolveCustomOption(optionSetName, value, organizationId)
    }
  }
}

/**
 * Universal hook that works with both system and custom options
 */
export function useReferenceOptions(config: {
  referenceType: 'system' | 'custom'
  systemOptionType?: string
  systemArchetype?: string
  customOptionSet?: string
  organizationId?: string
}) {
  const { referenceType, systemOptionType, systemArchetype, customOptionSet, organizationId } = config
  
  if (referenceType === 'system' && systemOptionType && systemArchetype) {
    return useSystemOptions(systemOptionType, systemArchetype)
  }
  
  if (referenceType === 'custom' && customOptionSet) {
    return useCustomOptions(customOptionSet, organizationId)
  }
  
  // Fallback for invalid configuration
  console.warn('[useReferenceOptions] Invalid configuration:', config)
  return {
    options: [],
    isLoading: false,
    error: 'Invalid reference configuration',
    getOptionByValue: () => null,
    getOptionsByValues: () => [],
    resolveValue: () => null
  }
}

/**
 * Hook for bulk option resolution (useful for table rendering)
 */
export function useOptionResolver() {
  const resolvers = use$(OptionsManager._resolvers$)
  
  return {
    resolveSystemOption: (optionType: string, archetype: string, value: string) => {
      return OptionsManager.resolveSystemOption(optionType, archetype, value)
    },
    
    resolveCustomOption: (optionSetName: string, value: string, organizationId?: string) => {
      return OptionsManager.resolveCustomOption(optionSetName, value, organizationId)
    },
    
    // Bulk resolution for multiple values
    resolveSystemOptions: (optionType: string, archetype: string, values: string[]) => {
      return values.map(value => OptionsManager.resolveSystemOption(optionType, archetype, value))
    },
    
    resolveCustomOptions: (optionSetName: string, values: string[], organizationId?: string) => {
      return values.map(value => OptionsManager.resolveCustomOption(optionSetName, value, organizationId))
    }
  }
}

/**
 * Hook for global options state (useful for debugging/admin)
 */
export function useOptionsManagerState() {
  const store = use$(OptionsManager._store$)
  
  return {
    systemOptions: store.systemOptions,
    customOptions: store.customOptions,
    loading: Array.from(store.loading),
    errors: store.errors,
    
    // Actions
    preloadSystemOptions: OptionsManager.preloadSystemOptions,
    clearCache: OptionsManager.clearCache,
    
    // Stats
    systemOptionCount: Object.keys(store.systemOptions).length,
    customOptionCount: Object.keys(store.customOptions).length,
    isAnyLoading: store.loading.size > 0
  }
}