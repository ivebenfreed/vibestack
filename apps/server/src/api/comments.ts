import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import { Comment } from '../domains/comments';
import { CommentRepository } from '../domains/comments';

// Input types for API
export type CommentCreateInput = Partial<Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>>;
export type CommentUpdateInput = Partial<CommentCreateInput>;

// Create comments router
const comments = new Hono<ApiEnv>();

// List comments
comments.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const commentRepo = new CommentRepository(neonService);
    const { taskId, projectId, authorId } = c.req.query();
    
    let result: Comment[];
    
    // Use filters if provided
    if (taskId) {
      result = await commentRepo.findByTaskId(taskId as string);
    } else if (projectId) {
      result = await commentRepo.findByProjectId(projectId as string);
    } else {
      // No filters, return all comments
      result = await commentRepo.findAll();
    }
    
    // Filter by authorId if provided
    if (authorId && result.length > 0) {
      result = result.filter(comment => comment.authorId === authorId);
    }
    
    return c.json(createSuccessResponse(result));
  } catch (err) {
    console.error('Error listing comments:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Create comment
comments.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const commentRepo = new CommentRepository(neonService);
    
    const input = await c.req.json<CommentCreateInput>();
    const created = await commentRepo.createComment({
      ...input,
      authorId: user.id
    });
    
    return c.json(createSuccessResponse(created), 201);
  } catch (err) {
    console.error('Error creating comment:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Get comment by ID
comments.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  try {
    const neonService = new NeonService(c);
    const commentRepo = new CommentRepository(neonService);
    
    const commentId = c.req.param('id');
    const comment = await commentRepo.findById(commentId);
    
    if (!comment) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Comment not found'),
        404
      );
    }
    
    return c.json(createSuccessResponse(comment));
  } catch (err) {
    console.error('Error getting comment:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Update comment
comments.put('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const commentId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const commentRepo = new CommentRepository(neonService);
    
    // First check if comment exists and user owns it
    const existingComment = await commentRepo.findById(commentId);
    
    if (!existingComment) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Comment not found'),
        404
      );
    }
    
    if (existingComment.authorId !== user.id) {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Cannot edit comment you do not own'),
        403
      );
    }
    
    const input = await c.req.json<CommentUpdateInput>();
    const updated = await commentRepo.updateComment(commentId, input);
    
    if (!updated) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Comment not found after update'),
        404
      );
    }
    
    return c.json(createSuccessResponse(updated));
  } catch (err) {
    console.error('Error updating comment:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Delete comment
comments.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const commentId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const commentRepo = new CommentRepository(neonService);
    
    // First check if comment exists and user owns it
    const existingComment = await commentRepo.findById(commentId);
    
    if (!existingComment) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Comment not found'),
        404
      );
    }
    
    if (existingComment.authorId !== user.id) {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Cannot delete comment you do not own'),
        403
      );
    }
    
    // Delete comment and all its replies
    const deletedCount = await commentRepo.deleteWithReplies(commentId);
    
    return c.json(createSuccessResponse({
      message: `Deleted ${deletedCount} comment(s) successfully`
    }));
  } catch (err) {
    console.error('Error deleting comment:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

export default comments;