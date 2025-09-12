/**
 * Relationship Query Service
 * 
 * Provides queries against the relationship table instead of direct column access.
 * This replaces legacy queries like assignee_id = userId with relationship table queries.
 */

import type { Kysely } from 'kysely';
import type { Database } from '@/server/db/schema';

export class RelationshipQueryService {
  constructor(private db: Kysely<Database>) {}

  /**
   * Get entities where user has a specific relationship
   */
  async getEntitiesByUserRelationship(
    orgId: string,
    userId: string,
    relationshipType: string,
    entityType?: string
  ): Promise<{ entity_type: string; entity_id: string }[]> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    let query = this.db
      .selectFrom(relationshipTable as any)
      .select(['target_entity_type as entity_type', 'target_entity_id as entity_id'])
      .where('source_entity_type', '=', 'User')
      .where('source_entity_id', '=', userId)
      .where('relationship_type', '=', relationshipType)
      .where('valid_until', 'is', null);

    if (entityType) {
      query = query.where('target_entity_type', '=', entityType);
    }

    return await query.execute();
  }

  /**
   * Count entities where user has a specific relationship
   */
  async countEntitiesByUserRelationship(
    orgId: string,
    userId: string,
    relationshipType: string,
    entityType?: string
  ): Promise<number> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    let query = this.db
      .selectFrom(relationshipTable as any)
      .select((eb) => eb.fn.count('id').as('count'))
      .where('source_entity_type', '=', 'User')
      .where('source_entity_id', '=', userId)
      .where('relationship_type', '=', relationshipType)
      .where('valid_until', 'is', null);

    if (entityType) {
      query = query.where('target_entity_type', '=', entityType);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  /**
   * Remove all relationships for a user (when deleting user)
   */
  async removeUserRelationships(
    orgId: string,
    userId: string
  ): Promise<number> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    const result = await this.db
      .updateTable(relationshipTable as any)
      .set({ 
        valid_until: new Date(),
        updated_at: new Date()
      })
      .where((eb) => eb.or([
        // User as source (user assigned to task)
        eb.and([
          eb('source_entity_type', '=', 'User'),
          eb('source_entity_id', '=', userId)
        ]),
        // User as target (task assigned to user) 
        eb.and([
          eb('target_entity_type', '=', 'User'),
          eb('target_entity_id', '=', userId)
        ])
      ]))
      .where('valid_until', 'is', null)
      .execute();

    return Number(result.numUpdatedRows || 0);
  }

  /**
   * Get count of assigned tasks (replaces assignee_id queries)
   */
  async getAssignedTaskCount(orgId: string, userId: string): Promise<number> {
    return await this.countEntitiesByUserRelationship(
      orgId, 
      userId, 
      'assigned_to', 
      'Task'
    );
  }

  /**
   * Get assigned tasks (replaces assignee_id queries)
   */
  async getAssignedTasks(orgId: string, userId: string): Promise<{ entity_type: string; entity_id: string }[]> {
    return await this.getEntitiesByUserRelationship(
      orgId,
      userId,
      'assigned_to',
      'Task'
    );
  }

  /**
   * Get owned projects (replaces owner_id queries)
   */
  async getOwnedProjects(orgId: string, userId: string): Promise<{ entity_type: string; entity_id: string }[]> {
    return await this.getEntitiesByUserRelationship(
      orgId,
      userId,
      'owned_by',
      'Project'
    );
  }

  /**
   * Transfer ownership relationships to another user
   */
  async transferOwnership(
    orgId: string,
    fromUserId: string,
    toUserId: string,
    entityType?: string
  ): Promise<number> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    let query = this.db
      .updateTable(relationshipTable as any)
      .set({ 
        target_entity_id: toUserId,
        updated_at: new Date()
      })
      .where('relationship_type', '=', 'owned_by')
      .where('target_entity_id', '=', fromUserId)
      .where('valid_until', 'is', null);

    if (entityType) {
      query = query.where('source_entity_type', '=', entityType);
    }

    const result = await query.execute();
    return Number(result.numUpdatedRows || 0);
  }
}