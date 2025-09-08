import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
// 🔥 NEW: Use XState types instead of Zustand authStore
import { UserInfo, OrganizationInfo } from '../state-machines/types';

// Define actions and subjects relevant to your application
type AppActions = 'access' | 'create' | 'read' | 'update' | 'delete' | 'manage';
// Expanded subjects to include more app features
type AppSubjects = 
  | 'debug_features' 
  | 'billing' 
  | 'entity' 
  | 'project' 
  | 'task' 
  | 'organization' 
  | 'settings'
  | 'all';

export type AppAbility = MongoAbility<[AppActions, AppSubjects]>;

interface AbilityContext {
  user: UserInfo | null;
  organization?: OrganizationInfo | null;
  isTrialExpired?: boolean;
  organizationId?: string; // For organization-specific ability checks
}

// Helper function to check if a specific organization has an expired trial
function isOrganizationTrialExpired(organization: OrganizationInfo | null): boolean {
  if (!organization) return false;
  
  // Check if this organization has an expired trial
  if (organization.subscription_tier === 'trial' || organization.subscriptionTier === 'trial') {
    const trialEndsAt = organization.trial_ends_at || organization.trialEndsAt;
    if (trialEndsAt) {
      return new Date(trialEndsAt) < new Date();
    }
  }
  
  return false;
}

export function defineAbilityFor(context: AbilityContext | UserInfo | null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Handle backward compatibility - if just a user is passed, convert to context
  let user: UserInfo | null;
  let organization: OrganizationInfo | null | undefined;
  let isTrialExpired = false;
  let organizationId: string | undefined;
  
  if (context && 'user' in context) {
    user = context.user;
    organization = context.organization;
    organizationId = context.organizationId;
    // Check trial expiration for the specific organization
    isTrialExpired = context.isTrialExpired || isOrganizationTrialExpired(organization);
  } else {
    user = context as UserInfo | null;
  }

  // Everyone can access billing and settings pages (needed for trial expired users)
  can('access', ['billing', 'settings']);
  can('read', 'organization');

  // If trial is expired for this specific organization, restrict organization-specific actions
  if (isTrialExpired && organization) {
    // Still allow access to other organizations and global features
    can('read', 'all'); // Can still read data
    
    // Block creation/modification actions for this specific expired organization
    cannot('create', 'entity');
    cannot('update', 'entity'); 
    cannot('delete', 'entity');
    cannot('create', 'project');
    cannot('update', 'project');
    cannot('delete', 'project');
    cannot('create', 'task');
    cannot('update', 'task');
    cannot('delete', 'task');
    
    // Admin features may still be available for other orgs
    if (user?.role !== 'admin' && user?.role !== 'super_admin') {
      cannot('access', 'debug_features');
    }
    
    // Return with limited permissions for this org
    return build();
  }

  // Normal permission logic when trial is not expired (or no specific org context)
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    can('manage', 'all'); // Admin can do everything
    can('access', 'debug_features');
  } else if (user?.role === 'member') {
    // Members have limited access
    can('read', 'all');
    can('create', ['task', 'project', 'entity']);
    can('update', ['task', 'project', 'entity']);
    cannot('delete', ['entity', 'organization']);
    cannot('access', 'debug_features');
  } else if (user?.role === 'viewer') {
    // Viewers can only read
    can('read', 'all');
    cannot('create', 'all');
    cannot('update', 'all');
    cannot('delete', 'all');
    cannot('access', 'debug_features');
  }

  return build();
}

// Helper function to create organization-specific abilities
export function defineAbilityForOrganization(
  user: UserInfo | null, 
  organization: OrganizationInfo | null
): AppAbility {
  return defineAbilityFor({
    user,
    organization,
    organizationId: organization?.id,
    isTrialExpired: isOrganizationTrialExpired(organization)
  });
}