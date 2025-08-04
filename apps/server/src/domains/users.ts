import { Client } from '@neondatabase/serverless';
import { User, User as UserClass, UserRole } from "@repo/dataforge/server-entities";
import { validate } from "class-validator";
import { FindOptionsWhere, DeepPartial } from 'typeorm';
import { NeonService } from '../lib/neon-orm/neon-service';
import { Context } from 'hono';
import { Env } from '../types/env';
import { BaseServerRepository } from './BaseServerRepository';
import { UniversalEntityDeleter, type DeletionPlan, type DeletionOptions } from '../lib/universal-entity-deleter';
import { getDeletionStrategy } from '../config/deletion-strategies';

// Re-export enums for convenience
export { UserRole };

// Simplified type definitions

// Input types for API
export type UserCreateInput = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
export type UserUpdateInput = Partial<UserCreateInput>;

/**
 * UserRepository class that extends BaseServerRepository
 */
export class UserRepository extends BaseServerRepository<User> {
  
  constructor(neonService: NeonService) {
    super(neonService, UserClass);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.neonService.findOne(User, { email } as FindOptionsWhere<User>);
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return await this.neonService.find(User, { role } as FindOptionsWhere<User>);
  }

  /**
   * Find project members
   */
  async findProjectMembers(projectId: string): Promise<User[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(UserClass, 'u');
    return await queryBuilder
      .innerJoin('project_members', 'pm', 'u.id = pm.user_id')
      .where('pm.project_id = :projectId', { projectId })
      .getMany();
  }

  /**
   * Create a new user with defaults
   */
  override async create(data: UserCreateInput): Promise<User> {
    // Set default values if not provided
    const userData = {
      ...data,
      role: data.role || UserRole.MEMBER,
      emailVerified: data.emailVerified !== undefined ? data.emailVerified : false
    };
    
    // Use parent class create method (handles validation)
    return await super.create(userData as DeepPartial<User>);
  }

  /**
   * Delete user with cleanup using TypeORM query builder
   */
  override async delete(id: string): Promise<boolean> {
    // First delete project memberships using TypeORM query builder
    const deleteBuilder = await this.neonService.createQueryBuilder(UserClass, 'pm');
    await deleteBuilder
      .delete()
      .from('project_members')
      .where('user_id = :userId', { userId: id })
      .execute();
    
    // Then delete the user using parent class method
    return await super.delete(id);
  }

  /**
   * Delete user with automatic relationship cleanup using UniversalEntityDeleter
   * This handles all domain relationships automatically via DataForge metadata
   */
  async deleteWithRelationships(
    userId: string,
    options: {
      transferProjectsTo?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<DeletionPlan> {
    const deleter = new UniversalEntityDeleter(this.neonService);

    // Get base deletion strategies for users
    const baseStrategies = getDeletionStrategy('users');
    
    // Apply transfer ownership logic if target is provided
    const customStrategies: Record<string, any> = {};
    if (options.transferProjectsTo) {
      // Override projects strategy to include transfer target
      customStrategies.projects = {
        ...baseStrategies.projects,
        transferTarget: options.transferProjectsTo
      };
    }

    const deletionOptions: DeletionOptions = {
      dryRun: options.dryRun,
      entityStrategies: { ...baseStrategies, ...customStrategies }
    };

    return await deleter.deleteEntity('users', userId, deletionOptions);
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
    get event() { return null; }
  } as unknown as Context<{ Bindings: Env; Variables: any }>;
  
  return new NeonService(context);
};

// Legacy compatibility layer - maps the class-based repository to the old interface
export const userQueries = {
  findAll: async (client: Client): Promise<User[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findAll();
  },

  findById: async (client: Client, id: string): Promise<User | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findById(id);
  },

  create: async (client: Client, data: UserCreateInput): Promise<User> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.create(data);
  },

  update: async (client: Client, id: string, data: UserUpdateInput): Promise<User | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.update(id, data);
  },

  delete: async (client: Client, id: string): Promise<boolean> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.delete(id);
  },

  findByEmail: async (client: Client, email: string): Promise<User | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findByEmail(email);
  },
  
  findProjectMembers: async (client: Client, projectId: string): Promise<User[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findProjectMembers(projectId);
  }
}; 