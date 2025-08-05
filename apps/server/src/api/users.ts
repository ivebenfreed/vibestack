import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import { UserRepository } from '../domains/users';
import { UserRole } from '@repo/dataforge/server-entities';
import type { User } from '@repo/dataforge/server-entities';

// Input types for API
export type UserCreateInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'ownedProjects' | 'memberProjects'>>;
export type UserUpdateInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'ownedProjects' | 'memberProjects'>>;

// Create users router
const users = new Hono<ApiEnv>();

// List users
users.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    const { role } = c.req.query();
    
    let result: User[];
    
    if (role && role !== 'all') {
      result = await userRepo.findByRole(role as UserRole);
    } else {
      result = await userRepo.findAll();
    }
    
    return c.json(createSuccessResponse(result));
  } catch (err) {
    console.error('Error listing users:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Create user
users.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    const input = await c.req.json<UserCreateInput>();
    const created = await userRepo.create(input);
    
    return c.json(createSuccessResponse(created), 201);
  } catch (err) {
    console.error('Error creating user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Get user by ID
users.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    const userId = c.req.param('id');
    const targetUser = await userRepo.findById(userId);
    
    if (!targetUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    return c.json(createSuccessResponse(targetUser));
  } catch (err) {
    console.error('Error getting user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Update user
users.put('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const userId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    // First check if user exists
    const existingUser = await userRepo.findById(userId);
    
    if (!existingUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    // Only allow users to update themselves or admins to update others
    if (userId !== user.id && user.role !== 'super_admin') {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Access denied'),
        403
      );
    }
    
    const input = await c.req.json<UserUpdateInput>();
    const updated = await userRepo.update(userId, input);
    
    if (!updated) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found after update'),
        404
      );
    }
    
    return c.json(createSuccessResponse(updated));
  } catch (err) {
    console.error('Error updating user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Delete user
users.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const userId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    // First check if user exists
    const existingUser = await userRepo.findById(userId);
    
    if (!existingUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    // Only super admins can delete users
    if (user.role !== 'super_admin') {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Only super admins can delete users'),
        403
      );
    }
    
    await userRepo.delete(userId);
    
    return c.json(createSuccessResponse({
      message: 'User deleted successfully'
    }));
  } catch (err) {
    console.error('Error deleting user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

export default users;
