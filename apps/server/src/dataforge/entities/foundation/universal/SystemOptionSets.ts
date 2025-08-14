/**
 * System Option Set Types - Enhanced Option Sets with Special Behaviors
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Provides 4 special option set types with system behaviors:
 * - StatusOptionSet: Completion criteria and workflow logic
 * - PriorityOptionSet: Urgency and escalation rules
 * - CategoryOptionSet: Classification and behavior rules  
 * - DiscussionTypeOptionSet: Threading and resolution capabilities
 */

import { OptionSet, type OptionSetFields } from './OptionSet';
import { Option, type OptionFields } from './Option';

// =============================================================================
// STATUS OPTION SET - Completion Criteria and Workflow Logic
// =============================================================================

export interface StatusOptionMetadata {
  isCompletionState: boolean;
  allowedTransitions: string[];
  completionCriteria?: {
    allChildTasksComplete?: boolean;
    budgetApproved?: boolean;
    documentsUploaded?: boolean;
    customCriteria?: Record<string, any>;
  };
  color: string;
  icon: string;
  workflowStage?: string;
  autoActions?: {
    onEnter?: string[];
    onExit?: string[];
  };
}

export interface StatusOptionFields extends OptionFields {
  metadata: StatusOptionMetadata;
}

export class StatusOptionSet extends OptionSet {
  constructor(data?: Partial<OptionSetFields>) {
    super({
      ...data,
      set_type: 'status_system',
      category: 'workflow'
    });
  }

  /**
   * Create standard status options for projects
   */
  static createProjectStatusOptions(): StatusOptionFields[] {
    return [
      {
        key: 'planning',
        display_name: 'Planning',
        description: 'Project is in planning phase',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['planning'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 10,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['active', 'cancelled'],
          color: '#6b7280',
          icon: 'calendar',
          workflowStage: 'initial',
          autoActions: {
            onEnter: ['create_planning_tasks', 'notify_stakeholders']
          }
        }
      } as StatusOptionFields,
      {
        key: 'active',
        display_name: 'Active',
        description: 'Project is actively being worked on',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['active'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 20,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['completed', 'on_hold', 'cancelled'],
          color: '#3b82f6',
          icon: 'play-circle',
          workflowStage: 'execution'
        }
      } as StatusOptionFields,
      {
        key: 'on_hold',
        display_name: 'On Hold',
        description: 'Project is temporarily paused',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['on_hold'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 25,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['active', 'cancelled'],
          color: '#f59e0b',
          icon: 'pause-circle',
          workflowStage: 'suspended'
        }
      } as StatusOptionFields,
      {
        key: 'completed',
        display_name: 'Completed',
        description: 'Project has been successfully completed',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['completed'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 30,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: true,
          allowedTransitions: ['archived'],
          completionCriteria: {
            allChildTasksComplete: true,
            budgetApproved: true
          },
          color: '#22c55e',
          icon: 'check-circle',
          workflowStage: 'completed',
          autoActions: {
            onEnter: ['calculate_metrics', 'notify_completion', 'archive_related_tasks']
          }
        }
      } as StatusOptionFields,
      {
        key: 'cancelled',
        display_name: 'Cancelled',
        description: 'Project has been cancelled',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['cancelled'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 40,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: true,
          allowedTransitions: ['archived'],
          color: '#ef4444',
          icon: 'x-circle',
          workflowStage: 'terminated'
        }
      } as StatusOptionFields
    ];
  }

  /**
   * Create standard status options for tasks
   */
  static createTaskStatusOptions(): StatusOptionFields[] {
    return [
      {
        key: 'todo',
        display_name: 'To Do',
        description: 'Task is ready to be started',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['todo'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 10,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['doing', 'cancelled'],
          color: '#6b7280',
          icon: 'circle',
          workflowStage: 'backlog'
        }
      } as StatusOptionFields,
      {
        key: 'doing',
        display_name: 'In Progress',
        description: 'Task is currently being worked on',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['doing'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 20,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['done', 'blocked', 'todo'],
          color: '#f59e0b',
          icon: 'play-circle',
          workflowStage: 'active'
        }
      } as StatusOptionFields,
      {
        key: 'blocked',
        display_name: 'Blocked',
        description: 'Task is blocked and cannot proceed',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['blocked'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 25,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: false,
          allowedTransitions: ['doing', 'todo'],
          color: '#dc2626',
          icon: 'shield-exclamation',
          workflowStage: 'impediment'
        }
      } as StatusOptionFields,
      {
        key: 'done',
        display_name: 'Done',
        description: 'Task has been completed',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['done'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 30,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isCompletionState: true,
          allowedTransitions: ['archived'],
          color: '#22c55e',
          icon: 'check-circle',
          workflowStage: 'completed',
          autoActions: {
            onEnter: ['mark_completion_time', 'notify_watchers']
          }
        }
      } as StatusOptionFields
    ];
  }

