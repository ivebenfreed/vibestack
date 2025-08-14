import { TaskArchetype } from '../../entities/archetypes/TaskArchetype.js';
import { ArchetypeAccessControlService, AccessContext, PermissionLevel, SensitiveFieldConfig } from './ArchetypeAccessControlService.js';

/**
 * Task-specific access control service
 * Implements access patterns for all task archetype entities
 * Co-located with task entities for type safety and maintainability
 */
export class TaskAccessControlService extends ArchetypeAccessControlService<TaskArchetype> {
  
  /**
   * Check if user can read a task
   * Tasks are readable by:
   * - Task assignee
   * - Project members (if task belongs to a project they can access)
   * - Organization members (for shared/public tasks)
   * - Users with appropriate container permissions
   */
  canRead(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Assignee always has read access
    if (this.isTaskAssignee(userId, task)) {
      return true;
    }

    // Task creator/owner has read access
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Check if task is publicly accessible
    if (this.isPubliclyAccessible(task)) {
      return this.isOrganizationMember(userId, task, context);
    }

    // Check container-level permissions (usually project-level)
    const container = this.getEntityContainer(task);
    return this.hasContainerPermission(userId, container, 'read', context);
  }

  /**
   * Check if user can write/update a task
   * Tasks are writable by:
   * - Task assignee
   * - Task creator/owner
   * - Project managers (if task belongs to a project)
   * - Users with task management permissions
   */
  canWrite(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Assignee can update their assigned task
    if (this.isTaskAssignee(userId, task)) {
      return true;
    }

    // Task creator/owner can update
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Project managers can update project tasks
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    // Check container-level write permissions
    const container = this.getEntityContainer(task);
    return this.hasContainerPermission(userId, container, 'write', context);
  }

  /**
   * Check if user can delete a task
   * Tasks are deletable by:
   * - Task creator/owner
   * - Project managers/admins
   * - Organization admins
   * - Users with explicit delete permissions
   */
  canDelete(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Task creator/owner can delete
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Organization admins can delete
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Project managers can delete project tasks
    if (this.hasOrganizationRole(userId, ['project_manager'], context)) {
      return true;
    }

    // Check container-level delete permissions
    const container = this.getEntityContainer(task);
    return this.hasContainerPermission(userId, container, 'delete', context);
  }

  /**
   * Check if user can perform admin operations on a task
   * Admin operations include assignment changes, status overrides, etc.
   * Available to:
   * - Task creator/owner
   * - Project managers
   * - Organization admins
   */
  canAdmin(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Task creator/owner has admin access
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Organization admins have admin access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Project managers have admin access for project tasks
    if (this.hasOrganizationRole(userId, ['project_manager'], context)) {
      return true;
    }

    // Check container-level admin permissions
    const container = this.getEntityContainer(task);
    return this.hasContainerPermission(userId, container, 'admin', context);
  }

  /**
   * Filter task fields based on user permissions
   * Removes sensitive time tracking and estimation data from users without appropriate access
   */
  filterFields(userId: string, task: TaskArchetype, context?: AccessContext): Partial<TaskArchetype> {
    const userPermissions = this.getUserPermissions(userId, task, context);
    
    const sensitiveFields: SensitiveFieldConfig[] = [
      {
        fieldName: 'estimatedHours',
        requiredPermissions: ['time_tracking', 'project_manager', 'assignee_access'],
        description: 'Task time estimation data'
      },
      {
        fieldName: 'actualHours',
        requiredPermissions: ['time_tracking', 'project_manager', 'assignee_access'],
        description: 'Actual time spent on task'
      },
      {
        fieldName: 'assigneeId',
        requiredPermissions: ['assignment_visibility', 'project_manager', 'team_member'],
        description: 'Task assignee information'
      },
      {
        fieldName: 'customFields',
        requiredPermissions: ['custom_field_access', 'project_manager', 'task_owner'],
        description: 'Custom task metadata'
      }
    ];

    // Start with all fields
    const filteredTask = { ...task } as Partial<TaskArchetype>;

    // Apply sensitive field filtering
    return this.applySensitiveFieldFiltering(filteredTask, userPermissions, sensitiveFields);
  }

  /**
   * Task-specific business logic: Check if user is assigned to the task
   */
  isTaskAssignee(userId: string, task: TaskArchetype): boolean {
    return task.assigneeId === userId;
  }

  /**
   * Task-specific business logic: Check if user can be assigned to the task
   */
  canBeAssignedTo(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Must be organization member to be assigned tasks
    if (!this.isOrganizationMember(userId, task, context)) {
      return false;
    }

    // Check if user has the required skills (if any)
    const requiredSkills = task.getRequiredSkills();
    if (requiredSkills.length > 0) {
      // In production, this would check user skills against requirements
      // For now, assume organization members can be assigned
      return true;
    }

    return true;
  }

  /**
   * Task-specific business logic: Check if user can assign the task to someone else
   */
  canAssignTask(userId: string, task: TaskArchetype, targetUserId: string, context?: AccessContext): boolean {
    // Must have admin access to assign tasks
    if (!this.canAdmin(userId, task, context)) {
      return false;
    }

    // Check if target user can be assigned to the task
    return this.canBeAssignedTo(targetUserId, task, context);
  }

