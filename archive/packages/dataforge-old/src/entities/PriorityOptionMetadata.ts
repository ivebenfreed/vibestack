import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class PriorityOptionMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'int', default: 1, fieldName: 'urgency_level' })
  urgencyLevel!: number; // 1 (low) to 5 (critical)

  @Property({ type: 'int', nullable: true, fieldName: 'escalation_days' })
  escalationDays?: number; // Days after which to escalate

  @Property({ type: 'string', nullable: true, fieldName: 'escalation_target' })
  escalationTarget?: string; // Target priority for escalation

  @Property({ type: 'int', nullable: true, fieldName: 'sla_hours' })
  slaHours?: number; // SLA response time in hours

  @Property({ type: 'boolean', default: false, fieldName: 'requires_immediate_attention' })
  requiresImmediateAttention!: boolean; // Flags for urgent handling

  @Property({ type: 'array', nullable: true, fieldName: 'notification_rules' })
  notificationRules?: string[]; // Who to notify when this priority is assigned

  @Property({ type: 'json', nullable: true, fieldName: 'escalation_rules' })
  escalationRules?: any; // Complex escalation logic

  @Property({ type: 'int', nullable: true, fieldName: 'weight_multiplier' })
  weightMultiplier?: number; // For priority-based sorting/scoring
}