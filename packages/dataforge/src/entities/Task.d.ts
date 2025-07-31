import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Tag } from './Tag.js';
export declare enum TaskStatus {
    OPEN = "open",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed"
}
export declare enum TaskPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
/**
 * Task entity
 * Contains task information and relationships to users and projects
 * Extends BaseDomainEntity for common fields and behavior
 */
export declare class Task extends BaseDomainEntity {
    title: string;
    description?: string;
    legacyStatus?: TaskStatus;
    statusId?: string;
    status?: StatusDefinition;
    priority: TaskPriority;
    dueDate?: Date;
    startDate?: Date | undefined;
    completedAt?: Date;
    timeRange?: string;
    estimatedDuration?: string;
    legacyTags?: string[];
    tags: Tag[];
    projectId?: string;
    assigneeId?: string;
    project?: Promise<import('./Project.js').Project>;
    assignee?: Promise<import('./User.js').User>;
    dependencies: Promise<import('./Task.js').Task[]>;
    tasksDependentOnThis: Promise<Task[]>;
}
//# sourceMappingURL=Task.d.ts.map