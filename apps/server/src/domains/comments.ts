// Comment repository and domain functions
import { Comment as _Comment } from "@repo/dataforge/server-entities";
import type { Comment as _CommentType } from "@repo/dataforge/server-entities";
import { BaseServerRepository } from "./BaseServerRepository.js";
import { NeonService } from '../lib/neon-orm/neon-service.js';

// Re-export the Comment type
export { _Comment as Comment };

/**
 * Comment repository with server-specific query methods.
 * Handles comment operations including task and project associations.
 */
export class CommentRepository extends BaseServerRepository<_CommentType> {
  constructor(neonService: NeonService) {
    super(neonService, _Comment as any);
  }

  /**
   * Find all comments for a specific task.
   * @param taskId - The ID of the task to find comments for
   * @returns Array of comments associated with the task
   */
  async findByTaskId(taskId: string): Promise<_CommentType[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    return await queryBuilder
      .where('comment.taskId = :taskId', { taskId })
      .orderBy('comment.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find all comments for a specific project.
   * @param projectId - The ID of the project to find comments for
   * @returns Array of comments associated with the project
   */
  async findByProjectId(projectId: string): Promise<_CommentType[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    return await queryBuilder
      .where('comment.projectId = :projectId', { projectId })
      .orderBy('comment.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find replies to a specific comment.
   * @param parentId - The ID of the parent comment
   * @returns Array of reply comments
   */
  async findReplies(parentId: string): Promise<_CommentType[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    const replies = await queryBuilder
      .where('comment.parentId = :parentId', { parentId })
      .orderBy('comment.createdAt', 'ASC')
      .getMany();

    // Recursively find replies to replies
    const allReplies: _CommentType[] = [];
    for (const reply of replies) {
      allReplies.push(reply);
      const subReplies = await this.findReplies(reply.id);
      allReplies.push(...subReplies);
    }

    return allReplies;
  }

  /**
   * Delete a comment and all its replies.
   * @param commentId - The ID of the comment to delete
   * @returns Number of comments deleted
   */
  async deleteWithReplies(commentId: string): Promise<number> {
    const replies = await this.findReplies(commentId);
    const idsToDelete = [commentId, ...replies.map(r => r.id)];
    
    // Use NeonService to delete multiple entities
    let deleted = 0;
    for (const id of idsToDelete) {
      const result = await this.neonService.delete(this.entityClass, { id });
      if (result) deleted++;
    }
    return deleted;
  }

  /**
   * Create a new comment.
   * @param commentData - The comment data
   * @returns The created comment
   */
  async createComment(commentData: Partial<_CommentType>): Promise<_CommentType> {
    return await this.create(commentData);
  }

  /**
   * Update an existing comment.
   * @param commentId - The ID of the comment to update
   * @param updates - The updates to apply
   * @returns The updated comment
   */
  async updateComment(commentId: string, updates: Partial<_CommentType>): Promise<_CommentType | null> {
    await this.update(commentId, updates);
    return await this.findById(commentId);
  }

  /**
   * Find a comment with its author information.
   * @param commentId - The ID of the comment
   * @returns The comment with author relation loaded
   */
  async findWithAuthor(commentId: string): Promise<_CommentType | null> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    return await queryBuilder
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.id = :commentId', { commentId })
      .getOne();
  }

  /**
   * Count comments for a specific entity.
   * @param entityType - Type of entity ('task' or 'project')
   * @param entityId - The ID of the entity
   * @returns The count of comments
   */
  async countByEntity(entityType: 'task' | 'project', entityId: string): Promise<number> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    
    if (entityType === 'task') {
      queryBuilder.where('comment.taskId = :entityId', { entityId });
    } else {
      queryBuilder.where('comment.projectId = :entityId', { entityId });
    }
    
    return await queryBuilder.getCount();
  }
}
