import { v4 as uuidv4 } from 'uuid';
import { DeepPartial } from 'typeorm';
import { Project, User, ProjectStatus } from '@repo/dataforge/client-entities';
import { BaseRepository, BaseService, DatabaseServiceError, EventDispatcher } from './base';
import { OutgoingChangeService } from '../sync/OutgoingChangeService';
import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import { RelationshipChangeEncoder } from '../db/relationship-change-encoder';
import { createAtom, shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';

// ============================================================================
// 🎯 PURE XSTATE ATOMIC STORE IMPLEMENTATION
// ============================================================================

// Note: Live changes types moved to centralized LiveChangesManager

// Main projects store - holds all projects in normalized format
export const projectsAtom = createAtom<Record<string, Project>>({});

// Note: Live changes state removed - now handled centrally by LiveChangesManager

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
          const aTime = new Date(a.updatedAt || a.createdAt).getTime();
          const bTime = new Date(b.updatedAt || b.createdAt).getTime();
          return bTime - aTime; // Latest first
        });
      },
      shallowEqual
    );
  },

  // Individual project by ID
  project: (projectId: string) => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => projectsRecord[projectId] || null
    );
  },

  // Note: No need for separate projectIds with XState selectors

  // Project stats
  projectStats: () => {
    return useSelector(
      projectsAtom,
      (projectsRecord) => {
        const projects = Object.values(projectsRecord);
        const total = projects.length;
        
        return { total };
      },
      shallowEqual
    );
  },

  // Note: Live changes state now managed centrally
};

// ============================================================================
// Actions (Pure XState)
// ============================================================================

export const projectActions = {
  // 🎯 COMPARTMENTALIZED LOADING: Atoms handle their own database loading
  ensureLoaded: async () => {
    const current = projectsAtom.get();
    if (Object.keys(current).length > 0) {
      console.log(`[ProjectAtoms] Projects already loaded - skipping (${Object.keys(current).length} projects)`);
      return; // Already loaded
    }
    
    console.log('[ProjectAtoms] Loading projects from database...');
    try {
      // ✅ FIXED: Use global datasource singleton to prevent race conditions
      const { getGlobalDataSource } = await import('../db/global-datasource');
      const dataSource = await getGlobalDataSource();
      
      if (!dataSource.isInitialized) {
        console.warn('[ProjectAtoms] DataSource not ready, skipping load');
        return;
      }
      
      const projects = await dataSource.getRepository(Project).find({ relations: ['members'] });
      
      // Create normalized record
      const projectsRecord: Record<string, Project> = {};
      projects.forEach(project => {
        projectsRecord[project.id] = project;
      });
      
      // Update atom
      projectsAtom.set(projectsRecord);
      console.log(`[ProjectAtoms] ✅ Loaded ${projects.length} projects`);
      
    } catch (error) {
      console.error('[ProjectAtoms] Failed to load projects:', error);
      // Don't throw - let components handle empty state gracefully
    }
  },

  // Bulk load projects (for external data sources)
  loadProjects: (projects: Project[]) => {
    // Create normalized record - no presorting needed with XState selectors
    const projectsRecord: Record<string, Project> = {};
    projects.forEach(project => {
      projectsRecord[project.id] = project;
    });
    
    // Update atom
    projectsAtom.set(projectsRecord);
    console.log(`[ProjectAtoms] Bulk loaded ${projects.length} projects - atom now contains ${Object.keys(projectsRecord).length} projects`);
  },

  // Update individual project
  updateProject: (projectId: string, updates: Partial<Project>) => {
    const currentProjects = projectsAtom.get();
    const currentProject = currentProjects[projectId];
    
    if (!currentProject) {
      console.warn(`[ProjectService] Project ${projectId} not found for update`);
      return;
    }
    
    const updatedProject = { ...currentProject, ...updates, updatedAt: new Date() };
    
    // Update projects record
    projectsAtom.set({
      ...currentProjects,
      [projectId]: updatedProject
    });
    
    console.log(`[ProjectService] Updated project ${projectId}`);
  },

  // Create project
  createProject: (project: Project) => {
    const currentProjects = projectsAtom.get();
    
    // Add to projects record
    projectsAtom.set({
      ...currentProjects,
      [project.id]: { ...project, updatedAt: new Date() }
    });
    
    console.log(`[ProjectService] Created project ${project.id}`);
  },

  // Delete project
  deleteProject: (projectId: string) => {
    const currentProjects = projectsAtom.get();
    
    // Remove from projects record
    const { [projectId]: removed, ...remainingProjects } = currentProjects;
    projectsAtom.set(remainingProjects);
    
    console.log(`[ProjectService] Deleted project ${projectId}`);
  },
};

// ============================================================================
// Note: Live Changes Integration removed - now handled centrally by LiveChangesManager
// ============================================================================