  /**
   * Check if transition between statuses is allowed
   */
  static isTransitionAllowed(fromStatus: StatusOptionFields, toStatus: string): boolean {
    return fromStatus.metadata.allowedTransitions.includes(toStatus);
  }

  /**
   * Get completion status options
   */
  static getCompletionStatuses(options: StatusOptionFields[]): StatusOptionFields[] {
    return options.filter(opt => opt.metadata.isCompletionState);
  }

  /**
   * Validate completion criteria
   */
  static validateCompletionCriteria(status: StatusOptionFields, entityData: any): {
    canComplete: boolean;
    missingCriteria: string[];
  } {
    const criteria = status.metadata.completionCriteria;
    const missingCriteria: string[] = [];

    if (!criteria) {
      return { canComplete: true, missingCriteria: [] };
    }

    if (criteria.allChildTasksComplete && !entityData.allChildTasksComplete) {
      missingCriteria.push('All child tasks must be completed');
    }

    if (criteria.budgetApproved && !entityData.budgetApproved) {
      missingCriteria.push('Budget approval required');
    }

    if (criteria.documentsUploaded && !entityData.documentsUploaded) {
      missingCriteria.push('Required documents must be uploaded');
    }

    return {
      canComplete: missingCriteria.length === 0,
      missingCriteria
    };
  }
}

// =============================================================================
// PRIORITY OPTION SET - Urgency and Escalation Rules
// =============================================================================

export interface PriorityOptionMetadata {
  urgencyLevel: number; // 1-5 scale
  escalationRules?: {
    escalateAfterDays: number;
    escalateTo: string;
    notificationRules?: string[];
  };
  color: string;
  icon: string;
  slaHours?: number;
  autoAssignmentRules?: {
    assignToTeam?: string;
    requiresApproval?: boolean;
  };
}

export interface PriorityOptionFields extends OptionFields {
  metadata: PriorityOptionMetadata;
}

export class PriorityOptionSet extends OptionSet {
  constructor(data?: Partial<OptionSetFields>) {
    super({
      ...data,
      set_type: 'priority_system',
      category: 'urgency'
    });
  }

  /**
   * Create standard priority options
   */
  static createStandardPriorityOptions(): PriorityOptionFields[] {
    return [
      {
        key: 'low',
        display_name: 'Low Priority',
        description: 'Low priority item with flexible timeline',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['low'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 10,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          urgencyLevel: 1,
          color: '#22c55e',
          icon: 'arrow-down',
          slaHours: 168 // 1 week
        }
      } as PriorityOptionFields,
      {
        key: 'medium',
        display_name: 'Medium Priority', 
        description: 'Standard priority with normal timeline',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['medium'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 20,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          urgencyLevel: 2,
          color: '#f59e0b',
          icon: 'minus',
          slaHours: 72 // 3 days
        }
      } as PriorityOptionFields,
      {
        key: 'high',
        display_name: 'High Priority',
        description: 'High priority requiring expedited attention',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['high'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 30,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          urgencyLevel: 3,
          escalationRules: {
            escalateAfterDays: 2,
            escalateTo: 'urgent',
            notificationRules: ['notify_manager', 'daily_email']
          },
          color: '#ef4444',
          icon: 'arrow-up',
          slaHours: 24 // 1 day
        }
      } as PriorityOptionFields,
      {
        key: 'urgent',
        display_name: 'Urgent',
        description: 'Urgent priority requiring immediate attention',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['urgent'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 40,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          urgencyLevel: 4,
          escalationRules: {
            escalateAfterDays: 1,
            escalateTo: 'critical',
            notificationRules: ['notify_manager', 'hourly_email', 'slack_alert']
          },
          color: '#dc2626',
          icon: 'exclamation',
          slaHours: 8,
          autoAssignmentRules: {
            assignToTeam: 'escalation_team',
            requiresApproval: true
          }
        }
      } as PriorityOptionFields,
      {
        key: 'critical',
        display_name: 'Critical',
        description: 'Critical priority - drop everything and address',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['critical'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 50,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          urgencyLevel: 5,
          color: '#7c2d12',
          icon: 'exclamation-triangle',
          slaHours: 2,
          autoAssignmentRules: {
            assignToTeam: 'emergency_response',
            requiresApproval: true
          }
        }
      } as PriorityOptionFields
    ];
  }

