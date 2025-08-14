/**
 * Task Archetype - Universal Archetype Foundation
 * 
 * Provides base structure for task-type entities created via JSON schema.
 * This is a pattern/template, not a hardcoded entity table.
 */

export interface TaskFields {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'review' | 'blocked' | 'completed' | 'cancelled';
  assignee_id?: string;
  reporter_id?: string;
  due_date?: Date;
  estimated_hours?: number;
  actual_hours?: number;
  task_type?: 'bug' | 'feature' | 'improvement' | 'documentation' | 'maintenance';
  parent_task_id?: string;
  project_id?: string;
  sprint_id?: string;
  story_points?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Task Archetype Pattern
 * Base pattern for all task-type entities
 */
export class TaskArchetype {
  /**
   * Default field definitions for task archetype
   */
  static fields = {
    title: { type: 'text', required: true },
    description: { type: 'longtext', required: false },
    priority: { type: 'priority_option', required: true, defaultValue: 'medium' },
    status: { type: 'status_option', required: true, defaultValue: 'todo' },
    assignee_id: { type: 'user_reference', required: false },
    reporter_id: { type: 'user_reference', required: false },
    due_date: { type: 'date', required: false },
    estimated_hours: { type: 'decimal', required: false },
    actual_hours: { type: 'decimal', required: false },
    task_type: { type: 'category_option', required: false, defaultValue: 'feature' },
    parent_task_id: { type: 'entity_reference', required: false },
    project_id: { type: 'entity_reference', required: false },
    sprint_id: { type: 'entity_reference', required: false },
    story_points: { type: 'integer', required: false }
  };

  /**
   * Kysely schema definition for task tables
   */
  static getKyselySchema() {
    return {
      id: 'string',
      organization_id: 'string',
      title: 'string',
      description: 'string | null',
      priority: 'string',
      status: 'string',
      assignee_id: 'string | null',
      reporter_id: 'string | null',
      due_date: 'Date | null',
      estimated_hours: 'number | null',
      actual_hours: 'number | null',
      task_type: 'string | null',
      parent_task_id: 'string | null',
      project_id: 'string | null',
      sprint_id: 'string | null',
      story_points: 'number | null',
      created_at: 'Date',
      updated_at: 'Date'
    };
  }

