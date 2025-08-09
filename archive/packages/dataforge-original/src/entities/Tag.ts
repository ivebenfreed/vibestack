import { Entity, Column, ManyToOne, OneToMany, ManyToMany, JoinColumn } from 'typeorm';
import { 
  IsString, 
  IsUUID,
  IsHexColor,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  IsDate,
  Matches,
  MaxLength
} from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { TagSet } from './TagSet.js';
import { Task } from './Task.js';
import { EnumTypeName } from '../utils/decorators.js';

/**
 * Tag entity
 * Represents an individual tag within a tag set
 * Supports hierarchical organization and usage tracking
 */
@Entity('tags')
export class Tag extends BaseDomainEntity {
  @Column({ type: 'uuid', name: 'tag_set_id' })
  @IsUUID()
  tagSetId!: string;

  @Column({ type: 'varchar', length: 50 })
  @IsString()
  @MaxLength(50)
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'Slug must be kebab-case' })
  slug!: string;

  // Visual properties as columns
  @Column({ type: 'varchar', length: 7 })
  @IsHexColor()
  color!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Column({ type: 'varchar', length: 20, default: 'solid' })
  @IsString()
  @IsIn(['solid', 'outline', 'ghost'])
  @EnumTypeName({ name: 'TagVariant', sourcePath: './Tag' })
  variant!: string;

  // Organization
  @Column({ type: 'int', default: 0, name: 'sort_order' })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  // Usage tracking
  @Column({ type: 'int', default: 0, name: 'usage_count' })
  @IsInt()
  @Min(0)
  usageCount!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  @IsOptional()
  @IsDate()
  lastUsedAt?: Date;

  // Extended metadata
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  // Relationships
  @ManyToOne(() => TagSet, set => set.tags)
  @JoinColumn({ name: 'tag_set_id' })
  tagSet!: Promise<TagSet>;

  @ManyToOne(() => Tag, tag => tag.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Promise<Tag>;

  @OneToMany(() => Tag, tag => tag.parent)
  children!: Promise<Tag[]>;

  @ManyToMany(() => Task, task => task.tags)
  tasks!: Promise<Task[]>;
}