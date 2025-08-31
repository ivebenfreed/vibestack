import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';
import { getKysely } from './kysely';
import { uuidv7 } from 'uuidv7';

/**
 * Custom session interceptor for Better Auth that stores sessions in KV
 * while keeping other data in PostgreSQL
 */
export function createKVSessionInterceptor(env: Env) {
  const kyselyInstance = getKysely(env);
  
  // Create a proxy that intercepts session operations
  return new Proxy(kyselyInstance, {
    get(target, prop, receiver) {
      // Intercept database query methods
      if (prop === 'selectFrom' || prop === 'insertInto' || prop === 'updateTable' || prop === 'deleteFrom') {
        return function(tableName: string) {
          // Handle session table operations via KV
          if (tableName === 'session' && env.SESSIONS) {
            dbLogger.debug('Intercepting session operation', { operation: prop, table: tableName }, 'kv-adapter');
            
            // Return a mock query builder for session operations
            return createKVSessionQueryBuilder(env.SESSIONS, tableName, prop as string);
          }
          
          // For non-session tables, use the original Kysely
          const originalMethod = Reflect.get(target, prop, receiver);
          return originalMethod.call(target, tableName);
        };
      }
      
      return Reflect.get(target, prop, receiver);
    }
  });
}

function createKVSessionQueryBuilder(kv: KVNamespace, tableName: string, operation: string) {
  const builder: any = {};
  let whereConditions: any = {};
  let updateData: any = {};
  let insertData: any = {};
  let selectFields: string[] = [];
  
  // Build the query chain
  builder.select = function(fields: string[]) {
    selectFields = fields;
    return builder;
  };
  
  builder.selectAll = function() {
    selectFields = ['*'];
    return builder;
  };
  
  builder.where = function(field: string | Function, op?: string, value?: any) {
    if (typeof field === 'function') {
      // Complex where clause - store for later processing
      whereConditions._complex = field;
      // Try to execute the function with a mock expression builder to extract conditions
      try {
        const mockEB = {
          eb: (f: string, o: string, v: any) => {
            whereConditions[f] = v;
            dbLogger.info('Extracted from function EB', { field: f, op: o, value: v }, 'kv-adapter');
            return true;
          },
          and: (conditions: any[]) => conditions,
          or: (conditions: any[]) => conditions,
          val: (v: any) => v
        };
        // Some functions expect the mock to be called as a function
        const result = field(mockEB.eb, mockEB);
        dbLogger.debug('Complex where function executed', { result, whereConditions }, 'kv-adapter');
      } catch (e) {
        dbLogger.debug('Could not execute complex where function', { error: e?.toString() }, 'kv-adapter');
      }
    } else {
      // Simple where clause
      if (arguments.length === 3) {
        // field, operator, value
        whereConditions[field] = value;
      } else {
        // field, value (assumes '=' operator)
        whereConditions[field] = op;
      }
      dbLogger.debug('Simple where clause', { field, op, value, args: arguments.length }, 'kv-adapter');
    }
    return builder;
  };
  
  builder.values = function(data: any) {
    insertData = data;
    return builder;
  };
  
  builder.set = function(data: any) {
    updateData = data;
    return builder;
  };
  
  builder.limit = function(n: number) {
    return builder;
  };
  
  builder.returningAll = function() {
    return builder;
  };
  
  // Execute methods
  builder.execute = async function() {
    return handleKVOperation(kv, operation, { whereConditions, updateData, insertData, selectFields });
  };
  
  builder.executeTakeFirst = async function() {
    const results = await handleKVOperation(kv, operation, { whereConditions, updateData, insertData, selectFields });
    return Array.isArray(results) ? results[0] : results;
  };
  
  builder.executeTakeFirstOrThrow = async function() {
    const result = await builder.executeTakeFirst();
    if (!result) throw new Error('No result found');
    return result;
  };
  
  return builder;
}

