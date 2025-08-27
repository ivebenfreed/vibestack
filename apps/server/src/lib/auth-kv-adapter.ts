import { SessionKVService, type SessionData } from '../services/session/SessionKVService';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';
import { getKysely } from './kysely';
import { uuidv7 } from 'uuidv7';
import type { Adapter } from 'better-auth';

/**
 * Hybrid KV + PostgreSQL adapter for Better Auth
 * - Sessions stored in Cloudflare KV for performance
 * - User data remains in PostgreSQL for relational integrity
 */
export class BetterAuthKVAdapter implements Adapter {
  private sessionService: SessionKVService;
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
    this.sessionService = new SessionKVService(env);
  }

  async create(data: { 
    model: 'session' | 'user' | 'account' | 'verification'; 
    data: any;
  }): Promise<any> {
    const { model, data: inputData } = data;
    
    if (model === 'session') {
      // Create session in KV
      const session = await this.sessionService.create({
        userId: inputData.userId,
        ipAddress: inputData.ipAddress,
        userAgent: inputData.userAgent,
        activeOrganizationId: inputData.activeOrganizationId,
        impersonatedBy: inputData.impersonatedBy,
        metadata: {
          ...inputData
        }
      });

      return this.mapSessionToAdapter(session);
    }
    
    // For other models, use PostgreSQL via Kysely
    const db = getKysely(this.env);
    
    switch (model) {
      case 'user':
        const user = await db
          .insertInto('user')
          .values(inputData)
          .returningAll()
          .executeTakeFirst();
        return user;
        
      case 'account':
        const account = await db
          .insertInto('account')
          .values(inputData)
          .returningAll()
          .executeTakeFirst();
        return account;
        
      case 'verification':
        const verification = await db
          .insertInto('verification')
          .values(inputData)
          .returningAll()
          .executeTakeFirst();
        return verification;
        
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  async findOne(data: { 
    model: 'session' | 'user' | 'account' | 'verification'; 
    where: any;
  }): Promise<any | null> {
    const { model, where } = data;
    
    if (model === 'session') {
      // Find session in KV
      if (where.token) {
        const session = await this.sessionService.getByToken(where.token);
        return session ? this.mapSessionToAdapter(session) : null;
      }
      
      if (where.id) {
        // For ID lookups, we'd need to maintain an ID index
        // For now, this is not supported in KV
        dbLogger.warn('Session lookup by ID not supported in KV adapter');
        return null;
      }
    }
    
    // For other models, use PostgreSQL via Kysely
    const db = getKysely(this.env);
    
    switch (model) {
      case 'user':
        const user = await db
          .selectFrom('user')
          .selectAll()
          .where((eb) => {
            const conditions = [];
            if (where.id) conditions.push(eb('id', '=', where.id));
            if (where.email) conditions.push(eb('email', '=', where.email));
            return conditions.length > 0 ? eb.and(conditions) : eb.val(true);
          })
          .executeTakeFirst();
        return user || null;
        
      case 'account':
        const account = await db
          .selectFrom('account')
          .selectAll()
          .where((eb) => {
            const conditions = [];
            if (where.id) conditions.push(eb('id', '=', where.id));
            if (where.userId) conditions.push(eb('userId', '=', where.userId));
            if (where.providerId) conditions.push(eb('providerId', '=', where.providerId));
            return conditions.length > 0 ? eb.and(conditions) : eb.val(true);
          })
          .executeTakeFirst();
        return account || null;
        
      case 'verification':
        const verification = await db
          .selectFrom('verification')
          .selectAll()
          .where((eb) => {
            const conditions = [];
            if (where.id) conditions.push(eb('id', '=', where.id));
            if (where.token) conditions.push(eb('token', '=', where.token));
            if (where.identifier) conditions.push(eb('identifier', '=', where.identifier));
            return conditions.length > 0 ? eb.and(conditions) : eb.val(true);
          })
          .executeTakeFirst();
        return verification || null;
        
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  async findMany(data: {
    model: 'session' | 'user' | 'account' | 'verification';
    where?: any;
    limit?: number;
    offset?: number;
    orderBy?: any;
  }): Promise<any[]> {
    const { model, where = {}, limit, offset } = data;
    
    if (model === 'session') {
      // Find sessions in KV
      if (where.userId) {
        const sessions = await this.sessionService.listForUser(where.userId);
        return sessions.map(s => this.mapSessionToAdapter(s));
      }
      
      // General session listing not supported efficiently in KV
      dbLogger.warn('General session listing not supported in KV adapter');
      return [];
    }
    
    // For other models, use PostgreSQL via Kysely
    const db = getKysely(this.env);
    
    let query: any;
    
    switch (model) {
      case 'user':
        query = db.selectFrom('user').selectAll();
        break;
      case 'account':
        query = db.selectFrom('account').selectAll();
        if (where.userId) query = query.where('userId', '=', where.userId);
        break;
      case 'verification':
        query = db.selectFrom('verification').selectAll();
        if (where.identifier) query = query.where('identifier', '=', where.identifier);
        break;
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
    
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    
    return await query.execute();
  }

  async update(data: { 
    model: 'session' | 'user' | 'account' | 'verification';
    where: any;
    data: any;
  }): Promise<any> {
    const { model, where, data: updateData } = data;
    
    if (model === 'session') {
      // Update session in KV
      if (where.token) {
        const session = await this.sessionService.update(where.token, updateData);
        return session ? this.mapSessionToAdapter(session) : null;
      }
      
      dbLogger.warn('Session update by non-token field not supported in KV adapter');
      return null;
    }
    
    // For other models, use PostgreSQL via Kysely
    const db = getKysely(this.env);
    
    switch (model) {
      case 'user':
        const user = await db
          .updateTable('user')
          .set(updateData)
          .where('id', '=', where.id)
          .returningAll()
          .executeTakeFirst();
        return user;
        
      case 'account':
        const account = await db
          .updateTable('account')
          .set(updateData)
          .where('id', '=', where.id)
          .returningAll()
          .executeTakeFirst();
        return account;
        
      case 'verification':
        const verification = await db
          .updateTable('verification')
          .set(updateData)
          .where('id', '=', where.id)
          .returningAll()
          .executeTakeFirst();
        return verification;
        
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  async delete(data: { 
    model: 'session' | 'user' | 'account' | 'verification';
    where: any;
  }): Promise<boolean> {
    const { model, where } = data;
    
    if (model === 'session') {
      // Delete session from KV
      if (where.token) {
        return await this.sessionService.delete(where.token);
      }
      
      if (where.userId) {
        const count = await this.sessionService.deleteAllForUser(where.userId);
        return count > 0;
      }
      
      dbLogger.warn('Session deletion by non-token/userId field not supported in KV adapter');
      return false;
    }
    
    // For other models, use PostgreSQL via Kysely
    const db = getKysely(this.env);
    
    switch (model) {
      case 'user':
        const userResult = await db
          .deleteFrom('user')
          .where('id', '=', where.id)
          .execute();
        return userResult.length > 0;
        
      case 'account':
        const accountResult = await db
          .deleteFrom('account')
          .where('id', '=', where.id)
          .execute();
        return accountResult.length > 0;
        
      case 'verification':
        const verificationResult = await db
          .deleteFrom('verification')
          .where('id', '=', where.id)
          .execute();
        return verificationResult.length > 0;
        
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  /**
   * Map KV session to Better Auth adapter format
   */
  private mapSessionToAdapter(session: SessionData): any {
    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      activeOrganizationId: session.activeOrganizationId,
      impersonatedBy: session.impersonatedBy,
      ...session.metadata
    };
  }

  /**
   * Get user with session from hybrid storage
   */
  async getUserWithSession(token: string): Promise<{ user: any; session: any } | null> {
    // Get session from KV
    const session = await this.sessionService.getByToken(token);
    
    if (!session) {
      return null;
    }
    
    // Get user from PostgreSQL
    const db = getKysely(this.env);
    const user = await db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', session.userId)
      .executeTakeFirst();
    
    if (!user) {
      // User not found, delete orphaned session
      await this.sessionService.delete(token);
      return null;
    }
    
    // Get organization context if available
    let organization = null;
    if (session.activeOrganizationId || user.last_used_organization_id) {
      const orgId = session.activeOrganizationId || user.last_used_organization_id;
      
      const orgData = await db
        .selectFrom('organizations')
        .leftJoin('organization_members', (join) => join
          .onRef('organization_members.organization_id', '=', 'organizations.id')
          .on('organization_members.user_id', '=', user.id)
        )
        .select([
          'organizations.id as org_id',
          'organizations.name as org_name',
          'organizations.slug as org_slug',
          'organization_members.role as org_role'
        ])
        .where('organizations.id', '=', orgId)
        .executeTakeFirst();
      
      if (orgData) {
        organization = {
          id: orgData.org_id,
          name: orgData.org_name,
          slug: orgData.org_slug,
          role: orgData.org_role
        };
      }
    }
    
    return {
      user: {
        ...user,
        // Add any additional user context
      },
      session: {
        ...this.mapSessionToAdapter(session),
        organization // Include organization in session
      }
    };
  }
}