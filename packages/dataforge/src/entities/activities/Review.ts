import { Entity, Property } from '@mikro-orm/core';
import { ActivityArchetype } from '../archetypes/ActivityArchetype.js';

/**
 * Review activity with code review, peer review, and approval features
 * Extends ActivityArchetype with review-specific workflows
 */
@Entity({ tableName: 'review' })
export class Review extends ActivityArchetype {
  @Property({ type: 'string', nullable: true, fieldName: 'review_type' })
  reviewType?: 'code_review' | 'design_review' | 'security_review' | 'architecture_review' | 'documentation_review' | 'peer_review' | 'compliance_review';

  @Property({ type: 'string', nullable: true, fieldName: 'review_scope' })
  reviewScope?: 'file' | 'feature' | 'module' | 'application' | 'system' | 'process' | 'document';

  @Property({ type: 'string', nullable: true, fieldName: 'review_criteria' })
  reviewCriteria?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'author_id' })
  authorId?: string; // Person who created the content being reviewed

  @Property({ type: 'json', nullable: true })
  reviewers?: Array<{
    userId: string;
    role: 'primary' | 'secondary' | 'optional' | 'domain_expert' | 'security_expert' | 'architect';
    expertise?: string[];
    assigned: boolean;
    status: 'pending' | 'in_progress' | 'completed' | 'declined';
    assignedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    timeSpent?: number; // minutes
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'review_items' })
  reviewItems?: Array<{
    id: string;
    type: 'file' | 'section' | 'function' | 'class' | 'component' | 'document' | 'process';
    name: string;
    path?: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'in_review' | 'approved' | 'needs_changes' | 'rejected';
    linesOfCode?: number;
    complexity?: number;
    changeType?: 'addition' | 'modification' | 'deletion' | 'refactor' | 'bugfix';
  }>;

  @Property({ type: 'json', nullable: true })
  comments?: Array<{
    id: string;
    reviewerId: string;
    itemId?: string; // Related to specific review item
    type: 'suggestion' | 'issue' | 'question' | 'compliment' | 'blocking' | 'non_blocking';
    severity: 'info' | 'minor' | 'major' | 'critical';
    category?: 'logic' | 'performance' | 'security' | 'style' | 'documentation' | 'testing' | 'architecture';
    line?: number;
    column?: number;
    content: string;
    code?: string; // Code snippet if applicable
    suggestion?: string; // Suggested fix or improvement
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
    createdAt: Date;
    thread?: Array<{
      userId: string;
      content: string;
      createdAt: Date;
    }>;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'review_metrics' })
  reviewMetrics?: {
    totalReviewers: number;
    completedReviewers: number;
    reviewCompletionRate: number; // percentage
    averageReviewTime: number; // minutes
    totalComments: number;
    blockers: number;
    suggestions: number;
    issues: number;
    linesReviewed: number;
    reviewEfficiency: number; // comments per hour
    thoroughness: number; // comments per line of code
  };

  @Property({ type: 'json', nullable: true, fieldName: 'quality_assessment' })
  qualityAssessment?: {
    overallScore: number; // 1-10
    categories: {
      codeQuality?: number;
      maintainability?: number;
      performance?: number;
      security?: number;
      testability?: number;
      documentation?: number;
      architecture?: number;
    };
    strengths?: string[];
    weaknesses?: string[];
    risks?: Array<{
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      likelihood: 'low' | 'medium' | 'high';
      mitigation?: string;
    }>;
    recommendations?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'checklist_items' })
  checklistItems?: Array<{
    id: string;
    category: string;
    description: string;
    required: boolean;
    checked: boolean;
    checkedBy?: string;
    checkedAt?: Date;
    notes?: string;
    notApplicable?: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'approval_status' })
  approvalStatus?: {
    required: number;
    approved: number;
    rejected: number;
    pending: number;
    finalDecision?: 'approved' | 'rejected' | 'needs_revision';
    decisionMadeAt?: Date;
    decisionMadeBy?: string;
    consensus?: boolean;
    unanimity?: boolean;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'change_impact' })
  changeImpact?: {
    scope: 'local' | 'module' | 'system' | 'external';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    backwardCompatibility: boolean;
    performanceImpact: 'positive' | 'neutral' | 'negative' | 'unknown';
    securityImpact: 'improves' | 'neutral' | 'degrades' | 'unknown';
    dependencies: Array<{
      type: 'upstream' | 'downstream' | 'peer';
      component: string;
      impactLevel: 'none' | 'minor' | 'major' | 'breaking';
    }>;
    rollbackComplexity: 'simple' | 'moderate' | 'complex' | 'risky';
  };

  @Property({ type: 'json', nullable: true, fieldName: 'review_tools' })
  reviewTools?: {
    platform?: string; // GitHub, GitLab, Bitbucket, etc.
    staticAnalysis?: Array<{
      tool: string;
      version?: string;
      rulesProfile?: string;
      findings?: number;
      criticalFindings?: number;
    }>;
    codeFormatting?: {
      tool?: string;
      compliant: boolean;
      violations?: number;
    };
    securityScanning?: Array<{
      tool: string;
      vulnerabilities: number;
      severity: {
        critical?: number;
        high?: number;
        medium?: number;
        low?: number;
      };
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'follow_up_actions' })
  followUpActions?: Array<{
    id: string;
    type: 'fix' | 'refactor' | 'test' | 'document' | 'investigate' | 'discuss';
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignee?: string;
    dueDate?: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    createdBy: string;
    createdAt: Date;
    completedAt?: Date;
    relatedCommentId?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'knowledge_transfer' })
  knowledgeTransfer?: {
    domainKnowledgeShared: boolean;
    newPatterns?: string[];
    lessonsLearned?: string[];
    bestPractices?: string[];
    antiPatterns?: string[];
    documentationUpdated?: boolean;
    trainingNeeded?: boolean;
    mentoring?: {
      provided: boolean;
      receiverId?: string;
      topics?: string[];
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'reviewer_feedback' })
  reviewerFeedback?: Array<{
    reviewerId: string;
    overallSatisfaction: number; // 1-5
    clarityOfRequirements: number; // 1-5
    codeReadability: number; // 1-5
    completenessOfInformation: number; // 1-5
    responseToFeedback: number; // 1-5
    timeToReview: 'too_short' | 'adequate' | 'too_long';
    wouldReviewAgain: boolean;
    comments?: string;
  }>;

  // Implementation of abstract methods
  getActivityType(): string {
    return 'review';
  }

  async validateActivityRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Review specific validation
    if (!this.reviewType) {
      return false; // Review type is required
    }

    if (!this.authorId) {
      return false; // Author is required
    }

    if (!this.reviewers || this.reviewers.length === 0) {
      return false; // At least one reviewer is required
    }

    // Critical reviews require multiple reviewers
    if (this.priority === 'urgent' && this.reviewers.length < 2) {
      return false; // Critical reviews need multiple reviewers
    }

    // Security and architecture reviews require domain experts
    if (this.reviewType === 'security_review' || this.reviewType === 'architecture_review') {
      const hasExpert = this.reviewers.some(r => 
        r.role === 'security_expert' || r.role === 'architect' || r.role === 'domain_expert'
      );
      if (!hasExpert) {
        return false; // Domain expert required
      }
    }

    return true;
  }

  async canExecute(): Promise<boolean> {
    // Check base conditions
    if (!this.isDependenciesSatisfied()) return false;

    // Review-specific checks
    if (!this.areReviewersAssigned()) {
      return false;
    }

    if (!this.isContentReady()) {
      return false;
    }

    // Check if required tools are available
    if (!this.areReviewToolsReady()) {
      return false;
    }

    return true;
  }

  async executeActivity(): Promise<void> {
    this.startProcessing();
    
    try {
      // Step 1: Initialize review process
      await this.initializeReview();
      
      // Step 2: Run automated analysis
      await this.runAutomatedAnalysis();
      
      // Step 3: Notify reviewers and start reviews
      await this.startReviewProcess();
      
      // Step 4: Monitor and coordinate review progress
      await this.coordinateReviewProcess();
      
      // Step 5: Collect and synthesize feedback
      await this.collectFeedback();
      
      // Step 6: Make final decision
      await this.makeFinalDecision();
      
      // Step 7: Create follow-up actions
      await this.createFollowUpActions();
      
      this.completeProcessing({
        reviewed: true,
        reviewType: this.reviewType,
        decision: this.approvalStatus?.finalDecision,
        reviewers: this.reviewers?.length
      });

    } catch (error) {
      this.failProcessing([error instanceof Error ? error.message : 'Unknown review error']);
    }
  }

  // Review specific business logic
  private async initializeReview(): Promise<void> {
    // Setup review workspace and notifications
    await this.simulateReviewStep('Initialize review workspace', 5000);
    
    // Assign reviewers if not already assigned
    if (this.reviewers) {
      for (const reviewer of this.reviewers) {
        if (!reviewer.assigned) {
          reviewer.assigned = true;
          reviewer.assignedAt = new Date();
          reviewer.status = 'pending';
        }
      }
    }
    
    // Initialize review metrics
    this.initializeReviewMetrics();
  }

  private initializeReviewMetrics(): void {
    const totalReviewers = this.reviewers?.length || 0;
    
    this.reviewMetrics = {
      totalReviewers,
      completedReviewers: 0,
      reviewCompletionRate: 0,
      averageReviewTime: 0,
      totalComments: 0,
      blockers: 0,
      suggestions: 0,
      issues: 0,
      linesReviewed: this.calculateTotalLinesOfCode(),
      reviewEfficiency: 0,
      thoroughness: 0
    };
  }

  private calculateTotalLinesOfCode(): number {
    return this.reviewItems?.reduce((total, item) => total + (item.linesOfCode || 0), 0) || 0;
  }

  private async runAutomatedAnalysis(): Promise<void> {
    // Run static analysis tools
    if (this.reviewTools?.staticAnalysis) {
      for (const tool of this.reviewTools.staticAnalysis) {
        await this.simulateReviewStep(`Run ${tool.tool} static analysis`, 15000);
        
        // Simulate findings
        tool.findings = Math.floor(Math.random() * 20) + 5;
        tool.criticalFindings = Math.floor(Math.random() * 3);
      }
    }
    
    // Run security scanning
    if (this.reviewTools?.securityScanning) {
      for (const scanner of this.reviewTools.securityScanning) {
        await this.simulateReviewStep(`Run ${scanner.tool} security scan`, 20000);
        
        // Simulate vulnerabilities
        scanner.vulnerabilities = Math.floor(Math.random() * 10);
        scanner.severity = {
          critical: Math.floor(Math.random() * 2),
          high: Math.floor(Math.random() * 3),
          medium: Math.floor(Math.random() * 5),
          low: Math.floor(Math.random() * 8)
        };
      }
    }
    
    // Check code formatting
    if (this.reviewTools?.codeFormatting) {
      await this.simulateReviewStep('Check code formatting', 5000);
      this.reviewTools.codeFormatting.compliant = Math.random() > 0.2; // 80% compliance
      this.reviewTools.codeFormatting.violations = this.reviewTools.codeFormatting.compliant ? 0 : Math.floor(Math.random() * 15) + 1;
    }
  }

  private async startReviewProcess(): Promise<void> {
    // Send notifications to reviewers
    await this.simulateReviewStep('Send reviewer notifications', 3000);
    
    // Create review checklist if applicable
    this.createReviewChecklist();
    
    // Initialize comments array
    if (!this.comments) {
      this.comments = [];
    }
  }

  private createReviewChecklist(): void {
    const checklistTemplates: Record<string, Array<{ category: string; description: string; required: boolean }>> = {
      code_review: [
        { category: 'Logic', description: 'Code logic is correct and handles edge cases', required: true },
        { category: 'Performance', description: 'No obvious performance bottlenecks', required: true },
        { category: 'Security', description: 'No security vulnerabilities present', required: true },
        { category: 'Style', description: 'Code follows team style guidelines', required: false },
        { category: 'Testing', description: 'Adequate test coverage provided', required: true },
        { category: 'Documentation', description: 'Code is well documented', required: false }
      ],
      security_review: [
        { category: 'Authentication', description: 'Authentication mechanisms are secure', required: true },
        { category: 'Authorization', description: 'Access controls are properly implemented', required: true },
        { category: 'Data Protection', description: 'Sensitive data is encrypted and protected', required: true },
        { category: 'Input Validation', description: 'All inputs are validated and sanitized', required: true },
        { category: 'Logging', description: 'Security events are logged appropriately', required: true }
      ],
      architecture_review: [
        { category: 'Scalability', description: 'Design can handle expected load', required: true },
        { category: 'Maintainability', description: 'Architecture is maintainable long-term', required: true },
        { category: 'Dependencies', description: 'External dependencies are justified and minimal', required: true },
        { category: 'Standards', description: 'Follows architectural patterns and standards', required: true },
        { category: 'Documentation', description: 'Architecture is well documented', required: true }
      ]
    };
    
    const template = checklistTemplates[this.reviewType || 'code_review'] || checklistTemplates.code_review;
    
    this.checklistItems = template.map((item, index) => ({
      id: `checklist-${index}`,
      category: item.category,
      description: item.description,
      required: item.required,
      checked: false
    }));
  }

  private async coordinateReviewProcess(): Promise<void> {
    // Simulate reviewers working on the review
    if (!this.reviewers) return;
    
    for (const reviewer of this.reviewers) {
      if (reviewer.status === 'pending') {
        // Simulate reviewer starting
        reviewer.status = 'in_progress';
        reviewer.startedAt = new Date();
        
        // Simulate review duration
        const reviewDuration = Math.random() * 120 + 30; // 30-150 minutes
        await this.simulateReviewStep(`${reviewer.userId} reviewing`, reviewDuration * 60 * 1000);
        
        // Generate mock comments for this reviewer
        await this.generateMockReviewComments(reviewer.userId);
        
        // Complete reviewer
        reviewer.status = 'completed';
        reviewer.completedAt = new Date();
        reviewer.timeSpent = Math.floor(reviewDuration);
        
        this.updateReviewMetrics();
      }
    }
  }

  private async generateMockReviewComments(reviewerId: string): Promise<void> {
    const commentCount = Math.floor(Math.random() * 8) + 2; // 2-10 comments per reviewer
    
    for (let i = 0; i < commentCount; i++) {
      const commentTypes: NonNullable<Review['comments']>[0]['type'][] = ['suggestion', 'issue', 'question', 'compliment'];
      const severities: NonNullable<Review['comments']>[0]['severity'][] = ['info', 'minor', 'major', 'critical'];
      const categories: NonNullable<Review['comments']>[0]['category'][] = ['logic', 'performance', 'security', 'style', 'documentation', 'testing'];
      
      const comment: NonNullable<Review['comments']>[0] = {
        id: `comment-${reviewerId}-${i}`,
        reviewerId,
        type: commentTypes[Math.floor(Math.random() * commentTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        content: this.generateMockCommentContent(),
        resolved: Math.random() < 0.3, // 30% already resolved
        createdAt: new Date(),
        line: Math.floor(Math.random() * 100) + 1
      };
      
      if (comment.type === 'suggestion') {
        comment.suggestion = 'Consider using a more efficient algorithm here.';
      }
      
      if (comment.type === 'issue' && comment.severity === 'critical') {
        comment.type = 'blocking';
      }
      
      this.comments!.push(comment);
    }
  }

  private generateMockCommentContent(): string {
    const comments = [
      'This function could be simplified by extracting common logic.',
      'Consider adding error handling for this edge case.',
      'The variable naming could be more descriptive.',
      'Great use of the design pattern here!',
      'This might cause a performance bottleneck with large datasets.',
      'Should we add unit tests for this new functionality?',
      'The documentation could be more comprehensive.',
      'Potential security vulnerability in user input handling.',
      'Consider using const instead of let here.',
      'This logic seems duplicated from another module.'
    ];
    
    return comments[Math.floor(Math.random() * comments.length)];
  }

  private updateReviewMetrics(): void {
    if (!this.reviewMetrics || !this.reviewers || !this.comments) return;
    
    // Update completion metrics
    this.reviewMetrics.completedReviewers = this.reviewers.filter(r => r.status === 'completed').length;
    this.reviewMetrics.reviewCompletionRate = (this.reviewMetrics.completedReviewers / this.reviewMetrics.totalReviewers) * 100;
    
    // Update comment metrics
    this.reviewMetrics.totalComments = this.comments.length;
    this.reviewMetrics.blockers = this.comments.filter(c => c.type === 'blocking').length;
    this.reviewMetrics.suggestions = this.comments.filter(c => c.type === 'suggestion').length;
    this.reviewMetrics.issues = this.comments.filter(c => c.type === 'issue').length;
    
    // Calculate average review time
    const completedReviewers = this.reviewers.filter(r => r.status === 'completed' && r.timeSpent);
    if (completedReviewers.length > 0) {
      this.reviewMetrics.averageReviewTime = completedReviewers.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / completedReviewers.length;
    }
    
    // Calculate thoroughness
    if (this.reviewMetrics.linesReviewed > 0) {
      this.reviewMetrics.thoroughness = this.reviewMetrics.totalComments / this.reviewMetrics.linesReviewed * 1000; // Comments per 1000 lines
    }
  }

  private async collectFeedback(): Promise<void> {
    // Synthesize all feedback into quality assessment
    this.generateQualityAssessment();
    
    // Update checklist based on comments
    this.updateChecklistFromComments();
  }

  private generateQualityAssessment(): void {
    const criticalIssues = this.comments?.filter(c => c.severity === 'critical').length || 0;
    const majorIssues = this.comments?.filter(c => c.severity === 'major').length || 0;
    const minorIssues = this.comments?.filter(c => c.severity === 'minor').length || 0;
    const suggestions = this.comments?.filter(c => c.type === 'suggestion').length || 0;
    const compliments = this.comments?.filter(c => c.type === 'compliment').length || 0;
    
    // Calculate overall score (1-10)
    let score = 8; // Start with good score
    score -= criticalIssues * 2;
    score -= majorIssues * 1;
    score -= minorIssues * 0.3;
    score += compliments * 0.2;
    score = Math.max(1, Math.min(10, score));
    
    // Generate category scores
    const categories = {
      codeQuality: Math.max(1, 8 - criticalIssues - majorIssues * 0.5),
      maintainability: Math.max(1, 8 - (this.comments?.filter(c => c.category === 'logic').length || 0) * 0.5),
      performance: Math.max(1, 8 - (this.comments?.filter(c => c.category === 'performance').length || 0)),
      security: Math.max(1, 8 - (this.comments?.filter(c => c.category === 'security').length || 0) * 2),
      testability: Math.max(1, 8 - (this.comments?.filter(c => c.category === 'testing').length || 0)),
      documentation: Math.max(1, 8 - (this.comments?.filter(c => c.category === 'documentation').length || 0) * 0.5)
    };
    
    // Generate strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    if (compliments > 0) strengths.push('Well-structured and readable code');
    if (categories.security >= 8) strengths.push('Strong security practices');
    if (categories.performance >= 8) strengths.push('Good performance considerations');
    
    if (criticalIssues > 0) weaknesses.push('Critical security or logic issues');
    if (majorIssues > 2) weaknesses.push('Multiple significant issues requiring attention');
    if (categories.documentation < 6) weaknesses.push('Insufficient documentation');
    
    this.qualityAssessment = {
      overallScore: Math.round(score * 10) / 10,
      categories,
      strengths,
      weaknesses,
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const blockers = this.reviewMetrics?.blockers || 0;
    const criticalSeverity = this.comments?.filter(c => c.severity === 'critical').length || 0;
    const securityIssues = this.comments?.filter(c => c.category === 'security').length || 0;
    
    if (blockers > 0) {
      recommendations.push('Address all blocking issues before proceeding');
    }
    
    if (criticalSeverity > 0) {
      recommendations.push('Fix critical issues as highest priority');
    }
    
    if (securityIssues > 0) {
      recommendations.push('Conduct additional security review');
    }
    
    if ((this.reviewMetrics?.thoroughness || 0) < 5) {
      recommendations.push('Consider more detailed review for complex sections');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Overall good quality, ready for deployment');
    }
    
    return recommendations;
  }

  private updateChecklistFromComments(): void {
    if (!this.checklistItems || !this.comments) return;
    
    // Auto-check items based on comments
    for (const item of this.checklistItems) {
      const relatedComments = this.comments.filter(c => 
        c.category?.toLowerCase() === item.category.toLowerCase()
      );
      
      // If no major issues in this category, consider it checked
      const majorIssues = relatedComments.filter(c => 
        c.severity === 'major' || c.severity === 'critical'
      );
      
      if (majorIssues.length === 0 && !item.checked) {
        item.checked = true;
        item.checkedBy = 'system';
        item.checkedAt = new Date();
        item.notes = 'Auto-checked based on review comments';
      }
    }
  }

  private async makeFinalDecision(): Promise<void> {
    const blockers = this.comments?.filter(c => c.type === 'blocking').length || 0;
    const criticalIssues = this.comments?.filter(c => c.severity === 'critical').length || 0;
    const requiredChecklistItems = this.checklistItems?.filter(item => item.required) || [];
    const uncheckedRequired = requiredChecklistItems.filter(item => !item.checked);
    
    let decision: NonNullable<Review['approvalStatus']>['finalDecision'];
    
    if (blockers > 0 || criticalIssues > 0 || uncheckedRequired.length > 0) {
      decision = 'needs_revision';
    } else if (this.qualityAssessment?.overallScore && this.qualityAssessment.overallScore >= 7) {
      decision = 'approved';
    } else {
      decision = 'needs_revision';
    }
    
    // Update approval status
    const approvedReviewers = this.reviewers?.filter(r => r.status === 'completed').length || 0;
    const totalReviewers = this.reviewers?.length || 0;
    
    this.approvalStatus = {
      required: totalReviewers,
      approved: decision === 'approved' ? approvedReviewers : 0,
      rejected: decision === 'rejected' ? 1 : 0,
      pending: totalReviewers - approvedReviewers,
      finalDecision: decision,
      decisionMadeAt: new Date(),
      decisionMadeBy: 'system',
      consensus: decision === 'approved',
      unanimity: decision === 'approved' && approvedReviewers === totalReviewers
    };
  }

  private async createFollowUpActions(): Promise<void> {
    if (!this.comments) return;
    
    const followUpActions: NonNullable<Review['followUpActions']> = [];
    
    // Create actions for blocking and critical issues
    const criticalComments = this.comments.filter(c => 
      c.type === 'blocking' || c.severity === 'critical'
    );
    
    for (const comment of criticalComments) {
      followUpActions.push({
        id: `action-${comment.id}`,
        type: comment.category === 'security' ? 'fix' : 'fix',
        description: `Address: ${comment.content}`,
        priority: 'critical',
        status: 'pending',
        createdBy: 'system',
        createdAt: new Date(),
        relatedCommentId: comment.id
      });
    }
    
    // Create actions for suggestions
    const suggestionComments = this.comments.filter(c => c.type === 'suggestion');
    for (const comment of suggestionComments.slice(0, 3)) { // Limit to top 3
      followUpActions.push({
        id: `action-${comment.id}`,
        type: 'refactor',
        description: comment.suggestion || comment.content,
        priority: 'medium',
        status: 'pending',
        createdBy: 'system',
        createdAt: new Date(),
        relatedCommentId: comment.id
      });
    }
    
    this.followUpActions = followUpActions;
  }

  private async simulateReviewStep(stepName: string, duration: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`Completed: ${stepName}`);
        resolve();
      }, Math.random() * duration);
    });
  }

  // Helper methods for validation
  private areReviewersAssigned(): boolean {
    return this.reviewers?.some(r => r.assigned) ?? false;
  }

  private isContentReady(): boolean {
    // Check if content to be reviewed is available
    return this.reviewItems?.length ? this.reviewItems.length > 0 : true;
  }

  private areReviewToolsReady(): boolean {
    // Check if required review tools are accessible
    return Math.random() > 0.02; // 98% readiness simulation
  }

  // Review management methods
  isCodeReview(): boolean {
    return this.reviewType === 'code_review';
  }

  isSecurityReview(): boolean {
    return this.reviewType === 'security_review';
  }

  hasBlockingIssues(): boolean {
    return (this.comments?.filter(c => c.type === 'blocking').length || 0) > 0;
  }

  hasCriticalIssues(): boolean {
    return (this.comments?.filter(c => c.severity === 'critical').length || 0) > 0;
  }

  getUnresolvedIssuesCount(): number {
    return this.comments?.filter(c => !c.resolved && (c.type === 'issue' || c.type === 'blocking')).length || 0;
  }

  getReviewProgress(): { completed: number; total: number; percentage: number } {
    const total = this.reviewers?.length || 0;
    const completed = this.reviewers?.filter(r => r.status === 'completed').length || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  addComment(reviewerId: string, content: string, type: NonNullable<Review['comments']>[0]['type'], severity: NonNullable<Review['comments']>[0]['severity'], itemId?: string, line?: number): void {
    if (!this.comments) {
      this.comments = [];
    }
    
    this.comments.push({
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reviewerId,
      itemId,
      type,
      severity,
      content,
      resolved: false,
      createdAt: new Date(),
      line
    });
    
    this.updateReviewMetrics();
  }

  resolveComment(commentId: string, resolvedBy: string): boolean {
    const comment = this.comments?.find(c => c.id === commentId);
    if (comment && !comment.resolved) {
      comment.resolved = true;
      comment.resolvedBy = resolvedBy;
      comment.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  addCommentThread(commentId: string, userId: string, content: string): boolean {
    const comment = this.comments?.find(c => c.id === commentId);
    if (comment) {
      if (!comment.thread) {
        comment.thread = [];
      }
      comment.thread.push({
        userId,
        content,
        createdAt: new Date()
      });
      return true;
    }
    return false;
  }

  // Review analytics and health
  calculateReviewHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const health = this.getActivityHealth();
    
    // Add review-specific factors
    const reviewFactors: Record<string, number> = {};
    const reviewIssues: string[] = [];
    
    // Review thoroughness
    const thoroughness = this.reviewMetrics?.thoroughness || 0;
    reviewFactors.thoroughness = Math.min(100, thoroughness * 10); // Normalize to 0-100
    if (thoroughness < 2) {
      reviewIssues.push('Review thoroughness is below recommended level');
    }
    
    // Quality assessment
    const qualityScore = this.qualityAssessment?.overallScore || 5;
    reviewFactors.quality = (qualityScore / 10) * 100;
    if (qualityScore < 6) {
      reviewIssues.push('Quality assessment indicates significant issues');
    }
    
    // Issue resolution
    const unresolvedIssues = this.getUnresolvedIssuesCount();
    reviewFactors.issueResolution = Math.max(0, 100 - (unresolvedIssues * 10));
    if (unresolvedIssues > 5) {
      reviewIssues.push('High number of unresolved issues');
    }
    
    // Review completion
    const progress = this.getReviewProgress();
    reviewFactors.completion = progress.percentage;
    if (progress.percentage < 100 && this.isOverdue()) {
      reviewIssues.push('Review is overdue with incomplete reviewers');
    }
    
    // Blocking issues
    if (this.hasBlockingIssues()) {
      reviewIssues.push('Review has blocking issues that prevent approval');
      reviewFactors.blockers = 0;
    } else {
      reviewFactors.blockers = 100;
    }
    
    // Combine with base health factors
    const combinedFactors = { ...health.factors, ...reviewFactors };
    const combinedIssues = [...health.issues, ...reviewIssues];
    
    // Recalculate score with review factors
    const totalScore = Object.values(combinedFactors).reduce((sum, score) => sum + score, 0) / Object.keys(combinedFactors).length;
    
    return {
      score: Math.round(totalScore),
      factors: combinedFactors,
      issues: combinedIssues
    };
  }

  getReviewSummary(): {
    decision: string;
    quality: number;
    issues: number;
    blockers: number;
    reviewerCount: number;
    timeSpent: number;
    efficiency: number;
  } {
    return {
      decision: this.approvalStatus?.finalDecision || 'pending',
      quality: this.qualityAssessment?.overallScore || 0,
      issues: this.comments?.filter(c => c.type === 'issue' || c.type === 'blocking').length || 0,
      blockers: this.reviewMetrics?.blockers || 0,
      reviewerCount: this.reviewers?.length || 0,
      timeSpent: this.reviewMetrics?.averageReviewTime || 0,
      efficiency: this.reviewMetrics?.reviewEfficiency || 0
    };
  }

  requiresSecondReview(): boolean {
    return this.hasBlockingIssues() || 
           this.hasCriticalIssues() || 
           (this.qualityAssessment?.overallScore || 10) < 5;
  }

  canApprove(): boolean {
    return !this.hasBlockingIssues() && 
           !this.hasCriticalIssues() && 
           this.getUnresolvedIssuesCount() === 0 &&
           this.getReviewProgress().percentage === 100;
  }

  getTopReviewCategories(): Array<{ category: string; count: number; percentage: number }> {
    if (!this.comments || this.comments.length === 0) return [];
    
    const categoryCounts: Record<string, number> = {};
    
    for (const comment of this.comments) {
      const category = comment.category || 'other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
    
    return Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / this.comments!.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}