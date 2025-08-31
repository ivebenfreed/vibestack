import { uuidv7 } from 'uuidv7';
import { dbLogger } from '../../middleware/logger';
import type { Env } from '../../types/env';

// Session TTL: 7 days in seconds
const SESSION_TTL = 7 * 24 * 60 * 60;
const SESSION_REFRESH_TTL = 30 * 24 * 60 * 60; // 30 days for refresh tokens

export interface SessionData {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  activeOrganizationId?: string;
  impersonatedBy?: string;
  metadata?: Record<string, any>;
}

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  activeOrganizationId?: string;
  impersonatedBy?: string;
  metadata?: Record<string, any>;
}

export class SessionKVService {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generate a cryptographically secure token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a new session in KV
   */
  async create(input: CreateSessionInput): Promise<SessionData> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);
    
    const session: SessionData = {
      id: uuidv7(),
      userId: input.userId,
      token: this.generateToken(),
      refreshToken: this.generateToken(),
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
      updatedAt: now,
      activeOrganizationId: input.activeOrganizationId,
      impersonatedBy: input.impersonatedBy,
      metadata: input.metadata
    };

    try {
      // Store session by token (primary lookup)
      await this.env.SESSIONS.put(
        `session:${session.token}`,
        JSON.stringify(session),
        { expirationTtl: SESSION_TTL }
      );

      // Store refresh token mapping
      if (session.refreshToken) {
        await this.env.SESSIONS.put(
          `refresh:${session.refreshToken}`,
          session.token,
          { expirationTtl: SESSION_REFRESH_TTL }
        );
      }

      // Store user->session index for listing user sessions
      await this.env.SESSIONS.put(
        `user_session:${input.userId}:${session.id}`,
        session.token,
        { expirationTtl: SESSION_TTL }
      );

      dbLogger.info('Session created in KV', {
        sessionId: session.id,
        userId: input.userId,
        expiresAt
      });

      return session;
    } catch (error) {
      dbLogger.error('Failed to create session in KV', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get session by token
   */
  async getByToken(token: string): Promise<SessionData | null> {
    try {
      const data = await this.env.SESSIONS.get(`session:${token}`);
      
      if (!data) {
        return null;
      }

      const session = JSON.parse(data) as SessionData;
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.delete(token);
        return null;
      }

      return session;
    } catch (error) {
      dbLogger.error('Failed to get session from KV', error);
      return null;
    }
  }

  /**
   * Get session by refresh token
   */
  async getByRefreshToken(refreshToken: string): Promise<SessionData | null> {
    try {
      const token = await this.env.SESSIONS.get(`refresh:${refreshToken}`);
      
      if (!token) {
        return null;
      }

      return this.getByToken(token);
    } catch (error) {
      dbLogger.error('Failed to get session by refresh token', error);
      return null;
    }
  }

  /**
   * Update session
   */
  async update(token: string, updates: Partial<SessionData>): Promise<SessionData | null> {
    try {
      const session = await this.getByToken(token);
      
      if (!session) {
        return null;
      }

      const updatedSession: SessionData = {
        ...session,
        ...updates,
        updatedAt: new Date()
      };

      // Calculate remaining TTL
      const remainingTtl = Math.max(
        0,
        Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
      );

      if (remainingTtl <= 0) {
        await this.delete(token);
        return null;
      }

      await this.env.SESSIONS.put(
        `session:${token}`,
        JSON.stringify(updatedSession),
        { expirationTtl: remainingTtl }
      );

      dbLogger.info('Session updated in KV', {
        sessionId: session.id,
        userId: session.userId
      });

      return updatedSession;
    } catch (error) {
      dbLogger.error('Failed to update session in KV', error);
      return null;
    }
  }

  /**
   * Extend session expiration
   */
  async extend(token: string): Promise<SessionData | null> {
    const session = await this.getByToken(token);
    
    if (!session) {
      return null;
    }

    const newExpiresAt = new Date(Date.now() + SESSION_TTL * 1000);
    
    return this.update(token, {
      expiresAt: newExpiresAt
    });
  }

  /**
   * Delete session
   */
  async delete(token: string): Promise<boolean> {
    try {
      const session = await this.getByToken(token);
      
      if (!session) {
        return false;
      }

      // Delete session
      await this.env.SESSIONS.delete(`session:${token}`);
      
      // Delete refresh token mapping
      if (session.refreshToken) {
        await this.env.SESSIONS.delete(`refresh:${session.refreshToken}`);
      }
      
      // Delete user session index
      await this.env.SESSIONS.delete(`user_session:${session.userId}:${session.id}`);

      dbLogger.info('Session deleted from KV', {
        sessionId: session.id,
        userId: session.userId
      });

      return true;
    } catch (error) {
      dbLogger.error('Failed to delete session from KV', error);
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    try {
      let deleted = 0;
      
      // List all user sessions using prefix
      const list = await this.env.SESSIONS.list({
        prefix: `user_session:${userId}:`
      });

      for (const key of list.keys) {
        const token = await this.env.SESSIONS.get(key.name);
        if (token) {
          await this.delete(token);
          deleted++;
        }
      }

      dbLogger.info('All user sessions deleted from KV', {
        userId,
        count: deleted
      });

      return deleted;
    } catch (error) {
      dbLogger.error('Failed to delete user sessions from KV', error);
      return 0;
    }
  }

  /**
   * List all sessions for a user
   */
  async listForUser(userId: string): Promise<SessionData[]> {
    try {
      const sessions: SessionData[] = [];
      
      // List all user sessions using prefix
      const list = await this.env.SESSIONS.list({
        prefix: `user_session:${userId}:`
      });

      for (const key of list.keys) {
        const token = await this.env.SESSIONS.get(key.name);
        if (token) {
          const session = await this.getByToken(token);
          if (session) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      dbLogger.error('Failed to list user sessions from KV', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions (called periodically)
   * Note: This is mostly unnecessary as KV TTL handles expiration
   * but useful for cleaning up orphaned index entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      let cleaned = 0;
      const now = new Date();
      
      // List all sessions
      const list = await this.env.SESSIONS.list({
        prefix: 'session:'
      });

      for (const key of list.keys) {
        const data = await this.env.SESSIONS.get(key.name);
        if (data) {
          const session = JSON.parse(data) as SessionData;
          if (new Date(session.expiresAt) < now) {
            const token = key.name.replace('session:', '');
            await this.delete(token);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        dbLogger.info('Expired sessions cleaned from KV', { count: cleaned });
      }

      return cleaned;
    } catch (error) {
      dbLogger.error('Failed to cleanup expired sessions', error);
      return 0;
    }
  }
}