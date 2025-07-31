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
  override async create(data: ProjectCreateInput): Promise<Project> {
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
   * Update project members using differential updates (only change what's different)
   * Much more efficient than DELETE ALL + INSERT ALL
   */
  async updateMembers(projectId: string, newUserIds: string[], skipValidation = false): Promise<User[]> {
    // Skip project existence check if already validated upstream
    if (!skipValidation) {
      const project = await this.findById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
    }

    // Validate that all new users exist (always needed for data integrity)
    if (newUserIds.length > 0) {
      const existingUsers = await this.neonService.find(User, {
        id: In(newUserIds)
      } as FindOptionsWhere<User>);
      
      if (existingUsers.length !== newUserIds.length) {
        throw new Error('One or more user IDs are invalid');
      }
    }

    // Get current members to calculate differences
    const currentMembers = await this.getMembers(projectId);
    const currentUserIds = new Set(currentMembers.map(m => m.id));
    const newUserIdSet = new Set(newUserIds);
    
    // Calculate what needs to be added and removed
    const toAdd = newUserIds.filter(id => !currentUserIds.has(id));
    const toRemove = Array.from(currentUserIds).filter(id => !newUserIdSet.has(id));
    
    // Early return if no changes needed
    if (toAdd.length === 0 && toRemove.length === 0) {
      console.log(`[ProjectRepository] No member changes needed for project ${projectId}`);
      return currentMembers;
    }

    console.log(`[ProjectRepository] Updating members for project ${projectId}:`, {
      currentCount: currentMembers.length,
      newCount: newUserIds.length,
      toAdd: toAdd.length,
      toRemove: toRemove.length,
      skipValidation
    });
    
    // Apply only the differences
    if (toRemove.length > 0) {
      // Use proper array parameter syntax for Neon driver
      const placeholders = toRemove.map((_, index) => `$${index + 2}`).join(', ');
      const deleteQuery = `DELETE FROM project_members WHERE project_id = $1 AND user_id IN (${placeholders})`;
      
      await this.neonService.query(deleteQuery, [projectId, ...toRemove]);
    }
    
    if (toAdd.length > 0) {
      // Use bulk insert with proper parameter handling
      if (toAdd.length === 1) {
        const insertQuery = `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
        await this.neonService.query(insertQuery, [projectId, toAdd[0]]);
      } else {
        // Multiple inserts - each row needs (project_id, user_id)
        const valuesClauses = toAdd.map((_, index) => {
          const offset = index * 2;
          return `($${offset + 1}, $${offset + 2})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO project_members (project_id, user_id) VALUES ${valuesClauses} ON CONFLICT DO NOTHING`;
        const params: string[] = [];
        toAdd.forEach(userId => params.push(projectId, userId));
        
        await this.neonService.query(insertQuery, params);
      }
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