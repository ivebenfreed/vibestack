import { Entity, Property } from '@mikro-orm/core';
import { RecordArchetype } from '../archetypes/RecordArchetype.js';

/**
 * Process documentation with workflow steps and compliance tracking
 * Extends RecordArchetype with process management workflows
 */
@Entity({ tableName: 'process_documentation' })
export class ProcessDocumentation extends RecordArchetype {
  @Property({ nullable: true, fieldName: 'process_type' })
  processType?: 'operational' | 'administrative' | 'quality' | 'safety' | 'compliance' | 'technical' | 'customer_service';

  @Property({ nullable: true, fieldName: 'process_category' })
  processCategory?: string; // e.g., 'HR', 'Finance', 'Engineering', 'Sales'

  @Property({ type: 'json', nullable: true })
  steps?: Array<{
    stepNumber: number;
    title: string;
    description: string;
    estimatedTime?: number; // minutes
    requiredRoles?: string[];
    requiredTools?: string[];
    inputs?: Array<{
      name: string;
      type: 'document' | 'data' | 'approval' | 'resource';
      required: boolean;
      description: string;
      source?: string;
    }>;
    outputs?: Array<{
      name: string;
      type: 'document' | 'data' | 'notification' | 'result';
      description: string;
      destination?: string;
    }>;
    checkpoints?: Array<{
      description: string;
      criteria: string;
      action: 'continue' | 'stop' | 'escalate' | 'branch';
    }>;
    risks?: Array<{
      description: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
  }>;

  @Property({ type: 'json', nullable: true })
  roles?: Array<{
    title: string;
    description: string;
    responsibilities: string[];
    requiredSkills?: string[];
    authority?: string[];
    escalationPath?: string;
  }>;

  @Property({ nullable: true })
  frequency?: 'on_demand' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'event_triggered';

  @Property({ type: 'json', nullable: true, fieldName: 'trigger_conditions' })
  triggerConditions?: Array<{
    type: 'schedule' | 'event' | 'request' | 'threshold' | 'external';
    description: string;
    criteria?: string;
    automated?: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'performance_metrics' })
  performanceMetrics?: Array<{
    name: string;
    description: string;
    unit: string;
    target?: number;
    threshold?: {
      warning: number;
      critical: number;
    };
    measurementMethod: string;
    frequency: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'compliance_requirements' })
  complianceRequirements?: {
    regulations?: Array<{
      name: string;
      description: string;
      requirements: string[];
      auditFrequency?: string;
      lastAudit?: Date;
      nextAudit?: Date;
    }>;
    certifications?: Array<{
      name: string;
      issuingBody: string;
      validUntil?: Date;
      requirements: string[];
    }>;
    internalPolicies?: Array<{
      name: string;
      version: string;
      effectiveDate: Date;
      requirements: string[];
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'quality_controls' })
  qualityControls?: Array<{
    checkpoint: string;
    method: 'manual_review' | 'automated_check' | 'peer_review' | 'supervisor_approval';
    criteria: string[];
    frequency: string;
    responsible: string;
    escalation?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  exceptions?: Array<{
    scenario: string;
    condition: string;
    alternativeProcess: string;
    approvalRequired?: boolean;
    approver?: string;
    documentation?: string[];
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'related_processes' })
  relatedProcesses?: Array<{
    processId: string;
    relationship: 'prerequisite' | 'follows' | 'parallel' | 'alternative' | 'escalation';
    description: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'training_requirements' })
  trainingRequirements?: Array<{
    role: string;
    trainingType: 'initial' | 'refresher' | 'advanced' | 'certification';
    duration: string;
    frequency?: string;
    provider?: string;
    competencyCheck?: boolean;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'audit_trail' })
  auditTrail?: Array<{
    date: Date;
    auditor: string;
    type: 'compliance' | 'quality' | 'efficiency' | 'security';
    findings: Array<{
      type: 'observation' | 'minor' | 'major' | 'critical';
      description: string;
      recommendation?: string;
      status: 'open' | 'in_progress' | 'resolved' | 'accepted';
      dueDate?: Date;
      assignee?: string;
    }>;
    overallRating?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'process_metrics' })
  processMetrics?: {
    averageCompletionTime?: number; // minutes
    successRate?: number; // percentage
    errorRate?: number; // percentage
    customerSatisfaction?: number; // score
    costPerExecution?: number;
    lastMeasured?: Date;
    trend?: 'improving' | 'stable' | 'declining';
  };

  @Property({ type: 'date', nullable: true, fieldName: 'effective_date' })
  effectiveDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'review_date' })
  reviewDate?: Date;

  @Property({ nullable: true, fieldName: 'process_owner' })
  processOwner?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'improvement_suggestions' })
  improvementSuggestions?: Array<{
    date: Date;
    submittedBy: string;
    description: string;
    impact?: 'time_saving' | 'cost_reduction' | 'quality_improvement' | 'compliance' | 'safety';
    effort?: 'low' | 'medium' | 'high';
    status: 'submitted' | 'under_review' | 'approved' | 'implemented' | 'rejected';
    reviewedBy?: string;
    reviewNotes?: string;
  }>;

  // Implementation of abstract methods
  getRecordType(): string {
    return 'process_documentation';
  }

  async validateRecordRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Process documentation validation
    if (!this.processType) {
      return false; // Process type is required
    }

    if (!this.steps || this.steps.length === 0) {
      return false; // Must have at least one step
    }

    // Validate step numbers are sequential
    const stepNumbers = this.steps.map(s => s.stepNumber).sort((a, b) => a - b);
    for (let i = 0; i < stepNumbers.length; i++) {
      if (stepNumbers[i] !== i + 1) {
        return false; // Step numbers must be sequential starting from 1
      }
    }

    // Validate roles are defined if referenced in steps
    const referencedRoles = new Set<string>();
    this.steps.forEach(step => {
      step.requiredRoles?.forEach(role => referencedRoles.add(role));
    });

    const definedRoles = new Set(this.roles?.map(r => r.title) || []);
    for (const role of referencedRoles) {
      if (!definedRoles.has(role)) {
        return false; // All referenced roles must be defined
      }
    }

    return true;
  }

  async processContent(): Promise<void> {
    // Process documentation content for better searchability
    const contentParts: string[] = [];

    // Add basic information
    contentParts.push(`Process: ${this.title}`);
    contentParts.push(`Type: ${this.processType || 'General'}`);
    contentParts.push(`Category: ${this.processCategory || 'General'}`);
    contentParts.push(`Frequency: ${this.frequency || 'As needed'}`);

    // Add steps
    if (this.steps) {
      contentParts.push('Process Steps:');
      this.steps.forEach(step => {
        contentParts.push(`${step.stepNumber}. ${step.title}: ${step.description}`);
        
        if (step.inputs) {
          step.inputs.forEach(input => {
            contentParts.push(`  Input: ${input.name} - ${input.description}`);
          });
        }
        
        if (step.outputs) {
          step.outputs.forEach(output => {
            contentParts.push(`  Output: ${output.name} - ${output.description}`);
          });
        }
      });
    }

    // Add roles
    if (this.roles) {
      contentParts.push('Roles and Responsibilities:');
      this.roles.forEach(role => {
        contentParts.push(`${role.title}: ${role.description}`);
        role.responsibilities.forEach(resp => {
          contentParts.push(`  - ${resp}`);
        });
      });
    }

    // Add compliance requirements
    if (this.complianceRequirements?.regulations) {
      contentParts.push('Compliance Requirements:');
      this.complianceRequirements.regulations.forEach(reg => {
        contentParts.push(`${reg.name}: ${reg.description}`);
      });
    }

    // Add original content
    if (this.content) {
      contentParts.push('Additional Details:');
      contentParts.push(this.content);
    }

    this.searchContent = contentParts.join('\n').toLowerCase();
    await this.generateKeywords();
  }

  async generateSummary(): Promise<string> {
    const summaryParts: string[] = [];

    summaryParts.push(`${this.processType || 'Process'} documentation`);
    
    if (this.processCategory) {
      summaryParts.push(`for ${this.processCategory}`);
    }

    // Step count
    const stepCount = this.steps?.length || 0;
    if (stepCount > 0) {
      summaryParts.push(`${stepCount} step${stepCount !== 1 ? 's' : ''}`);
    }

    // Role count
    const roleCount = this.roles?.length || 0;
    if (roleCount > 0) {
      summaryParts.push(`${roleCount} role${roleCount !== 1 ? 's' : ''}`);
    }

    // Frequency
    if (this.frequency && this.frequency !== 'on_demand') {
      summaryParts.push(`executed ${this.frequency}`);
    }

    // Compliance
    const regCount = this.complianceRequirements?.regulations?.length || 0;
    if (regCount > 0) {
      summaryParts.push(`${regCount} compliance requirement${regCount !== 1 ? 's' : ''}`);
    }

    // Process owner
    if (this.processOwner) {
      summaryParts.push(`owned by ${this.processOwner}`);
    }

    this.summary = summaryParts.join(', ') + '.';
    return this.summary;
  }

  // Process documentation business logic
  private async generateKeywords(): Promise<void> {
    const keywords: Set<string> = new Set();

    // Add process type and category
    if (this.processType) keywords.add(this.processType);
    if (this.processCategory) keywords.add(this.processCategory.toLowerCase());

    // Add role titles
    this.roles?.forEach(role => {
      keywords.add(role.title.toLowerCase());
    });

    // Add step keywords
    this.steps?.forEach(step => {
      const words = step.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) keywords.add(word);
      });
    });

    // Add compliance keywords
    this.complianceRequirements?.regulations?.forEach(reg => {
      keywords.add(reg.name.toLowerCase());
    });

    // Add trigger condition types
    this.triggerConditions?.forEach(trigger => {
      keywords.add(trigger.type);
    });

    this.keywords = Array.from(keywords);
  }

  // Step management
  addStep(stepNumber: number, title: string, description: string, estimatedTime?: number): void {
    if (!this.steps) {
      this.steps = [];
    }

    this.steps.push({
      stepNumber,
      title,
      description,
      estimatedTime,
      requiredRoles: [],
      requiredTools: [],
      inputs: [],
      outputs: [],
      checkpoints: [],
      risks: []
    });

    // Sort steps by step number
    this.steps.sort((a, b) => a.stepNumber - b.stepNumber);
  }

  addInputToStep(stepNumber: number, input: NonNullable<NonNullable<ProcessDocumentation['steps']>[0]['inputs']>[0]): void {
    const step = this.steps?.find(s => s.stepNumber === stepNumber);
    if (step) {
      if (!step.inputs) step.inputs = [];
      step.inputs.push(input);
    }
  }

  addOutputToStep(stepNumber: number, output: NonNullable<NonNullable<ProcessDocumentation['steps']>[0]['outputs']>[0]): void {
    const step = this.steps?.find(s => s.stepNumber === stepNumber);
    if (step) {
      if (!step.outputs) step.outputs = [];
      step.outputs.push(output);
    }
  }

  addCheckpointToStep(stepNumber: number, checkpoint: NonNullable<NonNullable<ProcessDocumentation['steps']>[0]['checkpoints']>[0]): void {
    const step = this.steps?.find(s => s.stepNumber === stepNumber);
    if (step) {
      if (!step.checkpoints) step.checkpoints = [];
      step.checkpoints.push(checkpoint);
    }
  }

  // Role management
  addRole(title: string, description: string, responsibilities: string[], requiredSkills?: string[]): void {
    if (!this.roles) {
      this.roles = [];
    }

    this.roles.push({
      title,
      description,
      responsibilities,
      requiredSkills,
      authority: [],
      escalationPath: undefined
    });
  }

  assignRoleToStep(stepNumber: number, roleTitle: string): void {
    const step = this.steps?.find(s => s.stepNumber === stepNumber);
    if (step) {
      if (!step.requiredRoles) step.requiredRoles = [];
      if (!step.requiredRoles.includes(roleTitle)) {
        step.requiredRoles.push(roleTitle);
      }
    }
  }

  // Compliance management
  addComplianceRegulation(name: string, description: string, requirements: string[], auditFrequency?: string): void {
    if (!this.complianceRequirements) {
      this.complianceRequirements = {};
    }
    if (!this.complianceRequirements.regulations) {
      this.complianceRequirements.regulations = [];
    }

    this.complianceRequirements.regulations.push({
      name,
      description,
      requirements,
      auditFrequency
    });
  }

  addQualityControl(checkpoint: string, method: NonNullable<ProcessDocumentation['qualityControls']>[0]['method'], criteria: string[], responsible: string): void {
    if (!this.qualityControls) {
      this.qualityControls = [];
    }

    this.qualityControls.push({
      checkpoint,
      method,
      criteria,
      frequency: 'every_execution',
      responsible
    });
  }

  // Audit management
  addAuditFinding(auditor: string, type: NonNullable<ProcessDocumentation['auditTrail']>[0]['type'], findings: NonNullable<ProcessDocumentation['auditTrail']>[0]['findings']): void {
    if (!this.auditTrail) {
      this.auditTrail = [];
    }

    this.auditTrail.push({
      date: new Date(),
      auditor,
      type,
      findings
    });
  }

  getOpenAuditFindings(): NonNullable<ProcessDocumentation['auditTrail']>[0]['findings'] {
    const allFindings: NonNullable<ProcessDocumentation['auditTrail']>[0]['findings'] = [];
    
    this.auditTrail?.forEach(audit => {
      const openFindings = audit.findings.filter(f => f.status === 'open' || f.status === 'in_progress');
      allFindings.push(...openFindings);
    });

    return allFindings;
  }

  // Performance metrics
  updateProcessMetrics(metrics: Partial<NonNullable<ProcessDocumentation['processMetrics']>>): void {
    this.processMetrics = {
      ...this.processMetrics,
      ...metrics,
      lastMeasured: new Date()
    };
  }

  addPerformanceMetric(name: string, description: string, unit: string, target?: number, measurementMethod: string = 'manual'): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = [];
    }

    this.performanceMetrics.push({
      name,
      description,
      unit,
      target,
      measurementMethod,
      frequency: 'monthly'
    });
  }

  // Improvement management
  addImprovementSuggestion(submittedBy: string, description: string, impact?: NonNullable<ProcessDocumentation['improvementSuggestions']>[0]['impact'], effort?: NonNullable<ProcessDocumentation['improvementSuggestions']>[0]['effort']): void {
    if (!this.improvementSuggestions) {
      this.improvementSuggestions = [];
    }

    this.improvementSuggestions.push({
      date: new Date(),
      submittedBy,
      description,
      impact,
      effort,
      status: 'submitted'
    });
  }

  reviewImprovementSuggestion(index: number, reviewedBy: string, status: NonNullable<ProcessDocumentation['improvementSuggestions']>[0]['status'], reviewNotes?: string): void {
    const suggestion = this.improvementSuggestions?.[index];
    if (suggestion) {
      suggestion.status = status;
      suggestion.reviewedBy = reviewedBy;
      suggestion.reviewNotes = reviewNotes;
    }
  }

  // Process analysis
  getProcessComplexity(): { score: number; factors: Record<string, number> } {
    const factors: Record<string, number> = {};

    // Step complexity
    factors.stepCount = Math.min(100, (this.steps?.length || 0) * 5);

    // Role complexity
    factors.roleCount = Math.min(100, (this.roles?.length || 0) * 10);

    // Decision points (checkpoints)
    const checkpointCount = this.steps?.reduce((sum, step) => sum + (step.checkpoints?.length || 0), 0) || 0;
    factors.decisionPoints = Math.min(100, checkpointCount * 15);

    // Exception handling
    factors.exceptions = Math.min(100, (this.exceptions?.length || 0) * 20);

    // Compliance complexity
    const complianceCount = this.complianceRequirements?.regulations?.length || 0;
    factors.compliance = Math.min(100, complianceCount * 25);

    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0) / Object.keys(factors).length;

    return { score: Math.round(totalScore), factors };
  }

  getProcessHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Documentation quality (30%)
    factors.documentation = this.calculateDocumentationQuality();
    if (factors.documentation < 70) {
      issues.push('Process documentation needs improvement');
    }

    // Compliance status (25%)
    factors.compliance = this.calculateComplianceScore();
    if (factors.compliance < 80) {
      issues.push('Compliance requirements need attention');
    }

    // Performance metrics (25%)
    factors.performance = this.calculatePerformanceScore();
    if (factors.performance < 60) {
      issues.push('Process performance is below expectations');
    }

    // Maintenance status (20%)
    factors.maintenance = this.calculateMaintenanceScore();
    if (factors.maintenance < 50) {
      issues.push('Process needs review and updates');
    }

    const totalScore = 
      factors.documentation * 0.3 + 
      factors.compliance * 0.25 + 
      factors.performance * 0.25 + 
      factors.maintenance * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateDocumentationQuality(): number {
    let score = 0;

    // Has clear steps
    if (this.steps && this.steps.length > 0) score += 25;

    // Has defined roles
    if (this.roles && this.roles.length > 0) score += 20;

    // Has inputs/outputs defined
    const hasInputsOutputs = this.steps?.some(step => step.inputs?.length || step.outputs?.length);
    if (hasInputsOutputs) score += 15;

    // Has quality controls
    if (this.qualityControls && this.qualityControls.length > 0) score += 15;

    // Has exceptions documented
    if (this.exceptions && this.exceptions.length > 0) score += 10;

    // Has performance metrics
    if (this.performanceMetrics && this.performanceMetrics.length > 0) score += 15;

    return Math.min(100, score);
  }

  private calculateComplianceScore(): number {
    let score = 100; // Start with perfect score

    // Check for overdue audits
    const overdueAudits = this.complianceRequirements?.regulations?.filter(reg => 
      reg.nextAudit && reg.nextAudit < new Date()
    ).length || 0;
    
    score -= overdueAudits * 20;

    // Check for open audit findings
    const openFindings = this.getOpenAuditFindings().length;
    score -= openFindings * 10;

    // Check for critical findings
    const criticalFindings = this.getOpenAuditFindings().filter(f => f.type === 'critical').length;
    score -= criticalFindings * 30;

    return Math.max(0, score);
  }

  private calculatePerformanceScore(): number {
    if (!this.processMetrics) return 50; // No data

    let score = 50; // Base score

    // Success rate
    if (this.processMetrics.successRate !== undefined) {
      score += (this.processMetrics.successRate - 50) * 0.5;
    }

    // Error rate (lower is better)
    if (this.processMetrics.errorRate !== undefined) {
      score += (10 - this.processMetrics.errorRate) * 2;
    }

    // Customer satisfaction
    if (this.processMetrics.customerSatisfaction !== undefined) {
      score += this.processMetrics.customerSatisfaction * 0.3;
    }

    // Trend consideration
    if (this.processMetrics.trend === 'improving') score += 10;
    else if (this.processMetrics.trend === 'declining') score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateMaintenanceScore(): number {
    let score = 100;

    // Check review date
    if (this.reviewDate) {
      const daysSinceReview = (new Date().getTime() - this.reviewDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReview > 365) score -= 30; // Very overdue
      else if (daysSinceReview > 180) score -= 15; // Overdue
    } else {
      score -= 40; // No review date set
    }

    // Check for recent improvements
    const recentSuggestions = this.improvementSuggestions?.filter(s => 
      s.date > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    ).length || 0;
    
    if (recentSuggestions > 0) score += 10;

    // Check for implemented improvements
    const implementedSuggestions = this.improvementSuggestions?.filter(s => 
      s.status === 'implemented'
    ).length || 0;
    
    if (implementedSuggestions > 0) score += 10;

    return Math.max(0, score);
  }

  // Process execution simulation
  getEstimatedExecutionTime(): number {
    if (!this.steps) return 0;

    return this.steps.reduce((total, step) => {
      return total + (step.estimatedTime || 0);
    }, 0);
  }

  getCriticalPath(): NonNullable<ProcessDocumentation['steps']> {
    // For now, return all steps as critical path
    // In a more sophisticated implementation, this would analyze dependencies
    return this.steps || [];
  }

  getResourceRequirements(): { roles: string[]; tools: string[]; skills: string[] } {
    const roles = new Set<string>();
    const tools = new Set<string>();
    const skills = new Set<string>();

    this.steps?.forEach(step => {
      step.requiredRoles?.forEach(role => roles.add(role));
      step.requiredTools?.forEach(tool => tools.add(tool));
    });

    this.roles?.forEach(role => {
      role.requiredSkills?.forEach(skill => skills.add(skill));
    });

    return {
      roles: Array.from(roles),
      tools: Array.from(tools),
      skills: Array.from(skills)
    };
  }
}