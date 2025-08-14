/**
 * Access Control System Test Suite
 * 
 * Comprehensive test coverage for RBAC system including:
 * - ContainerPermission entity
 * - RoleManagementService
 * - PermissionTemplateService
 * - AccessControlMiddleware
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { 
  ContainerPermission, 
  ContainerPermissionUtilities 
} from '../entities/access/ContainerPermission';
import { 
  RoleManagementService, 
  RoleManagementUtilities,
  Permission,
  Role 
} from '../services/access/RoleManagementService';
import { 
  PermissionTemplateService,
  PermissionTemplateUtilities 
} from '../services/access/PermissionTemplateService';
import { 
  AccessControlMiddleware,
  PermissionValidator 
} from '../middleware/AccessControlMiddleware';

describe('Access Control System - RBAC Integration', () => {

  describe('ContainerPermission Entity', () => {
    test('should create container permission with proper defaults', () => {
      const permission = new ContainerPermission({
        user_id: 'user-123',
        permission_container_type: 'project',
        permission_container_id: 'project-456',
        role: 'member',
        container_type: 'system',
        container_id: 'permissions'
      });

      expect(permission.user_id).toBe('user-123');
      expect(permission.permission_container_type).toBe('project');
      expect(permission.permission_container_id).toBe('project-456');
      expect(permission.role).toBe('member');
      expect(permission.archetype).toBe('permission');
      expect(permission.restrictions).toEqual({});
      expect(permission.granted_at).toBeDefined();
    });

    test('should validate permission levels correctly', () => {
      const viewerPermission = new ContainerPermission({ role: 'viewer' });
      const adminPermission = new ContainerPermission({ role: 'admin' });
      const ownerPermission = new ContainerPermission({ role: 'owner' });

      expect(viewerPermission.getPermissionLevel()).toBe(10);
      expect(adminPermission.getPermissionLevel()).toBe(50);
      expect(ownerPermission.getPermissionLevel()).toBe(60);

      expect(adminPermission.isHigherThan('member')).toBe(true);
      expect(viewerPermission.isHigherThan('admin')).toBe(false);
    });

    test('should handle permission capabilities correctly', () => {
      const adminPermission = new ContainerPermission({ role: 'admin' });
      const memberPermission = new ContainerPermission({ role: 'member' });
      const viewerPermission = new ContainerPermission({ role: 'viewer' });

      expect(adminPermission.canAdminister()).toBe(true);
      expect(adminPermission.canManage()).toBe(true);
      expect(adminPermission.canWrite()).toBe(true);
      expect(adminPermission.canRead()).toBe(true);

      expect(memberPermission.canAdminister()).toBe(false);
      expect(memberPermission.canWrite()).toBe(true);
      expect(memberPermission.canRead()).toBe(true);

      expect(viewerPermission.canWrite()).toBe(false);
      expect(viewerPermission.canRead()).toBe(true);
    });

    test('should handle expiration correctly', () => {
      const expiredPermission = new ContainerPermission({
        expires_at: new Date(Date.now() - 1000) // 1 second ago
      });

      const futurePe rmission = new ContainerPermission({
        expires_at: new Date(Date.now() + 86400000) // 1 day from now
      });

      const noExpiryPermission = new ContainerPermission({});

      expect(expiredPermission.isExpired()).toBe(true);
      expect(expiredPermission.isActive()).toBe(false);

      expect(futurePermission.isExpired()).toBe(false);
      expect(futurePermission.isExpiringSoon(2)).toBe(true); // Within 2 days

      expect(noExpiryPermission.isExpired()).toBe(false);
      expect(noExpiryPermission.isExpiringSoon()).toBe(false);
    });

    test('should handle restrictions correctly', () => {
      const permission = new ContainerPermission({});

      permission.addRestriction('field_access', ['name', 'email']);
      permission.addRestriction('time_restriction', '9-17');

      expect(permission.hasRestriction('field_access')).toBe(true);
      expect(permission.getRestriction('field_access')).toEqual(['name', 'email']);
      expect(permission.hasRestriction('nonexistent')).toBe(false);

      permission.removeRestriction('time_restriction');
      expect(permission.hasRestriction('time_restriction')).toBe(false);
    });

    test('should validate container access correctly', () => {
      const permission = new ContainerPermission({
        permission_container_type: 'project',
        permission_container_id: 'project-123',
        status: 'active'
      });

      expect(permission.grantsAccessTo('project', 'project-123')).toBe(true);
      expect(permission.grantsAccessTo('project', 'project-456')).toBe(false);
      expect(permission.grantsAccessTo('task', 'project-123')).toBe(false);
    });

    test('should generate proper SQL DDL and indexes', () => {
      const ddl = ContainerPermission.getContainerPermissionDDL();
      const indexes = ContainerPermission.getContainerPermissionIndexes();

      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "container_permission"');
      expect(ddl).toContain('CONSTRAINT unique_user_container_permission');
      expect(ddl).toContain('CONSTRAINT chk_valid_role');
      expect(ddl).toContain('CONSTRAINT chk_expiry_after_grant');

      expect(indexes.length).toBeGreaterThan(5);
      expect(indexes.some(idx => idx.includes('idx_container_permission_user'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_container_permission_container'))).toBe(true);
    });

    test('should validate permission data properly', () => {
      const validData = {
        user_id: 'user-123',
        permission_container_type: 'project',
        permission_container_id: 'project-456',
        role: 'member'
      };

      const invalidData = {
        // Missing user_id
        permission_container_type: 'invalid_type',
        role: 'invalid_role'
      };

      const validErrors = ContainerPermissionUtilities.validatePermissionData(validData);
      const invalidErrors = ContainerPermissionUtilities.validatePermissionData(invalidData);

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors).toContain('User ID is required');
      expect(invalidErrors.some(err => err.includes('Invalid container type'))).toBe(true);
      expect(invalidErrors.some(err => err.includes('Invalid role'))).toBe(true);
    });
  });

  describe('RoleManagementService', () => {
    let roleService: RoleManagementService;

    beforeEach(() => {
      roleService = new RoleManagementService();
    });

    test('should create complete organization role hierarchy', async () => {
      const organizationId = 'org-123';
      const roles = await roleService.createOrganizationRoles(organizationId);

      expect(roles).toHaveLength(6);
      
      const roleNames = roles.map(r => r.name);
      expect(roleNames).toContain('system_admin');
      expect(roleNames).toContain('organization_manager');
      expect(roleNames).toContain('department_manager');
      expect(roleNames).toContain('team_lead');
      expect(roleNames).toContain('organization_member');
      expect(roleNames).toContain('organization_viewer');

      // Check hierarchy
      const systemAdmin = roles.find(r => r.name === 'system_admin');
      const orgManager = roles.find(r => r.name === 'organization_manager');
      
      expect(systemAdmin?.metadata?.level).toBe(100);
      expect(orgManager?.metadata?.level).toBe(90);
      expect(orgManager?.parentRoleId).toBe(systemAdmin?.id);
    });

    test('should create archetype-specific roles', async () => {
      const organizationId = 'org-123';
      
      const projectRoles = await roleService.createArchetypeRoles(organizationId, 'project');
      const taskRoles = await roleService.createArchetypeRoles(organizationId, 'task');
      const fileRoles = await roleService.createArchetypeRoles(organizationId, 'file');

      expect(projectRoles.length).toBeGreaterThan(0);
      expect(taskRoles.length).toBeGreaterThan(0);
      expect(fileRoles.length).toBeGreaterThan(0);

      // Check project roles
      const projectRoleNames = projectRoles.map(r => r.name);
      expect(projectRoleNames).toContain('project_owner');
      expect(projectRoleNames).toContain('project_manager');
      expect(projectRoleNames).toContain('project_contributor');
      expect(projectRoleNames).toContain('project_viewer');

      // Check archetype field
      projectRoles.forEach(role => {
        expect(role.archetype).toBe('project');
        expect(role.type).toBe('archetype');
      });
    });

    test('should validate role data correctly', () => {
      const validRole: Role = {
        id: 'role-123',
        name: 'test_role',
        displayName: 'Test Role',
        description: 'A test role',
        organizationId: 'org-123',
        type: 'custom',
        permissions: [],
        isSystemRole: false,
        isActive: true,
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const invalidRole: Partial<Role> = {
        id: 'role-456'
        // Missing required fields
      };

      const validErrors = roleService.validateRole(validRole);
      const invalidErrors = roleService.validateRole(invalidRole as Role);

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors).toContain('Role name is required');
      expect(invalidErrors).toContain('Role display name is required');
    });

    test('should validate permission data correctly', () => {
      const validPermission: Permission = {
        id: 'perm-123',
        name: 'project.read',
        resource: 'project',
        action: 'read',
        scope: 'team'
      };

      const invalidPermission: Partial<Permission> = {
        id: 'perm-456'
        // Missing required fields
      };

      const validErrors = roleService.validatePermission(validPermission);
      const invalidErrors = roleService.validatePermission(invalidPermission as Permission);

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors).toContain('Permission name is required');
      expect(invalidErrors).toContain('Permission resource is required');
      expect(invalidErrors).toContain('Permission action is required');
    });

    test('should handle role assignment correctly', async () => {
      const assignment = {
        userId: 'user-123',
        roleId: 'role-456',
        organizationId: 'org-123',
        grantedBy: 'admin-user',
        grantedAt: new Date(),
        isActive: true
      };

      const userRole = await roleService.assignRole(assignment);

      expect(userRole.id).toBeDefined();
      expect(userRole.userId).toBe('user-123');
      expect(userRole.roleId).toBe('role-456');
      expect(userRole.isActive).toBe(true);
    });
  });

  describe('PermissionTemplateService', () => {
    let templateService: PermissionTemplateService;

    beforeEach(() => {
      templateService = new PermissionTemplateService();
    });

    test('should provide comprehensive template catalog', () => {
      const allTemplates = templateService.getAvailableTemplates();
      
      expect(allTemplates.length).toBeGreaterThan(10);
      
      // Check categories are represented
      const categories = [...new Set(allTemplates.map(t => t.category))];
      expect(categories).toContain('development');
      expect(categories).toContain('marketing');
      expect(categories).toContain('consulting');
      expect(categories).toContain('research');
      expect(categories).toContain('finance');
      expect(categories).toContain('human_resources');
    });

    test('should filter templates by category and industry', () => {
      const devTemplates = templateService.getTemplatesByCategory('development');
      const techTemplates = templateService.getTemplatesByIndustry('technology');

      expect(devTemplates.length).toBeGreaterThan(0);
      expect(techTemplates.length).toBeGreaterThan(0);

      devTemplates.forEach(template => {
        expect(template.category).toBe('development');
      });

      techTemplates.forEach(template => {
        expect(template.industry).toBe('technology');
      });
    });

    test('should validate template structure correctly', () => {
      const validTemplate = templateService.getAvailableTemplates()[0];
      const invalidTemplate = {
        // Missing required fields
        permissions: []
      };

      const validResult = templateService.validateTemplate(validTemplate);
      const invalidResult = templateService.validateTemplate(invalidTemplate as any);

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors).toContain('Template ID is required');
      expect(invalidResult.errors).toContain('Template name is required');
    });

    test('should apply templates correctly', async () => {
      const templates = templateService.getAvailableTemplates();
      const template = templates[0];
      
      const permissions = await templateService.applyTemplate(
        template.id, 
        'role-123', 
        'org-456'
      );

      expect(permissions.length).toBe(template.permissions.length);
      permissions.forEach(permission => {
        expect(permission.id).toBeDefined();
        expect(permission.name).toBeDefined();
        expect(permission.resource).toBeDefined();
        expect(permission.action).toBeDefined();
      });
    });

    test('should provide template recommendations', () => {
      const startupTemplates = templateService.getRecommendedTemplates('startup');
      const enterpriseTemplates = templateService.getRecommendedTemplates('enterprise');
      const agencyTemplates = templateService.getRecommendedTemplates('agency');

      expect(startupTemplates.length).toBeGreaterThan(0);
      expect(enterpriseTemplates.length).toBeGreaterThan(0);
      expect(agencyTemplates.length).toBeGreaterThan(0);

      // Startup should avoid complex templates
      startupTemplates.forEach(template => {
        expect(template.metadata.complexity).not.toBe('complex');
      });

      // Agency should focus on relevant categories
      agencyTemplates.forEach(template => {
        expect(['marketing', 'consulting'].some(cat => 
          template.category === cat || template.industry === 'marketing'
        )).toBe(true);
      });
    });

    test('should support template search', () => {
      const searchResults = templateService.searchTemplates(['developer', 'software']);
      
      expect(searchResults.length).toBeGreaterThan(0);
      searchResults.forEach(template => {
        const searchText = `${template.name} ${template.displayName} ${template.description}`.toLowerCase();
        expect(
          searchText.includes('developer') || 
          searchText.includes('software') ||
          template.metadata.tags.some(tag => 
            tag.includes('development') || tag.includes('software')
          )
        ).toBe(true);
      });
    });

    test('should provide template statistics', () => {
      const stats = templateService.getTemplateStats();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byIndustry).toBeDefined();
      expect(stats.byComplexity).toBeDefined();
      expect(stats.averagePermissions).toBeGreaterThan(0);
      
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byComplexity)).toContain('simple');
      expect(Object.keys(stats.byComplexity)).toContain('moderate');
      expect(Object.keys(stats.byComplexity)).toContain('complex');
    });

    test('should support template comparison', () => {
      const templates = templateService.getAvailableTemplates();
      const template1 = templates[0];
      const template2 = templates[1];
      
      const comparison = PermissionTemplateUtilities.compareTemplates(template1, template2);
      
      expect(comparison.common).toBeDefined();
      expect(comparison.onlyInFirst).toBeDefined();
      expect(comparison.onlyInSecond).toBeDefined();
      expect(Array.isArray(comparison.common)).toBe(true);
    });

    test('should support template merging', () => {
      const templates = templateService.getAvailableTemplates().slice(0, 3);
      const merged = PermissionTemplateUtilities.mergeTemplates(templates);
      
      expect(merged.id).toContain('merged_');
      expect(merged.displayName).toBe('Merged Template');
      expect(merged.permissions.length).toBeGreaterThan(0);
      expect(merged.metadata.complexity).toBe('complex');
      
      // Should contain unique permissions only
      const permissionNames = merged.permissions.map(p => p.name);
      const uniqueNames = [...new Set(permissionNames)];
      expect(permissionNames.length).toBe(uniqueNames.length);
    });

    test('should calculate complexity scores', () => {
      const templates = templateService.getAvailableTemplates();
      
      templates.forEach(template => {
        const score = PermissionTemplateUtilities.calculateComplexityScore(template);
        expect(score).toBeGreaterThan(0);
        
        // Complex templates should have higher scores
        if (template.metadata.complexity === 'complex') {
          expect(score).toBeGreaterThan(10);
        }
      });
    });
  });

  describe('AccessControlMiddleware', () => {
    test('should validate permission checks correctly', () => {
      const validCheck = {
        resource: 'project',
        action: 'read',
        scope: 'team'
      };

      const invalidCheck = {
        resource: 'invalid_resource',
        action: 'invalid_action'
      };

      const validErrors = PermissionValidator.validatePermissionCheck(validCheck);
      const invalidErrors = PermissionValidator.validatePermissionCheck(invalidCheck);

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.some(err => err.includes('Invalid resource'))).toBe(true);
      expect(invalidErrors.some(err => err.includes('Invalid action'))).toBe(true);
    });

    test('should validate access control options', () => {
      const validOptions = {
        required: [
          { resource: 'project', action: 'read' },
          { resource: 'task', action: 'write' }
        ],
        allowSuperAdmin: true
      };

      const invalidOptions = {
        required: [
          { resource: 'invalid', action: 'read' },
          { resource: 'project', action: 'invalid' }
        ]
      };

      const validErrors = PermissionValidator.validateAccessControlOptions(validOptions);
      const invalidErrors = PermissionValidator.validateAccessControlOptions(invalidOptions);

      expect(validErrors).toHaveLength(0);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });

    test('should provide resource-specific middleware helpers', () => {
      const projectReadMiddleware = AccessControlMiddleware.requireProjectAccess('read');
      const taskWriteMiddleware = AccessControlMiddleware.requireTaskAccess('write');
      const orgAdminMiddleware = AccessControlMiddleware.requireOrganizationAccess('admin');

      expect(typeof projectReadMiddleware).toBe('function');
      expect(typeof taskWriteMiddleware).toBe('function');
      expect(typeof orgAdminMiddleware).toBe('function');
    });

    test('should provide flexible permission combination helpers', () => {
      const anyOfMiddleware = AccessControlMiddleware.requireAnyOf([
        { resource: 'project', action: 'read' },
        { resource: 'task', action: 'read' }
      ]);

      const allOfMiddleware = AccessControlMiddleware.requireAllOf([
        { resource: 'project', action: 'write' },
        { resource: 'task', action: 'write' }
      ]);

      expect(typeof anyOfMiddleware).toBe('function');
      expect(typeof allOfMiddleware).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    test('should integrate container permissions with role management', async () => {
      const roleService = new RoleManagementService();
      
      // Create organization roles
      const roles = await roleService.createOrganizationRoles('org-123');
      const memberRole = roles.find(r => r.name === 'organization_member');
      
      // Create container permission
      const containerPermission = ContainerPermissionUtilities.createPermission({
        user_id: 'user-123',
        permission_container_type: 'project',
        permission_container_id: 'project-456',
        role: 'member',
        container_type: 'system',
        container_id: 'permissions'
      });

      expect(memberRole).toBeDefined();
      expect(containerPermission.role).toBe('member');
      expect(containerPermission.canWrite()).toBe(true);
    });

    test('should integrate templates with role creation', async () => {
      const templateService = new PermissionTemplateService();
      const roleService = new RoleManagementService();
      
      // Get a template
      const template = templateService.getAvailableTemplates()[0];
      
      // Apply template to create permissions
      const permissions = await templateService.applyTemplate(
        template.id,
        'role-123',
        'org-456'
      );

      expect(permissions.length).toBeGreaterThan(0);
      permissions.forEach(permission => {
        const errors = roleService.validatePermission(permission);
        expect(errors).toHaveLength(0);
      });
    });

    test('should support end-to-end permission workflow', async () => {
      const roleService = new RoleManagementService();
      const templateService = new PermissionTemplateService();
      
      // 1. Create organization with roles
      const organizationId = 'org-789';
      const roles = await roleService.createOrganizationRoles(organizationId);
      
      // 2. Get a permission template
      const template = templateService.getAvailableTemplates()
        .find(t => t.name === 'full_stack_developer');
      
      // 3. Apply template to create permissions
      const permissions = await templateService.applyTemplate(
        template!.id,
        roles[0].id,
        organizationId
      );
      
      // 4. Create container permission for user
      const containerPermission = new ContainerPermission({
        user_id: 'user-456',
        permission_container_type: 'project',
        permission_container_id: 'project-789',
        role: 'contributor',
        container_type: 'system',
        container_id: 'permissions'
      });

      // Verify integration
      expect(roles.length).toBeGreaterThan(0);
      expect(permissions.length).toBeGreaterThan(0);
      expect(containerPermission.canWrite()).toBe(true);
      
      // Verify permission structure
      permissions.forEach(permission => {
        expect(permission.resource).toBeDefined();
        expect(permission.action).toBeDefined();
      });
    });

    test('should handle complex permission scenarios', () => {
      const permissions = [
        new ContainerPermission({
          user_id: 'user-123',
          permission_container_type: 'project',
          permission_container_id: 'project-1',
          role: 'admin'
        }),
        new ContainerPermission({
          user_id: 'user-123',
          permission_container_type: 'project',
          permission_container_id: 'project-2',
          role: 'viewer'
        }),
        new ContainerPermission({
          user_id: 'user-456',
          permission_container_type: 'project',
          permission_container_id: 'project-1',
          role: 'member'
        })
      ];

      // Test filtering utilities
      const user123Permissions = ContainerPermissionUtilities.filterByUser(permissions, 'user-123');
      const project1Permissions = ContainerPermissionUtilities.filterByContainer(permissions, 'project', 'project-1');
      const adminPermissions = ContainerPermissionUtilities.filterByRole(permissions, 'admin');

      expect(user123Permissions).toHaveLength(2);
      expect(project1Permissions).toHaveLength(2);
      expect(adminPermissions).toHaveLength(1);

      // Test highest permission
      const highestForUser123InProject1 = ContainerPermissionUtilities.getHighestPermission(
        permissions, 'user-123', 'project', 'project-1'
      );
      expect(highestForUser123InProject1?.role).toBe('admin');

      // Test permission level checking
      const hasAdminLevel = ContainerPermissionUtilities.hasPermissionLevel(
        permissions, 'user-123', 'project', 'project-1', 'admin'
      );
      expect(hasAdminLevel).toBe(true);
    });

    test('should calculate comprehensive statistics', () => {
      const permissions = [
        new ContainerPermission({ role: 'admin', status: 'active' }),
        new ContainerPermission({ role: 'member', status: 'active' }),
        new ContainerPermission({ role: 'viewer', status: 'inactive' }),
        new ContainerPermission({ 
          role: 'admin', 
          status: 'active',
          expires_at: new Date(Date.now() + 86400000) // 1 day from now
        })
      ];

      const stats = ContainerPermissionUtilities.calculateStats(permissions);

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(3);
      expect(stats.byRole.admin).toBe(2);
      expect(stats.byRole.member).toBe(1);
      expect(stats.byRole.viewer).toBe(1);
      expect(stats.averagePermissionLevel).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid permission data gracefully', () => {
      expect(() => {
        ContainerPermissionUtilities.createPermission({});
      }).toThrow('Permission validation failed');
      
      expect(() => {
        ContainerPermissionUtilities.createPermission({
          user_id: 'user-123',
          permission_container_type: 'invalid',
          permission_container_id: 'container-123'
        });
      }).toThrow('Invalid container type');
    });

    test('should handle template application errors', async () => {
      const templateService = new PermissionTemplateService();
      
      await expect(
        templateService.applyTemplate('nonexistent-template', 'role-123', 'org-456')
      ).rejects.toThrow('Permission template nonexistent-template not found');
    });

    test('should handle empty permission sets gracefully', () => {
      const emptyPermissions: ContainerPermission[] = [];
      
      const stats = ContainerPermissionUtilities.calculateStats(emptyPermissions);
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.averagePermissionLevel).toBe(0);
      
      const highest = ContainerPermissionUtilities.getHighestPermission(
        emptyPermissions, 'user-123', 'project', 'project-456'
      );
      expect(highest).toBeNull();
    });

    test('should validate role hierarchy correctly', () => {
      const roles = [
        { metadata: { level: 100 } },
        { metadata: { level: 50 } },
        { metadata: { level: 90 } }
      ] as Role[];

      const sorted = RoleManagementUtilities.sortByLevel(roles);
      expect(sorted[0].metadata?.level).toBe(100);
      expect(sorted[1].metadata?.level).toBe(90);
      expect(sorted[2].metadata?.level).toBe(50);
    });
  });
});