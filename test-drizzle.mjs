// Test Drizzle connection via PgBouncer
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

async function testDrizzle() {
  try {
    console.log('🧪 Testing Drizzle with PgBouncer...');

    // Connect to PgBouncer (should map to elevra_dev)
    const db = drizzle('postgres://postgres:postgres@localhost:6432/postgres');

    // Test query
    const result = await db.execute(sql`SELECT 'Drizzle + PgBouncer working!' as message, current_database() as database_name`);

    console.log('✅ Drizzle test successful:', result[0]);
    return true;

  } catch (error) {
    console.error('❌ Drizzle test failed:', error.message);
    return false;
  }
}

testDrizzle();