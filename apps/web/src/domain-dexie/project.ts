/**
 * Dexie-based Project Domain
 * 
 * This is a parallel implementation that uses Dexie live queries instead of atomic stores.
 * Shows how to handle relationships and complex queries with Dexie.
 * 
 * Uses the same 3-path pattern as the XState domain:
 * - UI operations: Include manual sync tracking via trackOutgoingChange
 * - Incoming operations: Server sync without tracking (to avoid loops)
 * - Direct Dexie updates: For live queries to react
 */

import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// ============================================================================
// Types
// ============================================================================

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  priority?: 'low' | 'medium' | 'high';
  budget?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  priority?: 'low' | 'medium' | 'high';
  budget?: number;
  actualCost?: number;
}

// ============================================================================
// UI Operations (with sync tracking)
// ============================================================================

/**
 * Create Project from UI - includes manual sync tracking
 */
export async function createProjectUI(projectData: CreateProjectInput): Promise<Project> {
  const project: Project = {
    id: nanoid(),
    name: projectData.name,
    description: projectData.description || '',
    status: projectData.status || 'active',
    ownerId: projectData.ownerId || 'current-user',
    startDate: projectData.startDate,
    endDate: projectData.endDate,
    priority: projectData.priority || 'medium',
    budget: projectData.budget,
    actualCost: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientId: 'dexie-client',
    userId: 'current-user',
  };

  // Apply to Dexie
  await db.projects.add(project);
  
  // Track for outgoing sync
  await trackOutgoingChange('projects', 'insert', project);
  
  return project;
}

/**
 * Update Project from UI - includes manual sync tracking
 */
