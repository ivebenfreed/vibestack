/**
 * Universe Loader
 * 
 * Loads universe, worlds, and teams data via dedicated APIs (not DataForge)
 * Populates the universeContext$ observable with core business logic data
 */

import { 
  universeContext$, 
  universeHelpers, 
  authContext$,
  universeWorkspace$,
  type World, 
  type Team, 
  type OrganizationContext 
} from '../observables/universe-context';

interface LoaderOptions {
  includeInactive?: boolean;
  includeArchived?: boolean;
  bustCache?: boolean;
}

class UniverseLoader {
  private baseUrl: string = '';

  constructor() {
    // Determine base URL based on environment
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  /**
   * Load complete user workspace - main loader for universe-centric navigation
   * Now uses synced observables for automatic reactive updates
   */
  async loadCompleteWorkspace(options: LoaderOptions = {}): Promise<void> {
    const { includeInactive = false, includeArchived = false, bustCache = false } = options;
    
    try {
      console.log('[UniverseLoader] Loading workspace via synced observable...');
      
      // Trigger the synced observable to load data
      // The syncedCrud configuration will handle the actual API call
      const workspaceData = universeWorkspace$.get();
      
      console.log('[UniverseLoader] Workspace data loaded:', {
        hasData: !!workspaceData,
        userId: workspaceData?.userId
      });
      
    } catch (error) {
      console.error('Error loading complete workspace:', error);
      throw error;
    }
  }

  /**
   * Load personal context only (universes and personal worlds)
   */
  async loadPersonalContext(options: LoaderOptions = {}): Promise<void> {
    const { includeInactive = false, includeArchived = false } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/personal?` + new URLSearchParams({
        includeInactive: String(includeInactive),
        includeArchived: String(includeArchived)
      }), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load personal context: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load personal context');
      }

      const personalData = result.data;

      // Set user ID
      if (personalData.userId) {
        universeHelpers.setUserId(personalData.userId);
      }

      // Set personal worlds
      if (personalData.personalWorlds) {
        universeHelpers.setPersonalContext(personalData.personalWorlds);
      }

    } catch (error) {
      console.error('Error loading personal context:', error);
      throw error;
    }
  }

  /**
   * Load specific organization context
   */
  async loadOrganizationContext(orgId: string, options: LoaderOptions = {}): Promise<void> {
    const { includeInactive = false, includeArchived = false } = options;

    try {
      // Load organization's business worlds
      const worldsResponse = await fetch(`${this.baseUrl}/api/worlds/business/org/${orgId}?` + new URLSearchParams({
        includeInactive: String(includeInactive),
        includeArchived: String(includeArchived)
      }), {
        credentials: 'include'
      });

      // Load organization's teams
      const teamsResponse = await fetch(`${this.baseUrl}/api/teams/org/${orgId}`, {
        credentials: 'include'
      });

      // Load user's universe in this org
      const universeResponse = await fetch(`${this.baseUrl}/api/universe/org/${orgId}`, {
        credentials: 'include'
      });

      const [worldsResult, teamsResult, universeResult] = await Promise.all([
        worldsResponse.json(),
        teamsResponse.json(),
        universeResponse.json()
      ]);

      // Get current org context or create new one
      const currentOrg = universeHelpers.getOrganization(orgId);
      
      const updatedOrgContext: OrganizationContext = {
        info: currentOrg?.info || { 
          id: orgId, 
          name: 'Unknown', 
          slug: '', 
          role: 'member', 
          joinedAt: new Date().toISOString() 
        },
        universe: universeResult.success ? universeResult.data : undefined,
        teams: teamsResult.success ? teamsResult.data : [],
        businessWorlds: worldsResult.success ? worldsResult.data : [],
        personalWorlds: currentOrg?.personalWorlds || []
      };

      universeHelpers.setOrganizationContext(orgId, updatedOrgContext);

    } catch (error) {
      console.error(`Error loading organization context for ${orgId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh specific world data
   */
  async refreshWorld(worldId: string): Promise<void> {
    try {
      // We need to find which API to call based on world type
      // For now, we'll try to find the world in current context
      const existingWorld = universeHelpers.getWorld(worldId);
      
      if (!existingWorld) {
        throw new Error(`World ${worldId} not found in current context`);
      }

      // Reload the organization context to get updated world data
      await this.loadOrganizationContext(existingWorld.organization_id);

    } catch (error) {
      console.error(`Error refreshing world ${worldId}:`, error);
      throw error;
    }
  }

  /**
   * Create new world
   */
  async createWorld(worldData: {
    name: string;
    description?: string;
    organizationId: string;
    teamId?: string;
    universeId?: string;
    state?: string;
    worldType?: string;
    priority?: string;
  }): Promise<World> {
    try {
      const { organizationId, teamId, ...payload } = worldData;
      
      let endpoint: string;
      if (teamId) {
        endpoint = `${this.baseUrl}/api/worlds/team/${teamId}`;
      } else {
        endpoint = `${this.baseUrl}/api/worlds/org/${organizationId}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          universe_id: payload.universeId,
          state: payload.state || 'active',
          world_type: payload.worldType || 'business',
          priority: payload.priority || 'medium'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create world: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create world');
      }

      const newWorld = result.data;

      // Update context with new world
      universeHelpers.upsertWorld(newWorld);

      return newWorld;

    } catch (error) {
      console.error('Error creating world:', error);
      throw error;
    }
  }

  /**
   * Update existing world
   */
  async updateWorld(worldId: string, updates: Partial<{
    name: string;
    description: string;
    teamId: string;
    state: string;
    worldType: string;
    priority: string;
  }>): Promise<World> {
    try {
      const response = await fetch(`${this.baseUrl}/api/worlds/${worldId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          team_id: updates.teamId,
          state: updates.state,
          world_type: updates.worldType,
          priority: updates.priority
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update world: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update world');
      }

      const updatedWorld = result.data;

      // Update context
      universeHelpers.upsertWorld(updatedWorld);

      return updatedWorld;

    } catch (error) {
      console.error(`Error updating world ${worldId}:`, error);
      throw error;
    }
  }

  /**
   * Delete world
   */
  async deleteWorld(worldId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/worlds/${worldId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete world: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete world');
      }

      // Remove from context
      universeHelpers.removeWorld(worldId);

    } catch (error) {
      console.error(`Error deleting world ${worldId}:`, error);
      throw error;
    }
  }

  /**
   * Create new team
   */
  async createTeam(teamData: {
    name: string;
    description?: string;
    organizationId: string;
    parentTeamId?: string;
    teamType?: string;
  }): Promise<Team> {
    try {
      const response = await fetch(`${this.baseUrl}/api/teams/org/${teamData.organizationId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: teamData.name,
          description: teamData.description,
          parent_team_id: teamData.parentTeamId,
          team_type: teamData.teamType || 'department'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create team: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create team');
      }

      const newTeam = result.data;

      // Refresh organization context to include new team
      await this.loadOrganizationContext(teamData.organizationId);

      return newTeam;

    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  }

  /**
   * Initialize universe context - main entry point
   * Sets authentication state to trigger synced observables
   */
  async initialize(options: LoaderOptions = {}): Promise<void> {
    try {
      console.log('[UniverseLoader] Initializing universe context with synced observables...');
      
      // Set authentication state to trigger synced data loading
      // In a real implementation, you'd get this from your auth system
      universeHelpers.setAuthenticated(true, 'current-user-id');
      
      // Load workspace data via synced observable
      await this.loadCompleteWorkspace(options);
      
      console.log('[UniverseLoader] Universe context initialized successfully');
      
    } catch (error) {
      console.error('Error initializing universe context:', error);
      // Don't throw to allow partial functionality
    }
  }

  /**
   * Refresh all data
   */
  async refresh(options: LoaderOptions = {}): Promise<void> {
    try {
      universeHelpers.setLoading(true);
      await this.loadCompleteWorkspace({ ...options, bustCache: true });
    } catch (error) {
      console.error('Error refreshing universe context:', error);
      universeHelpers.setLoading(false, error instanceof Error ? error.message : 'Refresh failed');
      throw error;
    }
  }
}

// Export singleton instance
export const universeLoader = new UniverseLoader();

// Export class for testing or custom instances
export { UniverseLoader };