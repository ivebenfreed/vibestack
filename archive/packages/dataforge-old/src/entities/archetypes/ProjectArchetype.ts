import { Property, ManyToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all project-related entities
 * Provides common project fields and business logic patterns
 * Concrete entities extend this class with specific implementations
 */
export abstract class ProjectArchetype extends BaseDomainEntity {
  @Property()
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'date', nullable: true })
  startDate?: Date;

  @Property({ type: 'date', nullable: true })
  endDate?: Date;

  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget?: number;

  @Property({ nullable: true })
  currency?: string;

  @Property({ nullable: true })
  status?: string;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  progressPercentage?: number;

  // Parent project for hierarchy
  @ManyToOne(() => ProjectArchetype, { nullable: true, fieldName: 'parent_project_id' })
  parentProject?: ProjectArchetype;

  // Project manager/owner
  @Property({ type: 'uuid', nullable: true, fieldName: 'project_manager_id' })
  projectManagerId?: string;

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'project';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'workspace';
  }

  // Abstract methods that concrete implementations must provide
  abstract getProjectType(): string;
  abstract validateProjectRules(): Promise<boolean>;
  abstract calculateProgress(): Promise<number>;
  abstract getRequiredResources(): string[];

  // Common project business logic
  isActive(): boolean {
    return this.status === 'active' || this.status === 'in_progress';
  }

  isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'done';
  }

  isDue(): boolean {
    if (!this.endDate) return false;
    return new Date() > this.endDate;
  }

  isOverbudget(actualSpent: number): boolean {
    if (!this.budget) return false;
    return actualSpent > this.budget;
  }

  getDurationInDays(): number | null {
    if (!this.startDate || !this.endDate) return null;
    const diffTime = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getRemainingDays(): number | null {
    if (!this.endDate) return null;
    const diffTime = this.endDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Project hierarchy helpers
  hasParent(): boolean {
    return !!this.parentProject;
  }

  isRootProject(): boolean {
    return !this.parentProject;
  }

  // Validation helpers
  validateDateRange(): boolean {
    if (!this.startDate || !this.endDate) return true; // Dates are optional
    return this.startDate <= this.endDate;
  }

  validateBudget(): boolean {
    if (!this.budget) return true; // Budget is optional
    return this.budget > 0;
  }

  validateProgress(): boolean {
    if (!this.progressPercentage) return true;
    return this.progressPercentage >= 0 && this.progressPercentage <= 100;
  }

  // Common validation that all projects should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!this.validateDateRange()) {
      errors.push('Start date must be before end date');
    }

    if (!this.validateBudget()) {
      errors.push('Budget must be positive');
    }

    if (!this.validateProgress()) {
      errors.push('Progress percentage must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Status transition helpers
  canTransitionTo(newStatus: string): boolean {
    const currentStatus = this.status;
    
    // Define allowed transitions (can be overridden by concrete classes)
    const allowedTransitions: Record<string, string[]> = {
      'planning': ['active', 'cancelled'],
      'active': ['on_hold', 'completed', 'cancelled'],
      'on_hold': ['active', 'cancelled'],
      'completed': [], // No transitions from completed
      'cancelled': [] // No transitions from cancelled
    };

    if (!currentStatus) return true; // Can transition to any status from no status
    
    return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  // Helper to update progress and potentially auto-complete
  async updateProgress(newProgress: number): Promise<void> {
    if (newProgress < 0 || newProgress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    this.progressPercentage = newProgress;

    // Auto-complete project if 100% progress
    if (newProgress === 100 && this.status !== 'completed') {
      if (this.canTransitionTo('completed')) {
        this.status = 'completed';
      }
    }
  }
}