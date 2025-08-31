import { SessionKVService, type SessionData } from '../services/session/SessionKVService';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';
import { createDatabaseConnection, getKysely } from './database-manager';
import { uuidv7 } from 'uuidv7';

/**
 * Wrapper adapter that intercepts session operations for KV storage
 * while delegating other operations to the underlying Kysely adapter
 */
export function createKVSessionAdapter(env: Env, kyselyInstance: any): any {
  const sessionService = new SessionKVService(env);
  
  // Create a proxy that intercepts database operations
  return {
    db: new Proxy(kyselyInstance, {
      get(target, prop, receiver) {
        // Intercept session-related operations
        if (prop === 'insertInto' || prop === 'selectFrom' || prop === 'deleteFrom' || prop === 'updateTable') {
          return function(...args: any[]) {
            const tableName = args[0];
            
            // Handle session operations via KV
            if (tableName === 'session') {
              dbLogger.debug('Intercepting session operation', { operation: prop, table: tableName }, 'auth-kv');
              
              return {
                values: async (data: any) => {
                  // Create session in KV
                  const session = await sessionService.create({
                    userId: data.userId,
                    ipAddress: data.ipAddress || '',
                    userAgent: data.userAgent || '',
                    activeOrganizationId: data.activeOrganizationId,
                    impersonatedBy: data.impersonatedBy,
                    metadata: data
                  });
                  
                  return {
                    returningAll: () => ({
                      executeTakeFirst: async () => ({
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
                      })
                    })
                  };
                },
                selectAll: () => ({
                  where: (condition: any) => ({
                    executeTakeFirst: async () => {
                      // Extract token from condition
                      if (typeof condition === 'function') {
                        // Parse the condition to extract token
                        const testObj = { token: 'test' };
                        try {
                          // This is a hack to extract the token value
                          const conditionStr = condition.toString();
                          const tokenMatch = conditionStr.match(/token.*===?\s*["']([^"']+)["']/);
                          if (tokenMatch) {
                            const token = tokenMatch[1];
                            const session = await sessionService.getByToken(token);
                            if (session) {
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
                          }
                        } catch (e) {
                          dbLogger.warn('Failed to extract token from condition', { error: e }, 'auth-kv');
                        }
                      }
                      return null;
                    },
                    execute: async () => {
                      // For listing sessions
                      if (typeof condition === 'function') {
                        const conditionStr = condition.toString();
                        const userIdMatch = conditionStr.match(/userId.*===?\s*["']([^"']+)["']/);
                        if (userIdMatch) {
                          const userId = userIdMatch[1];
                          const sessions = await sessionService.listForUser(userId);
                          return sessions.map(s => ({
                            id: s.id,
                            userId: s.userId,
                            token: s.token,
                            refreshToken: s.refreshToken,
                            expiresAt: s.expiresAt,
                            createdAt: s.createdAt,
                            updatedAt: s.updatedAt,
                            ipAddress: s.ipAddress,
                            userAgent: s.userAgent,
                            activeOrganizationId: s.activeOrganizationId,
                            impersonatedBy: s.impersonatedBy,
                            ...s.metadata
                          }));
                        }
                      }
                      return [];
                    }
                  })
                }),
                where: (field: string, op: string, value: any) => ({
                  execute: async () => {
                    if (field === 'token' && op === '=') {
                      const deleted = await sessionService.delete(value);
                      return deleted ? [{ token: value }] : [];
                    }
                    if (field === 'userId' && op === '=') {
                      const count = await sessionService.deleteAllForUser(value);
                      return count > 0 ? [{ userId: value }] : [];
                    }
                    return [];
                  },
                  returningAll: () => ({
                    executeTakeFirst: async () => {
                      // For delete operations that return the deleted item
                      if (field === 'token' && op === '=') {
                        const session = await sessionService.getByToken(value);
                        if (session) {
                          await sessionService.delete(value);
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
                      }
                      return null;
                    }
                  })
                }),
                set: (updateData: any) => ({
                  where: (field: string, op: string, value: any) => ({
                    returningAll: () => ({
                      executeTakeFirst: async () => {
                        if (field === 'token' && op === '=') {
                          const session = await sessionService.update(value, updateData);
                          if (session) {
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
                        }
                        return null;
                      }
                    })
                  })
                })
              };
            }
            
            // For non-session tables, use the original Kysely
            return Reflect.get(target, prop, receiver).apply(target, args);
          };
        }
        
        return Reflect.get(target, prop, receiver);
      }
    }),
    type: "postgres" as const
  };
}