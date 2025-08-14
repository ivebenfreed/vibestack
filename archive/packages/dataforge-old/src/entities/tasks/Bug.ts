import { Entity, Property } from '@mikro-orm/core';
import { TaskArchetype } from '../archetypes/TaskArchetype.js';

/**
 * Bug tracking with bug-specific fields and resolution workflows
 * Extends TaskArchetype with defect management business logic
 */
@Entity({ tableName: 'bug' })
export class Bug extends TaskArchetype {
  @Property({ nullable: true })
  severity?: 'critical' | 'high' | 'medium' | 'low';

  @Property({ nullable: true })
  reproducibility?: 'always' | 'sometimes' | 'rarely' | 'unable';

  @Property({ nullable: true })
  environment?: string; // production, staging, development, etc.

  @Property({ type: 'text', nullable: true, fieldName: 'steps_to_reproduce' })
  stepsToReproduce?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'expected_behavior' })
  expectedBehavior?: string;

  @Property({ type: 'text', nullable: true, fieldName: 'actual_behavior' })
  actualBehavior?: string;

  @Property({ nullable: true, fieldName: 'bug_type' })
  bugType?: 'functional' | 'performance' | 'ui' | 'integration' | 'security' | 'data' | 'compatibility';

  @Property({ nullable: true, fieldName: 'root_cause' })
  rootCause?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'affected_versions' })
  affectedVersions?: string[];

  @Property({ nullable: true, fieldName: 'fixed_version' })
  fixedVersion?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'affected_components' })
  affectedComponents?: string[];

  @Property({ type: 'json', nullable: true })
  attachments?: Array<{
    name: string;
    type: 'screenshot' | 'log' | 'video' | 'document';
    url: string;
    description?: string;
  }>;

  @Property({ nullable: true, fieldName: 'reporter_id' })
  reporterId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'reported_at' })
  reportedAt?: Date;

  @Property({ nullable: true, fieldName: 'verification_status' })
  verificationStatus?: 'unverified' | 'verified' | 'cannot_reproduce' | 'duplicate' | 'not_a_bug';

  @Property({ type: 'json', nullable: true, fieldName: 'duplicate_of' })
  duplicateOf?: {
    bugId: string;
    reason: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'resolution_details' })
  resolutionDetails?: {
    type: 'fixed' | 'wont_fix' | 'duplicate' | 'not_reproducible' | 'by_design';
    description: string;
    codeChanges?: string[];
    testingNotes?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'browser_info' })
  browserInfo?: {
    name: string;
    version: string;
    os: string;
    screenResolution?: string;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'device_info' })
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    model?: string;
    os?: string;
    osVersion?: string;
  };

  @Property({ type: 'integer', nullable: true, fieldName: 'customer_impact' })
  customerImpact?: number; // Number of affected customers

  @Property({ type: 'boolean', default: false, fieldName: 'security_related' })
  securityRelated?: boolean;

  @Property({ type: 'json', nullable: true, fieldName: 'regression_info' })
  regressionInfo?: {
    isRegression: boolean;
    introducedInVersion?: string;
    relatedChanges?: string[];
  };

  // Implementation of abstract methods
  getTaskType(): string {
    return 'bug';
  }

  async validateTaskRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Bug-specific validation
    if (!this.stepsToReproduce || this.stepsToReproduce.trim().length === 0) {
      return false; // Steps to reproduce are required
    }

    if (!this.expectedBehavior || this.expectedBehavior.trim().length === 0) {
      return false; // Expected behavior is required
    }

    if (!this.actualBehavior || this.actualBehavior.trim().length === 0) {
      return false; // Actual behavior is required
    }

    if (!this.severity) {
      return false; // Severity is required for bugs
    }

    if (this.customerImpact && this.customerImpact < 0) {
      return false; // Customer impact cannot be negative
    }

    return true;
  }

  async calculatePriority(): Promise<number> {
    let priorityScore = 50; // Base priority

    // Factor 1: Severity (40% of priority)
    switch (this.severity) {
      case 'critical':
        priorityScore += 40;
        break;
      case 'high':
        priorityScore += 30;
        break;
      case 'medium':
        priorityScore += 10;
        break;
      case 'low':
        priorityScore -= 10;
        break;
    }

    // Factor 2: Customer impact (25% of priority)
    if (this.customerImpact) {
      if (this.customerImpact > 100) priorityScore += 25;
      else if (this.customerImpact > 50) priorityScore += 20;
      else if (this.customerImpact > 10) priorityScore += 15;
      else if (this.customerImpact > 1) priorityScore += 10;
    }

    // Factor 3: Environment (15% of priority)
    switch (this.environment) {
      case 'production':
        priorityScore += 15;
        break;
      case 'staging':
        priorityScore += 10;
        break;
      case 'development':
        priorityScore += 5;
        break;
    }

    // Factor 4: Security implications (10% of priority)
    if (this.securityRelated) {
      priorityScore += 20;
    }

    // Factor 5: Reproducibility (10% of priority)
    switch (this.reproducibility) {
      case 'always':
        priorityScore += 10;
        break;
      case 'sometimes':
        priorityScore += 5;
        break;
      case 'rarely':
        priorityScore += 2;
        break;
      case 'unable':
        priorityScore -= 5;
        break;
    }

    // Factor 6: Regression penalty
    if (this.regressionInfo?.isRegression) {
      priorityScore += 15;
    }

    return Math.max(0, Math.min(100, priorityScore));
  }

  getRequiredSkills(): string[] {
    const skills: string[] = [];

    // Skills based on bug type
    switch (this.bugType) {
      case 'functional':
        skills.push('Debugging', 'Functional Testing');
        break;
      case 'performance':
        skills.push('Performance Analysis', 'Profiling');
        break;
      case 'ui':
        skills.push('Frontend Development', 'UI Testing');
        break;
      case 'integration':
        skills.push('System Integration', 'API Testing');
        break;
      case 'security':
        skills.push('Security Analysis', 'Penetration Testing');
        break;
      case 'data':
        skills.push('Database Administration', 'Data Analysis');
        break;
      case 'compatibility':
        skills.push('Cross-Browser Testing', 'Device Testing');
        break;
    }

    // Skills based on affected components
    if (this.affectedComponents?.includes('database')) {
      skills.push('Database Administration');
    }
    if (this.affectedComponents?.includes('api')) {
      skills.push('Backend Development');
    }
    if (this.affectedComponents?.includes('frontend')) {
      skills.push('Frontend Development');
    }

    // Skills based on environment
    if (this.environment === 'production') {
      skills.push('Production Debugging', 'Monitoring');
    }

    // Security skills if security-related
    if (this.securityRelated) {
      skills.push('Security Analysis', 'Vulnerability Assessment');
    }

    // Always need these for bugs
    skills.push('Debugging', 'Testing', 'Root Cause Analysis');

    return [...new Set(skills)]; // Remove duplicates
  }

  // Bug-specific business logic
  getSeverityScore(): number {
    const severityScores = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };
    return severityScores[this.severity!] || 0;
  }

  getReproducibilityScore(): number {
    const reproducibilityScores = {
      'always': 100,
      'sometimes': 75,
      'rarely': 50,
      'unable': 0
    };
    return reproducibilityScores[this.reproducibility!] || 0;
  }

  // Bug workflow helpers
  verify(): void {
    this.verificationStatus = 'verified';
  }

  markAsCannotReproduce(): void {
    this.verificationStatus = 'cannot_reproduce';
  }

  markAsDuplicate(bugId: string, reason: string): void {
    this.verificationStatus = 'duplicate';
    this.duplicateOf = { bugId, reason };
    this.status = 'closed';
  }

  markAsNotABug(): void {
    this.verificationStatus = 'not_a_bug';
    this.status = 'closed';
  }

  // Resolution management
  resolve(resolution: NonNullable<Bug['resolutionDetails']>): void {
    this.resolutionDetails = resolution;
    this.status = 'resolved';
    
    if (resolution.type === 'fixed') {
      this.completeTask();
    }
  }

  reopen(reason: string): void {
    this.status = 'reopened';
    this.resolutionDetails = undefined;
    this.completedAt = undefined;
    this.completionPercentage = 0;
  }

  // Attachment management
  addAttachment(attachment: NonNullable<Bug['attachments']>[0]): void {
    if (!this.attachments) {
      this.attachments = [];
    }
    this.attachments.push(attachment);
  }

  removeAttachment(name: string): void {
    if (!this.attachments) return;
    this.attachments = this.attachments.filter(att => att.name !== name);
  }

  // Component tracking
  addAffectedComponent(component: string): void {
    if (!this.affectedComponents) {
      this.affectedComponents = [];
    }
    if (!this.affectedComponents.includes(component)) {
      this.affectedComponents.push(component);
    }
  }

  removeAffectedComponent(component: string): void {
    if (!this.affectedComponents) return;
    const index = this.affectedComponents.indexOf(component);
    if (index > -1) {
      this.affectedComponents.splice(index, 1);
    }
  }

  // Version tracking
  addAffectedVersion(version: string): void {
    if (!this.affectedVersions) {
      this.affectedVersions = [];
    }
    if (!this.affectedVersions.includes(version)) {
      this.affectedVersions.push(version);
    }
  }

  setFixedVersion(version: string): void {
    this.fixedVersion = version;
  }

  // Regression analysis
  markAsRegression(introducedInVersion: string, relatedChanges: string[] = []): void {
    this.regressionInfo = {
      isRegression: true,
      introducedInVersion,
      relatedChanges
    };
  }

  // Impact assessment
  updateCustomerImpact(count: number): void {
    if (count < 0) throw new Error('Customer impact cannot be negative');
    this.customerImpact = count;
  }

  // Bug quality assessment
  getBugQuality(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Information completeness (40% of quality)
    factors.completeness = this.calculateCompletenessScore();
    if (factors.completeness < 70) {
      issues.push('Bug report lacks important details');
    }

    // Reproducibility (30% of quality)
    factors.reproducibility = this.getReproducibilityScore();
    if (factors.reproducibility < 50) {
      issues.push('Bug is difficult to reproduce');
    }

    // Evidence quality (30% of quality)
    factors.evidence = this.calculateEvidenceScore();
    if (factors.evidence < 60) {
      issues.push('Bug needs better evidence (screenshots, logs, etc.)');
    }

    const totalScore = 
      factors.completeness * 0.4 + 
      factors.reproducibility * 0.3 + 
      factors.evidence * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateCompletenessScore(): number {
    let score = 0;
    let maxScore = 0;

    // Required fields
    if (this.stepsToReproduce) { score += 25; } maxScore += 25;
    if (this.expectedBehavior) { score += 20; } maxScore += 20;
    if (this.actualBehavior) { score += 20; } maxScore += 20;
    if (this.severity) { score += 15; } maxScore += 15;

    // Important optional fields
    if (this.environment) { score += 10; } maxScore += 10;
    if (this.reproducibility) { score += 5; } maxScore += 5;
    if (this.bugType) { score += 5; } maxScore += 5;

    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  private calculateEvidenceScore(): number {
    let score = 0;

    // Attachments
    const attachmentCount = this.attachments?.length ?? 0;
    if (attachmentCount >= 2) score += 40;
    else if (attachmentCount >= 1) score += 20;

    // Browser/device info
    if (this.browserInfo) score += 20;
    if (this.deviceInfo) score += 20;

    // Detailed steps
    if (this.stepsToReproduce && this.stepsToReproduce.length > 100) {
      score += 20;
    } else if (this.stepsToReproduce && this.stepsToReproduce.length > 50) {
      score += 10;
    }

    return score;
  }

  // Bug metrics for reporting
  getTimeToResolution(): number | null {
    if (!this.reportedAt || !this.completedAt) return null;
    
    const diffTime = this.completedAt.getTime() - this.reportedAt.getTime();
    return diffTime / (1000 * 60 * 60 * 24); // Convert to days
  }

  getTimeToVerification(): number | null {
    if (!this.reportedAt || this.verificationStatus === 'unverified') return null;
    
    // This would typically use a verification timestamp
    // For now, estimate using creation time
    const diffTime = this.createdAt.getTime() - this.reportedAt.getTime();
    return diffTime / (1000 * 60 * 60); // Convert to hours
  }

  // Bug health assessment
  getBugHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Resolution progress (40% of health)
    factors.resolutionProgress = this.calculateResolutionProgress();
    if (factors.resolutionProgress < 30) {
      issues.push('Bug resolution is stalled');
    }

    // Age factor (30% of health)
    factors.ageFactor = this.calculateAgeFactor();
    if (factors.ageFactor < 50) {
      issues.push('Bug has been open too long');
    }

    // Communication factor (30% of health)
    factors.communication = this.calculateCommunicationFactor();
    if (factors.communication < 50) {
      issues.push('Bug needs more investigation or communication');
    }

    const totalScore = 
      factors.resolutionProgress * 0.4 + 
      factors.ageFactor * 0.3 + 
      factors.communication * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateResolutionProgress(): number {
    if (this.isCompleted()) return 100;
    
    let progress = 0;
    
    // Verification
    if (this.verificationStatus === 'verified') progress += 25;
    
    // Investigation
    if (this.rootCause) progress += 25;
    
    // Assignment
    if (this.assigneeId) progress += 25;
    
    // In progress
    if (this.isInProgress()) progress += 25;
    
    return progress;
  }

  private calculateAgeFactor(): number {
    if (!this.reportedAt) return 100;
    
    const ageInDays = (new Date().getTime() - this.reportedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Age penalty based on severity
    let maxAgeBeforePenalty = 30; // days
    
    switch (this.severity) {
      case 'critical':
        maxAgeBeforePenalty = 1;
        break;
      case 'high':
        maxAgeBeforePenalty = 7;
        break;
      case 'medium':
        maxAgeBeforePenalty = 14;
        break;
      case 'low':
        maxAgeBeforePenalty = 30;
        break;
    }
    
    if (ageInDays <= maxAgeBeforePenalty) return 100;
    
    const penaltyFactor = (ageInDays - maxAgeBeforePenalty) / maxAgeBeforePenalty;
    return Math.max(0, 100 - (penaltyFactor * 50));
  }

  private calculateCommunicationFactor(): number {
    let score = 50; // Base score
    
    // Evidence provided
    if (this.attachments?.length) score += 20;
    
    // Investigation done
    if (this.rootCause) score += 20;
    
    // Environment specified
    if (this.environment) score += 10;
    
    return Math.min(100, score);
  }
}