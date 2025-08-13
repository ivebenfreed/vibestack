import { Entity, Property } from '@mikro-orm/core';
import { FileArchetype } from '../archetypes/FileArchetype.js';

/**
 * Media file with multimedia processing and content management features
 * Extends FileArchetype with media-specific workflows
 */
@Entity({ tableName: 'media' })
export class Media extends FileArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'media_type' })
  mediaType?: 'image' | 'video' | 'audio' | 'animation' | 'document' | 'presentation' | 'other';

  @Property({ type: 'string', nullable: true, fieldName: 'content_type' })
  contentType?: 'photo' | 'illustration' | 'icon' | 'logo' | 'screenshot' | 'diagram' | 'chart' | 'marketing' | 'educational' | 'entertainment';

  @Property({ type: 'json', nullable: true, fieldName: 'media_properties' })
  mediaProperties?: {
    // Image/Video properties
    width?: number;
    height?: number;
    aspectRatio?: string;
    resolution?: string;
    colorDepth?: number;
    colorSpace?: string;
    orientation?: 'landscape' | 'portrait' | 'square';
    
    // Video properties
    duration?: number; // seconds
    frameRate?: number;
    bitrate?: number;
    codec?: string;
    hasAudio?: boolean;
    
    // Audio properties
    sampleRate?: number;
    channels?: number; // mono=1, stereo=2, etc.
    audioCodec?: string;
    audioBitrate?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'processing_info' })
  processingInfo?: {
    thumbnailGenerated?: boolean;
    thumbnailUrl?: string;
    previewGenerated?: boolean;
    previewUrl?: string;
    compressed?: boolean;
    optimized?: boolean;
    transcoded?: boolean;
    processedAt?: Date;
    processingErrors?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'quality_analysis' })
  qualityAnalysis?: {
    overallQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    sharpness?: number; // 0-100
    brightness?: number; // 0-100
    contrast?: number; // 0-100
    saturation?: number; // 0-100
    noise?: number; // 0-100, lower is better
    compression?: number; // 0-100, compression artifacts
    technicalScore?: number; // 0-100
    aestheticScore?: number; // 0-100
    analyzedAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'content_analysis' })
  contentAnalysis?: {
    // AI-generated analysis
    description?: string;
    detectedObjects?: Array<{
      object: string;
      confidence: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    detectedText?: Array<{
      text: string;
      confidence: number;
      language?: string;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    detectedFaces?: Array<{
      confidence: number;
      emotions?: Record<string, number>;
      age?: number;
      gender?: string;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
    colors?: Array<{
      color: string;
      percentage: number;
      hex: string;
    }>;
    analyzedAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'usage_rights' })
  usageRights?: {
    license?: 'public_domain' | 'cc0' | 'cc_by' | 'cc_by_sa' | 'cc_by_nc' | 'cc_by_nc_sa' | 'proprietary' | 'custom';
    licenseUrl?: string;
    attribution?: string;
    commercial?: boolean;
    derivatives?: boolean;
    redistribution?: boolean;
    expiresAt?: Date;
    restrictions?: string[];
    purchasedFrom?: string;
    purchaseDate?: Date;
    cost?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'brand_compliance' })
  brandCompliance?: {
    approved?: boolean;
    brandGuidelines?: string[];
    compliance?: Array<{
      guideline: string;
      compliant: boolean;
      notes?: string;
    }>;
    approvedBy?: string;
    approvedAt?: Date;
    expiresAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'seo_data' })
  seoData?: {
    altText?: string;
    title?: string;
    caption?: string;
    keywords?: string[];
    description?: string;
    optimized?: boolean;
    searchRanking?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'accessibility' })
  accessibility?: {
    altTextProvided?: boolean;
    contrastRatio?: number;
    colorBlindFriendly?: boolean;
    screenReaderFriendly?: boolean;
    wcagCompliance?: 'A' | 'AA' | 'AAA' | 'none';
    issues?: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      suggestion?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'versions' })
  versions?: Array<{
    versionType: 'original' | 'compressed' | 'thumbnail' | 'preview' | 'print' | 'web' | 'mobile';
    fileId?: string;
    url?: string;
    width?: number;
    height?: number;
    size?: number;
    quality?: string;
    format?: string;
    createdAt: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'edit_history' })
  editHistory?: Array<{
    editor: string;
    editedAt: Date;
    operation: 'crop' | 'resize' | 'filter' | 'color_correction' | 'rotation' | 'compression' | 'format_conversion' | 'other';
    description: string;
    parameters?: Record<string, any>;
    beforeUrl?: string;
    afterUrl?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'usage_tracking' })
  usageTracking?: {
    usedInProjects?: Array<{
      projectId: string;
      projectName: string;
      usageType: 'hero' | 'thumbnail' | 'gallery' | 'background' | 'icon' | 'content';
      addedAt: Date;
    }>;
    usedInDocuments?: Array<{
      documentId: string;
      documentTitle: string;
      usageContext: string;
      addedAt: Date;
    }>;
    usedInCampaigns?: Array<{
      campaignId: string;
      campaignName: string;
      channel: 'web' | 'print' | 'social' | 'email' | 'presentation';
      addedAt: Date;
    }>;
    totalUsages?: number;
    lastUsed?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'performance_data' })
  performanceData?: {
    loadTime?: number; // milliseconds
    cacheHitRate?: number; // percentage
    bandwidthUsage?: number; // bytes
    cdnDelivery?: boolean;
    optimizationScore?: number; // 0-100
    recommendations?: string[];
  };

  // Implementation of abstract methods
  getFileType(): string {
    return 'media';
  }

  async validateFileRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Media specific validation
    if (!this.mediaType) {
      return false; // Media type is required
    }

    // File size validation for different media types
    const maxSizes = {
      image: 50 * 1024 * 1024, // 50MB
      video: 2 * 1024 * 1024 * 1024, // 2GB
      audio: 100 * 1024 * 1024, // 100MB
      document: 50 * 1024 * 1024, // 50MB
    };

    const maxSize = maxSizes[this.mediaType as keyof typeof maxSizes] || 100 * 1024 * 1024;
    if (this.size && this.size > maxSize) {
      return false; // File too large for media type
    }

    // License validation
    if (this.usageRights?.expiresAt && this.usageRights.expiresAt < new Date()) {
      return false; // License expired
    }

    return true;
  }

  async processFile(): Promise<void> {
    // Determine media type from MIME type
    this.determineMediaType();
    
    // Start processing
    this.startProcessing();
    
    try {
      // Extract media properties
      await this.extractMediaProperties();
      
      // Generate thumbnails and previews
      await this.generatePreviews();
      
      // Analyze content and quality
      await this.analyzeContent();
      
      // Optimize for web delivery
      await this.optimizeForDelivery();
      
      this.completeProcessing({
        processed: true,
        mediaType: this.mediaType,
        properties: this.mediaProperties
      });
    } catch (error) {
      this.failProcessing([error instanceof Error ? error.message : 'Unknown error']);
    }
  }

  async generateThumbnail(): Promise<string | null> {
    if (this.processingInfo?.thumbnailUrl) {
      return this.processingInfo.thumbnailUrl;
    }

    if (!this.url) return null;
    
    // Generate thumbnail based on media type
    switch (this.mediaType) {
      case 'image':
        return `/api/thumbnail/${this.id}?type=image&size=200x200`;
      case 'video':
        return `/api/thumbnail/${this.id}?type=video&frame=1&size=200x200`;
      case 'document':
        return `/api/thumbnail/${this.id}?type=document&page=1&size=200x200`;
      default:
        return `/api/thumbnail/${this.id}?type=generic&size=200x200`;
    }
  }

  // Media specific business logic
  private determineMediaType(): void {
    if (this.mediaType) return; // Already set

    const mimeType = this.mimeType?.toLowerCase() || '';
    
    if (mimeType.startsWith('image/')) {
      this.mediaType = 'image';
    } else if (mimeType.startsWith('video/')) {
      this.mediaType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      this.mediaType = 'audio';
    } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('presentation')) {
      this.mediaType = 'document';
    } else if (mimeType.includes('gif') || mimeType.includes('animation')) {
      this.mediaType = 'animation';
    } else {
      this.mediaType = 'other';
    }
  }

  private async extractMediaProperties(): Promise<void> {
    // This would typically use media processing libraries
    // For now, simulate based on media type and file size
    
    const properties: NonNullable<Media['mediaProperties']> = {};
    
    switch (this.mediaType) {
      case 'image':
        // Simulate image properties
        properties.width = Math.floor(Math.random() * 2000) + 800;
        properties.height = Math.floor(Math.random() * 1500) + 600;
        properties.aspectRatio = (properties.width / properties.height).toFixed(2);
        properties.colorDepth = 24;
        properties.colorSpace = 'sRGB';
        properties.orientation = properties.width > properties.height ? 'landscape' : 'portrait';
        break;
        
      case 'video':
        properties.width = Math.floor(Math.random() * 1920) + 720;
        properties.height = Math.floor(Math.random() * 1080) + 480;
        properties.duration = Math.floor(Math.random() * 300) + 30; // 30-330 seconds
        properties.frameRate = [24, 30, 60][Math.floor(Math.random() * 3)];
        properties.bitrate = Math.floor(Math.random() * 5000) + 1000; // 1-6 Mbps
        properties.hasAudio = Math.random() > 0.2; // 80% have audio
        properties.codec = ['H.264', 'H.265', 'VP9'][Math.floor(Math.random() * 3)];
        break;
        
      case 'audio':
        properties.duration = Math.floor(Math.random() * 600) + 60; // 1-11 minutes
        properties.sampleRate = [44100, 48000, 96000][Math.floor(Math.random() * 3)];
        properties.channels = Math.random() > 0.3 ? 2 : 1; // 70% stereo
        properties.audioCodec = ['MP3', 'AAC', 'FLAC'][Math.floor(Math.random() * 3)];
        properties.audioBitrate = Math.floor(Math.random() * 256) + 128; // 128-384 kbps
        break;
    }
    
    this.mediaProperties = properties;
  }

  private async generatePreviews(): Promise<void> {
    // Simulate preview generation
    const thumbnailUrl = await this.generateThumbnail();
    
    this.processingInfo = {
      thumbnailGenerated: !!thumbnailUrl,
      thumbnailUrl: thumbnailUrl || undefined,
      previewGenerated: true,
      previewUrl: `/api/preview/${this.id}`,
      processedAt: new Date()
    };

    // Generate different versions
    this.versions = [
      {
        versionType: 'original',
        url: this.url,
        width: this.mediaProperties?.width,
        height: this.mediaProperties?.height,
        size: this.size,
        quality: 'original',
        format: this.extension,
        createdAt: new Date()
      }
    ];

    if (this.mediaType === 'image') {
      // Add web and mobile versions
      this.versions.push(
        {
          versionType: 'web',
          width: Math.min(this.mediaProperties?.width || 1920, 1920),
          height: Math.min(this.mediaProperties?.height || 1080, 1080),
          size: this.size ? Math.floor(this.size * 0.7) : undefined,
          quality: 'high',
          format: '.webp',
          createdAt: new Date()
        },
        {
          versionType: 'mobile',
          width: Math.min(this.mediaProperties?.width || 768, 768),
          height: Math.min(this.mediaProperties?.height || 1024, 1024),
          size: this.size ? Math.floor(this.size * 0.4) : undefined,
          quality: 'medium',
          format: '.webp',
          createdAt: new Date()
        }
      );
    }
  }

  private async analyzeContent(): Promise<void> {
    // Simulate AI content analysis
    if (this.mediaType === 'image') {
      this.contentAnalysis = {
        description: 'An image containing various objects and elements',
        detectedObjects: [
          { object: 'person', confidence: 0.95 },
          { object: 'building', confidence: 0.87 },
          { object: 'tree', confidence: 0.76 }
        ],
        colors: [
          { color: 'blue', percentage: 35, hex: '#4A90E2' },
          { color: 'green', percentage: 25, hex: '#7ED321' },
          { color: 'white', percentage: 20, hex: '#FFFFFF' }
        ],
        analyzedAt: new Date()
      };

      // Quality analysis
      this.qualityAnalysis = {
        overallQuality: ['good', 'excellent'][Math.floor(Math.random() * 2)] as 'good' | 'excellent',
        sharpness: Math.floor(Math.random() * 30) + 70,
        brightness: Math.floor(Math.random() * 40) + 40,
        contrast: Math.floor(Math.random() * 40) + 50,
        saturation: Math.floor(Math.random() * 50) + 50,
        noise: Math.floor(Math.random() * 20),
        compression: Math.floor(Math.random() * 15),
        technicalScore: Math.floor(Math.random() * 30) + 70,
        aestheticScore: Math.floor(Math.random() * 40) + 60,
        analyzedAt: new Date()
      };
    }
  }

  private async optimizeForDelivery(): Promise<void> {
    // Simulate optimization
    this.processingInfo = {
      ...this.processingInfo,
      compressed: true,
      optimized: true
    };

    this.performanceData = {
      loadTime: Math.floor(Math.random() * 1000) + 200, // 200-1200ms
      cacheHitRate: Math.floor(Math.random() * 40) + 60, // 60-100%
      bandwidthUsage: this.size || 0,
      cdnDelivery: true,
      optimizationScore: Math.floor(Math.random() * 30) + 70, // 70-100
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations = [];
    
    if (this.size && this.size > 1024 * 1024) { // > 1MB
      recommendations.push('Consider compressing the file to reduce size');
    }
    
    if (this.mediaType === 'image' && this.extension !== '.webp') {
      recommendations.push('Convert to WebP format for better compression');
    }
    
    if (this.mediaProperties?.width && this.mediaProperties.width > 2000) {
      recommendations.push('Consider reducing image dimensions for web use');
    }
    
    return recommendations;
  }

  // Media management methods
  isHighQuality(): boolean {
    return this.qualityAnalysis?.overallQuality === 'excellent' || 
           (this.qualityAnalysis?.technicalScore || 0) >= 80;
  }

  isOptimizedForWeb(): boolean {
    const hasWebVersion = this.versions?.some(v => v.versionType === 'web');
    const isCompressed = this.processingInfo?.compressed;
    const reasonableSize = (this.size || 0) < 5 * 1024 * 1024; // < 5MB
    
    return hasWebVersion && isCompressed && reasonableSize;
  }

  needsOptimization(): boolean {
    const largeFile = (this.size || 0) > 10 * 1024 * 1024; // > 10MB
    const lowOptimizationScore = (this.performanceData?.optimizationScore || 0) < 60;
    const oldFormat = this.mediaType === 'image' && !['.webp', '.avif'].includes(this.extension || '');
    
    return largeFile || lowOptimizationScore || oldFormat;
  }

  hasValidLicense(): boolean {
    if (!this.usageRights) return true; // No restrictions
    
    const notExpired = !this.usageRights.expiresAt || this.usageRights.expiresAt > new Date();
    return notExpired;
  }

  canUseCommercially(): boolean {
    return this.usageRights?.commercial ?? true;
  }

  canCreateDerivatives(): boolean {
    return this.usageRights?.derivatives ?? true;
  }

  addEdit(editor: string, operation: NonNullable<Media['editHistory']>[0]['operation'], description: string, parameters?: Record<string, any>): void {
    if (!this.editHistory) {
      this.editHistory = [];
    }

    this.editHistory.push({
      editor,
      editedAt: new Date(),
      operation,
      description,
      parameters,
      beforeUrl: this.url,
      afterUrl: this.url // Would be updated with new URL after edit
    });
  }

  trackUsage(projectId: string, projectName: string, usageType: NonNullable<NonNullable<Media['usageTracking']>['usedInProjects']>[0]['usageType']): void {
    if (!this.usageTracking) {
      this.usageTracking = { totalUsages: 0 };
    }

    if (!this.usageTracking.usedInProjects) {
      this.usageTracking.usedInProjects = [];
    }

    // Check if already tracked in this project
    const existing = this.usageTracking.usedInProjects.find(p => p.projectId === projectId);
    if (!existing) {
      this.usageTracking.usedInProjects.push({
        projectId,
        projectName,
        usageType,
        addedAt: new Date()
      });

      this.usageTracking.totalUsages = (this.usageTracking.totalUsages || 0) + 1;
      this.usageTracking.lastUsed = new Date();
    }
  }

  addVersion(versionType: NonNullable<Media['versions']>[0]['versionType'], url: string, properties?: Partial<NonNullable<Media['versions']>[0]>): void {
    if (!this.versions) {
      this.versions = [];
    }

    this.versions.push({
      versionType,
      url,
      createdAt: new Date(),
      ...properties
    });
  }

  setBrandCompliance(approved: boolean, guidelines: string[], approvedBy?: string): void {
    this.brandCompliance = {
      approved,
      brandGuidelines: guidelines,
      compliance: guidelines.map(guideline => ({
        guideline,
        compliant: approved,
        notes: approved ? 'Approved' : 'Needs review'
      })),
      approvedBy,
      approvedAt: approved ? new Date() : undefined
    };
  }

  updateSEO(altText?: string, title?: string, caption?: string, keywords?: string[], description?: string): void {
    this.seoData = {
      altText,
      title,
      caption,
      keywords,
      description,
      optimized: !!(altText && title && keywords?.length)
    };
  }

  getMediaHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Technical quality (30%)
    factors.technicalQuality = this.qualityAnalysis?.technicalScore || 50;
    if (factors.technicalQuality < 70) {
      issues.push('Media technical quality needs improvement');
    }

    // Optimization (25%)
    factors.optimization = this.performanceData?.optimizationScore || 50;
    if (factors.optimization < 70) {
      issues.push('Media needs optimization for web delivery');
    }

    // Legal compliance (25%)
    factors.legalCompliance = this.calculateLegalComplianceScore();
    if (factors.legalCompliance < 80) {
      issues.push('Legal or licensing issues detected');
    }

    // Accessibility (20%)
    factors.accessibility = this.calculateAccessibilityScore();
    if (factors.accessibility < 70) {
      issues.push('Accessibility improvements needed');
    }

    const totalScore = 
      factors.technicalQuality * 0.3 + 
      factors.optimization * 0.25 + 
      factors.legalCompliance * 0.25 + 
      factors.accessibility * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateLegalComplianceScore(): number {
    let score = 80; // Base score

    // License validity
    if (!this.hasValidLicense()) score -= 40;

    // Brand compliance
    if (this.brandCompliance?.approved) score += 20;
    else if (this.brandCompliance && !this.brandCompliance.approved) score -= 20;

    // Usage rights clarity
    if (this.usageRights) score += 10;
    else score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateAccessibilityScore(): number {
    let score = 50; // Base score

    // Alt text
    if (this.seoData?.altText) score += 30;
    else score -= 20;

    // WCAG compliance
    if (this.accessibility?.wcagCompliance) {
      switch (this.accessibility.wcagCompliance) {
        case 'AAA': score += 20; break;
        case 'AA': score += 15; break;
        case 'A': score += 10; break;
        case 'none': score -= 10; break;
      }
    }

    // Color contrast (for images)
    if (this.accessibility?.contrastRatio && this.accessibility.contrastRatio >= 4.5) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}