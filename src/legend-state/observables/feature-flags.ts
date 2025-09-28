import { observable, computed } from '@legendapp/state'
import { use$ } from '@legendapp/state/react'
import { currentOrganizations$ } from './universe-context'
import { useParams } from '@tanstack/react-router'

export type FeatureFlagKey =
  | 'universe_mode'
  | 'advanced_analytics'
  | 'custom_fields_v2'
  | 'ai_assistance'
  | 'advanced_search'
  | 'workflow_automation'
  | 'enterprise_sso'
  | 'audit_logs'

export interface OrganizationFeatureFlags {
  [key: string]: boolean
}

export const getCurrentOrgId = () => {
  if (typeof window === 'undefined') return null

  const path = window.location.pathname
  const orgMatch = path.match(/\/org\/([^\/]+)/)
  return orgMatch ? orgMatch[1] : null
}

export const currentOrgFeatureFlags$ = computed(() => {
  const organizations = currentOrganizations$.get() || []
  const currentOrgId = getCurrentOrgId()

  if (currentOrgId) {
    const currentOrg = organizations.find(org => org?.info?.id === currentOrgId)

    // Use organization's actual feature flags if available, otherwise use defaults
    if (currentOrg?.enabledFeatures) {
      return {
        ...getDefaultFeatureFlags(false), // Default to traditional mode for orgs
        ...currentOrg.enabledFeatures,
      }
    }

    // Fallback for organizations without explicit feature flags
    return getDefaultFeatureFlags(false) // Traditional mode by default
  }

  // Universe view (no specific org) - use universe mode
  return getDefaultFeatureFlags(true) // Universe mode by default
})

// Helper function to get default feature flags
function getDefaultFeatureFlags(universeMode: boolean): OrganizationFeatureFlags {
  return {
    universe_mode: universeMode,
    advanced_analytics: false,
    custom_fields_v2: false,
    ai_assistance: false,
    advanced_search: false,
    workflow_automation: false,
    enterprise_sso: false,
    audit_logs: false,
  }
}

export const useFeatureFlag = (flag: FeatureFlagKey): boolean => {
  return use$(computed(() => {
    const flags = currentOrgFeatureFlags$.get()
    return flags[flag] === true
  }))
}

export const isUniverseModeEnabled$ = computed(() =>
  currentOrgFeatureFlags$.get().universe_mode === true
)

export const isTraditionalModeEnabled$ = computed(() =>
  currentOrgFeatureFlags$.get().universe_mode === false
)

export const hasAdvancedAnalytics$ = computed(() =>
  currentOrgFeatureFlags$.get().advanced_analytics === true
)

export const hasCustomFieldsV2$ = computed(() =>
  currentOrgFeatureFlags$.get().custom_fields_v2 === true
)

export const hasAIAssistance$ = computed(() =>
  currentOrgFeatureFlags$.get().ai_assistance === true
)

export const platformFeatureFlags = {
  universe_mode: {
    key: 'universe_mode',
    name: 'Universe Mode',
    description: 'Cross-organization project and world management',
    icon: 'Globe',
    defaultEnabled: true,
    targetPlans: ['pro', 'enterprise'],
    category: 'navigation'
  },
  advanced_analytics: {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Enhanced reporting and data visualization',
    icon: 'BarChart',
    defaultEnabled: false,
    targetPlans: ['enterprise'],
    category: 'analytics'
  },
  custom_fields_v2: {
    key: 'custom_fields_v2',
    name: 'Custom Fields V2',
    description: 'Next-generation custom field system with enhanced types',
    icon: 'Settings',
    defaultEnabled: false,
    targetPlans: ['pro', 'enterprise'],
    category: 'data'
  },
  ai_assistance: {
    key: 'ai_assistance',
    name: 'AI Assistance',
    description: 'AI-powered content generation and insights',
    icon: 'Brain',
    defaultEnabled: false,
    targetPlans: ['enterprise'],
    category: 'ai'
  },
  advanced_search: {
    key: 'advanced_search',
    name: 'Advanced Search',
    description: 'Full-text search with filters and semantic search',
    icon: 'Search',
    defaultEnabled: false,
    targetPlans: ['pro', 'enterprise'],
    category: 'search'
  },
  workflow_automation: {
    key: 'workflow_automation',
    name: 'Workflow Automation',
    description: 'Automated workflows and business process management',
    icon: 'Workflow',
    defaultEnabled: false,
    targetPlans: ['enterprise'],
    category: 'automation'
  },
  enterprise_sso: {
    key: 'enterprise_sso',
    name: 'Enterprise SSO',
    description: 'Single sign-on with SAML and OAuth providers',
    icon: 'Shield',
    defaultEnabled: false,
    targetPlans: ['enterprise'],
    category: 'security'
  },
  audit_logs: {
    key: 'audit_logs',
    name: 'Audit Logs',
    description: 'Comprehensive audit logging and compliance features',
    icon: 'FileText',
    defaultEnabled: false,
    targetPlans: ['enterprise'],
    category: 'security'
  }
} as const

export const featureFlagCategories = {
  navigation: 'Navigation & UI',
  analytics: 'Analytics & Reporting',
  data: 'Data Management',
  ai: 'AI & Machine Learning',
  search: 'Search & Discovery',
  automation: 'Automation & Workflows',
  security: 'Security & Compliance'
} as const

export type FeatureFlagCategory = keyof typeof featureFlagCategories