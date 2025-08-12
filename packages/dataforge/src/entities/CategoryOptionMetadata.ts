import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class CategoryOptionMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'string', nullable: true, fieldName: 'default_priority' })
  defaultPriority?: string; // Auto-assign priority when this category is selected

  @Property({ type: 'array', nullable: true, fieldName: 'required_fields' })
  requiredFields?: string[]; // Fields that become required with this category

  @Property({ type: 'json', nullable: true, fieldName: 'auto_assign_rules' })
  autoAssignRules?: any; // Rules for auto-assigning to users/teams

  @Property({ type: 'string', nullable: true, fieldName: 'workflow_template' })
  workflowTemplate?: string; // Default workflow/process template

  @Property({ type: 'json', nullable: true, fieldName: 'field_defaults' })
  fieldDefaults?: any; // Default values for other fields

  @Property({ type: 'array', nullable: true, fieldName: 'allowed_statuses' })
  allowedStatuses?: string[]; // Restrict available statuses for this category

  @Property({ type: 'boolean', default: false, fieldName: 'requires_approval' })
  requiresApproval!: boolean; // Whether items with this category need approval

  @Property({ type: 'string', nullable: true, fieldName: 'approval_workflow' })
  approvalWorkflow?: string; // Specific approval process

  @Property({ type: 'json', nullable: true, fieldName: 'automation_triggers' })
  automationTriggers?: any; // Automated actions when this category is assigned
}