import { Entity, Column, ManyToOne, ManyToMany, JoinTable, JoinColumn, Check } from 'typeorm';
import { 
  IsString, 
  MinLength, 
  IsOptional, 
  IsEnum, 
  IsDate, 
  IsInt, 
  Min, 
  IsArray, 
  IsUUID,
  MaxLength
} from 'class-validator';
// Import User and Project for use in decorators
// The Relation wrapper will handle circular dependencies
import { User } from './User.js';
import { Project } from './Project.js';
import { BaseDomainEntity } from './BaseDomainEntity.js';
// No need for ServerOnly/ClientOnly decorators as this is a shared entity
import { EnumTypeName } from '../utils/decorators.js'; // Import the new decorator

// These enum values must match the database exactly
export enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Task entity
 * Contains task information and relationships to users and projects
 * Extends BaseDomainEntity for common fields and behavior
 */
@Entity('tasks')
@Check('chk_task_start_date_before_due_date', '("start_date" IS NULL OR "due_date" IS NULL) OR ("start_date" < "due_date")')
export class Task extends BaseDomainEntity {
  // No need for id, created_at, updated_at, client_id as they're in BaseDomainEntity
  
  @Column({ type: "varchar", length: 100 })
  @IsString()
  @MinLength(1, { message: "Title cannot be empty" })
  @MaxLength(100, { message: "Title cannot exceed 100 characters" })
  title!: string;
  
  @Column({ type: "text", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: "Description cannot exceed 5000 characters" })
  description?: string;
  
  @Column({ type: "enum", enum: TaskStatus })
  @IsEnum(TaskStatus)
  @EnumTypeName({ name: 'TaskStatus', sourcePath: './Task' })
  status!: TaskStatus;
  
  @Column({ type: "enum", enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @EnumTypeName({ name: 'TaskPriority', sourcePath: './Task' })
  priority!: TaskPriority;
  
  @Column({ type: "timestamptz", nullable: true, name: "due_date" })
  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @Column({ type: "timestamptz", nullable: true, name: "start_date" })
  @IsOptional()
  @IsDate()
  startDate?: Date | undefined;
  
  @Column({ type: "timestamptz", nullable: true, name: "completed_at" })
  @IsOptional()
  @IsDate()
  completedAt?: Date;

  @Column({ type: "tsrange", nullable: true, name: "time_range" })
  @IsOptional()
  timeRange?: string;

  @Column({ type: "interval", nullable: true, name: "estimated_duration" })
  @IsOptional()
  estimatedDuration?: string;
  
  @Column("text", { array: true, default: [] })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];
  
  @Column({ type: "uuid", name: "project_id", nullable: true })
  @IsOptional()
  @IsUUID(4)
  projectId?: string;
  
  @Column({ type: "uuid", nullable: true, name: "assignee_id" })
  @IsOptional()
  @IsUUID(4)
  assigneeId?: string;
  
  // Relationship fields using Relation wrapper to avoid circular dependencies
  @ManyToOne(() => Project, (project) => project.tasks, { nullable: true })
  @JoinColumn({ name: "project_id" })
  project?: Promise<import('./Project.js').Project>;
  
  @ManyToOne(() => User, (user) => user.tasks, { nullable: true })
  @JoinColumn({ name: "assignee_id" })
  assignee?: Promise<import('./User.js').User>;
  
  @ManyToMany(() => Task, task => task.tasksDependentOnThis) // Updated to point to the new inverse property
  @JoinTable({
    name: 'task_dependencies',
    joinColumn: { name: 'dependent_task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'dependency_task_id', referencedColumnName: 'id' }
  })
  dependencies!: Promise<import('./Task.js').Task[]>;

  @ManyToMany(() => Task, task => task.dependencies)
  tasksDependentOnThis!: Promise<Task[]>;
}