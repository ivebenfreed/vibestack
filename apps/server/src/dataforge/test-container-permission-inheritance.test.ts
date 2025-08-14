/**
 * Container Permission Inheritance Test
 * 
 * Tests all container types and permission inheritance patterns for Universal Archetype system.
 * Validates that permissions work correctly across different container hierarchies.
 */

import { describe, it, expect } from 'vitest';
import { ArchetypeAccessService } from '../services/archetype-access-service';
import { ContainerPermission, ContainerPermissionUtilities } from '../dataforge/entities/foundation/access/ContainerPermission';

// Mock Kysely instance for testing
const mockKysely = {
  selectFrom: () => ({
    selectAll: () => ({
      where: () => ({
        where: () => ({
          where: () => ({
            where: () => ({
              execute: async () => []
            })
          })
        })
      })
    })
  })
} as any;

describe('Container Permission Inheritance and All Container Types', () => {
  const accessService = new ArchetypeAccessService(mockKysely);
  const testUserId = 'test-user-inheritance';

  describe('Container Type Support', () => {
    it('should support all ContainerPermission types', () => {
      const supportedTypes = ContainerPermissionUtilities.CONTAINER_TYPES;
      
      console.log('=== SUPPORTED CONTAINER TYPES ===');
      supportedTypes.forEach(type => {
        console.log(`✅ ${type.toUpperCase()}`);
      });
      
      expect(supportedTypes).toContain('organization');
      expect(supportedTypes).toContain('department');
      expect(supportedTypes).toContain('project');
      expect(supportedTypes).toContain('workspace');
      expect(supportedTypes).toContain('user');
      expect(supportedTypes).toContain('system');
      
      console.log(`✅ All ${supportedTypes.length} container types supported`);
    });

    it('should support all permission roles', () => {
      const supportedRoles = ContainerPermissionUtilities.PERMISSION_ROLES;
      
      console.log('=== SUPPORTED PERMISSION ROLES ===');
      supportedRoles.forEach(role => {
        console.log(`✅ ${role.toUpperCase()}`);
      });
      
      expect(supportedRoles).toContain('viewer');
      expect(supportedRoles).toContain('contributor');
      expect(supportedRoles).toContain('member');
      expect(supportedRoles).toContain('manager');
      expect(supportedRoles).toContain('admin');
      expect(supportedRoles).toContain('owner');
      
      console.log(`✅ All ${supportedRoles.length} permission roles supported`);
    });
  });

  describe('Permission Inheritance Patterns', () => {
    it('should test permission inheritance hierarchy', async () => {
      const inheritanceTests = await accessService.testPermissionInheritance(testUserId);
      
      console.log('=== PERMISSION INHERITANCE TEST RESULTS ===');
      
      inheritanceTests.testResults.forEach(test => {
        console.log(`\n${test.scenario}:`);
        console.log(`  Container: ${test.containerType}/${test.containerId}`);
        console.log(`  Role: ${test.role}`);
        console.log(`  Expected Inheritance: [${test.expectedInheritance.join(', ')}]`);
        console.log(`  Permissions: Read:${test.actualPermissions.canRead} Write:${test.actualPermissions.canWrite} Manage:${test.actualPermissions.canManage} Admin:${test.actualPermissions.canAdminister}`);
        console.log(`  Result: ${test.passed ? '✅ PASSED' : '❌ FAILED'}`);
      });
      
      console.log(`\n=== SUMMARY ===`);
      console.log(`Total Tests: ${inheritanceTests.summary.totalTests}`);
      console.log(`Passed: ${inheritanceTests.summary.passed}`);
      console.log(`Failed: ${inheritanceTests.summary.failed}`);
      
      // All tests should pass
      expect(inheritanceTests.summary.failed).toBe(0);
      expect(inheritanceTests.summary.passed).toBe(inheritanceTests.summary.totalTests);
    });
  });

  describe('Container Hierarchy Testing', () => {
    it('should validate system-level permissions', () => {
      const systemAdmin = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'system',
        permission_container_id: 'global',
        role: 'admin'
      });

      expect(systemAdmin.canAdminister()).toBe(true);
      expect(systemAdmin.canManage()).toBe(true);
      expect(systemAdmin.canWrite()).toBe(true);
      expect(systemAdmin.canRead()).toBe(true);
      expect(systemAdmin.getPermissionLevel()).toBe(50);
      
      console.log('✅ System Admin permissions validated');
    });

    it('should validate organization-level permissions', () => {
      const orgOwner = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'organization',
        permission_container_id: 'test-org',
        role: 'owner'
      });

      expect(orgOwner.canAdminister()).toBe(true);
      expect(orgOwner.getPermissionLevel()).toBe(60);
      expect(orgOwner.isOwner()).toBe(true);
      
      console.log('✅ Organization Owner permissions validated');
    });

    it('should validate department-level permissions', () => {
      const deptManager = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'department',
        permission_container_id: 'engineering-dept',
        role: 'manager'
      });

      expect(deptManager.canManage()).toBe(true);
      expect(deptManager.canWrite()).toBe(true);
      expect(deptManager.canAdminister()).toBe(false);
      expect(deptManager.getPermissionLevel()).toBe(40);
      
      console.log('✅ Department Manager permissions validated');
    });

    it('should validate project-level permissions', () => {
      const projectMember = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'project',
        permission_container_id: 'archetype-project',
        role: 'member'
      });

      expect(projectMember.canWrite()).toBe(true);
      expect(projectMember.canRead()).toBe(true);
      expect(projectMember.canManage()).toBe(false);
      expect(projectMember.getPermissionLevel()).toBe(30);
      
      console.log('✅ Project Member permissions validated');
    });

    it('should validate workspace-level permissions', () => {
      const workspaceContributor = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'workspace',
        permission_container_id: 'design-workspace',
        role: 'contributor'
      });

      expect(workspaceContributor.canWrite()).toBe(true);
      expect(workspaceContributor.canRead()).toBe(true);
      expect(workspaceContributor.canManage()).toBe(false);
      expect(workspaceContributor.getPermissionLevel()).toBe(20);
      
      console.log('✅ Workspace Contributor permissions validated');
    });

    it('should validate user-level permissions', () => {
      const userViewer = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'user',
        permission_container_id: 'other-user-id',
        role: 'viewer'
      });

      expect(userViewer.canRead()).toBe(true);
      expect(userViewer.canWrite()).toBe(false);
      expect(userViewer.getPermissionLevel()).toBe(10);
      
      console.log('✅ User Viewer permissions validated');
    });
  });

  describe('Permission Level Hierarchy', () => {
    it('should validate role hierarchy ordering', () => {
      const roles = ['viewer', 'contributor', 'member', 'manager', 'admin', 'owner'];
      const permissions = roles.map(role => 
        ContainerPermissionUtilities.createPermission({
          user_id: testUserId,
          permission_container_type: 'organization',
          permission_container_id: 'test-org',
          role
        })
      );

      console.log('=== ROLE HIERARCHY VALIDATION ===');
      
      for (let i = 0; i < permissions.length - 1; i++) {
        const current = permissions[i];
        const next = permissions[i + 1];
        
        expect(next.getPermissionLevel()).toBeGreaterThan(current.getPermissionLevel());
        expect(next.isHigherThan(current.role)).toBe(true);
        
        console.log(`✅ ${next.role} (${next.getPermissionLevel()}) > ${current.role} (${current.getPermissionLevel()})`);
      }
      
      console.log('✅ Role hierarchy properly ordered');
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle multiple container permissions', () => {
      // User has different roles in different containers
      const permissions = [
        ContainerPermissionUtilities.createPermission({
          user_id: testUserId,
          permission_container_type: 'system',
          permission_container_id: 'global',
          role: 'viewer' // Low system access
        }),
        ContainerPermissionUtilities.createPermission({
          user_id: testUserId,
          permission_container_type: 'organization', 
          permission_container_id: 'test-org',
          role: 'admin' // High org access
        }),
        ContainerPermissionUtilities.createPermission({
          user_id: testUserId,
          permission_container_type: 'project',
          permission_container_id: 'special-project',
          role: 'owner' // Highest project access
        })
      ];

      // Find highest permission
      const highest = ContainerPermissionUtilities.getHighestPermission(
        permissions, 
        testUserId, 
        'project', 
        'special-project'
      );

      expect(highest).toBeTruthy();
      expect(highest!.role).toBe('owner');
      expect(highest!.getPermissionLevel()).toBe(60);
      
      console.log('✅ Multiple container permissions - highest found correctly');
    });

    it('should handle permission expiration', () => {
      const expiredPermission = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'project',
        permission_container_id: 'expired-project',
        role: 'admin',
        expires_at: new Date(Date.now() - 86400000) // Expired yesterday
      });

      expect(expiredPermission.isExpired()).toBe(true);
      expect(expiredPermission.isActive()).toBe(false);
      
      const activePermission = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'project',
        permission_container_id: 'active-project',
        role: 'admin',
        expires_at: new Date(Date.now() + 86400000) // Expires tomorrow
      });

      expect(activePermission.isExpired()).toBe(false);
      expect(activePermission.isActive()).toBe(true);
      
      console.log('✅ Permission expiration handling validated');
    });

    it('should handle permission restrictions', () => {
      const restrictedPermission = ContainerPermissionUtilities.createPermission({
        user_id: testUserId,
        permission_container_type: 'project',
        permission_container_id: 'restricted-project',
        role: 'member',
        restrictions: {
          'no_delete': true,
          'read_only_fields': ['sensitive_data'],
          'max_records': 100
        }
      });

      expect(restrictedPermission.hasRestriction('no_delete')).toBe(true);
      expect(restrictedPermission.getRestriction('max_records')).toBe(100);
      expect(restrictedPermission.hasRestriction('non_existent')).toBe(false);
      
      console.log('✅ Permission restrictions handling validated');
    });
  });

  describe('Permission Utility Functions', () => {
    it('should validate permission data correctly', () => {
      const validData = {
        user_id: 'test-user',
        permission_container_type: 'organization',
        permission_container_id: 'test-org',
        role: 'member'
      };

      const errors = ContainerPermissionUtilities.validatePermissionData(validData);
      expect(errors).toHaveLength(0);
      
      const invalidData = {
        user_id: '',
        permission_container_type: 'invalid_type',
        permission_container_id: '',
        role: 'invalid_role'
      };

      const invalidErrors = ContainerPermissionUtilities.validatePermissionData(invalidData);
      expect(invalidErrors.length).toBeGreaterThan(0);
      
      console.log('✅ Permission validation working correctly');
    });

    it('should filter and group permissions correctly', () => {
      const permissions = [
        ContainerPermissionUtilities.createPermission({
          user_id: 'user1',
          permission_container_type: 'organization',
          permission_container_id: 'org1',
          role: 'admin'
        }),
        ContainerPermissionUtilities.createPermission({
          user_id: 'user2',
          permission_container_type: 'organization',
          permission_container_id: 'org1',
          role: 'member'
        }),
        ContainerPermissionUtilities.createPermission({
          user_id: 'user1',
          permission_container_type: 'project',
          permission_container_id: 'proj1',
          role: 'owner'
        })
      ];

      const groupedByUser = ContainerPermissionUtilities.groupByUser(permissions);
      expect(Object.keys(groupedByUser)).toHaveLength(2);
      expect(groupedByUser['user1']).toHaveLength(2);
      
      const groupedByContainer = ContainerPermissionUtilities.groupByContainer(permissions);
      expect(Object.keys(groupedByContainer)).toHaveLength(2);
      
      const stats = ContainerPermissionUtilities.calculateStats(permissions);
      expect(stats.total).toBe(3);
      expect(stats.byRole['admin']).toBe(1);
      expect(stats.byRole['member']).toBe(1);
      expect(stats.byRole['owner']).toBe(1);
      
      console.log('✅ Permission utility functions working correctly');
    });
  });
});