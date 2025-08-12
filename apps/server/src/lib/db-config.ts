import { Client, neonConfig } from '@neondatabase/serverless';

/**
 * Configure neon for local development and return a properly configured connection string
 */
export function configureNeonLocal(databaseUrl: string): { connectionString: string; isLocal: boolean } {
  const isLocal = databaseUrl.includes('db.localtest.me');
  
  if (isLocal) {
    // Configure for local HTTP proxy
    neonConfig.fetchEndpoint = (host) => {
      if (host === 'db.localtest.me') {
        return 'http://db.localtest.me:4444/sql';
      }
      return `https://${host}/sql`;
    };
    neonConfig.fetchFunction = fetch;
    
    // Configure for WebSocket (needed for Client class but disabled in Workers)
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => `${host}:4444/v1`;
    // In Cloudflare Workers, we can't use WebSocket for Client
    neonConfig.webSocketConstructor = undefined;
    
    // Remove port from connection string for neon library
    const connectionString = databaseUrl.replace(':4444', '');
    return { connectionString, isLocal };
  }
  
  return { connectionString: databaseUrl, isLocal: false };
}

/**
 * Create a test client to verify connection works
 */
export async function testConnection(databaseUrl: string): Promise<boolean> {
  console.log('[testConnection] Starting with URL:', databaseUrl);
  const { connectionString, isLocal } = configureNeonLocal(databaseUrl);
  console.log('[testConnection] After config - connectionString:', connectionString, 'isLocal:', isLocal);
  
  // In Cloudflare Workers, we can't use Client.connect() for local dev
  // We have to use the neon() function instead
  if (isLocal) {
    try {
      console.log('[testConnection] Using neon() function for local test');
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(connectionString);
      console.log('[testConnection] Running test query with neon()...');
      const result = await sql`SELECT 1 as test`;
      console.log('[testConnection] neon() query successful:', result);
      return true;
    } catch (error) {
      console.error('[testConnection] neon() test failed:', error);
      return false;
    }
  }
  
  // For non-local, try Client
  const clientConfig = {
    connectionString,
    ssl: true
  };
  
  const client = new Client(clientConfig);
  
  try {
    console.log('[testConnection] Connecting with Client...');
    await client.connect();
    console.log('[testConnection] Connected! Running query...');
    await client.query('SELECT 1');
    console.log('[testConnection] Query successful! Ending connection...');
    await client.end();
    console.log('[testConnection] Connection closed successfully');
    return true;
  } catch (error) {
    console.error('[testConnection] Client test failed:', error);
    return false;
  }
}