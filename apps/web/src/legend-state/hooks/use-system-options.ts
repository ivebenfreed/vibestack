/**
 * Legend State hooks for system and custom option management
 * 
 * Provides reactive access to option sets for reference fields like priority_option, status_option, etc.
 * Uses Legend State observables for efficient caching and reactivity.
 */

import { observable } from '@legendapp/state';
import { use$ } from '@legendapp/state/react';
import { useEffect } from 'react';
import { orgContext$ } from '../observables';

// Types for option data
export interface OptionValue {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  description?: string;
  metadata?: any;
}

export interface OptionSet {
  id: string;
  optionSetType: string;
  archetype: string;
  name: string;
  description?: string;
  options: OptionValue[];
  isActive: boolean;
  sortOrder: number;
}

export interface SystemOptionsState {
  optionSets: Record<string, OptionSet>; // key: `${optionType}_${archetype}`
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  lastUpdated: Record<string, number>;
}

export interface CustomOptionsState {
  optionSets: Record<string, OptionSet>; // key: `${orgId}_${optionSetName}`
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  lastUpdated: Record<string, number>;
}

// Global system options observable - reactive to org context
const systemOptions$ = observable(() => {
  const orgId = orgContext$.orgId.get();
  if (!orgId) return {};
  
  console.log(`[useSystemOptions] Org context loaded: ${orgId}`);
  return {};
});

// Cache for individual option sets
const optionSetCache = new Map<string, any>();

// Cache duration for options (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Custom options observable
const customOptions$ = observable<CustomOptionsState>({
  optionSets: {},
  loading: {},
  errors: {},
  lastUpdated: {}
});

/**
 * Async function to load system options into an observable
 */
async function loadSystemOptions(optionType: string, archetype: string, optionSet$: any) {
  try {
    const response = await fetch(`/api/dataforge/system-options/${optionType}/${archetype}`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load system options: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load system options');
    }

    // Update the observable with loaded data
    optionSet$.options.set(data.data.map((option: any) => ({
      value: option.option_key,
      label: option.label,
      color: option.color,
      icon: option.icon,
      description: option.description,
      metadata: {}
    })));
  } catch (error) {
    console.error(`Failed to load system options for ${optionType}/${archetype}:`, error);
    // Keep empty options array on error
  }
}

/**
 * Hook to load and use system options for a specific archetype and option type
 */
export function useSystemOptions(optionType: string, archetype: string) {
  const key = `${optionType}_${archetype}`;
  
  // Get or create observable for this specific option set
  if (!optionSetCache.has(key)) {
    const optionSet$ = observable({
      id: key,
      optionSetType: optionType,
      archetype: archetype,
      name: `${optionType} options`,
      description: `${optionType} options for ${archetype}`,
      options: [],
      isActive: true,
      sortOrder: 0
    });
    
    // Load data asynchronously
    loadSystemOptions(optionType, archetype, optionSet$);
    
    optionSetCache.set(key, optionSet$);
  }

  const optionSet$ = optionSetCache.get(key);
  
  // Use use$ to consume the observable reactively
  const optionSet = use$(optionSet$);
  
  // Helper functions
  const getOptionByValue = (value: string): OptionValue | null => {
    if (!optionSet?.options) return null;
    return optionSet.options.find(option => option.value === value) || null;
  };

  const getOptions = (): OptionValue[] => {
    return optionSet?.options || [];
  };

  const getSelectOptions = () => {
    return (optionSet?.options || []).map(option => ({
      value: option.value,
      label: option.label,
      color: option.color,
      disabled: false
    }));
  };

  return {
    optionSet,
    options: getOptions(),
    selectOptions: getSelectOptions(),
    getOptionByValue,
    getOptions,
    getSelectOptions
  };
}

/**
 * Hook to load and use custom options for a specific organization and field
 */
