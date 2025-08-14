import { Entity, Property } from '@mikro-orm/core';
import { RecordArchetype } from '../archetypes/RecordArchetype.js';

/**
 * Meeting notes with attendee tracking and action item management
 * Extends RecordArchetype with meeting-specific workflows
 */
@Entity({ tableName: 'meeting_notes' })
export class MeetingNotes extends RecordArchetype {
  @Property({ type: 'date', fieldName: 'meeting_date' })
  meetingDate!: Date;

  @Property({ type: 'integer', nullable: true, fieldName: 'duration_minutes' })
  durationMinutes?: number;

  @Property({ nullable: true })
  location?: string;

  @Property({ nullable: true, fieldName: 'meeting_type' })
  meetingType?: 'standup' | 'retrospective' | 'planning' | 'review' | 'one_on_one' | 'team' | 'client' | 'board';

  @Property({ type: 'json', nullable: true })
  attendees?: Array<{
    userId: string;
    name: string;
    role?: string;
    status: 'present' | 'absent' | 'late' | 'left_early';
    joinTime?: Date;
    leaveTime?: Date;
  }>;

  @Property({ type: 'json', nullable: true })
  agenda?: Array<{
    item: string;
    duration?: number; // minutes
    owner?: string;
    status?: 'not_started' | 'in_progress' | 'completed' | 'deferred';
    notes?: string;
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'action_items' })
  actionItems?: Array<{
    id: string;
    description: string;
    assignee: string;
    dueDate?: Date;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    createdAt: Date;
    completedAt?: Date;
    notes?: string;
  }>;

  @Property({ type: 'json', nullable: true })
  decisions?: Array<{
    description: string;
    rationale?: string;
    alternatives?: string[];
    decisionMaker: string;
    impact?: 'low' | 'medium' | 'high';
    followUpRequired?: boolean;
  }>;

  @Property({ type: 'json', nullable: true })
  issues?: Array<{
    description: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    owner?: string;
    resolution?: string;
    status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'next_steps' })
  nextSteps?: Array<{
    description: string;
    owner?: string;
    timeline?: string;
  }>;

  @Property({ nullable: true, fieldName: 'meeting_lead' })
  meetingLead?: string;

  @Property({ nullable: true, fieldName: 'note_taker' })
  noteTaker?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'recurring_meeting' })
  recurringMeeting?: {
    isRecurring: boolean;
    frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    seriesId?: string;
    previousMeetingId?: string;
    nextMeetingId?: string;
  };

  @Property({ type: 'json', nullable: true })
  attachments?: Array<{
    name: string;
    type: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'other';
    url: string;
    description?: string;
  }>;

  @Property({ type: 'text', nullable: true, fieldName: 'key_takeaways' })
  keyTakeaways?: string;

  @Property({ type: 'json', nullable: true, fieldName: 'parking_lot' })
  parkingLot?: Array<{
    item: string;
    addedBy: string;
    priority?: 'low' | 'medium' | 'high';
    followUpNeeded?: boolean;
  }>;

  // Implementation of abstract methods
  getRecordType(): string {
    return 'meeting_notes';
  }

  async validateRecordRules(): Promise<boolean> {
    const commonValidation = await this.validateCommonRules();
    if (!commonValidation.valid) return false;

    // Meeting-specific validation
    if (!this.meetingDate) {
      return false; // Meeting date is required
    }

    if (this.meetingDate > new Date()) {
      return false; // Cannot have notes for future meetings
    }

    if (!this.attendees || this.attendees.length === 0) {
      return false; // Must have at least one attendee
    }

    if (this.durationMinutes && this.durationMinutes <= 0) {
      return false; // Duration must be positive
    }

    // Validate attendee data
    for (const attendee of this.attendees) {
      if (!attendee.userId || !attendee.name) {
        return false; // All attendees must have ID and name
      }
    }

    return true;
  }

  async processContent(): Promise<void> {
    // Process meeting content for better searchability and structure
    const contentParts: string[] = [];

    // Add structured meeting information
    contentParts.push(`Meeting: ${this.title}`);
    contentParts.push(`Date: ${this.meetingDate.toDateString()}`);
    contentParts.push(`Type: ${this.meetingType || 'General'}`);

    // Add attendees
    if (this.attendees) {
      const attendeeNames = this.attendees.map(a => a.name).join(', ');
      contentParts.push(`Attendees: ${attendeeNames}`);
    }

    // Add agenda items
    if (this.agenda) {
      contentParts.push('Agenda:');
      this.agenda.forEach(item => {
        contentParts.push(`- ${item.item}`);
        if (item.notes) contentParts.push(`  Notes: ${item.notes}`);
      });
    }

    // Add action items
    if (this.actionItems) {
      contentParts.push('Action Items:');
      this.actionItems.forEach(item => {
        contentParts.push(`- ${item.description} (${item.assignee})`);
      });
    }

    // Add decisions
    if (this.decisions) {
      contentParts.push('Decisions:');
      this.decisions.forEach(decision => {
        contentParts.push(`- ${decision.description}`);
        if (decision.rationale) contentParts.push(`  Rationale: ${decision.rationale}`);
      });
    }

    // Add original content
    if (this.content) {
      contentParts.push('Notes:');
      contentParts.push(this.content);
    }

    // Update search content
    this.searchContent = contentParts.join('\n').toLowerCase();

    // Auto-generate keywords
    await this.generateKeywords();
  }

  async generateSummary(): Promise<string> {
    const summaryParts: string[] = [];

    // Meeting basics
    summaryParts.push(`${this.meetingType || 'Meeting'} held on ${this.meetingDate.toDateString()}`);

    // Attendee count
    const attendeeCount = this.attendees?.length || 0;
    summaryParts.push(`${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`);

    // Key metrics
    const actionItemCount = this.actionItems?.length || 0;
    const decisionCount = this.decisions?.length || 0;
    const issueCount = this.issues?.filter(i => i.status === 'open').length || 0;

    if (actionItemCount > 0) {
      summaryParts.push(`${actionItemCount} action item${actionItemCount !== 1 ? 's' : ''}`);
    }

    if (decisionCount > 0) {
      summaryParts.push(`${decisionCount} decision${decisionCount !== 1 ? 's' : ''} made`);
    }

    if (issueCount > 0) {
      summaryParts.push(`${issueCount} open issue${issueCount !== 1 ? 's' : ''}`);
    }

    // Key takeaways if available
    if (this.keyTakeaways) {
      summaryParts.push(`Key takeaways: ${this.keyTakeaways}`);
    }

    this.summary = summaryParts.join(', ') + '.';
    return this.summary;
  }

  // Meeting-specific business logic
  private async generateKeywords(): Promise<void> {
    const keywords: Set<string> = new Set();

    // Add meeting type
    if (this.meetingType) keywords.add(this.meetingType);

    // Add attendee names
    this.attendees?.forEach(attendee => {
      keywords.add(attendee.name.toLowerCase());
    });

    // Extract keywords from agenda items
    this.agenda?.forEach(item => {
      const words = item.item.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) keywords.add(word);
      });
    });

    // Extract keywords from action items
    this.actionItems?.forEach(item => {
      const words = item.description.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) keywords.add(word);
      });
    });

    this.keywords = Array.from(keywords);
  }

  // Attendee management
  addAttendee(userId: string, name: string, role?: string, status: NonNullable<MeetingNotes['attendees']>[0]['status'] = 'present'): void {
    if (!this.attendees) {
      this.attendees = [];
    }

    // Check if attendee already exists
    const existingIndex = this.attendees.findIndex(a => a.userId === userId);
    if (existingIndex >= 0) {
      // Update existing attendee
      this.attendees[existingIndex] = { userId, name, role, status };
    } else {
      // Add new attendee
      this.attendees.push({ userId, name, role, status });
    }
  }

  removeAttendee(userId: string): void {
    if (!this.attendees) return;
    this.attendees = this.attendees.filter(a => a.userId !== userId);
  }

  markAttendeeStatus(userId: string, status: NonNullable<MeetingNotes['attendees']>[0]['status']): void {
    const attendee = this.attendees?.find(a => a.userId === userId);
    if (attendee) {
      attendee.status = status;
      
      if (status === 'late') {
        attendee.joinTime = new Date();
      } else if (status === 'left_early') {
        attendee.leaveTime = new Date();
      }
    }
  }

  getAttendanceStats(): { total: number; present: number; absent: number; late: number; leftEarly: number } {
    if (!this.attendees) return { total: 0, present: 0, absent: 0, late: 0, leftEarly: 0 };

    const stats = {
      total: this.attendees.length,
      present: 0,
      absent: 0,
      late: 0,
      leftEarly: 0
    };

    this.attendees.forEach(attendee => {
      switch (attendee.status) {
        case 'present': stats.present++; break;
        case 'absent': stats.absent++; break;
        case 'late': stats.late++; break;
        case 'left_early': stats.leftEarly++; break;
      }
    });

    return stats;
  }

  // Action item management
  addActionItem(description: string, assignee: string, dueDate?: Date, priority?: NonNullable<MeetingNotes['actionItems']>[0]['priority']): string {
    if (!this.actionItems) {
      this.actionItems = [];
    }

    const actionItem = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description,
      assignee,
      dueDate,
      priority: priority || 'medium',
      status: 'open' as const,
      createdAt: new Date()
    };

    this.actionItems.push(actionItem);
    return actionItem.id;
  }

  updateActionItemStatus(actionItemId: string, status: NonNullable<MeetingNotes['actionItems']>[0]['status'], notes?: string): void {
    const actionItem = this.actionItems?.find(ai => ai.id === actionItemId);
    if (actionItem) {
      actionItem.status = status;
      if (notes) actionItem.notes = notes;
      
      if (status === 'completed') {
        actionItem.completedAt = new Date();
      }
    }
  }

  getActionItemStats(): { total: number; open: number; inProgress: number; completed: number; overdue: number } {
    if (!this.actionItems) return { total: 0, open: 0, inProgress: 0, completed: 0, overdue: 0 };

    const now = new Date();
    const stats = {
      total: this.actionItems.length,
      open: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0
    };

    this.actionItems.forEach(item => {
      switch (item.status) {
        case 'open': stats.open++; break;
        case 'in_progress': stats.inProgress++; break;
        case 'completed': stats.completed++; break;
      }

      // Check for overdue items
      if (item.dueDate && now > item.dueDate && item.status !== 'completed' && item.status !== 'cancelled') {
        stats.overdue++;
      }
    });

    return stats;
  }

  // Agenda management
  addAgendaItem(item: string, duration?: number, owner?: string): void {
    if (!this.agenda) {
      this.agenda = [];
    }

    this.agenda.push({
      item,
      duration,
      owner,
      status: 'not_started'
    });
  }

  updateAgendaItemStatus(index: number, status: NonNullable<MeetingNotes['agenda']>[0]['status'], notes?: string): void {
    if (this.agenda && this.agenda[index]) {
      this.agenda[index].status = status;
      if (notes) {
        this.agenda[index].notes = notes;
      }
    }
  }

  getAgendaProgress(): { total: number; completed: number; inProgress: number; deferred: number; percentage: number } {
    if (!this.agenda) return { total: 0, completed: 0, inProgress: 0, deferred: 0, percentage: 0 };

    const stats = {
      total: this.agenda.length,
      completed: 0,
      inProgress: 0,
      deferred: 0,
      percentage: 0
    };

    this.agenda.forEach(item => {
      switch (item.status) {
        case 'completed': stats.completed++; break;
        case 'in_progress': stats.inProgress++; break;
        case 'deferred': stats.deferred++; break;
      }
    });

    stats.percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    return stats;
  }

  // Decision tracking
  addDecision(description: string, rationale: string, decisionMaker: string, alternatives?: string[], impact?: NonNullable<MeetingNotes['decisions']>[0]['impact']): void {
    if (!this.decisions) {
      this.decisions = [];
    }

    this.decisions.push({
      description,
      rationale,
      alternatives,
      decisionMaker,
      impact: impact || 'medium'
    });
  }

  // Issue tracking
  addIssue(description: string, severity?: NonNullable<MeetingNotes['issues']>[0]['severity'], owner?: string): void {
    if (!this.issues) {
      this.issues = [];
    }

    this.issues.push({
      description,
      severity: severity || 'medium',
      owner,
      status: 'open'
    });
  }

  updateIssueStatus(index: number, status: NonNullable<MeetingNotes['issues']>[0]['status'], resolution?: string): void {
    if (this.issues && this.issues[index]) {
      this.issues[index].status = status;
      if (resolution) {
        this.issues[index].resolution = resolution;
      }
    }
  }

  // Parking lot management
  addToParkingLot(item: string, addedBy: string, priority?: NonNullable<MeetingNotes['parkingLot']>[0]['priority']): void {
    if (!this.parkingLot) {
      this.parkingLot = [];
    }

    this.parkingLot.push({
      item,
      addedBy,
      priority: priority || 'medium',
      followUpNeeded: true
    });
  }

  // Meeting series management
  linkToSeries(seriesId: string, previousMeetingId?: string, nextMeetingId?: string): void {
    this.recurringMeeting = {
      isRecurring: true,
      seriesId,
      previousMeetingId,
      nextMeetingId
    };
  }

  // Meeting effectiveness metrics
  getMeetingEffectiveness(): { score: number; factors: Record<string, number>; recommendations: string[] } {
    const factors: Record<string, number> = {};
    const recommendations: string[] = [];

    // Attendance factor (25%)
    const attendance = this.getAttendanceStats();
    factors.attendance = attendance.total > 0 ? (attendance.present / attendance.total) * 100 : 0;
    if (factors.attendance < 80) {
      recommendations.push('Improve meeting attendance');
    }

    // Agenda completion (25%)
    const agendaProgress = this.getAgendaProgress();
    factors.agendaCompletion = agendaProgress.percentage;
    if (factors.agendaCompletion < 80) {
      recommendations.push('Better agenda time management needed');
    }

    // Action item generation (25%)
    const actionItemCount = this.actionItems?.length || 0;
    factors.actionItems = Math.min(100, actionItemCount * 20); // Cap at 100%
    if (actionItemCount === 0) {
      recommendations.push('Consider generating action items for follow-up');
    }

    // Decision making (25%)
    const decisionCount = this.decisions?.length || 0;
    factors.decisions = Math.min(100, decisionCount * 25); // Cap at 100%
    if (decisionCount === 0 && this.meetingType !== 'standup') {
      recommendations.push('Document key decisions made during the meeting');
    }

    const totalScore = (
      factors.attendance * 0.25 +
      factors.agendaCompletion * 0.25 +
      factors.actionItems * 0.25 +
      factors.decisions * 0.25
    );

    return {
      score: Math.round(totalScore),
      factors,
      recommendations
    };
  }

  // Generate meeting minutes format
  generateMinutes(): string {
    const minutes: string[] = [];

    minutes.push(`MEETING MINUTES: ${this.title}`);
    minutes.push(`Date: ${this.meetingDate.toDateString()}`);
    minutes.push(`Duration: ${this.durationMinutes || 'N/A'} minutes`);
    minutes.push(`Type: ${this.meetingType || 'General'}`);
    minutes.push('');

    // Attendees
    if (this.attendees) {
      minutes.push('ATTENDEES:');
      this.attendees.forEach(attendee => {
        const statusIcon = attendee.status === 'present' ? '✓' : 
                          attendee.status === 'late' ? '⏰' : 
                          attendee.status === 'left_early' ? '⏰' : '✗';
        minutes.push(`${statusIcon} ${attendee.name}${attendee.role ? ` (${attendee.role})` : ''}`);
      });
      minutes.push('');
    }

    // Agenda
    if (this.agenda) {
      minutes.push('AGENDA:');
      this.agenda.forEach((item, index) => {
        const statusIcon = item.status === 'completed' ? '✓' : 
                          item.status === 'in_progress' ? '🔄' : 
                          item.status === 'deferred' ? '⏳' : '○';
        minutes.push(`${index + 1}. ${statusIcon} ${item.item}`);
        if (item.notes) {
          minutes.push(`   Notes: ${item.notes}`);
        }
      });
      minutes.push('');
    }

    // Decisions
    if (this.decisions && this.decisions.length > 0) {
      minutes.push('DECISIONS:');
      this.decisions.forEach((decision, index) => {
        minutes.push(`${index + 1}. ${decision.description}`);
        if (decision.rationale) {
          minutes.push(`   Rationale: ${decision.rationale}`);
        }
        minutes.push(`   Decision Maker: ${decision.decisionMaker}`);
      });
      minutes.push('');
    }

    // Action Items
    if (this.actionItems && this.actionItems.length > 0) {
      minutes.push('ACTION ITEMS:');
      this.actionItems.forEach((item, index) => {
        const dueDate = item.dueDate ? ` (Due: ${item.dueDate.toDateString()})` : '';
        minutes.push(`${index + 1}. ${item.description} - ${item.assignee}${dueDate}`);
      });
      minutes.push('');
    }

    // Issues
    if (this.issues && this.issues.length > 0) {
      minutes.push('ISSUES:');
      this.issues.forEach((issue, index) => {
        const severity = issue.severity ? ` [${issue.severity.toUpperCase()}]` : '';
        minutes.push(`${index + 1}.${severity} ${issue.description}`);
        if (issue.owner) {
          minutes.push(`   Owner: ${issue.owner}`);
        }
      });
      minutes.push('');
    }

    // Next Steps
    if (this.nextSteps && this.nextSteps.length > 0) {
      minutes.push('NEXT STEPS:');
      this.nextSteps.forEach((step, index) => {
        minutes.push(`${index + 1}. ${step.description}`);
        if (step.owner) {
          minutes.push(`   Owner: ${step.owner}`);
        }
        if (step.timeline) {
          minutes.push(`   Timeline: ${step.timeline}`);
        }
      });
      minutes.push('');
    }

    // Key Takeaways
    if (this.keyTakeaways) {
      minutes.push('KEY TAKEAWAYS:');
      minutes.push(this.keyTakeaways);
      minutes.push('');
    }

    // Additional Notes
    if (this.content) {
      minutes.push('ADDITIONAL NOTES:');
      minutes.push(this.content);
    }

    return minutes.join('\n');
  }
}