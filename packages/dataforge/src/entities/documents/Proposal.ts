import { Entity, Property } from '@mikro-orm/core';
import { DocumentArchetype } from '../archetypes/DocumentArchetype.js';

/**
 * Business proposal document with approval workflow and decision tracking
 * Extends DocumentArchetype with proposal-specific business logic
 */
@Entity({ tableName: 'proposal' })
export class Proposal extends DocumentArchetype {
  @Property({ nullable: true, fieldName: 'proposal_type' })
  proposalType?: 'business' | 'technical' | 'budget' | 'project' | 'policy' | 'contract' | 'partnership';

  @Property({ type: 'json', nullable: true, fieldName: 'budget_information' })
  budgetInformation?: {
    totalCost?: number;
    currency?: string;
    breakdown?: Array<{
      category: string;
      amount: number;
      description: string;
      justification?: string;
    }>;
    fundingSource?: string;
    paymentSchedule?: Array<{
      milestone: string;
      amount: number;
      dueDate: Date;
    }>;
  };

  @Property({ type: 'json', nullable: true })
  timeline?: {
    proposalDate: Date;
    decisionDeadline?: Date;
    implementationStart?: Date;
    estimatedCompletion?: Date;
    keyMilestones?: Array<{
      name: string;
      date: Date;
      deliverables: string[];
    }>;
  };

