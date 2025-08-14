/**
 * Role Management Service for Advanced RBAC System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Manages organization roles, archetype-specific roles, and permission templates.
 * Integrated with multi-org platform for container-based access control.
 */

export interface Permission {
  id: string;
  name: string;
  resource: string; // e.g., 'project', 'task', 'file', 'organization'
  action: string;   // e.g., 'read', 'write', 'delete', 'admin'
  scope?: string;   // e.g., 'own', 'team', 'organization'
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: 'field' | 'relationship' | 'time' | 'context';
  field?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
  value: any;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  organizationId: string;
  type: 'organization' | 'archetype' | 'custom';
  archetype?: string; // For archetype-specific roles
  permissions: Permission[];
  parentRoleId?: string; // For role hierarchy
  isSystemRole: boolean;
  isActive: boolean;
  metadata?: {
    category?: string;
    industry?: string;
    level?: number; // For role hierarchy ordering
    customFields?: Record<string, any>;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  industry?: string;
  type: 'organization' | 'archetype' | 'custom';
  archetype?: string;
  permissions: Omit<Permission, 'id'>[];
  metadata?: Record<string, any>;
  version: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  organizationId: string;
  archetype?: string;
  entityId?: string; // For entity-specific role assignments
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  conditions?: PermissionCondition[];
}

export interface RoleHierarchy {
  roleId: string;
  parentRoleId: string;
  inheritanceType: 'full' | 'partial' | 'conditional';
  conditions?: PermissionCondition[];
}

export class RoleManagementService {

