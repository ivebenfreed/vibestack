import { Entity, Property, OneToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class CalculatedFieldMetadata extends BaseDomainEntity {
  @OneToOne(() => Option, { fieldName: 'option_id', owner: true })
  option!: Option;

  @Property({ type: 'text', fieldName: 'formula' })
  formula!: string; // Formula for calculating the value

  @Property({ type: 'array', fieldName: 'dependencies' })
  dependencies!: string[]; // Field names this calculation depends on

  @Property({ type: 'array', nullable: true, fieldName: 'update_triggers' })
  updateTriggers?: string[]; // When to recalculate (on save, on change, etc.)

  @Property({ type: 'string', default: 'number', fieldName: 'result_type' })
  resultType!: string; // number, text, date, boolean

  @Property({ type: 'boolean', default: true, fieldName: 'auto_recalculate' })
  autoRecalculate!: boolean; // Whether to auto-update when dependencies change

  @Property({ type: 'string', nullable: true, fieldName: 'format_pattern' })
  formatPattern?: string; // How to format the result for display

  @Property({ type: 'boolean', default: false, fieldName: 'is_aggregation' })
  isAggregation!: boolean; // Whether this aggregates data from related records

  @Property({ type: 'string', nullable: true, fieldName: 'aggregation_source' })
  aggregationSource?: string; // Source table/field for aggregations

  @Property({ type: 'json', nullable: true, fieldName: 'calculation_metadata' })
  calculationMetadata?: any; // Additional calculation configuration
}