/**
 * Auth Context Middleware
 * 
 * Provides user authentication context for API requests
 */

import type { Context } from 'hono';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  org_id?: string;
}

/**
 * Get authenticated user from request context
 */
export async function getUserFromRequest(c: Context): Promise<AuthUser | null> {
  // For now, return a mock user for development
  // In production, this would validate JWT tokens or session cookies
  
  // Check for Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // JWT token validation would go here
    return {
      id: 'demo-user-id',
      email: 'demo@example.com',
      name: 'Demo User',
      org_id: '01920000-1000-7000-8000-000000000001' // Wide Corp test org
    };
  }
  
  // Check for session cookie (Better Auth integration)
  const sessionCookie = c.req.header('Cookie');
  if (sessionCookie?.includes('session=')) {
    // Session validation would go here
    return {
      id: 'demo-user-id',
      email: 'demo@example.com',
      name: 'Demo User',
      org_id: '01920000-1000-7000-8000-000000000001' // Wide Corp test org
    };
  }
  
  // For development, return demo user if no auth provided
  return {
    id: 'demo-user-id',
    email: 'demo@example.com',
    name: 'Demo User',
    org_id: '01920000-1000-7000-8000-000000000001' // Wide Corp test org
  };
}