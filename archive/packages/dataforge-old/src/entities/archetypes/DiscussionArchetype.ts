import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all discussion-related entities
 * Provides common discussion fields and communication patterns
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class DiscussionArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  content?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'discussion_type' })
  discussionType?: string;

  @Property({ type: 'string', default: 'active' })
  status!: string;

  @Property({ type: 'string', nullable: true })
  visibility?: 'public' | 'private' | 'restricted' | 'archived';

  @Property({ type: 'uuid', nullable: true, fieldName: 'author_id' })
  authorId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'moderator_id' })
  moderatorId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'last_activity' })
  lastActivity?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'locked_at' })
  lockedAt?: Date;

  @Property({ type: 'uuid', nullable: true, fieldName: 'locked_by' })
  lockedBy?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'lock_reason' })
  lockReason?: string;

  // Parent discussion for hierarchical organization
  @ManyToOne(() => DiscussionArchetype, { nullable: true, fieldName: 'parent_discussion_id' })
  parentDiscussion?: DiscussionArchetype;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'json', nullable: true })
  participants?: Array<{
    userId: string;
    role: 'author' | 'moderator' | 'participant' | 'observer' | 'banned';
    joinedAt: Date;
    lastSeen?: Date;
    contributionCount?: number;
    reputation?: number;
    permissions?: Array<'read' | 'write' | 'moderate' | 'delete' | 'pin' | 'lock'>;
  }>;

  @Property({ type: 'json', nullable: true })
  statistics?: {
    viewCount?: number;
    participantCount?: number;
    messageCount?: number;
    reactionCount?: number;
    shareCount?: number;
    bookmarkCount?: number;
    upvoteCount?: number;
    downvoteCount?: number;
    reportCount?: number;
    engagementScore?: number;
    averageResponseTime?: number; // minutes
    peakActivityHours?: Record<string, number>; // hour -> activity count
  };

  @Property({ type: 'json', nullable: true, fieldName: 'content_analysis' })
  contentAnalysis?: {
    wordCount?: number;
    readingTime?: number; // minutes
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
    toxicityScore?: number; // 0-100
    topicCategories?: string[];
    keywords?: string[];
    mentions?: Array<{
      userId: string;
      position: number;
      context: string;
    }>;
    hashtags?: string[];
    urls?: Array<{
      url: string;
      domain: string;
      title?: string;
      safe: boolean;
    }>;
    lastAnalyzed?: Date;
  };

  @Property({ type: 'json', nullable: true })
  reactions?: Array<{
    type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'helpful' | 'agree' | 'disagree' | 'question' | 'idea';
    userId: string;
    timestamp: Date;
    removed?: boolean;
    removedAt?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'moderation_info' })
  moderationInfo?: {
    flaggedCount?: number;
    reportedCount?: number;
    moderatedAt?: Date;
    moderatedBy?: string;
    moderationAction?: 'none' | 'warning' | 'edit' | 'hide' | 'lock' | 'delete' | 'ban_user';
    moderationReason?: string;
    autoModerated?: boolean;
    appealStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
    appealedAt?: Date;
    appealedBy?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'notification_settings' })
  notificationSettings?: {
    notifyOnReply?: boolean;
    notifyOnMention?: boolean;
    notifyOnReaction?: boolean;
    notifyParticipants?: boolean;
    digestFrequency?: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
    channels?: Array<'email' | 'push' | 'sms' | 'slack' | 'webhook'>;
    quietHours?: {
      enabled: boolean;
      startHour?: number;
      endHour?: number;
      timezone?: string;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'access_control' })
  accessControl?: {
    visibility: 'public' | 'private' | 'restricted';
    allowedUsers?: string[];
    allowedRoles?: string[];
    blockedUsers?: string[];
    requireApproval?: boolean;
    allowAnonymous?: boolean;
    allowGuests?: boolean;
    moderatorOverride?: boolean;
    inheritFromParent?: boolean;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'search_optimization' })
  searchOptimization?: {
    searchableContent?: string; // Processed content for search
    keywords?: string[];
    categories?: string[];
    indexed?: boolean;
    indexedAt?: Date;
    searchScore?: number;
    popularityBoost?: number;
    freshnessFactor?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'collaboration_features' })
  collaborationFeatures?: {
    allowCollaboration?: boolean;
    realTimeEditing?: boolean;
    versionControl?: boolean;
    commentingEnabled?: boolean;
    suggestionsEnabled?: boolean;
    collaborators?: Array<{
      userId: string;
      role: 'editor' | 'reviewer' | 'commenter';
      addedAt: Date;
      permissions: string[];
    }>;
    currentEditors?: Array<{
      userId: string;
      lastActivity: Date;
      cursor?: { line: number; column: number };
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'quality_metrics' })
  qualityMetrics?: {
    helpfulnessScore?: number; // 0-100
    accuracyScore?: number; // 0-100
    clarityScore?: number; // 0-100
    completenessScore?: number; // 0-100
    relevanceScore?: number; // 0-100
    userRating?: number; // 1-5 stars
    expertVerified?: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    qualityIssues?: Array<{
      type: 'spam' | 'off_topic' | 'inappropriate' | 'misleading' | 'low_quality';
      severity: 'low' | 'medium' | 'high';
      reportedBy: string;
      reportedAt: Date;
      resolved: boolean;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'archive_info' })
  archiveInfo?: {
    archived: boolean;
    archivedAt?: Date;
    archivedBy?: string;
    archiveReason?: string;
    preserveContent?: boolean;
    retentionPeriod?: number; // days
    deleteAfter?: Date;
    exportAvailable?: boolean;
    exportUrl?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'related_discussions' })
  relatedDiscussions?: Array<{
    discussionId: string;
    relationship: 'duplicate' | 'related' | 'follow_up' | 'merged_from' | 'split_to';
    strength: number; // 0-100, how related
    createdAt: Date;
    createdBy?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'external_integrations' })
  externalIntegrations?: {
    slack?: {
      channelId?: string;
      threadId?: string;
      synced: boolean;
      lastSync?: Date;
    };
    jira?: {
      issueKey?: string;
      linked: boolean;
      lastSync?: Date;
    };
    github?: {
      repositoryId?: string;
      issueNumber?: number;
      pullRequestNumber?: number;
      linked: boolean;
    };
    webhook?: Array<{
      url: string;
      events: string[];
      active: boolean;
      lastTriggered?: Date;
    }>;
  };

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'discussion';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'flexible'; // Discussions can belong to projects, teams, workspaces
  }

  // Abstract methods that concrete implementations must provide
  abstract getDiscussionType(): string;
  abstract validateDiscussionRules(): Promise<boolean>;
  abstract processContent(): Promise<void>;
  abstract notifyParticipants(event: string, data?: Record<string, any>): Promise<void>;

  // Common discussion business logic
  isActive(): boolean {
    return this.status === 'active' && !this.isLocked() && !this.isArchived();
  }

  isLocked(): boolean {
    return !!this.lockedAt && !!this.lockedBy;
  }

  isArchived(): boolean {
    return this.archiveInfo?.archived ?? false;
  }

  isPinned(): boolean {
    return this.getMetadata('pinned') === true;
  }

  isFeatured(): boolean {
    return this.getMetadata('featured') === true;
  }

  hasParent(): boolean {
    return !!this.parentDiscussion;
  }

  isRootDiscussion(): boolean {
    return !this.parentDiscussion;
  }

  // Participant management
  addParticipant(userId: string, role: NonNullable<DiscussionArchetype['participants']>[0]['role'] = 'participant'): void {
    if (!this.participants) {
      this.participants = [];
    }

    // Check if user is already a participant
    const existingParticipant = this.participants.find(p => p.userId === userId);
    
    if (existingParticipant) {
      // Update role if different
      if (existingParticipant.role !== role) {
        existingParticipant.role = role;
      }
      existingParticipant.lastSeen = new Date();
    } else {
      // Add new participant
      this.participants.push({
        userId,
        role,
        joinedAt: new Date(),
        lastSeen: new Date(),
        contributionCount: 0,
        permissions: this.getDefaultPermissions(role)
      });
    }

    this.updateStatistics();
  }

  removeParticipant(userId: string): boolean {
    if (!this.participants) return false;

    const index = this.participants.findIndex(p => p.userId === userId);
    if (index > -1) {
      this.participants.splice(index, 1);
      this.updateStatistics();
      return true;
    }
    return false;
  }

  getParticipant(userId: string): NonNullable<DiscussionArchetype['participants']>[0] | undefined {
    return this.participants?.find(p => p.userId === userId);
  }

  canUserParticipate(userId: string, userRoles: string[] = []): boolean {
    // Check if user is banned
    const participant = this.getParticipant(userId);
    if (participant?.role === 'banned') return false;

    // Check access control
    return this.canUserAccess(userId, userRoles);
  }

  canUserModerate(userId: string): boolean {
    const participant = this.getParticipant(userId);
    return participant?.role === 'moderator' || 
           participant?.permissions?.includes('moderate') || 
           this.moderatorId === userId;
  }

  private getDefaultPermissions(role: NonNullable<DiscussionArchetype['participants']>[0]['role']): NonNullable<NonNullable<DiscussionArchetype['participants']>[0]['permissions']> {
    const permissionMap: Record<string, NonNullable<NonNullable<DiscussionArchetype['participants']>[0]['permissions']>> = {
      author: ['read', 'write', 'moderate', 'delete', 'pin', 'lock'],
      moderator: ['read', 'write', 'moderate', 'delete', 'pin', 'lock'],
      participant: ['read', 'write'],
      observer: ['read'],
      banned: []
    };

    return permissionMap[role] || ['read'];
  }

  // Content management
  updateContent(newContent: string, userId: string): void {
    const oldContent = this.content;
    this.content = newContent;
    this.lastActivity = new Date();

    // Track contributor
    const participant = this.getParticipant(userId);
    if (participant) {
      participant.contributionCount = (participant.contributionCount || 0) + 1;
      participant.lastSeen = new Date();
    }

    // Re-analyze content if changed significantly
    if (this.hasSignificantContentChange(oldContent, newContent)) {
      this.scheduleContentAnalysis();
    }

    this.updateSearchOptimization();
  }

  private hasSignificantContentChange(oldContent?: string, newContent?: string): boolean {
    if (!oldContent && newContent) return true;
    if (oldContent && !newContent) return true;
    if (!oldContent && !newContent) return false;

    const oldWords = oldContent.split(/\s+/).length;
    const newWords = newContent.split(/\s+/).length;
    const changePercentage = Math.abs(oldWords - newWords) / Math.max(oldWords, newWords);
    
    return changePercentage > 0.1; // 10% word count change threshold
  }

  private scheduleContentAnalysis(): void {
    // Mark for content analysis (would be processed by background job)
    this.setMetadata('needsContentAnalysis', true);
  }

  private updateSearchOptimization(): void {
    if (!this.content) return;

    // Create searchable content
    const searchContent = [
      this.title,
      this.content,
      ...(this.tags || []),
      ...(this.contentAnalysis?.keywords || [])
    ].join(' ').toLowerCase();

    this.searchOptimization = {
      ...this.searchOptimization,
      searchableContent: searchContent,
      indexed: false, // Mark for re-indexing
      freshnessFactor: this.calculateFreshnessFactor()
    };
  }

  private calculateFreshnessFactor(): number {
    if (!this.lastActivity) return 0.5;
    
    const daysSinceActivity = (new Date().getTime() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    // Fresher content gets higher score
    if (daysSinceActivity <= 1) return 1.0;
    if (daysSinceActivity <= 7) return 0.9;
    if (daysSinceActivity <= 30) return 0.7;
    if (daysSinceActivity <= 90) return 0.5;
    return 0.3;
  }

  // Reaction management
  addReaction(userId: string, type: NonNullable<DiscussionArchetype['reactions']>[0]['type']): boolean {
    if (!this.reactions) {
      this.reactions = [];
    }

    // Check if user already reacted with this type
    const existingReaction = this.reactions.find(r => 
      r.userId === userId && r.type === type && !r.removed
    );

    if (existingReaction) {
      return false; // User already reacted
    }

    // Remove any previous reaction by this user (single reaction per user)
    const previousReaction = this.reactions.find(r => 
      r.userId === userId && !r.removed
    );

    if (previousReaction) {
      previousReaction.removed = true;
      previousReaction.removedAt = new Date();
    }

    // Add new reaction
    this.reactions.push({
      type,
      userId,
      timestamp: new Date()
    });

    this.updateStatistics();
    return true;
  }

  removeReaction(userId: string): boolean {
    if (!this.reactions) return false;

    const reaction = this.reactions.find(r => 
      r.userId === userId && !r.removed
    );

    if (reaction) {
      reaction.removed = true;
      reaction.removedAt = new Date();
      this.updateStatistics();
      return true;
    }

    return false;
  }

  getReactionCounts(): Record<string, number> {
    if (!this.reactions) return {};

    const counts: Record<string, number> = {};
    
    for (const reaction of this.reactions) {
      if (!reaction.removed) {
        counts[reaction.type] = (counts[reaction.type] || 0) + 1;
      }
    }

    return counts;
  }

  // Moderation
  flag(reportedBy: string, reason: string): void {
    if (!this.moderationInfo) {
      this.moderationInfo = { flaggedCount: 0 };
    }

    this.moderationInfo.flaggedCount = (this.moderationInfo.flaggedCount || 0) + 1;
    
    if (!this.qualityMetrics) {
      this.qualityMetrics = {};
    }

    if (!this.qualityMetrics.qualityIssues) {
      this.qualityMetrics.qualityIssues = [];
    }

    this.qualityMetrics.qualityIssues.push({
      type: 'inappropriate', // Default type
      severity: 'medium',
      reportedBy,
      reportedAt: new Date(),
      resolved: false
    });

    // Auto-moderate if flagged too many times
    if (this.moderationInfo.flaggedCount >= 5 && !this.moderationInfo.moderatedAt) {
      this.autoModerate();
    }
  }

  private autoModerate(): void {
    this.moderationInfo = {
      ...this.moderationInfo,
      moderatedAt: new Date(),
      moderatedBy: 'system',
      moderationAction: 'hide',
      moderationReason: 'Auto-moderated due to multiple flags',
      autoModerated: true
    };

    this.status = 'hidden';
  }

  moderate(moderatorId: string, action: NonNullable<DiscussionArchetype['moderationInfo']>['moderationAction'], reason?: string): void {
    this.moderationInfo = {
      ...this.moderationInfo,
      moderatedAt: new Date(),
      moderatedBy: moderatorId,
      moderationAction: action,
      moderationReason: reason,
      autoModerated: false
    };

    // Apply moderation action
    switch (action) {
      case 'hide':
        this.status = 'hidden';
        break;
      case 'lock':
        this.lock(moderatorId, reason || 'Moderated');
        break;
      case 'delete':
        this.status = 'deleted';
        break;
      case 'ban_user':
        this.banUser(this.authorId!, moderatorId);
        break;
    }
  }

  // Locking and unlocking
  lock(userId: string, reason?: string): void {
    this.lockedAt = new Date();
    this.lockedBy = userId;
    this.lockReason = reason;
    this.status = 'locked';
  }

  unlock(userId: string): void {
    this.lockedAt = undefined;
    this.lockedBy = undefined;
    this.lockReason = undefined;
    this.status = 'active';
  }

  private banUser(userId: string, moderatorId: string): void {
    const participant = this.getParticipant(userId);
    if (participant) {
      participant.role = 'banned';
      participant.permissions = [];
    }
  }

  // Archiving
  archive(userId: string, reason?: string, preserveContent: boolean = true): void {
    this.archiveInfo = {
      archived: true,
      archivedAt: new Date(),
      archivedBy: userId,
      archiveReason: reason,
      preserveContent,
      retentionPeriod: 365, // 1 year default
      deleteAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    };

    this.status = 'archived';
  }

  unarchive(userId: string): void {
    this.archiveInfo = {
      ...this.archiveInfo,
      archived: false,
      archivedAt: undefined,
      archivedBy: undefined
    };

    this.status = 'active';
  }

  // Access control
  canUserAccess(userId: string, userRoles: string[] = []): boolean {
    if (!this.accessControl) return true; // Default is open access

    // Check if user is blocked
    if (this.accessControl.blockedUsers?.includes(userId)) {
      return false;
    }

    switch (this.accessControl.visibility) {
      case 'public':
        return true;
      case 'private':
        return this.authorId === userId || this.createdBy === userId;
      case 'restricted':
        const allowedUsers = this.accessControl.allowedUsers || [];
        const allowedRoles = this.accessControl.allowedRoles || [];
        
        return allowedUsers.includes(userId) || 
               userRoles.some(role => allowedRoles.includes(role));
      default:
        return true;
    }
  }

  setAccessControl(visibility: NonNullable<DiscussionArchetype['accessControl']>['visibility'], 
                   allowedUsers?: string[], 
                   allowedRoles?: string[]): void {
    this.accessControl = {
      visibility,
      allowedUsers,
      allowedRoles,
      requireApproval: visibility === 'restricted',
      moderatorOverride: true
    };
  }

  // Statistics and analytics
  private updateStatistics(): void {
    if (!this.statistics) {
      this.statistics = {};
    }

    this.statistics.participantCount = this.participants?.length || 0;
    this.statistics.reactionCount = this.reactions?.filter(r => !r.removed).length || 0;
    
    // Calculate engagement score
    this.statistics.engagementScore = this.calculateEngagementScore();
  }

  private calculateEngagementScore(): number {
    const views = this.statistics?.viewCount || 0;
    const participants = this.statistics?.participantCount || 0;
    const messages = this.statistics?.messageCount || 0;
    const reactions = this.statistics?.reactionCount || 0;
    
    if (views === 0) return 0;
    
    // Engagement = (interactions / views) * 100
    const interactions = participants + messages + reactions;
    return Math.min(100, (interactions / views) * 100);
  }

  recordView(userId?: string): void {
    if (!this.statistics) {
      this.statistics = {};
    }

    this.statistics.viewCount = (this.statistics.viewCount || 0) + 1;
    this.lastActivity = new Date();

    // Update participant last seen
    if (userId) {
      const participant = this.getParticipant(userId);
      if (participant) {
        participant.lastSeen = new Date();
      }
    }

    // Track peak activity hours
    const currentHour = new Date().getHours().toString();
    if (!this.statistics.peakActivityHours) {
      this.statistics.peakActivityHours = {};
    }
    this.statistics.peakActivityHours[currentHour] = (this.statistics.peakActivityHours[currentHour] || 0) + 1;
  }

  incrementMessageCount(): void {
    if (!this.statistics) {
      this.statistics = {};
    }
    this.statistics.messageCount = (this.statistics.messageCount || 0) + 1;
    this.lastActivity = new Date();
    this.updateStatistics();
  }

  // Tag management
  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updateSearchOptimization();
    }
  }

  removeTag(tag: string): void {
    if (!this.tags) return;
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updateSearchOptimization();
    }
  }

  hasTag(tag: string): boolean {
    return this.tags?.includes(tag) ?? false;
  }

  // Metadata management
  setMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  getMetadata(key: string): any {
    return this.metadata?.[key];
  }

  // Related discussions
  addRelatedDiscussion(discussionId: string, relationship: NonNullable<DiscussionArchetype['relatedDiscussions']>[0]['relationship'], strength: number = 50): void {
    if (!this.relatedDiscussions) {
      this.relatedDiscussions = [];
    }

    // Check if relationship already exists
    const exists = this.relatedDiscussions.some(rel => 
      rel.discussionId === discussionId && rel.relationship === relationship
    );

    if (!exists) {
      this.relatedDiscussions.push({
        discussionId,
        relationship,
        strength,
        createdAt: new Date()
      });
    }
  }

  // Quality assessment
  calculateDiscussionQuality(): number {
    let score = 70; // Base score

    // Content quality
    const wordCount = this.contentAnalysis?.wordCount || 0;
    if (wordCount > 100) score += 10;
    if (wordCount > 500) score += 10;

    // Engagement
    const engagementScore = this.statistics?.engagementScore || 0;
    score += engagementScore * 0.2;

    // Reactions
    const positiveReactions = this.reactions?.filter(r => 
      !r.removed && ['like', 'love', 'helpful', 'agree'].includes(r.type)
    ).length || 0;
    score += Math.min(20, positiveReactions * 2);

    // Negative indicators
    const flaggedCount = this.moderationInfo?.flaggedCount || 0;
    score -= flaggedCount * 5;

    const toxicity = this.contentAnalysis?.toxicityScore || 0;
    score -= toxicity * 0.3;

    // Participation diversity
    const participantCount = this.statistics?.participantCount || 0;
    if (participantCount > 3) score += 10;
    if (participantCount > 10) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  // Discussion health assessment
  getDiscussionHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content quality (30%)
    factors.contentQuality = this.calculateContentQualityScore();
    if (factors.contentQuality < 60) {
      issues.push('Discussion content quality needs improvement');
    }

    // Engagement (25%)
    factors.engagement = this.statistics?.engagementScore || 0;
    if (factors.engagement < 30) {
      issues.push('Low engagement from participants');
    }

    // Moderation health (25%)
    factors.moderation = this.calculateModerationScore();
    if (factors.moderation < 70) {
      issues.push('Moderation issues detected');
    }

    // Activity level (20%)
    factors.activity = this.calculateActivityScore();
    if (factors.activity < 40) {
      issues.push('Discussion activity is low');
    }

    const totalScore = 
      factors.contentQuality * 0.3 + 
      factors.engagement * 0.25 + 
      factors.moderation * 0.25 + 
      factors.activity * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateContentQualityScore(): number {
    let score = 50; // Base score

    const wordCount = this.contentAnalysis?.wordCount || 0;
    if (wordCount > 50) score += 20;
    if (wordCount > 200) score += 15;
    if (wordCount > 500) score += 15;

    const sentiment = this.contentAnalysis?.sentiment;
    if (sentiment === 'positive') score += 10;
    else if (sentiment === 'negative') score -= 10;

    const toxicity = this.contentAnalysis?.toxicityScore || 0;
    score -= toxicity * 0.5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateModerationScore(): number {
    let score = 100; // Start with perfect score

    const flaggedCount = this.moderationInfo?.flaggedCount || 0;
    score -= flaggedCount * 10;

    const reportedCount = this.moderationInfo?.reportedCount || 0;
    score -= reportedCount * 15;

    if (this.moderationInfo?.moderatedAt) {
      const action = this.moderationInfo.moderationAction;
      switch (action) {
        case 'warning': score -= 10; break;
        case 'hide': score -= 30; break;
        case 'lock': score -= 40; break;
        case 'delete': score -= 60; break;
        case 'ban_user': score -= 80; break;
      }
    }

    return Math.max(0, score);
  }

  private calculateActivityScore(): number {
    if (!this.lastActivity) return 0;

    const daysSinceActivity = (new Date().getTime() - this.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    let score = 0;
    if (daysSinceActivity <= 1) score = 100;
    else if (daysSinceActivity <= 3) score = 90;
    else if (daysSinceActivity <= 7) score = 80;
    else if (daysSinceActivity <= 14) score = 60;
    else if (daysSinceActivity <= 30) score = 40;
    else if (daysSinceActivity <= 90) score = 20;
    else score = 10;

    // Boost for high message/participant activity
    const messageCount = this.statistics?.messageCount || 0;
    const participantCount = this.statistics?.participantCount || 0;
    
    const activityBoost = Math.min(20, (messageCount + participantCount * 5) / 10);
    score += activityBoost;

    return Math.min(100, score);
  }

  // Common validation that all discussions should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Discussion title is required');
    }

    if (this.title && this.title.length > 200) {
      errors.push('Discussion title is too long (max 200 characters)');
    }

    if (!this.authorId) {
      errors.push('Discussion author is required');
    }

    // Validate visibility settings
    if (this.accessControl) {
      if (!['public', 'private', 'restricted'].includes(this.accessControl.visibility)) {
        errors.push('Invalid access control visibility');
      }
    }

    // Validate status
    const validStatuses = ['active', 'locked', 'archived', 'hidden', 'deleted'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid discussion status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}