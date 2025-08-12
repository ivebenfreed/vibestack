import type { NeonConfig } from '@neondatabase/serverless';

export interface NeonHTTPDialectConfig {
  /**
   * PostgreSQL connection string
   * Can be either pooler or direct endpoint - will be auto-detected
   */
  connectionString: string;
  
  /**
   * Enable auto-detection of local development environment
   * @default true
   */
  autoDetect?: boolean;
  
  /**
   * Enable auto-routing: use pooler for queries, direct for DDL
   * Only applies to Neon cloud connections
   * @default true
   */
  autoRouting?: boolean;
  
  /**
   * Port for local Neon proxy (when auto-detected or manually configured)
   * @default 4444
   */
  localProxyPort?: number;
  
  /**
   * Path for local Neon proxy endpoint
   * @default '/sql'
   */
  localProxyPath?: string;
  
  /**
   * Manual override for fetch endpoint
   * If provided, disables auto-detection
   */
  fetchEndpoint?: string | ((host: string) => string);
  
  /**
   * Custom fetch function
   * @default globalThis.fetch
   */
  fetchFunction?: typeof fetch;
  
  /**
   * Additional Neon configuration
   */
  neonConfig?: Partial<NeonConfig>;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}