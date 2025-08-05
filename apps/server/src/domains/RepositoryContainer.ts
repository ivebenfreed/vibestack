// Repository container for dependency injection
import { Task, Task as TaskClass } from '@repo/dataforge/server-entities';
import { User, User as UserClass } from '@repo/dataforge/server-entities';
import { Comment as _Comment, Comment as CommentClass } from '@repo/dataforge/server-entities';
import { Project, Project as ProjectClass } from '@repo/dataforge/server-entities';
import { ChangeHistory, ChangeHistory as ChangeHistoryClass } from '@repo/dataforge/server-entities';
import { StatusSet, StatusSet as StatusSetClass } from '@repo/dataforge/server-entities';
import { StatusDefinition, StatusDefinition as StatusDefinitionClass } from '@repo/dataforge/server-entities';
import { TagSet, TagSet as TagSetClass } from '@repo/dataforge/server-entities';
import { Tag, Tag as TagClass } from '@repo/dataforge/server-entities';
import { EntityDependency, EntityDependency as EntityDependencyClass } from '@repo/dataforge/server-entities';
import { EntityTarget } from 'typeorm';
import { BaseServerRepository } from './BaseServerRepository';
import { ProjectRepository } from './projects';
import { TaskRepository } from './tasks';
import { UserRepository } from './users';
import { CommentRepository } from './comments';
import { ChangeHistoryRepository } from './ChangeHistoryRepository';
import { StatusSetRepository } from './status-sets';
import { StatusDefinitionRepository } from './status-definitions';
import { TagSetRepository } from './tag-sets';
import { TagRepository } from './tags';
import { EntityDependencyRepository } from './entity-dependencies';
import { NeonService } from '../lib/neon-orm/neon-service';

/**
 * Central repository container for managing all domain repositories
 * Provides type-safe access to repositories and handles NeonService integration
 */
export class RepositoryContainer {
  public readonly projects: ProjectRepository;
  public readonly tasks: TaskRepository;
  public readonly users: UserRepository;
  public readonly comments: CommentRepository;
  public readonly changeHistory: ChangeHistoryRepository;
  public readonly statusSets: StatusSetRepository;
  public readonly statusDefinitions: StatusDefinitionRepository;
  public readonly tagSets: TagSetRepository;
  public readonly tags: TagRepository;
  public readonly entityDependencies: EntityDependencyRepository;
  
  // Map for dynamic repository access - use any for mixed repository types
  private repositoryMap: Map<string, any>;
  
  constructor(private neonService: NeonService) {
    // Initialize all repositories
    this.projects = new ProjectRepository(neonService);
    this.tasks = new TaskRepository(neonService);
    this.users = new UserRepository(neonService);
    this.comments = new CommentRepository(neonService);
    this.changeHistory = new ChangeHistoryRepository(neonService);
    this.statusSets = new StatusSetRepository(neonService);
    this.statusDefinitions = new StatusDefinitionRepository(neonService);
    this.tagSets = new TagSetRepository(neonService);
    this.tags = new TagRepository(neonService);
    this.entityDependencies = new EntityDependencyRepository(neonService);
    
    // Create repository map for dynamic access
    this.repositoryMap = new Map();
    this.repositoryMap.set('projects', this.projects);
    this.repositoryMap.set('tasks', this.tasks);
    this.repositoryMap.set('users', this.users);
    this.repositoryMap.set('comments', this.comments);
    this.repositoryMap.set('change_history', this.changeHistory);
    this.repositoryMap.set('status_sets', this.statusSets);
    this.repositoryMap.set('status_definitions', this.statusDefinitions);
    this.repositoryMap.set('tag_sets', this.tagSets);
    this.repositoryMap.set('tags', this.tags);
    this.repositoryMap.set('entity_dependencies', this.entityDependencies);
  }
  
  /**
   * Get repository by table name (for dynamic access)
   */
  getRepository(tableName: string): BaseServerRepository<any> | undefined {
    return this.repositoryMap.get(tableName);
  }

