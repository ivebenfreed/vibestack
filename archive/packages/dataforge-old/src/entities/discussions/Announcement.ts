import { Entity, Property } from '@mikro-orm/core';
import { DiscussionArchetype } from '../archetypes/DiscussionArchetype.js';

/**
 * Announcement with broadcast features and delivery tracking
 * Extends DiscussionArchetype with announcement-specific functionality
 */
@Entity({ tableName: 'announcement' })
export class Announcement extends DiscussionArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'announcement_type' })
  announcementType?: 'general' | 'urgent' | 'maintenance' | 'policy' | 'event' | 'release' | 'system' | 'emergency';

  @Property({ type: 'string', nullable: true })
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @Property({ type: 'date', nullable: true, fieldName: 'published_at' })
  publishedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'expires_at' })
  expiresAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'effective_from' })
  effectiveFrom?: Date;

  @Property({ type: 'boolean', default: false })
  urgent!: boolean;

  @Property({ type: 'boolean', default: false })
  sticky!: boolean;

  @Property({ type: 'boolean', default: false, fieldName: 'requires_acknowledgment' })
  requiresAcknowledgment!: boolean;

  @Property({ type: 'json', nullable: true, fieldName: 'target_audience' })
  targetAudience?: {
    includeAll?: boolean;
    departments?: string[];
    roles?: string[];
    locations?: string[];
    userIds?: string[];
    excludeUsers?: string[];
    excludeRoles?: string[];
    conditions?: Array<{
      field: 'department' | 'role' | 'location' | 'tenure' | 'status';
      operator: 'equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
      value: any;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'delivery_settings' })
  deliverySettings?: {
    channels: Array<'email' | 'push' | 'sms' | 'slack' | 'teams' | 'in_app' | 'desktop'>;
    scheduling?: {
      immediate: boolean;
      scheduledFor?: Date;
      timezone?: string;
      respectQuietHours?: boolean;
      batchDelivery?: boolean;
      batchSize?: number;
      batchInterval?: number; // minutes
    };
    retryPolicy?: {
      maxRetries: number;
      retryInterval: number; // minutes
      exponentialBackoff: boolean;
    };
    deliveryWindows?: Array<{
      day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
      startHour: number;
      endHour: number;
      timezone?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'content_variants' })
  contentVariants?: Array<{
    variant: 'full' | 'summary' | 'mobile' | 'email' | 'sms' | 'push';
    subject?: string;
    title: string;
    content: string;
    attachments?: Array<{
      fileId: string;
      filename: string;
      required: boolean;
    }>;
    callToAction?: {
      text: string;
      url?: string;
      action?: 'acknowledge' | 'redirect' | 'download' | 'custom';
    };
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'acknowledgment_tracking' })
  acknowledgmentTracking?: {
    totalRequired: number;
    totalAcknowledged: number;
    acknowledgmentRate: number; // percentage
    acknowledgedUsers: Array<{
      userId: string;
      acknowledgedAt: Date;
      channel: string;
      ipAddress?: string;
      userAgent?: string;
    }>;
    pendingUsers: string[];
    reminders: Array<{
      sentAt: Date;
      recipientCount: number;
      channel: string;
    }>;
    deadline?: Date;
    escalationRules?: Array<{
      triggerAfter: number; // hours
      action: 'remind' | 'escalate' | 'report';
      recipients: string[];
      message?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'delivery_tracking' })
  deliveryTracking?: {
    totalRecipients: number;
    deliveryStatuses: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      bounced: number;
      unsubscribed: number;
    };
    deliveryDetails: Array<{
      userId: string;
      channel: string;
      status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
      sentAt?: Date;
      deliveredAt?: Date;
      readAt?: Date;
      failureReason?: string;
      retryCount: number;
      lastRetryAt?: Date;
    }>;
    channelPerformance: Record<string, {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      deliveryRate: number;
      readRate: number;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'engagement_metrics' })
  engagementMetrics?: {
    opens: number;
    clicks: number;
    shares: number;
    downloads: number;
    timeSpent: number; // total seconds
    averageReadTime: number; // seconds
    deviceBreakdown: Record<string, number>; // device -> count
    locationBreakdown: Record<string, number>; // country/city -> count
    timezonBreakdown: Record<string, number>; // timezone -> count
    peakEngagementHours: Record<string, number>; // hour -> engagement count
    engagementTrend: Array<{
      date: Date;
      opens: number;
      clicks: number;
      newReaders: number;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'feedback_collection' })
  feedbackCollection?: {
    enabled: boolean;
    allowComments: boolean;
    allowRatings: boolean;
    allowSuggestions: boolean;
    feedbackItems: Array<{
      userId: string;
      type: 'comment' | 'rating' | 'suggestion' | 'question';
      content?: string;
      rating?: number; // 1-5
      category?: string;
      submittedAt: Date;
      status: 'new' | 'reviewed' | 'responded' | 'resolved';
      response?: {
        responderId: string;
        content: string;
        respondedAt: Date;
      };
    }>;
    overallRating?: number;
    totalFeedback: number;
    categories: Record<string, number>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'compliance_tracking' })
  complianceTracking?: {
    regulationTypes: string[]; // GDPR, HIPAA, SOX, etc.
    auditTrail: Array<{
      action: 'created' | 'published' | 'modified' | 'viewed' | 'acknowledged' | 'archived';
      userId: string;
      timestamp: Date;
      details: string;
      ipAddress?: string;
      userAgent?: string;
    }>;
    retentionPolicy: {
      retainFor: number; // days
      deleteAfter?: Date;
      archiveLocation?: string;
    };
    accessLog: Array<{
      userId: string;
      accessedAt: Date;
      ipAddress?: string;
      country?: string;
      duration?: number; // seconds
    }>;
    dataProcessingConsent?: {
      required: boolean;
      obtained: Array<{
        userId: string;
        consentedAt: Date;
        consentType: 'explicit' | 'implicit';
        withdrawnAt?: Date;
      }>;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'automation_config' })
  automationConfig?: {
    autoPublish?: {
      enabled: boolean;
      conditions: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
    };
    autoReminders?: {
      enabled: boolean;
      intervals: number[]; // hours after initial send
      maxReminders: number;
      template?: string;
    };
    autoArchive?: {
      enabled: boolean;
      archiveAfter: number; // days
      notifyBeforeArchive: boolean;
    };
    escalationWorkflow?: Array<{
      triggerCondition: string;
      delayHours: number;
      actions: Array<{
        type: 'notify' | 'reassign' | 'escalate';
        recipients: string[];
        template?: string;
      }>;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'localization' })
  localization?: {
    defaultLanguage: string;
    availableLanguages: string[];
    translations: Record<string, {
      title: string;
      content: string;
      subject?: string;
      callToAction?: string;
      translatedBy?: string;
      translatedAt?: Date;
      verified: boolean;
    }>;
    autoTranslation?: {
      enabled: boolean;
      service: 'google' | 'azure' | 'aws' | 'manual';
      confidence: number;
    };
  };

  // Implementation of abstract methods
  getDiscussionType(): string {
    return 'announcement';
  }

  async validateDiscussionRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Announcement specific validation
    if (!this.announcementType) {
      return false; // Announcement type is required
    }

    // Validate publication timing
    if (this.publishedAt && this.effectiveFrom && this.publishedAt > this.effectiveFrom) {
      return false; // Cannot publish after effective date
    }

    // Validate expiration
    if (this.expiresAt && this.publishedAt && this.expiresAt <= this.publishedAt) {
      return false; // Expiration must be after publication
    }

    // Validate target audience
    if (this.targetAudience && !this.hasValidTargetAudience()) {
      return false; // Invalid target audience configuration
    }

    // Emergency announcements require special validation
    if (this.announcementType === 'emergency' || this.severity === 'critical') {
      if (!this.urgent) {
        return false; // Emergency/critical announcements must be urgent
      }
    }

    return true;
  }

  async processContent(): Promise<void> {
    try {
      // Generate content variants if not provided
      await this.generateContentVariants();
      
      // Calculate target audience size
      await this.calculateTargetAudience();
      
      // Setup delivery tracking
      this.initializeDeliveryTracking();
      
      // Setup acknowledgment tracking if required
      if (this.requiresAcknowledgment) {
        this.initializeAcknowledgmentTracking();
      }
      
      // Process automation rules
      await this.processAutomationRules();
      
      // Update search optimization for announcements
      this.updateAnnouncementSearch();
      
    } catch (error) {
      console.error('Announcement processing error:', error);
    }
  }

  async notifyParticipants(event: string, data?: Record<string, any>): Promise<void> {
    // Announcements handle their own notification delivery
    if (event === 'published') {
      await this.deliverAnnouncement();
    } else if (event === 'reminder') {
      await this.sendReminders();
    } else if (event === 'escalation') {
      await this.handleEscalation(data);
    }

    console.log(`Announcement notification: ${event} processed`);
  }

  // Announcement-specific business logic
  private hasValidTargetAudience(): boolean {
    if (!this.targetAudience) return true; // No restrictions means valid

    const { includeAll, departments, roles, userIds } = this.targetAudience;
    
    // Must have at least one targeting criteria
    return includeAll || 
           (departments && departments.length > 0) ||
           (roles && roles.length > 0) ||
           (userIds && userIds.length > 0);
  }

  private async generateContentVariants(): Promise<void> {
    if (!this.contentVariants) {
      this.contentVariants = [];
    }

    // Generate full version if not exists
    if (!this.contentVariants.find(v => v.variant === 'full')) {
      this.contentVariants.push({
        variant: 'full',
        title: this.title,
        content: this.content || '',
        callToAction: this.requiresAcknowledgment ? {
          text: 'Acknowledge',
          action: 'acknowledge'
        } : undefined
      });
    }

    // Generate summary version
    if (!this.contentVariants.find(v => v.variant === 'summary') && this.content) {
      const summary = this.generateSummary(this.content);
      this.contentVariants.push({
        variant: 'summary',
        title: this.title,
        content: summary
      });
    }

    // Generate mobile version
    if (!this.contentVariants.find(v => v.variant === 'mobile')) {
      this.contentVariants.push({
        variant: 'mobile',
        title: this.truncateTitle(this.title, 50),
        content: this.formatForMobile(this.content || '')
      });
    }

    // Generate push notification version
    if (!this.contentVariants.find(v => v.variant === 'push')) {
      this.contentVariants.push({
        variant: 'push',
        title: this.truncateTitle(this.title, 40),
        content: this.generateSummary(this.content || '', 100)
      });
    }
  }

  private generateSummary(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    
    // Find the last sentence that fits within the limit
    const sentences = content.split(/[.!?]+/);
    let summary = '';
    
    for (const sentence of sentences) {
      const withSentence = summary + sentence + '.';
      if (withSentence.length > maxLength) break;
      summary = withSentence;
    }
    
    return summary || content.substring(0, maxLength - 3) + '...';
  }

  private truncateTitle(title: string, maxLength: number): string {
    return title.length > maxLength ? title.substring(0, maxLength - 3) + '...' : title;
  }

  private formatForMobile(content: string): string {
    // Simple mobile formatting - break long paragraphs
    return content
      .replace(/\n{3,}/g, '\n\n') // Reduce excessive line breaks
      .replace(/(.{100})/g, '$1\n') // Add line breaks for readability
      .trim();
  }

  private async calculateTargetAudience(): Promise<void> {
    // Simulate target audience calculation
    let totalRecipients = 0;

    if (this.targetAudience?.includeAll) {
      totalRecipients = 1000; // Mock: all users in system
    } else {
      // Calculate based on criteria
      const deptUsers = this.targetAudience?.departments?.length ? 
                       this.targetAudience.departments.length * 50 : 0; // Mock: 50 users per dept
      const roleUsers = this.targetAudience?.roles?.length ? 
                       this.targetAudience.roles.length * 30 : 0; // Mock: 30 users per role
      const specificUsers = this.targetAudience?.userIds?.length || 0;
      
      totalRecipients = Math.max(deptUsers, roleUsers) + specificUsers;
    }

    // Exclude blocked users
    const excludedCount = this.targetAudience?.excludeUsers?.length || 0;
    totalRecipients = Math.max(0, totalRecipients - excludedCount);

    // Initialize tracking
    if (!this.deliveryTracking) {
      this.deliveryTracking = {
        totalRecipients,
        deliveryStatuses: {
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          bounced: 0,
          unsubscribed: 0
        },
        deliveryDetails: [],
        channelPerformance: {}
      };
    } else {
      this.deliveryTracking.totalRecipients = totalRecipients;
    }
  }

  private initializeDeliveryTracking(): void {
    if (!this.deliveryTracking) {
      this.deliveryTracking = {
        totalRecipients: 0,
        deliveryStatuses: {
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          bounced: 0,
          unsubscribed: 0
        },
        deliveryDetails: [],
        channelPerformance: {}
      };
    }

    // Initialize channel performance tracking
    const channels = this.deliverySettings?.channels || ['in_app'];
    channels.forEach(channel => {
      this.deliveryTracking!.channelPerformance[channel] = {
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        deliveryRate: 0,
        readRate: 0
      };
    });
  }

  private initializeAcknowledgmentTracking(): void {
    if (!this.acknowledgmentTracking) {
      const totalRequired = this.deliveryTracking?.totalRecipients || 0;
      
      this.acknowledgmentTracking = {
        totalRequired,
        totalAcknowledged: 0,
        acknowledgmentRate: 0,
        acknowledgedUsers: [],
        pendingUsers: [], // Would be populated with actual user IDs
        reminders: []
      };
    }
  }

  private async processAutomationRules(): Promise<void> {
    if (!this.automationConfig) return;

    // Auto-publish logic
    if (this.automationConfig.autoPublish?.enabled && !this.publishedAt) {
      const shouldPublish = this.evaluateAutoPublishConditions();
      if (shouldPublish) {
        await this.publish();
      }
    }

    // Setup auto-reminders
    if (this.automationConfig.autoReminders?.enabled && this.requiresAcknowledgment) {
      this.scheduleReminders();
    }

    // Setup auto-archive
    if (this.automationConfig.autoArchive?.enabled && this.publishedAt) {
      this.scheduleAutoArchive();
    }
  }

  private evaluateAutoPublishConditions(): boolean {
    const conditions = this.automationConfig?.autoPublish?.conditions || [];
    
    return conditions.every(condition => {
      // Simplified condition evaluation
      switch (condition.field) {
        case 'effectiveDate':
          return new Date() >= (this.effectiveFrom || new Date());
        case 'urgency':
          return this.urgent === condition.value;
        default:
          return true;
      }
    });
  }

  private scheduleReminders(): void {
    // In a real implementation, this would schedule background jobs
    console.log('Reminders scheduled for acknowledgment tracking');
  }

  private scheduleAutoArchive(): void {
    if (!this.automationConfig?.autoArchive || !this.publishedAt) return;
    
    const archiveDate = new Date(this.publishedAt);
    archiveDate.setDate(archiveDate.getDate() + this.automationConfig.autoArchive.archiveAfter);
    
    this.setMetadata('autoArchiveScheduled', archiveDate.toISOString());
  }

  private updateAnnouncementSearch(): void {
    // Create enhanced searchable content for announcements
    const searchParts = [
      this.title,
      this.content || '',
      this.announcementType || '',
      this.severity || '',
      ...(this.tags || [])
    ];

    // Add content from all variants
    this.contentVariants?.forEach(variant => {
      searchParts.push(variant.title, variant.content);
    });

    const searchableContent = searchParts.join(' ').toLowerCase();

    this.searchOptimization = {
      searchableContent,
      keywords: this.extractAnnouncementKeywords(),
      categories: [this.announcementType!, this.severity!].filter(Boolean),
      indexed: false,
      searchScore: this.calculateSearchScore(),
      popularityBoost: this.urgent ? 2.0 : 1.0,
      freshnessFactor: this.calculateAnnouncementFreshness()
    };
  }

  private extractAnnouncementKeywords(): string[] {
    const content = [this.title, this.content || ''].join(' ');
    
    // Extract keywords with emphasis on announcement-specific terms
    const words = content.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Add announcement-specific keywords
    const announcementWords = [
      this.announcementType,
      this.severity,
      this.urgent ? 'urgent' : '',
      this.requiresAcknowledgment ? 'acknowledgment' : ''
    ].filter(Boolean);

    const allWords = [...words, ...announcementWords.map(w => w!.toLowerCase())];
    
    const wordFreq: Record<string, number> = {};
    allWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);
  }

  private calculateSearchScore(): number {
    let score = 50; // Base score

    // Boost based on announcement type
    switch (this.announcementType) {
      case 'emergency': score += 50; break;
      case 'urgent': score += 40; break;
      case 'system': score += 30; break;
      case 'policy': score += 25; break;
      default: score += 10;
    }

    // Boost based on severity
    switch (this.severity) {
      case 'critical': score += 40; break;
      case 'high': score += 25; break;
      case 'medium': score += 15; break;
      case 'low': score += 5; break;
    }

    // Boost for urgent announcements
    if (this.urgent) score += 30;

    // Boost for sticky announcements
    if (this.sticky) score += 20;

    return Math.min(100, score);
  }

  private calculateAnnouncementFreshness(): number {
    const now = new Date();
    const publishDate = this.publishedAt || this.createdAt;
    const daysSincePublish = (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

    // Announcements stay fresh longer than regular discussions
    if (daysSincePublish <= 1) return 1.0;
    if (daysSincePublish <= 3) return 0.95;
    if (daysSincePublish <= 7) return 0.9;
    if (daysSincePublish <= 14) return 0.8;
    if (daysSincePublish <= 30) return 0.6;
    return 0.4;
  }

  // Announcement management methods
  async publish(publishedBy?: string): Promise<void> {
    if (this.publishedAt) {
      throw new Error('Announcement is already published');
    }

    this.publishedAt = new Date();
    this.status = 'published';
    
    if (publishedBy) {
      this.setMetadata('publishedBy', publishedBy);
    }

    // Add to compliance audit trail
    this.addAuditEntry('published', publishedBy || 'system', 'Announcement published');

    // Trigger delivery
    await this.notifyParticipants('published');
  }

  private async deliverAnnouncement(): Promise<void> {
    const channels = this.deliverySettings?.channels || ['in_app'];
    const totalRecipients = this.deliveryTracking?.totalRecipients || 0;

    console.log(`Delivering announcement to ${totalRecipients} recipients via ${channels.join(', ')}`);

    // Simulate delivery process
    for (const channel of channels) {
      await this.deliverViaChannel(channel);
    }

    // Update delivery statistics
    this.updateDeliveryStatistics();
  }

  private async deliverViaChannel(channel: string): Promise<void> {
    const recipients = this.deliveryTracking?.totalRecipients || 0;
    
    // Simulate channel-specific delivery
    const deliverySuccess = Math.random() > 0.05; // 95% delivery success rate
    const readRate = Math.random() * 0.7 + 0.2; // 20-90% read rate

    if (!this.deliveryTracking?.channelPerformance) return;

    const channelStats = this.deliveryTracking.channelPerformance[channel];
    if (channelStats) {
      channelStats.sent = recipients;
      channelStats.delivered = deliverySuccess ? Math.floor(recipients * 0.95) : 0;
      channelStats.read = Math.floor(channelStats.delivered * readRate);
      channelStats.failed = recipients - channelStats.delivered;
      channelStats.deliveryRate = (channelStats.delivered / channelStats.sent) * 100;
      channelStats.readRate = channelStats.delivered > 0 ? (channelStats.read / channelStats.delivered) * 100 : 0;
    }
  }

  private updateDeliveryStatistics(): void {
    if (!this.deliveryTracking?.channelPerformance) return;

    const stats = this.deliveryTracking.deliveryStatuses;
    stats.sent = 0;
    stats.delivered = 0;
    stats.read = 0;
    stats.failed = 0;

    // Aggregate from all channels
    Object.values(this.deliveryTracking.channelPerformance).forEach(channel => {
      stats.sent += channel.sent;
      stats.delivered += channel.delivered;
      stats.read += channel.read;
      stats.failed += channel.failed;
    });

    // Initialize engagement metrics
    if (!this.engagementMetrics) {
      this.engagementMetrics = {
        opens: stats.read,
        clicks: Math.floor(stats.read * 0.3), // 30% click rate simulation
        shares: Math.floor(stats.read * 0.05), // 5% share rate
        downloads: 0,
        timeSpent: 0,
        averageReadTime: Math.floor(Math.random() * 120) + 30, // 30-150 seconds
        deviceBreakdown: {},
        locationBreakdown: {},
        timezonBreakdown: {},
        peakEngagementHours: {},
        engagementTrend: []
      };
    }
  }

  acknowledge(userId: string, channel: string = 'in_app', metadata?: Record<string, any>): boolean {
    if (!this.requiresAcknowledgment || !this.acknowledgmentTracking) {
      return false;
    }

    // Check if already acknowledged
    const existingAck = this.acknowledgmentTracking.acknowledgedUsers.find(ack => ack.userId === userId);
    if (existingAck) {
      return false; // Already acknowledged
    }

    // Add acknowledgment
    this.acknowledgmentTracking.acknowledgedUsers.push({
      userId,
      acknowledgedAt: new Date(),
      channel,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent
    });

    // Update statistics
    this.acknowledgmentTracking.totalAcknowledged++;
    this.acknowledgmentTracking.acknowledgmentRate = 
      (this.acknowledgmentTracking.totalAcknowledged / this.acknowledgmentTracking.totalRequired) * 100;

    // Remove from pending list
    const pendingIndex = this.acknowledgmentTracking.pendingUsers.indexOf(userId);
    if (pendingIndex > -1) {
      this.acknowledgmentTracking.pendingUsers.splice(pendingIndex, 1);
    }

    // Add to compliance audit trail
    this.addAuditEntry('acknowledged', userId, `User acknowledged announcement via ${channel}`);

    return true;
  }

  private async sendReminders(): Promise<void> {
    if (!this.requiresAcknowledgment || !this.acknowledgmentTracking) return;

    const pendingCount = this.acknowledgmentTracking.pendingUsers.length;
    if (pendingCount === 0) return;

    // Send reminder
    console.log(`Sending reminder to ${pendingCount} users`);

    // Track reminder
    this.acknowledgmentTracking.reminders.push({
      sentAt: new Date(),
      recipientCount: pendingCount,
      channel: 'email' // Default reminder channel
    });
  }

  private async handleEscalation(data?: Record<string, any>): Promise<void> {
    if (!this.automationConfig?.escalationWorkflow) return;

    console.log('Handling announcement escalation:', data);
    
    // Add escalation to audit trail
    this.addAuditEntry('escalated', data?.userId || 'system', 
                      `Announcement escalated: ${data?.reason || 'automatic'}`);
  }

  addFeedback(userId: string, type: NonNullable<Announcement['feedbackCollection']>['feedbackItems'][0]['type'], content?: string, rating?: number): void {
    if (!this.feedbackCollection) {
      this.feedbackCollection = {
        enabled: true,
        allowComments: true,
        allowRatings: true,
        allowSuggestions: true,
        feedbackItems: [],
        totalFeedback: 0,
        categories: {}
      };
    }

    // Add feedback item
    this.feedbackCollection.feedbackItems.push({
      userId,
      type,
      content,
      rating,
      submittedAt: new Date(),
      status: 'new'
    });

    // Update statistics
    this.feedbackCollection.totalFeedback++;
    this.feedbackCollection.categories[type] = (this.feedbackCollection.categories[type] || 0) + 1;

    // Update overall rating
    if (rating) {
      const ratings = this.feedbackCollection.feedbackItems
        .filter(item => item.rating)
        .map(item => item.rating!);
      
      this.feedbackCollection.overallRating = 
        ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }
  }

  expire(): void {
    this.expiresAt = new Date();
    this.status = 'expired';
    this.addAuditEntry('expired', 'system', 'Announcement expired');
  }

  makeSticky(): void {
    this.sticky = true;
    this.addAuditEntry('made_sticky', 'system', 'Announcement made sticky');
  }

  removeSticky(): void {
    this.sticky = false;
    this.addAuditEntry('unsticked', 'system', 'Announcement unsticked');
  }

  private addAuditEntry(action: string, userId: string, details: string): void {
    if (!this.complianceTracking) {
      this.complianceTracking = {
        regulationTypes: [],
        auditTrail: [],
        retentionPolicy: { retainFor: 365 },
        accessLog: []
      };
    }

    this.complianceTracking.auditTrail.push({
      action: action as any,
      userId,
      timestamp: new Date(),
      details
    });
  }

  // Announcement analytics and insights
  getAnnouncementAnalytics(): {
    deliveryPerformance: {
      totalReached: number;
      deliveryRate: number;
      readRate: number;
      engagementScore: number;
    };
    acknowledgmentStatus: {
      required: boolean;
      completionRate: number;
      averageTimeToAck: number; // hours
      pendingCount: number;
    };
    channelEffectiveness: Record<string, {
      deliveryRate: number;
      readRate: number;
      preferenceScore: number;
    }>;
    audienceInsights: {
      totalTargeted: number;
      reachRate: number;
      mostEngagedSegments: string[];
      leastEngagedSegments: string[];
    };
    contentPerformance: {
      overallScore: number;
      feedbackRating: number;
      improvementSuggestions: string[];
    };
  } {
    const deliveryStats = this.deliveryTracking?.deliveryStatuses || {
      sent: 0, delivered: 0, read: 0, failed: 0, bounced: 0, unsubscribed: 0
    };

    const totalReached = deliveryStats.delivered;
    const deliveryRate = deliveryStats.sent > 0 ? (deliveryStats.delivered / deliveryStats.sent) * 100 : 0;
    const readRate = deliveryStats.delivered > 0 ? (deliveryStats.read / deliveryStats.delivered) * 100 : 0;

    // Calculate engagement score
    const opens = this.engagementMetrics?.opens || 0;
    const clicks = this.engagementMetrics?.clicks || 0;
    const shares = this.engagementMetrics?.shares || 0;
    const engagementScore = totalReached > 0 ? ((opens + clicks * 2 + shares * 3) / totalReached) * 10 : 0;

    // Acknowledgment analytics
    const ackTracking = this.acknowledgmentTracking;
    const ackRequired = this.requiresAcknowledgment;
    const completionRate = ackRequired && ackTracking ? ackTracking.acknowledgmentRate : 100;
    
    let averageTimeToAck = 0;
    if (ackTracking && ackTracking.acknowledgedUsers.length > 0) {
      const totalTime = ackTracking.acknowledgedUsers.reduce((sum, ack) => {
        const timeDiff = (ack.acknowledgedAt.getTime() - (this.publishedAt || this.createdAt).getTime()) / (1000 * 60 * 60); // hours
        return sum + timeDiff;
      }, 0);
      averageTimeToAck = totalTime / ackTracking.acknowledgedUsers.length;
    }

    // Channel effectiveness
    const channelEffectiveness: Record<string, any> = {};
    Object.entries(this.deliveryTracking?.channelPerformance || {}).forEach(([channel, stats]) => {
      channelEffectiveness[channel] = {
        deliveryRate: stats.deliveryRate,
        readRate: stats.readRate,
        preferenceScore: (stats.deliveryRate * 0.4 + stats.readRate * 0.6) // Weighted score
      };
    });

    return {
      deliveryPerformance: {
        totalReached,
        deliveryRate,
        readRate,
        engagementScore: Math.min(100, engagementScore)
      },
      acknowledgmentStatus: {
        required: ackRequired,
        completionRate,
        averageTimeToAck,
        pendingCount: ackTracking?.pendingUsers.length || 0
      },
      channelEffectiveness,
      audienceInsights: {
        totalTargeted: this.deliveryTracking?.totalRecipients || 0,
        reachRate: deliveryRate,
        mostEngagedSegments: ['Engineering', 'Product'], // Mock data
        leastEngagedSegments: ['Sales', 'Marketing'] // Mock data
      },
      contentPerformance: {
        overallScore: Math.min(100, deliveryRate * 0.3 + readRate * 0.4 + completionRate * 0.3),
        feedbackRating: this.feedbackCollection?.overallRating || 0,
        improvementSuggestions: this.generateImprovementSuggestions()
      }
    };
  }

  private generateImprovementSuggestions(): string[] {
    const suggestions: string[] = [];
    const analytics = this.getAnnouncementAnalytics();

    if (analytics.deliveryPerformance.deliveryRate < 90) {
      suggestions.push('Improve email deliverability by updating sender reputation');
    }

    if (analytics.deliveryPerformance.readRate < 60) {
      suggestions.push('Make subject lines more compelling to increase open rates');
    }

    if (this.requiresAcknowledgment && analytics.acknowledgmentStatus.completionRate < 80) {
      suggestions.push('Add more prominent call-to-action for acknowledgments');
    }

    if (analytics.contentPerformance.feedbackRating < 4) {
      suggestions.push('Simplify content and focus on key messages');
    }

    return suggestions;
  }

  isPublished(): boolean {
    return !!this.publishedAt && this.status === 'published';
  }

  isExpired(): boolean {
    return !!this.expiresAt && new Date() > this.expiresAt;
  }

  isEffective(): boolean {
    return !this.effectiveFrom || new Date() >= this.effectiveFrom;
  }

  needsAcknowledgment(): boolean {
    return this.requiresAcknowledgment && this.isPublished();
  }

  isFullyAcknowledged(): boolean {
    if (!this.requiresAcknowledgment) return true;
    return this.acknowledgmentTracking?.acknowledgmentRate === 100;
  }

  getAcknowledgmentProgress(): { completed: number; total: number; percentage: number } {
    if (!this.requiresAcknowledgment || !this.acknowledgmentTracking) {
      return { completed: 0, total: 0, percentage: 100 };
    }

    return {
      completed: this.acknowledgmentTracking.totalAcknowledged,
      total: this.acknowledgmentTracking.totalRequired,
      percentage: this.acknowledgmentTracking.acknowledgmentRate
    };
  }

  requiresUrgentAttention(): boolean {
    return this.urgent || 
           this.severity === 'critical' || 
           this.announcementType === 'emergency' ||
           (this.requiresAcknowledgment && 
            this.acknowledgmentTracking && 
            this.acknowledgmentTracking.acknowledgmentRate < 50 &&
            this.acknowledgmentTracking.deadline &&
            new Date() > new Date(this.acknowledgmentTracking.deadline.getTime() - 24 * 60 * 60 * 1000)); // 24 hours before deadline
  }
}