// ============================================================================
// Atomic Store Implementation (ProjectAtomStore replacement)
// ============================================================================

class ProjectAtomStore {
  // XState atoms for compatibility with existing interfaces
  projectsAtom = projectsAtom
  
  // Compatibility methods for existing code
  getProjectAtom = (id: string) => {
    return {
      get: () => {
        const projectsRecord = projectsAtom.get();
        return projectsRecord[id] || null;
      },
      isXStateAtom: true,
      projectId: id
    };
  }

  // Derived atom equivalent for compatibility
  allProjectsAtom = {
    get: () => Object.values(projectsAtom.get())
  }

  // Bulk load compatibility
  syncBulkLoad = {
    set: (projects: Project[]) => projectActions.loadProjects(projects)
  }

  // Note: Live changes methods removed - now handled centrally by LiveChangesManager
}



// Repository
export class ProjectRepository extends BaseRepository<Project> {
  constructor(dataSource: NewPGliteDataSource) {
    if (!dataSource.isInitialized) {
      throw new Error('DataSource must be initialized before creating ProjectRepository');
    }
    super(dataSource.getRepository(Project), 'project', dataSource);
  }

  /**
   * Get project members
   */
  async getMembers(projectId: string): Promise<User[]> {
    const project = await this.repository.findOne({
      where: { id: projectId } as any,
      relations: ['members']
    });
    
    if (!project || !project.members) {
      return [];
    }

    // Handle both sync and async members (TypeORM Promise relations)
    if (project.members instanceof Promise) {
      return await project.members;
    }
    
    return project.members as User[];
  }

  /**
   * Update project members using differential updates (only change what's different)
   * Much more efficient than DELETE ALL + INSERT ALL
   */
  async updateMembers(projectId: string, newUserIds: string[]): Promise<void> {
    // Get current members to calculate differences
    const currentMembers = await this.getMembers(projectId);
    const currentUserIds = new Set(currentMembers.map(m => m.id));
    const newUserIdSet = new Set(newUserIds);
    
    // Calculate what needs to be added and removed
    const toAdd = newUserIds.filter(id => !currentUserIds.has(id));
    const toRemove = Array.from(currentUserIds).filter(id => !newUserIdSet.has(id));
    
    // Early return if no changes needed
    if (toAdd.length === 0 && toRemove.length === 0) {
      console.log(`[ProjectRepository] No member changes needed for project ${projectId}`);
      return;
    }

    console.log(`[ProjectRepository] Updating members for project ${projectId}:`, {
      currentCount: currentMembers.length,
      newCount: newUserIds.length,
      toAdd: toAdd.length,
      toRemove: toRemove.length
    });

    // Handle empty member list case
    if (newUserIds.length === 0) {
      // Just remove all members
      await this.safeQuery(
        'DELETE FROM project_members WHERE project_id = $1',
        [projectId]
      );
      return;
    }

    // Use transaction for differential updates
    const queryRunner = this.repository.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      // Remove members that should no longer be in the project
      if (toRemove.length > 0) {
        const placeholders = toRemove.map((_, index) => `$${index + 2}`).join(', ');
        await queryRunner.query(
          `DELETE FROM project_members WHERE project_id = $1 AND user_id IN (${placeholders})`,
          [projectId, ...toRemove]
        );
      }
      
      // Add new members to the project
      if (toAdd.length > 0) {
        const values = toAdd.map((userId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        await queryRunner.query(
          `INSERT INTO project_members (project_id, user_id) VALUES ${values}`,
          [projectId, ...toAdd]
        );
      }
      
      await queryRunner.commitTransaction();
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Add a member to project
   */
  async addMember(projectId: string, userId: string): Promise<void> {
    await this.safeQuery(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [projectId, userId]
    );
  }

  /**
   * Remove a member from project
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.safeQuery(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
  }

  /**
   * Optimized query to get project with members
   */
  async getProjectWithMembers(projectId: string): Promise<Project | null> {
    return await this.repository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.members', 'member')
      .where('project.id = :id', { id: projectId })
      .getOne();
  }
}

// Service
export class ProjectService extends BaseService<Project> {
  // 🎯 CONNECT: Service points to co-located atomic store (defined after class)
  static atoms: ProjectAtomStore;

  constructor(
    protected projectRepository: ProjectRepository,
    protected outgoingChangeService: OutgoingChangeService
  ) {
    super(projectRepository, 'projects', outgoingChangeService);
    
    // Set up entity-specific sync processing methods
    this.validateSyncData = this.validateProjectSyncData.bind(this);
  }

  /**
   * Override to specify project-specific date fields
   */
  getDateFields(): string[] {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Validate project sync data
   */
  private validateProjectSyncData(data: Record<string, any>, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    if (operation === 'INSERT') {
      if (!data.name) {
        throw new Error(`Project INSERT requires name. Received: ${JSON.stringify(data)}`);
      }
    }
    
    if (operation === 'UPDATE' || operation === 'DELETE') {
      if (!data.id) {
        throw new Error(`Project ${operation} requires an id. Received: ${JSON.stringify(data)}`);
      }
    }
  }

  async get(id: string): Promise<Project | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get project with ID ${id}`,
        'get',
        error
      );
    }
  }

  async createProject(projectData: { name: string; description?: string; ownerId?: string }): Promise<Project> {
    try {
      const now = new Date();
      const projectId = uuidv4();
      
      const newProject = {
        id: projectId,
        name: projectData.name,
        description: projectData.description || '',
        ownerId: projectData.ownerId || null,
        status: 'active', // Default status
        createdAt: now,
        updatedAt: now
      } as Project;

      // ✅ USE INHERITED METHOD: createWithProcessing handles sync tracking automatically
      const createdProject = await this.createWithProcessing(newProject as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Add new project to atom immediately
      projectActions.createProject(createdProject);
      
      // Optimized event dispatching
      EventDispatcher.emit('project:created', { project: createdProject });
      
      return createdProject;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to create project "${projectData.name}"`,
        'createProject',
        error
      );
    }
  }

  async updateProject(id: string, changes: Partial<Project>): Promise<Project> {
    try {
      const project = await this.repository.findById(id);
      if (!project) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      const updatedData = {
        ...changes,
        updatedAt: new Date()
      } as DeepPartial<Project>;
      
      // ✅ USE INHERITED METHOD: updateWithProcessing handles sync tracking automatically
      const updatedProject = await this.updateWithProcessing(id, updatedData as Record<string, any>);
      
      // ✅ OPTIMISTIC UPDATE: Update project in atom immediately
      projectActions.updateProject(id, updatedProject);
      
      // Optimized event dispatching
      EventDispatcher.emit('project:updated', { project: updatedProject });
      
      return updatedProject;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update project with ID ${id}`,
        'updateProject',
        error
      );
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      const project = await this.repository.findById(id);
      if (!project) {
        throw new Error(`Project with ID ${id} not found`);
      }
      
      // ✅ USE INHERITED METHOD: deleteWithProcessing handles sync tracking automatically
      const success = await this.deleteWithProcessing(id);
      
      // ✅ OPTIMISTIC UPDATE: Remove project from atom immediately
      if (success) {
        projectActions.deleteProject(id);
        
        // Optimized event dispatching
        EventDispatcher.emit('project:deleted', { projectId: id });
      }
      
      return success;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to delete project with ID ${id}`,
        'deleteProject',
        error
      );
    }
  }

