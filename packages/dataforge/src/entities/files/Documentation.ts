import { Entity, Property } from '@mikro-orm/core';
import { FileArchetype } from '../archetypes/FileArchetype.js';

/**
 * Documentation file with content analysis and knowledge management features
 * Extends FileArchetype with documentation-specific workflows
 */
@Entity({ tableName: 'documentation' })
export class Documentation extends FileArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'doc_type' })
  docType?: 'api' | 'user_guide' | 'technical' | 'tutorial' | 'reference' | 'readme' | 'changelog' | 'wiki' | 'specification' | 'other';

  @Property({ type: 'string', nullable: true, fieldName: 'doc_format' })
  docFormat?: 'markdown' | 'html' | 'pdf' | 'docx' | 'txt' | 'rst' | 'asciidoc' | 'confluence' | 'notion';

  @Property({ type: 'string', nullable: true, fieldName: 'target_audience' })
  targetAudience?: 'developer' | 'end_user' | 'administrator' | 'manager' | 'general' | 'technical_writer';

  @Property({ type: 'string', nullable: true, fieldName: 'difficulty_level' })
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  @Property({ type: 'json', nullable: true, fieldName: 'content_analysis' })
  contentAnalysis?: {
    wordCount?: number;
    paragraphCount?: number;
    headingCount?: number;
    imageCount?: number;
    linkCount?: number;
    codeBlockCount?: number;
    readingTime?: number; // minutes
    readabilityScore?: number; // 0-100
    lastAnalyzed?: Date;
  };

  @Property({ type: 'json', nullable: true })
  structure?: {
    tableOfContents?: Array<{
      level: number;
      title: string;
      anchor?: string;
      pageNumber?: number;
    }>;
    sections?: Array<{
      title: string;
      wordCount: number;
      complexity: 'simple' | 'moderate' | 'complex';
      hasExamples: boolean;
    }>;
    outline?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'quality_metrics' })
  qualityMetrics?: {
    completeness?: number; // percentage
    accuracy?: number; // percentage  
    clarity?: number; // percentage
    upToDate?: boolean;
    lastUpdated?: Date;
    reviewStatus?: 'needs_review' | 'under_review' | 'approved' | 'outdated';
    issues?: Array<{
      type: 'missing_info' | 'outdated_info' | 'unclear' | 'incorrect' | 'formatting';
      description: string;
      severity: 'low' | 'medium' | 'high';
      line?: number;
      suggestion?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'usage_analytics' })
  usageAnalytics?: {
    views?: number;
    uniqueViews?: number;
    avgTimeOnPage?: number; // seconds
    bounceRate?: number; // percentage
    searchQueries?: Array<{
      query: string;
      count: number;
      found: boolean;
    }>;
    popularSections?: Array<{
      section: string;
      views: number;
    }>;
    lastAccessed?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'user_feedback' })
  userFeedback?: Array<{
    userId: string;
    rating: number; // 1-5
    helpful: boolean;
    comment?: string;
    category?: 'accuracy' | 'clarity' | 'completeness' | 'examples' | 'navigation';
    submittedAt: Date;
    status?: 'new' | 'acknowledged' | 'addressed';
  }>;

  @Property({ type: 'json', nullable: true })
  translations?: Array<{
    language: string;
    fileId?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'outdated';
    completeness?: number; // percentage
    translator?: string;
    lastUpdated?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'maintenance_info' })
  maintenanceInfo?: {
    lastReview?: Date;
    nextReview?: Date;
    reviewFrequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
    maintainer?: string;
    deprecationDate?: Date;
    replacementDoc?: string;
    dependencies?: Array<{
      name: string;
      type: 'software' | 'api' | 'process' | 'document';
      version?: string;
      lastChecked?: Date;
      status: 'current' | 'outdated' | 'deprecated';
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'compliance_info' })
  complianceInfo?: {
    standard?: string; // e.g., 'GDPR', 'ISO 27001', 'SOC 2'
    lastAudit?: Date;
    nextAudit?: Date;
    complianceScore?: number; // percentage
    requirements?: Array<{
      requirement: string;
      status: 'compliant' | 'non_compliant' | 'needs_review';
      evidence?: string;
      lastChecked?: Date;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'linked_resources' })
  linkedResources?: Array<{
    type: 'code' | 'api' | 'document' | 'video' | 'image' | 'external';
    url: string;
    title?: string;
    description?: string;
    status: 'active' | 'broken' | 'deprecated';
    lastChecked?: Date;
  }>;

  @Property({ type: 'json', nullable: true })
  examples?: Array<{
    title: string;
    type: 'code' | 'screenshot' | 'diagram' | 'walkthrough';
    content?: string;
    language?: string; // for code examples
    description?: string;
    workingStatus?: 'working' | 'broken' | 'outdated' | 'unknown';
    lastTested?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'cross_references' })
  crossReferences?: Array<{
    documentId: string;
    title: string;
    relationship: 'prerequisite' | 'related' | 'follow_up' | 'alternative' | 'superseded_by';
    description?: string;
  }>;

  // Implementation of abstract methods
  getFileType(): string {
    return 'documentation';
  }

  async validateFileRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Documentation specific validation
    if (!this.docType) {
      return false; // Document type is required
    }

    if (!this.targetAudience) {
      return false; // Target audience is required
    }

    // Content validation
    if (this.contentAnalysis?.wordCount && this.contentAnalysis.wordCount < 10) {
      return false; // Document too short
    }

    return true;
  }

  async processFile(): Promise<void> {
    // Extract document format from file extension
    this.extractDocFormat();
    
    // Start processing
    this.startProcessing();
    
    try {
      // Analyze content structure and metrics
      await this.analyzeContent();
      
      // Check quality metrics
      await this.assessQuality();
      
      // Validate linked resources
      await this.validateLinks();
      
      // Extract examples and code blocks
      await this.extractExamples();
      
      this.completeProcessing({
        analyzed: true,
        format: this.docFormat,
        metrics: this.contentAnalysis
      });
    } catch (error) {
      this.failProcessing([error instanceof Error ? error.message : 'Unknown error']);
    }
  }

  async generateThumbnail(): Promise<string | null> {
    // For documentation, generate a preview of the first section
    if (!this.url) return null;
    
    // This would typically integrate with a document preview service
    return `/api/doc-preview/${this.id}?format=${this.docFormat}`;
  }

  // Documentation specific business logic
  private extractDocFormat(): void {
    if (!this.extension) return;

    const formatMap: Record<string, typeof Documentation.prototype.docFormat> = {
      '.md': 'markdown',
      '.markdown': 'markdown',
      '.html': 'html',
      '.htm': 'html',
      '.pdf': 'pdf',
      '.docx': 'docx',
      '.doc': 'docx',
      '.txt': 'txt',
      '.rst': 'rst',
      '.adoc': 'asciidoc',
      '.asciidoc': 'asciidoc'
    };

    this.docFormat = formatMap[this.extension.toLowerCase()] || 'other';
  }

  private async analyzeContent(): Promise<void> {
    // This would typically parse the actual document content
    // For now, simulate content analysis based on file size
    if (!this.size) return;

    const estimatedWords = Math.floor(this.size / 6); // Rough estimate: 6 chars per word
    const estimatedParagraphs = Math.floor(estimatedWords / 50);
    const estimatedHeadings = Math.floor(estimatedParagraphs / 3);

    this.contentAnalysis = {
      wordCount: estimatedWords,
      paragraphCount: estimatedParagraphs,
      headingCount: estimatedHeadings,
      imageCount: Math.floor(Math.random() * 5),
      linkCount: Math.floor(Math.random() * 10),
      codeBlockCount: this.docType === 'api' || this.docType === 'technical' ? Math.floor(Math.random() * 8) : 0,
      readingTime: Math.ceil(estimatedWords / 200), // 200 words per minute
      readabilityScore: Math.floor(Math.random() * 40) + 60, // 60-100
      lastAnalyzed: new Date()
    };

    // Generate table of contents simulation
    this.structure = {
      tableOfContents: this.generateMockTOC(estimatedHeadings),
      sections: this.generateMockSections(estimatedHeadings)
    };
  }

  private generateMockTOC(headingCount: number): NonNullable<NonNullable<Documentation['structure']>['tableOfContents']> {
    const toc = [];
    const sectionNames = [
      'Introduction', 'Getting Started', 'Overview', 'Installation', 'Configuration',
      'API Reference', 'Examples', 'Best Practices', 'Troubleshooting', 'FAQ'
    ];

    for (let i = 0; i < Math.min(headingCount, sectionNames.length); i++) {
      toc.push({
        level: Math.floor(Math.random() * 3) + 1,
        title: sectionNames[i],
        anchor: sectionNames[i].toLowerCase().replace(/\s+/g, '-'),
        pageNumber: i + 1
      });
    }

    return toc;
  }

  private generateMockSections(headingCount: number): NonNullable<NonNullable<Documentation['structure']>['sections']> {
    const sections = [];
    const totalWords = this.contentAnalysis?.wordCount || 1000;
    const wordsPerSection = Math.floor(totalWords / Math.max(headingCount, 1));

    for (let i = 0; i < headingCount; i++) {
      sections.push({
        title: `Section ${i + 1}`,
        wordCount: wordsPerSection + Math.floor(Math.random() * 100),
        complexity: ['simple', 'moderate', 'complex'][Math.floor(Math.random() * 3)] as 'simple' | 'moderate' | 'complex',
        hasExamples: Math.random() > 0.5
      });
    }

    return sections;
  }

  private async assessQuality(): Promise<void> {
    // Simulate quality assessment
    const completeness = Math.floor(Math.random() * 30) + 70; // 70-100
    const accuracy = Math.floor(Math.random() * 20) + 80; // 80-100
    const clarity = Math.floor(Math.random() * 40) + 60; // 60-100

    const issues = [];
    
    // Generate some random quality issues
    if (completeness < 80) {
      issues.push({
        type: 'missing_info' as const,
        description: 'Some sections appear incomplete',
        severity: 'medium' as const,
        suggestion: 'Add more detail to incomplete sections'
      });
    }

    if (clarity < 70) {
      issues.push({
        type: 'unclear' as const,
        description: 'Some explanations could be clearer',
        severity: 'low' as const,
        suggestion: 'Simplify complex sentences and add examples'
      });
    }

    this.qualityMetrics = {
      completeness,
      accuracy,
      clarity,
      upToDate: Math.random() > 0.3, // 70% chance of being up to date
      lastUpdated: new Date(),
      reviewStatus: 'needs_review',
      issues
    };
  }

  private async validateLinks(): Promise<void> {
    // Simulate link validation
    const linkCount = this.contentAnalysis?.linkCount || 0;
    const linkedResources = [];

    for (let i = 0; i < linkCount; i++) {
      const isWorking = Math.random() > 0.1; // 90% of links work
      linkedResources.push({
        type: ['code', 'api', 'document', 'external'][Math.floor(Math.random() * 4)] as 'code' | 'api' | 'document' | 'external',
        url: `https://example.com/resource-${i}`,
        title: `Resource ${i + 1}`,
        status: isWorking ? 'active' as const : 'broken' as const,
        lastChecked: new Date()
      });
    }

    this.linkedResources = linkedResources;
  }

  private async extractExamples(): Promise<void> {
    // Simulate example extraction
    const codeBlockCount = this.contentAnalysis?.codeBlockCount || 0;
    const examples = [];

    for (let i = 0; i < codeBlockCount; i++) {
      examples.push({
        title: `Example ${i + 1}`,
        type: 'code' as const,
        content: `// Example code block ${i + 1}`,
        language: this.docType === 'api' ? 'javascript' : 'bash',
        description: `This example demonstrates feature ${i + 1}`,
        workingStatus: Math.random() > 0.2 ? 'working' as const : 'unknown' as const,
        lastTested: new Date()
      });
    }

    this.examples = examples;
  }

  // Quality assessment methods
  getOverallQuality(): number {
    if (!this.qualityMetrics) return 0;
    
    const completeness = this.qualityMetrics.completeness || 0;
    const accuracy = this.qualityMetrics.accuracy || 0;
    const clarity = this.qualityMetrics.clarity || 0;
    
    return Math.round((completeness + accuracy + clarity) / 3);
  }

  needsUpdate(): boolean {
    // Documentation needs update if:
    // - Quality is low
    // - Marked as outdated
    // - Dependencies are outdated
    // - Has broken links
    
    const lowQuality = this.getOverallQuality() < 70;
    const outdated = this.qualityMetrics?.upToDate === false;
    const hasOutdatedDeps = this.maintenanceInfo?.dependencies?.some(dep => dep.status === 'outdated');
    const hasBrokenLinks = this.linkedResources?.some(link => link.status === 'broken');
    
    return lowQuality || outdated || !!hasOutdatedDeps || !!hasBrokenLinks;
  }

  getReadingDifficulty(): 'easy' | 'moderate' | 'difficult' | 'very_difficult' {
    const readabilityScore = this.contentAnalysis?.readabilityScore || 50;
    
    if (readabilityScore >= 90) return 'easy';
    if (readabilityScore >= 70) return 'moderate';
    if (readabilityScore >= 50) return 'difficult';
    return 'very_difficult';
  }

  addUserFeedback(userId: string, rating: number, helpful: boolean, comment?: string, category?: NonNullable<Documentation['userFeedback']>[0]['category']): void {
    if (!this.userFeedback) {
      this.userFeedback = [];
    }

    this.userFeedback.push({
      userId,
      rating,
      helpful,
      comment,
      category,
      submittedAt: new Date(),
      status: 'new'
    });
  }

  getAverageRating(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 0;
    
    const totalRating = this.userFeedback.reduce((sum, feedback) => sum + feedback.rating, 0);
    return totalRating / this.userFeedback.length;
  }

  getHelpfulnessRatio(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 0;
    
    const helpfulCount = this.userFeedback.filter(f => f.helpful).length;
    return helpfulCount / this.userFeedback.length;
  }

  recordView(userId?: string): void {
    if (!this.usageAnalytics) {
      this.usageAnalytics = {
        views: 0,
        uniqueViews: 0
      };
    }

    this.usageAnalytics.views++;
    this.usageAnalytics.lastAccessed = new Date();

    // Track unique views (simplified - would need proper user tracking)
    if (userId) {
      this.usageAnalytics.uniqueViews++;
    }

    this.updateLastAccessed(userId);
  }

  addTranslation(language: string, status: NonNullable<Documentation['translations']>[0]['status'], translator?: string): void {
    if (!this.translations) {
      this.translations = [];
    }

    // Check if translation already exists
    const existing = this.translations.find(t => t.language === language);
    if (existing) {
      existing.status = status;
      existing.translator = translator;
      existing.lastUpdated = new Date();
    } else {
      this.translations.push({
        language,
        status,
        translator,
        lastUpdated: new Date()
      });
    }
  }

  addCrossReference(documentId: string, title: string, relationship: NonNullable<Documentation['crossReferences']>[0]['relationship'], description?: string): void {
    if (!this.crossReferences) {
      this.crossReferences = [];
    }

    // Check if reference already exists
    const exists = this.crossReferences.some(ref => 
      ref.documentId === documentId && ref.relationship === relationship
    );

    if (!exists) {
      this.crossReferences.push({
        documentId,
        title,
        relationship,
        description
      });
    }
  }

  scheduleReview(frequency: NonNullable<Documentation['maintenanceInfo']>['reviewFrequency'], maintainer?: string): void {
    const now = new Date();
    let nextReview = new Date(now);

    switch (frequency) {
      case 'monthly':
        nextReview.setMonth(nextReview.getMonth() + 1);
        break;
      case 'quarterly':
        nextReview.setMonth(nextReview.getMonth() + 3);
        break;
      case 'semi_annual':
        nextReview.setMonth(nextReview.getMonth() + 6);
        break;
      case 'annual':
        nextReview.setFullYear(nextReview.getFullYear() + 1);
        break;
    }

    this.maintenanceInfo = {
      ...this.maintenanceInfo,
      lastReview: now,
      nextReview,
      reviewFrequency: frequency,
      maintainer
    };
  }

  getDocumentationHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content quality (40%)
    factors.quality = this.getOverallQuality();
    if (factors.quality < 70) {
      issues.push('Documentation quality needs improvement');
    }

    // Maintenance status (25%)
    factors.maintenance = this.calculateMaintenanceScore();
    if (factors.maintenance < 60) {
      issues.push('Documentation needs regular maintenance');
    }

    // User satisfaction (20%)
    factors.userSatisfaction = this.calculateUserSatisfactionScore();
    if (factors.userSatisfaction < 70) {
      issues.push('User feedback indicates satisfaction issues');
    }

    // Technical health (15%)
    factors.technical = this.calculateTechnicalScore();
    if (factors.technical < 70) {
      issues.push('Technical issues detected (broken links, outdated examples)');
    }

    const totalScore = 
      factors.quality * 0.4 + 
      factors.maintenance * 0.25 + 
      factors.userSatisfaction * 0.2 + 
      factors.technical * 0.15;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateMaintenanceScore(): number {
    let score = 70; // Base score

    // Recent review
    if (this.maintenanceInfo?.lastReview) {
      const daysSinceReview = (new Date().getTime() - this.maintenanceInfo.lastReview.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReview <= 30) score += 20;
      else if (daysSinceReview <= 90) score += 10;
      else score -= 10;
    } else {
      score -= 20; // No review scheduled
    }

    // Up to date status
    if (this.qualityMetrics?.upToDate) score += 10;
    else score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateUserSatisfactionScore(): number {
    if (!this.userFeedback || this.userFeedback.length === 0) return 50;

    const avgRating = this.getAverageRating();
    const helpfulnessRatio = this.getHelpfulnessRatio();
    
    // Convert 1-5 rating to 0-100 scale
    const ratingScore = ((avgRating - 1) / 4) * 100;
    const helpfulnessScore = helpfulnessRatio * 100;
    
    return (ratingScore + helpfulnessScore) / 2;
  }

  private calculateTechnicalScore(): number {
    let score = 100;

    // Broken links penalty
    const brokenLinks = this.linkedResources?.filter(link => link.status === 'broken').length || 0;
    score -= brokenLinks * 10;

    // Outdated examples penalty
    const outdatedExamples = this.examples?.filter(ex => ex.workingStatus === 'broken' || ex.workingStatus === 'outdated').length || 0;
    score -= outdatedExamples * 15;

    // Outdated dependencies penalty
    const outdatedDeps = this.maintenanceInfo?.dependencies?.filter(dep => dep.status === 'outdated').length || 0;
    score -= outdatedDeps * 20;

    return Math.max(0, score);
  }
}