  /**
   * Calculate urgency score
   */
  static calculateUrgencyScore(priority: PriorityOptionFields, daysOld: number): number {
    const baseScore = priority.metadata.urgencyLevel * 20;
    const ageMultiplier = Math.min(daysOld * 2, 50); // Cap age impact
    return baseScore + ageMultiplier;
  }

  /**
   * Check if escalation is needed
   */
  static needsEscalation(priority: PriorityOptionFields, daysOld: number): boolean {
    const rules = priority.metadata.escalationRules;
    return rules ? daysOld >= rules.escalateAfterDays : false;
  }

  /**
   * Get SLA hours remaining
   */
  static getSLAHoursRemaining(priority: PriorityOptionFields, createdAt: Date): number {
    if (!priority.metadata.slaHours) return Infinity;
    
    const elapsed = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return Math.max(0, priority.metadata.slaHours - elapsed);
  }
}

// =============================================================================
// CATEGORY OPTION SET - Classification and Behavior Rules
// =============================================================================

export interface CategoryOptionMetadata {
  defaultPriority?: string;
  requiredFields?: string[];
  autoAssignRules?: {
    assignTo?: string;
    assignToTeam?: string;
    assignBasedOn?: string;
  };
  validationRules?: {
    requiresApproval?: boolean;
    minimumBudget?: number;
    restrictedToRoles?: string[];
  };
  color: string;
  icon?: string;
  workflowTemplate?: string;
}

export interface CategoryOptionFields extends OptionFields {
  metadata: CategoryOptionMetadata;
}

export class CategoryOptionSet extends OptionSet {
  constructor(data?: Partial<OptionSetFields>) {
    super({
      ...data,
      set_type: 'category_system',
      category: 'classification'
    });
  }

  /**
   * Create task category options
   */
  static createTaskCategoryOptions(): CategoryOptionFields[] {
    return [
      {
        key: 'feature',
        display_name: 'Feature Development',
        description: 'New feature or enhancement',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['feature'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 10,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          defaultPriority: 'medium',
          requiredFields: ['acceptance_criteria', 'estimated_hours'],
          autoAssignRules: {
            assignToTeam: 'development_team'
          },
          color: '#3b82f6',
          icon: 'plus-circle',
          workflowTemplate: 'feature_development'
        }
      } as CategoryOptionFields,
      {
        key: 'bug',
        display_name: 'Bug Fix',
        description: 'Bug report requiring investigation and fix',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['bug'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 20,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          defaultPriority: 'high',
          requiredFields: ['reproduction_steps', 'affected_version'],
          autoAssignRules: {
            assignToTeam: 'engineering_team'
          },
          color: '#dc2626',
          icon: 'bug',
          workflowTemplate: 'bug_resolution'
        }
      } as CategoryOptionFields,
      {
        key: 'maintenance',
        display_name: 'Maintenance',
        description: 'System maintenance and technical debt',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['maintenance'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 30,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          defaultPriority: 'low',
          requiredFields: ['maintenance_type'],
          autoAssignRules: {
            assignToTeam: 'platform_team'
          },
          color: '#6b7280',
          icon: 'wrench',
          workflowTemplate: 'maintenance_task'
        }
      } as CategoryOptionFields,
      {
        key: 'research',
        display_name: 'Research',
        description: 'Investigation and research task',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['research'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 40,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          defaultPriority: 'medium',
          requiredFields: ['research_scope', 'deliverables'],
          validationRules: {
            requiresApproval: true
          },
          color: '#7c3aed',
          icon: 'academic-cap',
          workflowTemplate: 'research_project'
        }
      } as CategoryOptionFields
    ];
  }

  /**
   * Get auto-assignment recommendations
   */
  static getAutoAssignmentRecommendations(category: CategoryOptionFields): {
    assignTo?: string;
    assignToTeam?: string;
    priority?: string;
    requiredFields: string[];
  } {
    return {
      assignTo: category.metadata.autoAssignRules?.assignTo,
      assignToTeam: category.metadata.autoAssignRules?.assignToTeam,
      priority: category.metadata.defaultPriority,
      requiredFields: category.metadata.requiredFields || []
    };
  }

