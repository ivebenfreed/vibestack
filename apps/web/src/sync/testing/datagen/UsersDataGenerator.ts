import { UserRole } from '@repo/dataforge/client-entities';
import { BaseDataGenerator, type DomainEntityType, type EntitySchema } from './BaseDataGenerator';

/**
 * Data generator for Users entity
 */
export class UsersDataGenerator extends BaseDataGenerator {
  protected entityType: DomainEntityType = 'users';
  
  protected schema: EntitySchema = {
    requiredFields: {
      name: 'string',
      email: 'email',
      emailVerified: 'boolean',
      role: 'enum'
    },
    optionalFields: {
      image: 'url'
    },
    relationships: {
      hasMany: [
        { field: 'tasks', entity: 'tasks' },
        { field: 'ownedProjects', entity: 'projects' }
      ],
      manyToMany: [
        { field: 'memberProjects', entity: 'projects', joinTable: 'project_members' }
      ]
    },
    enums: {
      role: UserRole
    },
    constraints: {
      unique: ['email'],
      maxLength: { name: 100, email: 255 },
      patterns: {
        name: /^[a-zA-Z0-9\s\-']+$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    }
  };

  protected getStringTemplates(field: string): string[] {
    const templates: Record<string, string[]> = {
      name: [
        'User {{index}}',
        'Person {{index}}', 
        'Test User {{index}}',
        'John Doe {{index}}',
        'Jane Smith {{index}}',
        'Alex Johnson {{index}}',
        'Sam Wilson {{index}}',
        'Chris Brown {{index}}'
      ]
    };
    
    return templates[field] || [`User {{index}}`];
  }

  // Override email generation for users to ensure uniqueness
  protected generateEmailValue(index: number): string {
    const domains = ['company.com', 'example.org', 'test.net', 'demo.io', 'workspace.local'];
    const prefixes = ['user', 'test', 'demo', 'sample', 'dev'];
    
    const prefix = prefixes[index % prefixes.length];
    const domain = domains[index % domains.length];
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    
    return `${prefix}${index}_${randomSuffix}_${timestamp}@${domain}`;
  }

  // Override boolean generation for emailVerified to have realistic distribution
  protected generateFieldValue(field: string, type: any, index: number, relationships: Record<string, any[]>): Promise<any> {
    if (field === 'emailVerified') {
      // 80% of users have verified emails
      return Promise.resolve(Math.random() < 0.8);
    }
    
    return super.generateFieldValue(field, type, index, relationships);
  }
} 