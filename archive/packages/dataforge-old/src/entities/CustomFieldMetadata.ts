import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class CustomFieldMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'string', default: 'text', fieldName: 'field_type' })
  fieldType!: string; // text, number, date, boolean, select, multiselect

  @Property({ type: 'json', nullable: true, fieldName: 'validation_rules' })
  validationRules?: any; // min/max, regex patterns, required, etc.

  @Property({ type: 'json', nullable: true, fieldName: 'display_settings' })
  displaySettings?: any; // placeholder, helpText, formatting options

  @Property({ type: 'string', nullable: true, fieldName: 'input_format' })
  inputFormat?: string; // For formatting inputs (currency, phone, etc.)

  @Property({ type: 'string', nullable: true, fieldName: 'default_value' })
  defaultValue?: string; // Default value for new records

  @Property({ type: 'boolean', default: false, fieldName: 'is_required' })
  isRequired!: boolean; // Whether this field is mandatory

  @Property({ type: 'boolean', default: true, fieldName: 'is_searchable' })
  isSearchable!: boolean; // Whether this field can be searched

  @Property({ type: 'boolean', default: true, fieldName: 'is_sortable' })
  isSortable!: boolean; // Whether this field can be used for sorting

  @Property({ type: 'array', nullable: true, fieldName: 'allowed_values' })
  allowedValues?: string[]; // For select/multiselect fields

  @Property({ type: 'string', nullable: true, fieldName: 'depends_on_field' })
  dependsOnField?: string; // Field dependency for conditional logic
}