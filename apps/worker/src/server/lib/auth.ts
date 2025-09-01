import { betterAuth } from "better-auth";
import { google, microsoft } from "better-auth/providers";
import { admin, emailOTP, oneTimeToken, twoFactor, customSession } from "better-auth/plugins";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
// import { jwt } from "better-auth/plugins"; // Removed JWT plugin import
import { Hono, Context } from "hono";
import type { Env } from "../types/env";
import { dbLogger } from '../middleware/logger.ts';
import { createEmailService } from '../services/EmailService';
import { NeonHTTPDialect } from 'kysely-neon-http';
import type { Dialect } from 'kysely';
import { uuidv7 } from 'uuidv7';
import { createDatabaseConnection, getKysely } from './database-manager';
import { createKVSessionInterceptor } from './kv-session-adapter';

// Helper function to get allowed origins for unified worker
function getAllowedOrigins(env: Env): string[] {
  // For unified worker, everything is same-origin so we just need the current origin
  const isDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
  
  if (isDev) {
    // In development, allow localhost with any port (Vite handles dynamic ports)
    return [
      'http://localhost',
      'https://localhost', 
      'http://127.0.0.1',
      'https://127.0.0.1'
    ];
  } else {
    // Production/staging origins
    return [
      'https://dev.codevibesmatter.com',
      'https://app.codevibesmatter.com'
    ];
  }
}

// Helper function to get base URL for unified worker
function getBaseUrl(env: Env): string {
  if (env.ENVIRONMENT === "development" || env.ENVIRONMENT === "local") {
    // For unified worker, the base URL is just the worker origin
    // No separate ports or proxy needed
    return `http://localhost:5175`;
  } else if (env.ENVIRONMENT === "staging") {
    return "https://dev.codevibesmatter.com";
  } else {
    return "https://app.codevibesmatter.com";
  }
}

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
const googleClientIdForCli = typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_ID : undefined;
const googleClientSecretForCli = typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_SECRET : undefined;
const microsoftClientIdForCli = typeof process !== 'undefined' ? process.env.MICROSOFT_CLIENT_ID : undefined;
const microsoftClientSecretForCli = typeof process !== 'undefined' ? process.env.MICROSOFT_CLIENT_SECRET : undefined;

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
    baseURL: baseUrlForCli, // Fix: Use baseURL (capital URL) not baseUrl
    logger: {
      level: "debug",
      disabled: false
    },
    emailAndPassword: { 
      enabled: true,
      requireEmailVerification: true, // Require email verification via link (better UX)
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true, 
        requireNumbers: true,
        requireSpecialChars: true
      },
      sendResetPassword: async (data: any, request?: any) => {
        // CLI environment - skip email sending
        if (typeof process !== 'undefined') {
          console.log('[CLI] Password reset email would be sent to:', data.user.email);
          console.log('[CLI] Reset URL:', data.url);
          return;
        }
      }
    },
    emailVerification: {
      enabled: true, // Enable link-based verification for better trial UX
      sendOnSignUp: true,
      sendVerificationEmail: async (data, request) => {
        // CLI environment - skip email sending
        if (typeof process !== 'undefined') {
          console.log('[CLI] Email verification link would be sent to:', data.user.email);
          console.log('[CLI] Verification URL:', data.url);
          console.log('[CLI] Token:', data.token);
          return;
        }
        
        // Runtime environment - this will be replaced by the runtime config
        console.log('CLI emailVerification config - runtime will override this');
      }
    },
    socialProviders: (googleClientIdForCli && googleClientSecretForCli) || (microsoftClientIdForCli && microsoftClientSecretForCli) ? {
      ...(googleClientIdForCli && googleClientSecretForCli ? {
        google: {
          clientId: googleClientIdForCli,
          clientSecret: googleClientSecretForCli,
          redirectURI: `http://localhost:5173/api/auth/callback/google`, // Default for CLI
        }
      } : {}),
      ...(microsoftClientIdForCli && microsoftClientSecretForCli ? {
        microsoft: {
          clientId: microsoftClientIdForCli,
          clientSecret: microsoftClientSecretForCli,
          redirectURI: `http://localhost:5173/api/auth/callback/microsoft`, // Default for CLI
        }
      } : {})
    } : undefined,
    plugins: [
      admin(),
      // organization plugin removed - using custom organization system instead
      // organization({
      //   allowUserToCreateOrganization: true,
      //   organizationLimit: 10,
      //   creatorRole: "owner",
      //   memberRole: "member",
      //   roles: ["owner", "admin", "manager", "member", "viewer"],
      //   invitationLimit: 100,
      //   requireEmailVerificationOnInvitation: false,
      //   cancelPendingInvitationsOnReInvite: true,
      //   sendInvitationEmail: async (data: any, request?: any) => {
      //     // Email sending logic removed - using custom invitation system
      //   }
      // }),
      emailOTP({
        sendVerificationOTP: async (data: any, request?: any) => {
          // CLI environment - skip email sending
          if (typeof process !== 'undefined') {
            console.log('[CLI] OTP would be sent to:', data.email);
            console.log('[CLI] OTP code:', data.otp);
            console.log('[CLI] Type:', data.type);
            return;
          }
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes  
        sendVerificationOnSignUp: true, // Enable OTP verification on sign-up
        allowedAttempts: 5
      }),
      oneTimeToken({
        expiresIn: 60 * 24, // 24 hours in minutes
      }),
      twoFactor({
        totpOptions: {
          period: 30,
          digits: 6,
          algorithm: "SHA1",
          issuer: "VibeStack",
        },
        skipVerificationOnSetup: false, // Require TOTP verification when enabling
        backupCodes: {
          enabled: true,
          length: 8,
          count: 10,
        },
      }),
    ],
});


