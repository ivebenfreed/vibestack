import { FileArchetype } from '../../entities/archetypes/FileArchetype.js';
import { ArchetypeAccessControlService, AccessContext, PermissionLevel, SensitiveFieldConfig } from './ArchetypeAccessControlService.js';

/**
 * File-specific access control service
 * Implements access patterns for all file archetype entities
 * Co-located with file entities for type safety and maintainability
 */
export class FileAccessControlService extends ArchetypeAccessControlService<FileArchetype> {
  
  /**
   * Check if user can read a file
   * Files are readable by:
   * - File uploader/owner
   * - Users with file access permissions
   * - Organization members (for public files)
   * - Users explicitly granted access via file ACL
   */
  canRead(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File uploader/owner always has read access
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Check built-in file access control
    if (file.accessControl) {
      const userRoles = context?.userRoles || [];
      if (!file.canAccess(userId, userRoles)) {
        return false;
      }
    }

    // Check if file is publicly accessible
    if (this.isPubliclyAccessible(file)) {
      return this.isOrganizationMember(userId, file, context);
    }

    // Check container-level permissions
    const container = this.getEntityContainer(file);
    return this.hasContainerPermission(userId, container, 'read', context);
  }

  /**
   * Check if user can write/update a file
   * Files are writable by:
   * - File uploader/owner
   * - Users with file management permissions
   * - Organization admins
   * - Users with explicit write access
   */
  canWrite(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File uploader/owner can update
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Organization admins can update files
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with file management role
    if (this.hasOrganizationRole(userId, ['file_manager', 'content_manager'], context)) {
      return true;
    }

    // Check container-level write permissions
    const container = this.getEntityContainer(file);
    return this.hasContainerPermission(userId, container, 'write', context);
  }

  /**
   * Check if user can delete a file
   * Files are deletable by:
   * - File uploader/owner
   * - Organization admins
   * - Users with explicit delete permissions
   */
  canDelete(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File uploader/owner can delete
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Organization admins can delete
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with file management permissions
    if (this.hasOrganizationRole(userId, ['file_manager'], context)) {
      return true;
    }

    // Check container-level delete permissions
    const container = this.getEntityContainer(file);
    return this.hasContainerPermission(userId, container, 'delete', context);
  }

  /**
   * Check if user can perform admin operations on a file
   * Admin operations include permission changes, security settings, etc.
   * Available to:
   * - File uploader/owner
   * - Organization admins
   * - Users with file administration permissions
   */
  canAdmin(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File uploader/owner has admin access
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Organization admins have admin access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with file administration permissions
    if (this.hasOrganizationRole(userId, ['file_admin'], context)) {
      return true;
    }

    // Check container-level admin permissions
    const container = this.getEntityContainer(file);
    return this.hasContainerPermission(userId, container, 'admin', context);
  }

  /**
   * Filter file fields based on user permissions
   * Removes sensitive metadata, security info, and download statistics from unauthorized users
   */
  filterFields(userId: string, file: FileArchetype, context?: AccessContext): Partial<FileArchetype> {
    const userPermissions = this.getUserPermissions(userId, file, context);
    
    const sensitiveFields: SensitiveFieldConfig[] = [
      {
        fieldName: 'virusScan',
        requiredPermissions: ['security_access', 'file_admin', 'file_owner'],
        description: 'Virus scan results and security information'
      },
      {
        fieldName: 'downloadStats',
        requiredPermissions: ['analytics_access', 'file_admin', 'file_owner'],
        description: 'File download statistics and usage analytics'
      },
      {
        fieldName: 'backupInfo',
        requiredPermissions: ['system_access', 'file_admin', 'backup_viewer'],
        description: 'File backup and system information'
      },
      {
        fieldName: 'processingInfo',
        requiredPermissions: ['system_access', 'file_admin', 'processing_viewer'],
        description: 'File processing status and technical details'
      },
      {
        fieldName: 'uploadedBy',
        requiredPermissions: ['user_info_access', 'file_admin', 'privacy_viewer'],
        description: 'File uploader identification'
      },
      {
        fieldName: 'checksum',
        requiredPermissions: ['technical_access', 'file_admin', 'integrity_viewer'],
        description: 'File integrity checksum'
      }
    ];

    // Start with all fields
    const filteredFile = { ...file } as Partial<FileArchetype>;

    // Apply sensitive field filtering
    return this.applySensitiveFieldFiltering(filteredFile, userPermissions, sensitiveFields);
  }

  /**
   * File-specific business logic: Check if user can download the file
   */
  canDownload(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Must have read access first
    if (!this.canRead(userId, file, context)) {
      return false;
    }

    // Check built-in file download permissions
    const userRoles = context?.userRoles || [];
    if (!file.canDownload(userId, userRoles)) {
      return false;
    }

    // Check if file is safe to download
    if (!this.isFileSafeToDownload(file)) {
      // Only admins can download unsafe files
      return this.hasOrganizationRole(userId, ['admin', 'security_admin'], context);
    }

    return true;
  }

  /**
   * File-specific business logic: Check if user can upload new versions
   */
  canUploadVersion(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Must have write access
    if (!this.canWrite(userId, file, context)) {
      return false;
    }

    // File owner can always upload versions
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Users with versioning permissions
    if (this.hasOrganizationRole(userId, ['version_manager', 'content_manager'], context)) {
      return true;
    }

    return false;
  }

