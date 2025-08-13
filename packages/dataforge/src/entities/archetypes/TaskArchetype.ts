import { Property, ManyToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';
import { ProjectArchetype } from './ProjectArchetype.js';

/**
 * Abstract base class for all task-related entities
 * Provides common task fields and business logic patterns
 * Concrete entities extend this class with specific implementations
 */
export abstract class TaskArchetype extends BaseDomainEntity {
  @Property()
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'assignee_id' })
  assigneeId?: string;

  @Property({ type: 'date', nullable: true, fieldName: 'due_date' })
  dueDate?: Date;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true, fieldName: 'estimated_hours' })
  estimatedHours?: number;

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true, fieldName: 'actual_hours' })
  actualHours?: number;

  @Property({ nullable: true })
  status?: string;

  @Property({ nullable: true })
  priority?: string;

  @Property({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0, fieldName: 'completion_percentage' })
  completionPercentage?: number;

  @Property({ type: 'date', nullable: true, fieldName: 'started_at' })
  startedAt?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  // Parent task for hierarchy (subtasks)
  @ManyToOne(() => TaskArchetype, { nullable: true, fieldName: 'parent_task_id' })
  parentTask?: TaskArchetype;

  // Project relationship (most tasks belong to a project)
  @Property({ type: 'uuid', nullable: true, fieldName: 'project_id' })
  projectId?: string;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'custom_fields' })
  customFields?: Record<string, any>;

  // Archetype and container settings
  @Property({ persist: false })
  get archetype(): string {
    return 'task';
  }

  @Property({ persist: false })
  get containerType(): string {
    return 'project';
  }

  // Abstract methods that concrete implementations must provide
  abstract getTaskType(): string;
  abstract validateTaskRules(): Promise<boolean>;
  abstract calculatePriority(): Promise<number>;
  abstract getRequiredSkills(): string[];

  // Common task business logic
  isAssigned(): boolean {
    return !!this.assigneeId;
  }

  isStarted(): boolean {
    return !!this.startedAt;
  }

  isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'done' || !!this.completedAt;
  }

  isOverdue(): boolean {
    if (!this.dueDate || this.isCompleted()) return false;
    return new Date() > this.dueDate;
  }

  isInProgress(): boolean {
    return this.status === 'in_progress' || this.status === 'active';
  }

  hasSubtasks(): boolean {
    return !!this.parentTask;
  }

  isRootTask(): boolean {
    return !this.parentTask;
  }

  getDurationInHours(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    const diffTime = this.completedAt.getTime() - this.startedAt.getTime();
    return diffTime / (1000 * 60 * 60); // Convert to hours
  }

  getRemainingHours(): number | null {
    if (!this.estimatedHours || this.isCompleted()) return null;
    return Math.max(0, this.estimatedHours - (this.actualHours ?? 0));
  }

  getEstimateAccuracy(): number | null {
    if (!this.estimatedHours || !this.actualHours || this.estimatedHours === 0) return null;
    
    const accuracy = 1 - Math.abs(this.actualHours - this.estimatedHours) / this.estimatedHours;
    return Math.max(0, Math.min(1, accuracy)); // Clamp between 0 and 1
  }

  // Time tracking helpers
  logTime(hours: number, note?: string): void {
    if (hours <= 0) throw new Error('Hours must be positive');
    
    this.actualHours = (this.actualHours ?? 0) + hours;
    
    // Auto-start task if not started
    if (!this.startedAt) {
      this.startedAt = new Date();
      if (this.status === 'todo' || this.status === 'planned') {
        this.status = 'in_progress';
      }
    }
  }

  startTask(): void {
    if (this.isStarted()) throw new Error('Task already started');
    
    this.startedAt = new Date();
    if (this.status === 'todo' || this.status === 'planned') {
      this.status = 'in_progress';
    }
  }

  completeTask(): void {
    if (this.isCompleted()) throw new Error('Task already completed');
    
    this.completedAt = new Date();
    this.completionPercentage = 100;
    this.status = 'completed';
  }

  // Progress tracking
  updateProgress(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Progress percentage must be between 0 and 100');
    }

    this.completionPercentage = percentage;

    // Auto-complete if 100%
    if (percentage === 100 && !this.isCompleted()) {
      this.completeTask();
    }

    // Auto-start if progress > 0 and not started
    if (percentage > 0 && !this.isStarted()) {
      this.startTask();
    }
  }

  // Validation helpers
  validateDueDate(): boolean {
    if (!this.dueDate) return true; // Due date is optional
    if (this.startedAt && this.dueDate < this.startedAt) return false;
    return true;
  }

  validateEstimate(): boolean {
    if (!this.estimatedHours) return true; // Estimate is optional
    return this.estimatedHours > 0;
  }

  validateActualHours(): boolean {
    if (!this.actualHours) return true; // Actual hours is optional
    return this.actualHours >= 0;
  }

  validateCompletion(): boolean {
    if (!this.completionPercentage) return true;
    return this.completionPercentage >= 0 && this.completionPercentage <= 100;
  }

  // Common validation that all tasks should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Task title is required');
    }

    if (!this.validateDueDate()) {
      errors.push('Due date cannot be before start date');
    }

    if (!this.validateEstimate()) {
      errors.push('Estimated hours must be positive');
    }

    if (!this.validateActualHours()) {
      errors.push('Actual hours cannot be negative');
    }

    if (!this.validateCompletion()) {
      errors.push('Completion percentage must be between 0 and 100');
    }

    // Validate status transitions
    if (this.isCompleted() && this.completionPercentage !== 100) {
      errors.push('Completed tasks must have 100% completion');
    }

    if (this.completedAt && !this.startedAt) {
      errors.push('Task cannot be completed without being started');
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
      'todo': ['in_progress', 'cancelled'],
      'planned': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'blocked', 'cancelled', 'todo'],
      'blocked': ['in_progress', 'cancelled'],
      'completed': [], // No transitions from completed
      'cancelled': ['todo', 'planned'] // Can reopen cancelled tasks
    };

    if (!currentStatus) return true; // Can transition to any status from no status
    
    return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  // Assignment helpers
  assignTo(userId: string): void {
    this.assigneeId = userId;
  }

  unassign(): void {
    this.assigneeId = undefined;
  }

  reassignTo(userId: string): void {
    this.assigneeId = userId;
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

  // Custom fields management
  setCustomField(key: string, value: any): void {
    if (!this.customFields) {
      this.customFields = {};
    }
    this.customFields[key] = value;
  }

  getCustomField(key: string): any {
    return this.customFields?.[key];
  }

  removeCustomField(key: string): void {
    if (!this.customFields) return;
    delete this.customFields[key];
  }

  // Effort tracking and analysis
  getEfficiencyScore(): number | null {
    const accuracy = this.getEstimateAccuracy();
    if (accuracy === null) return null;

    let score = accuracy * 100;

    // Bonus for completing on time
    if (this.dueDate && this.completedAt && this.completedAt <= this.dueDate) {
      score += 10;
    }

    // Penalty for overdue completion
    if (this.isOverdue() && this.isCompleted()) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Time management helpers
  getTimeRemaining(): { days?: number; hours?: number; overdue: boolean } {
    if (!this.dueDate) return { overdue: false };

    const now = new Date();
    const diffTime = this.dueDate.getTime() - now.getTime();
    
    if (diffTime <= 0) {
      return { overdue: true };
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return { days, hours, overdue: false };
  }

  // Workload calculation for capacity planning
  calculateWorkload(): {
    estimatedWorkload: number;
    actualWorkload: number;
    remainingWorkload: number;
  } {
    const estimatedWorkload = this.estimatedHours ?? 0;
    const actualWorkload = this.actualHours ?? 0;
    const remainingWorkload = this.getRemainingHours() ?? 0;

    return {
      estimatedWorkload,
      actualWorkload,
      remainingWorkload
    };
  }

  // Task health assessment
  getTaskHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Time management (40% of health)
    factors.timeManagement = this.calculateTimeHealth();
    if (factors.timeManagement < 50) {
      issues.push('Task is behind schedule or overdue');
    }

    // Progress alignment (30% of health)
    factors.progressAlignment = this.calculateProgressHealth();
    if (factors.progressAlignment < 50) {
      issues.push('Progress does not align with time spent');
    }

    // Effort estimation (30% of health)
    factors.effortEstimation = this.calculateEffortHealth();
    if (factors.effortEstimation < 50) {
      issues.push('Effort estimation is significantly off');
    }

    const totalScore = 
      factors.timeManagement * 0.4 + 
      factors.progressAlignment * 0.3 + 
      factors.effortEstimation * 0.3;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateTimeHealth(): number {
    if (this.isCompleted()) {
      return this.isOverdue() ? 60 : 100; // Penalty for late completion
    }

    if (this.isOverdue()) {
      return 0; // Very unhealthy
    }

    const timeRemaining = this.getTimeRemaining();
    if (!timeRemaining.days && !timeRemaining.hours) {
      return 100; // No time pressure
    }

    // Health decreases as deadline approaches
    const totalDays = timeRemaining.days ?? 0;
    if (totalDays > 7) return 100;
    if (totalDays > 3) return 80;
    if (totalDays > 1) return 60;
    return 40;
  }

  private calculateProgressHealth(): number {
    if (!this.startedAt || !this.estimatedHours) return 100;

    const hoursSpent = this.actualHours ?? 0;
    const expectedProgress = Math.min(100, (hoursSpent / this.estimatedHours) * 100);
    const actualProgress = this.completionPercentage ?? 0;

    const progressDiff = Math.abs(expectedProgress - actualProgress);
    return Math.max(0, 100 - progressDiff * 2);
  }

  private calculateEffortHealth(): number {
    const accuracy = this.getEstimateAccuracy();
    if (accuracy === null) return 100;
    
    return accuracy * 100;
  }
}