#!/bin/bash

echo "=== Fixing Comment Type Conflicts in Server ==="
echo

cd apps/server/src

# Fix comments.ts - import _Comment from dataforge and export as Comment
echo "Fixing domains/comments.ts..."
cat > domains/comments.ts << 'EOF'
// Comment repository and domain functions
import { Comment as _Comment } from "@repo/dataforge/server-entities";
import { DataSource, Repository } from "typeorm";
import { BaseServerRepository } from "./BaseServerRepository.js";

// Re-export the Comment type
export { _Comment as Comment };

/**
 * Comment repository with server-specific query methods.
 * Handles comment operations including task and project associations.
 */
export class CommentRepository extends BaseServerRepository<_Comment> {
  constructor(dataSource: DataSource) {
    super(_Comment, dataSource);
  }

  /**
   * Find all comments for a specific task.
   * @param taskId - The ID of the task to find comments for
   * @returns Array of comments associated with the task
   */
  async findByTaskId(taskId: string): Promise<_Comment[]> {
    return this.repository.find({
      where: { taskId },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Find all comments for a specific project.
   * @param projectId - The ID of the project to find comments for
   * @returns Array of comments associated with the project
   */
  async findByProjectId(projectId: string): Promise<_Comment[]> {
    return this.repository.find({
      where: { projectId },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Find replies to a specific comment.
   * @param parentId - The ID of the parent comment
   * @returns Array of reply comments
   */
  async findReplies(parentId: string): Promise<_Comment[]> {
    const replies = await this.repository.find({
      where: { parentId },
      order: { createdAt: 'ASC' }
    });

    // Recursively find replies to replies
    const allReplies: _Comment[] = [];
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
    
    const result = await this.repository.delete(idsToDelete);
    return result.affected || 0;
  }

  /**
   * Create a new comment.
   * @param commentData - The comment data
   * @returns The created comment
   */
  async createComment(commentData: Partial<_Comment>): Promise<_Comment> {
    const comment = this.repository.create(commentData);
    return this.repository.save(comment);
  }

  /**
   * Update an existing comment.
   * @param commentId - The ID of the comment to update
   * @param updates - The updates to apply
   * @returns The updated comment
   */
  async updateComment(commentId: string, updates: Partial<_Comment>): Promise<_Comment | null> {
    await this.repository.update(commentId, updates);
    return this.repository.findOne({ where: { id: commentId } });
  }

  /**
   * Find a comment with its author information.
   * @param commentId - The ID of the comment
   * @returns The comment with author relation loaded
   */
  async findWithAuthor(commentId: string): Promise<_Comment | null> {
    return this.repository.findOne({
      where: { id: commentId },
      relations: ['author']
    });
  }

  /**
   * Count comments for a specific entity.
   * @param entityType - Type of entity ('task' or 'project')
   * @param entityId - The ID of the entity
   * @returns The count of comments
   */
  async countByEntity(entityType: 'task' | 'project', entityId: string): Promise<number> {
    const whereClause = entityType === 'task' 
      ? { taskId: entityId }
      : { projectId: entityId };
    
    return this.repository.count({ where: whereClause });
  }
}
EOF

# Fix api/comments.ts to use the re-exported Comment type
echo
echo "Fixing api/comments.ts..."
sed -i "s/import { Comment }/import { Comment }/g" api/comments.ts
sed -i "s/import { _Comment/import { Comment/g" api/comments.ts
sed -i "s/'_Comment'/'Comment'/g" api/comments.ts
sed -i "s/_Comment\[\]/Comment[]/g" api/comments.ts
sed -i "s/<_Comment>/<Comment>/g" api/comments.ts
sed -i "s/_CommentRepository/CommentRepository/g" api/comments.ts

# Fix RepositoryContainer.ts
echo
echo "Fixing RepositoryContainer.ts..."
# Update the import
sed -i "s/import { Comment }/import { Comment }/g" domains/RepositoryContainer.ts
# Remove the problematic getRepository(Comment) line since Comment is now just a type alias
sed -i "/getRepository(Comment)/d" domains/RepositoryContainer.ts

cd ../../..

echo
echo "Comment type conflict fixes complete!"