import { DiscussionArchetype } from '../../entities/archetypes/DiscussionArchetype.js';
import { ArchetypeAccessControlService, AccessContext, PermissionLevel, SensitiveFieldConfig } from './ArchetypeAccessControlService.js';

/**
 * Discussion-specific access control service
 * Implements access patterns for all discussion archetype entities
 * Co-located with discussion entities for type safety and maintainability
 */
export class DiscussionAccessControlService extends ArchetypeAccessControlService<DiscussionArchetype> {
  
  /**
   * Check if user can read a discussion
   * Discussions are readable by:
   * - Discussion author
   * - Discussion participants
   * - Organization members (for public discussions)
   * - Users with appropriate container permissions
   * - Users explicitly granted access via discussion ACL
   */
  canRead(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author always has read access
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Check if user is a participant
    if (this.isDiscussionParticipant(userId, discussion)) {
      return true;
    }

    // Check built-in discussion access control
    if (discussion.accessControl) {
      const userRoles = context?.userRoles || [];
      if (!discussion.canUserAccess(userId, userRoles)) {
        return false;
      }
    }

    // Check if discussion is publicly accessible
    if (this.isPubliclyAccessible(discussion)) {
      return this.isOrganizationMember(userId, discussion, context);
    }

    // Check container-level permissions
    const container = this.getEntityContainer(discussion);
    return this.hasContainerPermission(userId, container, 'read', context);
  }

  /**
   * Check if user can write/update a discussion
   * Discussions are writable by:
   * - Discussion author
   * - Discussion moderators
   * - Users with discussion management permissions
   * - Participants with write permissions
   */
  canWrite(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can update
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Discussion moderators can write
    if (this.isDiscussionModerator(userId, discussion)) {
      return true;
    }

    // Check if discussion is locked
    if (discussion.isLocked()) {
      // Only moderators can write to locked discussions
      return this.isDiscussionModerator(userId, discussion) ||
             this.hasOrganizationRole(userId, ['admin', 'moderator'], context);
    }

    // Check if user has participant write permissions
    const participant = discussion.getParticipant(userId);
    if (participant?.permissions?.includes('write')) {
      return true;
    }

    // Organization admins can write
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Check container-level write permissions
    const container = this.getEntityContainer(discussion);
    return this.hasContainerPermission(userId, container, 'write', context);
  }

  /**
   * Check if user can delete a discussion
   * Discussions are deletable by:
   * - Discussion author
   * - Discussion moderators
   * - Organization admins
   * - Users with explicit delete permissions
   */
  canDelete(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can delete
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Discussion moderators can delete
    if (this.isDiscussionModerator(userId, discussion)) {
      return true;
    }

    // Organization admins can delete
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Check for explicit delete permissions
    const participant = discussion.getParticipant(userId);
    if (participant?.permissions?.includes('delete')) {
      return true;
    }

    // Check container-level delete permissions
    const container = this.getEntityContainer(discussion);
    return this.hasContainerPermission(userId, container, 'delete', context);
  }

  /**
   * Check if user can perform admin operations on a discussion
   * Admin operations include moderation, access control changes, etc.
   * Available to:
   * - Discussion author
   * - Discussion moderators
   * - Organization admins
   * - Users with moderation permissions
   */
  canAdmin(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author has admin access
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Discussion moderators have admin access
    if (this.isDiscussionModerator(userId, discussion)) {
      return true;
    }

    // Organization admins have admin access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with moderation permissions
    if (this.hasOrganizationRole(userId, ['moderator', 'community_manager'], context)) {
      return true;
    }

    // Check container-level admin permissions
    const container = this.getEntityContainer(discussion);
    return this.hasContainerPermission(userId, container, 'admin', context);
  }

