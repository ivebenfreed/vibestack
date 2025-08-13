import { ProjectArchetype } from '../../entities/archetypes/ProjectArchetype.js';
import { ArchetypeAccessControlService, AccessContext, PermissionLevel, SensitiveFieldConfig } from './ArchetypeAccessControlService.js';

/**
 * Project-specific access control service
 * Implements access patterns for all project archetype entities
 * Co-located with project entities for type safety and maintainability
 */
export class ProjectAccessControlService extends ArchetypeAccessControlService<ProjectArchetype> {
  
  /**
   * Check if user can read a project
   * Projects are readable by:
   * - Project manager/owner
   * - Organization members (if public or shared)
   * - Team members with appropriate container permissions
   */
  canRead(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Project manager/owner always has read access
    if (this.isEntityOwner(userId, project)) {
      return true;
    }

    // Check if project is publicly accessible
    if (this.isPubliclyAccessible(project)) {
      return this.isOrganizationMember(userId, project, context);
    }

    // Check container-level permissions
    const container = this.getEntityContainer(project);
    return this.hasContainerPermission(userId, container, 'read', context);
  }

  /**
   * Check if user can write/update a project
   * Projects are writable by:
   * - Project manager/owner
   * - Users with project admin or write permissions
   * - Team members with edit role
   */
  canWrite(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Project manager/owner always has write access
    if (this.isEntityOwner(userId, project)) {
      return true;
    }

    // Check organization-level admin role
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    // Check container-level write permissions
    const container = this.getEntityContainer(project);
    return this.hasContainerPermission(userId, container, 'write', context);
  }

  /**
   * Check if user can delete a project
   * Projects are deletable by:
   * - Project manager/owner
   * - Organization admins
   * - Users with explicit delete permissions
   */
  canDelete(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Project manager/owner can delete
    if (this.isEntityOwner(userId, project)) {
      return true;
    }

    // Organization admins can delete
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Check container-level delete permissions
    const container = this.getEntityContainer(project);
    return this.hasContainerPermission(userId, container, 'delete', context);
  }

  /**
   * Check if user can perform admin operations on a project
   * Admin operations include member management, permission changes, etc.
   * Available to:
   * - Project manager/owner
   * - Organization admins
   * - Users with explicit admin permissions
   */
  canAdmin(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Project manager/owner has admin access
    if (this.isEntityOwner(userId, project)) {
      return true;
    }

    // Organization admins have admin access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Check container-level admin permissions
    const container = this.getEntityContainer(project);
    return this.hasContainerPermission(userId, container, 'admin', context);
  }

  /**
   * Filter project fields based on user permissions
   * Removes sensitive financial and strategic information from users without appropriate access
   */
  filterFields(userId: string, project: ProjectArchetype, context?: AccessContext): Partial<ProjectArchetype> {
    const userPermissions = this.getUserPermissions(userId, project, context);
    
    const sensitiveFields: SensitiveFieldConfig[] = [
      {
        fieldName: 'budget',
        requiredPermissions: ['financial_access', 'project_admin', 'budget_viewer'],
        description: 'Project budget information'
      },
      {
        fieldName: 'currency',
        requiredPermissions: ['financial_access', 'project_admin', 'budget_viewer'],
        description: 'Budget currency'
      },
      {
        fieldName: 'projectManagerId',
        requiredPermissions: ['member_management', 'project_admin', 'hr_access'],
        description: 'Project manager identification'
      }
    ];

    // Start with all fields
    const filteredProject = { ...project } as Partial<ProjectArchetype>;

    // Apply sensitive field filtering
    return this.applySensitiveFieldFiltering(filteredProject, userPermissions, sensitiveFields);
  }

  /**
   * Project-specific business logic: Check if user is a project team member
   */
  isProjectMember(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Check if user is project manager
    if (project.projectManagerId === userId) {
      return true;
    }

    // In a production system, this would check ProjectMember entities
    // For now, use container permissions as proxy
    const container = this.getEntityContainer(project);
    return this.hasContainerPermission(userId, container, 'read', context);
  }

  /**
   * Project-specific business logic: Check project visibility level
   */
  getProjectVisibility(project: ProjectArchetype): 'public' | 'private' | 'restricted' {
    // Check project-specific visibility patterns
    const projectAny = project as any;
    
    if (projectAny.visibility) {
      return projectAny.visibility;
    }

    if (this.isPubliclyAccessible(project)) {
      return 'public';
    }

    // Default to private if no explicit visibility set
    return 'private';
  }

  /**
   * Project-specific business logic: Check if project allows external collaboration
   */
  allowsExternalCollaboration(project: ProjectArchetype): boolean {
    const projectAny = project as any;
    return projectAny.allowExternalCollaboration === true || 
           projectAny.externalAccess === true ||
           this.getProjectVisibility(project) === 'public';
  }

  /**
   * Project-specific business logic: Get project access level for user
   */
  getProjectAccessLevel(userId: string, project: ProjectArchetype, context?: AccessContext): 'none' | 'viewer' | 'member' | 'admin' | 'owner' {
    if (this.isEntityOwner(userId, project)) {
      return 'owner';
    }

    if (this.canAdmin(userId, project, context)) {
      return 'admin';
    }

    if (this.canWrite(userId, project, context)) {
      return 'member';
    }

    if (this.canRead(userId, project, context)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * Helper method to get user permissions for the project
   */
  private getUserPermissions(userId: string, project: ProjectArchetype, context?: AccessContext): string[] {
    const permissions: string[] = [];

    // Add role-based permissions
    if (context?.userRoles) {
      permissions.push(...context.userRoles);
    }

    // Add project-specific permissions
    if (this.isEntityOwner(userId, project)) {
      permissions.push('project_owner', 'financial_access', 'member_management', 'project_admin');
    }

    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      permissions.push('financial_access', 'member_management', 'project_admin', 'budget_viewer');
    }

    if (this.hasOrganizationRole(userId, ['project_manager'], context)) {
      permissions.push('project_admin', 'member_management', 'budget_viewer');
    }

    if (this.hasOrganizationRole(userId, ['finance'], context)) {
      permissions.push('financial_access', 'budget_viewer');
    }

    return permissions;
  }

  /**
   * Project-specific validation: Check if user can change project status
   */
  canChangeProjectStatus(userId: string, project: ProjectArchetype, newStatus: string, context?: AccessContext): boolean {
    // Must have write access to change status
    if (!this.canWrite(userId, project, context)) {
      return false;
    }

    // Check if the status transition is valid
    if (!project.canTransitionTo(newStatus)) {
      return false;
    }

    // Some status changes require admin access
    const restrictedStatuses = ['completed', 'cancelled'];
    if (restrictedStatuses.includes(newStatus)) {
      return this.canAdmin(userId, project, context);
    }

    return true;
  }

  /**
   * Project-specific validation: Check if user can modify project budget
   */
  canModifyBudget(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Must be project owner or have financial access
    return this.isEntityOwner(userId, project) || 
           this.hasOrganizationRole(userId, ['admin', 'finance'], context);
  }

  /**
   * Project-specific validation: Check if user can assign project manager
   */
  canAssignProjectManager(userId: string, project: ProjectArchetype, context?: AccessContext): boolean {
    // Must be organization admin or current project owner
    return this.isEntityOwner(userId, project) || 
           this.hasOrganizationRole(userId, ['admin'], context);
  }
}