// --- Runtime initialization for Hono ---

// Helper function to get the auth instance (ensures env vars are accessed within request context)
// Export this function so it can be used directly in the fetch handler
export function initializeAuth(env: Env, request?: Request) {
  // Get configured Kysely instance or KV-intercepted version
  let kyselyInstance;
  
  // Always establish database connection first
  createDatabaseConnection(env);
  
  if (env.USE_KV_SESSIONS && env.SESSIONS) {
    // Use KV interceptor for session storage (requires database connection to be initialized)
    kyselyInstance = createKVSessionInterceptor(env);
    dbLogger.info('Using KV storage for sessions', {}, 'auth');
  } else {
    kyselyInstance = getKysely();
    dbLogger.info('Using PostgreSQL for sessions', {}, 'auth');
  }

  const trustedOrigins = getAllowedOrigins(env);
  
  dbLogger.debug("Initializing Better Auth", {
    databaseUrlType: typeof env.DATABASE_URL,
    secretType: typeof env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins,
    organizationPlugin: 'disabled - using custom system',
    sessionStorage: env.SESSIONS ? 'Cloudflare KV (via better-auth-cloudflare)' : 'PostgreSQL',
    kvNamespaceBound: !!env.SESSIONS
  }, 'auth');

  // Better Auth baseURL for unified worker
  const baseUrl = env.ENVIRONMENT === "development" || env.ENVIRONMENT === "local"
    ? `http://localhost:5175`  // Unified worker base URL
    : env.ENVIRONMENT === "staging"
      ? "https://dev.codevibesmatter.com"
      : "https://app.codevibesmatter.com";
  
  const runtimeAuthConfig = {
    // Database configuration (PostgreSQL via Kysely)
    database: {
      db: kyselyInstance,
      type: "postgres" as const
      // Remove custom casing - let Better Auth use defaults
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: baseUrl, // Fix: Use baseURL (capital URL) not baseUrl
    logger: {
      level: "debug",
      disabled: false
    },
    cookieOptions: {
      secure: env.ENVIRONMENT !== "development", // ✅ FIX: Only secure in production/staging
      sameSite: "lax",
      path: "/",
      // ✅ FIX: Set domain for development to work with Vite proxy
      domain: env.ENVIRONMENT === "development" ? "localhost" : undefined,
    },
    trustedOrigins: trustedOrigins as string[],
    // Add database hooks with password validation and organization context
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            console.log('[DB Hook] Before creating user:', {
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified,
              role: user.role,
              hasId: !!user.id,
              id: user.id
            });
            
            // Custom password validation (if password is available in context)
            if (context?.password) {
              const password = context.password;
              const errors: string[] = [];
              
              // Check character requirements
              if (!/[A-Z]/.test(password)) {
                errors.push('Password must contain at least one uppercase letter');
              }
              
              if (!/[a-z]/.test(password)) {
                errors.push('Password must contain at least one lowercase letter');
              }
              
              if (!/\d/.test(password)) {
                errors.push('Password must contain at least one number');
              }
              
              if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
                errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>?)');
              }
              
              // Check against common passwords
              const commonPasswords = [
                'password', 'password123', '12345678', 'qwerty', 'abc123',
                'password1', '123456789', 'welcome', 'admin', 'letmein',
                'monkey', 'dragon', 'pass', 'mustang', 'master'
              ];
              
              if (commonPasswords.some(common => password.toLowerCase().includes(common.toLowerCase()))) {
                errors.push('Password contains common words and is not secure');
              }
              
              // Check similarity to email
              if (user.email) {
                const emailPrefix = user.email.split('@')[0].toLowerCase();
                const passwordLower = password.toLowerCase();
                
                if (passwordLower.includes(emailPrefix) || emailPrefix.includes(passwordLower)) {
                  errors.push('Password must not be similar to your email address');
                }
              }
              
              // Check for sequential characters
              const hasSequential = /123|234|345|456|567|678|789|890|abc|bcd|cde|def/.test(password.toLowerCase());
              if (hasSequential) {
                errors.push('Password must not contain sequential characters');
              }
              
              // Check for repeated characters (more than 2 in a row)
              if (/(.)\1{2,}/.test(password)) {
                errors.push('Password must not contain more than 2 repeated characters in a row');
              }
              
              if (errors.length > 0) {
                dbLogger.warn('Password validation failed', {
                  email: user.email,
                  errors: errors
                }, 'auth');
                throw new Error(errors.join('; '));
              }
              
              dbLogger.info('Password validation passed', {
                email: user.email
              }, 'auth');
            }
            
            return user;
          },
          after: async (user) => {
            console.log('[DB Hook] After creating user:', user);
            
            // Auto-create personal organization for new user
            try {
              const db = kyselyInstance;
              const userName = user.name || user.email?.split('@')[0] || 'User';
              
              // Create personal organization
              const personalOrgId = uuidv7();
              const personalOrgSlug = `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
              
              await db
                .insertInto('organizations')
                .values({
                  id: personalOrgId,
                  name: `${userName}'s Personal Workspace`,
                  slug: personalOrgSlug,
                  type: 'personal',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .execute();
              
              // Add user as owner of personal organization
              await db
                .insertInto('organization_members')
                .values({
                  id: uuidv7(),
                  organization_id: personalOrgId,
                  user_id: user.id,
                  role: 'owner',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .execute();
              
              // Set as default organization for the user
              await db
                .updateTable('user')
                .set({
                  default_organization_id: personalOrgId,
                  last_used_organization_id: personalOrgId,
                  last_org_access_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .where('id', '=', user.id)
                .execute();
              
              dbLogger.info('Created personal organization for new user', {
                userId: user.id,
                userEmail: user.email,
                orgId: personalOrgId,
                orgName: `${userName}'s Personal Workspace`,
                orgSlug: personalOrgSlug
              }, 'auth');
              
            } catch (error) {
              dbLogger.error('Failed to create personal organization for new user', {
                userId: user.id,
                userEmail: user.email,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
              }, 'auth');
              
              // Don't throw error here as it would prevent user creation
              // The user can still use the system, just without a personal org initially
            }
            
            return user;
          }
        }
      },
      account: {
        create: {
          before: async (account) => {
            console.log('[DB Hook] Before creating account:', {
              userId: account.userId,
              providerId: account.providerId,
              hasPassword: !!account.password
            });
            return account;
          }
        }
      },
      session: {
        create: {
          after: async (session) => {
            console.log('[DB Hook] Session created for user:', {
              userId: session.userId,
              sessionId: session.id
            });
            
            // Custom organization context will be handled by our custom system
            return session;
          }
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true, // Require OTP verification before sign-in
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      },
      sendResetPassword: async (data: any, request?: any) => {
        try {
          const emailService = createEmailService(env);
          const fixedUrl = emailService.fixUrlForEnvironment(data.url);
          
          await emailService.sendPasswordReset({
            user: data.user,
            url: fixedUrl
          });
        } catch (error) {
          dbLogger.error('Failed to send password reset email via EmailService', {
            email: data.user.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'auth');
          throw error;
        }
      }
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
        redirectURI: `${baseUrl}/api/auth/callback/google`,
      },
      microsoft: {
        clientId: env.MICROSOFT_CLIENT_ID || "",
        clientSecret: env.MICROSOFT_CLIENT_SECRET || "",
        redirectURI: `${baseUrl}/api/auth/callback/microsoft`,
      },
    },
    emailVerification: {
      enabled: true, // Enable link-based verification for better trial UX
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600 * 24, // 24 hours
      sendVerificationEmail: async (data: any, request?: any) => {
        try {
          const emailService = createEmailService(env);
          const fixedUrl = emailService.fixUrlForEnvironment(data.url);
          
          await emailService.sendEmailVerification({
            user: data.user,
            url: fixedUrl,
            token: data.token
          });
        } catch (error) {
          dbLogger.error('Failed to send email verification via EmailService', {
            email: data.user?.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'auth');
          throw error;
        }
      }
    },
    // Temporarily remove database hooks for debugging
    // databaseHooks: {
    //   user: {
    //     create: {
    //       before: async (userData: any, hookContext: any) => {
    //         dbLogger.debug('Auth Hook - user.create.before', {
    //           userData: JSON.stringify(userData, null, 2),
    //           originalRole: userData.role
    //         }, 'auth');
    //         
    //         // Ensure role is valid - map Better Auth defaults to our enum
    //         if (!userData.role || userData.role === 'user') {
    //           userData.role = 'member'; // Map Better Auth's default 'user' to our 'member'
    //           dbLogger.debug('Auth Hook - role mapped from user to member', {
    //             newRole: userData.role
    //           }, 'auth');
    //         }
    //         
    //         // Validate role is one of our allowed values
    //         const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
    //         if (!validRoles.includes(userData.role)) {
    //           dbLogger.warn('Auth Hook - invalid role detected, defaulting to member', {
    //             invalidRole: userData.role,
    //             validRoles
    //           }, 'auth');
    //           userData.role = 'member';
    //         }
    //         
    //         dbLogger.debug('Auth Hook - final user data', {
    //           finalRole: userData.role,
    //           userData: JSON.stringify(userData)
    //         }, 'auth');
    //         
    //         return { data: userData };
    //       },
    //     },
    //   },
    // },
    // Custom organization system - no Better Auth organization plugin
    plugins: [
      admin(),
      // Custom session plugin to include organization data
      customSession(async ({ user, session }, ctx) => {
        if (!user || !session) {
          return { user, session };
        }

        try {
          // Get Kysely instance from the auth instance
          const db = ctx.context.env?.database?.db || kyselyInstance;
          
          // Get user's organization context, prioritizing last_used over default
          const userContext = await db
            .selectFrom('user')
            .select([
              'user.default_organization_id',
              'user.last_used_organization_id', 
              'user.last_org_access_at'
            ])
            .where('user.id', '=', user.id)
            .executeTakeFirst();

          // Determine which organization to use: last_used takes priority over default
          const targetOrgId = userContext?.last_used_organization_id || userContext?.default_organization_id;
          
          let orgData = null;
          if (targetOrgId) {
            // Get organization and membership info for the target org
            orgData = await db
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
              .where('organizations.id', '=', targetOrgId)
              .executeTakeFirst();
          }

          // Note: We don't update last_org_access_at here in the session plugin
          // to avoid side effects. This will be updated by the organization switching API.

          return {
            user: {
              ...user,
              default_organization_id: userContext?.default_organization_id || null,
              last_used_organization_id: userContext?.last_used_organization_id || null,
              last_org_access_at: userContext?.last_org_access_at || null,
            },
            session: {
              ...session,
              organization: orgData?.org_id ? {
                id: orgData.org_id,
                name: orgData.org_name,
                slug: orgData.org_slug,
                role: orgData.org_role,
              } : null,
            },
          };
        } catch (error) {
          dbLogger.error('Failed to fetch organization data for session', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          // Return basic session data if organization fetch fails
          return { user, session };
        }
      }),
      // Polar billing integration
      polar({
        client: new Polar({
          accessToken: env.POLAR_ACCESS_TOKEN,
          server: env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
        }),
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: [
              { productId: "be94b25f-b93c-407e-9256-494626d035f9", slug: "free" },
              { productId: "9bd1d779-3f8a-45b1-b072-0591b8325a02", slug: "pro-monthly" },
              { productId: "dedff847-c566-4ba7-b2d9-7d8690312151", slug: "pro-annual" },
              { productId: "6e13296d-fcbf-4d7f-9027-bb47e7c6e25f", slug: "enterprise-monthly" },
              { productId: "68a1eb14-5bf9-a827-1f37bf30d1d9", slug: "enterprise-annual" }
            ],
            successUrl: "/billing/success?checkout_id={CHECKOUT_ID}",
            authenticatedUsersOnly: true
          }),
          portal(),
          usage(),
          webhooks({
            secret: env.POLAR_WEBHOOK_SECRET
          })
        ]
      }),
      // organization({
      //   allowUserToCreateOrganization: true,
      //   organizationLimit: 10,
      //   creatorRole: "owner",
      //   memberRole: "member",
      //   roles: ["owner", "admin", "manager", "member", "viewer"],
      //   invitationLimit: 100,
      //   requireEmailVerificationOnInvitation: false,
      //   cancelPendingInvitationsOnReInvite: true,
      //   sendInvitationEmail: async (data: any, request?: any) => {
      //     // Email sending logic removed - using custom invitation system
      //   }
      // }),
      // emailOTP plugin removed - using link-based verification for better trial UX
      oneTimeToken({
        expiresIn: 60 * 24, // 24 hours in minutes
      }),
      twoFactor({
        totpOptions: {
          period: 30,
          digits: 6,
          algorithm: "SHA1",
          issuer: "VibeStack",
        },
        skipVerificationOnSetup: false, // Require TOTP verification when enabling
        backupCodes: {
          enabled: true,
          length: 8,
          count: 10,
        },
      }),
    ],
    // Use Better Auth defaults - no custom field mappings needed
    // Tables already match Better Auth naming: users, sessions, accounts, verifications
    // Temporarily remove additionalFields for debugging
    // additionalFields: {
    //   role: {
    //     type: "string" as const,
    //     required: false,
    //     defaultValue: "member",
    //     input: true,
    //     output: true
    //   }
    // },
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
        generateId: () => {
          // Generate a UUID v7 to match our database's generate_uuidv7() function
          // UUIDv7 includes timestamp for better sorting and indexing
          return uuidv7();
        },
      },
    },
  };

  // Log that we're using Better Auth defaults
  dbLogger.debug('Better Auth using default table naming', { 
    tables: ['user', 'session', 'account', 'verification']
  }, 'auth');

  // Return a fully configured instance for runtime use
  try {
    console.log('[Auth Init] Creating Better Auth instance with org plugin...');
    const authInstance = betterAuth(runtimeAuthConfig);
    console.log('[Auth Init] Better Auth instance created successfully');
    
    // Wrap the handler to catch database errors
    const originalHandler = authInstance.handler;
    authInstance.handler = async (request: Request) => {
      try {
        console.log('[Auth Handler] Processing request:', request.method, request.url);
        const result = await originalHandler(request);
        console.log('[Auth Handler] Request completed successfully');
        return result;
      } catch (error) {
        console.error('[Auth Handler] Caught error:', error);
        console.error('[Auth Handler] Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('[Auth Handler] Error stack:', error instanceof Error ? error.stack : 'No stack');
        
        // Return a proper error response instead of throwing
        return new Response(JSON.stringify({
          error: 'Authentication failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
    
    return authInstance;
  } catch (error) {
    console.error('[Auth Init] Better Auth initialization failed:', error);
    console.error('[Auth Init] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

// Export a function that initializes auth based on Hono context for runtime use
export const getAuth = (c: HonoAuthContext) => {
    return initializeAuth(c.env);
} 