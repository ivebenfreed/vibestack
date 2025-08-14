/**
 * File Entity - Binary Assets and Uploaded Content
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents uploaded files, media assets, and binary content that require storage, organization, and access control.
 * Handles images, videos, documents, code files, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type FileStatus = 'uploading' | 'ready' | 'processing' | 'error' | 'archived' | 'deleted';
export type FileProcessingStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_required';

export interface FileFields extends BaseDomainEntityFields {
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  storage_key: string;
  storage_provider: string;
  checksum: string | null;
  status: FileStatus;
  uploaded_by_id: string | null;
  file_type: string;
  parent_file_id: string | null;
  processing_status: FileProcessingStatus;
  processing_data: any;
  download_count: number;
  is_public: boolean;
  expires_at: Date | null;
  tags: string[] | null;
  metadata: any;
}

export class File extends BaseDomainEntity {
  filename!: string; // Storage filename (usually UUID-based)
  original_name!: string; // Original uploaded filename
  mime_type!: string; // MIME type (image/jpeg, application/pdf, etc.)
  size!: number; // File size in bytes
  storage_key!: string; // Key for cloud storage (S3, R2, etc.)
  storage_provider!: string; // Storage backend (s3, r2, local, etc.)
  checksum?: string | null; // File integrity hash (SHA-256)
  status!: FileStatus;
  uploaded_by_id?: string | null; // User who uploaded the file
  file_type!: string; // Categorization (image, document, video, code, etc.)
  parent_file_id?: string | null; // For file versions or derivatives
  processing_status!: FileProcessingStatus;
  processing_data?: any; // Processing results (thumbnails, transcripts, etc.)
  download_count!: number;
  is_public!: boolean; // Whether file is publicly accessible
  expires_at?: Date | null; // For temporary files
  tags?: string[] | null;
  metadata?: any; // Additional file context, EXIF data, etc.

  constructor(data?: Partial<FileFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'file';
    if (!this.status) this.status = 'uploading';
    if (!this.processing_status) this.processing_status = 'not_required';
    if (!this.download_count) this.download_count = 0;
    if (this.is_public === undefined) this.is_public = false;
    if (!this.storage_provider) this.storage_provider = 'r2';
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for File table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      filename: 'varchar(255)',
      original_name: 'varchar(500)',
      mime_type: 'varchar(100)',
      size: 'bigint',
      storage_key: 'varchar(500)',
      storage_provider: 'varchar(50)',
      checksum: 'varchar(64)',
      status: 'varchar(50)',
      uploaded_by_id: 'uuid',
      file_type: 'varchar(100)',
      parent_file_id: 'uuid',
      processing_status: 'varchar(50)',
      processing_data: 'jsonb',
      download_count: 'integer',
      is_public: 'boolean',
      expires_at: 'timestamptz',
      tags: 'text[]',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for File table creation
   */
  static getFileDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "file" (
        ${super.getDomainDDL()},
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL CHECK (size >= 0),
        storage_key VARCHAR(500) NOT NULL,
        storage_provider VARCHAR(50) DEFAULT 'r2' NOT NULL,
        checksum VARCHAR(64),
        status VARCHAR(50) DEFAULT 'uploading' NOT NULL,
        uploaded_by_id UUID REFERENCES "user"(id),
        file_type VARCHAR(100) NOT NULL,
        parent_file_id UUID REFERENCES "file"(id),
        processing_status VARCHAR(50) DEFAULT 'not_required' NOT NULL,
        processing_data JSONB DEFAULT '{}' NOT NULL,
        download_count INTEGER DEFAULT 0 NOT NULL CHECK (download_count >= 0),
        is_public BOOLEAN DEFAULT FALSE NOT NULL,
        expires_at TIMESTAMPTZ,
        tags TEXT[],
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_file_status CHECK (status IN ('uploading', 'ready', 'processing', 'error', 'archived', 'deleted')),
        CONSTRAINT chk_processing_status CHECK (processing_status IN ('pending', 'in_progress', 'completed', 'failed', 'not_required')),
        CONSTRAINT chk_filename_not_empty CHECK (filename != ''),
        CONSTRAINT chk_original_name_not_empty CHECK (original_name != ''),
        CONSTRAINT chk_storage_key_not_empty CHECK (storage_key != ''),
        CONSTRAINT chk_file_type_not_empty CHECK (file_type != ''),
        CONSTRAINT chk_expires_future CHECK (expires_at IS NULL OR expires_at > created_at),
        CONSTRAINT unique_storage_key UNIQUE (storage_provider, storage_key)
      );
    `;
  }

  /**
   * Get the indexes for File table
   */
  static getFileIndexes(): string[] {
    return [
      ...super.getDomainIndexes('file'),
      `CREATE INDEX IF NOT EXISTS idx_file_filename ON "file"(filename);`,
      `CREATE INDEX IF NOT EXISTS idx_file_original_name ON "file"(original_name);`,
      `CREATE INDEX IF NOT EXISTS idx_file_mime_type ON "file"(mime_type);`,
      `CREATE INDEX IF NOT EXISTS idx_file_size ON "file"(size);`,
      `CREATE INDEX IF NOT EXISTS idx_file_storage ON "file"(storage_provider, storage_key);`,
      `CREATE INDEX IF NOT EXISTS idx_file_checksum ON "file"(checksum);`,
      `CREATE INDEX IF NOT EXISTS idx_file_status ON "file"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_file_uploaded_by ON "file"(uploaded_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_type ON "file"(file_type);`,
      `CREATE INDEX IF NOT EXISTS idx_file_parent ON "file"(parent_file_id);`,
      `CREATE INDEX IF NOT EXISTS idx_file_processing ON "file"(processing_status);`,
      `CREATE INDEX IF NOT EXISTS idx_file_public ON "file"(is_public) WHERE is_public = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_file_expires ON "file"(expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_file_tags ON "file" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_file_metadata ON "file" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_file_type_status ON "file"(file_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_file_user_type ON "file"(uploaded_by_id, file_type) WHERE status = 'ready';`,
      `CREATE INDEX IF NOT EXISTS idx_file_search ON "file" USING GIN(to_tsvector('english', original_name));`,
      `CREATE INDEX IF NOT EXISTS idx_file_ready_public ON "file"(is_public, created_at) WHERE status = 'ready';`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): FileFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      filename: this.filename,
      original_name: this.original_name,
      mime_type: this.mime_type,
      size: this.size,
      storage_key: this.storage_key,
      storage_provider: this.storage_provider || 'r2',
      checksum: this.checksum,
      status: this.status || 'uploading',
      uploaded_by_id: this.uploaded_by_id,
      file_type: this.file_type,
      parent_file_id: this.parent_file_id,
      processing_status: this.processing_status || 'not_required',
      processing_data: this.processing_data || {},
      download_count: this.download_count || 0,
      is_public: this.is_public || false,
      expires_at: this.expires_at,
      tags: this.tags,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<FileFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      filename: this.filename,
      status: this.status,
      processing_status: this.processing_status,
      processing_data: this.processing_data,
      download_count: this.download_count,
      is_public: this.is_public,
      expires_at: this.expires_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): FileFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      filename: this.filename,
      original_name: this.original_name,
      mime_type: this.mime_type,
      size: this.size,
      storage_key: this.storage_key,
      storage_provider: this.storage_provider,
      checksum: this.checksum,
      status: this.status,
      uploaded_by_id: this.uploaded_by_id,
      file_type: this.file_type,
      parent_file_id: this.parent_file_id,
      processing_status: this.processing_status,
      processing_data: this.processing_data,
      download_count: this.download_count,
      is_public: this.is_public,
      expires_at: this.expires_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if file is ready for use
   */
  isReady(): boolean {
    return this.status === 'ready';
  }

  /**
   * Check if file is currently uploading
   */
  isUploading(): boolean {
    return this.status === 'uploading';
  }

  /**
   * Check if file is being processed
   */
  isProcessing(): boolean {
    return this.status === 'processing' || this.processing_status === 'in_progress';
  }

  /**
   * Check if file has errors
   */
  hasError(): boolean {
    return this.status === 'error' || this.processing_status === 'failed';
  }

  /**
   * Check if file is expired
   */
  isExpired(): boolean {
    if (!this.expires_at) return false;
    return this.expires_at < new Date();
  }

  /**
   * Check if file is public
   */
  isPublic(): boolean {
    return this.is_public;
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return this.original_name.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Get human-readable file size
   */
  getHumanReadableSize(): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (this.size === 0) return '0 B';
    const i = Math.floor(Math.log(this.size) / Math.log(1024));
    return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Check if file is an image
   */
  isImage(): boolean {
    return this.mime_type.startsWith('image/') || this.file_type === 'image';
  }

  /**
   * Check if file is a video
   */
  isVideo(): boolean {
    return this.mime_type.startsWith('video/') || this.file_type === 'video';
  }

  /**
   * Check if file is audio
   */
  isAudio(): boolean {
    return this.mime_type.startsWith('audio/') || this.file_type === 'audio';
  }

  /**
   * Check if file is a document
   */
  isDocument(): boolean {
    const documentMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    return documentMimes.includes(this.mime_type) || this.file_type === 'document';
  }

  /**
   * Check if file is code
   */
  isCode(): boolean {
    const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'];
    const extension = this.getExtension();
    return codeExtensions.includes(extension) || 
           this.mime_type.startsWith('text/') ||
           this.file_type === 'code';
  }

  /**
   * Mark upload as complete
   */
  markUploadComplete(checksum?: string): void {
    this.status = 'ready';
    if (checksum) {
      this.checksum = checksum;
    }
    this.metadata = {
      ...this.metadata,
      uploadCompletedAt: new Date()
    };
  }

  /**
   * Mark upload as failed
   */
  markUploadFailed(error: string): void {
    this.status = 'error';
    this.metadata = {
      ...this.metadata,
      uploadError: error,
      uploadFailedAt: new Date()
    };
  }

  /**
   * Start processing
   */
  startProcessing(): void {
    this.status = 'processing';
    this.processing_status = 'in_progress';
    this.metadata = {
      ...this.metadata,
      processingStartedAt: new Date()
    };
  }

  /**
   * Mark processing complete
   */
  markProcessingComplete(results: any): void {
    this.status = 'ready';
    this.processing_status = 'completed';
    this.processing_data = results;
    this.metadata = {
      ...this.metadata,
      processingCompletedAt: new Date()
    };
  }

  /**
   * Mark processing failed
   */
  markProcessingFailed(error: string): void {
    this.processing_status = 'failed';
    this.metadata = {
      ...this.metadata,
      processingError: error,
      processingFailedAt: new Date()
    };
  }

  /**
   * Increment download count
   */
  incrementDownloadCount(): void {
    this.download_count += 1;
    this.metadata = {
      ...this.metadata,
      lastDownloadedAt: new Date()
    };
  }

  /**
   * Set public access
   */
  setPublic(isPublic: boolean): void {
    this.is_public = isPublic;
    this.metadata = {
      ...this.metadata,
      publicAccessChangedAt: new Date(),
      previousPublicState: this.is_public
    };
  }

  /**
   * Set expiration
   */
  setExpiration(expiresAt: Date | null): void {
    this.expires_at = expiresAt;
    this.metadata = {
      ...this.metadata,
      expirationSetAt: new Date()
    };
  }

  /**
   * Archive file
   */
  archive(): void {
    this.status = 'archived';
    this.metadata = {
      ...this.metadata,
      archivedAt: new Date()
    };
  }

  /**
   * Delete file (soft delete)
   */
  softDelete(): void {
    this.status = 'deleted';
    this.metadata = {
      ...this.metadata,
      deletedAt: new Date()
    };
  }

  /**
   * Restore from archive/delete
   */
  restore(): void {
    this.status = 'ready';
    this.metadata = {
      ...this.metadata,
      restoredAt: new Date(),
      previousStatus: this.status
    };
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
   * Check if file has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Get thumbnail URL if available
   */
  getThumbnailUrl(): string | null {
    return this.processing_data?.thumbnail?.url || null;
  }

  /**
   * Get preview URL if available
   */
  getPreviewUrl(): string | null {
    return this.processing_data?.preview?.url || null;
  }

  /**
   * Get download URL (would be implemented by storage service)
   */
  getDownloadUrl(): string {
    // This would be implemented by the storage service
    return `/api/files/${this.id}/download`;
  }

  /**
   * Get direct storage URL if public
   */
  getStorageUrl(): string | null {
    if (!this.is_public) return null;
    return this.processing_data?.publicUrl || null;
  }

  /**
   * Validate file integrity
   */
  validateIntegrity(providedChecksum: string): boolean {
    return this.checksum === providedChecksum;
  }

  /**
   * Get file age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days until expiration
   */
  getDaysUntilExpiration(): number | null {
    if (!this.expires_at) return null;
    const diffTime = this.expires_at.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Search in file metadata and name
   */
  search(query: string): boolean {
    const searchText = `${this.original_name} ${this.file_type} ${this.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Create file variant (thumbnail, compressed version, etc.)
   */
  createVariant(variantData: {
    filename: string;
    storageKey: string;
    size: number;
    mimeType?: string;
    variantType: string;
  }): File {
    return new File({
      filename: variantData.filename,
      original_name: `${this.original_name} (${variantData.variantType})`,
      mime_type: variantData.mimeType || this.mime_type,
      size: variantData.size,
      storage_key: variantData.storageKey,
      storage_provider: this.storage_provider,
      status: 'ready',
      uploaded_by_id: this.uploaded_by_id,
      file_type: this.file_type,
      parent_file_id: this.id,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: {
        variantType: variantData.variantType,
        parentFileId: this.id,
        createdFromParent: new Date()
      }
    });
  }

  /**
   * Validate file data
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.filename || this.filename.trim() === '') {
      errors.push('Filename is required');
    }

    if (!this.original_name || this.original_name.trim() === '') {
      errors.push('Original name is required');
    }

    if (!this.mime_type || this.mime_type.trim() === '') {
      errors.push('MIME type is required');
    }

    if (this.size < 0) {
      errors.push('File size cannot be negative');
    }

    if (!this.storage_key || this.storage_key.trim() === '') {
      errors.push('Storage key is required');
    }

    if (!this.file_type || this.file_type.trim() === '') {
      errors.push('File type is required');
    }

    if (this.expires_at && this.expires_at <= this.created_at) {
      errors.push('Expiration date must be after creation date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get file summary
   */
  getSummary(): {
    id: string;
    originalName: string;
    fileType: string;
    mimeType: string;
    size: number;
    humanReadableSize: string;
    status: string;
    isReady: boolean;
    isPublic: boolean;
    isExpired: boolean;
    downloadCount: number;
    age: number;
    hasProcessingData: boolean;
    hasThumbnail: boolean;
    extension: string;
  } {
    return {
      id: this.id,
      originalName: this.original_name,
      fileType: this.file_type,
      mimeType: this.mime_type,
      size: this.size,
      humanReadableSize: this.getHumanReadableSize(),
      status: this.status,
      isReady: this.isReady(),
      isPublic: this.isPublic(),
      isExpired: this.isExpired(),
      downloadCount: this.download_count,
      age: this.getAge(),
      hasProcessingData: Object.keys(this.processing_data || {}).length > 0,
      hasThumbnail: !!this.getThumbnailUrl(),
      extension: this.getExtension()
    };
  }

  /**
   * Validate file data structure
   */
  static validateFile(data: Partial<FileFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.filename || data.filename.trim() === '') {
      errors.push('Filename is required');
    }

    if (!data.original_name || data.original_name.trim() === '') {
      errors.push('Original name is required');
    }

    if (!data.mime_type || data.mime_type.trim() === '') {
      errors.push('MIME type is required');
    }

    if (data.size !== undefined && data.size < 0) {
      errors.push('File size cannot be negative');
    }

    if (!data.storage_key || data.storage_key.trim() === '') {
      errors.push('Storage key is required');
    }

    const validStatuses: FileStatus[] = ['uploading', 'ready', 'processing', 'error', 'archived', 'deleted'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid file status');
    }

    const validProcessingStatuses: FileProcessingStatus[] = ['pending', 'in_progress', 'completed', 'failed', 'not_required'];
    if (data.processing_status && !validProcessingStatuses.includes(data.processing_status)) {
      errors.push('Invalid processing status');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Determine file type from MIME type
   */
  static determineFileType(mimeType: string, filename: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'document';
    if (mimeType.startsWith('text/')) return 'text';
    
    // Determine by file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb'];
    if (extension && codeExtensions.includes(extension)) return 'code';
    
    const documentExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    if (extension && documentExtensions.includes(extension)) return 'document';
    
    return 'other';
  }
}

/**
 * File Utilities for common operations
 */
export class FileUtilities {
  /**
   * Filter files by type
   */
  static filterByType(files: File[], fileType: string): File[] {
    return files.filter(f => f.file_type === fileType);
  }

  /**
   * Filter ready files
   */
  static filterReady(files: File[]): File[] {
    return files.filter(f => f.isReady());
  }

  /**
   * Filter public files
   */
  static filterPublic(files: File[]): File[] {
    return files.filter(f => f.isPublic());
  }

  /**
   * Filter images
   */
  static filterImages(files: File[]): File[] {
    return files.filter(f => f.isImage());
  }

  /**
   * Filter documents
   */
  static filterDocuments(files: File[]): File[] {
    return files.filter(f => f.isDocument());
  }

  /**
   * Filter files by uploader
   */
  static filterByUploader(files: File[], uploaderId: string): File[] {
    return files.filter(f => f.uploaded_by_id === uploaderId);
  }

  /**
   * Filter expired files
   */
  static filterExpired(files: File[]): File[] {
    return files.filter(f => f.isExpired());
  }

  /**
   * Group files by type
   */
  static groupByType(files: File[]): Record<string, File[]> {
    return files.reduce((groups, file) => {
      if (!groups[file.file_type]) {
        groups[file.file_type] = [];
      }
      groups[file.file_type].push(file);
      return groups;
    }, {} as Record<string, File[]>);
  }

  /**
   * Group files by uploader
   */
  static groupByUploader(files: File[]): Record<string, File[]> {
    return files.reduce((groups, file) => {
      const uploaderId = file.uploaded_by_id || 'unknown';
      if (!groups[uploaderId]) {
        groups[uploaderId] = [];
      }
      groups[uploaderId].push(file);
      return groups;
    }, {} as Record<string, File[]>);
  }

  /**
   * Search files
   */
  static search(files: File[], query: string): File[] {
    if (!query.trim()) return files;
    return files.filter(f => f.search(query));
  }

  /**
   * Sort files by size
   */
  static sortBySize(files: File[], ascending = false): File[] {
    return [...files].sort((a, b) => {
      const diff = a.size - b.size;
      return ascending ? diff : -diff;
    });
  }

  /**
   * Sort files by download count
   */
  static sortByDownloads(files: File[], ascending = false): File[] {
    return [...files].sort((a, b) => {
      const diff = a.download_count - b.download_count;
      return ascending ? diff : -diff;
    });
  }

  /**
   * Calculate total storage usage
   */
  static calculateStorageUsage(files: File[]): {
    totalFiles: number;
    totalSize: number;
    humanReadableSize: string;
    byType: Record<string, { count: number; size: number }>;
  } {
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      humanReadableSize: '',
      byType: {} as Record<string, { count: number; size: number }>
    };

    files.forEach(file => {
      stats.totalSize += file.size;
      
      if (!stats.byType[file.file_type]) {
        stats.byType[file.file_type] = { count: 0, size: 0 };
      }
      stats.byType[file.file_type].count++;
      stats.byType[file.file_type].size += file.size;
    });

    // Calculate human readable total size
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(stats.totalSize) / Math.log(1024));
    stats.humanReadableSize = Math.round(stats.totalSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];

    return stats;
  }

  /**
   * Calculate statistics
   */
  static calculateStats(files: File[]) {
    const stats = {
      total: files.length,
      ready: 0,
      uploading: 0,
      processing: 0,
      error: 0,
      public: 0,
      expired: 0,
      totalDownloads: 0,
      byType: {} as Record<string, number>,
      byMimeType: {} as Record<string, number>,
      averageSize: 0,
      averageAge: 0
    };

    let totalSize = 0;
    let totalAge = 0;

    files.forEach(file => {
      if (file.isReady()) stats.ready++;
      if (file.isUploading()) stats.uploading++;
      if (file.isProcessing()) stats.processing++;
      if (file.hasError()) stats.error++;
      if (file.isPublic()) stats.public++;
      if (file.isExpired()) stats.expired++;

      stats.totalDownloads += file.download_count;
      stats.byType[file.file_type] = (stats.byType[file.file_type] || 0) + 1;
      stats.byMimeType[file.mime_type] = (stats.byMimeType[file.mime_type] || 0) + 1;

      totalSize += file.size;
      totalAge += file.getAge();
    });

    stats.averageSize = files.length > 0 ? totalSize / files.length : 0;
    stats.averageAge = files.length > 0 ? totalAge / files.length : 0;

    return stats;
  }
}

export default File;