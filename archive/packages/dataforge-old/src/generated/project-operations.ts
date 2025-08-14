// Generated Project CRUD operations - DO NOT EDIT
// Zero-overhead, pure functions for the 3-path architecture

import type { Project } from './client-entities.js';
import { ProjectStatus } from './client-entities.js';

// ============================================================================
// Input Types - Generated from entity metadata
// ============================================================================

export interface CreateProjectInput {
  // name is required
  // name cannot exceed 100 characters
  name: string;

  description?: string;
  // status must be one of: active, in_progress, completed, on_hold
  // Business rule: auditLog
  // Business rule: statusTransitions
  // Business rule: permissions
  status: ProjectStatus;

  // ownerId must be a valid UUID
  // Business rule: foreignKey
  ownerId?: string;

}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {}



// ============================================================================
// Validation Functions - Generated from entity decorators
// ============================================================================

/**
 * Validation functions for Project
 */

export function validateProjectName(value: any): string[] {
  const errors: string[] = [];

  if (value === undefined || value === null || value === '') {
    errors.push('name is required');
  }

  if (typeof value === 'string' && value.length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  return errors;
}

export function validateProjectStatus(value: any): string[] {
  const errors: string[] = [];

  if (value && !['active', 'in_progress', 'completed', 'on_hold'].includes(value)) {
    errors.push('status must be one of: active, in_progress, completed, on_hold');
  }

  return errors;
}

export function validateProjectOwnerId(value: any): string[] {
  const errors: string[] = [];

  if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    errors.push('ownerId must be a valid UUID');
  }

  return errors;
}

