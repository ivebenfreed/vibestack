/**
 * Discussion Entity - Conversational Content and Communication Threads
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents all forms of communication, from threaded discussions to direct messages to system notifications.
 * Handles comments, messages, forums, code reviews, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type DiscussionType = 'comment' | 'message' | 'note' | 'notification' | 'question' | 'feedback' | 'approval' | 'announcement' | 'thread' | 'reply';
export type DiscussionStatus = 'active' | 'resolved' | 'closed' | 'hidden' | 'deleted' | 'archived';
export type ContentFormat = 'plain_text' | 'markdown' | 'html' | 'rich_text';

export interface DiscussionFields extends BaseDomainEntityFields {
  content: string;
  content_format: ContentFormat;
  discussion_type: DiscussionType;
  status: DiscussionStatus;
  author_id: string | null;
  parent_entity_type: string | null;
  parent_entity_id: string | null;
  parent_discussion_id: string | null;
  thread_root_id: string | null;
  reply_to_id: string | null;
  mentions: string[] | null;
  is_system_message: boolean;
  is_private: boolean;
  is_announcement: boolean;
  is_pinned: boolean;
  resolved_by_id: string | null;
  resolved_at: Date | null;
  edited_at: Date | null;
  edit_count: number;
  reaction_counts: any;
  attachment_ids: string[] | null;
  priority: string | null;
  tags: string[] | null;
  metadata: any;
}

export class Discussion extends BaseDomainEntity {
  content!: string;
  content_format!: ContentFormat;
  discussion_type!: DiscussionType;
  status!: DiscussionStatus;
  author_id?: string | null; // Who wrote the message
  parent_entity_type?: string | null; // Polymorphic relation (project, task, etc.)
  parent_entity_id?: string | null;
  parent_discussion_id?: string | null; // For threaded replies
  thread_root_id?: string | null; // Root of the thread
  reply_to_id?: string | null; // Direct reply to specific message
  mentions?: string[] | null; // User IDs mentioned in content
  is_system_message!: boolean; // Auto-generated system message
  is_private!: boolean; // Visible only to specific users
  is_announcement!: boolean; // Important announcement
  is_pinned!: boolean; // Pinned to top
  resolved_by_id?: string | null; // Who resolved the discussion
  resolved_at?: Date | null;
  edited_at?: Date | null;
  edit_count!: number;
  reaction_counts?: any; // { emoji: count } mapping
  attachment_ids?: string[] | null; // File IDs attached to message
  priority?: string | null; // High, medium, low
  tags?: string[] | null;
  metadata?: any; // Additional discussion context

  constructor(data?: Partial<DiscussionFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'discussion';
    if (!this.content_format) this.content_format = 'markdown';
    if (!this.discussion_type) this.discussion_type = 'comment';
    if (!this.status) this.status = 'active';
    if (this.is_system_message === undefined) this.is_system_message = false;
    if (this.is_private === undefined) this.is_private = false;
    if (this.is_announcement === undefined) this.is_announcement = false;
    if (this.is_pinned === undefined) this.is_pinned = false;
    if (!this.edit_count) this.edit_count = 0;
    if (!this.reaction_counts) this.reaction_counts = {};
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Discussion table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      content: 'text',
      content_format: 'varchar(50)',
      discussion_type: 'varchar(50)',
      status: 'varchar(50)',
      author_id: 'uuid',
      parent_entity_type: 'varchar(50)',
      parent_entity_id: 'uuid',
      parent_discussion_id: 'uuid',
      thread_root_id: 'uuid',
      reply_to_id: 'uuid',
      mentions: 'text[]',
      is_system_message: 'boolean',
      is_private: 'boolean',
      is_announcement: 'boolean',
      is_pinned: 'boolean',
      resolved_by_id: 'uuid',
      resolved_at: 'timestamptz',
      edited_at: 'timestamptz',
      edit_count: 'integer',
      reaction_counts: 'jsonb',
      attachment_ids: 'text[]',
      priority: 'varchar(50)',
      tags: 'text[]',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Discussion table creation
   */
  static getDiscussionDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "discussion" (
        ${super.getDomainDDL()},
        content TEXT NOT NULL,
        content_format VARCHAR(50) DEFAULT 'markdown' NOT NULL,
        discussion_type VARCHAR(50) DEFAULT 'comment' NOT NULL,
        status VARCHAR(50) DEFAULT 'active' NOT NULL,
        author_id UUID REFERENCES "user"(id),
        parent_entity_type VARCHAR(50),
        parent_entity_id UUID,
        parent_discussion_id UUID REFERENCES "discussion"(id),
        thread_root_id UUID REFERENCES "discussion"(id),
        reply_to_id UUID REFERENCES "discussion"(id),
        mentions TEXT[],
        is_system_message BOOLEAN DEFAULT FALSE NOT NULL,
        is_private BOOLEAN DEFAULT FALSE NOT NULL,
        is_announcement BOOLEAN DEFAULT FALSE NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
        resolved_by_id UUID REFERENCES "user"(id),
        resolved_at TIMESTAMPTZ,
        edited_at TIMESTAMPTZ,
        edit_count INTEGER DEFAULT 0 NOT NULL CHECK (edit_count >= 0),
        reaction_counts JSONB DEFAULT '{}' NOT NULL,
        attachment_ids TEXT[],
        priority VARCHAR(50),
        tags TEXT[],
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_discussion_type CHECK (discussion_type IN ('comment', 'message', 'note', 'notification', 'question', 'feedback', 'approval', 'announcement', 'thread', 'reply')),
        CONSTRAINT chk_discussion_status CHECK (status IN ('active', 'resolved', 'closed', 'hidden', 'deleted', 'archived')),
        CONSTRAINT chk_content_format CHECK (content_format IN ('plain_text', 'markdown', 'html', 'rich_text')),
        CONSTRAINT chk_content_not_empty CHECK (content != ''),
        CONSTRAINT chk_resolved_consistency CHECK (
          (status = 'resolved' AND resolved_by_id IS NOT NULL AND resolved_at IS NOT NULL) OR
          (status != 'resolved')
        ),
        CONSTRAINT chk_edited_consistency CHECK (
          (edit_count > 0 AND edited_at IS NOT NULL) OR
          (edit_count = 0)
        ),
        CONSTRAINT chk_thread_hierarchy CHECK (
          parent_discussion_id IS NULL OR 
          thread_root_id IS NOT NULL
        ),
        CONSTRAINT chk_system_message_no_author CHECK (
          NOT (is_system_message = TRUE AND author_id IS NULL)
        )
      );
    `;
  }

  /**
   * Get the indexes for Discussion table
   */
  static getDiscussionIndexes(): string[] {
    return [
      ...super.getDomainIndexes('discussion'),
      `CREATE INDEX IF NOT EXISTS idx_discussion_content ON "discussion" USING GIN(to_tsvector('english', content));`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_type ON "discussion"(discussion_type);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_status ON "discussion"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_author ON "discussion"(author_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_parent_entity ON "discussion"(parent_entity_type, parent_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_parent_discussion ON "discussion"(parent_discussion_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_thread_root ON "discussion"(thread_root_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_reply_to ON "discussion"(reply_to_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_mentions ON "discussion" USING GIN(mentions);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_system ON "discussion"(is_system_message) WHERE is_system_message = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_private ON "discussion"(is_private) WHERE is_private = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_announcement ON "discussion"(is_announcement) WHERE is_announcement = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_pinned ON "discussion"(is_pinned) WHERE is_pinned = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_resolved ON "discussion"(resolved_at, resolved_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_edited ON "discussion"(edited_at, edit_count);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_attachments ON "discussion" USING GIN(attachment_ids);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_priority ON "discussion"(priority);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_tags ON "discussion" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_metadata ON "discussion" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_type_status ON "discussion"(discussion_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_author_time ON "discussion"(author_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_entity_active ON "discussion"(parent_entity_type, parent_entity_id, created_at) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_thread_structure ON "discussion"(thread_root_id, parent_discussion_id, created_at);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): DiscussionFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      content: this.content,
      content_format: this.content_format || 'markdown',
      discussion_type: this.discussion_type || 'comment',
      status: this.status || 'active',
      author_id: this.author_id,
      parent_entity_type: this.parent_entity_type,
      parent_entity_id: this.parent_entity_id,
      parent_discussion_id: this.parent_discussion_id,
      thread_root_id: this.thread_root_id,
      reply_to_id: this.reply_to_id,
      mentions: this.mentions,
      is_system_message: this.is_system_message || false,
      is_private: this.is_private || false,
      is_announcement: this.is_announcement || false,
      is_pinned: this.is_pinned || false,
      resolved_by_id: this.resolved_by_id,
      resolved_at: this.resolved_at,
      edited_at: this.edited_at,
      edit_count: this.edit_count || 0,
      reaction_counts: this.reaction_counts || {},
      attachment_ids: this.attachment_ids,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<DiscussionFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      content: this.content,
      content_format: this.content_format,
      status: this.status,
      mentions: this.mentions,
      is_private: this.is_private,
      is_announcement: this.is_announcement,
      is_pinned: this.is_pinned,
      resolved_by_id: this.resolved_by_id,
      resolved_at: this.resolved_at,
      edited_at: this.edited_at,
      edit_count: this.edit_count,
      reaction_counts: this.reaction_counts,
      attachment_ids: this.attachment_ids,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): DiscussionFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      content: this.content,
      content_format: this.content_format,
      discussion_type: this.discussion_type,
      status: this.status,
      author_id: this.author_id,
      parent_entity_type: this.parent_entity_type,
      parent_entity_id: this.parent_entity_id,
      parent_discussion_id: this.parent_discussion_id,
      thread_root_id: this.thread_root_id,
      reply_to_id: this.reply_to_id,
      mentions: this.mentions,
      is_system_message: this.is_system_message,
      is_private: this.is_private,
      is_announcement: this.is_announcement,
      is_pinned: this.is_pinned,
      resolved_by_id: this.resolved_by_id,
      resolved_at: this.resolved_at,
      edited_at: this.edited_at,
      edit_count: this.edit_count,
      reaction_counts: this.reaction_counts,
      attachment_ids: this.attachment_ids,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if discussion is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if discussion is resolved
   */
  isResolved(): boolean {
    return this.status === 'resolved';
  }

  /**
   * Check if discussion is closed
   */
  isClosed(): boolean {
    return this.status === 'closed';
  }

  /**
   * Check if discussion is deleted
   */
  isDeleted(): boolean {
    return this.status === 'deleted';
  }

  /**
   * Check if this is a reply to another discussion
   */
  isReply(): boolean {
    return !!this.parent_discussion_id;
  }

  /**
   * Check if this is a thread root
   */
  isThreadRoot(): boolean {
    return !this.parent_discussion_id && !!this.thread_root_id;
  }

  /**
   * Check if this is a system message
   */
  isSystemMessage(): boolean {
    return this.is_system_message;
  }

  /**
   * Check if this is private
   */
  isPrivate(): boolean {
    return this.is_private;
  }

  /**
   * Check if this is an announcement
   */
  isAnnouncement(): boolean {
    return this.is_announcement;
  }

  /**
   * Check if this is pinned
   */
  isPinned(): boolean {
    return this.is_pinned;
  }

  /**
   * Check if discussion has been edited
   */
  isEdited(): boolean {
    return this.edit_count > 0;
  }

  /**
   * Check if discussion has attachments
   */
  hasAttachments(): boolean {
    return !!(this.attachment_ids && this.attachment_ids.length > 0);
  }

  /**
   * Check if discussion has reactions
   */
  hasReactions(): boolean {
    return Object.keys(this.reaction_counts || {}).length > 0;
  }

  /**
   * Get word count
   */
  getWordCount(): number {
    if (!this.content) return 0;
    // Remove markdown/HTML formatting for count
    const plainText = this.content.replace(/<[^>]*>/g, '').replace(/[#*_`]/g, '');
    return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.content?.length || 0;
  }

  /**
   * Edit discussion content
   */
  edit(newContent: string, editorId?: string): void {
    this.content = newContent;
    this.edit_count += 1;
    this.edited_at = new Date();
    
    this.metadata = {
      ...this.metadata,
      editHistory: [...(this.metadata?.editHistory || []), {
        editNumber: this.edit_count,
        editorId,
        timestamp: new Date(),
        previousContent: this.content
      }].slice(-5) // Keep last 5 edits
    };
  }

  /**
   * Resolve discussion
   */
  resolve(resolvedBy: string, reason?: string): boolean {
    if (this.status !== 'active') return false;
    
    this.status = 'resolved';
    this.resolved_by_id = resolvedBy;
    this.resolved_at = new Date();
    
    this.metadata = {
      ...this.metadata,
      resolutionReason: reason,
      resolvedAt: new Date()
    };
    
    return true;
  }

  /**
   * Reopen discussion
   */
  reopen(reopenedBy: string): boolean {
    if (this.status !== 'resolved') return false;
    
    this.status = 'active';
    this.resolved_by_id = null;
    this.resolved_at = null;
    
    this.metadata = {
      ...this.metadata,
      reopenedBy,
      reopenedAt: new Date()
    };
    
    return true;
  }

  /**
   * Close discussion
   */
  close(closedBy: string, reason?: string): void {
    this.status = 'closed';
    
    this.metadata = {
      ...this.metadata,
      closedBy,
      closedAt: new Date(),
      closeReason: reason
    };
  }

  /**
   * Hide discussion
   */
  hide(hiddenBy: string, reason?: string): void {
    this.status = 'hidden';
    
    this.metadata = {
      ...this.metadata,
      hiddenBy,
      hiddenAt: new Date(),
      hideReason: reason
    };
  }

  /**
   * Delete discussion (soft delete)
   */
  softDelete(deletedBy: string, reason?: string): void {
    this.status = 'deleted';
    
    this.metadata = {
      ...this.metadata,
      deletedBy,
      deletedAt: new Date(),
      deleteReason: reason
    };
  }

  /**
   * Pin discussion
   */
  pin(pinnedBy: string): void {
    this.is_pinned = true;
    
    this.metadata = {
      ...this.metadata,
      pinnedBy,
      pinnedAt: new Date()
    };
  }

  /**
   * Unpin discussion
   */
  unpin(unpinnedBy: string): void {
    this.is_pinned = false;
    
    this.metadata = {
      ...this.metadata,
      unpinnedBy,
      unpinnedAt: new Date()
    };
  }

  /**
   * Add reaction
   */
  addReaction(emoji: string, userId: string): void {
    if (!this.reaction_counts) this.reaction_counts = {};
    if (!this.reaction_counts[emoji]) this.reaction_counts[emoji] = 0;
    
    this.reaction_counts[emoji] += 1;
    
    // Track who reacted (for UI purposes)
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.reactions) this.metadata.reactions = {};
    if (!this.metadata.reactions[emoji]) this.metadata.reactions[emoji] = [];
    
    if (!this.metadata.reactions[emoji].includes(userId)) {
      this.metadata.reactions[emoji].push(userId);
    }
  }

  /**
   * Remove reaction
   */
  removeReaction(emoji: string, userId: string): void {
    if (!this.reaction_counts || !this.reaction_counts[emoji]) return;
    
    this.reaction_counts[emoji] = Math.max(0, this.reaction_counts[emoji] - 1);
    
    if (this.reaction_counts[emoji] === 0) {
      delete this.reaction_counts[emoji];
    }
    
    // Remove from metadata tracking
    if (this.metadata?.reactions?.[emoji]) {
      this.metadata.reactions[emoji] = this.metadata.reactions[emoji].filter((id: string) => id !== userId);
      if (this.metadata.reactions[emoji].length === 0) {
        delete this.metadata.reactions[emoji];
      }
    }
  }

  /**
   * Get total reaction count
   */
  getTotalReactions(): number {
    return Object.values(this.reaction_counts || {}).reduce((sum: number, count: number) => sum + count, 0);
  }

  /**
   * Check if user has reacted with specific emoji
   */
  hasUserReacted(emoji: string, userId: string): boolean {
    return !!(this.metadata?.reactions?.[emoji]?.includes(userId));
  }

  /**
   * Add mention
   */
  addMention(userId: string): void {
    if (!this.mentions) this.mentions = [];
    if (!this.mentions.includes(userId)) {
      this.mentions.push(userId);
    }
  }

  /**
   * Remove mention
   */
  removeMention(userId: string): void {
    if (this.mentions) {
      this.mentions = this.mentions.filter(id => id !== userId);
    }
  }

  /**
   * Check if user is mentioned
   */
  isMentioned(userId: string): boolean {
    return !!(this.mentions && this.mentions.includes(userId));
  }

  /**
   * Add attachment
   */
  addAttachment(fileId: string): void {
    if (!this.attachment_ids) this.attachment_ids = [];
    if (!this.attachment_ids.includes(fileId)) {
      this.attachment_ids.push(fileId);
    }
  }

  /**
   * Remove attachment
   */
  removeAttachment(fileId: string): void {
    if (this.attachment_ids) {
      this.attachment_ids = this.attachment_ids.filter(id => id !== fileId);
    }
  }

  /**
   * Add tag
   */
  addTag(tag: string): void {
    if (!this.tags) this.tags = [];
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * Remove tag
   */
  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  /**
   * Check if discussion has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Create reply to this discussion
   */
  createReply(content: string, authorId: string, replyType: DiscussionType = 'reply'): Discussion {
    return new Discussion({
      content,
      discussion_type: replyType,
      author_id: authorId,
      parent_entity_type: this.parent_entity_type,
      parent_entity_id: this.parent_entity_id,
      parent_discussion_id: this.id,
      thread_root_id: this.thread_root_id || this.id,
      reply_to_id: this.id,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: {
        replyTo: {
          discussionId: this.id,
          authorId: this.author_id,
          timestamp: new Date()
        }
      }
    });
  }

  /**
   * Search discussion content
   */
  search(query: string): boolean {
    const searchText = `${this.content} ${this.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Get discussion age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last edit
   */
  getDaysSinceLastEdit(): number | null {
    if (!this.edited_at) return null;
    const diffTime = new Date().getTime() - this.edited_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate discussion
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.content || this.content.trim() === '') {
      errors.push('Content is required');
    }

    if (this.status === 'resolved' && (!this.resolved_by_id || !this.resolved_at)) {
      errors.push('Resolved discussions must have resolved_by_id and resolved_at');
    }

    if (this.edit_count > 0 && !this.edited_at) {
      errors.push('Edited discussions must have edited_at timestamp');
    }

    if (this.parent_discussion_id && !this.thread_root_id) {
      errors.push('Replies must have thread_root_id set');
    }

    if (this.is_system_message && !this.author_id) {
      errors.push('System messages must have an author_id');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get discussion summary
   */
  getSummary(): {
    id: string;
    type: string;
    status: string;
    wordCount: number;
    isReply: boolean;
    isEdited: boolean;
    hasAttachments: boolean;
    hasReactions: boolean;
    totalReactions: number;
    mentionCount: number;
    isResolved: boolean;
    isPinned: boolean;
    isPrivate: boolean;
    age: number;
  } {
    return {
      id: this.id,
      type: this.discussion_type,
      status: this.status,
      wordCount: this.getWordCount(),
      isReply: this.isReply(),
      isEdited: this.isEdited(),
      hasAttachments: this.hasAttachments(),
      hasReactions: this.hasReactions(),
      totalReactions: this.getTotalReactions(),
      mentionCount: this.mentions?.length || 0,
      isResolved: this.isResolved(),
      isPinned: this.isPinned(),
      isPrivate: this.isPrivate(),
      age: this.getAge()
    };
  }

  /**
   * Create system message
   */
  static createSystemMessage(
    content: string,
    authorId: string,
    entityType?: string,
    entityId?: string,
    messageType: DiscussionType = 'notification'
  ): Discussion {
    return new Discussion({
      content,
      discussion_type: messageType,
      author_id: authorId,
      parent_entity_type: entityType,
      parent_entity_id: entityId,
      is_system_message: true,
      metadata: {
        isSystemGenerated: true,
        systemGeneratedAt: new Date()
      }
    });
  }

  /**
   * Validate discussion data
   */
  static validateDiscussion(data: Partial<DiscussionFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.content || data.content.trim() === '') {
      errors.push('Content is required');
    }

    const validTypes: DiscussionType[] = ['comment', 'message', 'note', 'notification', 'question', 'feedback', 'approval', 'announcement', 'thread', 'reply'];
    if (data.discussion_type && !validTypes.includes(data.discussion_type)) {
      errors.push('Invalid discussion type');
    }

    const validStatuses: DiscussionStatus[] = ['active', 'resolved', 'closed', 'hidden', 'deleted', 'archived'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid discussion status');
    }

    const validFormats: ContentFormat[] = ['plain_text', 'markdown', 'html', 'rich_text'];
    if (data.content_format && !validFormats.includes(data.content_format)) {
      errors.push('Invalid content format');
    }

    if (data.edit_count !== undefined && data.edit_count < 0) {
      errors.push('Edit count cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Discussion Utilities for common operations
 */
export class DiscussionUtilities {
  /**
   * Filter discussions by type
   */
  static filterByType(discussions: Discussion[], discussionType: DiscussionType): Discussion[] {
    return discussions.filter(d => d.discussion_type === discussionType);
  }

  /**
   * Filter active discussions
   */
  static filterActive(discussions: Discussion[]): Discussion[] {
    return discussions.filter(d => d.isActive());
  }

  /**
   * Filter resolved discussions
   */
  static filterResolved(discussions: Discussion[]): Discussion[] {
    return discussions.filter(d => d.isResolved());
  }

  /**
   * Filter replies
   */
  static filterReplies(discussions: Discussion[]): Discussion[] {
    return discussions.filter(d => d.isReply());
  }

  /**
   * Filter root discussions (not replies)
   */
  static filterRoots(discussions: Discussion[]): Discussion[] {
    return discussions.filter(d => !d.isReply());
  }

  /**
   * Filter pinned discussions
   */
  static filterPinned(discussions: Discussion[]): Discussion[] {
    return discussions.filter(d => d.isPinned());
  }

  /**
   * Filter discussions by author
   */
  static filterByAuthor(discussions: Discussion[], authorId: string): Discussion[] {
    return discussions.filter(d => d.author_id === authorId);
  }

  /**
   * Filter discussions mentioning user
   */
  static filterMentioning(discussions: Discussion[], userId: string): Discussion[] {
    return discussions.filter(d => d.isMentioned(userId));
  }

  /**
   * Filter discussions by entity
   */
  static filterByEntity(discussions: Discussion[], entityType: string, entityId: string): Discussion[] {
    return discussions.filter(d => 
      d.parent_entity_type === entityType && d.parent_entity_id === entityId
    );
  }

  /**
   * Group discussions by thread
   */
  static groupByThread(discussions: Discussion[]): Record<string, Discussion[]> {
    return discussions.reduce((groups, discussion) => {
      const threadId = discussion.thread_root_id || discussion.id;
      if (!groups[threadId]) {
        groups[threadId] = [];
      }
      groups[threadId].push(discussion);
      return groups;
    }, {} as Record<string, Discussion[]>);
  }

  /**
   * Group discussions by type
   */
  static groupByType(discussions: Discussion[]): Record<DiscussionType, Discussion[]> {
    return discussions.reduce((groups, discussion) => {
      if (!groups[discussion.discussion_type]) {
        groups[discussion.discussion_type] = [];
      }
      groups[discussion.discussion_type].push(discussion);
      return groups;
    }, {} as Record<DiscussionType, Discussion[]>);
  }

  /**
   * Build thread hierarchy
   */
  static buildThreadHierarchy(discussions: Discussion[]): Discussion[] {
    const roots = discussions.filter(d => !d.parent_discussion_id);
    const replies = discussions.filter(d => d.parent_discussion_id);
    
    const buildReplies = (parentId: string): Discussion[] => {
      return replies
        .filter(r => r.parent_discussion_id === parentId)
        .map(reply => ({
          ...reply,
          replies: buildReplies(reply.id)
        }));
    };
    
    return roots.map(root => ({
      ...root,
      replies: buildReplies(root.id)
    }));
  }

  /**
   * Sort discussions by creation time
   */
  static sortByCreatedAt(discussions: Discussion[], ascending = true): Discussion[] {
    return [...discussions].sort((a, b) => {
      const diff = a.created_at.getTime() - b.created_at.getTime();
      return ascending ? diff : -diff;
    });
  }

  /**
   * Sort discussions by reactions
   */
  static sortByReactions(discussions: Discussion[], ascending = false): Discussion[] {
    return [...discussions].sort((a, b) => {
      const diff = a.getTotalReactions() - b.getTotalReactions();
      return ascending ? diff : -diff;
    });
  }

  /**
   * Search discussions
   */
  static search(discussions: Discussion[], query: string): Discussion[] {
    if (!query.trim()) return discussions;
    return discussions.filter(d => d.search(query));
  }

  /**
   * Get discussions in thread
   */
  static getThread(discussions: Discussion[], threadRootId: string): Discussion[] {
    return discussions.filter(d => 
      d.thread_root_id === threadRootId || d.id === threadRootId
    );
  }

  /**
   * Calculate statistics
   */
  static calculateStats(discussions: Discussion[]) {
    const stats = {
      total: discussions.length,
      active: 0,
      resolved: 0,
      closed: 0,
      replies: 0,
      roots: 0,
      pinned: 0,
      edited: 0,
      withAttachments: 0,
      withReactions: 0,
      systemMessages: 0,
      private: 0,
      announcements: 0,
      byType: {} as Record<string, number>,
      totalReactions: 0,
      totalWordCount: 0,
      averageWordCount: 0,
      averageAge: 0
    };

    let totalAge = 0;
    let totalWords = 0;

    discussions.forEach(discussion => {
      if (discussion.isActive()) stats.active++;
      if (discussion.isResolved()) stats.resolved++;
      if (discussion.isClosed()) stats.closed++;
      if (discussion.isReply()) stats.replies++;
      else stats.roots++;
      if (discussion.isPinned()) stats.pinned++;
      if (discussion.isEdited()) stats.edited++;
      if (discussion.hasAttachments()) stats.withAttachments++;
      if (discussion.hasReactions()) stats.withReactions++;
      if (discussion.isSystemMessage()) stats.systemMessages++;
      if (discussion.isPrivate()) stats.private++;
      if (discussion.isAnnouncement()) stats.announcements++;

      stats.byType[discussion.discussion_type] = (stats.byType[discussion.discussion_type] || 0) + 1;
      stats.totalReactions += discussion.getTotalReactions();

      const wordCount = discussion.getWordCount();
      totalWords += wordCount;
      totalAge += discussion.getAge();
    });

    stats.totalWordCount = totalWords;
    stats.averageWordCount = discussions.length > 0 ? totalWords / discussions.length : 0;
    stats.averageAge = discussions.length > 0 ? totalAge / discussions.length : 0;

    return stats;
  }
}

export default Discussion;