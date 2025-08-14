import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all activity-related entities
 * Provides common activity fields and workflow management patterns
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class ActivityArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'activity_type' })
  activityType?: string;

  @Property({ type: 'string', default: 'pending' })
  status!: string;

  @Property({ type: 'string', nullable: true })
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @Property({ type: 'uuid', nullable: true, fieldName: 'assigned_to' })
  assignedTo?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'initiated_by' })
  initiatedBy?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'scheduled_at' })
  scheduledAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'started_at' })
  startedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'due_date' })
  dueDate?: Date;

  @Property({ type: 'integer', nullable: true, fieldName: 'estimated_duration' })
  estimatedDuration?: number; // minutes

  @Property({ type: 'integer', nullable: true, fieldName: 'actual_duration' })
  actualDuration?: number; // minutes

  // Parent activity for workflow dependencies
  @ManyToOne(() => ActivityArchetype, { nullable: true, fieldName: 'parent_activity_id' })
  parentActivity?: ActivityArchetype;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'execution_context' })
  executionContext?: {
    environment?: 'development' | 'staging' | 'production' | 'testing';
    platform?: string;
    version?: string;
    branch?: string;
    commit?: string;
    triggeredBy?: string;
    automated?: boolean;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'dependencies' })
  dependencies?: Array<{
    activityId: string;
    activityName: string;
    dependencyType: 'blocks' | 'triggers' | 'requires' | 'follows';
    status: 'satisfied' | 'pending' | 'failed';
    description?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'success_criteria' })
  successCriteria?: Array<{
    criterion: string;
    type: 'manual' | 'automated' | 'metric';
    threshold?: number;
    unit?: string;
    status: 'pending' | 'passed' | 'failed';
    actualValue?: number;
    checkedAt?: Date;
    checkedBy?: string;
    notes?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'execution_steps' })
  executionSteps?: Array<{
    stepNumber: number;
    name: string;
    description?: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    duration?: number; // seconds
    output?: string;
    errorMessage?: string;
    automated?: boolean;
    executedBy?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'approval_workflow' })
  approvalWorkflow?: {
    required: boolean;
    approvers: Array<{
      userId: string;
      role: string;
      status: 'pending' | 'approved' | 'rejected';
      timestamp?: Date;
      notes?: string;
    }>;
    requiredApprovals?: number;
    currentApprovals?: number;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'risk_assessment' })
  riskAssessment?: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      factor: string;
      impact: 'low' | 'medium' | 'high';
      likelihood: 'low' | 'medium' | 'high';
      mitigation?: string;
      status: 'identified' | 'mitigated' | 'accepted';
    }>;
    mitigationPlan?: string;
    rollbackPlan?: string;
    assessedBy?: string;
    assessedAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'performance_metrics' })
  performanceMetrics?: {
    throughput?: number;
    latency?: number; // milliseconds
    errorRate?: number; // percentage
    successRate?: number; // percentage
    resourceUsage?: {
      cpu?: number; // percentage
      memory?: number; // bytes
      disk?: number; // bytes
      network?: number; // bytes per second
    };
    customMetrics?: Record<string, number>;
    collectedAt?: Date;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'notifications' })
  notifications?: Array<{
    recipient: string;
    method: 'email' | 'slack' | 'webhook' | 'sms';
    trigger: 'start' | 'complete' | 'fail' | 'approve' | 'schedule';
    template?: string;
    sent: boolean;
    sentAt?: Date;
    response?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'related_entities' })
  relatedEntities?: Array<{
    entityType: string;
    entityId: string;
    relationship: 'processes' | 'affects' | 'depends_on' | 'triggers' | 'validates';
    description?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'audit_trail' })
  auditTrail?: Array<{
    timestamp: Date;
    userId: string;
    action: string;
    details: string;
    previousValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'retry_config' })
  retryConfig?: {
    maxRetries: number;
    currentRetries: number;
    retryDelay: number; // seconds
    exponentialBackoff: boolean;
    retryConditions: string[];
    lastRetryAt?: Date;
    nextRetryAt?: Date;
  };

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'activity';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'flexible'; // Activities can belong to projects, releases, sprints
  }

  // Abstract methods that concrete implementations must provide
  abstract getActivityType(): string;
  abstract validateActivityRules(): Promise<boolean>;
  abstract executeActivity(): Promise<void>;
  abstract canExecute(): Promise<boolean>;

  // Common activity business logic
  isScheduled(): boolean {
    return !!this.scheduledAt && this.status === 'scheduled';
  }

  isRunning(): boolean {
    return this.status === 'running' || this.status === 'in_progress';
  }

  isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'success';
  }

  isFailed(): boolean {
    return this.status === 'failed' || this.status === 'error';
  }

  isPending(): boolean {
    return this.status === 'pending' || this.status === 'queued';
  }

  isOverdue(): boolean {
    return !!this.dueDate && new Date() > this.dueDate && !this.isCompleted();
  }

  hasStarted(): boolean {
    return !!this.startedAt;
  }

  isDependenciesSatisfied(): boolean {
    if (!this.dependencies) return true;
    return this.dependencies.every(dep => dep.status === 'satisfied');
  }

  requiresApproval(): boolean {
    return this.approvalWorkflow?.required ?? false;
  }

  isApproved(): boolean {
    if (!this.requiresApproval()) return true;
    
    const workflow = this.approvalWorkflow!;
    const approvedCount = workflow.approvers.filter(a => a.status === 'approved').length;
    const requiredCount = workflow.requiredApprovals || workflow.approvers.length;
    
    return approvedCount >= requiredCount;
  }

  hasRejection(): boolean {
    if (!this.approvalWorkflow) return false;
    return this.approvalWorkflow.approvers.some(a => a.status === 'rejected');
  }

  // Activity lifecycle management
  schedule(scheduledAt: Date, assignedTo?: string): void {
    if (this.canSchedule()) {
      this.status = 'scheduled';
      this.scheduledAt = scheduledAt;
      if (assignedTo) {
        this.assignedTo = assignedTo;
      }
      this.addAuditEntry('scheduled', `Activity scheduled for ${scheduledAt.toISOString()}`);
    }
  }

  start(userId?: string): boolean {
    if (!this.canStart()) return false;

    this.status = 'running';
    this.startedAt = new Date();
    
    if (userId) {
      this.addAuditEntry('started', 'Activity started', userId);
    }

    // Initialize execution steps
    if (this.executionSteps) {
      this.executionSteps.forEach(step => {
        if (step.status === 'completed') return; // Skip already completed
        step.status = 'pending';
      });
    }

    this.sendNotifications('start');
    return true;
  }

  complete(userId?: string, results?: Record<string, any>): boolean {
    if (!this.canComplete()) return false;

    this.status = 'completed';
    this.completedAt = new Date();
    
    if (this.startedAt) {
      this.actualDuration = Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000 / 60);
    }

    if (results) {
      this.metadata = { ...this.metadata, ...results };
    }

    if (userId) {
      this.addAuditEntry('completed', 'Activity completed successfully', userId);
    }

    this.sendNotifications('complete');
    return true;
  }

  fail(reason: string, userId?: string): boolean {
    this.status = 'failed';
    this.completedAt = new Date();
    
    if (this.startedAt) {
      this.actualDuration = Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000 / 60);
    }

    this.setMetadata('failureReason', reason);

    if (userId) {
      this.addAuditEntry('failed', `Activity failed: ${reason}`, userId);
    }

    this.sendNotifications('fail');
    
    // Check if we should retry
    if (this.shouldRetry()) {
      this.scheduleRetry();
    }

    return true;
  }

  cancel(reason: string, userId?: string): boolean {
    if (this.isCompleted()) return false;

    this.status = 'cancelled';
    this.completedAt = new Date();
    this.setMetadata('cancellationReason', reason);

    if (userId) {
      this.addAuditEntry('cancelled', `Activity cancelled: ${reason}`, userId);
    }

    return true;
  }

  // Validation methods
  private canSchedule(): boolean {
    return this.isPending() || this.status === 'draft';
  }

  private canStart(): boolean {
    if (!this.isPending() && !this.isScheduled()) return false;
    if (!this.isDependenciesSatisfied()) return false;
    if (this.requiresApproval() && !this.isApproved()) return false;
    return true;
  }

  private canComplete(): boolean {
    return this.isRunning() && this.areSuccessCriteriaMet();
  }

  // Success criteria validation
  private areSuccessCriteriaMet(): boolean {
    if (!this.successCriteria) return true;
    
    return this.successCriteria.every(criterion => {
      return criterion.status === 'passed' || criterion.type === 'manual';
    });
  }

  checkSuccessCriterion(criterionIndex: number, actualValue?: number, checkedBy?: string): boolean {
    if (!this.successCriteria || criterionIndex >= this.successCriteria.length) return false;

    const criterion = this.successCriteria[criterionIndex];
    criterion.checkedAt = new Date();
    criterion.checkedBy = checkedBy;

    if (actualValue !== undefined) {
      criterion.actualValue = actualValue;
      
      if (criterion.threshold !== undefined) {
        criterion.status = actualValue >= criterion.threshold ? 'passed' : 'failed';
      }
    }

    return criterion.status === 'passed';
  }

  // Approval workflow management
  submitForApproval(): boolean {
    if (!this.approvalWorkflow) return false;
    
    this.status = 'pending_approval';
    this.approvalWorkflow.approvers.forEach(approver => {
      approver.status = 'pending';
    });
    
    this.sendNotifications('approve');
    return true;
  }

  addApproval(userId: string, notes?: string): boolean {
    if (!this.approvalWorkflow) return false;

    const approver = this.approvalWorkflow.approvers.find(a => a.userId === userId);
    if (!approver) return false;

    approver.status = 'approved';
    approver.timestamp = new Date();
    approver.notes = notes;

    this.approvalWorkflow.currentApprovals = (this.approvalWorkflow.currentApprovals || 0) + 1;

    this.addAuditEntry('approved', `Approved by ${userId}: ${notes || 'No notes'}`, userId);

    // Check if we have enough approvals
    if (this.isApproved()) {
      this.status = 'approved';
    }

    return true;
  }

  rejectApproval(userId: string, reason: string): boolean {
    if (!this.approvalWorkflow) return false;

    const approver = this.approvalWorkflow.approvers.find(a => a.userId === userId);
    if (!approver) return false;

    approver.status = 'rejected';
    approver.timestamp = new Date();
    approver.notes = reason;

    this.status = 'rejected';
    this.addAuditEntry('rejected', `Rejected by ${userId}: ${reason}`, userId);

    return true;
  }

  // Execution step management
  startExecutionStep(stepNumber: number, executedBy?: string): boolean {
    if (!this.executionSteps) return false;

    const step = this.executionSteps.find(s => s.stepNumber === stepNumber);
    if (!step || step.status !== 'pending') return false;

    step.status = 'running';
    step.startedAt = new Date();
    step.executedBy = executedBy;

    return true;
  }

  completeExecutionStep(stepNumber: number, output?: string, duration?: number): boolean {
    if (!this.executionSteps) return false;

    const step = this.executionSteps.find(s => s.stepNumber === stepNumber);
    if (!step || step.status !== 'running') return false;

    step.status = 'completed';
    step.completedAt = new Date();
    step.output = output;
    
    if (duration) {
      step.duration = duration;
    } else if (step.startedAt) {
      step.duration = Math.floor((new Date().getTime() - step.startedAt.getTime()) / 1000);
    }

    return true;
  }

  failExecutionStep(stepNumber: number, errorMessage: string): boolean {
    if (!this.executionSteps) return false;

    const step = this.executionSteps.find(s => s.stepNumber === stepNumber);
    if (!step || step.status !== 'running') return false;

    step.status = 'failed';
    step.completedAt = new Date();
    step.errorMessage = errorMessage;

    if (step.startedAt) {
      step.duration = Math.floor((new Date().getTime() - step.startedAt.getTime()) / 1000);
    }

    return true;
  }

  getExecutionProgress(): { completed: number; total: number; percentage: number } {
    if (!this.executionSteps) return { completed: 0, total: 0, percentage: 0 };

    const total = this.executionSteps.length;
    const completed = this.executionSteps.filter(s => s.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  // Retry mechanism
  private shouldRetry(): boolean {
    if (!this.retryConfig) return false;
    return this.retryConfig.currentRetries < this.retryConfig.maxRetries;
  }

  private scheduleRetry(): void {
    if (!this.retryConfig) return;

    this.retryConfig.currentRetries++;
    this.retryConfig.lastRetryAt = new Date();

    let delay = this.retryConfig.retryDelay;
    if (this.retryConfig.exponentialBackoff) {
      delay = delay * Math.pow(2, this.retryConfig.currentRetries - 1);
    }

    this.retryConfig.nextRetryAt = new Date(Date.now() + delay * 1000);
    this.status = 'scheduled_retry';
  }

  // Dependency management
  addDependency(activityId: string, activityName: string, dependencyType: NonNullable<ActivityArchetype['dependencies']>[0]['dependencyType'], description?: string): void {
    if (!this.dependencies) {
      this.dependencies = [];
    }

    // Check if dependency already exists
    const exists = this.dependencies.some(dep => dep.activityId === activityId);
    if (!exists) {
      this.dependencies.push({
        activityId,
        activityName,
        dependencyType,
        status: 'pending',
        description
      });
    }
  }

  updateDependencyStatus(activityId: string, status: NonNullable<ActivityArchetype['dependencies']>[0]['status']): void {
    if (!this.dependencies) return;

    const dependency = this.dependencies.find(dep => dep.activityId === activityId);
    if (dependency) {
      dependency.status = status;
    }
  }

  // Related entity management
  addRelatedEntity(entityType: string, entityId: string, relationship: NonNullable<ActivityArchetype['relatedEntities']>[0]['relationship'], description?: string): void {
    if (!this.relatedEntities) {
      this.relatedEntities = [];
    }

    const exists = this.relatedEntities.some(rel => 
      rel.entityType === entityType && rel.entityId === entityId
    );

    if (!exists) {
      this.relatedEntities.push({
        entityType,
        entityId,
        relationship,
        description
      });
    }
  }

  // Notification management
  private sendNotifications(trigger: NonNullable<ActivityArchetype['notifications']>[0]['trigger']): void {
    if (!this.notifications) return;

    const relevantNotifications = this.notifications.filter(n => n.trigger === trigger && !n.sent);
    
    relevantNotifications.forEach(notification => {
      // In a real implementation, this would send actual notifications
      notification.sent = true;
      notification.sentAt = new Date();
    });
  }

  addNotification(recipient: string, method: NonNullable<ActivityArchetype['notifications']>[0]['method'], trigger: NonNullable<ActivityArchetype['notifications']>[0]['trigger'], template?: string): void {
    if (!this.notifications) {
      this.notifications = [];
    }

    this.notifications.push({
      recipient,
      method,
      trigger,
      template,
      sent: false
    });
  }

  // Audit trail
  private addAuditEntry(action: string, details: string, userId?: string): void {
    if (!this.auditTrail) {
      this.auditTrail = [];
    }

    this.auditTrail.push({
      timestamp: new Date(),
      userId: userId || 'system',
      action,
      details
    });

    // Limit audit trail to last 1000 entries
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-1000);
    }
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

  // Performance and duration calculations
  getDurationMinutes(): number {
    if (this.actualDuration) return this.actualDuration;
    
    if (this.startedAt && this.completedAt) {
      return Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / 1000 / 60);
    }
    
    if (this.startedAt && this.isRunning()) {
      return Math.floor((new Date().getTime() - this.startedAt.getTime()) / 1000 / 60);
    }
    
    return 0;
  }

  isOnSchedule(): boolean {
    if (!this.estimatedDuration) return true;
    
    const currentDuration = this.getDurationMinutes();
    const allowedVariance = this.estimatedDuration * 0.2; // 20% variance
    
    return currentDuration <= (this.estimatedDuration + allowedVariance);
  }

  getEfficiencyRatio(): number {
    if (!this.estimatedDuration || !this.actualDuration) return 0;
    return this.estimatedDuration / this.actualDuration;
  }

  // Risk assessment
  calculateRiskScore(): number {
    if (!this.riskAssessment) return 0;

    const riskWeights = { low: 1, medium: 3, high: 7, critical: 10 };
    const impactWeight = riskWeights[this.riskAssessment.overallRisk];
    
    const factorScore = this.riskAssessment.riskFactors.reduce((total, factor) => {
      const impact = riskWeights[factor.impact];
      const likelihood = riskWeights[factor.likelihood];
      const mitigated = factor.status === 'mitigated' ? 0.3 : 1.0; // 70% risk reduction if mitigated
      return total + (impact * likelihood * mitigated);
    }, 0);

    return Math.min(100, impactWeight * 5 + factorScore);
  }

  // Activity health assessment
  getActivityHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Progress and timeline (40%)
    factors.progress = this.calculateProgressScore();
    if (factors.progress < 60) {
      issues.push('Activity is behind schedule or stalled');
    }

    // Quality and success criteria (30%)
    factors.quality = this.calculateQualityScore();
    if (factors.quality < 70) {
      issues.push('Quality metrics or success criteria not met');
    }

    // Risk and dependencies (20%)
    factors.risk = Math.max(0, 100 - this.calculateRiskScore());
    if (factors.risk < 70) {
      issues.push('High risk factors or dependency issues detected');
    }

    // Process compliance (10%)
    factors.compliance = this.calculateComplianceScore();
    if (factors.compliance < 80) {
      issues.push('Process or approval compliance issues');
    }

    const totalScore = 
      factors.progress * 0.4 + 
      factors.quality * 0.3 + 
      factors.risk * 0.2 + 
      factors.compliance * 0.1;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateProgressScore(): number {
    let score = 0;

    // Status-based scoring
    switch (this.status) {
      case 'completed': score += 100; break;
      case 'running': case 'in_progress': score += 70; break;
      case 'scheduled': score += 50; break;
      case 'pending': score += 30; break;
      case 'failed': case 'cancelled': score += 0; break;
      default: score += 20;
    }

    // Timeline adherence
    if (this.isOverdue()) score -= 30;
    else if (this.isOnSchedule()) score += 10;

    // Execution progress
    if (this.executionSteps) {
      const progress = this.getExecutionProgress();
      score = Math.max(score, progress.percentage);
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateQualityScore(): number {
    let score = 70; // Base score

    // Success criteria
    if (this.successCriteria) {
      const passed = this.successCriteria.filter(c => c.status === 'passed').length;
      const total = this.successCriteria.length;
      if (total > 0) {
        score = (passed / total) * 100;
      }
    }

    // Performance metrics
    if (this.performanceMetrics) {
      if (this.performanceMetrics.successRate && this.performanceMetrics.successRate >= 95) score += 15;
      if (this.performanceMetrics.errorRate && this.performanceMetrics.errorRate <= 5) score += 15;
    }

    return Math.min(100, score);
  }

  private calculateComplianceScore(): number {
    let score = 80; // Base score

    // Approval compliance
    if (this.requiresApproval()) {
      if (this.isApproved()) score += 20;
      else if (this.hasRejection()) score -= 40;
      else score -= 10; // Pending approval
    }

    // Dependency compliance
    if (!this.isDependenciesSatisfied()) score -= 20;

    // Audit trail presence
    if (this.auditTrail && this.auditTrail.length > 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  // Common validation that all activities should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Activity name is required');
    }

    if (!this.status || this.status.trim().length === 0) {
      errors.push('Activity status is required');
    }

    // Date validation
    if (this.scheduledAt && this.startedAt && this.startedAt < this.scheduledAt) {
      errors.push('Start time cannot be before scheduled time');
    }

    if (this.startedAt && this.completedAt && this.completedAt < this.startedAt) {
      errors.push('Completion time cannot be before start time');
    }

    if (this.dueDate && this.scheduledAt && this.dueDate < this.scheduledAt) {
      errors.push('Due date cannot be before scheduled time');
    }

    // Duration validation
    if (this.estimatedDuration && this.estimatedDuration < 0) {
      errors.push('Estimated duration cannot be negative');
    }

    if (this.actualDuration && this.actualDuration < 0) {
      errors.push('Actual duration cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}