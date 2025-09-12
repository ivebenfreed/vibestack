/**
 * Simplified Better Auth Configuration for Cloudflare Workers
 * Using direct postgres.js connection as recommended in the docs
 */

import { betterAuth } from "better-auth";
import { admin, emailOTP, oneTimeToken, twoFactor } from "better-auth/plugins";
import type { Env } from "../types/env";
import { createPostgresClient } from './db-simple';

/**
 * Get allowed origins for the unified worker
 */
function getAllowedOrigins(env: Env): string[] {
  const isDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
  
  if (isDev) {
    return [
      'http://localhost',
      'https://localhost', 
      'http://127.0.0.1',
      'https://127.0.0.1'
    ];
  } else {
    return [
      'https://dev.codevibesmatter.com',
      'https://app.codevibesmatter.com'
    ];
  }
}

/**
 * Get base URL for the unified worker
 */
function getBaseUrl(env: Env): string {
  if (env.ENVIRONMENT === "development" || env.ENVIRONMENT === "local") {
    return `http://localhost:5175`;
  } else if (env.ENVIRONMENT === "staging") {
    return "https://dev.codevibesmatter.com";
  } else {
    return "https://app.codevibesmatter.com";
  }
}

/**
 * Initialize Better Auth with simplified postgres.js connection
 * Following the Cloudflare Workers documentation pattern
 */
export function initializeAuth(env: Env) {
  console.log('🔐 Initializing Better Auth with simplified postgres.js connection...');

  // Create direct postgres.js client (Hyperdrive when available)
  const sql = createPostgresClient(env);
  const baseUrl = getBaseUrl(env);
  const trustedOrigins = getAllowedOrigins(env);

  console.log('📝 Better Auth config:', {
    baseUrl,
    trustedOrigins,
    hasHyperdrive: !!env.HYPERDRIVE_DB?.connectionString,
    hasDirectConnection: !!env.DATABASE_URL
  });

  return betterAuth({
    // Direct postgres.js connection as recommended in docs
    database: {
      db: sql,
      type: "postgres" as const
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: baseUrl,
    logger: {
      level: "debug",
      disabled: false
    },
    cookieOptions: {
      secure: env.ENVIRONMENT !== "development",
      sameSite: "lax",
      path: "/",
      domain: env.ENVIRONMENT === "development" ? "localhost" : undefined,
    },
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
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
      enabled: true,
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600 * 24, // 24 hours
    },
    plugins: [
      admin(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300, // 5 minutes  
        sendVerificationOnSignUp: true,
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
        skipVerificationOnSetup: false,
        backupCodes: {
          enabled: true,
          length: 8,
          count: 10,
        },
      }),
    ],
  });
}

// Export type for context
export type AuthType = {
  Variables: {
    user: ReturnType<typeof initializeAuth>['$Infer']['Session']['user'] | null;
    session: ReturnType<typeof initializeAuth>['$Infer']['Session']['session'] | null;
  };
  Bindings: Env;
};