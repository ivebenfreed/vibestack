import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Tag } from './Tag.js';
import { Project } from './Project.js';
/**
 * TagSet entity
 * Represents a collection of tags that can be applied to entities
 * Supports categorization and sharing tag collections across projects
 */
export declare class TagSet extends BaseDomainEntity {
    name: string;
    description?: string;
    category?: string;
    isSystem: boolean;
    isActive: boolean;
    defaultColor: string;
    displayOrder: number;
    isExclusive: boolean;
    maxTags?: number;
    metadata: Record<string, any>;
    tags: Promise<Tag[]>;
    projects: Promise<Project[]>;
}
//# sourceMappingURL=TagSet.d.ts.map