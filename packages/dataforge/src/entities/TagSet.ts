import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { 
  IsString, 
  IsOptional,
  IsIn,
  IsHexColor,
  IsInt,
  Min,
  MaxLength
} from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Tag } from './Tag.js';
import { Project } from './Project.js';
import { EnumTypeName } from '../utils/decorators.js';

/**
 * TagSet entity
 * Represents a collection of tags that can be applied to entities
 * Supports categorization and sharing tag collections across projects
 */
@Entity('tag_sets')
export class TagSet extends BaseDomainEntity {
  @Column({ type: 'varchar', length: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(['priority', 'type', 'component', 'general'])
  @EnumTypeName({ name: 'TagCategory', sourcePath: './TagSet' })
  category?: string;

  @Column({ type: 'boolean', default: false, name: 'is_system' })
  isSystem!: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  // Visual defaults
  @Column({ type: 'varchar', length: 7, default: '#94a3b8', name: 'default_color' })
  @IsHexColor()
  defaultColor!: string;

  @Column({ type: 'int', default: 0, name: 'display_order' })
  @IsInt()
  @Min(0)
  displayOrder!: number;

  // Tag behavior
  @Column({ type: 'boolean', default: false, name: 'is_exclusive' })
  isExclusive!: boolean;

  @Column({ type: 'int', nullable: true, name: 'max_tags' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTags?: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  // Relationships
  @OneToMany(() => Tag, tag => tag.tagSet)
  tags!: Promise<Tag[]>;

  @ManyToMany(() => Project, project => project.tagSets)
  projects!: Promise<Project[]>;
}