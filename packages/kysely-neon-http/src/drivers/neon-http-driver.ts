import { DatabaseConnection, Driver, TransactionSettings } from 'kysely';
import { neon, neonConfig } from '@neondatabase/serverless';
import { NeonHTTPConnection } from '../connections/neon-http-connection';
import type { NeonHTTPDialectConfig } from '../types';

export class NeonHTTPDriver implements Driver {
  private config: NeonHTTPDialectConfig;
  private connectionPromise?: Promise<void>;

  constructor(config: NeonHTTPDialectConfig) {
    // Set defaults for auto-detection and auto-routing
    this.config = {
      autoDetect: true,
      autoRouting: true,
      ...config,
    };
    this.configureNeon();
  }

  private configureNeon(): void {
    // Apply user-provided neonConfig first
    if (this.config.neonConfig) {
      Object.assign(neonConfig, this.config.neonConfig);
    }

    // Configure fetch function
    if (this.config.fetchFunction) {
      neonConfig.fetchFunction = this.config.fetchFunction;
    } else {
      neonConfig.fetchFunction = fetch;
    }

    // Configure fetch endpoint
    this.configureFetchEndpoint();
  }

  private configureFetchEndpoint(): void {
    // Manual override takes precedence
    if (this.config.fetchEndpoint) {
      neonConfig.fetchEndpoint = this.config.fetchEndpoint;
      if (this.config.debug) {
        console.log('[NeonHTTPDriver] Using manual fetch endpoint');
      }
      return;
    }

    // Skip auto-detection if disabled
    if (this.config.autoDetect === false) {
      if (this.config.debug) {
        console.log('[NeonHTTPDriver] Auto-detection disabled');
      }
      return;
    }

    // Auto-detect local development
    const { connectionString } = this.config;
    if (this.isLocalConnection(connectionString)) {
      const port = this.config.localProxyPort ?? 4444;
      const path = this.config.localProxyPath ?? '/sql';
      const host = this.extractLocalHost(connectionString);
      
      neonConfig.fetchEndpoint = (neonHost) => {
        // Only override for matching local hosts
        if (neonHost === host) {
          const endpoint = `http://${host}:${port}${path}`;
          if (this.config.debug) {
            console.log(`[NeonHTTPDriver] Auto-configured local proxy: ${endpoint}`);
          }
          return endpoint;
        }
        // Use Neon default for other hosts
        return `https://${neonHost}/sql`;
      };
    } else if (this.config.debug) {
      console.log('[NeonHTTPDriver] Using production Neon endpoint');
    }
  }

  private isLocalConnection(connectionString: string): boolean {
    return connectionString.includes('db.localtest.me') ||
           connectionString.includes('localhost') ||
           connectionString.includes('127.0.0.1');
  }

  private extractLocalHost(connectionString: string): string {
    // Extract host from connection string
    const match = connectionString.match(/@([^:\/]+)/);
    return match ? match[1] : 'db.localtest.me';
  }

  async init(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.testConnection();
    return this.connectionPromise;
  }

  private async testConnection(): Promise<void> {
    const cleanConnectionString = this.cleanConnectionString(this.config.connectionString);
    const sql = neon(cleanConnectionString);

    try {
      await sql`SELECT 1 as test`;
      if (this.config.debug) {
        console.log('[NeonHTTPDriver] Connection test successful');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`NeonHTTPDriver: Failed to connect - ${message}`);
    }
  }

  private cleanConnectionString(connectionString: string): string {
    // Remove port from local connections as HTTP endpoint doesn't use it
    if (connectionString.includes('db.localtest.me')) {
      return connectionString.replace(/:(\d+)/, '');
    }
    return connectionString;
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return new NeonHTTPConnection(this.config);
  }

  async beginTransaction(
    _connection: DatabaseConnection,
    _settings: TransactionSettings
  ): Promise<void> {
    // HTTP mode doesn't support transactions
    throw new Error(
      'NeonHTTPDriver: Transactions are not supported in HTTP mode. ' +
      'HTTP connections are stateless and cannot maintain transaction state.'
    );
  }

  async commitTransaction(_connection: DatabaseConnection): Promise<void> {
    throw new Error('NeonHTTPDriver: Transactions are not supported in HTTP mode');
  }

  async rollbackTransaction(_connection: DatabaseConnection): Promise<void> {
    throw new Error('NeonHTTPDriver: Transactions are not supported in HTTP mode');
  }

  async releaseConnection(_connection: DatabaseConnection): Promise<void> {
    // HTTP connections are stateless, nothing to release
  }

  async destroy(): Promise<void> {
    // Nothing to destroy for HTTP connections
    this.connectionPromise = undefined;
  }
}