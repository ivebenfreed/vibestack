#!/bin/bash

echo "=== Comprehensive Server Type Fixes ==="
echo

cd apps/server/src

# Fix bootstrap.ts duplicate imports
echo "Fixing bootstrap.ts..."
sed -i '3d' api/bootstrap.ts  # Remove duplicate line

# Fix Comment issues in comments.ts domain
echo "Fixing domains/comments.ts..."
cat > domains/comments.ts << 'EOF'
// Comment repository and domain functions
import { Comment as _Comment } from "@repo/dataforge/server-entities";
import { BaseServerRepository } from "./BaseServerRepository.js";
import { NeonService } from '../lib/neon-orm/neon-service.js';

// Re-export the Comment type
export { _Comment as Comment };
export type Comment = _Comment;

/**
 * Comment repository with server-specific query methods.
 * Handles comment operations including task and project associations.
 */
export class CommentRepository extends BaseServerRepository<_Comment> {
  constructor(neonService: NeonService) {
    super(neonService, _Comment as any);
  }

  /**
   * Find all comments for a specific task.
   * @param taskId - The ID of the task to find comments for
   * @returns Array of comments associated with the task
   */
  async findByTaskId(taskId: string): Promise<_Comment[]> {
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
  async findByProjectId(projectId: string): Promise<_Comment[]> {
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
  async findReplies(parentId: string): Promise<_Comment[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'comment');
    const replies = await queryBuilder
      .where('comment.parentId = :parentId', { parentId })
      .orderBy('comment.createdAt', 'ASC')
      .getMany();

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
  async createComment(commentData: Partial<_Comment>): Promise<_Comment> {
    return await this.create(commentData);
  }

  /**
   * Update an existing comment.
   * @param commentId - The ID of the comment to update
   * @param updates - The updates to apply
   * @returns The updated comment
   */
  async updateComment(commentId: string, updates: Partial<_Comment>): Promise<_Comment | null> {
    await this.update(commentId, updates);
    return await this.findById(commentId);
  }

  /**
   * Find a comment with its author information.
   * @param commentId - The ID of the comment
   * @returns The comment with author relation loaded
   */
  async findWithAuthor(commentId: string): Promise<_Comment | null> {
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
EOF

# Fix type alias issues in domain files
echo "Adding type aliases to domain files..."

# Fix ChangeHistoryRepository
sed -i '1i // Type alias to avoid TypeScript confusion\ntype ChangeHistoryClass = typeof import("@repo/dataforge/server-entities").ChangeHistory;' domains/ChangeHistoryRepository.ts
sed -i 's/import { ChangeHistory }/import { type ChangeHistory, ChangeHistory as _ChangeHistory }/g' domains/ChangeHistoryRepository.ts
sed -i 's/extends BaseServerRepository<ChangeHistory>/extends BaseServerRepository<ChangeHistory>/g' domains/ChangeHistoryRepository.ts
sed -i 's/super(neonService, ChangeHistory/super(neonService, _ChangeHistory/g' domains/ChangeHistoryRepository.ts

# Fix entity-dependencies.ts
echo "Fixing entity-dependencies.ts..."
sed -i 's/import type { EntityDependency }/import { type EntityDependency, EntityDependency as EntityDependencyClass }/g' domains/entity-dependencies.ts
sed -i 's/createQueryBuilder(EntityDependency/createQueryBuilder(EntityDependencyClass/g' domains/entity-dependencies.ts
sed -i 's/save(EntityDependency/save(EntityDependencyClass/g' domains/entity-dependencies.ts
sed -i 's/delete(EntityDependency/delete(EntityDependencyClass/g' domains/entity-dependencies.ts

# Fix projects.ts
echo "Fixing projects.ts..."
sed -i 's/import type { Project, User }/import { type Project, Project as ProjectClass, type User, User as UserClass, type ProjectStatus, ProjectStatus }/g' domains/projects.ts
sed -i 's/createQueryBuilder(Project/createQueryBuilder(ProjectClass/g' domains/projects.ts
sed -i 's/createQueryBuilder(User/createQueryBuilder(UserClass/g' domains/projects.ts
sed -i 's/save(Project/save(ProjectClass/g' domains/projects.ts
sed -i 's/save(User/save(UserClass/g' domains/projects.ts

# Fix tasks.ts
echo "Fixing tasks.ts..."
sed -i 's/import type { Task }/import { type Task, Task as TaskClass, type TaskStatus, TaskStatus, type TaskPriority, TaskPriority }/g' domains/tasks.ts
sed -i 's/createQueryBuilder(Task/createQueryBuilder(TaskClass/g' domains/tasks.ts
sed -i 's/save(Task/save(TaskClass/g' domains/tasks.ts
sed -i 's/\.getRepository(Task)/\.getRepository(TaskClass)/g' domains/tasks.ts

# Fix users.ts
echo "Fixing users.ts..."
sed -i 's/import type { User }/import { type User, User as UserClass, type UserRole, UserRole }/g' domains/users.ts
sed -i 's/createQueryBuilder(User/createQueryBuilder(UserClass/g' domains/users.ts
sed -i 's/save(User/save(UserClass/g' domains/users.ts

# Fix StatusDefinition imports
echo "Fixing status-definitions.ts..."
sed -i 's/import { StatusDefinition }/import { type StatusDefinition, StatusDefinition as StatusDefinitionClass }/g' domains/status-definitions.ts
sed -i 's/extends BaseServerRepository<StatusDefinition>/extends BaseServerRepository<StatusDefinition>/g' domains/status-definitions.ts
sed -i 's/super(neonService, StatusDefinition/super(neonService, StatusDefinitionClass/g' domains/status-definitions.ts

# Fix StatusSet imports
echo "Fixing status-sets.ts..."
sed -i 's/import { StatusSet }/import { type StatusSet, StatusSet as StatusSetClass }/g' domains/status-sets.ts
sed -i 's/extends BaseServerRepository<StatusSet>/extends BaseServerRepository<StatusSet>/g' domains/status-sets.ts
sed -i 's/super(neonService, StatusSet/super(neonService, StatusSetClass/g' domains/status-sets.ts

# Fix TagSet imports
echo "Fixing tag-sets.ts..."
sed -i 's/import { TagSet }/import { type TagSet, TagSet as TagSetClass }/g' domains/tag-sets.ts
sed -i 's/extends BaseServerRepository<TagSet>/extends BaseServerRepository<TagSet>/g' domains/tag-sets.ts
sed -i 's/super(neonService, TagSet/super(neonService, TagSetClass/g' domains/tag-sets.ts

# Fix Tag imports
echo "Fixing tags.ts..."
sed -i 's/import { Tag }/import { type Tag, Tag as TagClass }/g' domains/tags.ts
sed -i 's/extends BaseServerRepository<Tag>/extends BaseServerRepository<Tag>/g' domains/tags.ts
sed -i 's/super(neonService, Tag/super(neonService, TagClass/g' domains/tags.ts

# Remove duplicate type declarations
echo "Removing duplicate type declarations..."
for file in domains/*.ts; do
  if [ -f "$file" ]; then
    # Remove duplicate type alias declarations
    sed -i '/^type .*Instance = .*;$/d' "$file" 2>/dev/null || true
  fi
done

cd ../../..

echo
echo "Comprehensive server fixes complete!"