  /**
   * Create organization-level roles for new organizations
   */
  async createOrganizationRoles(organizationId: string): Promise<Role[]> {
    const roles: Role[] = [];

    // System Admin Role
    roles.push({
      id: this.generateId(),
      name: 'system_admin',
      displayName: 'System Administrator',
      description: 'Full administrative access to organization and all resources',
      organizationId,
      type: 'organization',
      permissions: await this.getSystemAdminPermissions(),
      isSystemRole: true,
      isActive: true,
      metadata: { level: 100, category: 'administration' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Organization Manager Role
    roles.push({
      id: this.generateId(),
      name: 'organization_manager',
      displayName: 'Organization Manager',
      description: 'Manage organization settings, members, and high-level operations',
      organizationId,
      type: 'organization',
      permissions: await this.getOrganizationManagerPermissions(),
      parentRoleId: roles[0].id, // Inherits from system admin
      isSystemRole: true,
      isActive: true,
      metadata: { level: 90, category: 'management' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Department Manager Role
    roles.push({
      id: this.generateId(),
      name: 'department_manager',
      displayName: 'Department Manager',
      description: 'Manage department-specific projects, tasks, and team members',
      organizationId,
      type: 'organization',
      permissions: await this.getDepartmentManagerPermissions(),
      parentRoleId: roles[1].id, // Inherits from organization manager
      isSystemRole: true,
      isActive: true,
      metadata: { level: 70, category: 'management' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Team Lead Role
    roles.push({
      id: this.generateId(),
      name: 'team_lead',
      displayName: 'Team Lead',
      description: 'Lead specific projects and coordinate team activities',
      organizationId,
      type: 'organization',
      permissions: await this.getTeamLeadPermissions(),
      parentRoleId: roles[2].id, // Inherits from department manager
      isSystemRole: true,
      isActive: true,
      metadata: { level: 60, category: 'leadership' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Organization Member Role
    roles.push({
      id: this.generateId(),
      name: 'organization_member',
      displayName: 'Organization Member',
      description: 'Standard member with access to assigned projects and tasks',
      organizationId,
      type: 'organization',
      permissions: await this.getOrganizationMemberPermissions(),
      isSystemRole: true,
      isActive: true,
      metadata: { level: 30, category: 'membership' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Guest/Viewer Role
    roles.push({
      id: this.generateId(),
      name: 'organization_viewer',
      displayName: 'Organization Viewer',
      description: 'Read-only access to public and shared resources',
      organizationId,
      type: 'organization',
      permissions: await this.getOrganizationViewerPermissions(),
      isSystemRole: true,
      isActive: true,
      metadata: { level: 10, category: 'viewing' },
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return roles;
  }

  /**
   * Create archetype-specific roles
   */
  async createArchetypeRoles(organizationId: string, archetype: string): Promise<Role[]> {
    const roles: Role[] = [];

    switch (archetype) {
      case 'project':
        roles.push(...await this.createProjectRoles(organizationId));
        break;
      case 'task':
        roles.push(...await this.createTaskRoles(organizationId));
        break;
      case 'file':
        roles.push(...await this.createFileRoles(organizationId));
        break;
      case 'discussion':
        roles.push(...await this.createDiscussionRoles(organizationId));
        break;
      case 'document':
        roles.push(...await this.createDocumentRoles(organizationId));
        break;
    }

    return roles;
  }

  /**
   * Create project-specific roles
   */
  private async createProjectRoles(organizationId: string): Promise<Role[]> {
    return [
      {
        id: this.generateId(),
        name: 'project_owner',
        displayName: 'Project Owner',
        description: 'Full control over project including deletion and member management',
        organizationId,
        type: 'archetype',
        archetype: 'project',
        permissions: [
          { id: this.generateId(), name: 'project.admin', resource: 'project', action: 'admin', scope: 'own' },
          { id: this.generateId(), name: 'project.delete', resource: 'project', action: 'delete', scope: 'own' },
          { id: this.generateId(), name: 'project.manage_members', resource: 'project', action: 'manage_members', scope: 'own' },
          { id: this.generateId(), name: 'project.write', resource: 'project', action: 'write', scope: 'own' },
          { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'own' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 100, category: 'ownership' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'project_manager',
        displayName: 'Project Manager',
        description: 'Manage project activities, assign tasks, and coordinate team',
        organizationId,
        type: 'archetype',
        archetype: 'project',
        permissions: [
          { id: this.generateId(), name: 'project.write', resource: 'project', action: 'write', scope: 'assigned' },
          { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'assigned' },
          { id: this.generateId(), name: 'task.admin', resource: 'task', action: 'admin', scope: 'project' },
          { id: this.generateId(), name: 'task.assign', resource: 'task', action: 'assign', scope: 'project' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 80, category: 'management' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'project_contributor',
        displayName: 'Project Contributor',
        description: 'Contribute to project tasks and provide updates',
        organizationId,
        type: 'archetype',
        archetype: 'project',
        permissions: [
          { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'member' },
          { id: this.generateId(), name: 'task.write', resource: 'task', action: 'write', scope: 'assigned' },
          { id: this.generateId(), name: 'task.read', resource: 'task', action: 'read', scope: 'project' },
          { id: this.generateId(), name: 'file.upload', resource: 'file', action: 'upload', scope: 'project' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 50, category: 'contribution' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'project_viewer',
        displayName: 'Project Viewer',
        description: 'View project progress and related information',
        organizationId,
        type: 'archetype',
        archetype: 'project',
        permissions: [
          { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'shared' },
          { id: this.generateId(), name: 'task.read', resource: 'task', action: 'read', scope: 'public' },
          { id: this.generateId(), name: 'file.view', resource: 'file', action: 'view', scope: 'public' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 20, category: 'viewing' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Create task-specific roles
   */
  private async createTaskRoles(organizationId: string): Promise<Role[]> {
    return [
      {
        id: this.generateId(),
        name: 'task_assignee',
        displayName: 'Task Assignee',
        description: 'Assigned to complete specific tasks',
        organizationId,
        type: 'archetype',
        archetype: 'task',
        permissions: [
          { id: this.generateId(), name: 'task.write', resource: 'task', action: 'write', scope: 'assigned' },
          { id: this.generateId(), name: 'task.complete', resource: 'task', action: 'complete', scope: 'assigned' },
          { id: this.generateId(), name: 'task.comment', resource: 'task', action: 'comment', scope: 'assigned' },
          { id: this.generateId(), name: 'task.time_track', resource: 'task', action: 'time_track', scope: 'assigned' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 60, category: 'execution' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'task_reviewer',
        displayName: 'Task Reviewer',
        description: 'Review and approve completed tasks',
        organizationId,
        type: 'archetype',
        archetype: 'task',
        permissions: [
          { id: this.generateId(), name: 'task.review', resource: 'task', action: 'review', scope: 'team' },
          { id: this.generateId(), name: 'task.approve', resource: 'task', action: 'approve', scope: 'team' },
          { id: this.generateId(), name: 'task.read', resource: 'task', action: 'read', scope: 'team' },
          { id: this.generateId(), name: 'task.comment', resource: 'task', action: 'comment', scope: 'team' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 70, category: 'quality_assurance' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'task_watcher',
        displayName: 'Task Watcher',
        description: 'Monitor task progress and receive notifications',
        organizationId,
        type: 'archetype',
        archetype: 'task',
        permissions: [
          { id: this.generateId(), name: 'task.read', resource: 'task', action: 'read', scope: 'watching' },
          { id: this.generateId(), name: 'task.comment', resource: 'task', action: 'comment', scope: 'watching' },
          { id: this.generateId(), name: 'task.watch', resource: 'task', action: 'watch', scope: 'any' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 30, category: 'monitoring' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Create file-specific roles
   */
  private async createFileRoles(organizationId: string): Promise<Role[]> {
    return [
      {
        id: this.generateId(),
        name: 'file_manager',
        displayName: 'File Manager',
        description: 'Manage file libraries and organize assets',
        organizationId,
        type: 'archetype',
        archetype: 'file',
        permissions: [
          { id: this.generateId(), name: 'file.admin', resource: 'file', action: 'admin', scope: 'organization' },
          { id: this.generateId(), name: 'file.organize', resource: 'file', action: 'organize', scope: 'organization' },
          { id: this.generateId(), name: 'file.delete', resource: 'file', action: 'delete', scope: 'any' },
          { id: this.generateId(), name: 'file.share', resource: 'file', action: 'share', scope: 'any' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 90, category: 'asset_management' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'file_contributor',
        displayName: 'File Contributor',
        description: 'Upload and edit files within assigned projects',
        organizationId,
        type: 'archetype',
        archetype: 'file',
        permissions: [
          { id: this.generateId(), name: 'file.upload', resource: 'file', action: 'upload', scope: 'project' },
          { id: this.generateId(), name: 'file.edit', resource: 'file', action: 'edit', scope: 'own' },
          { id: this.generateId(), name: 'file.version', resource: 'file', action: 'version', scope: 'own' },
          { id: this.generateId(), name: 'file.download', resource: 'file', action: 'download', scope: 'project' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 50, category: 'contribution' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'file_viewer',
        displayName: 'File Viewer',
        description: 'View and download shared files',
        organizationId,
        type: 'archetype',
        archetype: 'file',
        permissions: [
          { id: this.generateId(), name: 'file.view', resource: 'file', action: 'view', scope: 'shared' },
          { id: this.generateId(), name: 'file.download', resource: 'file', action: 'download', scope: 'public' },
          { id: this.generateId(), name: 'file.preview', resource: 'file', action: 'preview', scope: 'shared' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 20, category: 'viewing' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Create discussion-specific roles
   */
  private async createDiscussionRoles(organizationId: string): Promise<Role[]> {
    return [
      {
        id: this.generateId(),
        name: 'discussion_moderator',
        displayName: 'Discussion Moderator',
        description: 'Moderate discussions and enforce community guidelines',
        organizationId,
        type: 'archetype',
        archetype: 'discussion',
        permissions: [
          { id: this.generateId(), name: 'discussion.moderate', resource: 'discussion', action: 'moderate', scope: 'organization' },
          { id: this.generateId(), name: 'discussion.lock', resource: 'discussion', action: 'lock', scope: 'any' },
          { id: this.generateId(), name: 'discussion.pin', resource: 'discussion', action: 'pin', scope: 'any' },
          { id: this.generateId(), name: 'discussion.delete', resource: 'discussion', action: 'delete', scope: 'any' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 80, category: 'moderation' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'discussion_participant',
        displayName: 'Discussion Participant',
        description: 'Actively participate in discussions and conversations',
        organizationId,
        type: 'archetype',
        archetype: 'discussion',
        permissions: [
          { id: this.generateId(), name: 'discussion.create', resource: 'discussion', action: 'create', scope: 'organization' },
          { id: this.generateId(), name: 'discussion.reply', resource: 'discussion', action: 'reply', scope: 'accessible' },
          { id: this.generateId(), name: 'discussion.react', resource: 'discussion', action: 'react', scope: 'accessible' },
          { id: this.generateId(), name: 'discussion.edit', resource: 'discussion', action: 'edit', scope: 'own' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 40, category: 'participation' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'discussion_observer',
        displayName: 'Discussion Observer',
        description: 'Read discussions and stay informed',
        organizationId,
        type: 'archetype',
        archetype: 'discussion',
        permissions: [
          { id: this.generateId(), name: 'discussion.read', resource: 'discussion', action: 'read', scope: 'public' },
          { id: this.generateId(), name: 'discussion.search', resource: 'discussion', action: 'search', scope: 'public' },
          { id: this.generateId(), name: 'discussion.subscribe', resource: 'discussion', action: 'subscribe', scope: 'public' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 20, category: 'observation' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Create document-specific roles
   */
  private async createDocumentRoles(organizationId: string): Promise<Role[]> {
    return [
      {
        id: this.generateId(),
        name: 'document_author',
        displayName: 'Document Author',
        description: 'Create and own documents with full editorial control',
        organizationId,
        type: 'archetype',
        archetype: 'document',
        permissions: [
          { id: this.generateId(), name: 'document.create', resource: 'document', action: 'create', scope: 'organization' },
          { id: this.generateId(), name: 'document.edit', resource: 'document', action: 'edit', scope: 'own' },
          { id: this.generateId(), name: 'document.delete', resource: 'document', action: 'delete', scope: 'own' },
          { id: this.generateId(), name: 'document.publish', resource: 'document', action: 'publish', scope: 'own' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 80, category: 'authoring' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'document_editor',
        displayName: 'Document Editor',
        description: 'Edit and review documents for quality and consistency',
        organizationId,
        type: 'archetype',
        archetype: 'document',
        permissions: [
          { id: this.generateId(), name: 'document.edit', resource: 'document', action: 'edit', scope: 'assigned' },
          { id: this.generateId(), name: 'document.review', resource: 'document', action: 'review', scope: 'assigned' },
          { id: this.generateId(), name: 'document.comment', resource: 'document', action: 'comment', scope: 'assigned' },
          { id: this.generateId(), name: 'document.suggest', resource: 'document', action: 'suggest', scope: 'assigned' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 60, category: 'editing' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'document_reviewer',
        displayName: 'Document Reviewer',
        description: 'Review documents for approval and quality assurance',
        organizationId,
        type: 'archetype',
        archetype: 'document',
        permissions: [
          { id: this.generateId(), name: 'document.review', resource: 'document', action: 'review', scope: 'team' },
          { id: this.generateId(), name: 'document.approve', resource: 'document', action: 'approve', scope: 'team' },
          { id: this.generateId(), name: 'document.reject', resource: 'document', action: 'reject', scope: 'team' },
          { id: this.generateId(), name: 'document.comment', resource: 'document', action: 'comment', scope: 'team' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 70, category: 'review' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'document_reader',
        displayName: 'Document Reader',
        description: 'Read published and shared documents',
        organizationId,
        type: 'archetype',
        archetype: 'document',
        permissions: [
          { id: this.generateId(), name: 'document.read', resource: 'document', action: 'read', scope: 'published' },
          { id: this.generateId(), name: 'document.search', resource: 'document', action: 'search', scope: 'accessible' },
          { id: this.generateId(), name: 'document.export', resource: 'document', action: 'export', scope: 'published' }
        ],
        isSystemRole: true,
        isActive: true,
        metadata: { level: 30, category: 'reading' },
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Permission definitions for organization roles
   */
  private async getSystemAdminPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'organization.admin', resource: 'organization', action: 'admin' },
      { id: this.generateId(), name: 'organization.manage_members', resource: 'organization', action: 'manage_members' },
      { id: this.generateId(), name: 'organization.settings', resource: 'organization', action: 'settings' },
      { id: this.generateId(), name: 'organization.billing', resource: 'organization', action: 'billing' },
      { id: this.generateId(), name: 'organization.security', resource: 'organization', action: 'security' },
      { id: this.generateId(), name: 'all.admin', resource: '*', action: 'admin' }
    ];
  }

  private async getOrganizationManagerPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'organization.manage', resource: 'organization', action: 'manage' },
      { id: this.generateId(), name: 'organization.invite_members', resource: 'organization', action: 'invite_members' },
      { id: this.generateId(), name: 'project.admin', resource: 'project', action: 'admin', scope: 'organization' },
      { id: this.generateId(), name: 'user.manage', resource: 'user', action: 'manage', scope: 'organization' },
      { id: this.generateId(), name: 'analytics.view', resource: 'analytics', action: 'view', scope: 'organization' }
    ];
  }

  private async getDepartmentManagerPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'project.admin', resource: 'project', action: 'admin', scope: 'department' },
      { id: this.generateId(), name: 'task.admin', resource: 'task', action: 'admin', scope: 'department' },
      { id: this.generateId(), name: 'user.assign', resource: 'user', action: 'assign', scope: 'department' },
      { id: this.generateId(), name: 'file.manage', resource: 'file', action: 'manage', scope: 'department' },
      { id: this.generateId(), name: 'analytics.view', resource: 'analytics', action: 'view', scope: 'department' }
    ];
  }

  private async getTeamLeadPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'project.manage', resource: 'project', action: 'manage', scope: 'team' },
      { id: this.generateId(), name: 'task.assign', resource: 'task', action: 'assign', scope: 'team' },
      { id: this.generateId(), name: 'task.review', resource: 'task', action: 'review', scope: 'team' },
      { id: this.generateId(), name: 'file.organize', resource: 'file', action: 'organize', scope: 'team' },
      { id: this.generateId(), name: 'discussion.moderate', resource: 'discussion', action: 'moderate', scope: 'team' }
    ];
  }

  private async getOrganizationMemberPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'assigned' },
      { id: this.generateId(), name: 'task.write', resource: 'task', action: 'write', scope: 'assigned' },
      { id: this.generateId(), name: 'file.upload', resource: 'file', action: 'upload', scope: 'project' },
      { id: this.generateId(), name: 'discussion.participate', resource: 'discussion', action: 'participate', scope: 'organization' },
      { id: this.generateId(), name: 'document.read', resource: 'document', action: 'read', scope: 'shared' }
    ];
  }

  private async getOrganizationViewerPermissions(): Promise<Permission[]> {
    return [
      { id: this.generateId(), name: 'project.read', resource: 'project', action: 'read', scope: 'public' },
      { id: this.generateId(), name: 'task.read', resource: 'task', action: 'read', scope: 'public' },
      { id: this.generateId(), name: 'file.view', resource: 'file', action: 'view', scope: 'public' },
      { id: this.generateId(), name: 'discussion.read', resource: 'discussion', action: 'read', scope: 'public' },
      { id: this.generateId(), name: 'document.read', resource: 'document', action: 'read', scope: 'public' }
    ];
  }

  /**
   * Role assignment and management
   */
  async assignRole(assignment: Omit<UserRole, 'id'>): Promise<UserRole> {
    return {
      id: this.generateId(),
      ...assignment
    };
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: string, resource: string, entityId?: string): Promise<boolean> {
    // Implementation would check user's roles and permissions in the database
    // This is a placeholder for the actual permission checking logic
    return true;
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId: string, organizationId: string): Promise<Permission[]> {
    // Implementation would aggregate all permissions from user's roles
    // including inherited permissions from role hierarchy
    return [];
  }

  /**
   * Permission validation utilities
   */
  validatePermission(permission: Permission): string[] {
    const errors: string[] = [];

    if (!permission.name) errors.push('Permission name is required');
    if (!permission.resource) errors.push('Permission resource is required');
    if (!permission.action) errors.push('Permission action is required');

    return errors;
  }

  validateRole(role: Role): string[] {
    const errors: string[] = [];

    if (!role.name) errors.push('Role name is required');
    if (!role.displayName) errors.push('Role display name is required');
    if (!role.organizationId) errors.push('Organization ID is required');
    if (!role.type) errors.push('Role type is required');

    return errors;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rbac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Role Management Utilities
 */
export class RoleManagementUtilities {
  /**
   * Valid role types
   */
  static readonly ROLE_TYPES = ['organization', 'archetype', 'custom'] as const;

  /**
   * Valid permission actions
   */
  static readonly PERMISSION_ACTIONS = [
    'read', 'write', 'delete', 'admin', 'manage', 'create', 'update',
    'assign', 'review', 'approve', 'moderate', 'upload', 'download',
    'share', 'organize', 'comment', 'participate', 'view', 'export'
  ] as const;

  /**
   * Valid permission scopes
   */
  static readonly PERMISSION_SCOPES = [
    'own', 'assigned', 'team', 'department', 'organization', 'public',
    'shared', 'member', 'project', 'any', 'watching', 'accessible'
  ] as const;

  /**
   * Get default roles for organization
   */
  static getDefaultOrganizationRoles(): string[] {
    return [
      'system_admin',
      'organization_manager', 
      'department_manager',
      'team_lead',
      'organization_member',
      'organization_viewer'
    ];
  }

  /**
   * Get archetype-specific roles
   */
  static getArchetypeRoles(archetype: string): string[] {
    const roleMap: Record<string, string[]> = {
      project: ['project_owner', 'project_manager', 'project_contributor', 'project_viewer'],
      task: ['task_assignee', 'task_reviewer', 'task_watcher'],
      file: ['file_manager', 'file_contributor', 'file_viewer'],
      discussion: ['discussion_moderator', 'discussion_participant', 'discussion_observer'],
      document: ['document_author', 'document_editor', 'document_reviewer', 'document_reader']
    };

    return roleMap[archetype] || [];
  }

  /**
   * Calculate role hierarchy level
   */
  static calculateRoleLevel(role: Role): number {
    return role.metadata?.level || 0;
  }

  /**
   * Check if role can inherit from parent
   */
  static canInheritFrom(childRole: Role, parentRole: Role): boolean {
    // Child role level should be lower than parent
    return this.calculateRoleLevel(childRole) < this.calculateRoleLevel(parentRole);
  }

  /**
   * Filter roles by type
   */
  static filterByType(roles: Role[], type: string): Role[] {
    return roles.filter(role => role.type === type);
  }

  /**
   * Filter active roles
   */
  static filterActive(roles: Role[]): Role[] {
    return roles.filter(role => role.isActive);
  }

  /**
   * Sort roles by hierarchy level
   */
  static sortByLevel(roles: Role[]): Role[] {
    return roles.sort((a, b) => this.calculateRoleLevel(b) - this.calculateRoleLevel(a));
  }

  /**
   * Get role statistics
   */
  static calculateRoleStats(roles: Role[]) {
    return {
      total: roles.length,
      active: roles.filter(r => r.isActive).length,
      byType: {
        organization: roles.filter(r => r.type === 'organization').length,
        archetype: roles.filter(r => r.type === 'archetype').length,
        custom: roles.filter(r => r.type === 'custom').length
      },
      systemRoles: roles.filter(r => r.isSystemRole).length,
      customRoles: roles.filter(r => !r.isSystemRole).length
    };
  }
}

export default RoleManagementService;