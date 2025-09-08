import React, { createContext, useContext } from 'react';
// Adjust import paths as necessary
import { AppAbility, defineAbilityForOrganization, defineAbilityFor } from '../lib/ability';
import { useAuth } from '@/state-machines';
import { OrganizationInfo } from '@/state-machines/types';

const defaultAbility = defineAbilityFor(null);
export const AbilityContext = createContext<AppAbility>(defaultAbility);

export const AbilityProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, currentOrganization } = useAuth();
  
  // For global/universe context, use general ability without org-specific restrictions
  const ability = defineAbilityFor({ user, organization: null });

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};

// Hook for general abilities (universe/global context)
export const useAppAbility = () => useContext(AbilityContext);

// Hook for organization-specific abilities
export const useOrgAbility = (organization?: OrganizationInfo | null) => {
  const { user, currentOrganization } = useAuth();
  
  // Use provided organization or fall back to current organization
  const targetOrg = organization || currentOrganization;
  
  return React.useMemo(() => {
    return defineAbilityForOrganization(user, targetOrg);
  }, [user, targetOrg]);
};

// Hook to check if a specific organization has an expired trial
export const useOrgTrialStatus = (organization: OrganizationInfo | null) => {
  return React.useMemo(() => {
    if (!organization) return { isExpired: false, canCreateEntities: true };
    
    // Check if this organization has an expired trial
    const isTrialOrg = organization.subscription_tier === 'trial' || organization.subscriptionTier === 'trial';
    if (!isTrialOrg) return { isExpired: false, canCreateEntities: true };
    
    const trialEndsAt = organization.trial_ends_at || organization.trialEndsAt;
    if (!trialEndsAt) return { isExpired: false, canCreateEntities: true };
    
    const isExpired = new Date(trialEndsAt) < new Date();
    return { 
      isExpired, 
      canCreateEntities: !isExpired,
      trialEndsAt: new Date(trialEndsAt)
    };
  }, [organization]);
};