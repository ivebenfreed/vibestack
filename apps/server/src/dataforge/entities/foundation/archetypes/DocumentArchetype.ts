/**
 * Document Entity - Editable Content with Versioning and Collaboration
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents editable content that requires collaborative authoring, version control, and publishing workflows.
 * Handles specs, contracts, reports, wikis, presentations, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type DocumentFormat = 'markdown' | 'html' | 'plain_text' | 'canvas' | 'slides' | 'whiteboard' | 'json';
export type DocumentStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived' | 'deleted';

export interface DocumentFields extends BaseDomainEntityFields {
  title: string;
  content: string;
  format: DocumentFormat;
  version: number;
  status: DocumentStatus;
  author_id: string | null;
  last_editor_id: string | null;
  published_at: Date | null;
  published_version: number | null;
  document_type: string;
  template_id: string | null;
  parent_document_id: string | null;
  is_template: boolean;
  is_locked: boolean;
  locked_by_id: string | null;
  locked_at: Date | null;
  tags: string[] | null;
  metadata: any;
}

export class Document extends BaseDomainEntity {
  title!: string;
  content!: string;
  format!: DocumentFormat;
  version!: number;
  status!: DocumentStatus;
  author_id?: string | null; // Who created the document
  last_editor_id?: string | null; // Who last modified it
  published_at?: Date | null;
  published_version?: number | null; // Which version is published
  document_type!: string; // spec, contract, report, wiki, presentation, etc.
  template_id?: string | null; // If created from template
  parent_document_id?: string | null; // For document hierarchies
  is_template!: boolean;
  is_locked!: boolean; // For collaborative editing
  locked_by_id?: string | null;
  locked_at?: Date | null;
  tags?: string[] | null;
  metadata?: any; // Editor settings, permissions, etc.

  constructor(data?: Partial<DocumentFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'document';
    if (!this.format) this.format = 'markdown';
    if (!this.version) this.version = 1;
    if (!this.status) this.status = 'draft';
    if (this.is_template === undefined) this.is_template = false;
    if (this.is_locked === undefined) this.is_locked = false;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Document table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      title: 'varchar(500)',
      content: 'text',
      format: 'varchar(50)',
      version: 'integer',
      status: 'varchar(50)',
      author_id: 'uuid',
      last_editor_id: 'uuid',
      published_at: 'timestamptz',
      published_version: 'integer',
      document_type: 'varchar(100)',
      template_id: 'uuid',
      parent_document_id: 'uuid',
      is_template: 'boolean',
      is_locked: 'boolean',
      locked_by_id: 'uuid',
      locked_at: 'timestamptz',
      tags: 'text[]',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Document table creation
   */
  static getDocumentDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "document" (
        ${super.getDomainDDL()},
        title VARCHAR(500) NOT NULL,
        content TEXT DEFAULT '' NOT NULL,
        format VARCHAR(50) DEFAULT 'markdown' NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        author_id UUID REFERENCES "user"(id),
        last_editor_id UUID REFERENCES "user"(id),
        published_at TIMESTAMPTZ,
        published_version INTEGER,
        document_type VARCHAR(100) NOT NULL,
        template_id UUID REFERENCES "document"(id),
        parent_document_id UUID REFERENCES "document"(id),
        is_template BOOLEAN DEFAULT FALSE NOT NULL,
        is_locked BOOLEAN DEFAULT FALSE NOT NULL,
        locked_by_id UUID REFERENCES "user"(id),
        locked_at TIMESTAMPTZ,
        tags TEXT[],
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_document_format CHECK (format IN ('markdown', 'html', 'plain_text', 'canvas', 'slides', 'whiteboard', 'json')),
        CONSTRAINT chk_document_status CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived', 'deleted')),
        CONSTRAINT chk_document_version_positive CHECK (version > 0),
        CONSTRAINT chk_published_version_valid CHECK (published_version IS NULL OR published_version <= version),
        CONSTRAINT chk_lock_consistency CHECK (
          (is_locked = FALSE AND locked_by_id IS NULL AND locked_at IS NULL) OR
          (is_locked = TRUE AND locked_by_id IS NOT NULL AND locked_at IS NOT NULL)
        ),
        CONSTRAINT chk_template_no_parent CHECK (NOT (is_template = TRUE AND parent_document_id IS NOT NULL)),
        CONSTRAINT chk_title_not_empty CHECK (title != '')
      );
    `;
  }

  /**
   * Get the indexes for Document table
   */
  static getDocumentIndexes(): string[] {
    return [
      ...super.getDomainIndexes('document'),
      `CREATE INDEX IF NOT EXISTS idx_document_title ON "document"(title);`,
      `CREATE INDEX IF NOT EXISTS idx_document_format ON "document"(format);`,
      `CREATE INDEX IF NOT EXISTS idx_document_status ON "document"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_document_type ON "document"(document_type);`,
      `CREATE INDEX IF NOT EXISTS idx_document_author ON "document"(author_id);`,
      `CREATE INDEX IF NOT EXISTS idx_document_editor ON "document"(last_editor_id);`,
      `CREATE INDEX IF NOT EXISTS idx_document_template ON "document"(template_id);`,
      `CREATE INDEX IF NOT EXISTS idx_document_parent ON "document"(parent_document_id);`,
      `CREATE INDEX IF NOT EXISTS idx_document_published ON "document"(published_at);`,
      `CREATE INDEX IF NOT EXISTS idx_document_is_template ON "document"(is_template) WHERE is_template = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_document_is_locked ON "document"(is_locked, locked_by_id) WHERE is_locked = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_document_tags ON "document" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_document_metadata ON "document" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_document_type_status ON "document"(document_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_document_author_type ON "document"(author_id, document_type) WHERE status != 'deleted';`,
      `CREATE INDEX IF NOT EXISTS idx_document_search ON "document" USING GIN(to_tsvector('english', title || ' ' || content));`,
      `CREATE INDEX IF NOT EXISTS idx_document_version ON "document"(version);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): DocumentFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      title: this.title,
      content: this.content || '',
      format: this.format || 'markdown',
      version: this.version || 1,
      status: this.status || 'draft',
      author_id: this.author_id,
      last_editor_id: this.last_editor_id,
      published_at: this.published_at,
      published_version: this.published_version,
      document_type: this.document_type,
      template_id: this.template_id,
      parent_document_id: this.parent_document_id,
      is_template: this.is_template || false,
      is_locked: this.is_locked || false,
      locked_by_id: this.locked_by_id,
      locked_at: this.locked_at,
      tags: this.tags,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<DocumentFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      title: this.title,
      content: this.content,
      format: this.format,
      version: this.version,
      status: this.status,
      last_editor_id: this.last_editor_id,
      published_at: this.published_at,
      published_version: this.published_version,
      parent_document_id: this.parent_document_id,
      is_locked: this.is_locked,
      locked_by_id: this.locked_by_id,
      locked_at: this.locked_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): DocumentFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      title: this.title,
      content: this.content,
      format: this.format,
      version: this.version,
      status: this.status,
      author_id: this.author_id,
      last_editor_id: this.last_editor_id,
      published_at: this.published_at,
      published_version: this.published_version,
      document_type: this.document_type,
      template_id: this.template_id,
      parent_document_id: this.parent_document_id,
      is_template: this.is_template,
      is_locked: this.is_locked,
      locked_by_id: this.locked_by_id,
      locked_at: this.locked_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if document is draft
   */
  isDraft(): boolean {
    return this.status === 'draft';
  }

  /**
   * Check if document is published
   */
  isPublished(): boolean {
    return this.status === 'published' && this.published_at !== null;
  }

  /**
   * Check if document is locked for editing
   */
  isLocked(): boolean {
    return this.is_locked;
  }

  /**
   * Check if document is template
   */
  isTemplate(): boolean {
    return this.is_template;
  }

  /**
   * Check if document has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.published_version !== null && this.version > this.published_version;
  }

  /**
   * Get word count
   */
  getWordCount(): number {
    if (!this.content) return 0;
    // Remove HTML/markdown formatting for count
    const plainText = this.content.replace(/<[^>]*>/g, '').replace(/[#*_`]/g, '');
    return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get reading time estimate (200 words per minute)
   */
  getReadingTime(): number {
    return Math.ceil(this.getWordCount() / 200);
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.content?.length || 0;
  }

  /**
   * Lock document for editing
   */
  lock(userId: string): boolean {
    if (this.is_locked && this.locked_by_id !== userId) {
      return false; // Already locked by someone else
    }
    
    this.is_locked = true;
    this.locked_by_id = userId;
    this.locked_at = new Date();
    return true;
  }

  /**
   * Unlock document
   */
  unlock(userId?: string): boolean {
    // Allow unlock if not locked, user owns the lock, or no user specified (admin unlock)
    if (!this.is_locked || !userId || this.locked_by_id === userId) {
      this.is_locked = false;
      this.locked_by_id = null;
      this.locked_at = null;
      return true;
    }
    return false;
  }

  /**
   * Check if lock has expired (30 minutes)
   */
  isLockExpired(): boolean {
    if (!this.is_locked || !this.locked_at) return false;
    const lockDuration = new Date().getTime() - this.locked_at.getTime();
    return lockDuration > (30 * 60 * 1000); // 30 minutes
  }

  /**
   * Auto-unlock if lock expired
   */
  autoUnlockIfExpired(): boolean {
    if (this.isLockExpired()) {
      this.unlock();
      return true;
    }
    return false;
  }

  /**
   * Edit document content
   */
  edit(content: string, editorId: string): boolean {
    // Check if document is locked by someone else
    if (this.is_locked && this.locked_by_id !== editorId) {
      if (!this.isLockExpired()) {
        return false; // Cannot edit, locked by someone else
      }
      this.autoUnlockIfExpired();
    }

    this.content = content;
    this.last_editor_id = editorId;
    this.version += 1;
    
    // Auto-lock while editing
    if (!this.is_locked) {
      this.lock(editorId);
    }

    this.metadata = {
      ...this.metadata,
      lastEditedAt: new Date(),
      editHistory: [...(this.metadata?.editHistory || []), {
        version: this.version,
        editorId,
        timestamp: new Date(),
        wordCount: this.getWordCount()
      }].slice(-10) // Keep last 10 edits
    };

    return true;
  }

  /**
   * Update title
   */
  updateTitle(title: string, editorId: string): void {
    this.title = title;
    this.last_editor_id = editorId;
    this.version += 1;
  }

  /**
   * Change format
   */
  changeFormat(format: DocumentFormat, editorId: string): void {
    this.format = format;
    this.last_editor_id = editorId;
    this.version += 1;
  }

  /**
   * Submit for review
   */
  submitForReview(reviewerId?: string): boolean {
    if (this.status !== 'draft') return false;
    
    this.status = 'review';
    this.metadata = {
      ...this.metadata,
      submittedForReviewAt: new Date(),
      reviewerId
    };
    return true;
  }

  /**
   * Approve document
   */
  approve(approverId: string): boolean {
    if (this.status !== 'review') return false;
    
    this.status = 'approved';
    this.metadata = {
      ...this.metadata,
      approvedAt: new Date(),
      approvedBy: approverId
    };
    return true;
  }

  /**
   * Reject document back to draft
   */
  reject(rejectorId: string, reason?: string): boolean {
    if (this.status !== 'review') return false;
    
    this.status = 'draft';
    this.metadata = {
      ...this.metadata,
      rejectedAt: new Date(),
      rejectedBy: rejectorId,
      rejectionReason: reason
    };
    return true;
  }

  /**
   * Publish document
   */
  publish(): boolean {
    if (!['approved', 'draft'].includes(this.status)) return false;
    
    this.status = 'published';
    this.published_at = new Date();
    this.published_version = this.version;
    this.metadata = {
      ...this.metadata,
      publishedAt: new Date()
    };
    return true;
  }

  /**
   * Unpublish document
   */
  unpublish(): boolean {
    if (this.status !== 'published') return false;
    
    this.status = 'draft';
    this.published_at = null;
    this.published_version = null;
    this.metadata = {
      ...this.metadata,
      unpublishedAt: new Date()
    };
    return true;
  }

  /**
   * Archive document
   */
  archive(): void {
    this.status = 'archived';
    this.unlock(); // Release any locks
    this.metadata = {
      ...this.metadata,
      archivedAt: new Date()
    };
  }

  /**
   * Delete document (soft delete)
   */
  softDelete(): void {
    this.status = 'deleted';
    this.unlock(); // Release any locks
    this.metadata = {
      ...this.metadata,
      deletedAt: new Date()
    };
  }

  /**
   * Restore from archive/delete
   */
  restore(): void {
    const previousStatus = this.metadata?.previousStatus || 'draft';
    this.status = previousStatus;
    this.metadata = {
      ...this.metadata,
      restoredAt: new Date(),
      previousStatus: this.status
    };
  }

  /**
   * Create new version (branch)
   */
  createVersion(editorId: string): Document {
    const newDoc = new Document({
      ...this.toJSON(),
      id: undefined, // New ID will be generated
      version: 1, // Reset version for new branch
      status: 'draft',
      parent_document_id: this.id,
      published_at: null,
      published_version: null,
      is_locked: false,
      locked_by_id: null,
      locked_at: null,
      author_id: editorId,
      last_editor_id: editorId,
      created_at: undefined,
      updated_at: undefined,
      metadata: {
        ...this.metadata,
        branchedFrom: {
          documentId: this.id,
          version: this.version,
          timestamp: new Date()
        }
      }
    });
    return newDoc;
  }

  /**
   * Create template from document
   */
  createTemplate(templateName: string): Document {
    return new Document({
      title: templateName,
      content: this.content,
      format: this.format,
      document_type: this.document_type,
      is_template: true,
      author_id: this.author_id,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: {
        ...this.metadata,
        createdFromDocument: this.id,
        templateCreatedAt: new Date()
      }
    });
  }

  /**
   * Create document from template
   */
  static createFromTemplate(template: Document, title: string, authorId: string): Document {
    if (!template.is_template) {
      throw new Error('Source document is not a template');
    }
    
    return new Document({
      title,
      content: template.content,
      format: template.format,
      document_type: template.document_type,
      template_id: template.id,
      author_id: authorId,
      last_editor_id: authorId,
      container_type: template.container_type,
      container_id: template.container_id,
      metadata: {
        createdFromTemplate: template.id,
        templateCreatedAt: new Date()
      }
    });
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
   * Check if document has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Search document content
   */
  search(query: string): boolean {
    const searchText = `${this.title} ${this.content}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Get document age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last edit
   */
  getDaysSinceLastEdit(): number {
    const diffTime = new Date().getTime() - this.updated_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate document
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.title || this.title.trim() === '') {
      errors.push('Title is required');
    }

    if (!this.document_type || this.document_type.trim() === '') {
      errors.push('Document type is required');
    }

    if (this.published_version && this.published_version > this.version) {
      errors.push('Published version cannot be greater than current version');
    }

    if (this.is_locked && !this.locked_by_id) {
      errors.push('Locked documents must have a locked_by_id');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get document summary
   */
  getSummary(): {
    id: string;
    title: string;
    type: string;
    format: string;
    status: string;
    version: number;
    isPublished: boolean;
    isLocked: boolean;
    isTemplate: boolean;
    wordCount: number;
    readingTime: number;
    age: number;
    daysSinceLastEdit: number;
    hasUnsavedChanges: boolean;
  } {
    return {
      id: this.id,
      title: this.title,
      type: this.document_type,
      format: this.format,
      status: this.status,
      version: this.version,
      isPublished: this.isPublished(),
      isLocked: this.isLocked(),
      isTemplate: this.isTemplate(),
      wordCount: this.getWordCount(),
      readingTime: this.getReadingTime(),
      age: this.getAge(),
      daysSinceLastEdit: this.getDaysSinceLastEdit(),
      hasUnsavedChanges: this.hasUnsavedChanges()
    };
  }

  /**
   * Validate document data
   */
  static validateDocument(data: Partial<DocumentFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.title || data.title.trim() === '') {
      errors.push('Title is required');
    }

    if (!data.document_type || data.document_type.trim() === '') {
      errors.push('Document type is required');
    }

    const validFormats: DocumentFormat[] = ['markdown', 'html', 'plain_text', 'canvas', 'slides', 'whiteboard', 'json'];
    if (data.format && !validFormats.includes(data.format)) {
      errors.push('Invalid document format');
    }

    const validStatuses: DocumentStatus[] = ['draft', 'review', 'approved', 'published', 'archived', 'deleted'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid document status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Document Utilities for common operations
 */
export class DocumentUtilities {
  /**
   * Filter documents by type
   */
  static filterByType(documents: Document[], documentType: string): Document[] {
    return documents.filter(d => d.document_type === documentType);
  }

  /**
   * Filter published documents
   */
  static filterPublished(documents: Document[]): Document[] {
    return documents.filter(d => d.isPublished());
  }

  /**
   * Filter documents by status
   */
  static filterByStatus(documents: Document[], status: DocumentStatus): Document[] {
    return documents.filter(d => d.status === status);
  }

  /**
   * Filter templates
   */
  static filterTemplates(documents: Document[]): Document[] {
    return documents.filter(d => d.isTemplate());
  }

  /**
   * Filter locked documents
   */
  static filterLocked(documents: Document[]): Document[] {
    return documents.filter(d => d.isLocked());
  }

  /**
   * Filter documents by author
   */
  static filterByAuthor(documents: Document[], authorId: string): Document[] {
    return documents.filter(d => d.author_id === authorId);
  }

  /**
   * Group documents by type
   */
  static groupByType(documents: Document[]): Record<string, Document[]> {
    return documents.reduce((groups, doc) => {
      if (!groups[doc.document_type]) {
        groups[doc.document_type] = [];
      }
      groups[doc.document_type].push(doc);
      return groups;
    }, {} as Record<string, Document[]>);
  }

  /**
   * Group documents by status
   */
  static groupByStatus(documents: Document[]): Record<DocumentStatus, Document[]> {
    return documents.reduce((groups, doc) => {
      if (!groups[doc.status]) {
        groups[doc.status] = [];
      }
      groups[doc.status].push(doc);
      return groups;
    }, {} as Record<DocumentStatus, Document[]>);
  }

  /**
   * Search documents
   */
  static search(documents: Document[], query: string): Document[] {
    if (!query.trim()) return documents;
    return documents.filter(d => d.search(query));
  }

  /**
   * Sort documents by last modified
   */
  static sortByLastModified(documents: Document[], ascending = false): Document[] {
    return [...documents].sort((a, b) => {
      const diff = a.updated_at.getTime() - b.updated_at.getTime();
      return ascending ? diff : -diff;
    });
  }

  /**
   * Calculate statistics
   */
  static calculateStats(documents: Document[]) {
    const stats = {
      total: documents.length,
      draft: 0,
      published: 0,
      archived: 0,
      templates: 0,
      locked: 0,
      withUnsavedChanges: 0,
      byType: {} as Record<string, number>,
      byFormat: {} as Record<string, number>,
      totalWordCount: 0,
      averageWordCount: 0,
      averageAge: 0
    };

    let totalAge = 0;
    let totalWords = 0;

    documents.forEach(doc => {
      if (doc.isDraft()) stats.draft++;
      if (doc.isPublished()) stats.published++;
      if (doc.status === 'archived') stats.archived++;
      if (doc.isTemplate()) stats.templates++;
      if (doc.isLocked()) stats.locked++;
      if (doc.hasUnsavedChanges()) stats.withUnsavedChanges++;

      stats.byType[doc.document_type] = (stats.byType[doc.document_type] || 0) + 1;
      stats.byFormat[doc.format] = (stats.byFormat[doc.format] || 0) + 1;

      const wordCount = doc.getWordCount();
      totalWords += wordCount;
      totalAge += doc.getAge();
    });

    stats.totalWordCount = totalWords;
    stats.averageWordCount = documents.length > 0 ? totalWords / documents.length : 0;
    stats.averageAge = documents.length > 0 ? totalAge / documents.length : 0;

    return stats;
  }
}

export default Document;