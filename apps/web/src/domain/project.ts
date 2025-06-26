import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

// Import DataForge operations
import {
  createProjectUI as _createProjectUI,
  updateProjectUI as _updateProjectUI,
  deleteProjectUI as _deleteProjectUI,
  createProjectIncoming as _createProjectIncoming,
  updateProjectIncoming as _updateProjectIncoming,
  deleteProjectIncoming as _deleteProjectIncoming,
  createProjectLiveChanges as _createProjectLiveChanges,
  updateProjectLiveChanges as _updateProjectLiveChanges,
  deleteProjectLiveChanges as _deleteProjectLiveChanges,
  type CreateProjectInput,
  type UpdateProjectInput
} from '@repo/dataforge/project-operations';

// Export types
export type { CreateProjectInput, UpdateProjectInput };

// Wrapper functions that handle dependencies internally
export async function createProjectUI(projectData: CreateProjectInput): Promise<Project> {
  const dependencies = await getProjectDependencies();
  return _createProjectUI(projectData, dependencies);
}

export async function updateProjectUI(projectId: string, updates: UpdateProjectInput): Promise<Project> {
  const dependencies = await getProjectDependencies();
  return _updateProjectUI(projectId, updates, dependencies);
}

export async function deleteProjectUI(projectId: string): Promise<boolean> {
  const dependencies = await getProjectDependencies();
  return _deleteProjectUI(projectId, dependencies);
}

export async function createProjectIncoming(projectData: Project): Promise<Project> {
  const dependencies = await getProjectDependencies();
  return _createProjectIncoming(projectData, dependencies);
}

export async function updateProjectIncoming(projectId: string, updates: Partial<Project>): Promise<Project> {
  const dependencies = await getProjectDependencies();
  return _updateProjectIncoming(projectId, updates, dependencies);
}

export async function deleteProjectIncoming(projectId: string): Promise<boolean> {
  const dependencies = await getProjectDependencies();
  return _deleteProjectIncoming(projectId, dependencies);
}

export function createProjectLiveChanges(projectData: Project): void {
  const dependencies = { atomActions };
  return _createProjectLiveChanges(projectData, dependencies);
}

export function updateProjectLiveChanges(projectId: string, updates: Partial<Project>): void {
  const dependencies = { atomActions };
  return _updateProjectLiveChanges(projectId, updates, dependencies);
}

export function deleteProjectLiveChanges(projectId: string): void {
  const dependencies = { atomActions };
  return _deleteProjectLiveChanges(projectId, dependencies);
}

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

// ============================================================================
// Atom Utilities for DataForge Operations
// ============================================================================

export const atomActions = {
  createProjectAtomOnly: (project: Project) => {
    const currentProjects = projectsAtom.get();
    projectsAtom.set({ ...currentProjects, [project.id]: project });
  },
  
  updateProjectAtomOnly: (id: string, updates: Partial<Project>) => {
    const currentProjects = projectsAtom.get();
    const existingProject = currentProjects[id];
    if (existingProject) {
      projectsAtom.set({ ...currentProjects, [id]: { ...existingProject, ...updates } });
    }
  },
  
  deleteProjectAtomOnly: (id: string) => {
    const currentProjects = projectsAtom.get();
    const { [id]: deleted, ...remaining } = currentProjects;
    projectsAtom.set(remaining);
  },
  
  // Expose atom for DataForge operations
  projectsAtom: projectsAtom
};

export const projectUtils = {
  loadProjects: (projects: Project[]) => {
    const projectsRecord = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
    projectsAtom.set(projectsRecord);
  },
  
  clearProjects: () => projectsAtom.set({}),
  
  ensureLoaded: async () => {
    if (Object.keys(projectsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const projects = await dataSource.getRepository(Project).find({
        relations: ['owner', 'members']
      });
      projectUtils.loadProjects(projects);
    }
  }
};

// Helper to get dependencies for DataForge operations
export async function getProjectDependencies() {
  const { getGlobalDataSource } = await import('@/db/global-datasource');
  const { getGlobalServicesV3 } = await import('@/state-machines/machines/sync-machine-v3');
  
  const dataSource = await getGlobalDataSource();
  const services = getGlobalServicesV3();
  
  return {
    dataSource,
    EntityClass: Project,
    atomActions,
    outgoingChangeService: services?.outgoingChangeService || null
  };
}

export async function bulkCreateProjectsIncoming(projectsData: Project[]): Promise<Project[]> {
  if (projectsData.length === 0) return [];
  
  console.log(`[ProjectDomain] Bulk creating ${projectsData.length} projects from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getGlobalDataSource } = await import('@/db/global-datasource');
    const dataSource = await getGlobalDataSource();
    
    // Apply to database in bulk
    const projectRepo = dataSource.getRepository(Project);
    const result = await projectRepo.insert(projectsData);
    
    // Get the inserted projects (use original data since insert doesn't return full records)
    const insertedProjects = projectsData;
    
    // Update atoms in batch
    const currentProjects = projectsAtom.get();
    const newProjectsRecord = { ...currentProjects };
    
    insertedProjects.forEach(project => {
      newProjectsRecord[project.id] = project;
    });
    
    projectsAtom.set(newProjectsRecord);
    
    const processingTime = Date.now() - startTime;
    const throughput = (projectsData.length / processingTime) * 1000;
    console.log(`[ProjectDomain] ✅ Bulk inserted ${projectsData.length} projects in ${processingTime}ms (${throughput.toFixed(0)} projects/sec)`);
    
    return insertedProjects;
    
  } catch (error) {
    console.error(`[ProjectDomain] ❌ Bulk insert failed for ${projectsData.length} projects:`, error);
    throw error;
  }
}