import { EnvironmentConfig } from '../services/DatabaseProvisioningService.js';

/**
 * Database configuration for multi-tenant environments
 */
export class DatabaseConfig {
  /**
   * Get environment configuration based on environment variables
   */
  static getEnvironmentConfig(): EnvironmentConfig {
    const config: EnvironmentConfig = {
      multiTenantMode: (process.env.MULTI_TENANT_MODE as 'local' | 'production') || 'local',
      neonApiKey: process.env.NEON_API_KEY,
      localDbSchemaPrefix: process.env.LOCAL_DB_SCHEMA_PREFIX || 'org_',
      baseConnectionString: this.getBaseConnectionString()
    };

    this.validateConfiguration(config);
    return config;
  }

  /**
   * Validate environment configuration
   */
  private static validateConfiguration(config: EnvironmentConfig): void {
    const errors: string[] = [];

    if (!config.baseConnectionString) {
      errors.push('Base connection string is required (DATABASE_URL)');
    }

    if (config.multiTenantMode === 'production' && !config.neonApiKey) {
      errors.push('NEON_API_KEY is required when MULTI_TENANT_MODE=production');
    }

    if (config.multiTenantMode === 'local' && !config.localDbSchemaPrefix) {
      errors.push('LOCAL_DB_SCHEMA_PREFIX is required when MULTI_TENANT_MODE=local');
    }

    if (!['local', 'production'].includes(config.multiTenantMode)) {
      errors.push('MULTI_TENANT_MODE must be either "local" or "production"');
    }

    if (errors.length > 0) {
      throw new Error(`Database configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get base database connection string from environment
   */
  private static getBaseConnectionString(): string {
    // Try various common environment variable names for database URL
    return (
      process.env.DATABASE_URL ||
      process.env.DB_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRESQL_URL ||
      ''
    );
  }

  /**
   * Check if running in development mode
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
  }

  /**
   * Check if running in production mode
   */
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Get configuration summary for logging
   */
  static getConfigurationSummary(): object {
    const config = this.getEnvironmentConfig();
    
    return {
      multiTenantMode: config.multiTenantMode,
      hasNeonApiKey: !!config.neonApiKey,
      localDbSchemaPrefix: config.localDbSchemaPrefix,
      baseConnectionString: this.maskConnectionString(config.baseConnectionString),
      nodeEnv: process.env.NODE_ENV || 'undefined'
    };
  }

  /**
   * Mask sensitive information in connection string for logging
   */
  private static maskConnectionString(connectionString: string): string {
    if (!connectionString) return 'undefined';
    
    try {
      const url = new URL(connectionString);
      if (url.password) {
        url.password = '***';
      }
      return url.toString();
    } catch {
      return 'invalid_connection_string';
    }
  }
}

/**
 * Environment configuration validation at module load time
 */
export function validateEnvironmentAtStartup(): void {
  try {
    const config = DatabaseConfig.getEnvironmentConfig();
    const summary = DatabaseConfig.getConfigurationSummary();
    
    console.log('✅ Database configuration validated successfully');
    console.log('📊 Configuration summary:', summary);
    
    if (config.multiTenantMode === 'local') {
      console.log('🏠 Running in LOCAL multi-tenant mode (PostgreSQL schemas)');
    } else {
      console.log('🚀 Running in PRODUCTION multi-tenant mode (Neon API)');
    }
    
  } catch (error) {
    console.error('❌ Database configuration validation failed:');
    console.error(error instanceof Error ? error.message : error);
    
    if (DatabaseConfig.isProduction()) {
      throw error; // Fail fast in production
    } else {
      console.warn('⚠️ Continuing in development mode with configuration errors');
    }
  }
}