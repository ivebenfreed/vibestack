import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class LookupFieldMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'string', fieldName: 'target_archetype' })
  targetArchetype!: string; // The archetype to lookup (project, task, record, etc.)

  @Property({ type: 'string', fieldName: 'display_field' })
  displayField!: string; // Field from target to display (name, title, etc.)

  @Property({ type: 'json', nullable: true, fieldName: 'filter_criteria' })
  filterCriteria?: any; // Criteria to filter available options

  @Property({ type: 'boolean', default: false, fieldName: 'allow_multiple' })
  allowMultiple!: boolean; // Whether multiple selections are allowed

  @Property({ type: 'boolean', default: false, fieldName: 'allow_create_new' })
  allowCreateNew!: boolean; // Whether users can create new target records

  @Property({ type: 'string', nullable: true, fieldName: 'relationship_type' })
  relationshipType?: string; // one-to-one, one-to-many, many-to-many

  @Property({ type: 'array', nullable: true, fieldName: 'additional_display_fields' })
  additionalDisplayFields?: string[]; // Extra fields to show in picker

  @Property({ type: 'string', nullable: true, fieldName: 'sort_field' })
  sortField?: string; // Field to sort lookup options by

  @Property({ type: 'string', default: 'asc', fieldName: 'sort_direction' })
  sortDirection!: string; // asc or desc

  @Property({ type: 'json', nullable: true, fieldName: 'cascade_rules' })
  cascadeRules?: any; // What happens when target record is deleted/updated
}