  /**
   * Validate category requirements
   */
  static validateCategoryRequirements(category: CategoryOptionFields, entityData: any): {
    isValid: boolean;
    missingFields: string[];
    validationErrors: string[];
  } {
    const missingFields: string[] = [];
    const validationErrors: string[] = [];

    // Check required fields
    if (category.metadata.requiredFields) {
      for (const field of category.metadata.requiredFields) {
        if (!entityData[field]) {
          missingFields.push(field);
        }
      }
    }

    // Check validation rules
    const rules = category.metadata.validationRules;
    if (rules) {
      if (rules.minimumBudget && entityData.budget < rules.minimumBudget) {
        validationErrors.push(`Budget must be at least ${rules.minimumBudget}`);
      }

      if (rules.restrictedToRoles && !rules.restrictedToRoles.includes(entityData.userRole)) {
        validationErrors.push(`Category restricted to roles: ${rules.restrictedToRoles.join(', ')}`);
      }
    }

    return {
      isValid: missingFields.length === 0 && validationErrors.length === 0,
      missingFields,
      validationErrors
    };
  }
}

// =============================================================================
// DISCUSSION TYPE OPTION SET - Threading and Resolution Capabilities
// =============================================================================

export interface DiscussionTypeOptionMetadata {
  isThreadable: boolean;
  isResolvable: boolean;
  allowsRichContent: boolean;
  requiresParentEntity: boolean;
  notificationRules?: {
    notifyMentioned?: boolean;
    notifyParticipants?: boolean;
    notifyOwner?: boolean;
  };
  displaySettings?: {
    showAuthor?: boolean;
    showTimestamp?: boolean;
    allowReactions?: boolean;
  };
  color: string;
  icon: string;
}

export interface DiscussionTypeOptionFields extends OptionFields {
  metadata: DiscussionTypeOptionMetadata;
}

export class DiscussionTypeOptionSet extends OptionSet {
  constructor(data?: Partial<OptionSetFields>) {
    super({
      ...data,
      set_type: 'discussion_type_system',
      category: 'communication'
    });
  }

  /**
   * Create standard discussion type options
   */
  static createStandardDiscussionTypes(): DiscussionTypeOptionFields[] {
    return [
      {
        key: 'comment',
        display_name: 'Comment',
        description: 'General comment or discussion',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['comment'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 10,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isThreadable: true,
          isResolvable: true,
          allowsRichContent: true,
          requiresParentEntity: true,
          notificationRules: {
            notifyMentioned: true,
            notifyParticipants: true,
            notifyOwner: true
          },
          displaySettings: {
            showAuthor: true,
            showTimestamp: true,
            allowReactions: true
          },
          color: '#3b82f6',
          icon: 'message-circle'
        }
      } as DiscussionTypeOptionFields,
      {
        key: 'question',
        display_name: 'Question',
        description: 'Question requiring an answer',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['question'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 20,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isThreadable: true,
          isResolvable: true,
          allowsRichContent: true,
          requiresParentEntity: true,
          notificationRules: {
            notifyMentioned: true,
            notifyParticipants: true,
            notifyOwner: true
          },
          color: '#7c3aed',
          icon: 'question-mark-circle'
        }
      } as DiscussionTypeOptionFields,
      {
        key: 'feedback',
        display_name: 'Feedback',
        description: 'Feedback or review comment',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['feedback'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 30,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isThreadable: true,
          isResolvable: true,
          allowsRichContent: true,
          requiresParentEntity: true,
          color: '#f59e0b',
          icon: 'chat-bubble-left-ellipsis'
        }
      } as DiscussionTypeOptionFields,
      {
        key: 'note',
        display_name: 'Note',
        description: 'Private note or memo',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['note'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 40,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isThreadable: false,
          isResolvable: false,
          allowsRichContent: true,
          requiresParentEntity: true,
          notificationRules: {
            notifyMentioned: false,
            notifyParticipants: false,
            notifyOwner: false
          },
          color: '#6b7280',
          icon: 'document-text'
        }
      } as DiscussionTypeOptionFields,
      {
        key: 'approval',
        display_name: 'Approval Request',
        description: 'Request for approval or sign-off',
        value_type: 'enum',
        default_value: null,
        allowed_values: ['approval'],
        validation_rules: [],
        conditional_logic: [],
        sort_order: 50,
        is_required: false,
        is_readonly: false,
        is_visible: true,
        is_system_option: true,
        metadata: {
          isThreadable: true,
          isResolvable: true,
          allowsRichContent: false,
          requiresParentEntity: true,
          notificationRules: {
            notifyMentioned: true,
            notifyParticipants: false,
            notifyOwner: true
          },
          color: '#059669',
          icon: 'check-badge'
        }
      } as DiscussionTypeOptionFields
    ];
  }

