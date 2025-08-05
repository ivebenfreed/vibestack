import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// TODO: REFACTOR - Remove these DataForge operation wrappers
// These are being replaced by domain-dexie services (domainServices.project)
// Components should use domainServices.project.createUI/updateUI/deleteUI directly

// Export types for backward compatibility during refactoring
export type { CreateProjectInput, UpdateProjectInput } from '@repo/dataforge/project-operations';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Main projects store - holds all projects in normalized format
export const projectsAtom = createAtom<Record<string, Project>>({});

// ============================================================================
// React Hooks (Pure XState)
// ============================================================================

export const useProjectAtoms = {
  // All projects as sorted array
  allProjects: () => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        return projects.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      },
      shallowEqual
    );
  },

  // Single project by ID
  projectById: (id: string) => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => projectsRecord[id] || null,
      shallowEqual
    );
  },

  // Projects by owner ID
  projectsByOwner: (ownerId: string) => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        return projects
          .filter(project => project.ownerId === ownerId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Projects by status
  projectsByStatus: (status: ProjectStatus) => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        return projects
          .filter(project => project.status === status)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Active projects
  activeProjects: () => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        return projects
          .filter(project => project.status === ProjectStatus.ACTIVE)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  },

  // Project count
  projectCount: () => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => Object.keys(projectsRecord).length
    );
  },

  // Projects by multiple filters
  filteredProjects: (filters: {
    ownerId?: string;
    status?: ProjectStatus;
    category?: string;
  }) => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        return projects
          .filter(project => {
            if (filters.ownerId && project.ownerId !== filters.ownerId) return false;
            if (filters.status && project.status !== filters.status) return false;
            if (filters.category && project.category !== filters.category) return false;
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      shallowEqual
    );
  }
};

// TODO: REFACTOR - Remove these atom manipulation utilities
// These are legacy utilities that were used by DataForge operations
// Components should update atoms directly or use domain-dexie services

export const projectUtils = {
  loadProjects: (projects: Project[]) => {
    const projectsRecord = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
    projectsAtom.set(projectsRecord);
  },
  
  clearProjects: () => projectsAtom.set({}),
  
  // TODO: REFACTOR - This ensureLoaded pattern needs to be replaced
  // with view-based data loading like VibeGridDex
  ensureLoaded: async () => {
    console.log('[ProjectUtils] ensureLoaded called - needs refactoring to view-based loading');
  }
};