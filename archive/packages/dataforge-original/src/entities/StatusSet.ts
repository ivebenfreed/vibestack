import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { 
  IsString, 
  MinLength, 
  MaxLength,
  IsIn,
  IsOptional,
  IsHexColor,
  IsInt,
  Min
} from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Project } from './Project.js';
import { EnumTypeName } from '../utils/decorators.js';

/**
 * StatusSet entity
 * Represents a collection of status definitions that can be applied to entities
 * Supports sharing status workflows across multiple projects
 */
@Entity('status_sets')
export class StatusSet extends BaseDomainEntity {
  @Column({ type: 'varchar', length: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  @IsString()
  @IsIn(['task', 'project'])
  @EnumTypeName({ name: 'EntityType', sourcePath: './StatusSet' })
  entityType!: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Visual metadata as columns
  @Column({ type: 'varchar', length: 7, nullable: true, name: 'default_color' })
  @IsOptional()
  @IsHexColor()
  defaultColor?: string;

  @Column({ type: 'int', default: 0, name: 'display_order' })
  @IsInt()
  @Min(0)
  displayOrder!: number;

  // Extended metadata for rare/future properties
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  // Relationships
  @OneToMany(() => StatusDefinition, def => def.statusSet)
  statuses!: Promise<StatusDefinition[]>;

  @ManyToMany(() => Project, project => project.statusSets)
  projects!: Promise<Project[]>;
}