  /**
   * Filter discussion fields based on user permissions
   * Removes sensitive moderation data, analytics, and personal information
   */
  filterFields(userId: string, discussion: DiscussionArchetype, context?: AccessContext): Partial<DiscussionArchetype> {
    const userPermissions = this.getUserPermissions(userId, discussion, context);
    
    const sensitiveFields: SensitiveFieldConfig[] = [
      {
        fieldName: 'moderationInfo',
        requiredPermissions: ['moderation_access', 'discussion_admin', 'discussion_owner'],
        description: 'Moderation data and reports'
      },
      {
        fieldName: 'contentAnalysis',
        requiredPermissions: ['analytics_access', 'discussion_admin', 'content_analyzer'],
        description: 'Content analysis and sentiment data'
      },
      {
        fieldName: 'statistics',
        requiredPermissions: ['analytics_access', 'discussion_admin', 'stats_viewer'],
        description: 'Discussion statistics and engagement metrics'
      },
      {
        fieldName: 'qualityMetrics',
        requiredPermissions: ['quality_access', 'discussion_admin', 'quality_reviewer'],
        description: 'Quality assessment and review data'
      },
      {
        fieldName: 'participants',
        requiredPermissions: ['participant_access', 'discussion_admin', 'member_viewer'],
        description: 'Participant list and activity data'
      },
      {
        fieldName: 'externalIntegrations',
        requiredPermissions: ['integration_access', 'discussion_admin', 'system_viewer'],
        description: 'External system integrations'
      }
    ];

    // Start with all fields
    const filteredDiscussion = { ...discussion } as Partial<DiscussionArchetype>;

    // Apply sensitive field filtering
    return this.applySensitiveFieldFiltering(filteredDiscussion, userPermissions, sensitiveFields);
  }

  /**
   * Discussion-specific business logic: Check if user is a participant
   */
  isDiscussionParticipant(userId: string, discussion: DiscussionArchetype): boolean {
    return !!discussion.getParticipant(userId);
  }

  /**
   * Discussion-specific business logic: Check if user is a moderator
   */
  isDiscussionModerator(userId: string, discussion: DiscussionArchetype): boolean {
    return discussion.canUserModerate(userId) || discussion.moderatorId === userId;
  }

  /**
   * Discussion-specific business logic: Check if user can participate
   */
  canParticipate(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must have read access first
    if (!this.canRead(userId, discussion, context)) {
      return false;
    }

    // Check if discussion allows participation
    const userRoles = context?.userRoles || [];
    if (!discussion.canUserParticipate(userId, userRoles)) {
      return false;
    }

    // Check if discussion is locked or archived
    if (discussion.isLocked() || discussion.isArchived()) {
      // Only moderators can participate in locked/archived discussions
      return this.isDiscussionModerator(userId, discussion) ||
             this.hasOrganizationRole(userId, ['admin', 'moderator'], context);
    }

    return true;
  }

  /**
   * Discussion-specific business logic: Check if user can moderate the discussion
   */
  canModerate(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can moderate
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Assigned moderator can moderate
    if (discussion.moderatorId === userId) {
      return true;
    }

    // Organization moderators can moderate
    if (this.hasOrganizationRole(userId, ['admin', 'moderator', 'community_manager'], context)) {
      return true;
    }

    // Check for explicit moderation permissions
    const participant = discussion.getParticipant(userId);
    return participant?.permissions?.includes('moderate') ?? false;
  }

  /**
   * Discussion-specific business logic: Check if user can react to the discussion
   */
  canReact(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must be able to participate
    if (!this.canParticipate(userId, discussion, context)) {
      return false;
    }

    // Cannot react to archived discussions
    if (discussion.isArchived()) {
      return false;
    }

    return true;
  }

  /**
   * Discussion-specific business logic: Check if user can pin the discussion
   */
  canPin(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must have admin access
    if (!this.canAdmin(userId, discussion, context)) {
      return false;
    }

    // Check for explicit pin permissions
    const participant = discussion.getParticipant(userId);
    if (participant?.permissions?.includes('pin')) {
      return true;
    }

    // Moderators can pin
    return this.canModerate(userId, discussion, context);
  }

  /**
   * Discussion-specific business logic: Check if user can lock the discussion
   */
  canLock(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must have admin access
    if (!this.canAdmin(userId, discussion, context)) {
      return false;
    }

    // Check for explicit lock permissions
    const participant = discussion.getParticipant(userId);
    if (participant?.permissions?.includes('lock')) {
      return true;
    }

    // Moderators can lock
    return this.canModerate(userId, discussion, context);
  }

  /**
   * Discussion-specific business logic: Check if user can archive the discussion
   */
  canArchive(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can archive
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Organization admins can archive
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Moderators can archive
    return this.canModerate(userId, discussion, context);
  }

  /**
   * Discussion-specific business logic: Check if user can view analytics
   */
  canViewAnalytics(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can view analytics
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Users with analytics permissions
    if (this.hasOrganizationRole(userId, ['admin', 'analytics_viewer', 'community_manager'], context)) {
      return true;
    }

    // Moderators can view analytics
    return this.isDiscussionModerator(userId, discussion);
  }

  /**
   * Discussion-specific business logic: Check if user can manage participants
   */
  canManageParticipants(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can manage participants
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Moderators can manage participants
    if (this.isDiscussionModerator(userId, discussion)) {
      return true;
    }

    // Organization admins can manage participants
    return this.hasOrganizationRole(userId, ['admin', 'community_manager'], context);
  }

