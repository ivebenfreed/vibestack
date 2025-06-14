import { betterAuth } from "better-auth";
// import { jwt } from "better-auth/plugins"; // Removed JWT plugin import
import { NeonHTTPDialect } from "kysely-neon";
import { Hono, Context } from "hono";
import type { Env } from "../types/env";
import type { Dialect } from 'kysely';
import { Kysely, PostgresDialect } from 'kysely';
import { dbLogger } from '../middleware/logger';

// Type for Hono context including Auth variables
export type AuthType = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
  Bindings: Env;
};

// Define a type for the Hono Context with AuthType
type HonoAuthContext = Context<AuthType>;

// --- Top-level initialization for CLI compatibility ---
// The CLI needs to instantiate the config at module load time.
// It runs in Node.js, so we attempt to use process.env here.
// Hono runtime will use the instance generated via getAuth.

// Check for process.env existence (Node.js environment)
const dbUrlForCli = typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined;
const secretForCli = typeof process !== 'undefined' ? process.env.BETTER_AUTH_SECRET : undefined;
const baseUrlForCli = typeof process !== 'undefined' ? process.env.BETTER_AUTH_URL : undefined;

// Use NeonHTTPDialect (Stateless HTTPS) for CLI instance if dbUrlForCli is available
const cliNeonDialect = dbUrlForCli
  ? new NeonHTTPDialect({ connectionString: dbUrlForCli })
  : undefined;

// Top-level auth instance for CLI schema generation and potentially type inference.
// Provide minimal config required for the CLI to detect the database type.
// The actual runtime configuration happens in initializeAuth below.
export const auth = betterAuth({
    // Wrap dialect in an object and specify the type for CLI
    database: cliNeonDialect ? {
      dialect: cliNeonDialect as unknown as Dialect,
      type: "postgres"
    } : undefined,
    secret: secretForCli,
    baseUrl: baseUrlForCli,
    emailAndPassword: { enabled: true },
});


// --- Runtime initialization for Hono ---

// Helper function to get the auth instance (ensures env vars are accessed within request context)
// Export this function so it can be used directly in the fetch handler
export function initializeAuth(env: Env) {
  const neonDialect = new NeonHTTPDialect({
    connectionString: env.DATABASE_URL,
  });

  // Explicitly create Kysely instance with logging
  const kyselyInstance = new Kysely<any>({
    dialect: neonDialect as any,
    log: (event) => {
      if (event.level === 'query') {
        dbLogger.debug('Kysely Query', {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, 'kysely');
      } else if (event.level === 'error') {
        dbLogger.error('Kysely Error', event.error, undefined, 'kysely');
      }
    }
  });

  dbLogger.debug("Initializing Better Auth", {
    databaseUrlType: typeof env.DATABASE_URL,
    secretType: typeof env.BETTER_AUTH_SECRET,
    trustedOrigins: ['https://127.0.0.1:5173', 'http://127.0.0.1:5173', 'http://localhost:5173']
  }, 'auth');

  const runtimeAuthConfig = {
    // Pass the pre-configured Kysely instance and type
    database: {
      db: kyselyInstance,
      type: "postgres" as const,
      casing: "snake" as const // Use literal type
    },
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: env.BETTER_AUTH_URL,
    cookieOptions: {
      secure: false,
      sameSite: "lax",
      path: "/"
    },
    trustedOrigins: ['https://127.0.0.1:5173', 'http://127.0.0.1:5173', 'http://localhost:5173'] as string[],
    emailAndPassword: {
      enabled: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (userData: any, hookContext: any) => {
            dbLogger.debug('Auth Hook - user.create.before', {
              userData: JSON.stringify(userData, null, 2)
            }, 'auth');
            dbLogger.debug('User data in hook after type change', {
              userData: JSON.stringify(userData)
            }, 'auth');
            // Simply pass through userData, respecting any role set by calling code
            // If userData.role is set, it will be used
            // If userData.role is not set, the DB default ('member') will apply
            return { data: userData };
          },
        },
      },
    },
    // Add JWT plugin properly
    plugins: [
      // jwt({ // JWT plugin removed
      //   jwt: {
      //     issuer: 'vibestack',
      //     audience: 'vibestack',
      //     expirationTime: '7d' // 7 days
      //   }
      // })
    ],
    // Define core model names directly
    user: {
      modelName: 'users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
        // 'role' is a native column in the 'users' table,
        // so it doesn't need to be in 'fields' for mapping if the column name matches the property name.
        // However, to ensure better-auth processes it from input to hooks and then to DB,
        // we declare it in additionalFields.
      },
      additionalFields: {
        role: {
          type: "string" as const, // Matches UserRole enum (string values)
          required: false, // The DB has a default
          defaultValue: "member", // Default if not provided; DB default is also 'member'
          input: true // Allow 'role' to be passed in the body of signUpEmail
        }
      }
    },
    session: {
      modelName: 'sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',       // Assuming DB uses snake_case
        userAgent: 'user_agent',       // Assuming DB uses snake_case
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    },
    account: {
      modelName: 'accounts',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',       // Assuming DB uses snake_case
        providerId: 'provider_id',     // Assuming DB uses snake_case
        accessTokenExpiresAt: 'access_token_expires_at', // Assuming DB uses snake_case
        refreshTokenExpiresAt: 'refresh_token_expires_at', // Assuming DB uses snake_case
        createdAt: 'created_at',
        updatedAt: 'updated_at'
        // Note: accessToken, refreshToken, scope, idToken, password might map directly
      }
    },
    verification: {
      modelName: 'verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    },
    // Add JWKS model configuration at the top level
    // jwks: { // Removed jwks config as JWT plugin is removed
    //   modelName: 'jwks',
    //   fields: {
    //     createdAt: 'created_at',
    //     updatedAt: 'updated_at'
    //   }
    // },
    // JWKS configuration removed - using default camelCase names
    schema: {
      /* Commented out - Kysely should infer types from DB
      columns: {
        id: { type: 'uuid' },
        createdAt: { type: 'timestamptz' },
        updatedAt: { type: 'timestamptz' },
        expiresAt: { type: 'timestamptz' },
        accessTokenExpiresAt: { type: 'timestamptz' },
        refreshTokenExpiresAt: { type: 'timestamptz' },
        userId: { type: 'uuid' }
      }
      */
    },
    advanced: {
      database: {
        generateId: false as const,
      },
    },
  };

  // Log the core model names being used
  dbLogger.debug('Better Auth core model configuration', { 
    user: runtimeAuthConfig.user.modelName,
    session: runtimeAuthConfig.session.modelName,
    account: runtimeAuthConfig.account.modelName,
    verification: runtimeAuthConfig.verification.modelName
    // jwks: runtimeAuthConfig.jwks.modelName // Removed jwks from log
  }, 'auth');

  // Return a fully configured instance for runtime use
  return betterAuth(runtimeAuthConfig);
}

// Export a function that initializes auth based on Hono context for runtime use
export const getAuth = (c: HonoAuthContext) => {
    return initializeAuth(c.env);
} 