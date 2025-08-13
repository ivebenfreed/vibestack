import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all file-related entities
 * Provides common file fields and management patterns
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class FileArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  filename!: string;

  @Property({ type: 'string', nullable: true })
  originalName?: string;

  @Property({ type: 'string', nullable: true })
  mimeType?: string;

  @Property({ type: 'bigint', nullable: true })
  size?: number; // Size in bytes

  @Property({ type: 'string', nullable: true })
  path?: string; // Storage path

  @Property({ type: 'string', nullable: true })
  url?: string; // Access URL

  @Property({ type: 'string', nullable: true })
  checksum?: string; // File integrity check

  @Property({ type: 'string', nullable: true })
  encoding?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'file_type' })
  fileType?: string;

  @Property({ type: 'string', nullable: true })
  extension?: string;

  @Property({ type: 'string', nullable: true })
  category?: string;

  @Property({ type: 'integer', default: 1 })
  version!: number;

  @Property({ type: 'string', nullable: true })
  status?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'uploaded_by' })
  uploadedBy?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'uploaded_at' })
  uploadedAt?: Date;

  @Property({ type: 'uuid', nullable: true, fieldName: 'modified_by' })
  modifiedBy?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'last_accessed' })
  lastAccessed?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'expires_at' })
  expiresAt?: Date;

  // Parent file for hierarchy (e.g., patches, versions)
  @ManyToOne(() => FileArchetype, { nullable: true, fieldName: 'parent_file_id' })
  parentFile?: FileArchetype;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'access_control' })
  accessControl?: {
    visibility: 'public' | 'private' | 'restricted';
    allowedUsers?: string[];
    allowedRoles?: string[];
    downloadable?: boolean;
    expiresAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'virus_scan' })
  virusScan?: {
    scanned: boolean;
    scannedAt?: Date;
    clean: boolean;
    engine?: string;
    threats?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'backup_info' })
  backupInfo?: {
    backedUp: boolean;
    backupLocation?: string;
    lastBackup?: Date;
    backupSize?: number;
    checksum?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'compression_info' })
  compressionInfo?: {
    compressed: boolean;
    originalSize?: number;
    compressionRatio?: number;
    algorithm?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'related_files' })
  relatedFiles?: Array<{
    fileId: string;
    relationship: 'dependency' | 'source' | 'compiled' | 'patch' | 'thumbnail' | 'preview';
    description?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'version_history' })
  versionHistory?: Array<{
    version: number;
    uploadedBy: string;
    uploadedAt: Date;
    changes: string;
    size: number;
    checksum?: string;
    url?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'download_stats' })
  downloadStats?: {
    totalDownloads: number;
    uniqueDownloads: number;
    lastDownload?: Date;
    popularTimes?: Record<string, number>; // hour -> count
    downloadHistory?: Array<{
      userId: string;
      downloadedAt: Date;
      ipAddress?: string;
      userAgent?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'processing_info' })
  processingInfo?: {
    processed: boolean;
    processedAt?: Date;
    processor?: string;
    status?: 'queued' | 'processing' | 'completed' | 'failed';
    results?: Record<string, any>;
    errors?: string[];
  };

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'file';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'flexible'; // Files can belong to projects, tasks, documents, etc.
  }

  // Abstract methods that concrete implementations must provide
  abstract getFileType(): string;
  abstract validateFileRules(): Promise<boolean>;
  abstract processFile(): Promise<void>;
  abstract generateThumbnail(): Promise<string | null>;

  // Common file business logic
  isImage(): boolean {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    return imageTypes.includes(this.mimeType || '');
  }

  isDocument(): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/rtf'
    ];
    return documentTypes.includes(this.mimeType || '');
  }

  isCode(): boolean {
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.html', '.css', '.sql', '.json', '.xml'];
    return codeExtensions.some(ext => this.extension?.toLowerCase() === ext);
  }

  isArchive(): boolean {
    const archiveTypes = [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-7z-compressed'
    ];
    return archiveTypes.includes(this.mimeType || '');
  }

  isVideo(): boolean {
    const videoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
    return videoTypes.includes(this.mimeType || '');
  }

  isAudio(): boolean {
    const audioTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac'];
    return audioTypes.includes(this.mimeType || '');
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  isExpiringSoon(days: number = 7): boolean {
    if (!this.expiresAt) return false;
    const daysUntilExpiration = (this.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiration <= days && daysUntilExpiration > 0;
  }

  // File management
  getHumanReadableSize(): string {
    if (!this.size) return 'Unknown';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.size;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  updateLastAccessed(userId?: string): void {
    this.lastAccessed = new Date();
    
    if (userId && this.downloadStats) {
      if (!this.downloadStats.downloadHistory) {
        this.downloadStats.downloadHistory = [];
      }
      
      // Add access record (limit to last 100 accesses)
      this.downloadStats.downloadHistory.unshift({
        userId,
        downloadedAt: new Date()
      });
      
      if (this.downloadStats.downloadHistory.length > 100) {
        this.downloadStats.downloadHistory = this.downloadStats.downloadHistory.slice(0, 100);
      }
    }
  }

  recordDownload(userId: string, ipAddress?: string, userAgent?: string): void {
    if (!this.downloadStats) {
      this.downloadStats = {
        totalDownloads: 0,
        uniqueDownloads: 0,
        downloadHistory: []
      };
    }

    this.downloadStats.totalDownloads++;
    this.downloadStats.lastDownload = new Date();

    // Check if this is a unique download
    const hasDownloadedBefore = this.downloadStats.downloadHistory?.some(
      record => record.userId === userId
    );
    
    if (!hasDownloadedBefore) {
      this.downloadStats.uniqueDownloads++;
    }

    // Add to download history
    if (!this.downloadStats.downloadHistory) {
      this.downloadStats.downloadHistory = [];
    }

    this.downloadStats.downloadHistory.unshift({
      userId,
      downloadedAt: new Date(),
      ipAddress,
      userAgent
    });

    // Limit history to last 1000 downloads
    if (this.downloadStats.downloadHistory.length > 1000) {
      this.downloadStats.downloadHistory = this.downloadStats.downloadHistory.slice(0, 1000);
    }

    // Update popular times
    const hour = new Date().getHours().toString();
    if (!this.downloadStats.popularTimes) {
      this.downloadStats.popularTimes = {};
    }
    this.downloadStats.popularTimes[hour] = (this.downloadStats.popularTimes[hour] || 0) + 1;
  }

  // Version management
  createVersion(uploadedBy: string, changes: string, newSize: number, newChecksum?: string, newUrl?: string): void {
    if (!this.versionHistory) {
      this.versionHistory = [];
    }

    // Save current version to history
    const versionEntry = {
      version: this.version,
      uploadedBy,
      uploadedAt: new Date(),
      changes,
      size: newSize,
      checksum: newChecksum,
      url: newUrl
    };

    this.versionHistory.push(versionEntry);
    this.version += 1;
    this.size = newSize;
    this.checksum = newChecksum;
    this.url = newUrl;
    this.modifiedBy = uploadedBy;
  }

  getVersionHistory(): NonNullable<FileArchetype['versionHistory']> {
    return this.versionHistory || [];
  }

  rollbackToVersion(targetVersion: number, userId: string): boolean {
    const versionEntry = this.versionHistory?.find(v => v.version === targetVersion);
    if (!versionEntry) return false;

    // Create rollback entry
    this.createVersion(userId, `Rolled back to version ${targetVersion}`, versionEntry.size, versionEntry.checksum, versionEntry.url);
    return true;
  }

  // Access control
  canAccess(userId: string, userRoles: string[] = []): boolean {
    if (!this.accessControl) return true; // Default is open access

    switch (this.accessControl.visibility) {
      case 'public':
        return true;
      case 'private':
        return this.uploadedBy === userId || this.createdBy === userId;
      case 'restricted':
        const allowedUsers = this.accessControl.allowedUsers || [];
        const allowedRoles = this.accessControl.allowedRoles || [];
        
        return allowedUsers.includes(userId) || 
               userRoles.some(role => allowedRoles.includes(role));
      default:
        return true;
    }
  }

  canDownload(userId: string, userRoles: string[] = []): boolean {
    if (!this.canAccess(userId, userRoles)) return false;
    if (this.isExpired()) return false;
    return this.accessControl?.downloadable ?? true;
  }

  setAccessControl(visibility: NonNullable<FileArchetype['accessControl']>['visibility'], 
                   allowedUsers?: string[], 
                   allowedRoles?: string[],
                   downloadable: boolean = true): void {
    this.accessControl = {
      visibility,
      allowedUsers,
      allowedRoles,
      downloadable
    };
  }

  // File relationships
  addRelatedFile(fileId: string, 
                relationship: NonNullable<FileArchetype['relatedFiles']>[0]['relationship'],
                description?: string): void {
    if (!this.relatedFiles) {
      this.relatedFiles = [];
    }

    // Check if relationship already exists
    const exists = this.relatedFiles.some(rel => 
      rel.fileId === fileId && rel.relationship === relationship
    );

    if (!exists) {
      this.relatedFiles.push({
        fileId,
        relationship,
        description
      });
    }
  }

  removeRelatedFile(fileId: string, relationship?: string): void {
    if (!this.relatedFiles) return;

    this.relatedFiles = this.relatedFiles.filter(rel => 
      !(rel.fileId === fileId && (!relationship || rel.relationship === relationship))
    );
  }

  getRelatedFiles(relationship?: string): NonNullable<FileArchetype['relatedFiles']> {
    if (!this.relatedFiles) return [];
    
    if (relationship) {
      return this.relatedFiles.filter(rel => rel.relationship === relationship);
    }
    
    return this.relatedFiles;
  }

  // Tag management
  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    if (!this.tags) return;
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
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

  removeMetadata(key: string): void {
    if (!this.metadata) return;
    delete this.metadata[key];
  }

  // Security and safety
  markAsScanned(clean: boolean, engine?: string, threats?: string[]): void {
    this.virusScan = {
      scanned: true,
      scannedAt: new Date(),
      clean,
      engine,
      threats
    };
  }

  isSafe(): boolean {
    return this.virusScan?.clean ?? false;
  }

  needsScanning(): boolean {
    if (!this.virusScan) return true;
    if (!this.virusScan.scanned) return true;
    
    // Re-scan files older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return !this.virusScan.scannedAt || this.virusScan.scannedAt < thirtyDaysAgo;
  }

  // Backup management
  markAsBackedUp(location: string, backupSize?: number, checksum?: string): void {
    this.backupInfo = {
      backedUp: true,
      backupLocation: location,
      lastBackup: new Date(),
      backupSize,
      checksum
    };
  }

  needsBackup(): boolean {
    if (!this.backupInfo?.backedUp) return true;
    
    // Backup files modified since last backup
    const lastBackup = this.backupInfo.lastBackup;
    return !lastBackup || this.updatedAt > lastBackup;
  }

  // Processing status
  markForProcessing(processor: string): void {
    this.processingInfo = {
      processed: false,
      processor,
      status: 'queued'
    };
  }

  startProcessing(): void {
    if (this.processingInfo) {
      this.processingInfo.status = 'processing';
      this.processingInfo.processedAt = new Date();
    }
  }

  completeProcessing(results?: Record<string, any>): void {
    if (this.processingInfo) {
      this.processingInfo.processed = true;
      this.processingInfo.status = 'completed';
      this.processingInfo.results = results;
    }
  }

  failProcessing(errors: string[]): void {
    if (this.processingInfo) {
      this.processingInfo.status = 'failed';
      this.processingInfo.errors = errors;
    }
  }

  // File health assessment
  getFileHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Security (30%)
    factors.security = this.calculateSecurityScore();
    if (factors.security < 70) {
      issues.push('File security needs attention');
    }

    // Backup status (25%)
    factors.backup = this.calculateBackupScore();
    if (factors.backup < 60) {
      issues.push('File backup status inadequate');
    }

    // Access and usage (25%)
    factors.usage = this.calculateUsageScore();
    if (factors.usage < 40) {
      issues.push('File may be unused or inaccessible');
    }

    // Maintenance (20%)
    factors.maintenance = this.calculateMaintenanceScore();
    if (factors.maintenance < 50) {
      issues.push('File needs maintenance or review');
    }

    const totalScore = 
      factors.security * 0.3 + 
      factors.backup * 0.25 + 
      factors.usage * 0.25 + 
      factors.maintenance * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateSecurityScore(): number {
    let score = 50; // Base score

    // Virus scanning
    if (this.virusScan?.scanned && this.virusScan.clean) score += 30;
    else if (this.virusScan?.scanned && !this.virusScan.clean) score -= 30;
    else score -= 10; // Not scanned

    // Access control
    if (this.accessControl) score += 10;
    else score -= 5;

    // File integrity
    if (this.checksum) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateBackupScore(): number {
    let score = 0;

    if (this.backupInfo?.backedUp) {
      score += 70;
      
      // Recent backup
      if (this.backupInfo.lastBackup) {
        const daysSinceBackup = (new Date().getTime() - this.backupInfo.lastBackup.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceBackup <= 1) score += 30;
        else if (daysSinceBackup <= 7) score += 20;
        else if (daysSinceBackup <= 30) score += 10;
      }
    }

    return Math.min(100, score);
  }

  private calculateUsageScore(): number {
    let score = 30; // Base score

    // Download activity
    if (this.downloadStats) {
      const downloads = this.downloadStats.totalDownloads;
      if (downloads > 100) score += 30;
      else if (downloads > 50) score += 20;
      else if (downloads > 10) score += 15;
      else if (downloads > 0) score += 10;

      // Recent access
      if (this.lastAccessed) {
        const daysSinceAccess = (new Date().getTime() - this.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAccess <= 7) score += 20;
        else if (daysSinceAccess <= 30) score += 10;
      }
    }

    // Expiration
    if (this.isExpired()) score -= 20;
    else if (this.isExpiringSoon()) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateMaintenanceScore(): number {
    let score = 70; // Base score

    // File age
    const ageInDays = (new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 365) score -= 20;
    else if (ageInDays > 180) score -= 10;

    // Version activity
    if (this.version > 1) score += 15;
    
    // Metadata completeness
    if (this.metadata && Object.keys(this.metadata).length > 0) score += 10;
    if (this.tags && this.tags.length > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // Common validation that all files should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.filename || this.filename.trim().length === 0) {
      errors.push('Filename is required');
    }

    if (this.size && this.size < 0) {
      errors.push('File size cannot be negative');
    }

    if (this.version < 1) {
      errors.push('Version must be positive');
    }

    // Check for expired files
    if (this.isExpired()) {
      errors.push('File has expired');
    }

    // Check virus scan for non-clean files
    if (this.virusScan && !this.virusScan.clean) {
      errors.push('File failed virus scan');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}