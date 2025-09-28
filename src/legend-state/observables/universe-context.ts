/**
 * Universe Context Observable
 * 
 * Synced universe-centric data model using syncedCrud for reactive updates
 * Connects to workspace API for cross-organization data aggregation
 * Manages user's complete universe including personal worlds and business contexts across all organizations
 */

import { observable, computed, type Observable } from '@legendapp/state';
import { log } from '@/logger';

const fileLog = log('legend-state/universe-context.ts');

// Core business logic types (fixed schema)
export interface Universe {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_team_id?: string;
  team_type: 'department' | 'project' | 'functional' | 'cross_functional';
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Computed fields
  user_role?: 'member' | 'lead' | 'admin';
  member_count?: number;
}

export interface World {
  id: string;
  organization_id: string;
  team_id?: string;
  name: string;
  description?: string;
  universe_id?: string; // NULL = business world, NOT NULL = personal world
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived';
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Computed fields
  team_name?: string;
  universe_name?: string;
  is_personal?: boolean;
  entity_count?: number;
}

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  type?: 'personal' | 'business';
  role: 'member' | 'manager' | 'admin' | 'owner';
  joinedAt: string;
}

export interface OrganizationContext {
  info: OrgInfo;
  universe?: Universe;
  teams: Team[];
  businessWorlds: World[];
  personalWorlds: World[]; // Personal worlds in this organization
  enabledFeatures: Record<string, boolean>; // Feature flags controlled by platform admin
}

// User-configurable entities (still managed by DataForge)
export interface EntitySchema {
  name: string;
  archetype: string;
  fields: Record<string, any>;
  permissions: any;
}

export interface UserEntityData {
  schema: EntitySchema;
  data: Record<string, any>;
  lastSync?: string;
}

// Main universe context interface
export interface UniverseContextData {
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  lastUpdated?: string;
  error?: string;

  // User info
  userId?: string;

  // Core business logic entities (fixed schema)
  personal: {
    // Personal context spans all organizations
    totalWorlds: number;
    worlds: World[];
    activeWorlds: World[];
  };

  organizations: Record<string, OrganizationContext>;

  // User-configurable entities (DataForge)
  userEntities: Record<string, UserEntityData>;

  // Computed aggregations for easy access
  summary: {
    totalOrganizations: number;
    totalPersonalWorlds: number;
    totalBusinessWorlds: number;
    totalTeams: number;
    totalActiveWorlds: number;
  };
}

// Initial state
const initialUniverseContext: UniverseContextData = {
  isLoading: false,
  isInitialized: false,
  personal: {
    totalWorlds: 0,
    worlds: [],
    activeWorlds: []
  },
  organizations: {},
  userEntities: {},
  summary: {
    totalOrganizations: 0,
    totalPersonalWorlds: 0,
    totalBusinessWorlds: 0,
    totalTeams: 0,
    totalActiveWorlds: 0
  }
};

// Authentication state for synced operations
export const authContext$ = observable({
  isAuthenticated: false,
  userId: null as string | null,
  sessionToken: null as string | null
});

// Simple observable for workspace data with manual loading
export const universeWorkspace$ = observable(null as any);

// Data loading is handled by universe-loader.ts
// This keeps separation of concerns - observables here, loading logic there

// Create the main universe context observable that combines auth and workspace data
export const universeContext$: Observable<UniverseContextData> = observable(() => {
  const workspaceData = universeWorkspace$.get();
  const auth = authContext$.get();
  
  if (!auth.isAuthenticated || !workspaceData) {
    return initialUniverseContext;
  }
  
  // Transform workspace API response into universe context structure
  // The workspace data from API has organization details we need to transform
  const organizations: Record<string, OrganizationContext> = {};
  
  // Process organizations from workspace data
  if (workspaceData.organizations) {
    Object.entries(workspaceData.organizations).forEach(([orgId, orgData]: [string, any]) => {
      organizations[orgId] = {
        info: {
          id: orgId,
          name: orgData.name || 'Unknown Organization',
          slug: orgData.slug || '',
          type: orgData.type || 'business',
          role: orgData.role || 'member',
          joinedAt: orgData.joinedAt || orgData.created_at || new Date().toISOString()
        },
        universe: orgData.universe,
        teams: orgData.teams || [],
        businessWorlds: orgData.businessWorlds || [],
        personalWorlds: orgData.personalWorlds || [],
        enabledFeatures: orgData.enabled_features || { universe_mode: true }
      };
    });
  }
  
  // Calculate summary data
  const allPersonalWorlds = workspaceData.personal?.worlds || [];
  const allBusinessWorlds = Object.values(organizations).reduce((acc: World[], org) => {
    return [...acc, ...(org.businessWorlds || [])];
  }, []);
  const allTeams = Object.values(organizations).reduce((acc: Team[], org) => {
    return [...acc, ...(org.teams || [])];
  }, []);
  const activeWorlds = [...allPersonalWorlds, ...allBusinessWorlds].filter(w => w.state === 'active');
  
  const context: UniverseContextData = {
    userId: workspaceData.userId || auth.userId || '',
    isInitialized: !!workspaceData.userId,
    isLoading: false,
    error: null,
    lastUpdated: workspaceData.lastUpdated || new Date().toISOString(),
    organizations,
    personal: {
      totalWorlds: allPersonalWorlds.length,
      worlds: allPersonalWorlds,
      activeWorlds: allPersonalWorlds.filter(w => w.state === 'active')
    },
    userEntities: workspaceData.userEntities || {},
    summary: {
      totalOrganizations: Object.keys(organizations).length,
      totalPersonalWorlds: allPersonalWorlds.length,
      totalBusinessWorlds: allBusinessWorlds.length,
      totalTeams: allTeams.length,
      totalActiveWorlds: activeWorlds.length
    }
  };
  
  return context;
});

