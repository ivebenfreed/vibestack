import { BaseOptionService } from './BaseOptionService.js';

export interface StatusOptionData {
  value: string;
  label: string;
  color?: string;
  icon?: string;
  description?: string;
  isCompletionState?: boolean;
  allowedTransitions?: string[];
  completionCriteria?: any;
  triggerActions?: any;
  isTerminalState?: boolean;
  requiresApproval?: boolean;
  autoTransitionDays?: number;
  autoTransitionTarget?: string;
}

export interface StatusOptionSetData {
  name: string;
  description?: string;
  archetype: string; // project, task, record, etc.
  settings?: any;
}

/**
 * Service for managing status options with workflow logic
 */
export class StatusOptionService extends BaseOptionService {
  protected optionType = 'status';
  protected isSystemType = true;

  /**
   * Validate status-specific business logic
   */
  validateStatusTransition(_fromStatus: string, toStatus: string, allowedTransitions: string[]): boolean {
    if (!allowedTransitions || allowedTransitions.length === 0) {
      return true; // No restrictions
    }
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Validate status option data
   */
  validateStatusOptionData(data: StatusOptionData): string[] {
    const baseErrors = this.validateOptionData(data);
    const statusErrors: string[] = [];

    // Validate status-specific rules
    if (data.isTerminalState && data.allowedTransitions && data.allowedTransitions.length > 0) {
      statusErrors.push('Terminal states cannot have allowed transitions');
    }

    if (data.autoTransitionDays && !data.autoTransitionTarget) {
      statusErrors.push('Auto transition target is required when auto transition days is set');
    }

    if (data.autoTransitionTarget && !data.autoTransitionDays) {
      statusErrors.push('Auto transition days is required when auto transition target is set');
    }

    return [...baseErrors, ...statusErrors];
  }

  /**
   * Get default status options for different archetypes
   */
  getDefaultStatusOptions(archetype: string): StatusOptionData[] {
    const defaults: Record<string, StatusOptionData[]> = {
      project: [
        {
          value: 'planning',
          label: 'Planning',
          color: '#94a3b8',
          icon: 'calendar',
          allowedTransitions: ['active', 'cancelled'],
          isCompletionState: false
        },
        {
          value: 'active',
          label: 'Active',
          color: '#3b82f6',
          icon: 'play',
          allowedTransitions: ['completed', 'on-hold', 'cancelled'],
          isCompletionState: false
        },
        {
          value: 'on-hold',
          label: 'On Hold',
          color: '#f59e0b',
          icon: 'pause',
          allowedTransitions: ['active', 'cancelled'],
          isCompletionState: false
        },
        {
          value: 'completed',
          label: 'Completed',
          color: '#22c55e',
          icon: 'check-circle',
          allowedTransitions: ['archived'],
          isCompletionState: true,
          isTerminalState: false
        },
        {
          value: 'cancelled',
          label: 'Cancelled',
          color: '#ef4444',
          icon: 'x-circle',
          allowedTransitions: ['archived'],
          isCompletionState: false,
          isTerminalState: false
        },
        {
          value: 'archived',
          label: 'Archived',
          color: '#6b7280',
          icon: 'archive',
          allowedTransitions: [],
          isCompletionState: true,
          isTerminalState: true
        }
      ],
      task: [
        {
          value: 'todo',
          label: 'To Do',
          color: '#94a3b8',
          icon: 'circle',
          allowedTransitions: ['doing', 'cancelled'],
          isCompletionState: false
        },
        {
          value: 'doing',
          label: 'Doing',
          color: '#3b82f6',
          icon: 'play',
          allowedTransitions: ['done', 'todo', 'blocked'],
          isCompletionState: false
        },
        {
          value: 'blocked',
          label: 'Blocked',
          color: '#f59e0b',
          icon: 'exclamation-triangle',
          allowedTransitions: ['doing', 'todo'],
          isCompletionState: false
        },
        {
          value: 'done',
          label: 'Done',
          color: '#22c55e',
          icon: 'check-circle',
          allowedTransitions: ['doing'], // Allow reopening
          isCompletionState: true,
          isTerminalState: false
        },
        {
          value: 'cancelled',
          label: 'Cancelled',
          color: '#ef4444',
          icon: 'x-circle',
          allowedTransitions: ['todo'],
          isCompletionState: false,
          isTerminalState: false
        }
      ],
      record: [
        {
          value: 'active',
          label: 'Active',
          color: '#22c55e',
          icon: 'check',
          allowedTransitions: ['inactive', 'archived'],
          isCompletionState: false
        },
        {
          value: 'inactive',
          label: 'Inactive',
          color: '#f59e0b',
          icon: 'pause',
          allowedTransitions: ['active', 'archived'],
          isCompletionState: false
        },
        {
          value: 'archived',
          label: 'Archived',
          color: '#6b7280',
          icon: 'archive',
          allowedTransitions: ['active'],
          isCompletionState: false,
          isTerminalState: false
        },
        {
          value: 'deleted',
          label: 'Deleted',
          color: '#ef4444',
          icon: 'trash',
          allowedTransitions: [],
          isCompletionState: true,
          isTerminalState: true
        }
      ]
    };

    return defaults[archetype] || defaults.task!; // Default to task workflow
  }
}