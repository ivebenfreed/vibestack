/**
 * Project Domain - Re-export from new domain service architecture
 * 
 * This file now re-exports from the new formalized domain services.
 * The old implementation has been moved to project-service.ts
 */

import { domainServices } from './index';
import type { Project } from '@repo/dataforge/client-entities';
import type { CreateProjectInput, UpdateProjectInput } from './project-service';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';

// Re-export types
export type { Project, ProjectStatus } from '@repo/dataforge/client-entities';
export type { CreateProjectInput, UpdateProjectInput } from './project-service';

// ============================================================================
// Function Exports (for backward compatibility)
// ============================================================================

export const createProjectUI = (input: CreateProjectInput): Promise<Project> => domainServices.project.createUI(input);
export const updateProjectUI = (id: string, updates: UpdateProjectInput): Promise<Project> => domainServices.project.updateUI(id, updates);
export const deleteProjectUI = (id: string): Promise<boolean> => domainServices.project.deleteUI(id);
export const createProjectIncoming = (project: Project): Promise<Project> => domainServices.project.createIncoming(project);
export const updateProjectIncoming = (id: string, updates: Partial<Project>): Promise<Project> => domainServices.project.updateIncoming(id, updates);
export const deleteProjectIncoming = (id: string): Promise<boolean> => domainServices.project.deleteIncoming(id);
export const addProjectMemberUI = (projectId: string, userId: string, role?: string): Promise<void> => domainServices.project.addProjectMemberUI(projectId, userId, role);
export const removeProjectMemberUI = (projectId: string, userId: string): Promise<void> => domainServices.project.removeProjectMemberUI(projectId, userId);
export const updateProjectMemberRoleUI = async (projectId: string, userId: string, role: string): Promise<void> => {
  await removeProjectMemberUI(projectId, userId);
  await addProjectMemberUI(projectId, userId, role);
};

// ============================================================================
// Live Query Hooks (kept for backward compatibility)
// ============================================================================

export const useProjectQueries = {
  /**
   * Get all projects (reactive)
   */
  allProjects: () => {
    return useLiveQuery(() => db.projects.toArray()) || [];
  },

  /**
   * Get projects by status (reactive)
   */
  byStatus: (status: string) => {
    return useLiveQuery(
      () => status ? db.projects.where('status').equals(status).toArray() : [],
      [status]
    ) || [];
  },

  /**
   * Get projects by owner (reactive)
   */
  byOwner: (userId: string) => {
    return useLiveQuery(
      () => userId ? db.projects.where('ownerId').equals(userId).toArray() : [],
      [userId]
    ) || [];
  },

  /**
   * Get project by ID (reactive)
   */
  byId: (projectId: string) => {
    return useLiveQuery(
      () => projectId ? db.projects.get(projectId) : undefined,
      [projectId]
    );
  },

  /**
   * Get project count (reactive)
   */
  count: () => {
    return useLiveQuery(() => db.projects.count()) || 0;
  },

  /**
   * Get project members (reactive)
   */
  members: (projectId: string) => {
    return useLiveQuery(
      () => projectId ? db.project_members.where('projectId').equals(projectId).toArray() : [],
      [projectId]
    ) || [];
  },

  /**
   * Get projects user is member of (reactive)
   */
  byMember: (userId: string) => {
    return useLiveQuery(async () => {
      if (!userId) return [];
      
      const memberships = await db.project_members
        .where('userId')
        .equals(userId)
        .toArray();
      
      const projectIds = memberships.map(m => m.projectId);
      if (projectIds.length === 0) return [];
      
      return db.projects
        .where('id')
        .anyOf(projectIds)
        .toArray();
    }, [userId]) || [];
  },
};