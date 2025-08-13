import { Label, EntityLabel } from '../entities/index.js';

export interface LabelData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  category?: string;
  isSystem?: boolean;
  parentId?: string;
}

export interface EntityLabelData {
  entityArchetype: string;
  entityId: string;
  labelId: string;
  sortOrder?: number;
  metadata?: any;
}

export interface LabelQuery {
  category?: string;
  isActive?: boolean;
  isSystem?: boolean;
  parentId?: string;
  searchTerm?: string;
}

/**
 * Service for managing universal labeling system
 */
export class LabelService {

  /**
   * Validate label data before creation
   */
  validateLabelData(data: LabelData): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      errors.push('Label name is required');
    }

    // Validate name length and format
    if (data.name && data.name.length > 100) {
      errors.push('Label name cannot exceed 100 characters');
    }

    if (data.name && !/^[a-zA-Z0-9\s\-_()]+$/.test(data.name)) {
      errors.push('Label name contains invalid characters');
    }

    // Validate color format
    if (data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
      errors.push('Color must be a valid hex code (e.g., #ff0000)');
    }

    // Validate category
    if (data.category && data.category.length > 50) {
      errors.push('Category cannot exceed 50 characters');
    }

    return errors;
  }

  /**
   * Validate entity label data before creation
   */
  validateEntityLabelData(data: EntityLabelData): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!data.entityArchetype || data.entityArchetype.trim() === '') {
      errors.push('Entity archetype is required');
    }

    if (!data.entityId || data.entityId.trim() === '') {
      errors.push('Entity ID is required');
    }

    if (!data.labelId || data.labelId.trim() === '') {
      errors.push('Label ID is required');
    }

    // Validate archetype
    const validArchetypes = [
      'project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'
    ];

    if (data.entityArchetype && !validArchetypes.includes(data.entityArchetype)) {
      errors.push(`Invalid entity archetype: ${data.entityArchetype}`);
    }

    return errors;
  }

  /**
   * Get default system labels for different categories
   */
  getDefaultSystemLabels(): LabelData[] {
    return [
      // Status-related labels
      {
        name: 'High Priority',
        color: '#ef4444',
        icon: 'exclamation-triangle',
        category: 'priority',
        isSystem: true
      },
      {
        name: 'Low Priority',
        color: '#6b7280',
        icon: 'minus',
        category: 'priority',
        isSystem: true
      },
      {
        name: 'Urgent',
        color: '#dc2626',
        icon: 'lightning-bolt',
        category: 'priority',
        isSystem: true
      },

      // Type-related labels
      {
        name: 'Bug',
        color: '#ef4444',
        icon: 'bug',
        category: 'type',
        isSystem: true
      },
      {
        name: 'Feature',
        color: '#3b82f6',
        icon: 'plus',
        category: 'type',
        isSystem: true
      },
      {
        name: 'Enhancement',
        color: '#10b981',
        icon: 'trending-up',
        category: 'type',
        isSystem: true
      },
      {
        name: 'Documentation',
        color: '#8b5cf6',
        icon: 'document-text',
        category: 'type',
        isSystem: true
      },

      // Stage-related labels
      {
        name: 'Draft',
        color: '#f59e0b',
        icon: 'pencil',
        category: 'stage',
        isSystem: true
      },
      {
        name: 'In Review',
        color: '#3b82f6',
        icon: 'eye',
        category: 'stage',
        isSystem: true
      },
      {
        name: 'Approved',
        color: '#10b981',
        icon: 'check',
        category: 'stage',
        isSystem: true
      },

      // Team-related labels
      {
        name: 'Frontend',
        color: '#ec4899',
        icon: 'code',
        category: 'team',
        isSystem: true
      },
      {
        name: 'Backend',
        color: '#6366f1',
        icon: 'server',
        category: 'team',
        isSystem: true
      },
      {
        name: 'Design',
        color: '#f59e0b',
        icon: 'color-swatch',
        category: 'team',
        isSystem: true
      }
    ];
  }

  /**
   * Generate label suggestions based on entity data
   */
  generateLabelSuggestions(entityArchetype: string, entityData: any): string[] {
    const suggestions: string[] = [];

    // Archetype-specific suggestions
    switch (entityArchetype) {
      case 'task':
        if (entityData.priority === 'high') suggestions.push('High Priority');
        if (entityData.dueDate && new Date(entityData.dueDate) < new Date()) suggestions.push('Overdue');
        if (entityData.estimatedDuration && parseInt(entityData.estimatedDuration) > 480) suggestions.push('Large Task');
        break;

      case 'project':
        if (entityData.status === 'planning') suggestions.push('Draft');
        if (entityData.dueDate) suggestions.push('Has Deadline');
        break;

      case 'document':
        if (entityData.format === 'markdown') suggestions.push('Documentation');
        if (entityData.title?.toLowerCase().includes('spec')) suggestions.push('Specification');
        break;

      case 'record':
        if (entityData.recordType === 'contact') suggestions.push('Contact');
        if (entityData.recordType === 'company') suggestions.push('Company');
        break;
    }

    // Content-based suggestions
    if (entityData.title || entityData.name) {
      const text = (entityData.title || entityData.name).toLowerCase();
      
      if (text.includes('bug') || text.includes('error') || text.includes('issue')) {
        suggestions.push('Bug');
      }
      if (text.includes('feature') || text.includes('add') || text.includes('new')) {
        suggestions.push('Feature');
      }
      if (text.includes('improve') || text.includes('enhance') || text.includes('better')) {
        suggestions.push('Enhancement');
      }
      if (text.includes('urgent') || text.includes('asap') || text.includes('critical')) {
        suggestions.push('Urgent');
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Validate label hierarchy (prevent circular references)
   */
  validateLabelHierarchy(labels: Label[], parentId: string, childId: string): boolean {
    if (parentId === childId) {
      return false; // Cannot be parent of itself
    }

    // Build hierarchy map
    const childrenMap = new Map<string, string[]>();
    for (const label of labels) {
      if (label.parent?.id) {
        if (!childrenMap.has(label.parent.id)) {
          childrenMap.set(label.parent.id, []);
        }
        childrenMap.get(label.parent.id)!.push(label.id);
      }
    }

    // Check if making parentId a child of childId would create a cycle
    function wouldCreateCycle(currentParent: string, targetChild: string): boolean {
      if (currentParent === targetChild) {
        return true;
      }

      const children = childrenMap.get(currentParent) || [];
      for (const child of children) {
        if (wouldCreateCycle(child, targetChild)) {
          return true;
        }
      }

      return false;
    }

    return !wouldCreateCycle(childId, parentId);
  }

  /**
   * Get label usage analytics
   */
  getLabelUsageAnalytics(labels: Label[]): any {
    const totalLabels = labels.length;
    const activeLabels = labels.filter(l => l.isActive).length;
    const systemLabels = labels.filter(l => l.isSystem).length;
    const userLabels = labels.filter(l => !l.isSystem).length;

    const categoryStats = labels.reduce((acc, label) => {
      const category = label.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const usageStats = {
      totalUsage: labels.reduce((sum, label) => sum + label.usageCount, 0),
      averageUsage: labels.length > 0 ? labels.reduce((sum, label) => sum + label.usageCount, 0) / labels.length : 0,
      mostUsed: labels.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
      leastUsed: labels.filter(l => l.usageCount === 0).length
    };

    return {
      totalLabels,
      activeLabels,
      systemLabels,
      userLabels,
      categoryStats,
      usageStats
    };
  }
}