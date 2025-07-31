import { BaseDomainEntity } from './BaseDomainEntity.js';
export declare enum ProjectStatus {
    ACTIVE = "active",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    ON_HOLD = "on_hold"
}
/**
 * Project entity
 * Contains project information and relationships to users and tasks
 * Extends BaseDomainEntity for common fields and behavior
 */
export declare class Project extends BaseDomainEntity {
    name: string;
    description?: string;
    status: ProjectStatus;
    ownerId?: string;
    owner?: Promise<import('./User.js').User>;
    members: Promise<import('./User.js').User[]>;
    tasks: Promise<import('./Task.js').Task[]>;
    statusSets: Promise<import('./StatusSet.js').StatusSet[]>;
    tagSets: Promise<import('./TagSet.js').TagSet[]>;
}
//# sourceMappingURL=Project.d.ts.map