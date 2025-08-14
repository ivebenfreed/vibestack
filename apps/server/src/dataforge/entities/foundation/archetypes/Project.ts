/**
 * Project Archetype - Universal Archetype Foundation
 * 
 * Provides base structure for project-type entities created via JSON schema.
 * This is a pattern/template, not a hardcoded entity table.
 */

export interface ProjectFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date?: Date;
  end_date?: Date;
  owner_id?: string;
  budget?: number;
  progress_percentage?: number;
  project_type?: 'software' | 'research' | 'marketing' | 'operational' | 'strategic';
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Project Archetype Pattern
 * Base pattern for all project-type entities
 */
export class ProjectArchetype {
  /**
   * Default field definitions for project archetype
   */
  static fields = {
    name: { type: 'text', required: true },
    description: { type: 'longtext', required: false },
    priority: { type: 'priority_option', required: true, defaultValue: 'medium' },
    status: { type: 'status_option', required: true, defaultValue: 'active' },
    start_date: { type: 'date', required: false },
    end_date: { type: 'date', required: false },
    owner_id: { type: 'user_reference', required: false },
    budget: { type: 'decimal', required: false },
    progress_percentage: { type: 'integer', required: false, defaultValue: 0 },
    project_type: { type: 'category_option', required: false, defaultValue: 'operational' }
  };

  /**
   * Kysely schema definition for project tables
   */
  static getKyselySchema() {
    return {
      id: 'string',
      organization_id: 'string',
      name: 'string',
      description: 'string | null',
      priority: 'string',
      start_date: 'Date | null',
      end_date: 'Date | null',
      owner_id: 'string | null',
      budget: 'number | null',
      progress_percentage: 'number | null',
      project_type: 'string | null',
      status: 'string',
      created_at: 'Date',
      updated_at: 'Date'
    };
  }

