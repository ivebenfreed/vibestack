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
// Service Layer (legacy interface for compatibility)
// ============================================================================

export const projectService = {
  /**
   * Create a new project (delegates to UI operation)
   */
  async create(projectData: CreateProjectInput): Promise<Project> {
    return createProjectUI(projectData);
  },

  /**
   * Update a project (delegates to UI operation)
   */
  async update(projectId: string, updates: UpdateProjectInput): Promise<Project | null> {
    try {
      return await updateProjectUI(projectId, updates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Delete a project (delegates to UI operation)
   */
  async delete(projectId: string): Promise<boolean> {
    return deleteProjectUI(projectId);
  },

  /**
   * Get a single project by ID
   */
  async get(projectId: string): Promise<Project | null> {
    const project = await db.projects.get(projectId);
    return project || null;
  },

  /**
   * Get all projects
   */
  async getAll(): Promise<Project[]> {
    return await db.projects.toArray();
  },

  /**
   * Get projects by owner
   */
  async getByOwner(ownerId: string): Promise<Project[]> {
    return await db.projects.where('ownerId').equals(ownerId).toArray();
  },

  /**
   * Get projects by status
   */
  async getByStatus(status: ProjectStatus): Promise<Project[]> {
    return await db.projects.where('status').equals(status).toArray();
  },

  /**
   * Add member to project
   */
  async addMember(projectId: string, userId: string, role: string = 'member'): Promise<void> {
    await db.project_members.put({
      projectId,
      userId,
      role
    });
  },

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    await db.project_members
      .where('[projectId+userId]')
      .equals([projectId, userId])
      .delete();
  },

  /**
   * Update member role
   */
  async updateMemberRole(projectId: string, userId: string, role: string): Promise<void> {
    await db.project_members
      .where('[projectId+userId]')
      .equals([projectId, userId])
      .modify({ role });
  },
};

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

// ============================================================================
// Repository Pattern (for complex operations)
// ============================================================================

export const projectRepository = {
  /**
   * Get project with all related data
   */
  async getProjectWithRelations(projectId: string) {
    const [project, tasks, members] = await Promise.all([
      db.projects.get(projectId),
      db.tasks.where('projectId').equals(projectId).toArray(),
      db.project_members.where('projectId').equals(projectId).toArray()
    ]);

    if (!project) return null;

    // Get member details
    const memberUserIds = members.map(m => m.userId);
    const memberUsers = await db.users.bulkGet(memberUserIds);

    const fullMembers = members.map(member => ({
      ...member,
      user: memberUsers.find(u => u?.id === member.userId)
    })).filter(m => m.user);

    return {
      ...project,
      tasks,
      members: fullMembers,
      taskCount: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      completionPercentage: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0
    };
  },

  /**
   * Get project dashboard data
   */
  async getProjectDashboard(projectId: string) {
    const [project, tasks, members] = await Promise.all([
      db.projects.get(projectId),
      db.tasks.where('projectId').equals(projectId).toArray(),
      db.project_members.where('projectId').equals(projectId).toArray()
    ]);

    if (!project) return null;

    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      todo: tasks.filter(t => t.status === 'todo').length,
      overdue: tasks.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date() && t.status !== 'completed';
      }).length,
    };

    const recentTasks = tasks
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    return {
      project,
      taskStats,
      recentTasks,
      memberCount: members.length,
      completionPercentage: taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0
    };
  },

  /**
   * Get projects with task counts
   */
  async getProjectsWithTaskCounts(): Promise<Array<Project & { taskCount: number; completedTasks: number }>> {
    const projects = await db.projects.toArray();
    
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await db.tasks.where('projectId').equals(project.id).toArray();
        return {
          ...project,
          taskCount: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'completed').length
        };
      })
    );

    return projectsWithCounts;
  },
};

// ============================================================================
// Utilities
// ============================================================================

export const projectUtils = {
  /**
   * Calculate project health score based on completion and deadlines
   */
  async getProjectHealth(projectId: string): Promise<{
    score: number;
    status: 'healthy' | 'at_risk' | 'critical';
    factors: string[];
  }> {
    const project = await db.projects.get(projectId);
    if (!project) return { score: 0, status: 'critical', factors: ['Project not found'] };

    const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
    const factors: string[] = [];
    let score = 100;

    // Check completion rate
    const completionRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) : 0;
    if (completionRate < 0.3) {
      score -= 30;
      factors.push('Low completion rate');
    } else if (completionRate < 0.6) {
      score -= 15;
      factors.push('Moderate completion rate');
    }

    // Check overdue tasks
    const overdueTasks = tasks.filter(t => {
      if (!t.dueDate || t.status === 'completed') return false;
      return new Date(t.dueDate) < new Date();
    });
    
    if (overdueTasks.length > 0) {
      const overduePercentage = overdueTasks.length / tasks.length;
      if (overduePercentage > 0.2) {
        score -= 25;
        factors.push('High overdue task percentage');
      } else if (overduePercentage > 0.1) {
        score -= 10;
        factors.push('Some overdue tasks');
      }
    }

    // Check project deadline
    if (project.endDate) {
      const daysUntilDeadline = Math.ceil((new Date(project.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 0) {
        score -= 20;
        factors.push('Project past deadline');
      } else if (daysUntilDeadline < 7) {
        score -= 10;
        factors.push('Project deadline approaching');
      }
    }

    let status: 'healthy' | 'at_risk' | 'critical';
    if (score >= 80) status = 'healthy';
    else if (score >= 60) status = 'at_risk';
    else status = 'critical';

    return { score: Math.max(0, score), status, factors };
  },

  /**
   * Get project timeline data
   */
  async getProjectTimeline(projectId: string) {
    const [project, tasks] = await Promise.all([
      db.projects.get(projectId),
      db.tasks.where('projectId').equals(projectId).toArray()
    ]);

    if (!project) return null;

    const timeline = tasks
      .filter(t => t.createdAt || t.updatedAt)
      .map(task => ({
        id: task.id,
        title: task.title,
        type: 'task',
        date: task.updatedAt || task.createdAt,
        status: task.status
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      project,
      timeline,
      startDate: project.startDate,
      endDate: project.endDate,
      duration: project.startDate && project.endDate 
        ? Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : null
    };
  },
  
  /**
   * Load projects (for compatibility with atomic store pattern)
   */
  loadProjects: async (projects: Project[]) => {
    // Clear existing and load new projects
    await db.projects.clear();
    await db.projects.bulkAdd(projects);
  },
  
  /**
   * Clear all projects
   */
  clearProjects: async () => {
    await db.projects.clear();
  },
  
  /**
   * Ensure loaded (compatibility method - Dexie is always "loaded")
   */
  ensureLoaded: async () => {
    // No-op for Dexie - data is always available from IndexedDB
    // This method exists for API compatibility with atomic store pattern
    return;
  },
};