export async function updateProjectUI(projectId: string, updates: UpdateProjectInput): Promise<Project> {
  const existingProject = await db.projects.get(projectId);
  if (!existingProject) {
    throw new Error(`Project ${projectId} not found`);
  }

  const updatedProject: Project = {
    ...existingProject,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Apply to Dexie
  await db.projects.put(updatedProject);
  
  // Track for outgoing sync
  await trackOutgoingChange('projects', 'update', updatedProject);
  
  return updatedProject;
}

/**
 * Delete Project from UI - includes manual sync tracking
 */
export async function deleteProjectUI(projectId: string): Promise<boolean> {
  const existingProject = await db.projects.get(projectId);
  if (!existingProject) {
    return false;
  }

  try {
    await db.transaction('rw', db.projects, db.project_members, db.project_status_sets, db.project_tag_sets, db.tasks, async () => {
      // Delete the project
      await db.projects.delete(projectId);
      
      // Clean up relationships
      await db.project_members.where('projectId').equals(projectId).delete();
      await db.project_status_sets.where('projectId').equals(projectId).delete();
      await db.project_tag_sets.where('projectId').equals(projectId).delete();
      
      // Optional: Delete associated tasks or just unlink them
      // For now, we'll unlink them
      const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray();
      for (const task of projectTasks) {
        await db.tasks.put({ ...task, projectId: undefined, updatedAt: new Date().toISOString() });
      }
    });
    
    // Track for outgoing sync
    await trackOutgoingChange('projects', 'delete', existingProject);
    
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

// ============================================================================
// Incoming Operations (no sync tracking)
// ============================================================================

/**
 * Create Project from incoming sync - no tracking to avoid loops
 */
export async function createProjectIncoming(projectData: Project): Promise<Project> {
  // Apply to Dexie without tracking
  await db.projects.add(projectData);
  return projectData;
}

/**
 * Update Project from incoming sync - no tracking to avoid loops
 */
export async function updateProjectIncoming(projectId: string, updates: Partial<Project>): Promise<Project> {
  const existingProject = await db.projects.get(projectId);
  if (!existingProject) {
    throw new Error(`Project ${projectId} not found`);
  }

  const updatedProject: Project = {
    ...existingProject,
    ...updates,
  };

  // Apply to Dexie without tracking
  await db.projects.put(updatedProject);
  return updatedProject;
}

/**
 * Delete Project from incoming sync - no tracking to avoid loops
 */
export async function deleteProjectIncoming(projectId: string): Promise<boolean> {
  try {
    await db.transaction('rw', db.projects, db.project_members, db.project_status_sets, db.project_tag_sets, db.tasks, async () => {
      // Delete the project
      await db.projects.delete(projectId);
      
      // Clean up relationships
      await db.project_members.where('projectId').equals(projectId).delete();
      await db.project_status_sets.where('projectId').equals(projectId).delete();
      await db.project_tag_sets.where('projectId').equals(projectId).delete();
      
      // Unlink tasks
      const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray();
      for (const task of projectTasks) {
        await db.tasks.put({ ...task, projectId: undefined, updatedAt: new Date().toISOString() });
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

// ============================================================================
// Project Member Operations (UI with sync tracking)
// ============================================================================

/**
 * Add member to project from UI - includes manual sync tracking
 */
export async function addProjectMemberUI(projectId: string, userId: string, role: string = 'member'): Promise<void> {
  const memberData = {
    projectId,
    userId,
    role
  };
  
  await db.project_members.put(memberData);
  
  // Track for outgoing sync
  await trackOutgoingChange('project_members', 'insert', memberData);
}

/**
 * Remove member from project from UI - includes manual sync tracking
 */
export async function removeProjectMemberUI(projectId: string, userId: string): Promise<void> {
  const member = await db.project_members
    .where('[projectId+userId]')
    .equals([projectId, userId])
    .first();
    
  if (member) {
    await db.project_members
      .where('[projectId+userId]')
      .equals([projectId, userId])
      .delete();
    
    // Track for outgoing sync
    await trackOutgoingChange('project_members', 'delete', member);
  }
}

/**
 * Update member role from UI - includes manual sync tracking
 */
export async function updateProjectMemberRoleUI(projectId: string, userId: string, role: string): Promise<void> {
  const member = await db.project_members
    .where('[projectId+userId]')
    .equals([projectId, userId])
    .first();
    
  if (member) {
    const updatedMember = { ...member, role };
    
    await db.project_members
      .where('[projectId+userId]')
      .equals([projectId, userId])
      .modify({ role });
    
    // Track for outgoing sync
    await trackOutgoingChange('project_members', 'update', updatedMember);
  }
}

// ============================================================================
// Live Query Hooks (Replace Atomic Store Hooks)
// ============================================================================

export const useProjectQueries = {
  /**
   * Get all projects (sorted by creation date)
   */
  allProjects: () => {
    return useLiveQuery(async () => {
      const projects = await db.projects.toArray();
      return projects.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
  },

  /**
   * Get a single project by ID
   */
  projectById: (id: string) => {
    return useLiveQuery(async () => {
      return await db.projects.get(id);
    }, [id]);
  },

  /**
   * Get projects by owner ID
   */
  projectsByOwner: (ownerId: string) => {
    return useLiveQuery(async () => {
      if (!ownerId) return [];
      return await db.projects.where('ownerId').equals(ownerId).toArray();
    }, [ownerId]);
  },

  /**
   * Get projects by status
   */
  projectsByStatus: (status: ProjectStatus) => {
    return useLiveQuery(async () => {
      return await db.projects.where('status').equals(status).toArray();
    }, [status]);
  },

  /**
   * Get active projects
   */
  activeProjects: () => {
    return useLiveQuery(async () => {
      return await db.projects.where('status').equals('active').toArray();
    });
  },

  /**
   * Get project count
   */
  projectCount: () => {
    return useLiveQuery(async () => {
      return await db.projects.count();
    });
  },

  /**
   * Get project statistics
   */
  projectStats: () => {
    return useLiveQuery(async () => {
      const projects = await db.projects.toArray();
      
      const stats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        onHold: projects.filter(p => p.status === 'on_hold').length,
        archived: projects.filter(p => p.status === 'archived').length,
        byStatus: new Map<ProjectStatus, number>(),
        byPriority: new Map<string, number>(),
      };

      // Group by status
      projects.forEach(project => {
        const statusCount = stats.byStatus.get(project.status) || 0;
        stats.byStatus.set(project.status, statusCount + 1);
        
        if (project.priority) {
          const priorityCount = stats.byPriority.get(project.priority) || 0;
          stats.byPriority.set(project.priority, priorityCount + 1);
        }
      });

      return stats;
    });
  },

  /**
   * Get recent projects (last 10)
   */
  recentProjects: () => {
    return useLiveQuery(async () => {
      const projects = await db.projects.orderBy('updatedAt').reverse().limit(10).toArray();
      return projects;
    });
  },

  /**
   * Search projects by name/description
   */
  searchProjects: (query: string) => {
    return useLiveQuery(async () => {
      if (!query.trim()) return [];
      
      const projects = await db.projects.toArray();
      const searchLower = query.toLowerCase();
      
      return projects.filter(project => 
        project.name.toLowerCase().includes(searchLower) ||
        (project.description && project.description.toLowerCase().includes(searchLower))
      );
    }, [query]);
  },

  /**
   * Get project members
   */
  projectMembers: (projectId: string) => {
    return useLiveQuery(async () => {
      if (!projectId) return [];
      
      const members = await db.project_members.where('projectId').equals(projectId).toArray();
      const userIds = members.map(m => m.userId);
      const users = await db.users.bulkGet(userIds);
      
      return members.map(member => ({
        ...member,
        user: users.find(u => u?.id === member.userId)
      })).filter(m => m.user);
    }, [projectId]);
  },

  /**
   * Get projects where user is a member
   */
  memberProjects: (userId: string) => {
    return useLiveQuery(async () => {
      if (!userId) return [];
      
      const memberships = await db.project_members.where('userId').equals(userId).toArray();
      const projectIds = memberships.map(m => m.projectId);
      const projects = await db.projects.bulkGet(projectIds);
      
      return projects.filter(Boolean).map(project => ({
        ...project,
        role: memberships.find(m => m.projectId === project!.id)?.role
      }));
    }, [userId]);
  },
};