  /**
   * DDL template for project tables
   * Template placeholders: {tableName}, {orgId}, {entityName}
   */
  static getProjectDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS {tableName} (
        id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
        organization_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        start_date DATE,
        end_date DATE,
        owner_id UUID,
        budget DECIMAL(15,2),
        progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
        project_type VARCHAR(50) DEFAULT 'operational',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        CONSTRAINT fk_{tableName}_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,
        CONSTRAINT fk_{tableName}_owner FOREIGN KEY (owner_id) REFERENCES "user"(id) ON DELETE SET NULL
      );
    `;
  }

  /**
   * Index statements for project tables
   */
  static getProjectIndexes(): string[] {
    return [
      `CREATE INDEX IF NOT EXISTS idx_project_org_status ON "project"(organization_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_project_owner ON "project"(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_project_priority ON "project"(priority);`,
      `CREATE INDEX IF NOT EXISTS idx_project_dates ON "project"(start_date, end_date);`,
      `CREATE INDEX IF NOT EXISTS idx_project_progress ON "project"(progress_percentage);`,
      `CREATE INDEX IF NOT EXISTS idx_project_created_at ON "project"(created_at);`
    ];
  }

  /**
   * Validation rules for project entities
   */
  static getValidationRules() {
    return {
      name: {
        required: true,
        minLength: 2,
        maxLength: 255,
        pattern: /^[a-zA-Z0-9\s\-_\.]+$/
      },
      description: {
        maxLength: 10000
      },
      priority: {
        enum: ['low', 'medium', 'high', 'critical']
      },
      start_date: {
        type: 'date'
      },
      end_date: {
        type: 'date',
        afterField: 'start_date' // end_date must be after start_date
      },
      owner_id: {
        type: 'uuid'
      },
      budget: {
        type: 'number',
        min: 0,
        max: 999999999.99
      },
      progress_percentage: {
        type: 'integer',
        min: 0,
        max: 100
      },
      project_type: {
        enum: ['software', 'research', 'marketing', 'operational', 'strategic']
      }
    };
  }

  /**
   * Business logic for project entities
   */
  static getBusinessLogic() {
    return {
      // Calculate project duration in days
      calculateDuration: (startDate: Date, endDate: Date): number => {
        if (!startDate || !endDate) return 0;
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },

      // Check if project is overdue
      isOverdue: (endDate: Date, status: string): boolean => {
        if (!endDate || status === 'completed') return false;
        return new Date() > endDate;
      },

      // Calculate progress status
      getProgressStatus: (progressPercentage: number): string => {
        if (progressPercentage === 0) return 'not_started';
        if (progressPercentage < 25) return 'getting_started';
        if (progressPercentage < 50) return 'early_progress';
        if (progressPercentage < 75) return 'halfway';
        if (progressPercentage < 100) return 'nearly_complete';
        return 'completed';
      },

      // Get priority urgency level
      getPriorityUrgency: (priority: string): number => {
        const urgencyMap = {
          'low': 1,
          'medium': 2,
          'high': 3,
          'critical': 4
        };
        return urgencyMap[priority as keyof typeof urgencyMap] || 1;
      }
    };
  }

  /**
   * Default option sets for project fields
   */
  static getDefaultOptionSets() {
    return {
      priority: {
        name: 'Project Priority',
        options: [
          { value: 'low', label: 'Low', color: '#10B981', sortOrder: 1 },
          { value: 'medium', label: 'Medium', color: '#F59E0B', sortOrder: 2 },
          { value: 'high', label: 'High', color: '#EF4444', sortOrder: 3 },
          { value: 'critical', label: 'Critical', color: '#991B1B', sortOrder: 4 }
        ]
      },
      status: {
        name: 'Project Status',
        options: [
          { value: 'planning', label: 'Planning', color: '#6B7280', sortOrder: 1 },
          { value: 'active', label: 'Active', color: '#3B82F6', sortOrder: 2 },
          { value: 'on_hold', label: 'On Hold', color: '#F59E0B', sortOrder: 3 },
          { value: 'completed', label: 'Completed', color: '#10B981', sortOrder: 4 },
          { value: 'cancelled', label: 'Cancelled', color: '#EF4444', sortOrder: 5 }
        ]
      },
      project_type: {
        name: 'Project Type',
        options: [
          { value: 'software', label: 'Software Development', color: '#8B5CF6', sortOrder: 1 },
          { value: 'research', label: 'Research & Development', color: '#06B6D4', sortOrder: 2 },
          { value: 'marketing', label: 'Marketing Campaign', color: '#EC4899', sortOrder: 3 },
          { value: 'operational', label: 'Operational', color: '#84CC16', sortOrder: 4 },
          { value: 'strategic', label: 'Strategic Initiative', color: '#F97316', sortOrder: 5 }
        ]
      }
    };
  }

  /**
   * Archetype metadata
   */
  static getArchetypeMetadata() {
    return {
      name: 'Project',
      description: 'Base pattern for project-type entities with timeline, budget, and progress tracking',
      category: 'universal_archetype',
      version: '1.0.0',
      supportedRelationships: [
        'contains', // Project contains tasks
        'depends_on', // Project depends on other projects
        'blocks', // Project blocks other projects
        'relates_to' // Project relates to other entities
      ],
      defaultSyncable: true,
      requiredFields: ['name', 'priority'],
      recommendedFields: ['description', 'start_date', 'end_date', 'owner_id']
    };
  }
}

/**
 * Project Archetype Utilities
 */
export class ProjectUtilities {
  /**
   * Generate project code/identifier
   */
  static generateProjectCode(name: string, orgPrefix?: string): string {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const nameCode = cleanName.substring(0, 6);
    const orgCode = orgPrefix ? orgPrefix.substring(0, 3).toUpperCase() : 'ORG';
    const timestamp = Date.now().toString().slice(-4);
    return `${orgCode}-${nameCode}-${timestamp}`;
  }

  /**
   * Calculate project health score
   */
  static calculateHealthScore(project: Partial<ProjectFields>): number {
    let score = 100;
    
    // Deduct for overdue
    if (project.end_date && new Date() > project.end_date) {
      score -= 30;
    }
    
    // Deduct for low progress relative to time elapsed
    if (project.start_date && project.end_date && project.progress_percentage !== undefined) {
      const totalDuration = project.end_date.getTime() - project.start_date.getTime();
      const elapsed = Date.now() - project.start_date.getTime();
      const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
      
      if (project.progress_percentage < expectedProgress - 20) {
        score -= 25;
      }
    }
    
    // Adjust for priority
    if (project.priority === 'critical') score *= 1.1;
    if (project.priority === 'low') score *= 0.9;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get project phase based on progress
   */
  static getProjectPhase(progressPercentage: number): string {
    if (progressPercentage === 0) return 'initiation';
    if (progressPercentage < 25) return 'planning';
    if (progressPercentage < 75) return 'execution';
    if (progressPercentage < 100) return 'monitoring';
    return 'closure';
  }

  /**
   * Format project for API response
   */
  static toPublicFormat(project: any): any {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      priority: project.priority,
      status: project.status,
      progress: {
        percentage: project.progress_percentage || 0,
        phase: this.getProjectPhase(project.progress_percentage || 0),
        healthScore: this.calculateHealthScore(project)
      },
      timeline: {
        startDate: project.start_date,
        endDate: project.end_date,
        duration: project.start_date && project.end_date 
          ? ProjectArchetype.getBusinessLogic().calculateDuration(project.start_date, project.end_date)
          : null,
        isOverdue: ProjectArchetype.getBusinessLogic().isOverdue(project.end_date, project.status)
      },
      budget: project.budget,
      owner: project.owner_id,
      projectType: project.project_type,
      metadata: {
        createdAt: project.created_at,
        updatedAt: project.updated_at
      }
    };
  }
}

export default ProjectArchetype;