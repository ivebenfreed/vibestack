import { Entity, Property } from '@mikro-orm/core';
import { RecordArchetype } from '../archetypes/RecordArchetype.js';

/**
 * Technical specification with requirements and architecture documentation
 * Extends RecordArchetype with technical documentation workflows
 */
@Entity({ tableName: 'technical_specification' })
export class TechnicalSpecification extends RecordArchetype {
  @Property({ nullable: true, fieldName: 'spec_type' })
  specType?: 'system' | 'api' | 'database' | 'interface' | 'security' | 'performance' | 'integration';

  @Property({ type: 'json', nullable: true })
  requirements?: {
    functional?: Array<{
      id: string;
      description: string;
      priority: 'must_have' | 'should_have' | 'could_have' | 'wont_have';
      status: 'draft' | 'approved' | 'implemented' | 'tested' | 'rejected';
      acceptanceCriteria?: string[];
      dependencies?: string[];
    }>;
    nonFunctional?: Array<{
      id: string;
      category: 'performance' | 'security' | 'usability' | 'reliability' | 'scalability' | 'maintainability';
      description: string;
      metric?: string;
      target?: string;
      status: 'draft' | 'approved' | 'implemented' | 'tested' | 'rejected';
    }>;
  };

  @Property({ type: 'json', nullable: true })
  architecture?: {
    components?: Array<{
      name: string;
      type: 'service' | 'database' | 'api' | 'ui' | 'library' | 'external';
      description: string;
      responsibilities: string[];
      interfaces?: Array<{
        name: string;
        type: 'rest' | 'graphql' | 'grpc' | 'message_queue' | 'database';
        description: string;
      }>;
      dependencies?: string[];
    }>;
    dataFlow?: Array<{
      from: string;
      to: string;
      description: string;
      protocol?: string;
      dataFormat?: string;
    }>;
    deploymentModel?: {
      environment: 'cloud' | 'on_premise' | 'hybrid';
      infrastructure: string[];
      scalingStrategy?: string;
    };
  };

  @Property({ type: 'json', nullable: true })
  dependencies?: Array<{
    name: string;
    type: 'internal' | 'external' | 'third_party';
    version?: string;
    description: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
    alternatives?: string[];
  }>;

  @Property({ nullable: true, fieldName: 'review_status' })
  reviewStatus?: 'pending' | 'in_review' | 'approved' | 'needs_changes' | 'rejected';