  /**
   * Discussion-specific business logic: Get discussion access level for user
   */
  getDiscussionAccessLevel(userId: string, discussion: DiscussionArchetype, context?: AccessContext): 'none' | 'viewer' | 'participant' | 'moderator' | 'author' {
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return 'author';
    }

    if (this.canModerate(userId, discussion, context)) {
      return 'moderator';
    }

    if (this.canParticipate(userId, discussion, context)) {
      return 'participant';
    }

    if (this.canRead(userId, discussion, context)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * Discussion-specific business logic: Check discussion visibility level
   */
  getDiscussionVisibility(discussion: DiscussionArchetype): 'public' | 'private' | 'restricted' | 'archived' {
    // Check if archived
    if (discussion.isArchived()) {
      return 'archived';
    }

    // Check built-in access control
    if (discussion.accessControl?.visibility) {
      return discussion.accessControl.visibility;
    }

    // Check archetype-level visibility
    if (discussion.visibility) {
      return discussion.visibility === 'archived' ? 'archived' : discussion.visibility;
    }

    // Check if publicly accessible
    if (this.isPubliclyAccessible(discussion)) {
      return 'public';
    }

    // Default to private
    return 'private';
  }

  /**
   * Helper method to get user permissions for the discussion
   */
  private getUserPermissions(userId: string, discussion: DiscussionArchetype, context?: AccessContext): string[] {
    const permissions: string[] = [];

    // Add role-based permissions
    if (context?.userRoles) {
      permissions.push(...context.userRoles);
    }

    // Add discussion-specific permissions
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      permissions.push('discussion_owner', 'moderation_access', 'analytics_access', 
                      'quality_access', 'participant_access', 'integration_access', 'discussion_admin');
    }

    if (this.isDiscussionModerator(userId, discussion)) {
      permissions.push('moderation_access', 'participant_access', 'discussion_admin');
    }

    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      permissions.push('moderation_access', 'analytics_access', 'quality_access', 
                      'participant_access', 'integration_access', 'discussion_admin');
    }

    if (this.hasOrganizationRole(userId, ['moderator', 'community_manager'], context)) {
      permissions.push('moderation_access', 'participant_access', 'analytics_access');
    }

    if (this.hasOrganizationRole(userId, ['analytics_viewer'], context)) {
      permissions.push('analytics_access', 'stats_viewer');
    }

    // Add participant-specific permissions
    const participant = discussion.getParticipant(userId);
    if (participant?.permissions) {
      permissions.push(...participant.permissions.map(p => `participant_${p}`));
    }

    return permissions;
  }

  /**
   * Discussion-specific validation: Check if user can flag the discussion
   */
  canFlag(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must be able to read the discussion
    if (!this.canRead(userId, discussion, context)) {
      return false;
    }

    // Cannot flag own discussion
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return false;
    }

    // Organization members can flag
    return this.isOrganizationMember(userId, discussion, context);
  }

  /**
   * Discussion-specific validation: Check if user can report the discussion
   */
  canReport(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Must be able to read the discussion
    if (!this.canRead(userId, discussion, context)) {
      return false;
    }

    // Organization members can report
    return this.isOrganizationMember(userId, discussion, context);
  }

  /**
   * Discussion-specific validation: Check if user can edit discussion access control
   */
  canManageAccess(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can manage access
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Organization admins can manage access
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with access management permissions
    return this.hasOrganizationRole(userId, ['access_manager'], context);
  }

  /**
   * Discussion-specific validation: Check if user can view sensitive moderation data
   */
  canViewModerationData(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion moderators can view moderation data
    if (this.isDiscussionModerator(userId, discussion)) {
      return true;
    }

    // Organization moderators can view moderation data
    if (this.hasOrganizationRole(userId, ['admin', 'moderator'], context)) {
      return true;
    }

    return false;
  }

  /**
   * Discussion-specific validation: Check if user can export discussion data
   */
  canExportData(userId: string, discussion: DiscussionArchetype, context?: AccessContext): boolean {
    // Discussion author can export data
    if (this.isEntityOwner(userId, discussion) || discussion.authorId === userId) {
      return true;
    }

    // Organization admins can export data
    if (this.hasOrganizationRole(userId, ['admin'], context)) {
      return true;
    }

    // Users with data export permissions
    return this.hasOrganizationRole(userId, ['data_exporter'], context);
  }
}