  @Property({ type: 'json', nullable: true })
  stakeholders?: Array<{
    name: string;
    role: 'sponsor' | 'approver' | 'implementer' | 'beneficiary' | 'reviewer';
    organization?: string;
    influence: 'high' | 'medium' | 'low';
    supportLevel?: 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
    requirements?: string[];
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'success_criteria' })
  successCriteria?: Array<{
    criterion: string;
    measurable: boolean;
    metric?: string;
    target?: string;
    timeline?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'risk_assessment' })
  riskAssessment?: Array<{
    risk: string;
    category: 'financial' | 'technical' | 'operational' | 'market' | 'regulatory' | 'resource';
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
    contingency?: string;
    owner?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  alternatives?: Array<{
    name: string;
    description: string;
    cost?: number;
    timeline?: string;
    pros: string[];
    cons: string[];
    riskLevel?: 'low' | 'medium' | 'high';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'competitive_analysis' })
  competitiveAnalysis?: {
    competitors?: Array<{
      name: string;
      strengths: string[];
      weaknesses: string[];
      marketShare?: number;
    }>;
    differentiators: string[];
    competitiveAdvantage?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'resource_requirements' })
  resourceRequirements?: {
    personnel?: Array<{
      role: string;
      skillsRequired: string[];
      allocation: string; // e.g., "50%", "3 months"
      cost?: number;
    }>;
    technology?: Array<{
      item: string;
      purpose: string;
      cost?: number;
      vendor?: string;
    }>;
    facilities?: Array<{
      type: string;
      requirements: string;
      cost?: number;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'decision_history' })
  decisionHistory?: Array<{
    date: Date;
    decision: 'approved' | 'rejected' | 'deferred' | 'modified' | 'under_review';
    decisionMaker: string;
    rationale: string;
    conditions?: string[];
    nextSteps?: string[];
  }>;

  @Property({ type: 'json', nullable: true })
  assumptions?: Array<{
    assumption: string;
    category: 'market' | 'technical' | 'financial' | 'operational' | 'regulatory';
    criticality: 'low' | 'medium' | 'high';
    validationMethod?: string;
    validatedBy?: string;
    validatedAt?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'communication_plan' })
  communicationPlan?: Array<{
    audience: string;
    message: string;
    channel: string;
    frequency: string;
    responsible: string;
    timing?: string;
  }>;

  @Property({ nullable: true, fieldName: 'executive_summary' })
  executiveSummary?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'problem_statement' })
  problemStatement?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'proposed_solution' })
  proposedSolution?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'expected_outcomes' })
  expectedOutcomes?: string;

  // Implementation of abstract methods
  getDocumentType(): string {
    return 'proposal';
  }

  async validateDocumentRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Proposal-specific validation
    if (!this.proposalType) {
      return false; // Proposal type is required
    }

    if (!this.problemStatement || this.problemStatement.trim().length === 0) {
      return false; // Must have problem statement
    }

    if (!this.proposedSolution || this.proposedSolution.trim().length === 0) {
      return false; // Must have proposed solution
    }

    // Budget validation if provided
    if (this.budgetInformation?.totalCost && this.budgetInformation.totalCost <= 0) {
      return false; // Budget must be positive
    }

    // Timeline validation
    if (this.timeline?.decisionDeadline && this.timeline.decisionDeadline <= new Date()) {
      return false; // Decision deadline must be in the future
    }

    return true;
  }

  async generatePreview(): Promise<string> {
    const preview: string[] = [];

    preview.push(`PROPOSAL: ${this.title}`);
    preview.push(`Type: ${this.proposalType || 'General'}`);
    preview.push('');

    if (this.executiveSummary) {
      preview.push('EXECUTIVE SUMMARY:');
      preview.push(this.executiveSummary.substring(0, 200) + '...');
      preview.push('');
    }

    if (this.problemStatement) {
      preview.push('PROBLEM STATEMENT:');
      preview.push(this.problemStatement.substring(0, 300) + '...');
      preview.push('');
    }

    if (this.proposedSolution) {
      preview.push('PROPOSED SOLUTION:');
      preview.push(this.proposedSolution.substring(0, 300) + '...');
      preview.push('');
    }

    // Budget summary
    if (this.budgetInformation?.totalCost) {
      preview.push(`BUDGET: ${this.budgetInformation.currency || '$'}${this.budgetInformation.totalCost.toLocaleString()}`);
    }

    // Timeline summary
    if (this.timeline?.decisionDeadline) {
      preview.push(`DECISION DEADLINE: ${this.timeline.decisionDeadline.toDateString()}`);
    }

    return preview.join('\n');
  }

  async processContentForExport(format: string): Promise<string> {
    const content: string[] = [];

    // Header
    content.push(`# ${this.title}`);
    content.push(`**Type:** ${this.proposalType || 'General'}`);
    content.push(`**Status:** ${this.status || 'Draft'}`);
    content.push('');

    // Executive Summary
    if (this.executiveSummary) {
      content.push('## Executive Summary');
      content.push(this.executiveSummary);
      content.push('');
    }

    // Problem Statement
    if (this.problemStatement) {
      content.push('## Problem Statement');
      content.push(this.problemStatement);
      content.push('');
    }

    // Proposed Solution
    if (this.proposedSolution) {
      content.push('## Proposed Solution');
      content.push(this.proposedSolution);
      content.push('');
    }

    // Expected Outcomes
    if (this.expectedOutcomes) {
      content.push('## Expected Outcomes');
      content.push(this.expectedOutcomes);
      content.push('');
    }

    // Budget Information
    if (this.budgetInformation) {
      content.push('## Budget Information');
      if (this.budgetInformation.totalCost) {
        content.push(`**Total Cost:** ${this.budgetInformation.currency || '$'}${this.budgetInformation.totalCost.toLocaleString()}`);
      }
      if (this.budgetInformation.breakdown) {
        content.push('### Budget Breakdown:');
        this.budgetInformation.breakdown.forEach(item => {
          content.push(`- **${item.category}:** ${this.budgetInformation?.currency || '$'}${item.amount.toLocaleString()} - ${item.description}`);
        });
      }
      content.push('');
    }

    // Timeline
    if (this.timeline) {
      content.push('## Timeline');
      if (this.timeline.decisionDeadline) {
        content.push(`**Decision Deadline:** ${this.timeline.decisionDeadline.toDateString()}`);
      }
      if (this.timeline.implementationStart) {
        content.push(`**Implementation Start:** ${this.timeline.implementationStart.toDateString()}`);
      }
      if (this.timeline.estimatedCompletion) {
        content.push(`**Estimated Completion:** ${this.timeline.estimatedCompletion.toDateString()}`);
      }
      content.push('');
    }

    // Success Criteria
    if (this.successCriteria && this.successCriteria.length > 0) {
      content.push('## Success Criteria');
      this.successCriteria.forEach((criterion, index) => {
        content.push(`${index + 1}. ${criterion.criterion}`);
        if (criterion.target) content.push(`   - Target: ${criterion.target}`);
      });
      content.push('');
    }

    // Risk Assessment
    if (this.riskAssessment && this.riskAssessment.length > 0) {
      content.push('## Risk Assessment');
      this.riskAssessment.forEach(risk => {
        content.push(`- **${risk.risk}** (${risk.category})`);
        content.push(`  - Probability: ${risk.probability}, Impact: ${risk.impact}`);
        content.push(`  - Mitigation: ${risk.mitigation}`);
      });
      content.push('');
    }

    // Main Content
    if (this.content) {
      content.push('## Additional Details');
      content.push(this.content);
    }

    const fullContent = content.join('\n');

    // Format-specific processing
    switch (format) {
      case 'html':
        // Convert markdown to HTML (simplified)
        return fullContent
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n/g, '<br>');
      case 'json':
        return JSON.stringify({
          title: this.title,
          type: this.proposalType,
          content: fullContent,
          metadata: {
            budget: this.budgetInformation,
            timeline: this.timeline,
            risks: this.riskAssessment,
            criteria: this.successCriteria
          }
        }, null, 2);
      default:
        return fullContent;
    }
  }

  // Proposal-specific business logic
  addBudgetItem(category: string, amount: number, description: string, justification?: string): void {
    if (!this.budgetInformation) {
      this.budgetInformation = { breakdown: [] };
    }
    if (!this.budgetInformation.breakdown) {
      this.budgetInformation.breakdown = [];
    }

    this.budgetInformation.breakdown.push({
      category,
      amount,
      description,
      justification
    });

    // Update total cost
    this.budgetInformation.totalCost = this.budgetInformation.breakdown.reduce(
      (total, item) => total + item.amount, 0
    );
  }

  addStakeholder(name: string, role: NonNullable<Proposal['stakeholders']>[0]['role'], influence: NonNullable<Proposal['stakeholders']>[0]['influence'], organization?: string): void {
    if (!this.stakeholders) {
      this.stakeholders = [];
    }

    this.stakeholders.push({
      name,
      role,
      organization,
      influence,
      requirements: []
    });
  }

  addRisk(risk: string, category: NonNullable<Proposal['riskAssessment']>[0]['category'], probability: NonNullable<Proposal['riskAssessment']>[0]['probability'], impact: NonNullable<Proposal['riskAssessment']>[0]['impact'], mitigation: string): void {
    if (!this.riskAssessment) {
      this.riskAssessment = [];
    }

    this.riskAssessment.push({
      risk,
      category,
      probability,
      impact,
      mitigation
    });
  }

  addSuccessCriterion(criterion: string, measurable: boolean, metric?: string, target?: string): void {
    if (!this.successCriteria) {
      this.successCriteria = [];
    }

    this.successCriteria.push({
      criterion,
      measurable,
      metric,
      target
    });
  }

  addDecision(decision: NonNullable<Proposal['decisionHistory']>[0]['decision'], decisionMaker: string, rationale: string, conditions?: string[]): void {
    if (!this.decisionHistory) {
      this.decisionHistory = [];
    }

    this.decisionHistory.push({
      date: new Date(),
      decision,
      decisionMaker,
      rationale,
      conditions
    });

    // Update document status based on decision
    switch (decision) {
      case 'approved':
        this.status = 'approved';
        break;
      case 'rejected':
        this.status = 'rejected';
        break;
      case 'under_review':
        this.status = 'pending_approval';
        break;
      case 'deferred':
        this.status = 'deferred';
        break;
    }
  }

  getTotalBudget(): number {
    return this.budgetInformation?.totalCost || 0;
  }

  getHighRisks(): NonNullable<Proposal['riskAssessment']> {
    return this.riskAssessment?.filter(risk => 
      risk.probability === 'high' || risk.impact === 'high'
    ) || [];
  }

  getKeyStakeholders(): NonNullable<Proposal['stakeholders']> {
    return this.stakeholders?.filter(stakeholder => 
      stakeholder.influence === 'high'
    ) || [];
  }

  isApproved(): boolean {
    return this.decisionHistory?.some(d => d.decision === 'approved') ?? false;
  }

  isRejected(): boolean {
    return this.decisionHistory?.some(d => d.decision === 'rejected') ?? false;
  }

  isPendingDecision(): boolean {
    const hasDecision = this.decisionHistory && this.decisionHistory.length > 0;
    return !hasDecision || (this.decisionHistory?.some(d => d.decision === 'under_review') ?? false);
  }

  getProposalHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Completeness (40%)
    factors.completeness = this.calculateCompletenessScore();
    if (factors.completeness < 70) {
      issues.push('Proposal lacks important details');
    }

    // Feasibility (30%)
    factors.feasibility = this.calculateFeasibilityScore();
    if (factors.feasibility < 60) {
      issues.push('Proposal feasibility concerns identified');
    }

    // Stakeholder alignment (30%)
    factors.stakeholderAlignment = this.calculateStakeholderScore();
    if (factors.stakeholderAlignment < 60) {
      issues.push('Stakeholder support needs improvement');
    }

    const totalScore = 
      factors.completeness * 0.4 + 
      factors.feasibility * 0.3 + 
      factors.stakeholderAlignment * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateCompletenessScore(): number {
    let score = 0;

    // Core sections
    if (this.problemStatement) score += 20;
    if (this.proposedSolution) score += 20;
    if (this.expectedOutcomes) score += 15;
    if (this.executiveSummary) score += 10;

    // Budget information
    if (this.budgetInformation?.totalCost) score += 10;
    if (this.budgetInformation?.breakdown?.length) score += 5;

    // Timeline
    if (this.timeline?.decisionDeadline) score += 5;
    if (this.timeline?.implementationStart) score += 5;

    // Supporting details
    if (this.successCriteria?.length) score += 5;
    if (this.riskAssessment?.length) score += 5;

    return Math.min(100, score);
  }

  private calculateFeasibilityScore(): number {
    let score = 70; // Base feasibility score

    // Budget realism
    if (this.budgetInformation?.breakdown?.length) score += 10;
    
    // Risk assessment
    const highRisks = this.getHighRisks().length;
    score -= highRisks * 5; // Penalty for high risks

    // Timeline realism
    if (this.timeline?.implementationStart && this.timeline?.estimatedCompletion) {
      const timespan = this.timeline.estimatedCompletion.getTime() - this.timeline.implementationStart.getTime();
      const months = timespan / (1000 * 60 * 60 * 24 * 30);
      if (months < 1) score -= 15; // Too aggressive
      else if (months > 24) score -= 10; // Too long
      else score += 10; // Reasonable timeframe
    }

    // Resource requirements
    if (this.resourceRequirements?.personnel?.length) score += 5;
    if (this.resourceRequirements?.technology?.length) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateStakeholderScore(): number {
    let score = 50; // Base score

    if (!this.stakeholders || this.stakeholders.length === 0) return 20;

    // Stakeholder diversity
    const roles = new Set(this.stakeholders.map(s => s.role));
    score += Math.min(20, roles.size * 5);

    // High influence stakeholder support
    const highInfluenceStakeholders = this.stakeholders.filter(s => s.influence === 'high');
    const supportiveHighInfluence = highInfluenceStakeholders.filter(s => 
      s.supportLevel === 'champion' || s.supportLevel === 'supporter'
    ).length;
    
    if (highInfluenceStakeholders.length > 0) {
      score += (supportiveHighInfluence / highInfluenceStakeholders.length) * 30;
    }

    return Math.max(0, Math.min(100, score));
  }
}