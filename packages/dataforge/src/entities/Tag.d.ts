import { BaseDomainEntity } from './BaseDomainEntity.js';
import { TagSet } from './TagSet.js';
import { Task } from './Task.js';
/**
 * Tag entity
 * Represents an individual tag within a tag set
 * Supports hierarchical organization and usage tracking
 */
export declare class Tag extends BaseDomainEntity {
    tagSetId: string;
    name: string;
    slug: string;
    color: string;
    icon?: string;
    variant: string;
    sortOrder: number;
    parentId?: string;
    isActive: boolean;
    usageCount: number;
    lastUsedAt?: Date;
    metadata: Record<string, any>;
    tagSet: Promise<TagSet>;
    parent?: Promise<Tag>;
    children: Promise<Tag[]>;
    tasks: Promise<Task[]>;
}
//# sourceMappingURL=Tag.d.ts.map