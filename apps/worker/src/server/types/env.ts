import type { DurableObjectNamespace, KVNamespace } from './cloudflare';

/**
 * Environment types for Cloudflare Workers
 */

// ExecutionContext for waitUntil operations
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  props: any;
}

export type DeploymentEnv = 'development' | 'staging' | 'production' | 'local';
export type LogLevel = 'error' | 'debug' | 'info' | 'warn';

// Hyperdrive interface for connection pooling
interface Hyperdrive {
  connectionString: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

/**
 * Environment configuration and bindings
 * Used directly for Workers and wrapped in { Bindings: Env } for Hono routes
 * 
 * Note: The index signature [key: string]: unknown is required for compatibility with Hono's Env type
 */
export interface Env {
  // Deployment environment (set by Cloudflare Workers)
  ENVIRONMENT: DeploymentEnv;

  // Database connection info
  DATABASE_URL: string;
  API_URL: string;
  NEON_API_KEY: string;
  TYPEORM_LOGGING: boolean;
  NODE_ENV: string;
  
  // Hyperdrive binding for PostgreSQL connection pooling
  HYPERDRIVE_DB?: Hyperdrive;
  
  // Auth variables
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  USE_KV_SESSIONS?: boolean;  // Feature flag for KV session storage
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  
  // Polar billing variables
  POLAR_ACCESS_TOKEN: string;
  POLAR_WEBHOOK_SECRET: string;
  POLAR_ENVIRONMENT: string;
  
  // Durable Object bindings (from wrangler.toml)
  SYNC: DurableObjectNamespace; 
  REPLICATION: DurableObjectNamespace;
  ORGANIZATION_ACTOR: DurableObjectNamespace;
  
  // KV namespace bindings (from wrangler.toml)
  CLIENT_REGISTRY: KVNamespace;
  SESSIONS: KVNamespace;
  
  // Assets binding for static files
  ASSETS?: Fetcher;

  // Rate limiting bindings (from wrangler.toml)
  auth_rate_limit?: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  };
  api_rate_limit?: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  };
  signup_rate_limit?: {
    limit(options: { key: string }): Promise<{ success: boolean }>
  };

  // Required for Hono compatibility
  [key: string]: unknown;
} 