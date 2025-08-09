import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), 'packages/dataforge/.env') });

const neonUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
if (!neonUrl) throw new Error('No database URL found');
const sql = neon(neonUrl);

async function checkColumns() {
  // Check status_sets columns
  const statusSetsColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'status_sets' 
    ORDER BY ordinal_position
  `;
  
  console.log('status_sets columns:');
  console.log(statusSetsColumns);
  
  // Check tasks columns for tags field
  const tasksColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'tags'
    ORDER BY ordinal_position
  `;
  
  console.log('\ntasks.tags column:');
  console.log(tasksColumns);
  
  // Get a sample task with tags
  const sampleTask = await sql`
    SELECT id, title, tags 
    FROM tasks 
    WHERE tags IS NOT NULL 
    LIMIT 1
  `;
  
  console.log('\nSample task with tags:');
  console.log(sampleTask);
}

checkColumns().catch(console.error);
