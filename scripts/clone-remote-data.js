#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL;
const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';

// Tables to clone (in dependency order to handle foreign keys)
const TABLES_TO_CLONE = [
  'users',
  'projects', 
  'status_sets',
  'status_definitions',
  'tag_sets',
  'tags',
  'tasks',
  'comments',
  'project_members',
  'project_status_sets', 
  'project_tag_sets',
  'task_dependencies',
  'task_tags'
];

async function connectToRemote() {
  if (!REMOTE_DATABASE_URL) {
    throw new Error('REMOTE_DATABASE_URL environment variable is required');
  }
  
  console.log('🔗 Connecting to remote Neon database...');
  
  // Use regular pg client for remote connection (works better in Node.js CLI)
  const client = new Client({ 
    connectionString: REMOTE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  return client;
}

async function connectToLocal() {
  console.log('🔗 Connecting to local PostgreSQL database...');
  
  const client = new Client({
    connectionString: LOCAL_DATABASE_URL
  });
  
  await client.connect();
  return client;
}

async function getTableData(client, tableName) {
  console.log(`📊 Fetching data from ${tableName}...`);
  
  try {
    const result = await client.query(`SELECT * FROM "${tableName}" ORDER BY id`);
    console.log(`   Found ${result.rows.length} rows in ${tableName}`);
    return result.rows;
  } catch (error) {
    console.warn(`   ⚠️  Table ${tableName} not found or error: ${error.message}`);
    return [];
  }
}

async function clearLocalTable(client, tableName) {
  try {
    await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
    console.log(`   🗑️  Cleared ${tableName}`);
  } catch (error) {
    console.warn(`   ⚠️  Could not clear ${tableName}: ${error.message}`);
  }
}

async function insertData(client, tableName, rows) {
  if (rows.length === 0) {
    console.log(`   ⏭️  No data to insert for ${tableName}`);
    return;
  }

  try {
    // Get column names from the first row
    const columns = Object.keys(rows[0]);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    
    // Create placeholders for parameterized query
    const values = [];
    const placeholders = [];
    
    rows.forEach((row, rowIndex) => {
      const rowPlaceholders = [];
      columns.forEach((col, colIndex) => {
        const paramIndex = rowIndex * columns.length + colIndex + 1;
        rowPlaceholders.push(`$${paramIndex}`);
        values.push(row[col]);
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });
    
    const query = `
      INSERT INTO "${tableName}" (${columnNames}) 
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
      ${columns.filter(col => col !== 'id').map(col => `"${col}" = EXCLUDED."${col}"`).join(', ')}
    `;
    
    await client.query(query, values);
    console.log(`   ✅ Inserted ${rows.length} rows into ${tableName}`);
  } catch (error) {
    console.error(`   ❌ Error inserting data into ${tableName}:`, error.message);
    
    // Try individual inserts for better error reporting
    console.log(`   🔄 Trying individual inserts for ${tableName}...`);
    let successCount = 0;
    
    for (const row of rows) {
      try {
        const columns = Object.keys(row);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        const values = columns.map(col => row[col]);
        
        const query = `
          INSERT INTO "${tableName}" (${columnNames}) 
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET
          ${columns.filter(col => col !== 'id').map(col => `"${col}" = EXCLUDED."${col}"`).join(', ')}
        `;
        
        await client.query(query, values);
        successCount++;
      } catch (rowError) {
        console.error(`     ❌ Failed to insert row with id ${row.id}:`, rowError.message);
      }
    }
    
    console.log(`   ✅ Successfully inserted ${successCount}/${rows.length} rows into ${tableName}`);
  }
}

async function resetSequences(client) {
  console.log('🔄 Resetting auto-increment sequences...');
  
  for (const tableName of TABLES_TO_CLONE) {
    try {
      await client.query(`
        SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), 
                     COALESCE(MAX(id), 1)) 
        FROM "${tableName}"
      `);
      console.log(`   ✅ Reset sequence for ${tableName}`);
    } catch (error) {
      console.warn(`   ⚠️  Could not reset sequence for ${tableName}: ${error.message}`);
    }
  }
}

async function main() {
  let remoteClient, localClient;
  
  try {
    // Connect to both databases
    remoteClient = await connectToRemote();
    localClient = await connectToLocal();
    
    console.log('\n🚀 Starting data clone process...\n');
    
    // Clone each table
    for (const tableName of TABLES_TO_CLONE) {
      console.log(`\n📋 Processing table: ${tableName}`);
      
      // Get data from remote
      const data = await getTableData(remoteClient, tableName);
      
      if (data.length > 0) {
        // Clear local table
        await clearLocalTable(localClient, tableName);
        
        // Insert data into local
        await insertData(localClient, tableName, data);
      }
    }
    
    // Reset sequences to prevent ID conflicts
    await resetSequences(localClient);
    
    console.log('\n✅ Data clone completed successfully!');
    console.log('\n📊 Summary:');
    
    // Show final counts
    for (const tableName of TABLES_TO_CLONE) {
      try {
        const result = await localClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = result.rows[0].count;
        console.log(`   ${tableName}: ${count} rows`);
      } catch (error) {
        console.log(`   ${tableName}: table not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during data clone:', error);
    process.exit(1);
  } finally {
    // Close connections
    if (remoteClient) {
      try {
        await remoteClient.end();
        console.log('\n🔌 Disconnected from remote database');
      } catch (error) {
        console.error('Error closing remote connection:', error);
      }
    }
    
    if (localClient) {
      try {
        await localClient.end();
        console.log('🔌 Disconnected from local database');
      } catch (error) {
        console.error('Error closing local connection:', error);
      }
    }
  }
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📋 Clone Remote Database Data

Usage:
  node clone-remote-data.js

Environment Variables:
  REMOTE_DATABASE_URL - The remote Neon database URL to clone from
  
Example:
  REMOTE_DATABASE_URL="postgresql://user:pass@host/db" node clone-remote-data.js

This script will:
1. Connect to the remote Neon database
2. Connect to the local PostgreSQL database  
3. Copy all data from remote tables to local tables
4. Handle foreign key dependencies by processing tables in order
5. Reset auto-increment sequences to prevent ID conflicts

⚠️  WARNING: This will TRUNCATE all local table data before importing!
`);
  process.exit(0);
}

// Run the main function
main().catch(console.error);