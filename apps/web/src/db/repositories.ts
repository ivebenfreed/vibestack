import { DeepPartial, EntityTarget, ObjectLiteral, Repository, FindOptionsWhere } from 'typeorm';
import { User, Project, Task, Comment } from '@repo/dataforge/client-entities';
import { getNewPGliteDataSource } from './newtypeorm/NewDataSource';
import { RelationshipChangeEncoder } from './relationship-change-encoder';
import { SyncManager } from '../sync/SyncManager';

/**
 * Base repository with common CRUD operations
 */
class BaseRepository<T extends ObjectLiteral> {
  constructor(
    protected repository: Repository<T>,
    protected entityName: string
  ) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as any });
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] Updating entity. ID: ${id}, Data:`,
      JSON.stringify(data, null, 2));
    
    try {
      const criteria = { id } as unknown as FindOptionsWhere<T>;
      const result = await this.repository.update(criteria, data as any);
      
      console.log(`[${this.entityName.toUpperCase()}_REPOSITORY] Update result:`,
        JSON.stringify(result, null, 2));
      
      return this.findById(id) as Promise<T>;
    } catch (error) {
      console.error(`[${this.entityName.toUpperCase()}_REPOSITORY] Error updating entity. ID: ${id}`);
      console.error(`[${this.entityName.toUpperCase()}_REPOSITORY] Error details:`,
        error instanceof Error ? { message: error.message, stack: error.stack } : String(error));
      
      // If it's a TypeORM error, try to extract more details
      if (error && typeof error === 'object' && 'name' in error && error.name === 'QueryFailedError') {
        const queryError = error as any; // TypeORM QueryFailedError
        console.error(`[${this.entityName.toUpperCase()}_REPOSITORY] SQL Error:`, {
          query: queryError.query,
          parameters: queryError.parameters,
          driverError: queryError.driverError
        });
      }
      
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== 0;
  }

  public getOrmRepository(): Repository<T> {
    return this.repository;
  }
}

/**
 * User repository
 */
export class UserRepository extends BaseRepository<User> {
  constructor(dataSource: Awaited<ReturnType<typeof getNewPGliteDataSource>>) {
    super(dataSource.getRepository(User), 'user');
  }

  // User-specific methods here
}

/**
 * Project repository
 */
export class ProjectRepository extends BaseRepository<Project> {
  constructor(dataSource: Awaited<ReturnType<typeof getNewPGliteDataSource>>) {
    super(dataSource.getRepository(Project), 'project');
  }

  // Project-specific methods here

  /**
   * Get project members
   */
  async getMembers(projectId: string): Promise<User[]> {
    const project = await this.repository.findOne({
      where: { id: projectId } as any,
      relations: ['members']
    });
    
    if (!project || !project.members) {
      return [];
    }

    // Handle both sync and async members (TypeORM Promise relations)
    if (project.members instanceof Promise) {
      return await project.members;
    }
    
    return project.members as User[];
  }

  /**
   * Update project members (replaces all members with new list)
   * Removed sync change emission - handled at service layer
   */
  async updateMembers(projectId: string, userIds: string[]): Promise<void> {
    const queryRunner = this.repository.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      // First, remove all existing members
      await queryRunner.query(
        'DELETE FROM project_members WHERE project_id = $1',
        [projectId]
      );
      
      // Then, add the new members
      if (userIds.length > 0) {
        const values = userIds.map((userId, index) => 
          `($${index * 2 + 1}, $${index * 2 + 2})`
        ).join(', ');
        
        const params = userIds.flatMap(userId => [projectId, userId]);
        
        await queryRunner.query(
          `INSERT INTO project_members (project_id, user_id) VALUES ${values}`,
          params
        );
      }
      
      await queryRunner.commitTransaction();
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Add a member to project
   */
  async addMember(projectId: string, userId: string): Promise<void> {
    await this.repository.manager.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [projectId, userId]
    );
  }

  /**
   * Remove a member from project
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.repository.manager.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
  }
}

/**
 * Task repository
 */
export class TaskRepository extends BaseRepository<Task> {
  constructor(dataSource: Awaited<ReturnType<typeof getNewPGliteDataSource>>) {
    super(dataSource.getRepository(Task), 'task');
  }

  async findByProject(projectId: string): Promise<Task[]> {
    return this.repository.find({ where: { projectId } as any });
  }

  async findByAssignee(assigneeId: string): Promise<Task[]> {
    return this.repository.find({ where: { assigneeId } as any });
  }
}

/**
 * Comment repository
 */
export class CommentRepository extends BaseRepository<Comment> {
  constructor(dataSource: Awaited<ReturnType<typeof getNewPGliteDataSource>>) {
    super(dataSource.getRepository(Comment), 'comment');
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return this.repository.find({ where: { taskId } as any });
  }
}

/**
 * Factory function to create all repositories
 */
export async function createRepositories() {
  const dataSource = await getNewPGliteDataSource();
  
  return {
    users: new UserRepository(dataSource),
    projects: new ProjectRepository(dataSource),
    tasks: new TaskRepository(dataSource),
    comments: new CommentRepository(dataSource)
  };
} 