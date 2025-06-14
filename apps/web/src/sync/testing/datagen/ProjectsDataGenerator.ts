import { ProjectStatus } from '@repo/dataforge/client-entities';
import { BaseDataGenerator, type DomainEntityType, type EntitySchema } from './BaseDataGenerator';

/**
 * Data generator for Projects entity
 */
export class ProjectsDataGenerator extends BaseDataGenerator {
  protected entityType: DomainEntityType = 'projects';
  
  protected schema: EntitySchema = {
    requiredFields: {
      name: 'string',
      status: 'enum'
    },
    optionalFields: {
      description: 'string',
      ownerId: 'uuid'
    },
    relationships: {
      belongsTo: [
        { field: 'owner', entity: 'users', required: false }
      ],
      hasMany: [
        { field: 'tasks', entity: 'tasks' },
        { field: 'comments', entity: 'comments' }
      ],
      manyToMany: [
        { field: 'members', entity: 'users', joinTable: 'project_members' }
      ]
    },
    enums: {
      status: ProjectStatus
    },
    constraints: {
      maxLength: { name: 100, description: 5000 },
      patterns: {
        name: /^[a-zA-Z0-9\s\-_'.]+$/
      }
    }
  };

  protected getStringTemplates(field: string): string[] {
    const templates: Record<string, string[]> = {
      name: [
        'Project {{index}}',
        'Website Redesign {{index}}',
        'Mobile App {{index}}',
        'API Development {{index}}',
        'Database Migration {{index}}',
        'User Dashboard {{index}}',
        'E-commerce Platform {{index}}',
        'Analytics System {{index}}',
        'Content Management {{index}}',
        'Payment Integration {{index}}'
      ],
      description: [
        'A comprehensive project to improve our {{index}} system',
        'This project focuses on enhancing user experience for {{index}}',
        'Development of new features and improvements for project {{index}}',
        'Strategic initiative to modernize our {{index}} infrastructure',
        'Customer-focused project to deliver value through {{index}}',
        'Technical project aimed at optimizing {{index}} performance',
        'Innovation project exploring new possibilities for {{index}}',
        'Quality improvement project for {{index}} deliverables'
      ]
    };
    
    return templates[field] || [`Project Item {{index}}`];
  }

  // Override string generation for description to make it more realistic
  protected generateStringValue(field: string, index: number): string {
    if (field === 'description') {
      const templates = this.getStringTemplates(field);
      const template = templates[index % templates.length];
      
      // For descriptions, create longer, more realistic content
      const baseDescription = template.replace('{{index}}', String(index + 1));
      const additionalDetails = [
        'This includes comprehensive planning, development, and testing phases.',
        'The project will involve cross-functional collaboration and stakeholder engagement.',
        'Key deliverables include documentation, implementation, and user training.',
        'Success metrics will be tracked throughout the project lifecycle.',
        'Regular reviews and iterations will ensure quality outcomes.'
      ];
      
      const randomDetail = additionalDetails[Math.floor(Math.random() * additionalDetails.length)];
      return `${baseDescription} ${randomDetail}`;
    }
    
    return super.generateStringValue(field, index);
  }

  // Override enum generation to have realistic status distribution
  protected generateEnumValue(field: string): any {
    if (field === 'status') {
      // Realistic distribution: 40% active, 30% in_progress, 20% completed, 10% on_hold
      const rand = Math.random();
      if (rand < 0.4) return ProjectStatus.ACTIVE;
      if (rand < 0.7) return ProjectStatus.IN_PROGRESS;
      if (rand < 0.9) return ProjectStatus.COMPLETED;
      return ProjectStatus.ON_HOLD;
    }
    
    return super.generateEnumValue(field);
  }
} 