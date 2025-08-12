import { neonConfig } from '@neondatabase/serverless';

let isConfigured = false;

/**
 * Configure neon for local development with HTTP proxy
 * MUST be called before any neon() or Client instances are created
 */
export function configureNeonForLocal(databaseUrl: string): string {
  if (isConfigured) {
    // Already configured, just return the cleaned URL
    return databaseUrl.replace(':4444', '');
  }

  const isLocal = databaseUrl.includes('db.localtest.me');
  
  if (isLocal) {
    console.log('[neon-config] Configuring for local proxy');
    
    // Configure the fetch endpoint for the local proxy
    neonConfig.fetchEndpoint = (host) => {
      if (host === 'db.localtest.me') {
        return 'http://db.localtest.me:4444/sql';
      }
      return `https://${host}/sql`;
    };
    
    // Use standard fetch
    neonConfig.fetchFunction = fetch;
    
    isConfigured = true;
    
    // Return connection string WITHOUT port for neon library
    return databaseUrl.replace(':4444', '');
  }
  
  // Not local, return as-is
  return databaseUrl;
}

/**
 * Reset configuration (mainly for testing)
 */
export function resetNeonConfig() {
  isConfigured = false;
}