  /**
   * Get repository for table with cursor-based pagination support
   * Used by initial sync to efficiently stream table data
   */
  async getTableDataInChunks(
    tableName: string,
    options: {
      chunkSize: number;
      onChunk: (records: any[], chunkNumber: number, totalProcessed: number) => Promise<void>;
    }
  ): Promise<number> {
    const repository = this.getRepository(tableName);
    if (!repository) {
      throw new Error(`No repository found for table: ${tableName}`);
    }
    
    return await repository.getAllInChunks(options);
  }
  
  /**
   * Get repository by entity class (type-safe access)
   */
  getRepositoryForEntity<T extends { id: string; updated_at?: Date | string }>(
    entityClass: EntityTarget<T>
  ): BaseServerRepository<T> | undefined {
    if (entityClass === ProjectClass) {
      return this.projects as unknown as BaseServerRepository<T>;
    } else if (entityClass === TaskClass) {
      return this.tasks as unknown as BaseServerRepository<T>;
    } else if (entityClass === UserClass) {
      return this.users as unknown as BaseServerRepository<T>;
    } else if (entityClass === CommentClass) {
      return this.comments as unknown as BaseServerRepository<T>;
    } else if (entityClass === ChangeHistoryClass) {
      return this.changeHistory as unknown as BaseServerRepository<T>;
    } else if (entityClass === StatusSetClass) {
      return this.statusSets as unknown as BaseServerRepository<T>;
    } else if (entityClass === StatusDefinitionClass) {
      return this.statusDefinitions as unknown as BaseServerRepository<T>;
    } else if (entityClass === TagSetClass) {
      return this.tagSets as unknown as BaseServerRepository<T>;
    } else if (entityClass === TagClass) {
      return this.tags as unknown as BaseServerRepository<T>;
    } else if (entityClass === EntityDependencyClass) {
      return this.entityDependencies as unknown as BaseServerRepository<T>;
    }
    return undefined;
  }
  
  /**
   * Get repository for table name with proper typing
   */
  getTypedRepository<T extends { id: string; updated_at?: Date | string }>(
    tableName: string
  ): BaseServerRepository<T> | undefined {
    const repo = this.repositoryMap.get(tableName);
    return repo as BaseServerRepository<T> | undefined;
  }

  /**
   * Initialize all repositories (useful for setup/testing)
   */
  async initialize(): Promise<void> {
    // Any initialization logic can go here
    // For now, repositories are ready upon construction
  }

  /**
   * Health check for all repositories
   */
  async healthCheck(): Promise<{
    projects: boolean;
    tasks: boolean;
    users: boolean;
    comments: boolean;
    changeHistory: boolean;
    statusSets: boolean;
    statusDefinitions: boolean;
    tagSets: boolean;
    tags: boolean;
    entityDependencies: boolean;
    overall: boolean;
  }> {
    try {
      // Simple existence check for each repository
      const projectsHealthy = !!this.projects;
      const tasksHealthy = !!this.tasks;
      const usersHealthy = !!this.users;
      const commentsHealthy = !!this.comments;
      const changeHistoryHealthy = !!this.changeHistory;
      const statusSetsHealthy = !!this.statusSets;
      const statusDefinitionsHealthy = !!this.statusDefinitions;
      const tagSetsHealthy = !!this.tagSets;
      const tagsHealthy = !!this.tags;
      const entityDependenciesHealthy = !!this.entityDependencies;
      
      const overall = projectsHealthy && tasksHealthy && usersHealthy && commentsHealthy && 
                     changeHistoryHealthy && statusSetsHealthy && statusDefinitionsHealthy && 
                     tagSetsHealthy && tagsHealthy && entityDependenciesHealthy;
      
      return {
        projects: projectsHealthy,
        tasks: tasksHealthy,
        users: usersHealthy,
        comments: commentsHealthy,
        changeHistory: changeHistoryHealthy,
        statusSets: statusSetsHealthy,
        statusDefinitions: statusDefinitionsHealthy,
        tagSets: tagSetsHealthy,
        tags: tagsHealthy,
        entityDependencies: entityDependenciesHealthy,
        overall
      };
    } catch (error) {
      return {
        projects: false,
        tasks: false,
        users: false,
        comments: false,
        changeHistory: false,
        statusSets: false,
        statusDefinitions: false,
        tagSets: false,
        tags: false,
        entityDependencies: false,
        overall: false
      };
    }
  }
} 