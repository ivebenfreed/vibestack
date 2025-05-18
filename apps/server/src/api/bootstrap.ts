import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Kysely } from 'kysely';
import { NeonHTTPDialect } from 'kysely-neon';
import { initializeAuth } from '../lib/auth';
import type { Env } from '../types/env';
import { UserRole } from '@repo/dataforge/server-entities'; // Assuming server-entities is the correct path

type BootstrapEnv = { Bindings: Env };
const bootstrapRouter = new Hono<BootstrapEnv>();

bootstrapRouter.post('/create-super-admin', async (c) => {
  const bootstrapKeyHeader = c.req.header('X-Bootstrap-Key');
  const { BOOTSTRAP_SECRET, DATABASE_URL } = c.env;

  if (!BOOTSTRAP_SECRET) {
    console.error('[Bootstrap] BOOTSTRAP_SECRET not set.');
    throw new HTTPException(500, { message: 'Bootstrap not configured.' });
  }
  if (bootstrapKeyHeader !== BOOTSTRAP_SECRET) {
    throw new HTTPException(403, { message: 'Invalid bootstrap key.' });
  }

  const neonDialect = new NeonHTTPDialect({ connectionString: DATABASE_URL });
  // Specify the database schema type if available, otherwise use 'any'
  // For example, if you have a DB type from Kysely codegen: import type { DB } from '@repo/dataforge/generated-types';
  // const db = new Kysely<DB>({ dialect: neonDialect });
  const db = new Kysely<any>({ dialect: neonDialect });

  try {
    const existingSuperAdmin = await db
      .selectFrom('users')
      .selectAll()
      .where('role', '=', UserRole.SUPER_ADMIN) // Use the enum value
      .limit(1)
      .executeTakeFirst();
    if (existingSuperAdmin) {
      throw new HTTPException(409, { message: 'Super admin already exists.' });
    }
  } catch (dbError) {
    console.error('[Bootstrap] DB error checking super admin:', dbError);
    throw new HTTPException(500, { message: 'DB error during bootstrap check.' });
  }

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (e) {
    throw new HTTPException(400, { message: 'Invalid JSON request body.' });
  }
  
  const { email, password, name } = requestBody;
  if (!email || !password || !name) {
    throw new HTTPException(400, { message: 'Email, password, and name required.' });
  }

  const authInstance = initializeAuth(c.env);
  try {
    // The `authInstance.api.signUpEmail` is the correct way to call it.
    // The `body` property is part of the options object for `signUpEmail`.
    const result = await authInstance.api.signUpEmail({ body: { email, password, name } });
    
    // If signUpEmail is successful, result will contain user and token.
    // Errors from signUpEmail (like user already exists) are expected to be thrown.
    // The hook implemented in auth.ts should ensure the role is super_admin if it's the first user.
    // `result.user` contains the created user details.
    return c.json({ message: 'Super admin creation initiated successfully.', userId: result.user?.id }, 201);
  } catch (error: any) { // Catching as 'any' to inspect message property
    if (error instanceof HTTPException) throw error; // Re-throw existing HTTPExceptions
    
    // Check for specific error messages from signUpEmail
    if (error.message?.includes("User already exists")) {
      throw new HTTPException(409, { message: `User with email ${email} already exists.` });
    }
    
    console.error('[Bootstrap] Super admin creation error:', error);
    throw new HTTPException(500, { message: error.message || 'Internal error creating super admin.' });
  }
});

bootstrapRouter.post('/clear-all-users', async (c) => {
  const bootstrapKeyHeader = c.req.header('X-Bootstrap-Key');
  const { BOOTSTRAP_SECRET, DATABASE_URL } = c.env;

  if (!BOOTSTRAP_SECRET) {
    console.error('[Bootstrap] BOOTSTRAP_SECRET not set for clear-all-users.');
    throw new HTTPException(500, { message: 'Bootstrap (clear all users) not configured.' });
  }
  if (bootstrapKeyHeader !== BOOTSTRAP_SECRET) {
    throw new HTTPException(403, { message: 'Invalid bootstrap key for clear-all-users.' });
  }

  const neonDialect = new NeonHTTPDialect({ connectionString: DATABASE_URL });
  const db = new Kysely<any>({ dialect: neonDialect }); // Use 'any' or your DB schema type

  let clearedCount = 0;
  let failedCount = 0;
  let totalUsersBeforeDelete = 0;

  try {
    // Get a count of users before deletion for reporting
    const usersBeforeDeleteResult = await db.selectFrom('users').select(db.fn.count('id').as('count')).executeTakeFirst();
    totalUsersBeforeDelete = Number(usersBeforeDeleteResult?.count || 0);

    if (totalUsersBeforeDelete === 0) {
      return c.json({ message: 'No users found to clear.', clearedCount: 0, failedCount: 0, totalUsersBeforeDelete: 0 }, 200);
    }

    // Execute the delete operation for all users
    const deleteResults = await db.deleteFrom('users').execute(); // Returns DeleteResult[]

    // Sum up numAffectedRows from all results
    // numAffectedRows is typically a bigint, so convert to Number
    for (const result of deleteResults) {
      if (result.numAffectedRows !== undefined) { // Kysely uses numAffectedRows
        clearedCount += Number(result.numAffectedRows);
      }
    }
    
    // If clearedCount is less than totalUsersBeforeDelete, it implies some deletions might not have occurred as expected,
    // though a single `DELETE FROM users` without a WHERE clause should ideally delete all or fail.
    if (clearedCount < totalUsersBeforeDelete) {
        failedCount = totalUsersBeforeDelete - clearedCount;
        console.warn(`[Bootstrap] Attempted to delete ${totalUsersBeforeDelete} users, ${clearedCount} reported as deleted. Potential discrepancies.`);
    }

    console.log(`[Bootstrap] Cleared ${clearedCount} user(s) out of ${totalUsersBeforeDelete}.`);
    return c.json({
      message: `User clearing process complete. Users reported as cleared: ${clearedCount}. Total users before operation: ${totalUsersBeforeDelete}. Failures (discrepancy): ${failedCount}`,
      clearedCount,
      failedCount,
      totalUsersBeforeDelete
    }, 200);

  } catch (error) {
    console.error('[Bootstrap] Error clearing all users:', error);
    throw new HTTPException(500, { message: 'Error during user clearing process.' });
  }
});

export default bootstrapRouter;