  /**
   * Task-specific business logic: Check if user can track time on the task
   */
  canTrackTime(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Assignee can track time
    if (this.isTaskAssignee(userId, task)) {
      return true;
    }

    // Task owner can track time
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Users with time tracking permissions
    if (this.hasOrganizationRole(userId, ['time_tracker', 'project_manager'], context)) {
      return true;
    }

    return false;
  }

  /**
   * Task-specific business logic: Check if user can change task status
   */
  canChangeTaskStatus(userId: string, task: TaskArchetype, newStatus: string, context?: AccessContext): boolean {
    // Must have write access to change status
    if (!this.canWrite(userId, task, context)) {
      return false;
    }

    // Check if the status transition is valid
    if (!task.canTransitionTo(newStatus)) {
      return false;
    }

    // Some status changes require special permissions
    const restrictedStatuses = ['completed', 'cancelled'];
    if (restrictedStatuses.includes(newStatus)) {
      // Assignee can complete their own tasks
      if (this.isTaskAssignee(userId, task)) {
        return true;
      }
      
      // Otherwise need admin access
      return this.canAdmin(userId, task, context);
    }

    return true;
  }

  /**
   * Task-specific business logic: Check if user can change task priority
   */
  canChangePriority(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Task owner can change priority
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Project managers can change priority
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    // Check for explicit priority management permissions
    return this.hasOrganizationRole(userId, ['priority_manager'], context);
  }

  /**
   * Task-specific business logic: Check if user can view time tracking data
   */
  canViewTimeTracking(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Assignee can view time tracking
    if (this.isTaskAssignee(userId, task)) {
      return true;
    }

    // Task owner can view time tracking
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Project managers can view time tracking
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    // Users with time tracking visibility permissions
    return this.hasOrganizationRole(userId, ['time_viewer'], context);
  }

  /**
   * Task-specific business logic: Check if user can create subtasks
   */
  canCreateSubtasks(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Must have write access to the parent task
    if (!this.canWrite(userId, task, context)) {
      return false;
    }

    // Assignee can create subtasks for their assigned task
    if (this.isTaskAssignee(userId, task)) {
      return true;
    }

    // Project managers can create subtasks
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    return false;
  }

  /**
   * Task-specific business logic: Get task access level for user
   */
  getTaskAccessLevel(userId: string, task: TaskArchetype, context?: AccessContext): 'none' | 'viewer' | 'assignee' | 'manager' | 'owner' {
    if (this.isEntityOwner(userId, task)) {
      return 'owner';
    }

    if (this.canAdmin(userId, task, context)) {
      return 'manager';
    }

    if (this.isTaskAssignee(userId, task)) {
      return 'assignee';
    }

    if (this.canRead(userId, task, context)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * Task-specific business logic: Check task visibility level
   */
  getTaskVisibility(task: TaskArchetype): 'public' | 'private' | 'team' | 'assignee_only' {
    const taskAny = task as any;
    
    if (taskAny.visibility) {
      return taskAny.visibility;
    }

    // Check if task has specific visibility patterns
    if (this.isPubliclyAccessible(task)) {
      return 'public';
    }

    // If assigned, default to team visibility
    if (task.assigneeId) {
      return 'team';
    }

    // Default to private
    return 'private';
  }

  /**
   * Helper method to get user permissions for the task
   */
  private getUserPermissions(userId: string, task: TaskArchetype, context?: AccessContext): string[] {
    const permissions: string[] = [];

    // Add role-based permissions
    if (context?.userRoles) {
      permissions.push(...context.userRoles);
    }

    // Add task-specific permissions
    if (this.isTaskAssignee(userId, task)) {
      permissions.push('assignee_access', 'time_tracking', 'assignment_visibility');
    }

    if (this.isEntityOwner(userId, task)) {
      permissions.push('task_owner', 'time_tracking', 'assignment_visibility', 'custom_field_access');
    }

    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      permissions.push('time_tracking', 'assignment_visibility', 'custom_field_access', 'project_manager');
    }

    if (this.hasOrganizationRole(userId, ['project_manager'], context)) {
      permissions.push('time_tracking', 'assignment_visibility', 'custom_field_access', 'project_manager');
    }

    if (this.hasOrganizationRole(userId, ['team_member'], context)) {
      permissions.push('assignment_visibility', 'team_member');
    }

    return permissions;
  }

  /**
   * Task-specific validation: Check if user can modify task estimates
   */
  canModifyEstimates(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Task owner can modify estimates
    if (this.isEntityOwner(userId, task)) {
      return true;
    }

    // Project managers can modify estimates
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    // Assignee can modify estimates for their own tasks (if organization allows)
    if (this.isTaskAssignee(userId, task)) {
      return this.hasOrganizationRole(userId, ['self_estimate'], context);
    }

    return false;
  }

  /**
   * Task-specific validation: Check if user can view sensitive task details
   */
  canViewSensitiveDetails(userId: string, task: TaskArchetype, context?: AccessContext): boolean {
    // Task participants can view sensitive details
    if (this.isTaskAssignee(userId, task) || this.isEntityOwner(userId, task)) {
      return true;
    }

    // Managers can view sensitive details
    if (this.hasOrganizationRole(userId, ['admin', 'project_manager'], context)) {
      return true;
    }

    return false;
  }
}