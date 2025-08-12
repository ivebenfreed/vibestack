import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class StatusOptionMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'boolean', default: false, fieldName: 'is_completion_state' })
  isCompletionState!: boolean; // Marks if this status indicates completion

  @Property({ type: 'array', nullable: true, fieldName: 'allowed_transitions' })
  allowedTransitions?: string[]; // Array of status values this can transition to

  @Property({ type: 'json', nullable: true, fieldName: 'completion_criteria' })
  completionCriteria?: any; // Criteria that must be met for this status

  @Property({ type: 'json', nullable: true, fieldName: 'trigger_actions' })
  triggerActions?: any; // Actions to trigger when transitioning to this status

  @Property({ type: 'boolean', default: false, fieldName: 'is_terminal_state' })
  isTerminalState!: boolean; // Status from which no further transitions are allowed

  @Property({ type: 'boolean', default: false, fieldName: 'requires_approval' })
  requiresApproval!: boolean; // Whether transitioning to this status requires approval

  @Property({ type: 'int', nullable: true, fieldName: 'auto_transition_days' })
  autoTransitionDays?: number; // Days after which to auto-transition

  @Property({ type: 'string', nullable: true, fieldName: 'auto_transition_target' })
  autoTransitionTarget?: string; // Target status for auto-transition
}