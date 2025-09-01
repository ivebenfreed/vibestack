/**
 * Universe Context Observable
 * 
 * Synced universe-centric data model using syncedCrud for reactive updates
 * Connects to workspace API for cross-organization data aggregation
 * Manages user's complete universe including personal worlds and business contexts across all organizations
 */

import { observable, computed, type Observable } from '@legendapp/state';
import { stateLog } from '@/logger';

const log = stateLog('legend-state/universe-context.ts');

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
  role: 'member' | 'manager' | 'admin' | 'owner';
  joinedAt: string;
}

export interface OrganizationContext {
  info: OrgInfo;
  universe?: Universe;
  teams: Team[];
  businessWorlds: World[];
  personalWorlds: World[]; // Personal worlds in this organization
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

// Function to load workspace data
export const loadWorkspaceData = async (): Promise<any> => {
  const auth = authContext$.get();
  
  if (!auth.isAuthenticated) {
    return null;
  }
  
  log.info('[UniverseWorkspace] Loading complete workspace data');
  
  try {
    const response = await fetch('/api/workspace/complete?includeInactive=false&includeArchived=false&includeCounts=true', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load workspace: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load workspace');
    }

    log.info('[UniverseWorkspace] Loaded workspace data:', {
      organizations: Object.keys(result.data.organizations || {}).length,
      personalWorlds: result.data.personal?.worlds?.length || 0,
      businessWorlds: result.data.business?.worlds?.length || 0
    });

    // Update the observable with the loaded data
    universeWorkspace$.set(result.data);
    return result.data;
  } catch (error) {
    log.error('[UniverseWorkspace] Failed to load workspace:', error);
    throw error;
  }
};

// Create the main universe context observable that combines auth and workspace data
export const universeContext$: Observable<UniverseContextData> = observable(() => {
  const workspaceData = universeWorkspace$.get();
  const auth = authContext$.get();
  
  if (!auth.isAuthenticated || !workspaceData) {
    return initialUniverseContext;
  }
  
  // Transform workspace API response into universe context structure
  const context: UniverseContextData = {
    userId: workspaceData.userId || auth.userId || '',
    isInitialized: !!workspaceData.userId,
    isLoading: false,
    error: null,
    lastUpdated: workspaceData.lastUpdated || new Date().toISOString(),
    organizations: workspaceData.organizations || {},
    personal: {
      worlds: workspaceData.personal?.worlds || []
    }
  };
  
  return context;
});

// Computed observables for common use cases - now working with synced data
export const currentOrganizations$ = computed(() => {
  const context = universeContext$.get();
  return Object.values(context.organizations);
});

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

  // Set authentication state and load data
  setAuthenticated: async (isAuth: boolean, userId?: string, sessionToken?: string) => {
    authContext$.set({
      isAuthenticated: isAuth,
      userId: userId || null,
      sessionToken: sessionToken || null
    });
    
    if (isAuth && userId) {
      log.info('[UniverseHelpers] Authentication set, loading workspace data');
      try {
        await loadWorkspaceData();
      } catch (error) {
        log.error('[UniverseHelpers] Failed to load workspace after auth:', error);
      }
    }
  },

  // Refresh workspace data
  refresh: async () => {
    log.info('[UniverseHelpers] Refreshing workspace data');
    try {
      await loadWorkspaceData();
    } catch (error) {
      log.error('[UniverseHelpers] Failed to refresh workspace:', error);
      throw error;
    }
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