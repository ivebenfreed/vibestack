import { Hono } from 'hono';
import type { AppContext } from './types/hono';
import { createDatabaseConnection, getKysely } from './lib/database-manager';

const app = new Hono<AppContext>();

/**
 * Test endpoint to demonstrate Hyperdrive + Kysely integration
 * GET /test-hyperdrive
 */
app.get('/test-hyperdrive', async (c) => {
  try {
    console.log('🧪 Testing Hyperdrive + Kysely integration...');
    console.log('🔍 HYPERDRIVE_DB:', c.env.HYPERDRIVE_DB ? {
      connectionString: c.env.HYPERDRIVE_DB.connectionString,
      host: c.env.HYPERDRIVE_DB.host,
      port: c.env.HYPERDRIVE_DB.port,
      user: c.env.HYPERDRIVE_DB.user
    } : 'undefined');
    console.log('🔍 DATABASE_URL:', c.env.DATABASE_URL ? 'defined' : 'undefined');
    
    createDatabaseConnection(c.env);
    const database = getKysely();
    
    // Test basic query
    const userCount = await database
      .selectFrom('user')
      .select(({ fn }) => [fn.count('id').as('total')])
      .executeTakeFirst();
    
    // Test table listing  
    const tables = await database
      .selectFrom('information_schema.tables' as any)
      .select(['table_name'])
      .where('table_schema', '=', 'public')
      .limit(5)
      .execute();
    
    console.log('✅ Hyperdrive queries successful!');
    
    return c.json({
      success: true,
      message: 'Hyperdrive + Kysely integration working!',
      data: {
        userCount: userCount?.total || 0,
        sampleTables: tables.map(t => t.table_name),
        connectionType: c.env.HYPERDRIVE_DB?.host?.includes('.hyperdrive.local') 
          ? 'Local (postgres.js)' 
          : c.env.HYPERDRIVE_DB 
          ? 'Hyperdrive (@neondatabase/serverless)' 
          : 'Neon (fallback)',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Hyperdrive test failed:', error);
    
    return c.json({
      success: false,
      error: error.message,
      connectionType: c.env.HYPERDRIVE_DB?.host?.includes('.hyperdrive.local') 
        ? 'Local (postgres.js)' 
        : c.env.HYPERDRIVE_DB 
        ? 'Hyperdrive (@neondatabase/serverless)' 
        : 'Neon (fallback)',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;