import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusSet } from './StatusSet.js';
import { Task } from './Task.js';
/**
 * StatusDefinition entity
 * Represents an individual status within a status set
 * Contains visual properties, workflow rules, and sort order
 */
export declare class StatusDefinition extends BaseDomainEntity {
    statusSetId: string;
    name: string;
    label: string;
    color: string;
    icon?: string;
    variant?: string;
    sortOrder: number;
    isDefault: boolean;
    isFinal: boolean;
    isActive: boolean;
    allowedTransitions?: string[];
    autoTransitionDays?: number;
    metadata: Record<string, any>;
    statusSet: Promise<StatusSet>;
    tasks: Promise<Task[]>;
}
//# sourceMappingURL=StatusDefinition.d.ts.map