import { Hono } from 'hono';
import { commentsDomain } from '../domains/comments-drizzle.js';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all routes
app.use('*', requireAuth);

// GET /comments - Get all comments
app.get('/', async (c) => {
  try {
    const { taskId, projectId, authorId } = c.req.query();
    
    let comments;
    if (taskId) {
      comments = await commentsDomain.findByTask(taskId);
    } else if (projectId) {
      comments = await commentsDomain.findByProject(projectId);
    } else if (authorId) {
      comments = await commentsDomain.findByAuthor(authorId);
    } else {
      comments = await commentsDomain.findAll();
    }
    
    return c.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

// GET /comments/:id - Get comment by ID
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const comment = await commentsDomain.findWithRelations(id);
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    return c.json(comment);
  } catch (error) {
    console.error('Error fetching comment:', error);
    return c.json({ error: 'Failed to fetch comment' }, 500);
  }
});

// GET /comments/:id/replies - Get comment replies
app.get('/:id/replies', async (c) => {
  try {
    const { id } = c.req.param();
    const replies = await commentsDomain.findReplies(id);
    
    return c.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    return c.json({ error: 'Failed to fetch replies' }, 500);
  }
});

// POST /comments - Create new comment
app.post('/', async (c) => {
  try {
    const data = await c.req.json();
    const user = c.get('user');
    
    // Set the author to the current user if not provided
    const commentData = {
      ...data,
      authorId: data.authorId || user?.id
    };
    
    // System create - clears clientId
    const comment = await commentsDomain.systemCreate(commentData);
    
    return c.json(comment, 201);
  } catch (error) {
    console.error('Error creating comment:', error);
    return c.json({ error: 'Failed to create comment' }, 500);
  }
});

// PUT /comments/:id - Update comment
app.put('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await c.req.json();
    const user = c.get('user');
    
    // Check if user owns the comment
    const existing = await commentsDomain.findById(id);
    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    if (existing.authorId !== user?.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // System update - clears clientId
    const comment = await commentsDomain.systemUpdate(id, data);
    
    return c.json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    return c.json({ error: 'Failed to update comment' }, 500);
  }
});

// DELETE /comments/:id - Delete comment
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    
    // Check if user owns the comment
    const existing = await commentsDomain.findById(id);
    if (!existing) {
      return c.json({ error: 'Comment not found' }, 404);
    }
    
    if (existing.authorId !== user?.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    const success = await commentsDomain.delete(id);
    
    if (!success) {
      return c.json({ error: 'Failed to delete comment' }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Failed to delete comment' }, 500);
  }
});

// GET /comments/thread/:entityType/:entityId - Get comment thread for entity
app.get('/thread/:entityType/:entityId', async (c) => {
  try {
    const { entityType, entityId } = c.req.param();
    
    if (entityType !== 'task' && entityType !== 'project') {
      return c.json({ error: 'Invalid entity type' }, 400);
    }
    
    const comments = await commentsDomain.findRootComments(
      entityType as 'task' | 'project',
      entityId
    );
    
    return c.json(comments);
  } catch (error) {
    console.error('Error fetching comment thread:', error);
    return c.json({ error: 'Failed to fetch comment thread' }, 500);
  }
});

export default app;