  @Property({ type: 'json', nullable: true })
  reviewers?: Array<{
    userId: string;
    role: 'architect' | 'developer' | 'security' | 'qa' | 'product' | 'devops';
    status: 'pending' | 'approved' | 'needs_changes' | 'rejected';
    comments?: string;
    reviewedAt?: Date;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'implementation_plan' })
  implementationPlan?: {
    phases?: Array<{
      name: string;
      description: string;
      duration?: string;
      dependencies?: string[];
      deliverables: string[];
      risks?: Array<{
        description: string;
        probability: 'low' | 'medium' | 'high';
        impact: 'low' | 'medium' | 'high';
        mitigation: string;
      }>;
    }>;
    timeline?: {
      startDate?: Date;
      endDate?: Date;
      milestones?: Array<{
        name: string;
        date: Date;
        deliverables: string[];
      }>;
    };
    resources?: Array<{
      role: string;
      allocation: string; // e.g., "50%", "2 weeks"
      skills: string[];
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'testing_strategy' })
  testingStrategy?: {
    approaches?: string[]; // unit, integration, e2e, performance, security
    testData?: string;
    environments?: string[];
    automation?: {
      framework?: string;
      coverage?: string;
      pipeline?: string;
    };
    acceptanceCriteria?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'security_considerations' })
  securityConsiderations?: {
    threats?: Array<{
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      mitigation: string;
      status: 'identified' | 'mitigated' | 'accepted' | 'transferred';
    }>;
    compliance?: string[]; // GDPR, HIPAA, SOX, etc.
    authentication?: string;
    authorization?: string;
    dataProtection?: string[];
  };

  @Property({ type: 'json', nullable: true, fieldName: 'api_specification' })
  apiSpecification?: {
    endpoints?: Array<{
      path: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      description: string;
      parameters?: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
      requestBody?: any;
      responses?: Record<string, any>;
      authentication?: string[];
    }>;
    schemas?: Record<string, any>;
    baseUrl?: string;
    version?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'database_design' })
  databaseDesign?: {
    entities?: Array<{
      name: string;
      description: string;
      attributes: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
      relationships?: Array<{
        target: string;
        type: 'one_to_one' | 'one_to_many' | 'many_to_many';
        description: string;
      }>;
      indexes?: string[];
    }>;
    migrations?: Array<{
      version: string;
      description: string;
      operations: string[];
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'change_log' })
  changeLog?: Array<{
    version: string;
    date: Date;
    author: string;
    changes: string[];
    impact?: 'breaking' | 'feature' | 'bug_fix' | 'documentation';
  }>;

  // Implementation of abstract methods
  getRecordType(): string {
    return 'technical_specification';
  }

  async validateRecordRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Technical specification validation
    if (!this.specType) {
      return false; // Specification type is required
    }

    // Must have at least functional or non-functional requirements
    if (!this.requirements?.functional?.length && !this.requirements?.nonFunctional?.length) {
      return false;
    }

    // Validate requirement IDs are unique
    if (this.requirements?.functional) {
      const functionalIds = this.requirements.functional.map(r => r.id);
      if (new Set(functionalIds).size !== functionalIds.length) {
        return false; // Duplicate functional requirement IDs
      }
    }

    if (this.requirements?.nonFunctional) {
      const nonFunctionalIds = this.requirements.nonFunctional.map(r => r.id);
      if (new Set(nonFunctionalIds).size !== nonFunctionalIds.length) {
        return false; // Duplicate non-functional requirement IDs
      }
    }

    return true;
  }

  async processContent(): Promise<void> {
    // Process technical specification content for better searchability
    const contentParts: string[] = [];

    // Add basic information
    contentParts.push(`Technical Specification: ${this.title}`);
    contentParts.push(`Type: ${this.specType || 'General'}`);

    // Add requirements
    if (this.requirements?.functional) {
      contentParts.push('Functional Requirements:');
      this.requirements.functional.forEach(req => {
        contentParts.push(`- ${req.id}: ${req.description}`);
        if (req.acceptanceCriteria) {
          req.acceptanceCriteria.forEach(criteria => {
            contentParts.push(`  AC: ${criteria}`);
          });
        }
      });
    }

    if (this.requirements?.nonFunctional) {
      contentParts.push('Non-Functional Requirements:');
      this.requirements.nonFunctional.forEach(req => {
        contentParts.push(`- ${req.id}: ${req.description} (${req.category})`);
        if (req.target) contentParts.push(`  Target: ${req.target}`);
      });
    }

    // Add architecture components
    if (this.architecture?.components) {
      contentParts.push('Architecture Components:');
      this.architecture.components.forEach(comp => {
        contentParts.push(`- ${comp.name}: ${comp.description}`);
        comp.responsibilities.forEach(resp => {
          contentParts.push(`  * ${resp}`);
        });
      });
    }

    // Add dependencies
    if (this.dependencies) {
      contentParts.push('Dependencies:');
      this.dependencies.forEach(dep => {
        contentParts.push(`- ${dep.name}: ${dep.description} (${dep.type})`);
      });
    }

    // Add original content
    if (this.content) {
      contentParts.push('Detailed Specification:');
      contentParts.push(this.content);
    }

    this.searchContent = contentParts.join('\n').toLowerCase();
    await this.generateKeywords();
  }

  async generateSummary(): Promise<string> {
    const summaryParts: string[] = [];

    summaryParts.push(`${this.specType || 'Technical'} specification`);

    // Count requirements
    const functionalCount = this.requirements?.functional?.length || 0;
    const nonFunctionalCount = this.requirements?.nonFunctional?.length || 0;
    const totalRequirements = functionalCount + nonFunctionalCount;

    if (totalRequirements > 0) {
      summaryParts.push(`${totalRequirements} requirement${totalRequirements !== 1 ? 's' : ''}`);
      if (functionalCount > 0 && nonFunctionalCount > 0) {
        summaryParts.push(`(${functionalCount} functional, ${nonFunctionalCount} non-functional)`);
      }
    }

    // Architecture complexity
    const componentCount = this.architecture?.components?.length || 0;
    if (componentCount > 0) {
      summaryParts.push(`${componentCount} component${componentCount !== 1 ? 's' : ''}`);
    }

    // Review status
    if (this.reviewStatus) {
      summaryParts.push(`Status: ${this.reviewStatus.replace('_', ' ')}`);
    }

    // Implementation timeline
    if (this.implementationPlan?.timeline?.endDate) {
      const endDate = this.implementationPlan.timeline.endDate;
      summaryParts.push(`Target completion: ${endDate.toDateString()}`);
    }

    this.summary = summaryParts.join(', ') + '.';
    return this.summary;
  }

  // Technical specification business logic
  private async generateKeywords(): Promise<void> {
    const keywords: Set<string> = new Set();

    // Add spec type
    if (this.specType) keywords.add(this.specType);

    // Add component names
    this.architecture?.components?.forEach(comp => {
      keywords.add(comp.name.toLowerCase());
      keywords.add(comp.type);
    });

    // Add dependency names
    this.dependencies?.forEach(dep => {
      keywords.add(dep.name.toLowerCase());
      keywords.add(dep.type);
    });

    // Add requirement categories
    this.requirements?.nonFunctional?.forEach(req => {
      keywords.add(req.category);
    });

    // Add technology keywords from API spec
    if (this.apiSpecification?.endpoints) {
      this.apiSpecification.endpoints.forEach(endpoint => {
        endpoint.method && keywords.add(endpoint.method.toLowerCase());
      });
    }

    this.keywords = Array.from(keywords);
  }

  // Requirement management
  addFunctionalRequirement(id: string, description: string, priority: NonNullable<NonNullable<TechnicalSpecification['requirements']>['functional']>[0]['priority'], acceptanceCriteria?: string[]): void {
    if (!this.requirements) {
      this.requirements = {};
    }
    if (!this.requirements.functional) {
      this.requirements.functional = [];
    }

    this.requirements.functional.push({
      id,
      description,
      priority,
      status: 'draft',
      acceptanceCriteria,
      dependencies: []
    });
  }

  addNonFunctionalRequirement(id: string, category: NonNullable<NonNullable<TechnicalSpecification['requirements']>['nonFunctional']>[0]['category'], description: string, target?: string): void {
    if (!this.requirements) {
      this.requirements = {};
    }
    if (!this.requirements.nonFunctional) {
      this.requirements.nonFunctional = [];
    }

    this.requirements.nonFunctional.push({
      id,
      category,
      description,
      metric: target,
      target,
      status: 'draft'
    });
  }

  updateRequirementStatus(requirementId: string, status: NonNullable<NonNullable<TechnicalSpecification['requirements']>['functional']>[0]['status']): void {
    // Update functional requirement
    const functionalReq = this.requirements?.functional?.find(r => r.id === requirementId);
    if (functionalReq) {
      functionalReq.status = status;
      return;
    }

    // Update non-functional requirement
    const nonFunctionalReq = this.requirements?.nonFunctional?.find(r => r.id === requirementId);
    if (nonFunctionalReq) {
      nonFunctionalReq.status = status;
    }
  }

  getRequirementStats(): { total: number; draft: number; approved: number; implemented: number; tested: number } {
    const functional = this.requirements?.functional || [];
    const nonFunctional = this.requirements?.nonFunctional || [];
    const allRequirements = [...functional, ...nonFunctional];

    const stats = {
      total: allRequirements.length,
      draft: 0,
      approved: 0,
      implemented: 0,
      tested: 0
    };

    allRequirements.forEach(req => {
      switch (req.status) {
        case 'draft': stats.draft++; break;
        case 'approved': stats.approved++; break;
        case 'implemented': stats.implemented++; break;
        case 'tested': stats.tested++; break;
      }
    });

    return stats;
  }

  // Architecture management
  addComponent(name: string, type: NonNullable<NonNullable<TechnicalSpecification['architecture']>['components']>[0]['type'], description: string, responsibilities: string[]): void {
    if (!this.architecture) {
      this.architecture = {};
    }
    if (!this.architecture.components) {
      this.architecture.components = [];
    }

    this.architecture.components.push({
      name,
      type,
      description,
      responsibilities,
      interfaces: [],
      dependencies: []
    });
  }

  addDataFlow(from: string, to: string, description: string, protocol?: string, dataFormat?: string): void {
    if (!this.architecture) {
      this.architecture = {};
    }
    if (!this.architecture.dataFlow) {
      this.architecture.dataFlow = [];
    }

    this.architecture.dataFlow.push({
      from,
      to,
      description,
      protocol,
      dataFormat
    });
  }

  // Review management
  addReviewer(userId: string, role: NonNullable<TechnicalSpecification['reviewers']>[0]['role']): void {
    if (!this.reviewers) {
      this.reviewers = [];
    }

    // Check if reviewer already exists
    const existingReviewer = this.reviewers.find(r => r.userId === userId);
    if (!existingReviewer) {
      this.reviewers.push({
        userId,
        role,
        status: 'pending'
      });
    }
  }

  submitReview(userId: string, status: NonNullable<TechnicalSpecification['reviewers']>[0]['status'], comments?: string): void {
    const reviewer = this.reviewers?.find(r => r.userId === userId);
    if (reviewer) {
      reviewer.status = status;
      reviewer.comments = comments;
      reviewer.reviewedAt = new Date();
    }

    // Update overall review status
    this.updateOverallReviewStatus();
  }

  private updateOverallReviewStatus(): void {
    if (!this.reviewers || this.reviewers.length === 0) {
      this.reviewStatus = 'pending';
      return;
    }

    const pendingReviews = this.reviewers.filter(r => r.status === 'pending').length;
    const approvedReviews = this.reviewers.filter(r => r.status === 'approved').length;
    const rejectedReviews = this.reviewers.filter(r => r.status === 'rejected').length;
    const needsChanges = this.reviewers.filter(r => r.status === 'needs_changes').length;

    if (rejectedReviews > 0) {
      this.reviewStatus = 'rejected';
    } else if (needsChanges > 0) {
      this.reviewStatus = 'needs_changes';
    } else if (pendingReviews > 0) {
      this.reviewStatus = 'in_review';
    } else if (approvedReviews === this.reviewers.length) {
      this.reviewStatus = 'approved';
    }
  }

  getReviewProgress(): { total: number; pending: number; approved: number; needsChanges: number; rejected: number } {
    if (!this.reviewers) return { total: 0, pending: 0, approved: 0, needsChanges: 0, rejected: 0 };

    const stats = {
      total: this.reviewers.length,
      pending: 0,
      approved: 0,
      needsChanges: 0,
      rejected: 0
    };

    this.reviewers.forEach(reviewer => {
      switch (reviewer.status) {
        case 'pending': stats.pending++; break;
        case 'approved': stats.approved++; break;
        case 'needs_changes': stats.needsChanges++; break;
        case 'rejected': stats.rejected++; break;
      }
    });

    return stats;
  }

  // Implementation planning
  addImplementationPhase(name: string, description: string, duration: string, deliverables: string[]): void {
    if (!this.implementationPlan) {
      this.implementationPlan = {};
    }
    if (!this.implementationPlan.phases) {
      this.implementationPlan.phases = [];
    }

    this.implementationPlan.phases.push({
      name,
      description,
      duration,
      dependencies: [],
      deliverables,
      risks: []
    });
  }

  addRiskToPhase(phaseIndex: number, description: string, probability: NonNullable<NonNullable<NonNullable<TechnicalSpecification['implementationPlan']>['phases']>[0]['risks']>[0]['probability'], impact: NonNullable<NonNullable<NonNullable<TechnicalSpecification['implementationPlan']>['phases']>[0]['risks']>[0]['impact'], mitigation: string): void {
    const phase = this.implementationPlan?.phases?.[phaseIndex];
    if (phase) {
      if (!phase.risks) phase.risks = [];
      phase.risks.push({ description, probability, impact, mitigation });
    }
  }

  // API specification management
  addApiEndpoint(path: string, method: NonNullable<NonNullable<TechnicalSpecification['apiSpecification']>['endpoints']>[0]['method'], description: string): void {
    if (!this.apiSpecification) {
      this.apiSpecification = {};
    }
    if (!this.apiSpecification.endpoints) {
      this.apiSpecification.endpoints = [];
    }

    this.apiSpecification.endpoints.push({
      path,
      method,
      description,
      parameters: [],
      responses: {},
      authentication: []
    });
  }

  // Database design management
  addDatabaseEntity(name: string, description: string, attributes: NonNullable<NonNullable<TechnicalSpecification['databaseDesign']>['entities']>[0]['attributes']): void {
    if (!this.databaseDesign) {
      this.databaseDesign = {};
    }
    if (!this.databaseDesign.entities) {
      this.databaseDesign.entities = [];
    }

    this.databaseDesign.entities.push({
      name,
      description,
      attributes,
      relationships: [],
      indexes: []
    });
  }

  // Change management
  addChangeLogEntry(version: string, author: string, changes: string[], impact?: NonNullable<TechnicalSpecification['changeLog']>[0]['impact']): void {
    if (!this.changeLog) {
      this.changeLog = [];
    }

    this.changeLog.push({
      version,
      date: new Date(),
      author,
      changes,
      impact
    });
  }

  // Specification quality assessment
  getSpecificationQuality(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Completeness (40%)
    factors.completeness = this.calculateCompletenessScore();
    if (factors.completeness < 70) {
      issues.push('Specification lacks important details');
    }

    // Review quality (30%)
    factors.reviewQuality = this.calculateReviewQualityScore();
    if (factors.reviewQuality < 60) {
      issues.push('Needs more thorough review');
    }

    // Implementation readiness (30%)
    factors.implementationReadiness = this.calculateImplementationReadinessScore();
    if (factors.implementationReadiness < 60) {
      issues.push('Not ready for implementation');
    }

    const totalScore = 
      factors.completeness * 0.4 + 
      factors.reviewQuality * 0.3 + 
      factors.implementationReadiness * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateCompletenessScore(): number {
    let score = 0;

    // Has requirements
    if (this.requirements?.functional?.length) score += 25;
    if (this.requirements?.nonFunctional?.length) score += 15;

    // Has architecture
    if (this.architecture?.components?.length) score += 20;
    if (this.architecture?.dataFlow?.length) score += 10;

    // Has implementation plan
    if (this.implementationPlan?.phases?.length) score += 15;

    // Has testing strategy
    if (this.testingStrategy?.approaches?.length) score += 10;

    // Has security considerations
    if (this.securityConsiderations?.threats?.length) score += 5;

    return Math.min(100, score);
  }

  private calculateReviewQualityScore(): number {
    if (!this.reviewers || this.reviewers.length === 0) return 0;

    const reviewProgress = this.getReviewProgress();
    const completionRate = (reviewProgress.approved / reviewProgress.total) * 100;

    // Bonus for having diverse reviewer roles
    const roles = new Set(this.reviewers.map(r => r.role));
    const diversityBonus = Math.min(20, roles.size * 5);

    return Math.min(100, completionRate + diversityBonus);
  }

  private calculateImplementationReadinessScore(): number {
    let score = 0;

    // Requirements approved
    const reqStats = this.getRequirementStats();
    if (reqStats.total > 0) {
      score += (reqStats.approved / reqStats.total) * 40;
    }

    // Has implementation plan
    if (this.implementationPlan?.phases?.length) score += 20;

    // Has dependencies identified
    if (this.dependencies?.length) score += 15;

    // Architecture defined
    if (this.architecture?.components?.length) score += 15;

    // Review approved
    if (this.reviewStatus === 'approved') score += 10;

    return Math.min(100, score);
  }
}