  /**
   * DDL template for task tables
   * Template placeholders: {tableName}, {orgId}, {entityName}
   */
  static getTaskDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS {tableName} (
        id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'todo',
        assignee_id UUID,
        reporter_id UUID,
        due_date DATE,
        estimated_hours DECIMAL(10,2),
        actual_hours DECIMAL(10,2),
        task_type VARCHAR(50) DEFAULT 'feature',
        parent_task_id UUID,
        project_id UUID,
        sprint_id UUID,
        story_points INTEGER CHECK (story_points >= 0 AND story_points <= 100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        CONSTRAINT fk_{tableName}_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,
        CONSTRAINT fk_{tableName}_assignee FOREIGN KEY (assignee_id) REFERENCES "user"(id) ON DELETE SET NULL,
        CONSTRAINT fk_{tableName}_reporter FOREIGN KEY (reporter_id) REFERENCES "user"(id) ON DELETE SET NULL,
        CONSTRAINT fk_{tableName}_parent FOREIGN KEY (parent_task_id) REFERENCES {tableName}(id) ON DELETE SET NULL
      );
    `;
  }

  /**
   * Index statements for task tables
   */
  static getTaskIndexes(): string[] {
    return [
      `CREATE INDEX IF NOT EXISTS idx_task_org_status ON "task"(organization_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_task_assignee ON "task"(assignee_id);`,
      `CREATE INDEX IF NOT EXISTS idx_task_reporter ON "task"(reporter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_task_priority ON "task"(priority);`,
      `CREATE INDEX IF NOT EXISTS idx_task_due_date ON "task"(due_date);`,
      `CREATE INDEX IF NOT EXISTS idx_task_project ON "task"(project_id);`,
      `CREATE INDEX IF NOT EXISTS idx_task_sprint ON "task"(sprint_id);`,
      `CREATE INDEX IF NOT EXISTS idx_task_parent ON "task"(parent_task_id);`,
      `CREATE INDEX IF NOT EXISTS idx_task_type_status ON "task"(task_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_task_created_at ON "task"(created_at);`
    ];
  }

  /**
   * Validation rules for task entities
   */
  static getValidationRules() {
    return {
      title: {
        required: true,
        minLength: 3,
        maxLength: 500,
        pattern: /^[a-zA-Z0-9\s\-_\.\,\!\?\:]+$/
      },
      description: {
        maxLength: 50000
      },
      priority: {
        enum: ['low', 'medium', 'high', 'critical']
      },
      status: {
        enum: ['todo', 'in_progress', 'review', 'blocked', 'completed', 'cancelled']
      },
      assignee_id: {
        type: 'uuid'
      },
      reporter_id: {
        type: 'uuid'
      },
      due_date: {
        type: 'date',
        futureDate: true // Due date should typically be in the future
      },
      estimated_hours: {
        type: 'number',
        min: 0,
        max: 9999.99
      },
      actual_hours: {
        type: 'number',
        min: 0,
        max: 9999.99
      },
      task_type: {
        enum: ['bug', 'feature', 'improvement', 'documentation', 'maintenance']
      },
      parent_task_id: {
        type: 'uuid'
      },
      project_id: {
        type: 'uuid'
      },
      sprint_id: {
        type: 'uuid'
      },
      story_points: {
        type: 'integer',
        min: 0,
        max: 100
      }
    };
  }

  /**
   * Business logic for task entities
   */
  static getBusinessLogic() {
    return {
      // Check if task is overdue
      isOverdue: (dueDate: Date, status: string): boolean => {
        if (!dueDate || ['completed', 'cancelled'].includes(status)) return false;
        return new Date() > dueDate;
      },

      // Calculate time variance (actual vs estimated)
      calculateTimeVariance: (estimatedHours: number, actualHours: number): number => {
        if (!estimatedHours || !actualHours) return 0;
        return ((actualHours - estimatedHours) / estimatedHours) * 100;
      },

      // Get task complexity based on story points
      getComplexity: (storyPoints: number): string => {
        if (!storyPoints) return 'unknown';
        if (storyPoints <= 2) return 'trivial';
        if (storyPoints <= 5) return 'simple';
        if (storyPoints <= 8) return 'medium';
        if (storyPoints <= 13) return 'complex';
        return 'epic';
      },

      // Calculate task urgency score
      getUrgencyScore: (priority: string, dueDate: Date, status: string): number => {
        let score = 0;
        
        // Base priority score
        const priorityMap = {
          'low': 1,
          'medium': 2,
          'high': 3,
          'critical': 4
        };
        score += priorityMap[priority as keyof typeof priorityMap] || 1;
        
        // Due date proximity
        if (dueDate && !['completed', 'cancelled'].includes(status)) {
          const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilDue < 0) score += 3; // Overdue
          else if (daysUntilDue <= 1) score += 2; // Due today/tomorrow
          else if (daysUntilDue <= 7) score += 1; // Due this week
        }
        
        // Status multiplier
        if (status === 'blocked') score *= 1.5;
        if (status === 'in_progress') score *= 1.2;
        
        return Math.min(10, score);
      },

      // Check if task can be completed
      canComplete: (status: string, dependencies: string[]): boolean => {
        if (['completed', 'cancelled'].includes(status)) return false;
        if (status === 'blocked') return false;
        // In real implementation, would check if all dependency tasks are completed
        return true;
      },

      // Calculate task progress percentage
      getProgressPercentage: (status: string, actualHours?: number, estimatedHours?: number): number => {
        const statusProgressMap = {
          'todo': 0,
          'in_progress': actualHours && estimatedHours ? Math.min(90, (actualHours / estimatedHours) * 80) : 25,
          'review': 90,
          'blocked': actualHours && estimatedHours ? Math.min(50, (actualHours / estimatedHours) * 40) : 15,
          'completed': 100,
          'cancelled': 0
        };
        
        return statusProgressMap[status as keyof typeof statusProgressMap] || 0;
      }
    };
  }

  /**
   * Default option sets for task fields
   */
  static getDefaultOptionSets() {
    return {
      priority: {
        name: 'Task Priority',
        options: [
          { value: 'low', label: 'Low', color: '#10B981', sortOrder: 1 },
          { value: 'medium', label: 'Medium', color: '#F59E0B', sortOrder: 2 },
          { value: 'high', label: 'High', color: '#EF4444', sortOrder: 3 },
          { value: 'critical', label: 'Critical', color: '#991B1B', sortOrder: 4 }
        ]
      },
      status: {
        name: 'Task Status',
        options: [
          { value: 'todo', label: 'To Do', color: '#6B7280', sortOrder: 1 },
          { value: 'in_progress', label: 'In Progress', color: '#3B82F6', sortOrder: 2 },
          { value: 'review', label: 'Review', color: '#8B5CF6', sortOrder: 3 },
          { value: 'blocked', label: 'Blocked', color: '#EF4444', sortOrder: 4 },
          { value: 'completed', label: 'Completed', color: '#10B981', sortOrder: 5 },
          { value: 'cancelled', label: 'Cancelled', color: '#6B7280', sortOrder: 6 }
        ]
      },
      task_type: {
        name: 'Task Type',
        options: [
          { value: 'bug', label: 'Bug Fix', color: '#EF4444', sortOrder: 1 },
          { value: 'feature', label: 'New Feature', color: '#10B981', sortOrder: 2 },
          { value: 'improvement', label: 'Improvement', color: '#3B82F6', sortOrder: 3 },
          { value: 'documentation', label: 'Documentation', color: '#8B5CF6', sortOrder: 4 },
          { value: 'maintenance', label: 'Maintenance', color: '#F59E0B', sortOrder: 5 }
        ]
      }
    };
  }

  /**
   * Workflow transitions for task status
   */
  static getWorkflowTransitions() {
    return {
      todo: ['in_progress', 'cancelled'],
      in_progress: ['review', 'blocked', 'completed', 'todo', 'cancelled'],
      review: ['completed', 'in_progress', 'todo'],
      blocked: ['todo', 'in_progress', 'cancelled'],
      completed: [], // Terminal state
      cancelled: ['todo'] // Can be reopened
    };
  }

  /**
   * Archetype metadata
   */
  static getArchetypeMetadata() {
    return {
      name: 'Task',
      description: 'Base pattern for task-type entities with assignment, progress tracking, and workflow management',
      category: 'universal_archetype',
      version: '1.0.0',
      supportedRelationships: [
        'depends_on', // Task depends on other tasks
        'blocks', // Task blocks other tasks
        'relates_to', // Task relates to other entities
        'child_of', // Subtask relationship
        'duplicates' // Duplicate task detection
      ],
      defaultSyncable: true,
      requiredFields: ['title', 'priority', 'status'],
      recommendedFields: ['description', 'assignee_id', 'due_date', 'task_type'],
      workflowEnabled: true
    };
  }
}

/**
 * Task Archetype Utilities
 */
export class TaskUtilities {
  /**
   * Generate task code/identifier
   */
  static generateTaskCode(title: string, taskType?: string, projectPrefix?: string): string {
    const typePrefix = taskType ? taskType.substring(0, 3).toUpperCase() : 'TSK';
    const projectCode = projectPrefix ? projectPrefix.substring(0, 3).toUpperCase() : 'GEN';
    const timestamp = Date.now().toString().slice(-4);
    return `${projectCode}-${typePrefix}-${timestamp}`;
  }

  /**
   * Calculate task health score
   */
  static calculateHealthScore(task: Partial<TaskFields>): number {
    let score = 100;
    
    // Deduct for overdue
    if (task.due_date && TaskArchetype.getBusinessLogic().isOverdue(task.due_date, task.status || 'todo')) {
      score -= 40;
    }
    
    // Deduct for blocked status
    if (task.status === 'blocked') {
      score -= 30;
    }
    
    // Deduct for time overrun
    if (task.estimated_hours && task.actual_hours) {
      const variance = TaskArchetype.getBusinessLogic().calculateTimeVariance(task.estimated_hours, task.actual_hours);
      if (variance > 50) { // More than 50% over estimate
        score -= 25;
      }
    }
    
    // Adjust for priority
    if (task.priority === 'critical') score *= 1.1;
    if (task.priority === 'low') score *= 0.9;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get task velocity (story points per hour)
   */
  static calculateVelocity(storyPoints: number, actualHours: number): number {
    if (!storyPoints || !actualHours) return 0;
    return storyPoints / actualHours;
  }

  /**
   * Check if status transition is valid
   */
  static isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
    const transitions = TaskArchetype.getWorkflowTransitions();
    return transitions[fromStatus as keyof typeof transitions]?.includes(toStatus) || false;
  }

  /**
   * Get next valid statuses
   */
  static getNextValidStatuses(currentStatus: string): string[] {
    const transitions = TaskArchetype.getWorkflowTransitions();
    return transitions[currentStatus as keyof typeof transitions] || [];
  }

  /**
   * Calculate burndown data for sprint planning
   */
  static calculateBurndown(tasks: Partial<TaskFields>[]): any {
    const totalStoryPoints = tasks.reduce((sum, task) => sum + (task.story_points || 0), 0);
    const completedStoryPoints = tasks
      .filter(task => task.status === 'completed')
      .reduce((sum, task) => sum + (task.story_points || 0), 0);
    
    return {
      totalStoryPoints,
      completedStoryPoints,
      remainingStoryPoints: totalStoryPoints - completedStoryPoints,
      completionPercentage: totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 0
    };
  }

  /**
   * Format task for API response
   */
  static toPublicFormat(task: any): any {
    const businessLogic = TaskArchetype.getBusinessLogic();
    
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee_id,
      reporter: task.reporter_id,
      workflow: {
        nextValidStatuses: this.getNextValidStatuses(task.status),
        progress: businessLogic.getProgressPercentage(task.status, task.actual_hours, task.estimated_hours),
        urgencyScore: businessLogic.getUrgencyScore(task.priority, task.due_date, task.status)
      },
      timeline: {
        dueDate: task.due_date,
        isOverdue: businessLogic.isOverdue(task.due_date, task.status)
      },
      effort: {
        estimatedHours: task.estimated_hours,
        actualHours: task.actual_hours,
        storyPoints: task.story_points,
        complexity: businessLogic.getComplexity(task.story_points || 0),
        variance: task.estimated_hours && task.actual_hours 
          ? businessLogic.calculateTimeVariance(task.estimated_hours, task.actual_hours)
          : null
      },
      relationships: {
        parentTaskId: task.parent_task_id,
        projectId: task.project_id,
        sprintId: task.sprint_id
      },
      taskType: task.task_type,
      health: {
        score: this.calculateHealthScore(task),
        canComplete: businessLogic.canComplete(task.status, []) // Dependencies would be passed here
      },
      metadata: {
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }
    };
  }
}

export default TaskArchetype;