  /**
   * File-specific business logic: Check if user can view file metadata
   */
  canViewMetadata(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Must have read access
    if (!this.canRead(userId, file, context)) {
      return false;
    }

    // File owner can view all metadata
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Users with metadata viewing permissions
    if (this.hasOrganizationRole(userId, ['metadata_viewer', 'file_admin'], context)) {
      return true;
    }

    // Organization members can view basic metadata for accessible files
    return this.isOrganizationMember(userId, file, context);
  }

  /**
   * File-specific business logic: Check if user can manage file access control
   */
  canManageAccess(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File owner can manage access
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Organization admins can manage access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with access management permissions
    if (this.hasOrganizationRole(userId, ['access_manager', 'file_admin'], context)) {
      return true;
    }

    return false;
  }

  /**
   * File-specific business logic: Check if user can view file relationships
   */
  canViewRelationships(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Must have read access to the file
    if (!this.canRead(userId, file, context)) {
      return false;
    }

    // All users with read access can view relationships
    return true;
  }

  /**
   * File-specific business logic: Check if user can manage file relationships
   */
  canManageRelationships(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Must have write access
    if (!this.canWrite(userId, file, context)) {
      return false;
    }

    // File owner can manage relationships
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Users with relationship management permissions
    if (this.hasOrganizationRole(userId, ['relationship_manager', 'content_manager'], context)) {
      return true;
    }

    return false;
  }

  /**
   * File-specific business logic: Get file access level for user
   */
  getFileAccessLevel(userId: string, file: FileArchetype, context?: AccessContext): 'none' | 'viewer' | 'downloader' | 'editor' | 'manager' | 'owner' {
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return 'owner';
    }

    if (this.canAdmin(userId, file, context)) {
      return 'manager';
    }

    if (this.canWrite(userId, file, context)) {
      return 'editor';
    }

    if (this.canDownload(userId, file, context)) {
      return 'downloader';
    }

    if (this.canRead(userId, file, context)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * File-specific business logic: Check file visibility level
   */
  getFileVisibility(file: FileArchetype): 'public' | 'private' | 'restricted' | 'internal' {
    // Check built-in access control
    if (file.accessControl?.visibility) {
      return file.accessControl.visibility;
    }

    // Check archetype-level visibility
    if (this.isPubliclyAccessible(file)) {
      return 'public';
    }

    // Default to private
    return 'private';
  }

  /**
   * File-specific validation: Check if file is safe to download
   */
  isFileSafeToDownload(file: FileArchetype): boolean {
    // Check virus scan status
    if (file.virusScan) {
      return file.virusScan.scanned && file.virusScan.clean;
    }

    // If no virus scan info, consider unsafe by default
    return false;
  }

  /**
   * File-specific validation: Check if user can bypass security restrictions
   */
  canBypassSecurity(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // Only security admins can bypass security
    return this.hasOrganizationRole(userId, ['admin', 'security_admin'], context);
  }

  /**
   * File-specific validation: Check if user can view security information
   */
  canViewSecurityInfo(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File owner can view security info
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Security admins can view security info
    if (this.hasOrganizationRole(userId, ['admin', 'security_admin'], context)) {
      return true;
    }

    return false;
  }

  /**
   * Helper method to get user permissions for the file
   */
  private getUserPermissions(userId: string, file: FileArchetype, context?: AccessContext): string[] {
    const permissions: string[] = [];

    // Add role-based permissions
    if (context?.userRoles) {
      permissions.push(...context.userRoles);
    }

    // Add file-specific permissions
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      permissions.push('file_owner', 'security_access', 'analytics_access', 'system_access', 
                      'user_info_access', 'technical_access', 'file_admin');
    }

    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      permissions.push('security_access', 'analytics_access', 'system_access', 
                      'user_info_access', 'technical_access', 'file_admin');
    }

    if (this.hasOrganizationRole(userId, ['file_manager', 'content_manager'], context)) {
      permissions.push('analytics_access', 'user_info_access', 'technical_access');
    }

    if (this.hasOrganizationRole(userId, ['security_admin'], context)) {
      permissions.push('security_access', 'system_access', 'technical_access');
    }

    return permissions;
  }

  /**
   * File-specific validation: Check if user can perform bulk operations
   */
  canPerformBulkOperations(userId: string, context?: AccessContext): boolean {
    // Organization admins can perform bulk operations
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // File managers can perform bulk operations
    if (this.hasOrganizationRole(userId, ['file_manager', 'bulk_operation_manager'], context)) {
      return true;
    }

    return false;
  }

  /**
   * File-specific validation: Check if user can access file analytics
   */
  canAccessAnalytics(userId: string, file: FileArchetype, context?: AccessContext): boolean {
    // File owner can access analytics
    if (this.isEntityOwner(userId, file) || file.uploadedBy === userId) {
      return true;
    }

    // Users with analytics permissions
    if (this.hasOrganizationRole(userId, ['admin', 'analytics_viewer', 'file_admin'], context)) {
      return true;
    }

    return false;
  }
}