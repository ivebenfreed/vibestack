import { Entity, Column, Index } from 'typeorm';
import { IsUUID, IsEnum, IsOptional, IsInt, IsString, MaxLength, IsObject } from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { EnumTypeName } from '../utils/decorators.js';

// Four standard dependency types (from project management)
export enum DependencyType {
  FINISH_TO_START = 'finish-to-start',    // FS: B starts after A finishes
  START_TO_START = 'start-to-start',      // SS: B starts when A starts
  FINISH_TO_FINISH = 'finish-to-finish',  // FF: B finishes when A finishes
  START_TO_FINISH = 'start-to-finish'     // SF: B finishes after A starts (rare)
}

/**
 * EntityDependency - Generic blocking dependency system
 * 
 * Allows any entity type to have scheduling dependencies with other entities
 * of the same type. Supports the 4 standard project management dependency types
 * with optional lag/lead time.
 * 
 * Examples:
 * - Tasks: Task B cannot start until Task A completes
 * - Projects: Project Beta depends on Project Alpha deliverables
 * - Features: Authentication must be implemented before Permissions
 * - Sprints: Sprint 2 planning starts 2 days before Sprint 1 ends
 * - Workflows: Deploy stage cannot start until Test stage completes
 */
@Entity('entity_dependencies')
@Index(['entityType', 'predecessorId'])
@Index(['entityType', 'successorId'])
@Index(['entityType', 'createdAt'])
export class EntityDependency extends BaseDomainEntity {
  /**
   * The type of entities being linked (e.g., 'tasks', 'projects', 'features')
   * This allows the same table to store dependencies for different entity types
   */
  @Column({ type: "varchar", length: 50, name: "entity_type" })
  @IsString()
  @MaxLength(50)
  entityType!: string;
  
  /**
   * The ID of the predecessor entity (must complete/start first)
   */
  @Column({ type: "uuid", name: "predecessor_id" })
  @IsUUID(4)
  predecessorId!: string;
  
  /**
   * The ID of the successor entity (depends on predecessor)
   */
  @Column({ type: "uuid", name: "successor_id" })
  @IsUUID(4)
  successorId!: string;
  
  /**
   * The type of dependency relationship
   */
  @Column({ 
    type: "enum", 
    enum: DependencyType, 
    default: DependencyType.FINISH_TO_START,
    name: "dependency_type"
  })
  @IsEnum(DependencyType)
  @EnumTypeName({ name: 'DependencyType', sourcePath: './EntityDependency' })
  type!: DependencyType;
  
  /**
   * Lag time as PostgreSQL interval (e.g., '2 days', '-1 week')
   * Positive values delay the successor, negative values allow overlap
   */
  @Column({ 
    type: "interval", 
    nullable: true, 
    name: "lag_time",
    comment: "Positive values delay successor, negative values allow overlap"
  })
  @IsOptional()
  lagTime?: string;
  
  /**
   * Lag time in days for easier calculations
   * Positive = delay (lag), negative = overlap (lead)
   */
  @Column({ 
    type: "integer", 
    nullable: true, 
    name: "lag_days",
    comment: "Lag time in days. Positive = delay, negative = lead time"
  })
  @IsOptional()
  @IsInt()
  lagDays?: number;
  
  /**
   * Optional metadata for entity-specific features
   * Can store things like:
   * - reason: Why this dependency exists
   * - strength: 'hard' | 'soft' (hard = must enforce, soft = preference)
   * - crossEntityType: For future cross-entity dependencies
   * - customProperties: Any entity-specific data
   */
  @Column({ 
    type: "jsonb", 
    nullable: true,
    name: "metadata",
    comment: "Optional entity-specific metadata"
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
  
  /**
   * Optional description of why this dependency exists
   */
  @Column({ 
    type: "text", 
    nullable: true,
    name: "description"
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  
  // Note: We don't define relationships here to keep it generic
  // Each entity type will handle loading its related entities
}