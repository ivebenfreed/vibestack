import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Project } from './Project.js';
/**
 * StatusSet entity
 * Represents a collection of status definitions that can be applied to entities
 * Supports sharing status workflows across multiple projects
 */
export declare class StatusSet extends BaseDomainEntity {
    name: string;
    entityType: string;
    description?: string;
    isSystem: boolean;
    isActive: boolean;
    defaultColor?: string;
    displayOrder: number;
    metadata: Record<string, any>;
    statuses: Promise<StatusDefinition[]>;
    projects: Promise<Project[]>;
}
//# sourceMappingURL=StatusSet.d.ts.map