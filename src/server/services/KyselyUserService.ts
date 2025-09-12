/**
 * Kysely-based User Service
 * Handles user operations including deletion with relationship cleanup
 * Note: Better Auth uses Kysely, not Drizzle directly
 */

import { sql } from 'kysely';
import type { Context } from 'hono';
import type { AuthType } from '../lib/auth';
import { dbLogger } from '../middleware/logger';
import { getAuth } from '../lib/auth';
import { RelationshipQueryService } from './RelationshipQueryService';

export interface DeletionResult {
  blockers: Array<{
    entity: string;
    field: string;
    reason: string;
  }>;
  operations: Array<{
    type: string;
    entity: string;
    action: string;
    count?: number;
  }>;
}

export class KyselyUserService {
  private db: any; // Kysely database instance
  private c: Context<AuthType>;
  private relationshipService: RelationshipQueryService;

  constructor(c: Context<AuthType>) {
    this.c = c;
    const authInstance = getAuth(c);
    this.db = authInstance.options.database.db;
    this.relationshipService = new RelationshipQueryService(this.db);
  }

  /**
   * Delete a user with relationship cleanup
   * Handles all related entities and transfers ownership when needed
   */
  async deleteWithRelationships(
    userId: string,
    options: {
      transferProjectsTo?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<DeletionResult> {
    const result: DeletionResult = {
      blockers: [],
      operations: []
    };

    try {
      // 1. Check if user exists
      const user = await this.db
        .selectFrom('users')
        .where('id', '=', userId)
        .selectAll()
        .executeTakeFirst();

      if (!user) {
        result.blockers.push({
          entity: 'users',
          field: 'id',
          reason: 'User not found'
        });
        return result;
      }

      // 2. Check for owned projects
      const ownedProjects = await this.db
        .selectFrom('projects')
        .where('owner_id', '=', userId)
        .select(['id', 'name'])
        .execute();

      if (ownedProjects.length > 0) {
        if (!options.transferProjectsTo) {
          result.blockers.push({
            entity: 'projects',
            field: 'owner_id',
            reason: `User owns ${ownedProjects.length} projects that must be transferred`
          });
        } else {
          // Verify transfer target exists and is admin
          const transferTarget = await this.db
            .selectFrom('users')
            .where('id', '=', options.transferProjectsTo)
            .where('role', 'in', ['admin', 'super_admin'])
            .selectAll()
            .executeTakeFirst();

          if (!transferTarget) {
            result.blockers.push({
              entity: 'users',
              field: 'id',
              reason: 'Transfer target user not found or not an admin'
            });
          } else {
            result.operations.push({
              type: 'transfer',
              entity: 'projects',
              action: `Transfer ${ownedProjects.length} projects to ${transferTarget.email}`,
              count: ownedProjects.length
            });
          }
        }
      }

      // If blockers exist, return early
      if (result.blockers.length > 0) {
        return result;
      }

      // If dry run, return the plan without executing
      if (options.dryRun) {
        // Plan the operations
        
        // Tasks assigned to user - using relationship table
        // TODO: Get organization ID from user context
        const orgId = user.organization_id || this.c.env.DEFAULT_ORG_ID;
        const assignedTaskCount = await this.relationshipService.getAssignedTaskCount(orgId, userId);
        
        if (assignedTaskCount > 0) {
          result.operations.push({
            type: 'update',
            entity: 'tasks',
            action: 'Clear assignee relationships',
            count: assignedTaskCount
          });
        }

        // Comments by user
        const userComments = await this.db
          .selectFrom('comments')
          .where('author_id', '=', userId)
          .select(sql`count(*)::int as count`)
          .executeTakeFirst();
        
        if (userComments?.count > 0) {
          result.operations.push({
            type: 'update',
            entity: 'comments',
            action: 'Clear author',
            count: userComments.count
          });
        }

        // Project memberships
        const memberships = await this.db
          .selectFrom('project_members')
          .where('user_id', '=', userId)
          .select(sql`count(*)::int as count`)
          .executeTakeFirst();
        
        if (memberships?.count > 0) {
          result.operations.push({
            type: 'delete',
            entity: 'project_members',
            action: 'Remove memberships',
            count: memberships.count
          });
        }

        // Auth-related data
        result.operations.push(
          { type: 'delete', entity: 'sessions', action: 'Delete sessions' },
          { type: 'delete', entity: 'accounts', action: 'Delete accounts' },
          { type: 'delete', entity: 'verifications', action: 'Delete verifications' },
          { type: 'delete', entity: 'users', action: 'Delete user record' }
        );

        return result;
      }

      // Execute the deletion plan
      dbLogger.info('Starting user deletion with relationship cleanup', { userId, userEmail: user.email });

      // Start transaction for atomic deletion
      await this.db.transaction().execute(async (trx: any) => {
        // 1. Transfer project ownership relationships if needed
        const orgId = user.organization_id || this.c.env.DEFAULT_ORG_ID;
        if (ownedProjects.length > 0 && options.transferProjectsTo) {
          const relationshipService = new RelationshipQueryService(trx);
          await relationshipService.transferOwnership(orgId, userId, options.transferProjectsTo, 'Project');
          
          dbLogger.debug('Transferred project ownership relationships', { 
            count: ownedProjects.length, 
            to: options.transferProjectsTo 
          });
        }

        // 2. Clear all user relationships (tasks, assignments, etc.)
        const relationshipService = new RelationshipQueryService(trx);
        const clearedRelationships = await relationshipService.removeUserRelationships(orgId, userId);
        
        if (clearedRelationships > 0) {
          dbLogger.debug('Cleared user relationships', { count: clearedRelationships });
        }

        // 3. Clear comment authors
        const commentResult = await trx
          .updateTable('comments')
          .set({ 
            author_id: null,
            updated_at: new Date()
          })
          .where('author_id', '=', userId)
          .execute();
        
        if (commentResult.numUpdatedRows > 0) {
          dbLogger.debug('Cleared comment authors', { count: commentResult.numUpdatedRows });
        }

        // 4. Delete project memberships
        await trx
          .deleteFrom('project_members')
          .where('user_id', '=', userId)
          .execute();

        // 5. Delete auth-related data
        await trx
          .deleteFrom('sessions')
          .where('user_id', '=', userId)
          .execute();

        await trx
          .deleteFrom('accounts')
          .where('user_id', '=', userId)
          .execute();

        await trx
          .deleteFrom('verifications')
          .where('identifier', '=', user.email)
          .execute();

        // 6. Finally, delete the user
        await trx
          .deleteFrom('users')
          .where('id', '=', userId)
          .execute();

        dbLogger.info('User deleted successfully with relationship cleanup', { 
          userId, 
          userEmail: user.email 
        });

        // Populate actual operations executed
        result.operations = [
          { type: 'delete', entity: 'users', action: 'User deleted' }
        ];
        
        if (ownedProjects.length > 0 && options.transferProjectsTo) {
          result.operations.unshift({
            type: 'transfer',
            entity: 'projects',
            action: 'Projects transferred',
            count: ownedProjects.length
          });
        }
      });

      return result;

    } catch (error) {
      dbLogger.error('Failed to delete user with relationships', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Find admins for project ownership transfer
   */
  async findAdminForTransfer(excludeUserId: string): Promise<any | null> {
    return await this.db
      .selectFrom('users')
      .where('role', 'in', ['admin', 'super_admin'])
      .where('id', '!=', excludeUserId)
      .selectAll()
      .executeTakeFirst();
  }
}