export function validateProjectInput(input: CreateProjectInput | UpdateProjectInput): { isValid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if ('name' in input) {
    const fieldErrors = validateProjectName(input.name);
    if (fieldErrors.length > 0) {
      errors.name = fieldErrors;
    }
  }

  if ('status' in input) {
    const fieldErrors = validateProjectStatus(input.status);
    if (fieldErrors.length > 0) {
      errors.status = fieldErrors;
    }
  }

  if ('ownerId' in input) {
    const fieldErrors = validateProjectOwnerId(input.ownerId);
    if (fieldErrors.length > 0) {
      errors.ownerId = fieldErrors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}



// ============================================================================
// Business Logic Functions - Generated from entity business rules
// ============================================================================

/**
 * Business logic functions for Project
 */

export function getProjectDefaults(): Partial<CreateProjectInput> {
  return {
    status: ProjectStatus.ACTIVE,
  };
}

export function canTransitionProjectStatus(fromStatus: ProjectStatus, toStatus: ProjectStatus): boolean {
  const transitions: Record<ProjectStatus, ProjectStatus[]> = {
    [ProjectStatus.ACTIVE]: [ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED],
    [ProjectStatus.IN_PROGRESS]: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED],
    [ProjectStatus.ON_HOLD]: [ProjectStatus.ACTIVE, ProjectStatus.IN_PROGRESS],
    [ProjectStatus.COMPLETED]: [ProjectStatus.ACTIVE],
  };

  return transitions[fromStatus]?.includes(toStatus) || false;
}

export function getProjectRequiredPermissions(operation: 'create' | 'update' | 'delete', fieldName?: string): string[] {
  const permissions: string[] = [];

  if (operation === 'create' || operation === 'update') {
    switch (fieldName) {
      case 'status':
        permissions.push(...["project:update:status"]);
        break;
    }
  }

  return permissions;
}



// ============================================================================
// 1. UI PATH - User-initiated changes (Optimistic → Database → Sync)
// ============================================================================

/**
 * Create Project from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function createProjectUI(
  projectData: CreateProjectInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Project> {
  console.log(`[ProjectFunctions-UI] Creating new project`);
  
  // Validate input if validation function exists
  try {
    const validation = validateProjectInput(projectData);
    if (!validation.isValid) {
      throw new Error(`Invalid project data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Apply defaults if defaults function exists
  let projectWithDefaults;
  try {
    projectWithDefaults = {
      ...getProjectDefaults(),
      ...projectData
    };
  } catch (error) {
    // Defaults function might not exist
    projectWithDefaults = {
      ...projectData
    };
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database create completes
  
  try {
    // 2. DATABASE: Create in database in background
    const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const createdProject = await projectRepo.save(projectWithDefaults);
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('projects', 'insert', {
        ...createdProject,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return createdProject;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Update Project from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function updateProjectUI(
  projectId: string,
  updates: UpdateProjectInput,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<Project> {
  console.log(`[ProjectFunctions-UI] Updating project ${projectId.slice(-8)}`);
  
  // Validate input if validation function exists
  try {
    const validation = validateProjectInput(updates);
    if (!validation.isValid) {
      throw new Error(`Invalid project update data: ${JSON.stringify(validation.errors)}`);
    }
  } catch (error) {
    // Validation function might not exist, continue without validation
  }
  
  // Get current project for optimistic update
  const currentProjects = dependencies.atomActions.projectsAtom.get();
  const currentProject = currentProjects[projectId];
  
  if (!currentProject) {
    throw new Error(`Project ${projectId} not found for UI update`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database update completes
  
  try {
    // 2. DATABASE: Update database in background
    const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    
    // Separate many-to-many relationships from regular fields
    // Separate many-to-many relationships from regular fields
    const { members, statusSets, tagSets, ...regularUpdates } = updates as any;
    
    // Update regular fields if any
    if (Object.keys(regularUpdates).length > 0) {
      await projectRepo.update(projectId, regularUpdates);
    }
    
    // Handle many-to-many relationships using direct junction table manipulation
    
    if (members !== undefined) {
      // Clear existing relations first
      await projectRepo
        .createQueryBuilder()
        .delete()
        .from('project_members')
        .where('"projectId" = :projectId', { projectId })
        .execute();
      
      // Add new relations if any
      if (members && members.length > 0) {
        const relatedIds = members.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['projectId']: projectId, 
          ['userId']: relatedId 
        }));
        await projectRepo
          .createQueryBuilder()
          .insert()
          .into('project_members')
          .values(values)
          .execute();
      }
    }
    if (statusSets !== undefined) {
      // Clear existing relations first
      await projectRepo
        .createQueryBuilder()
        .delete()
        .from('project_status_sets')
        .where('"projectId" = :projectId', { projectId })
        .execute();
      
      // Add new relations if any
      if (statusSets && statusSets.length > 0) {
        const relatedIds = statusSets.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['projectId']: projectId, 
          ['statusSetId']: relatedId 
        }));
        await projectRepo
          .createQueryBuilder()
          .insert()
          .into('project_status_sets')
          .values(values)
          .execute();
      }
    }
    if (tagSets !== undefined) {
      // Clear existing relations first
      await projectRepo
        .createQueryBuilder()
        .delete()
        .from('project_tag_sets')
        .where('"projectId" = :projectId', { projectId })
        .execute();
      
      // Add new relations if any
      if (tagSets && tagSets.length > 0) {
        const relatedIds = tagSets.map((item: any) => 
          typeof item === 'string' ? item : item.id
        );
        
        // Insert new relations directly
        const values = relatedIds.map((relatedId: string) => ({ 
          ['projectId']: projectId, 
          ['tagSetId']: relatedId 
        }));
        await projectRepo
          .createQueryBuilder()
          .insert()
          .into('project_tag_sets')
          .values(values)
          .execute();
      }
    }
    
    // Load the updated entity without problematic relations to avoid createQueryBuilder issues
    const updatedProject = await projectRepo.findOne({ 
      where: { id: projectId }
    });
    
    if (!updatedProject) {
      throw new Error(`Project ${projectId} not found after database update`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('projects', 'update', {
        ...updatedProject,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return updatedProject;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}

/**
 * Delete Project from UI - optimistic update, then database, then sync
 * Pure function that takes all dependencies as parameters
 */
export async function deleteProjectUI(
  projectId: string,
  dependencies: {
    dataSource: any;
    atomActions: any;
    outgoingChangeService?: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[ProjectFunctions-UI] Deleting project ${projectId.slice(-8)}`);
  
  // Get current project for potential revert
  const currentProjects = dependencies.atomActions.projectsAtom.get();
  const projectToDelete = currentProjects[projectId];
  
  if (!projectToDelete) {
    throw new Error(`Project ${projectId} not found for UI delete`);
  }
  
  // 1. OPTIMISTIC: Skip atom update - let live changes handle it
  // Optimistic updates will be handled by components using local state
  // Live changes will reconcile atom when database delete completes
  
  try {
    // 2. DATABASE: Delete from database
    const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
    const result = await projectRepo.delete(projectId);
    const success = result.affected && result.affected > 0;
    
    if (!success) {
      throw new Error(`Project ${projectId} could not be deleted from database`);
    }
    
    // 3. SYNC: Track for outgoing sync
    if (dependencies.outgoingChangeService) {
      await dependencies.outgoingChangeService.trackEntityChange('projects', 'delete', {
        id: projectId,
        clientId: dependencies.outgoingChangeService.config?.clientId
      });
    }
    
    return true;
    
  } catch (error) {
    // No optimistic update to revert - live changes will handle atom state
    throw error;
  }
}



// ============================================================================
// 2. INCOMING PATH - Server sync data (Database → Live changes trigger atom)
// ============================================================================

/**
 * Create Project from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function createProjectIncoming(
  projectData: Project,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Project> {
  console.log(`[ProjectFunctions-Incoming] Creating project ${projectData.id.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Create in database (no atom update, no sync tracking)
  const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  const createdProject = await projectRepo.save(projectData);
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return createdProject;
}

/**
 * Update Project from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function updateProjectIncoming(
  projectId: string,
  updates: Partial<Project>,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<Project> {
  console.log(`[ProjectFunctions-Incoming] Updating project ${projectId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Update database (no atom update, no sync tracking)
  const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  await projectRepo.update(projectId, updates);
  const updatedProject = await projectRepo.findOne({ where: { id: projectId } });
  
  if (!updatedProject) {
    throw new Error(`Project ${projectId} not found after incoming update`);
  }
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return updatedProject;
}

/**
 * Delete Project from incoming sync - database only, live changes will update atom
 * Pure function that takes all dependencies as parameters
 */
export async function deleteProjectIncoming(
  projectId: string,
  dependencies: {
    dataSource: any;
    EntityClass: any;
  }
): Promise<boolean> {
  console.log(`[ProjectFunctions-Incoming] Deleting project ${projectId.slice(-8)} from server sync`);
  
  // DATABASE ONLY: Delete from database (no atom update, no sync tracking)
  const projectRepo = dependencies.dataSource.getRepository(dependencies.EntityClass);
  
  const result = await projectRepo.delete(projectId);
  const success = result.affected && result.affected > 0;
  
  // NO atom update - live changes manager will handle this
  // NO sync tracking - this is incoming data, don't echo back
  
  return success;
}



// ============================================================================
// 3. LIVE CHANGES PATH - Reflect database changes (Atom update only)
// ============================================================================

/**
 * Create Project from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function createProjectLiveChanges(
  projectData: Project,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[ProjectFunctions-LiveChanges] Reflecting project ${projectData.id.slice(-8)} database create in atom`);
  
  // ATOM ONLY: Add to atom to reflect database change
  dependencies.atomActions.createProjectAtomOnly(projectData);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Update Project from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function updateProjectLiveChanges(
  projectId: string,
  updates: Partial<Project>,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[ProjectFunctions-LiveChanges] Reflecting project ${projectId.slice(-8)} database change in atom`);
  
  // ATOM ONLY: Update atom to reflect database change
  const currentProjects = dependencies.atomActions.projectsAtom.get();
  const currentProject = currentProjects[projectId];
  
  if (!currentProject) {
    console.warn(`[ProjectFunctions-LiveChanges] Project ${projectId} not found in atom for live update`);
    return;
  }
  
  const updatedProject = { ...currentProject, ...updates };
  dependencies.atomActions.updateProjectAtomOnly(projectId, updatedProject);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}

/**
 * Delete Project from live changes - atom update only (database already updated)
 * Pure function that takes all dependencies as parameters
 */
export function deleteProjectLiveChanges(
  projectId: string,
  dependencies: {
    atomActions: any;
  }
): void {
  console.log(`[ProjectFunctions-LiveChanges] Reflecting project ${projectId.slice(-8)} database delete in atom`);
  
  // ATOM ONLY: Remove from atom to reflect database change
  dependencies.atomActions.deleteProjectAtomOnly(projectId);
  
  // NO database operations - database already updated
  // NO sync tracking - this is reflection of existing database state
}


