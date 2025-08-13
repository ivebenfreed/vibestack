import { Entity, Property } from '@mikro-orm/core';
import { DiscussionArchetype } from '../archetypes/DiscussionArchetype.js';

/**
 * Forum discussion with community features and topic organization
 * Extends DiscussionArchetype with forum-specific functionality
 */
@Entity({ tableName: 'forum' })
export class Forum extends DiscussionArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'forum_category' })
  forumCategory?: 'general' | 'technical' | 'support' | 'announcements' | 'feedback' | 'off_topic' | 'showcase' | 'qa';

  @Property({ type: 'string', nullable: true, fieldName: 'topic_type' })
  topicType?: 'discussion' | 'question' | 'poll' | 'announcement' | 'tutorial' | 'showcase' | 'help_request';

  @Property({ type: 'integer', default: 0, fieldName: 'post_count' })
  postCount!: number;

  @Property({ type: 'integer', default: 0, fieldName: 'view_count' })
  viewCount!: number;

  @Property({ type: 'uuid', nullable: true, fieldName: 'last_poster_id' })
  lastPosterId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'last_post_at' })
  lastPostAt?: Date;

  @Property({ type: 'json', nullable: true, fieldName: 'forum_settings' })
  forumSettings?: {
    allowPolls?: boolean;
    allowAttachments?: boolean;
    requireModeration?: boolean;
    allowAnonymousPosts?: boolean;
    allowGuestViewing?: boolean;
    enableVoting?: boolean;
    enableBestAnswer?: boolean;
    autoCloseAfterDays?: number;
    maxPostsPerUser?: number;
    slowModeSeconds?: number;
  };

  @Property({ type: 'json', nullable: true })
  posts?: Array<{
    id: string;
    authorId: string;
    content: string;
    postNumber: number;
    createdAt: Date;
    editedAt?: Date;
    editedBy?: string;
    deletedAt?: Date;
    deletedBy?: string;
    parentPostId?: string; // For threaded replies
    reactions?: Array<{
      type: string;
      userId: string;
      timestamp: Date;
    }>;
    attachments?: Array<{
      fileId: string;
      filename: string;
      size: number;
      mimeType: string;
    }>;
    mentions?: string[];
    quoted?: boolean;
    quotedPostId?: string;
    moderationStatus?: 'approved' | 'pending' | 'rejected' | 'flagged';
  }>;

  @Property({ type: 'json', nullable: true })
  polls?: Array<{
    id: string;
    question: string;
    options: Array<{
      id: string;
      text: string;
      votes: number;
      voters: string[];
    }>;
    allowMultipleChoice: boolean;
    allowAddOptions: boolean;
    anonymous: boolean;
    endDate?: Date;
    createdBy: string;
    createdAt: Date;
    totalVotes: number;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'best_answer' })
  bestAnswer?: {
    postId: string;
    authorId: string;
    markedBy: string;
    markedAt: Date;
    votes: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'topic_labels' })
  topicLabels?: Array<{
    label: string;
    color: string;
    category: 'status' | 'priority' | 'type' | 'custom';
    addedBy: string;
    addedAt: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'subscription_info' })
  subscriptionInfo?: {
    subscribers: Array<{
      userId: string;
      subscribedAt: Date;
      notificationLevel: 'all' | 'mentions_only' | 'first_post_only' | 'none';
    }>;
    totalSubscribers: number;
    emailDigestEnabled: boolean;
    digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  };

  @Property({ type: 'json', nullable: true, fieldName: 'moderation_queue' })
  moderationQueue?: Array<{
    postId: string;
    reason: 'spam' | 'inappropriate' | 'off_topic' | 'violation' | 'reported';
    reportedBy?: string;
    reportedAt: Date;
    status: 'pending' | 'approved' | 'rejected';
    moderatedBy?: string;
    moderatedAt?: Date;
    notes?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'analytics' })
  analytics?: {
    dailyViews: Record<string, number>; // date -> views
    dailyPosts: Record<string, number>; // date -> posts
    popularPosts: Array<{
      postId: string;
      views: number;
      reactions: number;
      replies: number;
      score: number;
    }>;
    activeUsers: Array<{
      userId: string;
      postCount: number;
      lastActive: Date;
      reputation: number;
    }>;
    peakHours: Record<string, number>; // hour -> activity
    averageResponseTime: number; // minutes
    resolutionRate: number; // percentage for questions
  };

  @Property({ type: 'json', nullable: true, fieldName: 'seo_optimization' })
  seoOptimization?: {
    slug: string;
    metaTitle: string;
    metaDescription: string;
    canonicalUrl?: string;
    ogImage?: string;
    structuredData: boolean;
    searchRanking: number;
    indexedBySearch: boolean;
    lastCrawled?: Date;
  };

  // Implementation of abstract methods
  getDiscussionType(): string {
    return 'forum';
  }

  async validateDiscussionRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Forum specific validation
    if (!this.forumCategory) {
      return false; // Forum category is required
    }

    if (!this.topicType) {
      return false; // Topic type is required
    }

    // Validate post limits
    if (this.forumSettings?.maxPostsPerUser) {
      const userPostCounts = this.getUserPostCounts();
      const maxAllowed = this.forumSettings.maxPostsPerUser;
      
      for (const [userId, count] of Object.entries(userPostCounts)) {
        if (count > maxAllowed) {
          return false; // User exceeded post limit
        }
      }
    }

    return true;
  }

  async processContent(): Promise<void> {
    // Process forum content and posts
    this.updateSearchOptimization();
    
    try {
      // Analyze all posts for content insights
      await this.analyzeForumContent();
      
      // Update forum statistics
      this.updateForumStatistics();
      
      // Process any pending moderation
      await this.processModerationQueue();
      
      // Update analytics
      this.updateAnalytics();
      
    } catch (error) {
      console.error('Forum content processing error:', error);
    }
  }

  async notifyParticipants(event: string, data?: Record<string, any>): Promise<void> {
    if (!this.subscriptionInfo?.subscribers) return;

    const notifications: Array<{
      userId: string;
      type: string;
      message: string;
      data: Record<string, any>;
    }> = [];

    for (const subscriber of this.subscriptionInfo.subscribers) {
      // Check notification level
      let shouldNotify = false;
      
      switch (subscriber.notificationLevel) {
        case 'all':
          shouldNotify = true;
          break;
        case 'mentions_only':
          shouldNotify = event === 'mention' || (data?.mentions?.includes(subscriber.userId) ?? false);
          break;
        case 'first_post_only':
          shouldNotify = event === 'new_post' && this.postCount === 1;
          break;
        case 'none':
          shouldNotify = false;
          break;
      }

      if (shouldNotify) {
        notifications.push({
          userId: subscriber.userId,
          type: event,
          message: this.generateNotificationMessage(event, data),
          data: { forumId: this.id, ...data }
        });
      }
    }

    // In a real implementation, this would send actual notifications
    console.log(`Sending ${notifications.length} forum notifications for event: ${event}`);
  }

  // Forum-specific business logic
  private async analyzeForumContent(): Promise<void> {
    if (!this.posts || this.posts.length === 0) return;

    // Analyze sentiment across all posts
    const sentiments = this.posts.map(() => this.mockSentimentAnalysis());
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;

    // Update content analysis
    this.contentAnalysis = {
      ...this.contentAnalysis,
      sentiment: avgSentiment > 0.6 ? 'positive' : avgSentiment < 0.4 ? 'negative' : 'neutral',
      wordCount: this.posts.reduce((total, post) => total + post.content.split(/\s+/).length, 0),
      topicCategories: [this.forumCategory!],
      keywords: this.extractForumKeywords(),
      lastAnalyzed: new Date()
    };
  }

  private mockSentimentAnalysis(): number {
    return Math.random(); // 0-1 sentiment score simulation
  }

  private extractForumKeywords(): string[] {
    if (!this.posts) return [];

    // Simple keyword extraction from post content
    const allText = [this.title, ...this.posts.map(p => p.content)].join(' ');
    const words = allText.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private updateForumStatistics(): void {
    this.postCount = this.posts?.length || 0;
    
    if (this.posts && this.posts.length > 0) {
      const lastPost = this.posts[this.posts.length - 1];
      this.lastPosterId = lastPost.authorId;
      this.lastPostAt = lastPost.createdAt;
    }

    // Update discussion statistics
    if (!this.statistics) {
      this.statistics = {};
    }

    this.statistics.messageCount = this.postCount;
    this.statistics.participantCount = this.getUniqueParticipantCount();
    this.statistics.viewCount = this.viewCount;
  }

  private getUniqueParticipantCount(): number {
    if (!this.posts) return 0;
    const uniqueUsers = new Set(this.posts.map(p => p.authorId));
    return uniqueUsers.size;
  }

  private async processModerationQueue(): Promise<void> {
    if (!this.moderationQueue) return;

    const pendingItems = this.moderationQueue.filter(item => item.status === 'pending');
    
    // Auto-approve low-risk items (simulation)
    for (const item of pendingItems) {
      if (item.reason !== 'violation' && Math.random() > 0.3) { // 70% auto-approval for non-violations
        item.status = 'approved';
        item.moderatedBy = 'system';
        item.moderatedAt = new Date();
        item.notes = 'Auto-approved by system';
      }
    }
  }

  private updateAnalytics(): void {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.analytics) {
      this.analytics = {
        dailyViews: {},
        dailyPosts: {},
        popularPosts: [],
        activeUsers: [],
        peakHours: {},
        averageResponseTime: 0,
        resolutionRate: 0
      };
    }

    // Update daily stats
    this.analytics.dailyViews[today] = (this.analytics.dailyViews[today] || 0) + 1;
    this.analytics.dailyPosts[today] = this.postCount;

    // Update popular posts
    if (this.posts) {
      this.analytics.popularPosts = this.posts.map(post => ({
        postId: post.id,
        views: Math.floor(Math.random() * 100), // Simulated
        reactions: post.reactions?.length || 0,
        replies: this.posts!.filter(p => p.parentPostId === post.id).length,
        score: this.calculatePostScore(post)
      })).sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // Calculate resolution rate for questions
    if (this.topicType === 'question') {
      this.analytics.resolutionRate = this.bestAnswer ? 100 : 0;
    }
  }

  private calculatePostScore(post: NonNullable<Forum['posts']>[0]): number {
    const reactions = post.reactions?.length || 0;
    const replies = this.posts?.filter(p => p.parentPostId === post.id).length || 0;
    const age = (new Date().getTime() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24); // days
    
    return (reactions * 2 + replies * 3) / Math.max(1, age);
  }

  private getUserPostCounts(): Record<string, number> {
    if (!this.posts) return {};

    const counts: Record<string, number> = {};
    this.posts.forEach(post => {
      counts[post.authorId] = (counts[post.authorId] || 0) + 1;
    });
    
    return counts;
  }

  private generateNotificationMessage(event: string, data?: Record<string, any>): string {
    switch (event) {
      case 'new_post':
        return `New post in "${this.title}"`;
      case 'reply':
        return `New reply to "${this.title}"`;
      case 'mention':
        return `You were mentioned in "${this.title}"`;
      case 'best_answer':
        return `Best answer marked in "${this.title}"`;
      default:
        return `Activity in "${this.title}"`;
    }
  }

  // Forum management methods
  addPost(authorId: string, content: string, parentPostId?: string): string {
    if (!this.posts) {
      this.posts = [];
    }

    // Check slow mode
    if (this.forumSettings?.slowModeSeconds) {
      const lastUserPost = this.posts
        .filter(p => p.authorId === authorId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      if (lastUserPost) {
        const timeSinceLastPost = (new Date().getTime() - lastUserPost.createdAt.getTime()) / 1000;
        if (timeSinceLastPost < this.forumSettings.slowModeSeconds) {
          throw new Error(`Slow mode active. Please wait ${this.forumSettings.slowModeSeconds - timeSinceLastPost} seconds`);
        }
      }
    }

    const postId = `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const post: NonNullable<Forum['posts']>[0] = {
      id: postId,
      authorId,
      content,
      postNumber: this.posts.length + 1,
      createdAt: new Date(),
      parentPostId,
      reactions: [],
      mentions: this.extractMentions(content),
      moderationStatus: this.forumSettings?.requireModeration ? 'pending' : 'approved'
    };

    this.posts.push(post);
    this.updateForumStatistics();
    this.incrementMessageCount();

    // Notify subscribers
    this.notifyParticipants('new_post', { postId, authorId });

    return postId;
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    return mentions;
  }

  editPost(postId: string, newContent: string, editorId: string): boolean {
    const post = this.posts?.find(p => p.id === postId);
    if (!post) return false;

    // Check permissions
    if (post.authorId !== editorId && !this.canUserModerate(editorId)) {
      return false;
    }

    post.content = newContent;
    post.editedAt = new Date();
    post.editedBy = editorId;
    post.mentions = this.extractMentions(newContent);

    return true;
  }

  deletePost(postId: string, deleterId: string): boolean {
    const post = this.posts?.find(p => p.id === postId);
    if (!post) return false;

    // Check permissions
    if (post.authorId !== deleterId && !this.canUserModerate(deleterId)) {
      return false;
    }

    post.deletedAt = new Date();
    post.deletedBy = deleterId;

    this.updateForumStatistics();
    return true;
  }

  markBestAnswer(postId: string, markedBy: string): boolean {
    if (this.topicType !== 'question') return false;

    const post = this.posts?.find(p => p.id === postId);
    if (!post) return false;

    // Only author or moderator can mark best answer
    if (this.authorId !== markedBy && !this.canUserModerate(markedBy)) {
      return false;
    }

    this.bestAnswer = {
      postId,
      authorId: post.authorId,
      markedBy,
      markedAt: new Date(),
      votes: post.reactions?.length || 0
    };

    // Notify participants
    this.notifyParticipants('best_answer', { postId, markedBy });

    return true;
  }

  createPoll(question: string, options: string[], settings: {
    allowMultipleChoice?: boolean;
    allowAddOptions?: boolean;
    anonymous?: boolean;
    endDate?: Date;
  }, createdBy: string): string {
    if (!this.forumSettings?.allowPolls) {
      throw new Error('Polls are not allowed in this forum');
    }

    if (!this.polls) {
      this.polls = [];
    }

    const pollId = `poll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.polls.push({
      id: pollId,
      question,
      options: options.map((text, index) => ({
        id: `option-${index}`,
        text,
        votes: 0,
        voters: []
      })),
      allowMultipleChoice: settings.allowMultipleChoice || false,
      allowAddOptions: settings.allowAddOptions || false,
      anonymous: settings.anonymous || false,
      endDate: settings.endDate,
      createdBy,
      createdAt: new Date(),
      totalVotes: 0
    });

    return pollId;
  }

  votePoll(pollId: string, optionIds: string[], voterId: string): boolean {
    const poll = this.polls?.find(p => p.id === pollId);
    if (!poll) return false;

    // Check if poll is still active
    if (poll.endDate && poll.endDate < new Date()) {
      return false; // Poll has ended
    }

    // Check if user already voted (if not anonymous)
    if (!poll.anonymous) {
      const hasVoted = poll.options.some(opt => opt.voters.includes(voterId));
      if (hasVoted) return false;
    }

    // Validate multiple choice setting
    if (!poll.allowMultipleChoice && optionIds.length > 1) {
      return false;
    }

    // Add votes
    for (const optionId of optionIds) {
      const option = poll.options.find(opt => opt.id === optionId);
      if (option) {
        option.votes++;
        if (!poll.anonymous) {
          option.voters.push(voterId);
        }
      }
    }

    poll.totalVotes++;
    return true;
  }

  subscribe(userId: string, notificationLevel: NonNullable<NonNullable<Forum['subscriptionInfo']>['subscribers']>[0]['notificationLevel'] = 'all'): void {
    if (!this.subscriptionInfo) {
      this.subscriptionInfo = {
        subscribers: [],
        totalSubscribers: 0,
        emailDigestEnabled: false,
        digestFrequency: 'daily'
      };
    }

    // Check if already subscribed
    const existingSubscriber = this.subscriptionInfo.subscribers.find(s => s.userId === userId);
    
    if (existingSubscriber) {
      existingSubscriber.notificationLevel = notificationLevel;
    } else {
      this.subscriptionInfo.subscribers.push({
        userId,
        subscribedAt: new Date(),
        notificationLevel
      });
      this.subscriptionInfo.totalSubscribers++;
    }
  }

  unsubscribe(userId: string): boolean {
    if (!this.subscriptionInfo) return false;

    const index = this.subscriptionInfo.subscribers.findIndex(s => s.userId === userId);
    if (index > -1) {
      this.subscriptionInfo.subscribers.splice(index, 1);
      this.subscriptionInfo.totalSubscribers--;
      return true;
    }

    return false;
  }

  // Forum analytics and insights
  getForumInsights(): {
    engagement: number;
    responseRate: number;
    averagePostLength: number;
    topContributors: Array<{ userId: string; posts: number; score: number }>;
    trendingTopics: string[];
    activityTrend: 'increasing' | 'stable' | 'decreasing';
  } {
    const posts = this.posts || [];
    const totalPosts = posts.length;
    const uniqueUsers = new Set(posts.map(p => p.authorId)).size;

    // Calculate engagement (posts per unique user)
    const engagement = uniqueUsers > 0 ? totalPosts / uniqueUsers : 0;

    // Response rate (posts with replies / total posts)
    const postsWithReplies = posts.filter(p => 
      posts.some(reply => reply.parentPostId === p.id)
    ).length;
    const responseRate = totalPosts > 0 ? (postsWithReplies / totalPosts) * 100 : 0;

    // Average post length
    const totalWords = posts.reduce((sum, p) => sum + p.content.split(/\s+/).length, 0);
    const averagePostLength = totalPosts > 0 ? totalWords / totalPosts : 0;

    // Top contributors
    const userStats: Record<string, { posts: number; reactions: number }> = {};
    posts.forEach(post => {
      const userId = post.authorId;
      if (!userStats[userId]) {
        userStats[userId] = { posts: 0, reactions: 0 };
      }
      userStats[userId].posts++;
      userStats[userId].reactions += post.reactions?.length || 0;
    });

    const topContributors = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        posts: stats.posts,
        score: stats.posts * 2 + stats.reactions
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Trending topics (mock implementation)
    const trendingTopics = this.contentAnalysis?.keywords?.slice(0, 5) || [];

    // Activity trend (simplified)
    const recentPosts = posts.filter(p => {
      const daysSincePost = (new Date().getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSincePost <= 7;
    }).length;
    
    const activityTrend = recentPosts > totalPosts * 0.3 ? 'increasing' : 
                        recentPosts > totalPosts * 0.1 ? 'stable' : 'decreasing';

    return {
      engagement,
      responseRate,
      averagePostLength,
      topContributors,
      trendingTopics,
      activityTrend
    };
  }

  isQuestion(): boolean {
    return this.topicType === 'question';
  }

  isResolved(): boolean {
    return this.isQuestion() && !!this.bestAnswer;
  }

  isPoll(): boolean {
    return this.topicType === 'poll' || (this.polls && this.polls.length > 0);
  }

  isHotTopic(): boolean {
    const recentActivity = this.lastActivity && 
      (new Date().getTime() - this.lastActivity.getTime()) < (24 * 60 * 60 * 1000); // 24 hours
    
    const highEngagement = (this.statistics?.engagementScore || 0) > 60;
    const manyPosts = this.postCount > 10;
    
    return recentActivity && (highEngagement || manyPosts);
  }

  requiresModerationAttention(): boolean {
    const pendingModeration = this.moderationQueue?.filter(item => item.status === 'pending').length || 0;
    const highFlagCount = (this.moderationInfo?.flaggedCount || 0) > 3;
    const lowQualityScore = this.calculateDiscussionQuality() < 40;

    return pendingModeration > 0 || highFlagCount || lowQualityScore;
  }

  calculateForumHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const baseHealth = this.getDiscussionHealth();
    
    // Add forum-specific factors
    const forumFactors: Record<string, number> = {};
    const forumIssues: string[] = [];

    // Post quality distribution
    const posts = this.posts || [];
    const shortPosts = posts.filter(p => p.content.split(/\s+/).length < 10).length;
    const qualityRatio = posts.length > 0 ? Math.max(0, 100 - (shortPosts / posts.length) * 100) : 50;
    forumFactors.postQuality = qualityRatio;
    
    if (qualityRatio < 60) {
      forumIssues.push('Many posts are too short or low quality');
    }

    // Moderation health
    const pendingModeration = this.moderationQueue?.filter(item => item.status === 'pending').length || 0;
    forumFactors.moderationHealth = Math.max(0, 100 - (pendingModeration * 20));
    
    if (pendingModeration > 2) {
      forumIssues.push('Moderation queue needs attention');
    }

    // Response rate for questions
    if (this.isQuestion()) {
      forumFactors.helpfulness = this.isResolved() ? 100 : 30;
      if (!this.isResolved() && this.postCount > 5) {
        forumIssues.push('Question has many responses but no best answer marked');
      }
    }

    // Participation diversity
    const uniqueUsers = new Set(posts.map(p => p.authorId)).size;
    const diversityScore = posts.length > 0 ? Math.min(100, (uniqueUsers / posts.length) * 200) : 50;
    forumFactors.diversity = diversityScore;
    
    if (diversityScore < 30) {
      forumIssues.push('Discussion dominated by few participants');
    }

    // Combine with base health factors
    const combinedFactors = { ...baseHealth.factors, ...forumFactors };
    const combinedIssues = [...baseHealth.issues, ...forumIssues];

    // Recalculate score with forum factors
    const totalScore = Object.values(combinedFactors).reduce((sum, score) => sum + score, 0) / Object.keys(combinedFactors).length;

    return {
      score: Math.round(totalScore),
      factors: combinedFactors,
      issues: combinedIssues
    };
  }
}