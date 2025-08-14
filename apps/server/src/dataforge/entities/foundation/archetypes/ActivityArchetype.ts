/**
 * Activity Entity - Time-Based Occurrences and Scheduled Activities
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents activities, milestones, and occurrences that happen at specific times or within time ranges.
 * Handles meetings, deadlines, deployments, maintenance windows, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type ActivityStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed' | 'failed';
export type ActivityType = 'meeting' | 'deadline' | 'milestone' | 'deployment' | 'maintenance' | 'review' | 'event' | 'appointment' | 'call' | 'other';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval: number; // Every N days/weeks/months/years
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number; // Day of month for monthly recurrence
  endDate?: string; // ISO date string
  occurrences?: number; // Maximum number of occurrences
}

export interface ActivityFields extends BaseDomainEntityFields {
  title: string;
  description: string | null;
  activity_type: ActivityType;
  status: ActivityStatus;
  start_time: Date;
  end_time: Date | null;
  timezone: string | null;
  location: string | null;
  organizer_id: string | null;
  is_all_day: boolean;
  is_milestone: boolean;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  parent_activity_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  attendees: string[] | null;
  reminder_minutes: number | null;
  completion_percentage: number;
  actual_start_time: Date | null;
  actual_end_time: Date | null;
  priority: string | null;
  tags: string[] | null;
  metadata: any;
}

export class Activity extends BaseDomainEntity {
  title!: string;
  description?: string | null;
  activity_type!: ActivityType;
  status!: ActivityStatus;
  start_time!: Date;
  end_time?: Date | null; // Null for milestones/deadlines
  timezone?: string | null; // IANA timezone identifier
  location?: string | null; // Physical or virtual location
  organizer_id?: string | null; // Who organized/owns the activity
  is_all_day!: boolean;
  is_milestone!: boolean; // Important checkpoint/deadline
  is_recurring!: boolean;
  recurrence_rule?: RecurrenceRule | null;
  parent_activity_id?: string | null; // For recurring instances
  related_entity_type?: string | null; // Polymorphic relation (project, task, etc.)
  related_entity_id?: string | null;
  attendees?: string[] | null; // User IDs of participants
  reminder_minutes?: number | null; // Minutes before to send reminder
  completion_percentage!: number; // 0-100
  actual_start_time?: Date | null; // When it actually started
  actual_end_time?: Date | null; // When it actually ended
  priority?: string | null; // High, medium, low
  tags?: string[] | null;
  metadata?: any; // Additional activity context

  constructor(data?: Partial<ActivityFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'activity';
    if (!this.status) this.status = 'scheduled';
    if (!this.activity_type) this.activity_type = 'event';
    if (this.is_all_day === undefined) this.is_all_day = false;
    if (this.is_milestone === undefined) this.is_milestone = false;
    if (this.is_recurring === undefined) this.is_recurring = false;
    if (!this.completion_percentage) this.completion_percentage = 0;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Activity table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      title: 'varchar(500)',
      description: 'text',
      activity_type: 'varchar(50)',
      status: 'varchar(50)',
      start_time: 'timestamptz',
      end_time: 'timestamptz',
      timezone: 'varchar(100)',
      location: 'varchar(500)',
      organizer_id: 'uuid',
      is_all_day: 'boolean',
      is_milestone: 'boolean',
      is_recurring: 'boolean',
      recurrence_rule: 'jsonb',
      parent_activity_id: 'uuid',
      related_entity_type: 'varchar(50)',
      related_entity_id: 'uuid',
      attendees: 'text[]',
      reminder_minutes: 'integer',
      completion_percentage: 'integer',
      actual_start_time: 'timestamptz',
      actual_end_time: 'timestamptz',
      priority: 'varchar(50)',
      tags: 'text[]',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Activity table creation
   */
  static getActivityDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "activity" (
        ${super.getDomainDDL()},
        title VARCHAR(500) NOT NULL,
        description TEXT,
        activity_type VARCHAR(50) DEFAULT 'event' NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled' NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        timezone VARCHAR(100),
        location VARCHAR(500),
        organizer_id UUID REFERENCES "user"(id),
        is_all_day BOOLEAN DEFAULT FALSE NOT NULL,
        is_milestone BOOLEAN DEFAULT FALSE NOT NULL,
        is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
        recurrence_rule JSONB,
        parent_activity_id UUID REFERENCES "activity"(id),
        related_entity_type VARCHAR(50),
        related_entity_id UUID,
        attendees TEXT[],
        reminder_minutes INTEGER CHECK (reminder_minutes >= 0),
        completion_percentage INTEGER DEFAULT 0 NOT NULL CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
        actual_start_time TIMESTAMPTZ,
        actual_end_time TIMESTAMPTZ,
        priority VARCHAR(50),
        tags TEXT[],
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_activity_type CHECK (activity_type IN ('meeting', 'deadline', 'milestone', 'deployment', 'maintenance', 'review', 'event', 'appointment', 'call', 'other')),
        CONSTRAINT chk_activity_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed', 'failed')),
        CONSTRAINT chk_end_after_start CHECK (end_time IS NULL OR end_time > start_time),
        CONSTRAINT chk_actual_times CHECK (
          actual_end_time IS NULL OR 
          actual_start_time IS NULL OR 
          actual_end_time >= actual_start_time
        ),
        CONSTRAINT chk_milestone_no_end CHECK (NOT (is_milestone = TRUE AND end_time IS NOT NULL)),
        CONSTRAINT chk_recurring_has_rule CHECK (NOT (is_recurring = TRUE AND recurrence_rule IS NULL)),
        CONSTRAINT chk_title_not_empty CHECK (title != '')
      );
    `;
  }

  /**
   * Get the indexes for Activity table
   */
  static getActivityIndexes(): string[] {
    return [
      ...super.getDomainIndexes('activity'),
      `CREATE INDEX IF NOT EXISTS idx_activity_title ON "activity"(title);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_type ON "activity"(activity_type);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_status ON "activity"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_start_time ON "activity"(start_time);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_end_time ON "activity"(end_time);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_organizer ON "activity"(organizer_id);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_parent ON "activity"(parent_activity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_related ON "activity"(related_entity_type, related_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_is_milestone ON "activity"(is_milestone) WHERE is_milestone = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_activity_is_recurring ON "activity"(is_recurring) WHERE is_recurring = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_activity_attendees ON "activity" USING GIN(attendees);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_tags ON "activity" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_metadata ON "activity" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_priority ON "activity"(priority);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_completion ON "activity"(completion_percentage);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_time_range ON "activity"(start_time, end_time);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_type_status ON "activity"(activity_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_organizer_time ON "activity"(organizer_id, start_time);`,
      `CREATE INDEX IF NOT EXISTS idx_activity_search ON "activity" USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));`,
      `CREATE INDEX IF NOT EXISTS idx_activity_upcoming ON "activity"(start_time) WHERE status = 'scheduled' AND start_time > NOW();`,
      `CREATE INDEX IF NOT EXISTS idx_activity_today ON "activity"(start_time) WHERE DATE(start_time) = CURRENT_DATE;`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): ActivityFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      title: this.title,
      description: this.description,
      activity_type: this.activity_type || 'event',
      status: this.status || 'scheduled',
      start_time: this.start_time,
      end_time: this.end_time,
      timezone: this.timezone,
      location: this.location,
      organizer_id: this.organizer_id,
      is_all_day: this.is_all_day || false,
      is_milestone: this.is_milestone || false,
      is_recurring: this.is_recurring || false,
      recurrence_rule: this.recurrence_rule,
      parent_activity_id: this.parent_activity_id,
      related_entity_type: this.related_entity_type,
      related_entity_id: this.related_entity_id,
      attendees: this.attendees,
      reminder_minutes: this.reminder_minutes,
      completion_percentage: this.completion_percentage || 0,
      actual_start_time: this.actual_start_time,
      actual_end_time: this.actual_end_time,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<ActivityFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      title: this.title,
      description: this.description,
      status: this.status,
      start_time: this.start_time,
      end_time: this.end_time,
      timezone: this.timezone,
      location: this.location,
      is_all_day: this.is_all_day,
      attendees: this.attendees,
      reminder_minutes: this.reminder_minutes,
      completion_percentage: this.completion_percentage,
      actual_start_time: this.actual_start_time,
      actual_end_time: this.actual_end_time,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): ActivityFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      title: this.title,
      description: this.description,
      activity_type: this.activity_type,
      status: this.status,
      start_time: this.start_time,
      end_time: this.end_time,
      timezone: this.timezone,
      location: this.location,
      organizer_id: this.organizer_id,
      is_all_day: this.is_all_day,
      is_milestone: this.is_milestone,
      is_recurring: this.is_recurring,
      recurrence_rule: this.recurrence_rule,
      parent_activity_id: this.parent_activity_id,
      related_entity_type: this.related_entity_type,
      related_entity_id: this.related_entity_id,
      attendees: this.attendees,
      reminder_minutes: this.reminder_minutes,
      completion_percentage: this.completion_percentage,
      actual_start_time: this.actual_start_time,
      actual_end_time: this.actual_end_time,
      priority: this.priority,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if activity is scheduled
   */
  isScheduled(): boolean {
    return this.status === 'scheduled';
  }

  /**
   * Check if activity is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Check if activity is in progress
   */
  isInProgress(): boolean {
    return this.status === 'in_progress';
  }

  /**
   * Check if activity is cancelled
   */
  isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  /**
   * Check if activity is a milestone
   */
  isMilestone(): boolean {
    return this.is_milestone;
  }

  /**
   * Check if activity is recurring
   */
  isRecurring(): boolean {
    return this.is_recurring;
  }

  /**
   * Check if activity is happening now
   */
  isHappening(): boolean {
    const now = new Date();
    return now >= this.start_time && 
           (this.end_time ? now <= this.end_time : true) &&
           this.status === 'in_progress';
  }

  /**
   * Check if activity is in the past
   */
  isPast(): boolean {
    const now = new Date();
    return this.end_time ? now > this.end_time : now > this.start_time;
  }

  /**
   * Check if activity is upcoming
   */
  isUpcoming(): boolean {
    return this.start_time > new Date() && this.status === 'scheduled';
  }

  /**
   * Check if activity is overdue
   */
  isOverdue(): boolean {
    const now = new Date();
    return (this.end_time ? now > this.end_time : now > this.start_time) &&
           !this.isCompleted() &&
           !this.isCancelled();
  }

  /**
   * Get duration in minutes
   */
  getDuration(): number | null {
    if (!this.end_time) return null;
    return Math.ceil((this.end_time.getTime() - this.start_time.getTime()) / (1000 * 60));
  }

  /**
   * Get actual duration in minutes
   */
  getActualDuration(): number | null {
    if (!this.actual_start_time || !this.actual_end_time) return null;
    return Math.ceil((this.actual_end_time.getTime() - this.actual_start_time.getTime()) / (1000 * 60));
  }

  /**
   * Get time until start in minutes
   */
  getTimeUntilStart(): number {
    const diffTime = this.start_time.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60));
  }

  /**
   * Get time since end in minutes
   */
  getTimeSinceEnd(): number | null {
    if (!this.end_time) return null;
    const diffTime = new Date().getTime() - this.end_time.getTime();
    return Math.ceil(diffTime / (1000 * 60));
  }

  /**
   * Start activity
   */
  start(): boolean {
    if (this.status !== 'scheduled') return false;
    
    this.status = 'in_progress';
    this.actual_start_time = new Date();
    this.metadata = {
      ...this.metadata,
      startedAt: new Date()
    };
    return true;
  }

  /**
   * Complete activity
   */
  complete(): boolean {
    if (!['scheduled', 'in_progress'].includes(this.status)) return false;
    
    this.status = 'completed';
    this.completion_percentage = 100;
    this.actual_end_time = new Date();
    
    if (!this.actual_start_time) {
      this.actual_start_time = this.start_time;
    }
    
    this.metadata = {
      ...this.metadata,
      completedAt: new Date()
    };
    return true;
  }

  /**
   * Cancel activity
   */
  cancel(reason?: string): boolean {
    if (this.status === 'completed') return false;
    
    this.status = 'cancelled';
    this.metadata = {
      ...this.metadata,
      cancelledAt: new Date(),
      cancellationReason: reason
    };
    return true;
  }

  /**
   * Postpone activity
   */
  postpone(newStartTime: Date, newEndTime?: Date, reason?: string): boolean {
    if (!this.isScheduled()) return false;
    
    const oldStartTime = this.start_time;
    const oldEndTime = this.end_time;
    
    this.start_time = newStartTime;
    if (newEndTime !== undefined) {
      this.end_time = newEndTime;
    } else if (this.end_time) {
      // Maintain duration if end time was set
      const duration = this.getDuration();
      if (duration) {
        this.end_time = new Date(newStartTime.getTime() + duration * 60 * 1000);
      }
    }
    
    this.status = 'postponed';
    this.metadata = {
      ...this.metadata,
      postponedAt: new Date(),
      postponementReason: reason,
      originalStartTime: oldStartTime,
      originalEndTime: oldEndTime
    };
    
    return true;
  }

  /**
   * Reschedule activity (back to scheduled status)
   */
  reschedule(newStartTime: Date, newEndTime?: Date): boolean {
    this.start_time = newStartTime;
    if (newEndTime !== undefined) {
      this.end_time = newEndTime;
    }
    
    this.status = 'scheduled';
    this.metadata = {
      ...this.metadata,
      rescheduledAt: new Date()
    };
    
    return true;
  }

  /**
   * Update completion percentage
   */
  updateProgress(percentage: number): boolean {
    if (percentage < 0 || percentage > 100) return false;
    
    this.completion_percentage = percentage;
    
    if (percentage === 100 && this.status === 'in_progress') {
      this.complete();
    }
    
    this.metadata = {
      ...this.metadata,
      progressUpdatedAt: new Date(),
      progressHistory: [...(this.metadata?.progressHistory || []), {
        percentage,
        timestamp: new Date()
      }].slice(-10) // Keep last 10 updates
    };
    
    return true;
  }

  /**
   * Add attendee
   */
  addAttendee(userId: string): void {
    if (!this.attendees) this.attendees = [];
    if (!this.attendees.includes(userId)) {
      this.attendees.push(userId);
    }
  }

  /**
   * Remove attendee
   */
  removeAttendee(userId: string): void {
    if (this.attendees) {
      this.attendees = this.attendees.filter(id => id !== userId);
    }
  }

  /**
   * Check if user is attendee
   */
  isAttendee(userId: string): boolean {
    return !!(this.attendees && this.attendees.includes(userId));
  }

  /**
   * Get attendee count
   */
  getAttendeeCount(): number {
    return this.attendees?.length || 0;
  }

  /**
   * Add tag
   */
  addTag(tag: string): void {
    if (!this.tags) this.tags = [];
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * Remove tag
   */
  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  /**
   * Check if activity has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Set reminder
   */
  setReminder(minutes: number): void {
    this.reminder_minutes = minutes;
  }

  /**
   * Check if reminder is due
   */
  isReminderDue(): boolean {
    if (!this.reminder_minutes) return false;
    const reminderTime = new Date(this.start_time.getTime() - this.reminder_minutes * 60 * 1000);
    return new Date() >= reminderTime && !this.isCompleted() && !this.isCancelled();
  }

  /**
   * Create next recurring instance
   */
  createNextRecurrence(): Activity | null {
    if (!this.is_recurring || !this.recurrence_rule) return null;
    
    const rule = this.recurrence_rule;
    let nextStartTime: Date;
    
    switch (rule.type) {
      case 'daily':
        nextStartTime = new Date(this.start_time.getTime() + rule.interval * 24 * 60 * 60 * 1000);
        break;
      
      case 'weekly':
        nextStartTime = new Date(this.start_time.getTime() + rule.interval * 7 * 24 * 60 * 60 * 1000);
        break;
      
      case 'monthly':
        nextStartTime = new Date(this.start_time);
        nextStartTime.setMonth(nextStartTime.getMonth() + rule.interval);
        break;
      
      case 'yearly':
        nextStartTime = new Date(this.start_time);
        nextStartTime.setFullYear(nextStartTime.getFullYear() + rule.interval);
        break;
      
      default:
        return null;
    }
    
    // Check if we've reached the end date or max occurrences
    if (rule.endDate && nextStartTime > new Date(rule.endDate)) {
      return null;
    }
    
    let nextEndTime: Date | null = null;
    if (this.end_time) {
      const duration = this.getDuration();
      if (duration) {
        nextEndTime = new Date(nextStartTime.getTime() + duration * 60 * 1000);
      }
    }
    
    return new Activity({
      title: this.title,
      description: this.description,
      activity_type: this.activity_type,
      start_time: nextStartTime,
      end_time: nextEndTime,
      timezone: this.timezone,
      location: this.location,
      organizer_id: this.organizer_id,
      is_all_day: this.is_all_day,
      is_milestone: this.is_milestone,
      is_recurring: this.is_recurring,
      recurrence_rule: this.recurrence_rule,
      parent_activity_id: this.id,
      related_entity_type: this.related_entity_type,
      related_entity_id: this.related_entity_id,
      attendees: this.attendees ? [...this.attendees] : null,
      reminder_minutes: this.reminder_minutes,
      priority: this.priority,
      tags: this.tags ? [...this.tags] : null,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: {
        ...this.metadata,
        isRecurringInstance: true,
        parentActivityId: this.id,
        recurrenceSequence: (this.metadata?.recurrenceSequence || 0) + 1
      }
    });
  }

  /**
   * Search activity content
   */
  search(query: string): boolean {
    const searchText = `${this.title} ${this.description || ''} ${this.location || ''} ${this.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Get activity age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate activity
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.title || this.title.trim() === '') {
      errors.push('Title is required');
    }

    if (this.end_time && this.end_time <= this.start_time) {
      errors.push('End time must be after start time');
    }

    if (this.is_milestone && this.end_time) {
      errors.push('Milestones cannot have end times');
    }

    if (this.is_recurring && !this.recurrence_rule) {
      errors.push('Recurring activities must have recurrence rules');
    }

    if (this.completion_percentage < 0 || this.completion_percentage > 100) {
      errors.push('Completion percentage must be between 0 and 100');
    }

    if (this.reminder_minutes && this.reminder_minutes < 0) {
      errors.push('Reminder minutes cannot be negative');
    }

    if (this.actual_start_time && this.actual_end_time && this.actual_end_time < this.actual_start_time) {
      errors.push('Actual end time must be after actual start time');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get activity summary
   */
  getSummary(): {
    id: string;
    title: string;
    type: string;
    status: string;
    startTime: Date;
    endTime: Date | null;
    duration: number | null;
    isUpcoming: boolean;
    isPast: boolean;
    isHappening: boolean;
    isOverdue: boolean;
    isMilestone: boolean;
    isRecurring: boolean;
    attendeeCount: number;
    completionPercentage: number;
    hasReminder: boolean;
  } {
    return {
      id: this.id,
      title: this.title,
      type: this.activity_type,
      status: this.status,
      startTime: this.start_time,
      endTime: this.end_time,
      duration: this.getDuration(),
      isUpcoming: this.isUpcoming(),
      isPast: this.isPast(),
      isHappening: this.isHappening(),
      isOverdue: this.isOverdue(),
      isMilestone: this.isMilestone(),
      isRecurring: this.isRecurring(),
      attendeeCount: this.getAttendeeCount(),
      completionPercentage: this.completion_percentage,
      hasReminder: !!this.reminder_minutes
    };
  }

  /**
   * Validate activity data
   */
  static validateActivity(data: Partial<ActivityFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.title || data.title.trim() === '') {
      errors.push('Title is required');
    }

    if (!data.start_time) {
      errors.push('Start time is required');
    }

    const validTypes: ActivityType[] = ['meeting', 'deadline', 'milestone', 'deployment', 'maintenance', 'review', 'event', 'appointment', 'call', 'other'];
    if (data.activity_type && !validTypes.includes(data.activity_type)) {
      errors.push('Invalid activity type');
    }

    const validStatuses: ActivityStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed', 'failed'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid activity status');
    }

    if (data.end_time && data.start_time && data.end_time <= data.start_time) {
      errors.push('End time must be after start time');
    }

    if (data.completion_percentage !== undefined && (data.completion_percentage < 0 || data.completion_percentage > 100)) {
      errors.push('Completion percentage must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Activity Utilities for common operations
 */
export class ActivityUtilities {
  /**
   * Filter activities by type
   */
  static filterByType(activities: Activity[], activityType: ActivityType): Activity[] {
    return activities.filter(a => a.activity_type === activityType);
  }

  /**
   * Filter upcoming activities
   */
  static filterUpcoming(activities: Activity[]): Activity[] {
    return activities.filter(a => a.isUpcoming());
  }

  /**
   * Filter activities happening today
   */
  static filterToday(activities: Activity[]): Activity[] {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return activities.filter(a => 
      a.start_time >= startOfDay && a.start_time < endOfDay
    );
  }

  /**
   * Filter overdue activities
   */
  static filterOverdue(activities: Activity[]): Activity[] {
    return activities.filter(a => a.isOverdue());
  }

  /**
   * Filter completed activities
   */
  static filterCompleted(activities: Activity[]): Activity[] {
    return activities.filter(a => a.isCompleted());
  }

  /**
   * Filter milestones
   */
  static filterMilestones(activities: Activity[]): Activity[] {
    return activities.filter(a => a.isMilestone());
  }

  /**
   * Filter activities by organizer
   */
  static filterByOrganizer(activities: Activity[], organizerId: string): Activity[] {
    return activities.filter(a => a.organizer_id === organizerId);
  }

  /**
   * Filter activities by attendee
   */
  static filterByAttendee(activities: Activity[], attendeeId: string): Activity[] {
    return activities.filter(a => a.isAttendee(attendeeId));
  }

  /**
   * Group activities by type
   */
  static groupByType(activities: Activity[]): Record<ActivityType, Activity[]> {
    return activities.reduce((groups, activity) => {
      if (!groups[activity.activity_type]) {
        groups[activity.activity_type] = [];
      }
      groups[activity.activity_type].push(activity);
      return groups;
    }, {} as Record<ActivityType, Activity[]>);
  }

  /**
   * Group activities by status
   */
  static groupByStatus(activities: Activity[]): Record<ActivityStatus, Activity[]> {
    return activities.reduce((groups, activity) => {
      if (!groups[activity.status]) {
        groups[activity.status] = [];
      }
      groups[activity.status].push(activity);
      return groups;
    }, {} as Record<ActivityStatus, Activity[]>);
  }

  /**
   * Sort activities by start time
   */
  static sortByStartTime(activities: Activity[], ascending = true): Activity[] {
    return [...activities].sort((a, b) => {
      const diff = a.start_time.getTime() - b.start_time.getTime();
      return ascending ? diff : -diff;
    });
  }

  /**
   * Search activities
   */
  static search(activities: Activity[], query: string): Activity[] {
    if (!query.trim()) return activities;
    return activities.filter(a => a.search(query));
  }

  /**
   * Get activities in date range
   */
  static getInDateRange(activities: Activity[], startDate: Date, endDate: Date): Activity[] {
    return activities.filter(a => 
      a.start_time >= startDate && 
      (a.end_time ? a.end_time <= endDate : a.start_time <= endDate)
    );
  }

  /**
   * Calculate statistics
   */
  static calculateStats(activities: Activity[]) {
    const stats = {
      total: activities.length,
      scheduled: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      upcoming: 0,
      milestones: 0,
      recurring: 0,
      withAttendees: 0,
      byType: {} as Record<string, number>,
      averageDuration: 0,
      averageAttendees: 0
    };

    let totalDuration = 0;
    let totalAttendees = 0;
    let activitiesWithDuration = 0;

    activities.forEach(activity => {
      if (activity.isScheduled()) stats.scheduled++;
      if (activity.isInProgress()) stats.inProgress++;
      if (activity.isCompleted()) stats.completed++;
      if (activity.isCancelled()) stats.cancelled++;
      if (activity.isOverdue()) stats.overdue++;
      if (activity.isUpcoming()) stats.upcoming++;
      if (activity.isMilestone()) stats.milestones++;
      if (activity.isRecurring()) stats.recurring++;
      if (activity.getAttendeeCount() > 0) stats.withAttendees++;

      stats.byType[activity.activity_type] = (stats.byType[activity.activity_type] || 0) + 1;

      const duration = activity.getDuration();
      if (duration) {
        totalDuration += duration;
        activitiesWithDuration++;
      }

      totalAttendees += activity.getAttendeeCount();
    });

    stats.averageDuration = activitiesWithDuration > 0 ? totalDuration / activitiesWithDuration : 0;
    stats.averageAttendees = activities.length > 0 ? totalAttendees / activities.length : 0;

    return stats;
  }
}

export default Activity;