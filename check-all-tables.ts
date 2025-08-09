import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), 'packages/dataforge/.env') });

const neonUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
if (\!neonUrl) throw new Error('No database URL found');
const sql = neon(neonUrl);

async function checkAllTables() {
  // Get all tables
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  console.log('Tables with camelCase columns:\n');
  
  for (const { table_name } of tables) {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${table_name}
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const camelCaseColumns = columns.filter(c => 
      c.column_name \!== c.column_name.toLowerCase() || 
      (c.column_name.match(/[A-Z]/) && \!c.column_name.includes('_'))
    );
    
    if (camelCaseColumns.length > 0) {
      console.log(`${table_name}:`);
      camelCaseColumns.forEach(c => console.log(`  - ${c.column_name}`));
    }
  }
  
  // Check migrations table to see what was last run
  console.log('\nLast 5 migrations:');
  const migrations = await sql`
    SELECT id, timestamp, name 
    FROM migrations 
    ORDER BY id DESC 
    LIMIT 5
  `;
  console.log(migrations);
}

checkAllTables().catch(console.error);