async function handleKVOperation(
  kv: KVNamespace, 
  operation: string, 
  params: { whereConditions: any; updateData: any; insertData: any; selectFields: string[] }
) {
  const { whereConditions, updateData, insertData } = params;
  
  try {
    switch (operation) {
      case 'insertInto': {
        // Create session in KV
        const sessionId = insertData.id || uuidv7();
        const sessionData = {
          ...insertData,
          id: sessionId
        };
        
        const ttl = 7 * 24 * 60 * 60; // 7 days
        await kv.put(
          `session:${sessionData.token}`,
          JSON.stringify(sessionData),
          { expirationTtl: ttl }
        );
        
        // Also index by user ID for listing
        await kv.put(
          `user:${sessionData.userId}:session:${sessionData.token}`,
          JSON.stringify(sessionData),
          { expirationTtl: ttl }
        );
        
        dbLogger.info('Session created in KV', { sessionId, token: sessionData.token }, 'kv-adapter');
        return sessionData;
      }
      
      case 'selectFrom': {
        // Retrieve session from KV
        dbLogger.info('SelectFrom session operation', { whereConditions, hasComplexWhere: !!whereConditions._complex }, 'kv-adapter');
        
        // Handle complex where clause (Better Auth uses these)
        if (whereConditions._complex) {
          // Try to extract token from complex where
          const funcStr = whereConditions._complex.toString();
          // Look for different patterns Better Auth might use
          const patterns = [
            /token['"]\s*===?\s*['"]([^'"]+)['"]/,
            /===?\s*['"]([^'"]+)['"]/,  // Simple equality
            /\$\d+/  // Parameter placeholder
          ];
          
          for (const pattern of patterns) {
            const match = funcStr.match(pattern);
            if (match && match[1] && !match[1].includes('$')) {
              whereConditions.token = match[1];
              dbLogger.info('Extracted token from complex where', { token: whereConditions.token, pattern: pattern.source }, 'kv-adapter');
              break;
            }
          }
          
          // If we couldn't extract, log the full function for debugging
          if (!whereConditions.token) {
            dbLogger.warn('Could not extract token from complex where', { functionStr: funcStr.substring(0, 200) }, 'kv-adapter');
          }
        }
        
        if (whereConditions.token) {
          const data = await kv.get(`session:${whereConditions.token}`);
          if (data) {
            const session = JSON.parse(data);
            dbLogger.debug('Session retrieved from KV', { token: whereConditions.token }, 'kv-adapter');
            return [session];
          } else {
            dbLogger.debug('Session not found in KV', { token: whereConditions.token }, 'kv-adapter');
          }
        } else if (whereConditions.userId) {
          // List sessions for user
          const list = await kv.list({ prefix: `user:${whereConditions.userId}:session:` });
          const sessions = await Promise.all(
            list.keys.map(async (key) => {
              const data = await kv.get(key.name);
              return data ? JSON.parse(data) : null;
            })
          );
          return sessions.filter(Boolean);
        }
        return [];
      }
      
      case 'updateTable': {
        // Update session in KV
        if (whereConditions.token) {
          const existing = await kv.get(`session:${whereConditions.token}`);
          if (existing) {
            const session = JSON.parse(existing);
            const updated = { ...session, ...updateData, updatedAt: new Date().toISOString() };
            
            const ttl = 7 * 24 * 60 * 60;
            await kv.put(
              `session:${whereConditions.token}`,
              JSON.stringify(updated),
              { expirationTtl: ttl }
            );
            
            // Update user index
            if (session.userId) {
              await kv.put(
                `user:${session.userId}:session:${whereConditions.token}`,
                JSON.stringify(updated),
                { expirationTtl: ttl }
              );
            }
            
            dbLogger.info('Session updated in KV', { token: whereConditions.token }, 'kv-adapter');
            return updated;
          }
        }
        return null;
      }
      
      case 'deleteFrom': {
        // Delete session from KV
        if (whereConditions.token) {
          const existing = await kv.get(`session:${whereConditions.token}`);
          if (existing) {
            const session = JSON.parse(existing);
            await kv.delete(`session:${whereConditions.token}`);
            
            // Delete from user index
            if (session.userId) {
              await kv.delete(`user:${session.userId}:session:${whereConditions.token}`);
            }
            
            dbLogger.info('Session deleted from KV', { token: whereConditions.token }, 'kv-adapter');
            return [session];
          }
        } else if (whereConditions.userId) {
          // Delete all sessions for user
          const list = await kv.list({ prefix: `user:${whereConditions.userId}:session:` });
          await Promise.all(
            list.keys.map(async (key) => {
              await kv.delete(key.name);
              // Also delete the main session key
              const token = key.name.split(':').pop();
              if (token) {
                await kv.delete(`session:${token}`);
              }
            })
          );
          return [];
        }
        return [];
      }
      
      default:
        dbLogger.warn('Unhandled KV operation', { operation }, 'kv-adapter');
        return null;
    }
  } catch (error) {
    dbLogger.error('KV operation failed', { operation, error }, 'kv-adapter');
    throw error;
  }
}