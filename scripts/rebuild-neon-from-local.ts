#!/usr/bin/env tsx
/**
 * Rebuild Neon database from scratch using local database structure
 * This creates a proper local-to-remote sync system
 */

import { Client } from 'pg';

// Connection configurations
const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'elevra_dev'
};

const remoteConfig = {
  connectionString: 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: true
};

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string;
}

async function getTableStructure(client: Client, tableName: string): Promise<TableInfo[]> {
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `;
  
  const result = await client.query(query, [tableName]);
  return result.rows;
}

async function getAllTables(client: Client): Promise<string[]> {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  
  return result.rows.map(row => row.table_name);
}

async function createTableInRemote(
  remoteClient: Client, 
  tableName: string, 
  columns: TableInfo[]
) {
  console.log(`📋 Creating table: ${tableName}`);
  
  const columnDefs = columns.map(col => {
    // Handle array types properly using udt_name
    let dataType = col.data_type;
    if (dataType === 'ARRAY') {
      // Map PostgreSQL udt_name to proper array syntax
      if (col.udt_name === '_text') {
        dataType = 'text[]';
      } else if (col.udt_name === '_varchar') {
        dataType = 'varchar[]';
      } else if (col.udt_name === '_int4') {
        dataType = 'integer[]';
      } else if (col.udt_name === '_uuid') {
        dataType = 'uuid[]';
      } else {
        // Default fallback for unknown array types
        dataType = 'text[]';
      }
    }
    
    let def = `"${col.column_name}" ${dataType}`;
    
    // Handle defaults
    if (col.column_default) {
      if (col.column_default.includes('generate_uuidv7()')) {
        // Keep UUID generation
        def += ` DEFAULT public.generate_uuidv7()`;
      } else if (col.column_default.includes('gen_random_uuid()')) {
        // Handle standard UUID generation
        def += ` DEFAULT gen_random_uuid()`;
      } else if (col.column_default.includes('now()')) {
        def += ` DEFAULT now()`;
      } else if (col.column_default.includes('CURRENT_TIMESTAMP')) {
        def += ` DEFAULT CURRENT_TIMESTAMP`;
      } else if (col.column_default === 'false') {
        def += ` DEFAULT false`;
      } else if (col.column_default === 'true') {
        def += ` DEFAULT true`;
      } else if (col.column_default.startsWith("'")) {
        def += ` DEFAULT ${col.column_default}`;
      }
    }
    
    // Handle nullable
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    return def;
  }).join(',\n  ');
  
  const createSQL = `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${columnDefs}\n);`;
  
  try {
    await remoteClient.query(createSQL);
    console.log(`✅ Created table: ${tableName}`);
  } catch (error) {
    console.log(`⚠️  Error creating ${tableName}:`, error.message);
    // Log the problematic SQL for debugging
    console.log(`   SQL: ${createSQL}`);
  }
}

async function syncTableData(
  localClient: Client,
  remoteClient: Client,
  tableName: string
): Promise<number> {
  console.log(`📊 Syncing data for: ${tableName}`);
  
  // Get local data
  const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
  const localRows = localResult.rows;
  
  if (localRows.length === 0) {
    console.log(`  ℹ️  No data to sync for ${tableName}`);
    return 0;
  }
  
  // Clear remote table first
  await remoteClient.query(`DELETE FROM public."${tableName}"`);
  
  // Insert data in batches to avoid conflicts
  let inserted = 0;
  for (const row of localRows) {
    try {
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.map(col => `"${col}"`).join(', ');
      
      const insertSQL = `INSERT INTO public."${tableName}" (${columnList}) VALUES (${placeholders})`;
      await remoteClient.query(insertSQL, values);
      inserted++;
    } catch (error) {
      console.log(`    ⚠️  Failed to insert row: ${error.message}`);
    }
  }
  
  console.log(`  ✅ Synced ${inserted}/${localRows.length} rows for ${tableName}`);
  return inserted;
}

async function main() {
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    
    // Set search path for remote client
    await remoteClient.query('SET search_path TO public');
    
    console.log('🗑️  Clearing remote database completely...');
    
    // Drop all tables in remote
    const remoteTables = await getAllTables(remoteClient);
    for (const table of remoteTables) {
      await remoteClient.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    console.log(`✅ Dropped ${remoteTables.length} remote tables`);
    
    console.log('📋 Getting local database structure...');
    const localTables = await getAllTables(localClient);
    console.log(`Found ${localTables.length} local tables`);
    
    console.log('🏗️  Creating table structures in remote...');
    
    // Create essential functions first
    try {
      await remoteClient.query(`
        CREATE OR REPLACE FUNCTION public.generate_uuidv7() RETURNS text
        LANGUAGE sql
        AS $$
          SELECT encode(
            set_bit(
              set_bit(
                overlay( uuid_send(gen_random_uuid())
                  placing substring(int8send(floor(extract(epoch from now()) * 1000)::bigint), 3, 6)
                  from 1 for 6
                ),
                52, 1
              ),
              53, 1
            ) ||
            set_bit(
              set_bit(
                substring(uuid_send(gen_random_uuid()), 9, 8),
                6, 0
              ),
              7, 1
            ),
            'hex'
          );
        $$;
      `);
      console.log('✅ Created UUID v7 function');
    } catch (error) {
      console.log('⚠️  UUID function creation failed:', error.message);
    }
    
    // Create all tables
    for (const tableName of localTables) {
      const structure = await getTableStructure(localClient, tableName);
      await createTableInRemote(remoteClient, tableName, structure);
    }
    
    console.log('📊 Syncing data in dependency order...');
    
    // Define sync order to handle foreign keys properly
    const syncOrder = [
      'organizations',
      'user',
      'account', 
      'session',
      'organization_members',
      'projects',
      'project_members',
      'entity_schemas',
      // Add other tables in dependency order
      ...localTables.filter(t => !['organizations', 'user', 'account', 'session', 'organization_members', 'projects', 'project_members', 'entity_schemas'].includes(t))
    ];
    
    let totalSynced = 0;
    const syncResults: Record<string, number> = {};
    
    for (const tableName of syncOrder) {
      if (localTables.includes(tableName)) {
        const synced = await syncTableData(localClient, remoteClient, tableName);
        syncResults[tableName] = synced;
        totalSynced += synced;
      }
    }
    
    console.log('\n🎉 Rebuild completed successfully!');
    console.log('\n📊 Sync Summary:');
    for (const [table, count] of Object.entries(syncResults)) {
      if (count > 0) {
        console.log(`  • ${table}: ${count} records`);
      }
    }
    console.log(`\n📈 Total records synced: ${totalSynced}`);
    
    // Verify key tables
    console.log('\n🔍 Verification:');
    const orgCount = await remoteClient.query('SELECT COUNT(*) FROM organizations');
    const userCount = await remoteClient.query('SELECT COUNT(*) FROM "user"');
    const projectCount = await remoteClient.query('SELECT COUNT(*) FROM projects');
    
    console.log(`  • Organizations: ${orgCount.rows[0].count}`);
    console.log(`  • Users: ${userCount.rows[0].count}`);
    console.log(`  • Projects: ${projectCount.rows[0].count}`);
    
    console.log('\n🔗 Your staging worker should now work with the synced data:');
    console.log('   https://elevra-worker-staging.team-c5f.workers.dev');
    
  } catch (error) {
    console.error('❌ Rebuild failed:', error);
    process.exit(1);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

// Run the main function
main().catch(console.error);