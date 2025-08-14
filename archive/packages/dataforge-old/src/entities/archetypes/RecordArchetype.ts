import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all record-related entities
 * Provides common record fields and knowledge management patterns
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class RecordArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  content?: string;

  @Property({ type: 'integer', default: 1 })
  version!: number;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property({ nullable: true })
  status?: string;

  @Property({ nullable: true, fieldName: 'record_type' })
  recordType?: string;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'uuid', nullable: true, fieldName: 'author_id' })
  authorId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'reviewer_id' })
  reviewerId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'published_at' })
  publishedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'reviewed_at' })
  reviewedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'archived_at' })
  archivedAt?: Date;

  // Parent record for hierarchy/organization
  @ManyToOne(() => RecordArchetype, { nullable: true, fieldName: 'parent_record_id' })
  parentRecord?: RecordArchetype;

  @Property({ type: 'json', nullable: true, fieldName: 'revision_history' })
  revisionHistory?: Array<{
    version: number;
    authorId: string;
    timestamp: Date;
    changes: string;
    contentSnapshot?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'access_control' })
  accessControl?: {
    visibility: 'public' | 'private' | 'restricted';
    allowedUsers?: string[];
    allowedRoles?: string[];
    inheritFromParent?: boolean;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'related_entities' })
  relatedEntities?: Array<{
    entityType: string;
    entityId: string;
    relationship: 'references' | 'documents' | 'supports' | 'derives_from';
    description?: string;
  }>;

  // Search and indexing fields
  @Property({ type: 'text', nullable: true, fieldName: 'search_content' })
  searchContent?: string; // Processed content for search indexing

  @Property({ type: 'json', nullable: true, fieldName: 'keywords' })
  keywords?: string[];

  @Property({ type: 'text', nullable: true })
  summary?: string;

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'record';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'flexible'; // Records can belong to projects, departments, workspaces
  }

  // Abstract methods that concrete implementations must provide
  abstract getRecordType(): string;
  abstract validateRecordRules(): Promise<boolean>;
  abstract processContent(): Promise<void>;
  abstract generateSummary(): Promise<string>;

  // Common record business logic
  isPublished(): boolean {
    return !!this.publishedAt && this.status === 'published';
  }

  isDraft(): boolean {
    return this.status === 'draft' || !this.publishedAt;
  }

  isArchived(): boolean {
    return !!this.archivedAt || this.status === 'archived';
  }

  isReviewed(): boolean {
    return !!this.reviewedAt && !!this.reviewerId;
  }

  hasParent(): boolean {
    return !!this.parentRecord;
  }

  isRootRecord(): boolean {
    return !this.parentRecord;
  }

  // Version management
  getCurrentVersion(): number {
    return this.version;
  }

  createRevision(authorId: string, changes: string): void {
    if (!this.revisionHistory) {
      this.revisionHistory = [];
    }

    // Save current content as snapshot
    const revision = {
      version: this.version,
      authorId,
      timestamp: new Date(),
      changes,
      contentSnapshot: this.content
    };

    this.revisionHistory.push(revision);
    this.version += 1;
  }

  getRevisionHistory(): NonNullable<RecordArchetype['revisionHistory']> {
    return this.revisionHistory || [];
  }

  rollbackToVersion(targetVersion: number): boolean {
    const revision = this.revisionHistory?.find(r => r.version === targetVersion);
    if (!revision) return false;

    this.content = revision.contentSnapshot;
    this.version = targetVersion;
    return true;
  }

  // Content management
  updateContent(newContent: string, authorId: string, changes: string): void {
    if (this.content !== newContent) {
      this.createRevision(authorId, changes);
      this.content = newContent;
      this.updateSearchContent();
    }
  }

  private updateSearchContent(): void {
    // Create searchable content by combining title, content, and metadata
    const searchParts: string[] = [this.title];
    
    if (this.content) {
      // Strip HTML/markdown and normalize whitespace
      const plainContent = this.content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[#*_`]/g, '') // Remove markdown
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      searchParts.push(plainContent);
    }

    if (this.summary) {
      searchParts.push(this.summary);
    }

    if (this.tags) {
      searchParts.push(...this.tags);
    }

    if (this.keywords) {
      searchParts.push(...this.keywords);
    }

    this.searchContent = searchParts.join(' ').toLowerCase();
  }

  // Publishing workflow
  publish(authorId?: string): void {
    if (this.isDraft()) {
      this.status = 'published';
      this.publishedAt = new Date();
      if (authorId) {
        this.authorId = authorId;
      }
    }
  }

  unpublish(): void {
    this.status = 'draft';
    this.publishedAt = undefined;
  }

  archive(): void {
    this.status = 'archived';
    this.archivedAt = new Date();
  }

  unarchive(): void {
    this.status = this.publishedAt ? 'published' : 'draft';
    this.archivedAt = undefined;
  }

  // Review workflow
  submitForReview(reviewerId: string): void {
    this.status = 'pending_review';
    this.reviewerId = reviewerId;
  }

  approve(reviewerId: string, notes?: string): void {
    this.status = 'approved';
    this.reviewerId = reviewerId;
    this.reviewedAt = new Date();
    
    if (notes) {
      this.createRevision(reviewerId, `Review approved: ${notes}`);
    }
  }

  reject(reviewerId: string, notes: string): void {
    this.status = 'needs_revision';
    this.reviewerId = reviewerId;
    this.reviewedAt = new Date();
    
    this.createRevision(reviewerId, `Review rejected: ${notes}`);
  }

  // Access control
  canAccess(userId: string, userRoles: string[] = []): boolean {
    if (!this.accessControl) return true; // Default is open access

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

  setAccessControl(visibility: NonNullable<RecordArchetype['accessControl']>['visibility'], 
                   allowedUsers?: string[], 
                   allowedRoles?: string[]): void {
    this.accessControl = {
      visibility,
      allowedUsers,
      allowedRoles
    };
  }

  // Entity relationships
  addRelatedEntity(entityType: string, entityId: string, 
                  relationship: NonNullable<RecordArchetype['relatedEntities']>[0]['relationship'],
                  description?: string): void {
    if (!this.relatedEntities) {
      this.relatedEntities = [];
    }

    // Check if relationship already exists
    const exists = this.relatedEntities.some(rel => 
      rel.entityType === entityType && rel.entityId === entityId
    );

    if (!exists) {
      this.relatedEntities.push({
        entityType,
        entityId,
        relationship,
        description
      });
    }
  }

  removeRelatedEntity(entityType: string, entityId: string): void {
    if (!this.relatedEntities) return;

    this.relatedEntities = this.relatedEntities.filter(rel => 
      !(rel.entityType === entityType && rel.entityId === entityId)
    );
  }

  getRelatedEntities(relationship?: string): NonNullable<RecordArchetype['relatedEntities']> {
    if (!this.relatedEntities) return [];
    
    if (relationship) {
      return this.relatedEntities.filter(rel => rel.relationship === relationship);
    }
    
    return this.relatedEntities;
  }

  // Tag management
  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updateSearchContent();
    }
  }

  removeTag(tag: string): void {
    if (!this.tags) return;
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updateSearchContent();
    }
  }

  hasTag(tag: string): boolean {
    return this.tags?.includes(tag) ?? false;
  }

  // Keyword management
  addKeyword(keyword: string): void {
    if (!this.keywords) {
      this.keywords = [];
    }
    if (!this.keywords.includes(keyword)) {
      this.keywords.push(keyword);
      this.updateSearchContent();
    }
  }

  setKeywords(keywords: string[]): void {
    this.keywords = [...new Set(keywords)]; // Remove duplicates
    this.updateSearchContent();
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

  removeMetadata(key: string): void {
    if (!this.metadata) return;
    delete this.metadata[key];
  }

  // Status transition helpers
  canTransitionTo(newStatus: string): boolean {
    const currentStatus = this.status;
    
    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      'draft': ['pending_review', 'published', 'archived'],
      'pending_review': ['approved', 'needs_revision', 'draft'],
      'needs_revision': ['draft', 'pending_review'],
      'approved': ['published', 'archived'],
      'published': ['archived', 'needs_revision'],
      'archived': ['draft'] // Can restore from archive
    };

    if (!currentStatus) return true; // Can transition to any status from no status
    
    return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  // Common validation that all records should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Record title is required');
    }

    if (this.version < 1) {
      errors.push('Version must be positive');
    }

    // Validate access control
    if (this.accessControl) {
      if (!['public', 'private', 'restricted'].includes(this.accessControl.visibility)) {
        errors.push('Invalid access control visibility');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Record health assessment
  getRecordHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content quality (40% of health)
    factors.contentQuality = this.calculateContentQuality();
    if (factors.contentQuality < 60) {
      issues.push('Record content needs improvement');
    }

    // Maintenance status (30% of health)
    factors.maintenance = this.calculateMaintenanceScore();
    if (factors.maintenance < 50) {
      issues.push('Record needs maintenance or review');
    }

    // Accessibility (30% of health)
    factors.accessibility = this.calculateAccessibilityScore();
    if (factors.accessibility < 70) {
      issues.push('Record has accessibility or discoverability issues');
    }

    const totalScore = 
      factors.contentQuality * 0.4 + 
      factors.maintenance * 0.3 + 
      factors.accessibility * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateContentQuality(): number {
    let score = 0;

    // Has meaningful content
    if (this.content && this.content.length > 100) score += 30;
    else if (this.content && this.content.length > 50) score += 15;

    // Has summary
    if (this.summary) score += 20;

    // Has tags for categorization
    if (this.tags && this.tags.length > 0) score += 15;

    // Has keywords for searchability
    if (this.keywords && this.keywords.length > 0) score += 15;

    // Has related entities for context
    if (this.relatedEntities && this.relatedEntities.length > 0) score += 20;

    return Math.min(100, score);
  }

  private calculateMaintenanceScore(): number {
    let score = 100;

    // Age penalty (records should be kept current)
    const ageInDays = (new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) score -= 30; // Very old
    else if (ageInDays > 180) score -= 15; // Moderately old

    // Review status
    if (this.isReviewed()) score += 0; // Good
    else if (this.status === 'pending_review') score -= 10; // Waiting
    else score -= 20; // No review process

    // Version activity (active maintenance)
    if (this.version > 1) score += 10; // Has been updated
    if (this.revisionHistory && this.revisionHistory.length > 3) score += 10; // Active maintenance

    return Math.max(0, score);
  }

  private calculateAccessibilityScore(): number {
    let score = 50; // Base score

    // Published and discoverable
    if (this.isPublished()) score += 25;
    else if (this.isDraft()) score += 10;

    // Has search optimization
    if (this.searchContent) score += 15;

    // Proper access control
    if (this.accessControl) score += 10;
    else score -= 10; // Should have explicit access control

    return Math.min(100, Math.max(0, score));
  }

  // Word count and reading time estimation
  getWordCount(): number {
    if (!this.content) return 0;
    
    const words = this.content
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return words.length;
  }

  getEstimatedReadingTime(): number {
    const wordCount = this.getWordCount();
    const wordsPerMinute = 200; // Average reading speed
    return Math.ceil(wordCount / wordsPerMinute);
  }
}