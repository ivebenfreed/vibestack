import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { 
  IsString, 
  IsUUID,
  IsHexColor,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Matches
} from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusSet } from './StatusSet.js';
import { Task } from './Task.js';
import { EnumTypeName } from '../utils/decorators.js';

/**
 * StatusDefinition entity
 * Represents an individual status within a status set
 * Contains visual properties, workflow rules, and sort order
 */
@Entity('status_definitions')
export class StatusDefinition extends BaseDomainEntity {
  @Column({ type: 'uuid', name: 'status_set_id' })
  @IsUUID()
  statusSetId!: string;

  @Column({ type: 'varchar', length: 50 })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'Name must be snake_case' })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  @IsString()
  label!: string;

  // Core visual properties as columns
  @Column({ type: 'varchar', length: 7 })
  @IsHexColor()
  color!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['solid', 'outline', 'ghost'])
  @EnumTypeName({ name: 'StatusVariant', sourcePath: './StatusDefinition' })
  variant?: string;

  // Workflow properties as columns
  @Column({ type: 'int', name: 'sort_order' })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault!: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_final' })
  isFinal!: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  // Workflow rules
  @Column({ type: 'uuid', array: true, nullable: true, name: 'allowed_transitions' })
  @IsOptional()
  @IsUUID('4', { each: true })
  allowedTransitions?: string[];

  @Column({ type: 'int', nullable: true, name: 'auto_transition_days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  autoTransitionDays?: number;

  // Extended metadata for rare properties
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  // Relationships
  @ManyToOne(() => StatusSet, set => set.statuses)
  @JoinColumn({ name: 'status_set_id' })
  statusSet!: Promise<StatusSet>;

  @OneToMany(() => Task, task => task.status)
  tasks!: Promise<Task[]>;
}