import { Entity, Property } from '@mikro-orm/core';
import { DiscussionArchetype } from '../archetypes/DiscussionArchetype.js';

/**
 * Thread discussion with linear conversation flow and messaging features
 * Extends DiscussionArchetype with thread-specific functionality
 */
@Entity({ tableName: 'thread' })
export class Thread extends DiscussionArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'thread_type' })
  threadType?: 'chat' | 'conversation' | 'support_ticket' | 'collaboration' | 'notification' | 'broadcast';

  @Property({ type: 'string', nullable: true, fieldName: 'channel_id' })
  channelId?: string;

  @Property({ type: 'integer', default: 0, fieldName: 'message_count' })
  messageCount!: number;

  @Property({ type: 'uuid', nullable: true, fieldName: 'starter_message_id' })
  starterMessageId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'last_message_id' })
  lastMessageId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'last_read_at' })
  lastReadAt?: Date;

  @Property({ type: 'json', nullable: true, fieldName: 'thread_settings' })
  threadSettings?: {
    allowReplies?: boolean;
    allowReactions?: boolean;
    allowFileSharing?: boolean;
    allowForwarding?: boolean;
    allowEditing?: boolean;
    allowDeletion?: boolean;
    messageRetention?: number; // days
    maxMessageLength?: number;
    slowMode?: boolean;
    slowModeDelay?: number; // seconds
    requireApproval?: boolean;
    allowBots?: boolean;
    allowExternalLinks?: boolean;
  };

  @Property({ type: 'json', nullable: true })
  messages?: Array<{
    id: string;
    authorId: string;
    content: string;
    messageType: 'text' | 'image' | 'file' | 'video' | 'audio' | 'link' | 'system' | 'bot';
    timestamp: Date;
    editedAt?: Date;
    deletedAt?: Date;
    replyToMessageId?: string;
    forwardedFrom?: {
      threadId: string;
      messageId: string;
      originalAuthor: string;
    };
    attachments?: Array<{
      id: string;
      filename: string;
      size: number;
      mimeType: string;
      url: string;
      thumbnailUrl?: string;
    }>;
    mentions?: Array<{
      userId: string;
      displayName: string;
      type: 'user' | 'everyone' | 'here' | 'role';
    }>;
    reactions?: Array<{
      emoji: string;
      users: Array<{
        userId: string;
        timestamp: Date;
      }>;
      count: number;
    }>;
    readBy?: Array<{
      userId: string;
      readAt: Date;
    }>;
    deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    metadata?: Record<string, any>;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'read_states' })
  readStates?: Array<{
    userId: string;
    lastReadMessageId: string;
    lastReadAt: Date;
    unreadCount: number;
    mentionCount: number;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'typing_indicators' })
  typingIndicators?: Array<{
    userId: string;
    startedAt: Date;
    expiresAt: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'message_search' })
  messageSearch?: {
    indexedMessages: number;
    lastIndexed: Date;
    searchableContent: string;
    popularTerms: Array<{
      term: string;
      frequency: number;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'thread_analytics' })
  threadAnalytics?: {
    messageFrequency: Record<string, number>; // hour -> message count
    activeTimeframes: Array<{
      start: Date;
      end: Date;
      messageCount: number;
      participantCount: number;
    }>;
    responsePatterns: {
      averageResponseTime: number; // minutes
      quickResponses: number; // < 5 minutes
      mediumResponses: number; // 5-60 minutes
      slowResponses: number; // > 60 minutes
    };
    participantEngagement: Array<{
      userId: string;
      messageCount: number;
      reactionCount: number;
      mentionCount: number;
      lastActive: Date;
      engagementScore: number;
    }>;
    contentAnalysis: {
      avgMessageLength: number;
      mediaShareCount: number;
      linkShareCount: number;
      questionCount: number;
      exclamationCount: number;
      sentimentTrend: Array<{
        date: Date;
        sentiment: 'positive' | 'neutral' | 'negative';
        confidence: number;
      }>;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'automation_rules' })
  automationRules?: Array<{
    id: string;
    name: string;
    trigger: 'message_received' | 'user_joined' | 'keyword_detected' | 'time_based' | 'reaction_added';
    conditions: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'starts_with' | 'regex' | 'greater_than';
      value: any;
    }>;
    actions: Array<{
      type: 'send_message' | 'add_reaction' | 'notify_moderator' | 'archive_thread' | 'forward_message';
      parameters: Record<string, any>;
    }>;
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'integration_data' })
  integrationData?: {
    slack?: {
      channelId: string;
      teamId: string;
      synced: boolean;
      lastSync: Date;
      webhook?: string;
    };
    teams?: {
      channelId: string;
      teamId: string;
      synced: boolean;
      webhook?: string;
    };
    discord?: {
      channelId: string;
      guildId: string;
      synced: boolean;
      webhook?: string;
    };
    email?: {
      threadId: string;
      subject: string;
      participants: string[];
      lastEmailSync: Date;
    };
    jira?: {
      issueKey: string;
      projectKey: string;
      linked: boolean;
      autoUpdate: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'security_settings' })
  securitySettings?: {
    encryptionEnabled: boolean;
    endToEndEncryption: boolean;
    messageRetentionPolicy: 'forever' | 'days' | 'months' | 'years';
    retentionPeriod?: number;
    autoDeleteEnabled: boolean;
    allowScreenshots: boolean;
    allowCopyPaste: boolean;
    watermarkMessages: boolean;
    auditLogEnabled: boolean;
    complianceMode: boolean;
    dlpRules?: Array<{
      pattern: string;
      action: 'warn' | 'block' | 'redact';
      description: string;
    }>;
  };

  // Implementation of abstract methods
  getDiscussionType(): string {
    return 'thread';
  }

  async validateDiscussionRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Thread specific validation
    if (!this.threadType) {
      return false; // Thread type is required
    }

    // Validate message count consistency
    const actualMessageCount = this.messages?.length || 0;
    if (this.messageCount !== actualMessageCount) {
      return false; // Message count mismatch
    }

    // Validate security settings
    if (this.securitySettings?.encryptionEnabled && !this.securitySettings.endToEndEncryption) {
      // Ensure proper encryption configuration
      return true; // Allow server-side encryption without E2E
    }

    return true;
  }

  async processContent(): Promise<void> {
    try {
      // Process all messages for content analysis
      await this.analyzeThreadContent();
      
      // Update thread statistics
      this.updateThreadStatistics();
      
      // Process automation rules
      await this.processAutomationRules();
      
      // Update search index
      this.updateMessageSearch();
      
      // Clean up old data based on retention policy
      await this.applyRetentionPolicy();
      
    } catch (error) {
      console.error('Thread content processing error:', error);
    }
  }

  async notifyParticipants(event: string, data?: Record<string, any>): Promise<void> {
    if (!this.participants) return;

    const notifications: Array<{
      userId: string;
      type: string;
      message: string;
      priority: 'low' | 'normal' | 'high';
      data: Record<string, any>;
    }> = [];

    for (const participant of this.participants) {
      // Skip notification for the user who triggered the event
      if (data?.authorId && participant.userId === data.authorId) continue;

      // Determine notification priority
      let priority: 'low' | 'normal' | 'high' = 'normal';
      
      if (event === 'mention' || data?.mentions?.some((m: any) => m.userId === participant.userId)) {
        priority = 'high';
      } else if (event === 'urgent_message' || data?.priority === 'urgent') {
        priority = 'high';
      } else if (this.threadType === 'notification' || this.threadType === 'broadcast') {
        priority = 'normal';
      } else {
        priority = 'low';
      }

      notifications.push({
        userId: participant.userId,
        type: event,
        message: this.generateThreadNotificationMessage(event, data),
        priority,
        data: { threadId: this.id, ...data }
      });
    }

    // In a real implementation, this would send actual notifications
    console.log(`Sending ${notifications.length} thread notifications for event: ${event}`);
  }

  // Thread-specific business logic
  private async analyzeThreadContent(): Promise<void> {
    if (!this.messages || this.messages.length === 0) return;

    // Analyze message patterns and content
    const totalWords = this.messages.reduce((sum, msg) => 
      sum + (msg.content ? msg.content.split(/\s+/).length : 0), 0
    );

    const mediaCount = this.messages.filter(msg => 
      msg.messageType === 'image' || msg.messageType === 'video' || msg.messageType === 'file'
    ).length;

    const linkCount = this.messages.filter(msg => 
      msg.content && /https?:\/\/[^\s]+/.test(msg.content)
    ).length;

    const questionCount = this.messages.filter(msg => 
      msg.content && msg.content.includes('?')
    ).length;

    // Update content analysis
    this.contentAnalysis = {
      ...this.contentAnalysis,
      wordCount: totalWords,
      sentiment: this.calculateOverallSentiment(),
      keywords: this.extractThreadKeywords(),
      mentions: this.extractAllMentions(),
      lastAnalyzed: new Date()
    };

    // Update thread analytics
    if (!this.threadAnalytics) {
      this.threadAnalytics = {
        messageFrequency: {},
        activeTimeframes: [],
        responsePatterns: {
          averageResponseTime: 0,
          quickResponses: 0,
          mediumResponses: 0,
          slowResponses: 0
        },
        participantEngagement: [],
        contentAnalysis: {
          avgMessageLength: 0,
          mediaShareCount: 0,
          linkShareCount: 0,
          questionCount: 0,
          exclamationCount: 0,
          sentimentTrend: []
        }
      };
    }

    this.threadAnalytics.contentAnalysis = {
      avgMessageLength: this.messages.length > 0 ? totalWords / this.messages.length : 0,
      mediaShareCount: mediaCount,
      linkShareCount: linkCount,
      questionCount,
      exclamationCount: this.messages.filter(msg => msg.content && msg.content.includes('!')).length,
      sentimentTrend: this.calculateSentimentTrend()
    };
  }

  private calculateOverallSentiment(): 'positive' | 'neutral' | 'negative' {
    if (!this.messages) return 'neutral';

    // Simple sentiment analysis simulation
    let positiveScore = 0;
    let negativeScore = 0;

    this.messages.forEach(msg => {
      if (msg.content) {
        const positiveWords = ['good', 'great', 'excellent', 'awesome', 'perfect', 'love', 'like', 'yes', 'thanks'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'no', 'problem', 'issue', 'error'];
        
        const content = msg.content.toLowerCase();
        positiveWords.forEach(word => {
          if (content.includes(word)) positiveScore++;
        });
        negativeWords.forEach(word => {
          if (content.includes(word)) negativeScore++;
        });
      }
    });

    if (positiveScore > negativeScore * 1.2) return 'positive';
    if (negativeScore > positiveScore * 1.2) return 'negative';
    return 'neutral';
  }

  private extractThreadKeywords(): string[] {
    if (!this.messages) return [];

    const allText = this.messages
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordFreq: Record<string, number> = {};
    allText.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractAllMentions(): NonNullable<NonNullable<Thread['contentAnalysis']>['mentions']> {
    if (!this.messages) return [];

    const allMentions: NonNullable<NonNullable<Thread['contentAnalysis']>['mentions']> = [];
    
    this.messages.forEach((msg, index) => {
      if (msg.mentions) {
        msg.mentions.forEach(mention => {
          allMentions.push({
            userId: mention.userId,
            position: index,
            context: msg.content?.substring(0, 100) || ''
          });
        });
      }
    });

    return allMentions;
  }

  private calculateSentimentTrend(): NonNullable<NonNullable<Thread['threadAnalytics']>['contentAnalysis']['sentimentTrend']> {
    // Group messages by day and calculate daily sentiment
    const dailySentiments: Record<string, { positive: number; negative: number; neutral: number }> = {};

    this.messages?.forEach(msg => {
      const date = msg.timestamp.toISOString().split('T')[0];
      if (!dailySentiments[date]) {
        dailySentiments[date] = { positive: 0, negative: 0, neutral: 0 };
      }

      // Simple sentiment classification
      const sentiment = this.classifyMessageSentiment(msg.content || '');
      dailySentiments[date][sentiment]++;
    });

    return Object.entries(dailySentiments).map(([dateStr, sentiments]) => {
      const total = sentiments.positive + sentiments.negative + sentiments.neutral;
      const maxSentiment = Math.max(sentiments.positive, sentiments.negative, sentiments.neutral);
      
      let overallSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      let confidence = 0;

      if (maxSentiment === sentiments.positive) {
        overallSentiment = 'positive';
        confidence = sentiments.positive / total;
      } else if (maxSentiment === sentiments.negative) {
        overallSentiment = 'negative';
        confidence = sentiments.negative / total;
      } else {
        overallSentiment = 'neutral';
        confidence = sentiments.neutral / total;
      }

      return {
        date: new Date(dateStr),
        sentiment: overallSentiment,
        confidence
      };
    });
  }

  private classifyMessageSentiment(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'perfect', 'love', 'like', 'yes', 'thanks'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'no', 'problem', 'issue', 'error'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.reduce((count, word) => 
      count + (lowerContent.includes(word) ? 1 : 0), 0
    );
    const negativeCount = negativeWords.reduce((count, word) => 
      count + (lowerContent.includes(word) ? 1 : 0), 0
    );

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private updateThreadStatistics(): void {
    this.messageCount = this.messages?.length || 0;
    
    if (this.messages && this.messages.length > 0) {
      const lastMessage = this.messages[this.messages.length - 1];
      this.lastMessageId = lastMessage.id;
      this.lastActivity = lastMessage.timestamp;
      
      if (!this.starterMessageId && this.messages.length > 0) {
        this.starterMessageId = this.messages[0].id;
      }
    }

    // Update base statistics
    if (!this.statistics) {
      this.statistics = {};
    }

    this.statistics.messageCount = this.messageCount;
    this.statistics.participantCount = this.getUniqueParticipantCount();
    this.statistics.reactionCount = this.getTotalReactionCount();
  }

  private getUniqueParticipantCount(): number {
    if (!this.messages) return 0;
    const uniqueUsers = new Set(this.messages.map(msg => msg.authorId));
    return uniqueUsers.size;
  }

  private getTotalReactionCount(): number {
    return this.messages?.reduce((total, msg) => 
      total + (msg.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) || 0), 0
    ) || 0;
  }

  private async processAutomationRules(): Promise<void> {
    if (!this.automationRules || !this.messages) return;

    const activeRules = this.automationRules.filter(rule => rule.enabled);
    const lastMessage = this.messages[this.messages.length - 1];

    for (const rule of activeRules) {
      if (rule.trigger === 'message_received' && lastMessage) {
        const conditionsMet = rule.conditions.every(condition => 
          this.evaluateCondition(condition, lastMessage)
        );

        if (conditionsMet) {
          await this.executeRuleActions(rule, lastMessage);
          rule.lastTriggered = new Date();
          rule.triggerCount++;
        }
      }
    }
  }

  private evaluateCondition(condition: any, message: NonNullable<Thread['messages']>[0]): boolean {
    const { field, operator, value } = condition;
    let fieldValue: any;

    // Get field value from message
    switch (field) {
      case 'content':
        fieldValue = message.content;
        break;
      case 'authorId':
        fieldValue = message.authorId;
        break;
      case 'messageType':
        fieldValue = message.messageType;
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);
      case 'starts_with':
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);
      case 'regex':
        return new RegExp(value).test(fieldValue);
      default:
        return false;
    }
  }

  private async executeRuleActions(rule: any, message: NonNullable<Thread['messages']>[0]): Promise<void> {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'send_message':
          this.addSystemMessage(action.parameters.content);
          break;
        case 'add_reaction':
          this.addReactionToMessage(message.id, action.parameters.emoji, 'system');
          break;
        case 'notify_moderator':
          console.log(`Moderator notification: ${action.parameters.message}`);
          break;
      }
    }
  }

  private updateMessageSearch(): void {
    if (!this.messages) return;

    const searchableContent = this.messages
      .map(msg => msg.content)
      .filter(content => content)
      .join(' ')
      .toLowerCase();

    const words = searchableContent.split(/\s+/).filter(word => word.length > 2);
    const termFreq: Record<string, number> = {};
    
    words.forEach(word => {
      termFreq[word] = (termFreq[word] || 0) + 1;
    });

    this.messageSearch = {
      indexedMessages: this.messages.length,
      lastIndexed: new Date(),
      searchableContent,
      popularTerms: Object.entries(termFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([term, frequency]) => ({ term, frequency }))
    };
  }

  private async applyRetentionPolicy(): Promise<void> {
    if (!this.securitySettings?.messageRetentionPolicy || !this.messages) return;

    const { messageRetentionPolicy, retentionPeriod } = this.securitySettings;
    
    if (messageRetentionPolicy === 'forever' || !retentionPeriod) return;

    const now = new Date();
    const cutoffTime = new Date();

    switch (messageRetentionPolicy) {
      case 'days':
        cutoffTime.setDate(now.getDate() - retentionPeriod);
        break;
      case 'months':
        cutoffTime.setMonth(now.getMonth() - retentionPeriod);
        break;
      case 'years':
        cutoffTime.setFullYear(now.getFullYear() - retentionPeriod);
        break;
    }

    // Mark old messages as deleted
    this.messages.forEach(msg => {
      if (msg.timestamp < cutoffTime && !msg.deletedAt) {
        msg.deletedAt = new Date();
        msg.content = '[Message deleted due to retention policy]';
      }
    });
  }

  private generateThreadNotificationMessage(event: string, data?: Record<string, any>): string {
    switch (event) {
      case 'new_message':
        return `New message in ${this.title}`;
      case 'mention':
        return `You were mentioned in ${this.title}`;
      case 'reply':
        return `Someone replied to your message in ${this.title}`;
      case 'reaction':
        return `Someone reacted to your message in ${this.title}`;
      case 'urgent_message':
        return `🚨 Urgent message in ${this.title}`;
      default:
        return `Activity in ${this.title}`;
    }
  }

  // Thread management methods
  sendMessage(authorId: string, content: string, messageType: NonNullable<Thread['messages']>[0]['messageType'] = 'text', options?: {
    replyToMessageId?: string;
    priority?: NonNullable<Thread['messages']>[0]['priority'];
    attachments?: NonNullable<Thread['messages']>[0]['attachments'];
  }): string {
    // Check slow mode
    if (this.threadSettings?.slowMode && this.threadSettings.slowModeDelay) {
      const lastUserMessage = this.messages?.find(msg => msg.authorId === authorId);
      if (lastUserMessage) {
        const timeSinceLastMessage = (new Date().getTime() - lastUserMessage.timestamp.getTime()) / 1000;
        if (timeSinceLastMessage < this.threadSettings.slowModeDelay) {
          throw new Error(`Slow mode active. Please wait ${this.threadSettings.slowModeDelay - timeSinceLastMessage} seconds`);
        }
      }
    }

    // Check message length limit
    if (this.threadSettings?.maxMessageLength && content.length > this.threadSettings.maxMessageLength) {
      throw new Error(`Message too long. Maximum ${this.threadSettings.maxMessageLength} characters allowed`);
    }

    if (!this.messages) {
      this.messages = [];
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const message: NonNullable<Thread['messages']>[0] = {
      id: messageId,
      authorId,
      content,
      messageType,
      timestamp: new Date(),
      replyToMessageId: options?.replyToMessageId,
      priority: options?.priority || 'normal',
      attachments: options?.attachments,
      mentions: this.extractMentionsFromContent(content),
      reactions: [],
      readBy: [{ userId: authorId, readAt: new Date() }],
      deliveryStatus: 'sent'
    };

    this.messages.push(message);
    this.updateThreadStatistics();
    this.incrementMessageCount();

    // Clear typing indicators for this user
    this.clearTypingIndicator(authorId);

    // Notify participants
    this.notifyParticipants('new_message', { 
      messageId, 
      authorId, 
      mentions: message.mentions,
      priority: message.priority 
    });

    return messageId;
  }

  private extractMentionsFromContent(content: string): NonNullable<Thread['messages']>[0]['mentions'] {
    const mentions: NonNullable<Thread['messages']>[0]['mentions'] = [];
    
    // Extract @username mentions
    const userMentions = content.match(/@(\w+)/g);
    if (userMentions) {
      userMentions.forEach(mention => {
        const username = mention.substring(1);
        mentions.push({
          userId: username, // In real implementation, resolve username to userId
          displayName: username,
          type: 'user'
        });
      });
    }

    // Extract @everyone and @here
    if (content.includes('@everyone')) {
      mentions.push({ userId: 'everyone', displayName: 'everyone', type: 'everyone' });
    }
    if (content.includes('@here')) {
      mentions.push({ userId: 'here', displayName: 'here', type: 'here' });
    }

    return mentions;
  }

  editMessage(messageId: string, newContent: string, editorId: string): boolean {
    if (!this.threadSettings?.allowEditing) return false;

    const message = this.messages?.find(msg => msg.id === messageId);
    if (!message) return false;

    // Check permissions
    if (message.authorId !== editorId && !this.canUserModerate(editorId)) {
      return false;
    }

    message.content = newContent;
    message.editedAt = new Date();
    message.mentions = this.extractMentionsFromContent(newContent);

    return true;
  }

  deleteMessage(messageId: string, deleterId: string): boolean {
    if (!this.threadSettings?.allowDeletion) return false;

    const message = this.messages?.find(msg => msg.id === messageId);
    if (!message) return false;

    // Check permissions
    if (message.authorId !== deleterId && !this.canUserModerate(deleterId)) {
      return false;
    }

    message.deletedAt = new Date();
    message.content = '[This message was deleted]';

    this.updateThreadStatistics();
    return true;
  }

  addReactionToMessage(messageId: string, emoji: string, userId: string): boolean {
    if (!this.threadSettings?.allowReactions) return false;

    const message = this.messages?.find(msg => msg.id === messageId);
    if (!message) return false;

    if (!message.reactions) {
      message.reactions = [];
    }

    // Find or create reaction
    let reaction = message.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, users: [], count: 0 };
      message.reactions.push(reaction);
    }

    // Check if user already reacted
    const existingUser = reaction.users.find(u => u.userId === userId);
    if (existingUser) {
      return false; // User already reacted with this emoji
    }

    // Add user reaction
    reaction.users.push({ userId, timestamp: new Date() });
    reaction.count++;

    // Notify message author
    if (message.authorId !== userId) {
      this.notifyParticipants('reaction', { messageId, emoji, userId });
    }

    return true;
  }

  removeReactionFromMessage(messageId: string, emoji: string, userId: string): boolean {
    const message = this.messages?.find(msg => msg.id === messageId);
    if (!message || !message.reactions) return false;

    const reaction = message.reactions.find(r => r.emoji === emoji);
    if (!reaction) return false;

    const userIndex = reaction.users.findIndex(u => u.userId === userId);
    if (userIndex === -1) return false;

    // Remove user reaction
    reaction.users.splice(userIndex, 1);
    reaction.count--;

    // Remove reaction if no users left
    if (reaction.count === 0) {
      const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
      message.reactions.splice(reactionIndex, 1);
    }

    return true;
  }

  markAsRead(userId: string, messageId?: string): void {
    // Update read state for user
    if (!this.readStates) {
      this.readStates = [];
    }

    let readState = this.readStates.find(rs => rs.userId === userId);
    if (!readState) {
      readState = {
        userId,
        lastReadMessageId: '',
        lastReadAt: new Date(),
        unreadCount: 0,
        mentionCount: 0
      };
      this.readStates.push(readState);
    }

    // Update read state
    const targetMessageId = messageId || this.lastMessageId;
    if (targetMessageId) {
      readState.lastReadMessageId = targetMessageId;
      readState.lastReadAt = new Date();
      readState.unreadCount = this.calculateUnreadCount(userId, targetMessageId);
      readState.mentionCount = this.calculateUnreadMentionCount(userId, targetMessageId);
    }

    // Mark specific message as read
    if (messageId) {
      const message = this.messages?.find(msg => msg.id === messageId);
      if (message) {
        if (!message.readBy) {
          message.readBy = [];
        }
        
        const existingRead = message.readBy.find(r => r.userId === userId);
        if (!existingRead) {
          message.readBy.push({ userId, readAt: new Date() });
        }
      }
    }
  }

  private calculateUnreadCount(userId: string, lastReadMessageId: string): number {
    if (!this.messages) return 0;

    const lastReadIndex = this.messages.findIndex(msg => msg.id === lastReadMessageId);
    if (lastReadIndex === -1) return this.messages.length;

    return this.messages.length - lastReadIndex - 1;
  }

  private calculateUnreadMentionCount(userId: string, lastReadMessageId: string): number {
    if (!this.messages) return 0;

    const lastReadIndex = this.messages.findIndex(msg => msg.id === lastReadMessageId);
    const unreadMessages = lastReadIndex === -1 ? this.messages : this.messages.slice(lastReadIndex + 1);

    return unreadMessages.filter(msg => 
      msg.mentions?.some(mention => 
        mention.userId === userId || 
        mention.type === 'everyone' || 
        mention.type === 'here'
      )
    ).length;
  }

  setTypingIndicator(userId: string): void {
    if (!this.typingIndicators) {
      this.typingIndicators = [];
    }

    // Remove existing indicator for user
    this.typingIndicators = this.typingIndicators.filter(ti => ti.userId !== userId);

    // Add new indicator
    this.typingIndicators.push({
      userId,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000) // 10 seconds
    });

    // Clean up expired indicators
    const now = new Date();
    this.typingIndicators = this.typingIndicators.filter(ti => ti.expiresAt > now);
  }

  clearTypingIndicator(userId: string): void {
    if (!this.typingIndicators) return;
    
    this.typingIndicators = this.typingIndicators.filter(ti => ti.userId !== userId);
  }

  getTypingUsers(): string[] {
    if (!this.typingIndicators) return [];

    const now = new Date();
    return this.typingIndicators
      .filter(ti => ti.expiresAt > now)
      .map(ti => ti.userId);
  }

  addSystemMessage(content: string): string {
    return this.sendMessage('system', content, 'system');
  }

  forwardMessage(messageId: string, fromThreadId: string, forwarderId: string): string {
    const sourceMessage = this.messages?.find(msg => msg.id === messageId);
    if (!sourceMessage) {
      throw new Error('Source message not found');
    }

    if (!this.threadSettings?.allowForwarding) {
      throw new Error('Message forwarding is not allowed in this thread');
    }

    const forwardedMessageId = this.sendMessage(
      forwarderId,
      `Forwarded: ${sourceMessage.content}`,
      sourceMessage.messageType,
      {
        attachments: sourceMessage.attachments
      }
    );

    // Update forwarded message with source info
    const forwardedMessage = this.messages?.find(msg => msg.id === forwardedMessageId);
    if (forwardedMessage) {
      forwardedMessage.forwardedFrom = {
        threadId: fromThreadId,
        messageId: sourceMessage.id,
        originalAuthor: sourceMessage.authorId
      };
    }

    return forwardedMessageId;
  }

  // Thread analytics and insights
  getThreadInsights(): {
    activityLevel: 'low' | 'medium' | 'high';
    responseTime: number;
    participantEngagement: Array<{ userId: string; score: number }>;
    contentBreakdown: Record<string, number>;
    peakActivityHours: string[];
    sentimentTrend: 'improving' | 'stable' | 'declining';
  } {
    const messages = this.messages || [];
    const totalMessages = messages.length;

    // Activity level
    const recentMessages = messages.filter(msg => {
      const hoursSinceMessage = (new Date().getTime() - msg.timestamp.getTime()) / (1000 * 60 * 60);
      return hoursSinceMessage <= 24;
    }).length;

    let activityLevel: 'low' | 'medium' | 'high' = 'low';
    if (recentMessages > 50) activityLevel = 'high';
    else if (recentMessages > 10) activityLevel = 'medium';

    // Response time calculation
    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const currentMsg = messages[i];
      const previousMsg = messages[i - 1];
      
      if (currentMsg.authorId !== previousMsg.authorId) {
        const responseTime = (currentMsg.timestamp.getTime() - previousMsg.timestamp.getTime()) / (1000 * 60); // minutes
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    // Participant engagement
    const userStats: Record<string, { messages: number; reactions: number }> = {};
    messages.forEach(msg => {
      const userId = msg.authorId;
      if (!userStats[userId]) {
        userStats[userId] = { messages: 0, reactions: 0 };
      }
      userStats[userId].messages++;
      userStats[userId].reactions += msg.reactions?.reduce((sum, r) => sum + r.count, 0) || 0;
    });

    const participantEngagement = Object.entries(userStats).map(([userId, stats]) => ({
      userId,
      score: stats.messages * 2 + stats.reactions
    })).sort((a, b) => b.score - a.score);

    // Content breakdown
    const contentBreakdown: Record<string, number> = {
      text: messages.filter(msg => msg.messageType === 'text').length,
      image: messages.filter(msg => msg.messageType === 'image').length,
      file: messages.filter(msg => msg.messageType === 'file').length,
      video: messages.filter(msg => msg.messageType === 'video').length,
      audio: messages.filter(msg => msg.messageType === 'audio').length,
      link: messages.filter(msg => msg.messageType === 'link').length,
      system: messages.filter(msg => msg.messageType === 'system').length
    };

    // Peak activity hours
    const hourlyActivity: Record<string, number> = {};
    messages.forEach(msg => {
      const hour = msg.timestamp.getHours().toString();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    const peakActivityHours = Object.entries(hourlyActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    // Sentiment trend (simplified)
    const sentimentTrend = this.threadAnalytics?.contentAnalysis?.sentimentTrend || [];
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (sentimentTrend.length >= 2) {
      const recent = sentimentTrend[sentimentTrend.length - 1];
      const previous = sentimentTrend[sentimentTrend.length - 2];
      
      if (recent.sentiment === 'positive' && previous.sentiment !== 'positive') {
        trend = 'improving';
      } else if (recent.sentiment === 'negative' && previous.sentiment !== 'negative') {
        trend = 'declining';
      }
    }

    return {
      activityLevel,
      responseTime: averageResponseTime,
      participantEngagement,
      contentBreakdown,
      peakActivityHours,
      sentimentTrend: trend
    };
  }

  isActiveConversation(): boolean {
    if (!this.messages || this.messages.length === 0) return false;

    const lastMessage = this.messages[this.messages.length - 1];
    const hoursSinceLastMessage = (new Date().getTime() - lastMessage.timestamp.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastMessage <= 24 && this.messages.length >= 5;
  }

  hasUnreadMessages(userId: string): boolean {
    const readState = this.readStates?.find(rs => rs.userId === userId);
    return !readState || readState.unreadCount > 0;
  }

  getUnreadCount(userId: string): number {
    const readState = this.readStates?.find(rs => rs.userId === userId);
    return readState?.unreadCount || 0;
  }

  hasUnreadMentions(userId: string): boolean {
    const readState = this.readStates?.find(rs => rs.userId === userId);
    return !readState || readState.mentionCount > 0;
  }
}