import { betterAuth } from "better-auth";
// import { google } from "better-auth/providers";
import { admin, emailOTP, oneTimeToken } from "better-auth/plugins";
// import { jwt } from "better-auth/plugins"; // Removed JWT plugin import
import { NeonHTTPDialect } from "kysely-neon";
import { Hono, Context } from "hono";
import type { Env } from "../types/env";
import type { Dialect } from 'kysely';
import { Kysely, PostgresDialect } from 'kysely';
import { dbLogger } from '../middleware/logger';
import { Resend } from 'resend';

// Helper function to get allowed origins based on dynamic ports
function getAllowedOrigins(env: Env): string[] {
  const webPort = env.WEB_PORT || '5173';
  const origins = [
    `https://127.0.0.1:${webPort}`,
    `http://127.0.0.1:${webPort}`,
    `http://localhost:${webPort}`,
  ];
  
  // Add production origins
  if (env.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'staging') {
    origins.push(
      'https://dev.codevibesmatter.com',
      'https://app.codevibesmatter.com'
    );
  }
  
  return origins;
}

// Helper function to get base URL based on environment
function getBaseUrl(env: Env): string {
  const webPort = env.WEB_PORT || '5173';
  
  if (env.ENVIRONMENT === "development") {
    return `http://localhost:${webPort}`;
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
    emailAndPassword: { 
      enabled: true,
      sendResetPassword: async (data: any, request?: any) => {
        // CLI environment - skip email sending
        if (typeof process !== 'undefined') {
          console.log('Password reset email would be sent to:', data.user.email);
          console.log('Reset URL:', data.url);
          return;
        }
      }
    },
    // socialProviders: {
    //   google: {
    //     clientId: (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_ID : undefined) || '',
    //     clientSecret: (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_SECRET : undefined) || '',
    //   },
    // },
    emailVerification: {
      enabled: false, // Completely disable link-based email verification
      sendOnSignUp: false, // Disabled - we use OTP instead
      sendVerificationEmail: async (data: any, request?: any) => {
        // DISABLED - We use OTP verification instead
        if (typeof process !== 'undefined') {
          console.log('Link-based email verification disabled - using OTP instead');
        }
        return; // Don't send link-based verification emails
      }
    },
    plugins: [
      admin(),
      emailOTP({
        sendVerificationOTP: async (data: any, request?: any) => {
          // CLI environment - skip email sending
          if (typeof process !== 'undefined') {
            console.log('OTP would be sent to:', data.email);
            console.log('OTP code:', data.otp);
            console.log('Type:', data.type);
            return;
          }
          // Runtime email sending handled in runtime config
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        sendVerificationOnSignUp: true,
        allowedAttempts: 5
      }),
      oneTimeToken({
        expiresIn: 60 * 24, // 24 hours in minutes
      }),
    ],
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

  const trustedOrigins = getAllowedOrigins(env);
  
  dbLogger.debug("Initializing Better Auth", {
    databaseUrlType: typeof env.DATABASE_URL,
    secretType: typeof env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins
  }, 'auth');

  const runtimeAuthConfig = {
    // Pass the pre-configured Kysely instance and type
    database: {
      db: kyselyInstance,
      type: "postgres" as const,
      casing: "snake" as const // Use literal type
    },
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: getBaseUrl(env),
    cookieOptions: {
      secure: env.ENVIRONMENT !== "development", // ✅ FIX: Only secure in production/staging
      sameSite: "lax",
      path: "/",
      // ✅ FIX: Set domain for development to work with Vite proxy
      domain: env.ENVIRONMENT === "development" ? "localhost" : undefined,
    },
    trustedOrigins: trustedOrigins as string[],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async (data: any, request?: any) => {
        if (!env.RESEND_API_KEY) {
          dbLogger.error('RESEND_API_KEY environment variable is not set', {
            allEnvKeys: Object.keys(env),
            envResendKey: env.RESEND_API_KEY,
            environment: env.ENVIRONMENT
          }, 'auth');
          throw new Error('RESEND_API_KEY environment variable is required for sending emails');
        }
        
        const resend = new Resend(env.RESEND_API_KEY);
        
        // Detect if this is an invitation based on the redirect URL
        const isInvitation = data.url.includes('/set-password');
        
        // Get the base URL for the current environment
        const baseUrl = getBaseUrl(env);
        
        // Fix the URL for development - replace 127.0.0.1 with localhost:PORT
        let fullUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
        
        // In development, Better Auth may use 127.0.0.1 from the proxy request
        // Replace it with the correct localhost URL
        const webPort = env.WEB_PORT || '5173';
        if (env.ENVIRONMENT === "development" && fullUrl.includes('http://127.0.0.1/')) {
          fullUrl = fullUrl.replace('http://127.0.0.1/', `http://localhost:${webPort}/`);
        }
        
        try {
          if (isInvitation) {
            // Send invitation email
            await resend.emails.send({
              from: 'VibeStack <noreply@codevibesmatter.com>',
              to: data.user.email,
              subject: 'Welcome to VibeStack - Set Your Password',
              html: `
                <h1>Welcome to VibeStack!</h1>
                <p>You've been invited to join VibeStack. To set your password and activate your account, click the link below:</p>
                <a href="${fullUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0;">
                  Set Your Password
                </a>
                <p><strong>What's next?</strong></p>
                <ul>
                  <li>Click the link above to set your password</li>
                  <li>Verify your email address</li>
                  <li>Start using VibeStack!</li>
                </ul>
                <p style="color: #666; font-size: 14px;">This invitation link will expire in 24 hours for security. If you have any questions, please contact your administrator.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              `
            });
            dbLogger.info('User invitation email sent', { 
              email: data.user.email,
              invitationUrl: data.url 
            }, 'auth');
          } else {
            // Send password reset email
            await resend.emails.send({
              from: 'VibeStack <noreply@codevibesmatter.com>',
              to: data.user.email,
              subject: 'Reset your password',
              html: `
                <h1>Reset Your Password</h1>
                <p>You requested to reset your password. Click the link below to set a new password:</p>
                <a href="${fullUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  Reset Password
                </a>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
                <p>This link will expire in 15 minutes.</p>
              `
            });
            dbLogger.info('Password reset email sent', { 
              email: data.user.email,
              resetUrl: data.url 
            }, 'auth');
          }
        } catch (error) {
          dbLogger.error('Failed to send reset/invitation email', error, { 
            email: data.user.email,
            isInvitation 
          }, 'auth');
          throw error;
        }
      }
    },
    // socialProviders: {
    //   google: {
    //     clientId: env.GOOGLE_CLIENT_ID,
    //     clientSecret: env.GOOGLE_CLIENT_SECRET,
    //     redirectURI: `${env.ENVIRONMENT === "development" 
    //       ? "http://localhost:5173"  
    //       : env.ENVIRONMENT === "staging" 
    //         ? "https://dev.codevibesmatter.com" 
    //         : "https://app.codevibesmatter.com"}/api/auth/callback/google`,
    //   },
    // },
    emailVerification: {
      enabled: false, // Completely disable link-based email verification
      sendOnSignUp: false, // Disabled - we use OTP instead
      autoSignInAfterVerification: true,
      expiresIn: 3600, // 1 hour
      sendVerificationEmail: async (data: any, request?: any) => {
        // DISABLED - We use OTP verification instead
        dbLogger.info('Link-based email verification disabled - using OTP instead', { 
          email: data.user?.email 
        }, 'auth');
        return; // Don't send link-based verification emails
      }
    },
    databaseHooks: {
      user: {
        create: {
          before: async (userData: any, hookContext: any) => {
            dbLogger.debug('Auth Hook - user.create.before', {
              userData: JSON.stringify(userData, null, 2),
              originalRole: userData.role
            }, 'auth');
            
            // Ensure role is valid - map Better Auth defaults to our enum
            if (!userData.role || userData.role === 'user') {
              userData.role = 'member'; // Map Better Auth's default 'user' to our 'member'
              dbLogger.debug('Auth Hook - role mapped from user to member', {
                newRole: userData.role
              }, 'auth');
            }
            
            // Validate role is one of our allowed values
            const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
            if (!validRoles.includes(userData.role)) {
              dbLogger.warn('Auth Hook - invalid role detected, defaulting to member', {
                invalidRole: userData.role,
                validRoles
              }, 'auth');
              userData.role = 'member';
            }
            
            dbLogger.debug('Auth Hook - final user data', {
              finalRole: userData.role,
              userData: JSON.stringify(userData)
            }, 'auth');
            
            return { data: userData };
          },
        },
      },
    },
    // Add plugins
    plugins: [
      admin(),
      emailOTP({
        sendVerificationOTP: async (data: any, request?: any) => {
          if (!env.RESEND_API_KEY) {
            dbLogger.error('RESEND_API_KEY environment variable is not set for OTP', {
              allEnvKeys: Object.keys(env),
              envResendKey: env.RESEND_API_KEY,
              environment: env.ENVIRONMENT
            }, 'auth');
            throw new Error('RESEND_API_KEY environment variable is required for sending OTP emails');
          }
          
          const resend = new Resend(env.RESEND_API_KEY);
          
          // Get the base URL for the current environment
          const baseUrl = getBaseUrl(env);
          
          try {
            let subject = '';
            let content = '';
            
            switch (data.type) {
              case 'email-verification':
                subject = 'Verify your email - VibeStack';
                content = `
                  <h1>Verify Your Email</h1>
                  <p>Welcome to VibeStack! Please enter this verification code to complete your account setup:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1f2937;">${data.otp}</h2>
                  </div>
                  <p><strong>This code will expire in 5 minutes.</strong></p>
                  <p>If you didn't create an account with VibeStack, you can safely ignore this email.</p>
                `;
                break;
              case 'sign-in':
                subject = 'Sign in to VibeStack';
                content = `
                  <h1>Sign In to VibeStack</h1>
                  <p>Use this code to sign in to your VibeStack account:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1f2937;">${data.otp}</h2>
                  </div>
                  <p><strong>This code will expire in 5 minutes.</strong></p>
                  <p>If you didn't request this sign-in code, please ignore this email and consider changing your password.</p>
                `;
                break;
              case 'forget-password':
                subject = 'Reset your password - VibeStack';
                content = `
                  <h1>Reset Your Password</h1>
                  <p>You requested to reset your password. Use this code to continue:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1f2937;">${data.otp}</h2>
                  </div>
                  <p><strong>This code will expire in 5 minutes.</strong></p>
                  <p>If you didn't request a password reset, you can safely ignore this email.</p>
                `;
                break;
              default:
                subject = 'Your verification code - VibeStack';
                content = `
                  <h1>Your Verification Code</h1>
                  <p>Here's your verification code:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1f2937;">${data.otp}</h2>
                  </div>
                  <p><strong>This code will expire in 5 minutes.</strong></p>
                `;
            }
            
            await resend.emails.send({
              from: 'VibeStack <noreply@codevibesmatter.com>',
              to: data.email,
              subject: subject,
              html: content
            });
            
            dbLogger.info('OTP email sent', { 
              email: data.email,
              type: data.type,
              otpLength: data.otp.length
            }, 'auth');
            
          } catch (error) {
            dbLogger.error('Failed to send OTP email', error, { 
              email: data.email,
              type: data.type
            }, 'auth');
            throw error;
          }
        },
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        sendVerificationOnSignUp: true,
        allowedAttempts: 5
      }),
      oneTimeToken({
        expiresIn: 60 * 24, // 24 hours in minutes
      }),
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
        updatedAt: 'updated_at',
        // Include role in fields mapping so it's included in session data
        role: 'role'
      },
      additionalFields: {
        role: {
          type: "string" as const, // Matches UserRole enum (string values)
          required: false, // The DB has a default
          defaultValue: "member", // Default if not provided; DB default is also 'member'
          input: true, // Allow 'role' to be passed in the body of signUpEmail
          output: true // CRITICAL: Include role in session/user output
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