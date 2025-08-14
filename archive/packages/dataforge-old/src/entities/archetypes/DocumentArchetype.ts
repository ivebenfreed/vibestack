import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all document-related entities
 * Provides common document fields and collaborative editing patterns
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class DocumentArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  content?: string;

  @Property({ nullable: true })
  format?: 'markdown' | 'html' | 'plain_text' | 'rich_text' | 'pdf' | 'docx' | 'json';

  @Property({ type: 'bigint', nullable: true })
  size?: number; // Size in bytes

  @Property({ type: 'integer', default: 1 })
  version!: number;

  @Property({ nullable: true, fieldName: 'document_type' })
  documentType?: string;

  @Property({ nullable: true })
  status?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'author_id' })
  authorId?: string;

  @Property({ type: 'json', nullable: true })
  collaborators?: Array<{
    userId: string;
    role: 'editor' | 'reviewer' | 'commenter' | 'viewer';
    permissions: string[];
    addedAt: Date;
    lastActivity?: Date;
  }>;

  @Property({ type: 'date', nullable: true, fieldName: 'published_at' })
  publishedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'due_date' })
  dueDate?: Date;

  @Property({ type: 'json', nullable: true, fieldName: 'version_history' })
  versionHistory?: Array<{
    version: number;
    authorId: string;
    timestamp: Date;
    changes: string;
    contentDiff?: string;
    contentSnapshot?: string;
    comment?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  comments?: Array<{
    id: string;
    authorId: string;
    content: string;
    timestamp: Date;
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
    replies?: Array<{
      id: string;
      authorId: string;
      content: string;
      timestamp: Date;
    }>;
    position?: {
      start: number;
      end: number;
      context?: string;
    };
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'approval_workflow' })
  approvalWorkflow?: {
    required: boolean;
    approvers: Array<{
      userId: string;
      role: string;
      status: 'pending' | 'approved' | 'rejected' | 'delegated';
      timestamp?: Date;
      comments?: string;
      order?: number;
    }>;
    finalStatus?: 'pending' | 'approved' | 'rejected';
    completedAt?: Date;
  };

  @Property({ type: 'json', nullable: true })
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    uploadedBy: string;
    uploadedAt: Date;
    description?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'sharing_settings' })
  sharingSettings?: {
    visibility: 'private' | 'team' | 'organization' | 'public';
    allowedUsers?: string[];
    allowedGroups?: string[];
    externalSharing?: boolean;
    linkSharing?: {
      enabled: boolean;
      requireAuth: boolean;
      expiresAt?: Date;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'editing_sessions' })
  editingSessions?: Array<{
    userId: string;
    startTime: Date;
    endTime?: Date;
    changes: number;
    collaborative: boolean;
  }>;

  @Property({ type: 'json', nullable: true })
  templates?: {
    baseTemplate?: string;
    customFields?: Record<string, any>;
    sections?: Array<{
      name: string;
      content: string;
      required: boolean;
      order: number;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'export_formats' })
  exportFormats?: Array<{
    format: 'pdf' | 'docx' | 'html' | 'markdown' | 'json';
    lastExported?: Date;
    settings?: Record<string, any>;
  }>;

  // Parent document for hierarchy
  @ManyToOne(() => DocumentArchetype, { nullable: true, fieldName: 'parent_document_id' })
  parentDocument?: DocumentArchetype;

  @Property({ type: 'json', nullable: true, fieldName: 'table_of_contents' })
  tableOfContents?: Array<{
    level: number;
    title: string;
    anchor: string;
    page?: number;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'document_metrics' })
  documentMetrics?: {
    wordCount?: number;
    pageCount?: number;
    readingTime?: number; // minutes
    lastUpdated?: Date;
    editCount?: number;
    viewCount?: number;
    downloadCount?: number;
  };

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'document';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'flexible'; // Documents can belong to projects, departments, etc.
  }

  // Abstract methods that concrete implementations must provide
  abstract getDocumentType(): string;
  abstract validateDocumentRules(): Promise<boolean>;
  abstract generatePreview(): Promise<string>;
  abstract processContentForExport(format: string): Promise<string>;

  // Common document business logic
  isPublished(): boolean {
    return !!this.publishedAt && this.status === 'published';
  }

  isDraft(): boolean {
    return this.status === 'draft' || !this.publishedAt;
  }

  isOverdue(): boolean {
    return !!this.dueDate && new Date() > this.dueDate && !this.isPublished();
  }

  requiresApproval(): boolean {
    return this.approvalWorkflow?.required ?? false;
  }

  isApproved(): boolean {
    return this.approvalWorkflow?.finalStatus === 'approved';
  }

  hasParent(): boolean {
    return !!this.parentDocument;
  }

  isRootDocument(): boolean {
    return !this.parentDocument;
  }

  // Version management
  getCurrentVersion(): number {
    return this.version;
  }

  createVersion(authorId: string, changes: string, comment?: string): void {
    if (!this.versionHistory) {
      this.versionHistory = [];
    }

    // Save current state
    const versionEntry = {
      version: this.version,
      authorId,
      timestamp: new Date(),
      changes,
      comment,
      contentSnapshot: this.content
    };

    this.versionHistory.push(versionEntry);
    this.version += 1;
    this.updateMetrics();
  }

  rollbackToVersion(targetVersion: number, authorId: string): boolean {
    const versionEntry = this.versionHistory?.find(v => v.version === targetVersion);
    if (!versionEntry) return false;

    // Create a rollback version entry
    this.createVersion(authorId, `Rolled back to version ${targetVersion}`);
    
    // Restore content
    this.content = versionEntry.contentSnapshot;
    return true;
  }

  getVersionHistory(): NonNullable<DocumentArchetype['versionHistory']> {
    return this.versionHistory || [];
  }

  // Content management
  updateContent(newContent: string, authorId: string, changes: string, comment?: string): void {
    if (this.content !== newContent) {
      this.createVersion(authorId, changes, comment);
      this.content = newContent;
      this.updateMetrics();
    }
  }

  private updateMetrics(): void {
    if (!this.documentMetrics) {
      this.documentMetrics = {};
    }

    // Update word count
    if (this.content) {
      const words = this.content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      this.documentMetrics.wordCount = words.length;
      this.documentMetrics.readingTime = Math.ceil(words.length / 200); // 200 words per minute
    }

    this.documentMetrics.lastUpdated = new Date();
    this.documentMetrics.editCount = (this.documentMetrics.editCount || 0) + 1;
  }

  // Collaboration management
  addCollaborator(userId: string, role: NonNullable<DocumentArchetype['collaborators']>[0]['role'], permissions: string[] = []): void {
    if (!this.collaborators) {
      this.collaborators = [];
    }

    // Remove existing collaborator if present
    this.collaborators = this.collaborators.filter(c => c.userId !== userId);

    // Add new collaborator
    this.collaborators.push({
      userId,
      role,
      permissions,
      addedAt: new Date()
    });
  }

  removeCollaborator(userId: string): void {
    if (!this.collaborators) return;
    this.collaborators = this.collaborators.filter(c => c.userId !== userId);
  }

  updateCollaboratorActivity(userId: string): void {
    const collaborator = this.collaborators?.find(c => c.userId === userId);
    if (collaborator) {
      collaborator.lastActivity = new Date();
    }
  }

  getCollaborator(userId: string): NonNullable<DocumentArchetype['collaborators']>[0] | undefined {
    return this.collaborators?.find(c => c.userId === userId);
  }

  canUserEdit(userId: string): boolean {
    const collaborator = this.getCollaborator(userId);
    return collaborator?.role === 'editor' || this.authorId === userId;
  }

  canUserComment(userId: string): boolean {
    const collaborator = this.getCollaborator(userId);
    return ['editor', 'reviewer', 'commenter'].includes(collaborator?.role || '') || this.authorId === userId;
  }

  // Comment management
  addComment(authorId: string, content: string, position?: NonNullable<DocumentArchetype['comments']>[0]['position']): string {
    if (!this.comments) {
      this.comments = [];
    }

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.comments.push({
      id: commentId,
      authorId,
      content,
      timestamp: new Date(),
      resolved: false,
      position,
      replies: []
    });

    return commentId;
  }

  replyToComment(commentId: string, authorId: string, content: string): string {
    const comment = this.comments?.find(c => c.id === commentId);
    if (!comment) throw new Error('Comment not found');

    const replyId = `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!comment.replies) comment.replies = [];
    comment.replies.push({
      id: replyId,
      authorId,
      content,
      timestamp: new Date()
    });

    return replyId;
  }

  resolveComment(commentId: string, resolvedBy: string): void {
    const comment = this.comments?.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = true;
      comment.resolvedBy = resolvedBy;
      comment.resolvedAt = new Date();
    }
  }

  getUnresolvedComments(): NonNullable<DocumentArchetype['comments']> {
    return this.comments?.filter(c => !c.resolved) || [];
  }

  // Approval workflow
  initializeApprovalWorkflow(approvers: Array<{ userId: string; role: string; order?: number }>): void {
    this.approvalWorkflow = {
      required: true,
      approvers: approvers.map(approver => ({
        ...approver,
        status: 'pending'
      })),
      finalStatus: 'pending'
    };
  }

  submitForApproval(): void {
    this.status = 'pending_approval';
    if (this.approvalWorkflow) {
      this.approvalWorkflow.finalStatus = 'pending';
    }
  }

  approve(userId: string, comments?: string): void {
    if (!this.approvalWorkflow) return;

    const approver = this.approvalWorkflow.approvers.find(a => a.userId === userId);
    if (approver) {
      approver.status = 'approved';
      approver.timestamp = new Date();
      approver.comments = comments;
    }

    // Check if all approvers have approved
    const allApproved = this.approvalWorkflow.approvers.every(a => a.status === 'approved');
    if (allApproved) {
      this.approvalWorkflow.finalStatus = 'approved';
      this.approvalWorkflow.completedAt = new Date();
      this.status = 'approved';
    }
  }

  reject(userId: string, comments: string): void {
    if (!this.approvalWorkflow) return;

    const approver = this.approvalWorkflow.approvers.find(a => a.userId === userId);
    if (approver) {
      approver.status = 'rejected';
      approver.timestamp = new Date();
      approver.comments = comments;
    }

    this.approvalWorkflow.finalStatus = 'rejected';
    this.approvalWorkflow.completedAt = new Date();
    this.status = 'needs_revision';
  }

  getApprovalStatus(): { pending: number; approved: number; rejected: number; total: number } {
    if (!this.approvalWorkflow) return { pending: 0, approved: 0, rejected: 0, total: 0 };

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: this.approvalWorkflow.approvers.length
    };

    this.approvalWorkflow.approvers.forEach(approver => {
      switch (approver.status) {
        case 'pending': stats.pending++; break;
        case 'approved': stats.approved++; break;
        case 'rejected': stats.rejected++; break;
      }
    });

    return stats;
  }

  // Sharing and permissions
  setSharing(visibility: NonNullable<DocumentArchetype['sharingSettings']>['visibility'], options?: Partial<NonNullable<DocumentArchetype['sharingSettings']>>): void {
    this.sharingSettings = {
      visibility,
      ...options
    };
  }

  canUserAccess(userId: string, userGroups: string[] = []): boolean {
    if (this.authorId === userId) return true;

    const sharing = this.sharingSettings;
    if (!sharing) return false;

    switch (sharing.visibility) {
      case 'public':
        return true;
      case 'organization':
        return true; // Assuming user is in organization
      case 'team':
        return userGroups.some(group => sharing.allowedGroups?.includes(group));
      case 'private':
        return sharing.allowedUsers?.includes(userId) ?? false;
      default:
        return false;
    }
  }

  // Attachment management
  addAttachment(name: string, type: string, size: number, url: string, uploadedBy: string, description?: string): string {
    if (!this.attachments) {
      this.attachments = [];
    }

    const attachmentId = `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.attachments.push({
      id: attachmentId,
      name,
      type,
      size,
      url,
      uploadedBy,
      uploadedAt: new Date(),
      description
    });

    return attachmentId;
  }

  removeAttachment(attachmentId: string): void {
    if (!this.attachments) return;
    this.attachments = this.attachments.filter(a => a.id !== attachmentId);
  }

  getTotalAttachmentSize(): number {
    return this.attachments?.reduce((total, attachment) => total + attachment.size, 0) || 0;
  }

  // Publishing workflow
  publish(authorId?: string): void {
    if (this.requiresApproval() && !this.isApproved()) {
      throw new Error('Document must be approved before publishing');
    }

    this.status = 'published';
    this.publishedAt = new Date();
    if (authorId) {
      this.authorId = authorId;
    }
  }

  unpublish(): void {
    this.status = 'draft';
    this.publishedAt = undefined;
  }

  // Editing sessions
  startEditingSession(userId: string): void {
    if (!this.editingSessions) {
      this.editingSessions = [];
    }

    // End any existing session for this user
    const existingSession = this.editingSessions.find(s => s.userId === userId && !s.endTime);
    if (existingSession) {
      existingSession.endTime = new Date();
    }

    // Start new session
    this.editingSessions.push({
      userId,
      startTime: new Date(),
      changes: 0,
      collaborative: this.editingSessions.some(s => !s.endTime && s.userId !== userId)
    });
  }

  endEditingSession(userId: string, changeCount: number = 0): void {
    const session = this.editingSessions?.find(s => s.userId === userId && !s.endTime);
    if (session) {
      session.endTime = new Date();
      session.changes = changeCount;
    }
  }

  getActiveEditors(): string[] {
    return this.editingSessions
      ?.filter(s => !s.endTime)
      .map(s => s.userId) || [];
  }

  // Status transition helpers
  canTransitionTo(newStatus: string): boolean {
    const currentStatus = this.status;
    
    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      'draft': ['pending_review', 'pending_approval', 'published'],
      'pending_review': ['draft', 'approved', 'needs_revision'],
      'pending_approval': ['approved', 'rejected', 'draft'],
      'needs_revision': ['draft', 'pending_review'],
      'approved': ['published', 'draft'],
      'published': ['archived', 'needs_revision'],
      'archived': ['draft']
    };

    if (!currentStatus) return true;
    
    return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  // Document quality assessment
  getDocumentQuality(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content quality (40%)
    factors.contentQuality = this.calculateContentQuality();
    if (factors.contentQuality < 60) {
      issues.push('Document content needs improvement');
    }

    // Collaboration quality (30%)
    factors.collaboration = this.calculateCollaborationScore();
    if (factors.collaboration < 50) {
      issues.push('Limited collaboration or review');
    }

    // Process compliance (30%)
    factors.processCompliance = this.calculateProcessComplianceScore();
    if (factors.processCompliance < 70) {
      issues.push('Document process needs attention');
    }

    const totalScore = 
      factors.contentQuality * 0.4 + 
      factors.collaboration * 0.3 + 
      factors.processCompliance * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateContentQuality(): number {
    let score = 0;

    // Has substantial content
    const wordCount = this.documentMetrics?.wordCount || 0;
    if (wordCount > 500) score += 30;
    else if (wordCount > 200) score += 20;
    else if (wordCount > 50) score += 10;

    // Has proper structure (TOC)
    if (this.tableOfContents && this.tableOfContents.length > 0) score += 20;

    // Has attachments/supporting materials
    if (this.attachments && this.attachments.length > 0) score += 15;

    // Multiple versions (active maintenance)
    if (this.version > 1) score += 15;

    // Has been reviewed (comments)
    if (this.comments && this.comments.length > 0) score += 20;

    return Math.min(100, score);
  }

  private calculateCollaborationScore(): number {
    let score = 50; // Base score

    // Number of collaborators
    const collaboratorCount = this.collaborators?.length || 0;
    score += Math.min(30, collaboratorCount * 10);

    // Recent collaborative activity
    const recentActivity = this.collaborators?.some(c => 
      c.lastActivity && c.lastActivity > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recentActivity) score += 20;

    // Comment engagement
    const commentCount = this.comments?.length || 0;
    score += Math.min(20, commentCount * 5);

    return Math.min(100, score);
  }

  private calculateProcessComplianceScore(): number {
    let score = 100;

    // Approval workflow compliance
    if (this.requiresApproval()) {
      if (!this.isApproved() && this.isPublished()) {
        score -= 40; // Published without approval
      }
    }

    // Overdue documents
    if (this.isOverdue()) {
      score -= 30;
    }

    // Unresolved comments
    const unresolvedComments = this.getUnresolvedComments().length;
    score -= Math.min(20, unresolvedComments * 5);

    // Version control usage
    if (this.version === 1 && this.documentMetrics?.editCount! > 5) {
      score -= 10; // Many edits but no versions
    }

    return Math.max(0, score);
  }

  // Common validation that all documents should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Document title is required');
    }

    if (this.version < 1) {
      errors.push('Version must be positive');
    }

    if (this.size && this.size < 0) {
      errors.push('Document size cannot be negative');
    }

    // Validate collaborator roles
    if (this.collaborators) {
      const validRoles = ['editor', 'reviewer', 'commenter', 'viewer'];
      for (const collaborator of this.collaborators) {
        if (!validRoles.includes(collaborator.role)) {
          errors.push(`Invalid collaborator role: ${collaborator.role}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Generate table of contents from content
  generateTableOfContents(): void {
    if (!this.content) return;

    const headers: NonNullable<DocumentArchetype['tableOfContents']> = [];
    
    // Simple markdown header detection
    const lines = this.content.split('\n');
    let pageNumber = 1;

    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const anchor = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');

        headers.push({
          level,
          title,
          anchor,
          page: pageNumber
        });
      }
    });

    this.tableOfContents = headers;
  }

  // Word count and reading time
  getWordCount(): number {
    return this.documentMetrics?.wordCount || 0;
  }

  getReadingTime(): number {
    return this.documentMetrics?.readingTime || 0;
  }

  // Document analytics
  recordView(): void {
    if (!this.documentMetrics) this.documentMetrics = {};
    this.documentMetrics.viewCount = (this.documentMetrics.viewCount || 0) + 1;
  }

  recordDownload(): void {
    if (!this.documentMetrics) this.documentMetrics = {};
    this.documentMetrics.downloadCount = (this.documentMetrics.downloadCount || 0) + 1;
  }
}