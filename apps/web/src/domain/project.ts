import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// Imports for 3-path architecture wrapper functions
import { 
  createProjectUI as generatedCreateProjectUI,
  updateProjectUI as generatedUpdateProjectUI,
  deleteProjectUI as generatedDeleteProjectUI,
  createProjectIncoming as generatedCreateProjectIncoming,
  updateProjectIncoming as generatedUpdateProjectIncoming,
  deleteProjectIncoming as generatedDeleteProjectIncoming,
  createProjectLiveChanges as generatedCreateProjectLiveChanges,
  updateProjectLiveChanges as generatedUpdateProjectLiveChanges,
  deleteProjectLiveChanges as generatedDeleteProjectLiveChanges,
  type CreateProjectInput,
  type UpdateProjectInput
} from '@repo/dataforge/project-operations';

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
// XState Atom Actions
// ============================================================================

export const projectActions = {
  // Create new project in atom
  createProject: (project: Project) => {
    const currentProjects = projectsAtom.get();
    projectsAtom.set({
      ...currentProjects,
      [project.id]: project
    });
  },

  // Update existing project in atom
  updateProjectAtomOnly: (id: string, updates: Partial<Project>) => {
    const currentProjects = projectsAtom.get();
    const existingProject = currentProjects[id];
    if (!existingProject) {
      console.warn(`[ProjectActions] Project ${id} not found for update`);
      return;
    }
    
    projectsAtom.set({
      ...currentProjects,
      [id]: { ...existingProject, ...updates }
    });
  },

  // Delete project from atom
  deleteProjectAtomOnly: (id: string) => {
    const currentProjects = projectsAtom.get();
    const { [id]: deleted, ...remaining } = currentProjects;
    projectsAtom.set(remaining);
  },

  // Load multiple projects (for initial load)
  loadProjects: (projects: Project[]) => {
    const projectsRecord = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, Project>);
    
    projectsAtom.set(projectsRecord);
  },

  // Clear all projects
  clearProjects: () => {
    projectsAtom.set({});
  },

  // Ensure projects are loaded (high-performance direct check)
  ensureLoaded: async () => {
    if (Object.keys(projectsAtom.get()).length === 0) {
      const { getGlobalDataSource } = await import('@/db/global-datasource');
      const dataSource = await getGlobalDataSource();
      const projects = await dataSource.getRepository(Project).find({
        relations: ['owner', 'members']
      });
      projectActions.loadProjects(projects);
    }
  }
};

// ============================================================================
// 3-Path Architecture Wrapper Functions
// ============================================================================

/**
 * Create project from UI - thin wrapper around generated function
 */
export async function createProjectUI(projectData: CreateProjectInput): Promise<Project> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedCreateProjectUI(projectData, {
    dataSource,
    EntityClass: Project,
    atomActions: projectActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Update project from UI - thin wrapper around generated function
 */
export async function updateProjectUI(projectId: string, updates: UpdateProjectInput): Promise<Project> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedUpdateProjectUI(projectId, updates, {
    dataSource,
    EntityClass: Project,
    atomActions: projectActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Delete project from UI - thin wrapper around generated function
 */
export async function deleteProjectUI(projectId: string): Promise<boolean> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const { getGlobalServicesV3 } = await import('../state-machines/machines/sync-machine-v3');
  
  const dataSource = await getNewPGliteDataSource();
  const services = getGlobalServicesV3();
  
  return generatedDeleteProjectUI(projectId, {
    dataSource,
    EntityClass: Project,
    atomActions: projectActions,
    outgoingChangeService: services?.outgoingChangeService || null
  });
}

/**
 * Create project from incoming sync - thin wrapper around generated function
 */
export async function createProjectIncoming(projectData: Project): Promise<Project> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedCreateProjectIncoming(projectData, {
    dataSource,
    EntityClass: Project
  });
}

/**
 * Update project from incoming sync - thin wrapper around generated function
 */
export async function updateProjectIncoming(projectId: string, updates: Partial<Project>): Promise<Project> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedUpdateProjectIncoming(projectId, updates, {
    dataSource,
    EntityClass: Project
  });
}

/**
 * Delete project from incoming sync - thin wrapper around generated function
 */
export async function deleteProjectIncoming(projectId: string): Promise<void> {
  const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
  const dataSource = await getNewPGliteDataSource();
  
  return generatedDeleteProjectIncoming(projectId, {
    dataSource,
    EntityClass: Project
  });
}

/**
 * Create project from live changes - thin wrapper around generated function
 */
export function createProjectLiveChanges(projectData: Project): void {
  generatedCreateProjectLiveChanges(projectData, {
    atomActions: projectActions
  });
}

/**
 * Update project from live changes - thin wrapper around generated function
 */
export function updateProjectLiveChanges(projectId: string, updates: Partial<Project>): void {
  generatedUpdateProjectLiveChanges(projectId, updates, {
    atomActions: projectActions
  });
}

/**
 * Delete project from live changes - thin wrapper around generated function
 */
export function deleteProjectLiveChanges(projectId: string): void {
  generatedDeleteProjectLiveChanges(projectId, {
    atomActions: projectActions
  });
}

/**
 * Bulk create projects from incoming sync - optimized for chunked data
 * Used by IncomingChangeService for performance when processing chunks
 */
export async function bulkCreateProjectsIncoming(projectsData: Project[]): Promise<Project[]> {
  if (projectsData.length === 0) return [];
  
  console.log(`[ProjectDomain] Bulk creating ${projectsData.length} projects from incoming sync`);
  const startTime = Date.now();
  
  try {
    const { getNewPGliteDataSource } = await import('../db/newtypeorm/NewDataSource');
    const dataSource = await getNewPGliteDataSource();
    
    // Apply to database
    const projectRepo = dataSource.getRepository(Project);
    const result = await projectRepo.insert(projectsData);
    
    // Get the inserted projects
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

// Re-export types for convenience
export type { CreateProjectInput, UpdateProjectInput } from '@repo/dataforge/project-operations';