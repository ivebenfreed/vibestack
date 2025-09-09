/**
 * Reactive hooks for the centralized options system
 */

import React from 'react'
import { use$ } from '@legendapp/state/react'
import { OptionsManager, type SystemOption, type CustomOption } from './options-manager'
import { stateLog } from '@/logger';
const log = stateLog('legend-state/reference-system/hooks.ts');

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
 * Universal hook that works with system, custom, and entity reference options
 */
export function useReferenceOptions(config: {
  referenceType: 'system' | 'custom' | 'user_reference' | 'entity_reference'
  systemOptionType?: string
  systemArchetype?: string
  customOptionSet?: string
  referenceEntity?: string  // For entity references (e.g., 'User', 'Project')
  organizationId?: string
}) {
  const { referenceType, systemOptionType, systemArchetype, customOptionSet, referenceEntity, organizationId } = config
  
  if (referenceType === 'system' && systemOptionType && systemArchetype) {
    return useSystemOptions(systemOptionType, systemArchetype)
  }
  
  if (referenceType === 'custom' && customOptionSet) {
    return useCustomOptions(customOptionSet, organizationId)
  }
  
  // **NEW: Handle entity reference types using virtual entities**
  if ((referenceType === 'user_reference' || referenceType === 'entity_reference') && referenceEntity) {
    return useEntityReferenceOptions(referenceEntity, organizationId)
  }
  
  // Fallback for invalid configuration
  log.warn('[useReferenceOptions] Invalid configuration:', config)
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
 * Hook for entity reference options using virtual entities
 */
export function useEntityReferenceOptions(referenceEntity: string, organizationId?: string) {
  const { getEntity$ } = require('../observables')
  
  // Use the virtual entity for the reference (e.g., VirtualUser, VirtualProject)  
  const virtualEntityName = `Virtual${referenceEntity}`
  const entityObs$ = getEntity$(virtualEntityName)
  const entityData = use$(entityObs$)
  
  // Convert entity records to dropdown options
  const options = React.useMemo(() => {
    if (!entityData) return []
    
    const records = Object.values(entityData)
    return records.map(record => ({
      value: record.id,
      label: record.title || record.name || record.email || record.id, // Fallback display field
      record // Include full record for additional metadata
    }))
  }, [entityData])
  
  return {
    options,
    isLoading: !entityObs$, // Loading if entity observable not yet available
    error: entityObs$ ? null : `Entity ${referenceEntity} not found`,
    
    // Helper functions
    getOptionByValue: (value: string) => {
      return options.find(opt => opt.value === value) || null
    },
    
    getOptionsByValues: (values: string[]) => {
      const optionMap = new Map(options.map(opt => [opt.value, opt]))
      return values.map(value => optionMap.get(value)).filter(Boolean)
    },
    
    resolveValue: (value: string) => {
      const option = options.find(opt => opt.value === value)
      return option ? option.label : value
    }
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