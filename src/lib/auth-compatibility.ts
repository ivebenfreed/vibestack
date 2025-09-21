/**
 * Minimal auth compatibility layer for components that still need auth actions
 *
 * This provides stub implementations of organization management functions
 * until they can be properly implemented in Legend State unified auth.
 *
 * TODO: Remove this file once all auth actions are implemented in Legend State
 */

import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth';
import { log } from '@/logger';

const authLog = log('lib/auth-compatibility.ts');

export function useAuth() {
  const unifiedAuth = useUnifiedAuth();

  return {
    // Pass through all unified auth properties
    ...unifiedAuth,

    // Stub implementations for missing auth actions
    createOrganization: (organizationData: { name: string; domain?: string }) => {
      authLog.warn('[useAuth] createOrganization not yet implemented in Legend State');
      // TODO: Implement in Legend State unified auth
    },

    selectOrganization: (organizationId: string) => {
      authLog.warn('[useAuth] selectOrganization not yet implemented in Legend State');
      // TODO: Implement in Legend State unified auth
    },

    switchOrganization: (organizationId: string) => {
      authLog.warn('[useAuth] switchOrganization not yet implemented in Legend State');
      // TODO: Implement in Legend State unified auth
    },

    reloadOrganizations: () => {
      authLog.warn('[useAuth] reloadOrganizations not yet implemented in Legend State');
      // TODO: Implement in Legend State unified auth
    },

    // Additional legacy properties that might be needed
    organizationError: null,
    effectiveUserRole: unifiedAuth.user?.role || null,
  };
}

// Re-export types for compatibility
export type { UserInfo, OrganizationInfo } from './legacy-types';