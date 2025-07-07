import { v4 as uuidv4 } from 'uuid';
import type { BaseDataGenerator, DomainEntityType, GenerationOptions } from './BaseDataGenerator';
import { UsersDataGenerator } from './UsersDataGenerator';
import { ProjectsDataGenerator } from './ProjectsDataGenerator';
import { TasksDataGenerator } from './TasksDataGenerator';
import { CommentsDataGenerator } from './CommentsDataGenerator';
import { CoverageValidator, type CoverageValidationResult } from '../validators/CoverageValidator';

// Universal services interface for domain entities
interface DomainServices {
  users: {
    createUser(userData: any): Promise<any>;
    createFromSync(userData: any): Promise<any>;
    updateUser(id: string, changes: any): Promise<any>;
    updateFromSync(id: string, changes: any): Promise<any>;
    deleteUser(id: string): Promise<boolean>;
    deleteFromSync(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    getAll?(): Promise<any[]>;
  };
  projects: {
    createProject(projectData: any): Promise<any>;
    createFromSync(projectData: any): Promise<any>;
    updateProject(id: string, changes: any): Promise<any>;
    updateFromSync(id: string, changes: any): Promise<any>;
    deleteProject(id: string): Promise<boolean>;
    deleteFromSync(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    updateProjectMembers?(projectId: string, userIds: string[]): Promise<any[]>;
    addProjectMember?(projectId: string, userId: string): Promise<any[]>;
    removeProjectMember?(projectId: string, userId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
  tasks: {
    createTask(taskData: any): Promise<any>;
    createFromSync(taskData: any): Promise<any>;
    updateTask(id: string, changes: any): Promise<any>;
    updateFromSync(id: string, changes: any): Promise<any>;
    deleteTask(id: string): Promise<boolean>;
    deleteFromSync(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    updateTaskStatus?(id: string, status: any): Promise<any>;
    getByProject?(projectId: string): Promise<any[]>;
    getByAssignee?(assigneeId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
  comments: {
    createComment(commentData: any): Promise<any>;
    createFromSync(commentData: any): Promise<any>;
    updateComment(id: string, changes: any): Promise<any>;
    updateFromSync(id: string, changes: any): Promise<any>;
    deleteComment(id: string): Promise<boolean>;
    deleteFromSync(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    getByTask?(taskId: string): Promise<any[]>;
    getByProject?(projectId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
}

/**
 * Factory class that manages all entity data generators
 * Provides a unified interface for generating pure data objects (no service calls)
 */
export class DataGeneratorFactory {
  private generators: Map<DomainEntityType, BaseDataGenerator> = new Map();
  private coverageValidator: CoverageValidator;

  constructor(private services: any) {
    this.initializeGenerators();
    this.coverageValidator = new CoverageValidator(services);
  }

  private initializeGenerators() {
    this.generators.set('users', new UsersDataGenerator());
    this.generators.set('projects', new ProjectsDataGenerator());
    this.generators.set('tasks', new TasksDataGenerator());
    this.generators.set('comments', new CommentsDataGenerator());
  }

  /**
   * Generate raw data for any entity type
   */
  async generateRawData(
    entityType: DomainEntityType,
    count: number = 1,
    options: GenerationOptions = {}
  ): Promise<any[]> {
    const generator = this.generators.get(entityType);
    if (!generator) {
      throw new Error(`No generator available for entity type: ${entityType}`);
    }

    return generator.generateRawData(count, options);
  }

  /**
   * Generate comprehensive test dataset with relationships (pure data objects only)
   */
  async generateTestDataset(options: {
    counts?: Partial<Record<DomainEntityType, number>>;
  } = {}): Promise<Record<DomainEntityType, any[]>> {
    const {
      counts = { users: 5, projects: 3, tasks: 10, comments: 15 }
    } = options;

    const dataset: Record<DomainEntityType, any[]> = {} as any;
    
    // Generate entities in dependency order
    const dependencyOrder: DomainEntityType[] = ['users', 'projects', 'tasks', 'comments'];
    
    for (const entityType of dependencyOrder) {
      const count = counts[entityType] || 5;
      const relationships: Record<string, any[]> = {};
      
      // Provide existing entities as relationship options
      for (const [key, value] of Object.entries(dataset)) {
        if (value.length > 0) {
          relationships[key] = value;
        }
      }
      
      dataset[entityType] = await this.generateRawData(entityType, count, { relationships });
    }

    return dataset;
  }

  /**
   * Generate join table relationship data (pure objects, no service calls)
   */
  generateJoinTableData(dataset: Record<DomainEntityType, any[]>): Record<string, any[]> {
    const joinTables: Record<string, any[]> = {};

    // Generate project_members join table data
    if (dataset.projects && dataset.users) {
      const projectMembers = [];
      for (const project of dataset.projects) {
        // Assign 1-3 random users as members
        const memberCount = Math.floor(Math.random() * 3) + 1;
        const selectedUsers = this.shuffleArray([...dataset.users]).slice(0, memberCount);
        
        for (const user of selectedUsers) {
          projectMembers.push({
            id: uuidv4(),
            projectId: project.id,
            userId: user.id,
            project,
            user,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
      joinTables.project_members = projectMembers;
    }

    // Generate task_dependencies join table data
    if (dataset.tasks && dataset.tasks.length > 1) {
      const taskDependencies = [];
      const tasks = dataset.tasks;
      
      for (let i = 0; i < Math.min(3, tasks.length - 1); i++) {
        const dependentTask = tasks[i];
        const dependencyTask = tasks[i + 1];
        
        taskDependencies.push({
          id: uuidv4(),
          dependentTaskId: dependentTask.id,
          dependencyTaskId: dependencyTask.id,
          dependentTask,
          dependencyTask,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      joinTables.task_dependencies = taskDependencies;
    }

    return joinTables;
  }

  /**
   * Generate edge case data for testing (pure objects only)
   */
  async generateEdgeCaseData(entities: DomainEntityType[] = ['users', 'projects', 'tasks', 'comments']): Promise<any> {
    const edgeCases: any = {};

    for (const entityType of entities) {
      edgeCases[entityType] = {
        maxLength: await this.generateMaxLengthData(entityType),
        specialCharacters: await this.generateSpecialCharacterData(entityType),
        enumValues: await this.generateAllEnumValueData(entityType),
        minimal: await this.generateMinimalData(entityType),
        boundary: await this.generateBoundaryData(entityType)
      };
    }

    return edgeCases;
  }

  /**
   * Generate data with maximum length values
   */
  private async generateMaxLengthData(entityType: DomainEntityType): Promise<any> {
    const generator = this.generators.get(entityType);
    if (!generator) return null;

    return await generator.generateRawData(1, { 
      variation: 'complete',
      overrides: {
        ...(entityType === 'users' && { name: 'A'.repeat(100) }),
        ...(entityType === 'projects' && { name: 'A'.repeat(100) }),
        ...(entityType === 'tasks' && { title: 'A'.repeat(100) }),
        ...(entityType === 'comments' && { content: 'A'.repeat(5000) })
      }
    });
  }

  /**
   * Generate data with special characters
   */
  private async generateSpecialCharacterData(entityType: DomainEntityType): Promise<any> {
    const generator = this.generators.get(entityType);
    if (!generator) return null;

    const specialChars = "!@#$%^&*()[]{}|;':\",./<>?`~";
    return await generator.generateRawData(1, {
      variation: 'complete',
      overrides: {
        ...(entityType === 'users' && { name: `Test${specialChars}User` }),
        ...(entityType === 'projects' && { name: `Test${specialChars}Project` }),
        ...(entityType === 'tasks' && { title: `Test${specialChars}Task` }),
        ...(entityType === 'comments' && { content: `Test${specialChars}Comment` })
      }
    });
  }

  /**
   * Generate data for all enum values
   */
  private async generateAllEnumValueData(entityType: DomainEntityType): Promise<any> {
    const generator = this.generators.get(entityType);
    if (!generator) return null;

    const enumTests = [];
    
    if (entityType === 'tasks') {
      const statuses = ['open', 'in_progress', 'completed', 'cancelled'];
      const priorities = ['low', 'medium', 'high', 'urgent'];
      
      for (const status of statuses) {
        for (const priority of priorities) {
          const data = await generator.generateRawData(1, {
            overrides: { status, priority }
          });
          enumTests.push(data[0]);
        }
      }
    } else if (entityType === 'projects') {
      const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
      
      for (const status of statuses) {
        const data = await generator.generateRawData(1, {
          overrides: { status }
        });
        enumTests.push(data[0]);
      }
    } else if (entityType === 'users') {
      const roles = ['admin', 'member', 'viewer', 'super_admin'];
      
      for (const role of roles) {
        const data = await generator.generateRawData(1, {
          overrides: { role }
        });
        enumTests.push(data[0]);
      }
    }

    return enumTests;
  }

  /**
   * Generate minimal data (only required fields)
   */
  private async generateMinimalData(entityType: DomainEntityType): Promise<any> {
    const generator = this.generators.get(entityType);
    if (!generator) return null;

    return await generator.generateRawData(1, { variation: 'minimal' });
  }

  /**
   * Generate boundary value data
   */
  private async generateBoundaryData(entityType: DomainEntityType): Promise<any> {
    const generator = this.generators.get(entityType);
    if (!generator) return null;

    const boundaryTests = [];
    
    // Empty strings (where allowed)
    const emptyStringData = await generator.generateRawData(1, {
      overrides: {
        ...(entityType === 'projects' && { description: '' }),
        ...(entityType === 'tasks' && { description: '' })
      }
    });
    boundaryTests.push(...emptyStringData);

    // Null values (where allowed)
    const nullValueData = await generator.generateRawData(1, {
      overrides: {
        ...(entityType === 'users' && { image: null }),
        ...(entityType === 'projects' && { description: null, ownerId: null }),
        ...(entityType === 'tasks' && { 
          description: null, 
          projectId: null, 
          assigneeId: null,
          dueDate: null,
          startDate: null,
          completedAt: null
        }),
        ...(entityType === 'comments' && { 
          authorId: null, 
          parentId: null, 
          taskId: null, 
          projectId: null 
        })
      }
    });
    boundaryTests.push(...nullValueData);

    return boundaryTests;
  }

  /**
   * Generate statistics about a dataset
   */
  generateDatasetStatistics(dataset: Record<DomainEntityType, any[]>, joinTables?: Record<string, any[]>): any {
    const stats = {
      entities: {} as Record<string, any>,
      relationships: {} as Record<string, any>,
      totals: {
        entities: 0,
        relationships: 0
      }
    };

    // Entity statistics
    for (const [entityType, entities] of Object.entries(dataset)) {
      stats.entities[entityType] = {
        count: entities.length,
        hasIds: entities.every(e => e.id),
        hasTimestamps: entities.every(e => e.createdAt || e.updatedAt),
        uniqueIds: new Set(entities.map(e => e.id)).size === entities.length,
        fieldCoverage: this.analyzeFieldCoverage(entities)
      };
      stats.totals.entities += entities.length;
    }

    // Relationship statistics
    if (joinTables) {
      for (const [tableName, relationships] of Object.entries(joinTables)) {
        stats.relationships[tableName] = {
          count: relationships.length,
          uniquePairs: new Set(relationships.map(r => 
            `${r.projectId || r.dependentTaskId}-${r.userId || r.dependencyTaskId}`
          )).size
        };
        stats.totals.relationships += relationships.length;
      }
    }

    return stats;
  }

  /**
   * Analyze field coverage in generated data
   */
  private analyzeFieldCoverage(entities: any[]): any {
    if (entities.length === 0) return {};

    const fieldCoverage: Record<string, any> = {};
    const sampleEntity = entities[0];

    for (const field of Object.keys(sampleEntity)) {
      const nonNullCount = entities.filter(e => e[field] != null).length;
      fieldCoverage[field] = {
        coverage: nonNullCount / entities.length,
        nonNullCount,
        totalCount: entities.length,
        hasVariation: new Set(entities.map(e => e[field])).size > 1
      };
    }

    return fieldCoverage;
  }

  /**
   * Convenience methods for each entity type (raw data generation only)
   */
  async generateRawUsers(count: number = 5, options: GenerationOptions = {}): Promise<any[]> {
    return this.generateRawData('users', count, options);
  }

  async generateRawProjects(count: number = 3, options: GenerationOptions = {}): Promise<any[]> {
    return this.generateRawData('projects', count, options);
  }

  async generateRawTasks(count: number = 10, options: GenerationOptions = {}): Promise<any[]> {
    return this.generateRawData('tasks', count, options);
  }

  async generateRawComments(count: number = 15, options: GenerationOptions = {}): Promise<any[]> {
    return this.generateRawData('comments', count, options);
  }

  /**
   * Create a realistic dataset with proper relationships and distributions
   */
  async createRealisticDataset(options: {
    userCount?: number;
    projectCount?: number;
    taskCount?: number;
    commentCount?: number;
  } = {}): Promise<Record<DomainEntityType, any[]>> {
    const {
      userCount = 8,
      projectCount = 4,
      taskCount = 20,
      commentCount = 30
    } = options;

    return this.generateTestDataset({
      counts: {
        users: userCount,
        projects: projectCount,
        tasks: taskCount,
        comments: commentCount
      }
    });
  }

  /**
   * Get a specific generator for advanced usage
   */
  getGenerator(entityType: DomainEntityType) {
    return this.generators.get(entityType);
  }

  /**
   * Validate that all required services are available
   */
  validateServices(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const requiredMethods = {
      users: ['createUser', 'createFromSync', 'updateUser', 'updateFromSync', 'deleteUser', 'deleteFromSync', 'get'],
      projects: ['createProject', 'createFromSync', 'updateProject', 'updateFromSync', 'deleteProject', 'deleteFromSync', 'get'],
      tasks: ['createTask', 'createFromSync', 'updateTask', 'updateFromSync', 'deleteTask', 'deleteFromSync', 'get'],
      comments: ['createComment', 'createFromSync', 'updateComment', 'updateFromSync', 'deleteComment', 'deleteFromSync', 'get']
    };

    for (const [entityType, methods] of Object.entries(requiredMethods)) {
      const service = this.services[entityType as DomainEntityType];
      if (!service) {
        errors.push(`Missing service for entity: ${entityType}`);
        continue;
      }

      for (const method of methods) {
        if (typeof (service as any)[method] !== 'function') {
          errors.push(`Missing method ${method} on ${entityType} service`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate complete coverage of domain entities, services, and relationships
   */
  async validateDomainCoverage(): Promise<CoverageValidationResult> {
    return await this.coverageValidator.validateDomainCoverage();
  }

  /**
   * Generate a detailed coverage report
   */
  generateCoverageReport(validation: CoverageValidationResult): string {
    return this.coverageValidator.generateCoverageReport(validation);
  }

  // Utility methods
  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
} 