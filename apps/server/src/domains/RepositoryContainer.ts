import { NeonService } from '../lib/neon-orm/neon-service';
import { ProjectRepository } from './projects';
import { TaskRepository } from './tasks';
import { UserRepository } from './users';
import { BaseServerRepository } from './BaseServerRepository';
import { EntityTarget } from 'typeorm';
import { Project, Task, User } from '@repo/dataforge/server-entities';

/**
 * Central repository container for managing all domain repositories
 * Provides type-safe access to repositories and handles NeonService integration
 */
export class RepositoryContainer {
  public readonly projects: ProjectRepository;
  public readonly tasks: TaskRepository;
  public readonly users: UserRepository;
  
  // Map for dynamic repository access - use any for mixed repository types
  private repositoryMap: Map<string, any>;
  
  constructor(private neonService: NeonService) {
    // Initialize all repositories
    this.projects = new ProjectRepository(neonService);
    this.tasks = new TaskRepository(neonService);
    this.users = new UserRepository(neonService);
    
    // Create repository map for dynamic access
    this.repositoryMap = new Map();
    this.repositoryMap.set('projects', this.projects);
    this.repositoryMap.set('tasks', this.tasks);
    this.repositoryMap.set('users', this.users);
  }
  
  /**
   * Get repository by table name (for dynamic access)
   */
  getRepository(tableName: string): BaseServerRepository<any> | undefined {
    return this.repositoryMap.get(tableName);
  }
  
  /**
   * Get repository by entity class (type-safe access)
   */
  getRepositoryForEntity<T extends { id: string; updated_at?: Date | string }>(
    entityClass: EntityTarget<T>
  ): BaseServerRepository<T> | undefined {
    if (entityClass === Project) {
      return this.projects as unknown as BaseServerRepository<T>;
    } else if (entityClass === Task) {
      return this.tasks as unknown as BaseServerRepository<T>;
    } else if (entityClass === User) {
      return this.users as unknown as BaseServerRepository<T>;
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
    overall: boolean;
  }> {
    try {
      // Simple existence check for each repository
      const projectsHealthy = !!this.projects;
      const tasksHealthy = !!this.tasks;
      const usersHealthy = !!this.users;
      
      const overall = projectsHealthy && tasksHealthy && usersHealthy;
      
      return {
        projects: projectsHealthy,
        tasks: tasksHealthy,
        users: usersHealthy,
        overall
      };
    } catch (error) {
      return {
        projects: false,
        tasks: false,
        users: false,
        overall: false
      };
    }
  }
} 