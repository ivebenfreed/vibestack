import { TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';
import { BaseDataGenerator, type DomainEntityType, type EntitySchema } from './BaseDataGenerator';

/**
 * Data generator for Tasks entity
 */
export class TasksDataGenerator extends BaseDataGenerator {
  protected entityType: DomainEntityType = 'tasks';
  
  protected schema: EntitySchema = {
    requiredFields: {
      title: 'string',
      status: 'enum',
      priority: 'enum',
      tags: 'array'
    },
    optionalFields: {
      description: 'string',
      projectId: 'uuid',
      assigneeId: 'uuid',
      dueDate: 'date',
      startDate: 'date',
      completedAt: 'date',
      timeRange: 'tsrange',
      estimatedDuration: 'interval'
    },
    relationships: {
      belongsTo: [
        { field: 'project', entity: 'projects', required: false },
        { field: 'assignee', entity: 'users', required: false }
      ],
      hasMany: [
        { field: 'comments', entity: 'comments' }
      ],
      manyToMany: [
        { field: 'dependencies', entity: 'tasks', joinTable: 'task_dependencies' }
      ]
    },
    enums: {
      status: TaskStatus,
      priority: TaskPriority
    },
    constraints: {
      maxLength: { title: 100, description: 5000 }
    }
  };

  protected getStringTemplates(field: string): string[] {
    const templates: Record<string, string[]> = {
      title: [
        'Task {{index}}',
        'Fix Bug {{index}}',
        'Feature {{index}}',
        'Update {{index}}',
        'Implement User Authentication {{index}}',
        'Design Database Schema {{index}}',
        'Create API Endpoints {{index}}',
        'Write Unit Tests {{index}}',
        'Update Documentation {{index}}',
        'Optimize Performance {{index}}',
        'Review Code {{index}}',
        'Deploy to Production {{index}}',
        'Setup CI/CD Pipeline {{index}}',
        'Configure Monitoring {{index}}',
        'Refactor Legacy Code {{index}}'
      ],
      description: [
        'Detailed description for task {{index}} including requirements and acceptance criteria',
        'This task involves implementing {{index}} functionality with proper error handling',
        'Task {{index}} requires careful planning and coordination with the team',
        'Implementation of {{index}} feature following best practices and coding standards',
        'Bug fix for issue {{index}} reported by users in the production environment',
        'Enhancement task {{index}} to improve user experience and system performance',
        'Technical debt reduction task {{index}} to improve code maintainability',
        'Research and development task {{index}} to explore new technologies'
      ]
    };
    
    return templates[field] || [`Task Item {{index}}`];
  }

  // Override array generation for tags
  protected generateArrayValue(field: string): any[] {
    if (field === 'tags') {
      const allTags = [
        'frontend', 'backend', 'database', 'api', 'ui', 'ux', 
        'security', 'performance', 'testing', 'documentation',
        'bug', 'feature', 'enhancement', 'refactor', 'deployment',
        'monitoring', 'analytics', 'integration', 'migration', 'optimization'
      ];
      const numTags = Math.floor(Math.random() * 5); // 0-4 tags
      if (numTags === 0) {
        return []; // Some tasks have no tags
      }
      return this.shuffleArray(allTags).slice(0, numTags);
    }
    return [];
  }

  // Override enum generation for realistic distributions
  protected generateEnumValue(field: string): any {
    if (field === 'status') {
      // Realistic distribution: 50% open, 30% in_progress, 20% completed
      const rand = Math.random();
      if (rand < 0.5) return TaskStatus.OPEN;
      if (rand < 0.8) return TaskStatus.IN_PROGRESS;
      return TaskStatus.COMPLETED;
    }
    
    if (field === 'priority') {
      // Realistic distribution: 20% high, 50% medium, 30% low
      const rand = Math.random();
      if (rand < 0.2) return TaskPriority.HIGH;
      if (rand < 0.7) return TaskPriority.MEDIUM;
      return TaskPriority.LOW;
    }
    
    return super.generateEnumValue(field);
  }

  // Override date generation for task-specific logic
  protected generateDateValue(field: string): Date {
    const now = new Date();
    
    if (field === 'dueDate') {
      // Due dates are 1-30 days in the future
      const daysFromNow = Math.floor(Math.random() * 30) + 1;
      return new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    }
    
    if (field === 'startDate') {
      // Start dates are 0-7 days ago to 7 days in the future
      const daysOffset = Math.floor(Math.random() * 15) - 7; // -7 to +7
      return new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    }
    
    if (field === 'completedAt') {
      // Only set for completed tasks, 1-30 days ago
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    }
    
    return super.generateDateValue(field);
  }

  // Override field generation to handle conditional fields
  protected async generateFieldValue(
    field: string,
    type: any,
    index: number,
    relationships: Record<string, any[]>
  ): Promise<any> {
    // Only set completedAt for completed tasks
    if (field === 'completedAt') {
      // This will be handled by the parent class, but we can add logic here
      // For now, let the parent handle it and we'll filter later if needed
      return super.generateFieldValue(field, type, index, relationships);
    }
    
    return super.generateFieldValue(field, type, index, relationships);
  }
} 