export function useCustomOptions(orgId: string, optionSetName: string) {
  const key = `${orgId}_${optionSetName}`;
  
  // Use the whole state observable and derive values from it
  const state = use$(customOptions$);
  
  // Get the actual values
  const isLoading = state.loading[key] || false;
  const error = state.errors[key] || null;
  const optionSet = state.optionSets[key] || null;
  const lastUpdated = state.lastUpdated[key] || 0;

  // Check if data is fresh
  const isStale = Date.now() - lastUpdated > CACHE_DURATION;

  const loadOptions = async () => {
    const cacheKey = key;
    
    // Skip if already loading
    if (customOptions$.loading[cacheKey].get()) {
      return;
    }

    // Skip if data is fresh
    if (!isStale && optionSet) {
      return;
    }

    try {
      customOptions$.loading[cacheKey].set(true);
      customOptions$.errors[cacheKey].set(null);

      const response = await fetch(`/api/dataforge/orgs/${orgId}/custom-options/${optionSetName}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load custom options: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load custom options');
      }

      // Transform API response to match expected format
      const optionSet: OptionSet = {
        id: `${orgId}_${optionSetName}`,
        optionSetType: 'custom',
        archetype: 'custom',
        name: optionSetName,
        description: `Custom options for ${optionSetName}`,
        options: data.data.map((option: any) => ({
          value: option.option_key,
          label: option.label,
          color: option.color,
          icon: option.icon,
          description: option.description,
          metadata: {}
        })),
        isActive: true,
        sortOrder: 0
      };

      customOptions$.optionSets[cacheKey].set(optionSet);
      customOptions$.lastUpdated[cacheKey].set(Date.now());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      customOptions$.errors[cacheKey].set(errorMessage);
      console.error(`[useCustomOptions] Error loading custom options for ${optionSetName} in org ${orgId}:`, error);
    } finally {
      customOptions$.loading[cacheKey].set(false);
    }
  };

  // Auto-load on mount and when stale
  useEffect(() => {
    if (orgId && optionSetName && (!optionSet || isStale)) {
      loadOptions();
    }
  }, [orgId, optionSetName, isStale]);

  // Helper to get option by value
  const getOptionByValue = (value: string): OptionValue | null => {
    if (!optionSet?.options) return null;
    return optionSet.options.find(option => option.value === value) || null;
  };

  // Helper to get all options as array
  const getOptions = (): OptionValue[] => {
    return optionSet?.options || [];
  };

  // Helper to get options formatted for select dropdowns
  const getSelectOptions = () => {
    return (optionSet?.options || []).map(option => ({
      value: option.value,
      label: option.label,
      color: option.color,
      disabled: false
    }));
  };

  return {
    optionSet,
    options: getOptions(),
    selectOptions: getSelectOptions(),
    isLoading,
    error,
    isStale,
    refresh: loadOptions,
    getOptionByValue,
    getOptions,
    getSelectOptions
  };
}

/**
 * Hook to get resolved option data for a field value
 */
export function useResolvedOption(
  fieldType: string, 
  value: string | null | undefined,
  archetype: string,
  orgId?: string
): {
  resolved: OptionValue | null;
  isLoading: boolean;
  error: string | null;
} {
  // Determine if this is a system or custom option
  const isSystemOption = ['priority_option', 'status_option', 'category_option', 'discussion_type_option'].includes(fieldType);
  
  const systemResult = useSystemOptions(
    isSystemOption ? fieldType.replace('_option', '') : '', 
    isSystemOption ? archetype : ''
  );
  
  const customResult = useCustomOptions(
    !isSystemOption && orgId ? orgId : '',
    !isSystemOption ? fieldType : ''
  );

  if (isSystemOption) {
    const resolved = value ? systemResult.getOptionByValue(value) : null;
    return {
      resolved,
      isLoading: systemResult.isLoading,
      error: systemResult.error
    };
  } else {
    const resolved = value ? customResult.getOptionByValue(value) : null;
    return {
      resolved,
      isLoading: customResult.isLoading,
      error: customResult.error
    };
  }
}

/**
 * Invalidate all option caches (useful after updates)
 */
export function invalidateOptionCaches() {
  systemOptions$.optionSets.set({});
  systemOptions$.lastUpdated.set({});
  customOptions$.optionSets.set({});
  customOptions$.lastUpdated.set({});
}

/**
 * Preload common system options for better performance
 */
export async function preloadCommonSystemOptions() {
  const commonOptions = [
    { type: 'priority', archetype: 'project' },
    { type: 'status', archetype: 'project' },
    { type: 'category', archetype: 'project' },
    { type: 'priority', archetype: 'task' },
    { type: 'status', archetype: 'task' },
    { type: 'category', archetype: 'task' }
  ];

  // Load all common options in parallel
  const promises = commonOptions.map(async ({ type, archetype }) => {
    const key = `${type}_${archetype}`;
    
    if (systemOptions$.optionSets[key].get()) {
      return; // Already loaded
    }

    try {
      const response = await fetch(`/api/dataforge/system-options/${type}/${archetype}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Transform API response to match expected format
          const optionSet: OptionSet = {
            id: key,
            optionSetType: type,
            archetype: archetype,
            name: `${type} options`,
            description: `${type} options for ${archetype}`,
            options: data.data.map((option: any) => ({
              value: option.option_key,
              label: option.label,
              color: option.color,
              icon: option.icon,
              description: option.description,
              metadata: {}
            })),
            isActive: true,
            sortOrder: 0
          };
          
          systemOptions$.optionSets[key].set(optionSet);
          systemOptions$.lastUpdated[key].set(Date.now());
        }
      }
    } catch (error) {
      console.warn(`Failed to preload ${type} options for ${archetype}:`, error);
    }
  });

  await Promise.allSettled(promises);
}