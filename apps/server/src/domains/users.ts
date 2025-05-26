import { Client } from '@neondatabase/serverless';
import { User, UserRole } from "@repo/dataforge/server-entities";
import { validate } from "class-validator";
import { FindOptionsWhere, DeepPartial } from 'typeorm';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { BaseServerRepository } from './BaseServerRepository';

// Re-export enums for convenience
export { UserRole };

// Simplified type definitions
type UserInstance = User;

// Input types for API
export type UserCreateInput = Partial<Omit<UserInstance, 'id' | 'created_at' | 'updated_at'>>;
export type UserUpdateInput = Partial<UserCreateInput>;

/**
 * UserRepository class that extends BaseServerRepository
 */
export class UserRepository extends BaseServerRepository<User> {
  
  constructor(neonService: NeonService) {
    super(neonService, User);
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
    const queryBuilder = await this.neonService.createQueryBuilder(User, 'u');
    return await queryBuilder
      .innerJoin('project_members', 'pm', 'u.id = pm.user_id')
      .where('pm.project_id = :projectId', { projectId })
      .getMany();
  }

  /**
   * Create a new user with defaults
   */
  async create(data: UserCreateInput): Promise<User> {
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
  async delete(id: string): Promise<boolean> {
    // First delete project memberships using TypeORM query builder
    const deleteBuilder = await this.neonService.createQueryBuilder(User, 'pm');
    await deleteBuilder
      .delete()
      .from('project_members')
      .where('user_id = :userId', { userId: id })
      .execute();
    
    // Then delete the user using parent class method
    return await super.delete(id);
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
  findAll: async (client: Client): Promise<UserInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findAll();
  },

  findById: async (client: Client, id: string): Promise<UserInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findById(id);
  },

  create: async (client: Client, data: UserCreateInput): Promise<UserInstance> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.create(data);
  },

  update: async (client: Client, id: string, data: UserUpdateInput): Promise<UserInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.update(id, data);
  },

  delete: async (client: Client, id: string): Promise<boolean> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.delete(id);
  },

  findByEmail: async (client: Client, email: string): Promise<UserInstance | null> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findByEmail(email);
  },
  
  findProjectMembers: async (client: Client, projectId: string): Promise<UserInstance[]> => {
    const neonService = createServiceFromClient(client);
    const repo = new UserRepository(neonService);
    return await repo.findProjectMembers(projectId);
  }
}; 