  /**
   * Check if discussion type supports threading
   */
  static supportsThreading(discussionType: DiscussionTypeOptionFields): boolean {
    return discussionType.metadata.isThreadable;
  }

  /**
   * Check if discussion type can be resolved
   */
  static canBeResolved(discussionType: DiscussionTypeOptionFields): boolean {
    return discussionType.metadata.isResolvable;
  }

  /**
   * Get notification recipients for discussion
   */
  static getNotificationRecipients(
    discussionType: DiscussionTypeOptionFields,
    context: {
      mentioned: string[];
      participants: string[];
      owner?: string;
    }
  ): string[] {
    const recipients = new Set<string>();
    const rules = discussionType.metadata.notificationRules;

    if (rules?.notifyMentioned) {
      context.mentioned.forEach(id => recipients.add(id));
    }

    if (rules?.notifyParticipants) {
      context.participants.forEach(id => recipients.add(id));
    }

    if (rules?.notifyOwner && context.owner) {
      recipients.add(context.owner);
    }

    return Array.from(recipients);
  }
}

// =============================================================================
// SYSTEM OPTION SET FACTORY AND UTILITIES
// =============================================================================

export class SystemOptionSetFactory {
  /**
   * Create all system option sets for an organization
   */
  static createAllSystemOptionSets(organizationId: string): OptionSet[] {
    return [
      // Status option sets
      new StatusOptionSet({
        name: 'project_status',
        display_name: 'Project Status',
        description: 'Standard project status workflow',
        container_type: 'organization',
        container_id: organizationId,
        is_system_set: true
      }),
      new StatusOptionSet({
        name: 'task_status',
        display_name: 'Task Status',
        description: 'Standard task status workflow',
        container_type: 'organization',
        container_id: organizationId,
        is_system_set: true
      }),

      // Priority option set
      new PriorityOptionSet({
        name: 'priority_levels',
        display_name: 'Priority Levels',
        description: 'Standard priority levels with escalation',
        container_type: 'organization',
        container_id: organizationId,
        is_system_set: true
      }),

      // Category option sets
      new CategoryOptionSet({
        name: 'task_categories',
        display_name: 'Task Categories',
        description: 'Task classification with auto-assignment',
        container_type: 'organization',
        container_id: organizationId,
        is_system_set: true
      }),

      // Discussion type option set
      new DiscussionTypeOptionSet({
        name: 'discussion_types',
        display_name: 'Discussion Types',
        description: 'Communication thread types',
        container_type: 'organization',
        container_id: organizationId,
        is_system_set: true
      })
    ];
  }

  /**
   * Get default options for system option set
   */
  static getDefaultOptions(optionSetType: string): OptionFields[] {
    switch (optionSetType) {
      case 'status_system':
        return [...StatusOptionSet.createProjectStatusOptions(), ...StatusOptionSet.createTaskStatusOptions()];
      case 'priority_system':
        return PriorityOptionSet.createStandardPriorityOptions();
      case 'category_system':
        return CategoryOptionSet.createTaskCategoryOptions();
      case 'discussion_type_system':
        return DiscussionTypeOptionSet.createStandardDiscussionTypes();
      default:
        return [];
    }
  }

  /**
   * Validate system option metadata
   */
  static validateSystemOptionMetadata(optionSetType: string, metadata: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (optionSetType) {
      case 'status_system':
        if (!metadata.color) errors.push('Status options must have a color');
        if (!metadata.icon) errors.push('Status options must have an icon');
        if (typeof metadata.isCompletionState !== 'boolean') {
          errors.push('Status options must specify isCompletionState');
        }
        break;
      case 'priority_system':
        if (typeof metadata.urgencyLevel !== 'number' || metadata.urgencyLevel < 1 || metadata.urgencyLevel > 5) {
          errors.push('Priority options must have urgencyLevel between 1-5');
        }
        break;
      case 'category_system':
        if (!metadata.color) errors.push('Category options must have a color');
        break;
      case 'discussion_type_system':
        if (typeof metadata.isThreadable !== 'boolean') {
          errors.push('Discussion type options must specify isThreadable');
        }
        if (typeof metadata.isResolvable !== 'boolean') {
          errors.push('Discussion type options must specify isResolvable');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default {
  StatusOptionSet,
  PriorityOptionSet,
  CategoryOptionSet,
  DiscussionTypeOptionSet,
  SystemOptionSetFactory
};