import { Entity, Property } from '@mikro-orm/core';
import { ProjectArchetype } from '../archetypes/ProjectArchetype.js';

/**
 * Software development project with tech-specific fields and workflows
 * Extends ProjectArchetype with software development business logic
 */
@Entity({ tableName: 'software_project' })
export class SoftwareProject extends ProjectArchetype {
  @Property({ nullable: true })
  repository?: string;

  @Property({ type: 'json', nullable: true })
  techStack?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    infrastructure?: string[];
    tools?: string[];
  };

  @Property({ nullable: true, fieldName: 'deployment_url' })
  deploymentUrl?: string;

  @Property({ nullable: true, fieldName: 'staging_url' })
  stagingUrl?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'code_quality_metrics' })
  codeQualityMetrics?: {
    coverage?: number;
    complexity?: number;
    duplicateLines?: number;
    vulnerabilities?: number;
    lastAnalyzed?: Date;
  };

  @Property({ nullable: true })
  methodology?: 'agile' | 'waterfall' | 'kanban' | 'scrum' | 'lean';

  @Property({ nullable: true, fieldName: 'sprint_duration' })
  sprintDuration?: number; // in weeks

  @Property({ type: 'json', nullable: true })
  environments?: {
    development?: string;
    staging?: string;
    production?: string;
  };

  @Property({ nullable: true, fieldName: 'license_type' })
  licenseType?: string;

  @Property({ type: 'boolean', default: false, fieldName: 'is_open_source' })
  isOpenSource?: boolean;

  // Implementation of abstract methods
  getProjectType(): string {
    return 'software';
  }

  async validateProjectRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Software-specific validation
    if (this.repository && !this.isValidRepositoryUrl(this.repository)) {
      return false;
    }

    if (this.deploymentUrl && !this.isValidUrl(this.deploymentUrl)) {
      return false;
    }

    if (this.stagingUrl && !this.isValidUrl(this.stagingUrl)) {
      return false;
    }

    if (this.sprintDuration && (this.sprintDuration < 1 || this.sprintDuration > 8)) {
      return false; // Sprint duration should be 1-8 weeks
    }

    return true;
  }

  async calculateProgress(): Promise<number> {
    // Software project progress calculation based on multiple factors
    let totalWeight = 0;
    let weightedProgress = 0;

    // Factor 1: Manual progress percentage (40% weight)
    if (this.progressPercentage !== undefined) {
      weightedProgress += this.progressPercentage * 0.4;
      totalWeight += 0.4;
    }

    // Factor 2: Code quality metrics (30% weight)
    if (this.codeQualityMetrics?.coverage !== undefined) {
      const qualityScore = this.calculateQualityScore();
      weightedProgress += qualityScore * 0.3;
      totalWeight += 0.3;
    }

    // Factor 3: Deployment status (30% weight)
    const deploymentProgress = this.calculateDeploymentProgress();
    weightedProgress += deploymentProgress * 0.3;
    totalWeight += 0.3;

    return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  }

  getRequiredResources(): string[] {
    const resources: string[] = [];

    if (this.techStack?.frontend?.length) {
      resources.push('Frontend Developer');
    }

    if (this.techStack?.backend?.length) {
      resources.push('Backend Developer');
    }

    if (this.techStack?.database?.length) {
      resources.push('Database Administrator');
    }

    if (this.techStack?.infrastructure?.length) {
      resources.push('DevOps Engineer');
    }

    if (this.methodology === 'scrum' || this.methodology === 'agile') {
      resources.push('Scrum Master');
    }

    // Always need these for software projects
    resources.push('Product Owner', 'QA Engineer');

    return resources;
  }

  // Software-specific business logic methods
  private calculateQualityScore(): number {
    if (!this.codeQualityMetrics) return 0;

    const metrics = this.codeQualityMetrics;
    let score = 0;
    let factors = 0;

    // Coverage (higher is better, max 100)
    if (metrics.coverage !== undefined) {
      score += Math.min(metrics.coverage, 100);
      factors++;
    }

    // Complexity (lower is better, assume 10 is good, 50+ is bad)
    if (metrics.complexity !== undefined) {
      const complexityScore = Math.max(0, 100 - (metrics.complexity - 10) * 2);
      score += Math.max(0, complexityScore);
      factors++;
    }

    // Vulnerabilities (lower is better, 0 is perfect)
    if (metrics.vulnerabilities !== undefined) {
      const vulnScore = Math.max(0, 100 - metrics.vulnerabilities * 10);
      score += vulnScore;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  private calculateDeploymentProgress(): number {
    let progress = 0;

    if (this.environments?.development) progress += 25;
    if (this.environments?.staging) progress += 25;
    if (this.environments?.production) progress += 50;

    return progress;
  }

  private isValidRepositoryUrl(url: string): boolean {
    // Basic validation for common git repository URLs
    const gitUrlPatterns = [
      /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+$/,
      /^https:\/\/gitlab\.com\/[\w\-\.]+\/[\w\-\.]+$/,
      /^https:\/\/bitbucket\.org\/[\w\-\.]+\/[\w\-\.]+$/,
      /^git@github\.com:[\w\-\.]+\/[\w\-\.]+\.git$/,
      /^git@gitlab\.com:[\w\-\.]+\/[\w\-\.]+\.git$/
    ];

    return gitUrlPatterns.some(pattern => pattern.test(url));
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Software project workflow helpers
  isDevelopmentReady(): boolean {
    return !!(this.repository && this.techStack);
  }

  isStagingReady(): boolean {
    return this.isDevelopmentReady() && !!this.environments?.staging;
  }

  isProductionReady(): boolean {
    return this.isStagingReady() && 
           !!this.environments?.production &&
           (this.codeQualityMetrics?.coverage ?? 0) >= 70; // Require 70% coverage for production
  }

  canDeploy(environment: 'staging' | 'production'): boolean {
    if (environment === 'staging') {
      return this.isStagingReady();
    } else {
      return this.isProductionReady();
    }
  }

  // Get project health score based on various factors
  getHealthScore(): { score: number; factors: Record<string, number> } {
    const factors: Record<string, number> = {};

    // Code quality (40% of health)
    factors.codeQuality = this.calculateQualityScore();

    // Deployment readiness (30% of health)
    factors.deploymentReadiness = this.calculateDeploymentProgress();

    // Progress vs timeline (30% of health)
    factors.timeline = this.calculateTimelineHealth();

    const totalScore = 
      factors.codeQuality * 0.4 + 
      factors.deploymentReadiness * 0.3 + 
      factors.timeline * 0.3;

    return {
      score: Math.round(totalScore),
      factors
    };
  }

  private calculateTimelineHealth(): number {
    if (!this.startDate || !this.endDate) return 100; // No timeline constraints

    const totalDuration = this.getDurationInDays() ?? 0;
    const remainingDays = this.getRemainingDays() ?? 0;
    const elapsedDays = totalDuration - remainingDays;

    if (totalDuration === 0) return 100;

    const expectedProgress = (elapsedDays / totalDuration) * 100;
    const actualProgress = this.progressPercentage ?? 0;

    // If we're ahead of schedule, 100%. If behind, proportional penalty
    if (actualProgress >= expectedProgress) return 100;
    
    const progressRatio = actualProgress / expectedProgress;
    return Math.max(0, progressRatio * 100);
  }

  // Update tech stack
  updateTechStack(category: keyof NonNullable<SoftwareProject['techStack']>, technologies: string[]): void {
    if (!this.techStack) {
      this.techStack = {};
    }
    this.techStack[category] = technologies;
  }

  // Add technology to stack
  addTechnology(category: keyof NonNullable<SoftwareProject['techStack']>, technology: string): void {
    if (!this.techStack) {
      this.techStack = {};
    }
    if (!this.techStack[category]) {
      this.techStack[category] = [];
    }
    if (!this.techStack[category]!.includes(technology)) {
      this.techStack[category]!.push(technology);
    }
  }

  // Update code quality metrics
  updateCodeQuality(metrics: Partial<NonNullable<SoftwareProject['codeQualityMetrics']>>): void {
    this.codeQualityMetrics = {
      ...this.codeQualityMetrics,
      ...metrics,
      lastAnalyzed: new Date()
    };
  }
}