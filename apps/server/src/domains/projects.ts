import { Client } from '@neondatabase/serverless';
import { Project, ProjectStatus } from "@repo/dataforge/server-entities";
import { validate } from "class-validator";
import { FindOptionsWhere, DeepPartial, In } from 'typeorm';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { User } from "@repo/dataforge/server-entities";
import { BaseServerRepository } from './BaseServerRepository';

// Re-export enums for convenience
export { ProjectStatus };

// Simplified type definitions
type ProjectInstance = Project;

// Input types for API
export type ProjectCreateInput = Partial<Omit<ProjectInstance, 'id' | 'created_at' | 'updated_at'>>;
export type ProjectUpdateInput = Partial<ProjectCreateInput>;

/**
 * ProjectRepository class that extends BaseServerRepository
 */
export class ProjectRepository extends BaseServerRepository<Project> {
  
  constructor(neonService: NeonService) {
    super(neonService, Project);
  }

  /**
   * Find projects by owner ID
   */
  async findByOwnerId(ownerId: string): Promise<Project[]> {
    return await this.neonService.find(Project, { ownerId } as FindOptionsWhere<Project>);
  }

  /**
   * Find projects by status
   */
  async findByStatus(status: ProjectStatus): Promise<Project[]> {
    return await this.neonService.find(Project, { status } as FindOptionsWhere<Project>);
  }

  /**
   * Create a new project with defaults
   */
  async create(data: ProjectCreateInput): Promise<Project> {
    // Set default values if not provided
    const projectData = {
      ...data,
      status: data.status || ProjectStatus.ACTIVE
    };
    
    // Use parent class create method (handles validation)
    return await super.create(projectData as DeepPartial<Project>);
  }

  /**
   * Get project members using TypeORM relations via query builder
   */
  async getMembers(projectId: string): Promise<User[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(User, 'u');
    return await queryBuilder
      .innerJoin('project_members', 'pm', 'u.id = pm.user_id')
      .where('pm.project_id = :projectId', { projectId })
      .getMany();
  }

  /**
   * Update project members using TypeORM query builders
   */
  async updateMembers(projectId: string, userIds: string[]): Promise<User[]> {
    // Check if project exists
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Validate that all users exist
    if (userIds.length > 0) {
      const existingUsers = await this.neonService.find(User, {
        id: In(userIds)
      } as FindOptionsWhere<User>);
      
      if (existingUsers.length !== userIds.length) {
        throw new Error('One or more user IDs are invalid');
      }
    }

    // Remove all existing members using TypeORM query builder
    const deleteBuilder = await this.neonService.createQueryBuilder(User, 'pm');
    await deleteBuilder
      .delete()
      .from('project_members')
      .where('project_id = :projectId', { projectId })
      .execute();
    
    // Add new members using TypeORM query builder
    if (userIds.length > 0) {
      const insertBuilder = await this.neonService.createQueryBuilder(User, 'pm');
      const memberValues = userIds.map(userId => ({ project_id: projectId, user_id: userId }));
      
      await insertBuilder
        .insert()
        .into('project_members')
        .values(memberValues)
        .execute();
    }

    // Return the updated members
    return await this.getMembers(projectId);
  }

  /**
   * Add a single member to project using TypeORM query builder
   */
  async addMember(projectId: string, userId: string): Promise<User[]> {
    // Check if project exists
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Check if user exists
    const user = await this.neonService.findOne(User, { id: userId } as FindOptionsWhere<User>);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Add member using TypeORM query builder with ON CONFLICT handling
    const insertBuilder = await this.neonService.createQueryBuilder(User, 'pm');
    await insertBuilder
      .insert()
      .into('project_members')
      .values({ project_id: projectId, user_id: userId })
      .orIgnore() // ON CONFLICT DO NOTHING equivalent
      .execute();

    return await this.getMembers(projectId);
  }

  /**
   * Remove a single member from project using TypeORM query builder
   */
  async removeMember(projectId: string, userId: string): Promise<User[]> {
    // Check if project exists
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Remove member using TypeORM query builder
    const deleteBuilder = await this.neonService.createQueryBuilder(User, 'pm');
    await deleteBuilder
      .delete()
      .from('project_members')
      .where('project_id = :projectId AND user_id = :userId', { projectId, userId })
      .execute();

    return await this.getMembers(projectId);
  }
}

// Helper to create a NeonService instance from a Neon client
const createServiceFromClient = (client: Client): NeonService => {
  // Create a minimal mock of Hono context with the client
  // First cast to unknown to avoid strict type checking errors
  const context = {
    req: { neon: client },
    env: { DATABASE_URL: "neon-client://internal" },
    // Add minimal implementations of required methods/properties
    finalized: false,
    error: null,
    get executionCtx() { return null; },
    get event() { return null; },
    // Add Variables property to match AppBindings
    var: {} // Mock variables object
  } as unknown as Context<{ Bindings: Env; Variables: any }>;
  
  return new NeonService(context);
};

// Legacy compatibility layer - maps the class-based repository to the old interface
export const projectQueries = {
  findAll: async (client: Client): Promise<ProjectInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.findAll();
  },

  findById: async (client: Client, id: string): Promise<ProjectInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.findById(id);
  },

  findByOwnerId: async (client: Client, ownerId: string): Promise<ProjectInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.findByOwnerId(ownerId);
  },

  create: async (client: Client, data: ProjectCreateInput): Promise<ProjectInstance> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.create(data);
  },

  update: async (client: Client, id: string, data: ProjectUpdateInput): Promise<ProjectInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.update(id, data);
  },

  delete: async (client: Client, id: string): Promise<boolean> => {
    const neonService = createServiceFromClient(client);
    const repo = new ProjectRepository(neonService);
    return await repo.delete(id);
  }
}; 