  // Project Member Management Methods

  async getProjectMembers(projectId: string): Promise<User[]> {
    try {
      return await this.projectRepository.getMembers(projectId);
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to get members for project with ID ${projectId}`,
        'getProjectMembers',
        error
      );
    }
  }

  async updateProjectMembers(projectId: string, userIds: string[]): Promise<User[]> {
    try {
      // Check if project exists
      const project = await this.repository.findById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Update the members using repository
      await this.projectRepository.updateMembers(projectId, userIds);

      // Get the updated members list
      const updatedMembers = await this.projectRepository.getMembers(projectId);

      // Use RelationshipChangeEncoder for TypeORM-native sync
      const relationshipChange = RelationshipChangeEncoder.encodeRelationshipChange(
        'projects',
        projectId,
        'members',
        'set',
        userIds
      );

      // Track change for sync - NON-BLOCKING (fire and forget)
      this.outgoingChangeService.trackEntityChange(
        'projects',
        'update',
        {
          id: projectId,
          updatedAt: relationshipChange.updatedAt,
          clientId: relationshipChange.clientId,
          // TODO: Add relationship metadata support to OutgoingChangeService
          _relationshipUpdate: {
            relationshipUpdates: relationshipChange.relationshipUpdates,
            entityRelations: relationshipChange.entityRelations
          }
        }
      ).catch((error: any) => {
        console.error('[ProjectService] Relationship sync tracking failed (non-blocking):', error);
      });

      // Optimized event dispatching
      EventDispatcher.emit('project:members-updated', { projectId, members: updatedMembers });

      return updatedMembers;
    } catch (error) {
      throw new DatabaseServiceError(
        `Failed to update members for project with ID ${projectId}`,
        'updateProjectMembers',
        error
      );
    }
  }

  async addProjectMember(projectId: string, userId: string): Promise<User[]> {
    try {
      // Check if project exists
      const project = await this.repository.findById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Add the member using repository
      await this.projectRepository.addMember(projectId, userId);

      // Get the updated members list
      const updatedMembers = await this.projectRepository.getMembers(projectId);

      // Use RelationshipChangeEncoder for TypeORM-native sync
      const relationshipChange = RelationshipChangeEncoder.encodeRelationshipChange(
        'projects',
        projectId,
        'members',
        'add',
        [userId]
      );

      // Track change for sync - NON-BLOCKING (fire and forget)
      this.outgoingChangeService.trackEntityChange(
        'projects',
        'update',
        {
          id: projectId,
          updatedAt: relationshipChange.updatedAt,
          clientId: relationshipChange.clientId,
          // TODO: Add relationship metadata support to OutgoingChangeService
          _relationshipUpdate: {
            relationshipUpdates: relationshipChange.relationshipUpdates,
            entityRelations: relationshipChange.entityRelations
          }
        }
      ).catch((error: any) => {
        console.error('[ProjectService] Relationship sync tracking failed (non-blocking):', error);
      });

      // Optimized event dispatching
      EventDispatcher.emit('project:members-updated', { projectId, members: updatedMembers });

      return updatedMembers;
    } catch (error: any) {
      throw new DatabaseServiceError(
        `Failed to add member to project with ID ${projectId}`,
        'addProjectMember',
        error
      );
    }
  }

  async removeProjectMember(projectId: string, userId: string): Promise<User[]> {
    try {
      // Check if project exists
      const project = await this.repository.findById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Remove the member using repository
      await this.projectRepository.removeMember(projectId, userId);

      // Get the updated members list
      const updatedMembers = await this.projectRepository.getMembers(projectId);

      // Use RelationshipChangeEncoder for TypeORM-native sync
      const relationshipChange = RelationshipChangeEncoder.encodeRelationshipChange(
        'projects',
        projectId,
        'members',
        'remove',
        [userId]
      );

      // Track change for sync - NON-BLOCKING (fire and forget)
      this.outgoingChangeService.trackEntityChange(
        'projects',
        'update',
        {
          id: projectId,
          updatedAt: relationshipChange.updatedAt,
          clientId: relationshipChange.clientId,
          // TODO: Add relationship metadata support to OutgoingChangeService
          _relationshipUpdate: {
            relationshipUpdates: relationshipChange.relationshipUpdates,
            entityRelations: relationshipChange.entityRelations
          }
        }
      ).catch((error: any) => {
        console.error('[ProjectService] Relationship sync tracking failed (non-blocking):', error);
      });

      // Optimized event dispatching
      EventDispatcher.emit('project:members-updated', { projectId, members: updatedMembers });

      return updatedMembers;
    } catch (error: any) {
      throw new DatabaseServiceError(
        `Failed to remove member from project with ID ${projectId}`,
        'removeProjectMember',
        error
      );
    }
  }

    // Note: Live changes methods removed - now handled centrally by LiveChangesManager

  // ============================================================================
  // LIVE QUERY BUILDERS (using our existing patterns)
  // ============================================================================

  static createQueryBuilders(createQueryBuilder: Function) {
    return {
      all: () => {
        return createQueryBuilder(Project, 'project')
          // No joins for now to avoid N+1 queries
          .orderBy('project.name', 'ASC')
      },

      byOwner: (ownerId: string) => {
        return createQueryBuilder(Project, 'project')
          .where('project.ownerId = :ownerId', { ownerId })
          .orderBy('project.name', 'ASC')
      },

      detail: (id: string) => {
        return createQueryBuilder(Project, 'project')
          .where('project.id = :id', { id })
      },
    }
  }

  // ❌ DELETED: All queryOptions (~150 lines) - replaced with atomic stores

  // ❌ DELETED: All deprecated queries (~30 lines) - replaced with atomic stores

  // ❌ DELETED: All hooks (~380 lines) - replaced with atomic stores
}

// ============================================================================
// ATOMIC STORE INSTANCE - Exported for Universal Entity Table v2  
// ============================================================================

// 🎯 SIMPLE: Direct export, no registry needed
const projectAtoms = new ProjectAtomStore();

// 🎯 FIX: Use lazy initialization to prevent circular dependency
Object.defineProperty(ProjectService, 'atoms', {
  get() {
    return projectAtoms;
  },
  enumerable: true,
  configurable: true
});

export { projectAtoms };

// Factory function for this domain
export function createProjectDomain(
  dataSource: NewPGliteDataSource, 
  outgoingChangeService: OutgoingChangeService
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating Project domain');
  }
  
  const repository = new ProjectRepository(dataSource);
  const service = new ProjectService(repository, outgoingChangeService);
  
  return { repository, service };
}

// ============================================================================
// SINGLETON SERVICE INSTANCE - For VibeGrid Integration
// ============================================================================

let projectServiceInstance: ProjectService | null = null;

export function setProjectService(service: ProjectService): void {
  projectServiceInstance = service;
}

export async function getProjectService(): Promise<ProjectService | null> {
  return projectServiceInstance;
}

export function hasProjectService(): boolean {
  return projectServiceInstance !== null;
} 