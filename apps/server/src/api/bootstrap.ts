import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { UserRole } from "@repo/dataforge/server-entities";
import { Kysely } from 'kysely';
import { NeonHTTPDialect } from '@repo/kysely-neon-http';
import { initializeAuth } from '../lib/auth';
import type { Env } from '../types/env';

type BootstrapEnv = { Bindings: Env };
const bootstrapRouter = new Hono<BootstrapEnv>();

bootstrapRouter.post('/create-super-admin', async (c) => {
  const bootstrapKeyHeader = c.req.header('X-Bootstrap-Key');
  const { BOOTSTRAP_SECRET, DATABASE_URL, ENVIRONMENT, NODE_ENV } = c.env;

  if (!BOOTSTRAP_SECRET) {
    console.error('[Bootstrap] BOOTSTRAP_SECRET not set.');
    throw new HTTPException(500, { message: 'Bootstrap not configured.' });
  }
  if (bootstrapKeyHeader !== BOOTSTRAP_SECRET) {
    throw new HTTPException(403, { message: 'Invalid bootstrap key.' });
  }

  // Create Neon dialect with auto-configuration
  const neonDialect = new NeonHTTPDialect({
    connectionString: DATABASE_URL,
    // Auto-detection handles local proxy configuration automatically
  });
  // Specify the database schema type if available, otherwise use 'any'
  // For example, if you have a DB type from Kysely codegen: import type { DB } from '@repo/dataforge/generated-types';
  // const db = new Kysely<DB>({ dialect: neonDialect });
  const db = new Kysely<any>({ dialect: neonDialect });

  try {
    const existingSuperAdmin = await db
      .selectFrom('users')
      .selectAll()
      .where('role', '=', 'super_admin') // Use the enum value directly
      .limit(1)
      .executeTakeFirst();
    console.log('[Bootstrap] Existing super admin check:', existingSuperAdmin);
    if (existingSuperAdmin) {
      throw new HTTPException(409, { message: 'Super admin already exists.' });
    }
  } catch (dbError) {
    // Only throw if it's not our HTTPException
    if (dbError instanceof HTTPException) {
      throw dbError;
    }
    console.error('[Bootstrap] DB error checking super admin:', dbError);
    throw new HTTPException(500, { message: 'DB error during bootstrap check.' });
  }

  let requestBody;
  try {
    const rawBody = await c.req.text();
    console.log('[Bootstrap] Raw request body:', rawBody);
    requestBody = JSON.parse(rawBody);
  } catch (e) {
    console.error('[Bootstrap] JSON parse error:', e);
    throw new HTTPException(400, { message: 'Invalid JSON request body.' });
  }
  
  const { email, password, name, role } = requestBody;
  if (!email || !password || !name) {
    throw new HTTPException(400, { message: 'Email, password, and name required.' });
  }

  const authInstance = initializeAuth(c.env);
  try {
    // The `authInstance.api.signUpEmail` is the correct way to call it.
    // The `body` property is part of the options object for `signUpEmail`.
    // Use type assertion to satisfy the TypeScript compiler
    // When role is undefined, it won't be included in the API call
    const signUpParams = {
      body: role !== undefined
        ? { email, password, name, role }
        : { email, password, name }
    } as any; // Type assertion to bypass strict typing
    
    console.log('[Bootstrap] Attempting signup with params:', { email, name, role });
    const result = await authInstance.api.signUpEmail(signUpParams);
    console.log('[Bootstrap] Signup result:', result?.user?.id);
    
    // If signUpEmail is successful, result will contain user and token.
    // Errors from signUpEmail (like user already exists) are expected to be thrown.
    // The hook implemented in auth.ts should ensure the role is super_admin if it's the first user.
    // `result.user` contains the created user details.
    return c.json({ message: 'Super admin creation initiated successfully.', userId: result.user?.id }, 201);
  } catch (error: any) { // Catching as 'any' to inspect message property
    if (error instanceof HTTPException) throw error; // Re-throw existing HTTPExceptions
    
    // Check for specific error messages from signUpEmail
    if (error.message?.includes("User already exists")) {
      console.log('[Bootstrap] User already exists:', email);
      throw new HTTPException(409, { message: `User with email ${email} already exists.` });
    }
    
    console.error('[Bootstrap] Super admin creation error:', error);
    throw new HTTPException(500, { message: error.message || 'Internal error creating super admin.' });
  }
});

export default bootstrapRouter;