// Computed observables for common use cases - now working with synced data
export const userOrganizations$ = computed(() => {
  const context = universeContext$.get();
  return Object.values(context.organizations);
});

// Keep currentOrganizations$ for backward compatibility, but it's deprecated
export const currentOrganizations$ = userOrganizations$;

export const allPersonalWorlds$ = computed(() => {
  const context = universeContext$.get();
  return context.personal.worlds || [];
});

export const allBusinessWorlds$ = computed(() => {
  const businessWorlds: World[] = [];
  const context = universeContext$.get();
  
  Object.values(context.organizations).forEach(org => {
    businessWorlds.push(...(org.businessWorlds || []));
  });
  
  return businessWorlds;
});

export const allActiveWorlds$ = computed(() => {
  const allWorlds = [
    ...allPersonalWorlds$.get(),
    ...allBusinessWorlds$.get()
  ];
  return allWorlds.filter(world => world.state === 'active');
});

export const allTeams$ = computed(() => {
  const allTeams: Team[] = [];
  const context = universeContext$.get();
  
  Object.values(context.organizations).forEach(org => {
    allTeams.push(...(org.teams || []));
  });
  
  return allTeams;
});

// New computed observable for loading state
export const isUniverseLoading$ = computed(() => {
  return universeWorkspace$.isLoading?.get() || false;
});

// Computed observable for initialization state
export const isUniverseInitialized$ = computed(() => {
  const context = universeContext$.get();
  return context.isInitialized;
});

// Helper functions for working with universe context - updated for synced observables
export const universeHelpers = {
  // Check if data is loaded
  isLoaded: () => {
    const context = universeContext$.get();
    return context.isInitialized && !isUniverseLoading$.get();
  },

  // Set authentication state (data loading handled separately by universe-loader)
  setAuthenticated: async (isAuth: boolean, userId?: string, sessionToken?: string) => {
    authContext$.set({
      isAuthenticated: isAuth,
      userId: userId || null,
      sessionToken: sessionToken || null
    });
    
    if (isAuth) {
      fileLog.info('[UniverseHelpers] Authentication set, ready for data loading');
      // Data loading is handled by universe-loader.ts when needed
    }
  },

  // Refresh workspace data (delegates to universe-loader)
  refresh: async () => {
    fileLog.info('[UniverseHelpers] Refresh requested - should be handled by universe-loader');
    // The actual refresh logic should be called from universe-loader.ts
    // This is just a placeholder - the loader should be imported and used
  },

  // Get organization by ID
  getOrganization: (orgId: string): OrganizationContext | undefined => {
    const context = universeContext$.get();
    return context.organizations[orgId];
  },

  // Get world by ID (searches across all organizations)
  getWorld: (worldId: string): World | undefined => {
    // Check personal worlds first
    const personalWorlds = allPersonalWorlds$.get();
    const personalWorld = personalWorlds.find(w => w.id === worldId);
    if (personalWorld) return personalWorld;

    // Check business worlds
    const businessWorlds = allBusinessWorlds$.get();
    return businessWorlds.find(w => w.id === worldId);
  },

  // Get team by ID
  getTeam: (teamId: string): Team | undefined => {
    const allTeams = allTeams$.get();
    return allTeams.find(t => t.id === teamId);
  },

  // Get worlds by team
  getWorldsByTeam: (teamId: string): World[] => {
    const allWorlds = [...allPersonalWorlds$.get(), ...allBusinessWorlds$.get()];
    return allWorlds.filter(world => world.team_id === teamId);
  },

  // Get worlds by organization
  getWorldsByOrg: (orgId: string): World[] => {
    const org = universeHelpers.getOrganization(orgId);
    if (!org) return [];
    return [...org.personalWorlds, ...org.businessWorlds];
  },

  // Clear authentication (for logout)
  clearAuth: () => {
    authContext$.set({
      isAuthenticated: false,
      userId: null,
      sessionToken: null
    });
  },

  // Get summary data (computed dynamically)
  getSummary: () => {
    const organizations = currentOrganizations$.get();
    const personalWorlds = allPersonalWorlds$.get();
    const businessWorlds = allBusinessWorlds$.get();
    const teams = allTeams$.get();
    const activeWorlds = allActiveWorlds$.get();

    return {
      totalOrganizations: organizations.length,
      totalPersonalWorlds: personalWorlds.length,
      totalBusinessWorlds: businessWorlds.length,
      totalTeams: teams.length,
      totalActiveWorlds: activeWorlds.length
    };
  }

  // Note: Individual world/team mutations should go through their specific APIs
  // The universe context is primarily read-only, fed by the workspace API
};

// Export the main context and helpers
export default universeContext$;

// Export function to load workspace data (delegated to universe-loader)
export { universeLoader } from '../loaders/universe-loader';