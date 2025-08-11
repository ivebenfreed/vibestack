#!/usr/bin/env tsx
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../apps/server/.dev.vars') });

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface SchemaComparison {
  tablesOnlyInLocal: string[];
  tablesOnlyInRemote: string[];
  tablesDifferent: Map<string, {
    columnsOnlyInLocal: string[];
    columnsOnlyInRemote: string[];
    columnsDifferent: Map<string, { local: any; remote: any }>;
  }>;
}

async function getSchema(connectionString: string): Promise<Map<string, Map<string, TableInfo>>> {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const query = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      JOIN information_schema.tables t 
        ON c.table_schema = t.table_schema 
        AND c.table_name = t.table_name
      WHERE c.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position;
    `;
    
    const result = await client.query<TableInfo>(query);
    const schema = new Map<string, Map<string, TableInfo>>();
    
    for (const row of result.rows) {
      if (!schema.has(row.table_name)) {
        schema.set(row.table_name, new Map());
      }
      schema.get(row.table_name)!.set(row.column_name, row);
    }
    
    return schema;
  } finally {
    await client.end();
  }
}

async function compareSchemas(): Promise<void> {
  const localUrl = process.env.LOCAL_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev';
  const remoteUrl = process.env.DATABASE_URL;
  
  if (!remoteUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  console.log('🔍 Fetching local schema...');
  const localSchema = await getSchema(localUrl);
  
  console.log('🔍 Fetching remote schema...');
  const remoteSchema = await getSchema(remoteUrl);
  
  const comparison: SchemaComparison = {
    tablesOnlyInLocal: [],
    tablesOnlyInRemote: [],
    tablesDifferent: new Map()
  };
  
  // Find tables only in local
  for (const tableName of localSchema.keys()) {
    if (!remoteSchema.has(tableName)) {
      comparison.tablesOnlyInLocal.push(tableName);
    }
  }
  
  // Find tables only in remote
  for (const tableName of remoteSchema.keys()) {
    if (!localSchema.has(tableName)) {
      comparison.tablesOnlyInRemote.push(tableName);
    }
  }
  
  // Compare common tables
  for (const tableName of localSchema.keys()) {
    if (remoteSchema.has(tableName)) {
      const localTable = localSchema.get(tableName)!;
      const remoteTable = remoteSchema.get(tableName)!;
      
      const tableDiff = {
        columnsOnlyInLocal: [] as string[],
        columnsOnlyInRemote: [] as string[],
        columnsDifferent: new Map<string, { local: any; remote: any }>()
      };
      
      // Find columns only in local
      for (const columnName of localTable.keys()) {
        if (!remoteTable.has(columnName)) {
          tableDiff.columnsOnlyInLocal.push(columnName);
        }
      }
      
      // Find columns only in remote
      for (const columnName of remoteTable.keys()) {
        if (!localTable.has(columnName)) {
          tableDiff.columnsOnlyInRemote.push(columnName);
        }
      }
      
      // Compare common columns
      for (const columnName of localTable.keys()) {
        if (remoteTable.has(columnName)) {
          const localCol = localTable.get(columnName)!;
          const remoteCol = remoteTable.get(columnName)!;
          
          if (localCol.data_type !== remoteCol.data_type ||
              localCol.is_nullable !== remoteCol.is_nullable) {
            tableDiff.columnsDifferent.set(columnName, {
              local: {
                data_type: localCol.data_type,
                is_nullable: localCol.is_nullable,
                column_default: localCol.column_default
              },
              remote: {
                data_type: remoteCol.data_type,
                is_nullable: remoteCol.is_nullable,
                column_default: remoteCol.column_default
              }
            });
          }
        }
      }
      
      // Only add to differences if there are actual differences
      if (tableDiff.columnsOnlyInLocal.length > 0 ||
          tableDiff.columnsOnlyInRemote.length > 0 ||
          tableDiff.columnsDifferent.size > 0) {
        comparison.tablesDifferent.set(tableName, tableDiff);
      }
    }
  }
  
  // Print results
  console.log('\n📊 Schema Comparison Results\n');
  console.log('=====================================\n');
  
  if (comparison.tablesOnlyInLocal.length > 0) {
    console.log('📦 Tables only in LOCAL:');
    for (const table of comparison.tablesOnlyInLocal) {
      console.log(`  ✅ ${table}`);
    }
    console.log();
  }
  
  if (comparison.tablesOnlyInRemote.length > 0) {
    console.log('☁️  Tables only in REMOTE:');
    for (const table of comparison.tablesOnlyInRemote) {
      console.log(`  ⚠️  ${table}`);
    }
    console.log();
  }
  
  if (comparison.tablesDifferent.size > 0) {
    console.log('🔄 Tables with differences:');
    for (const [tableName, diff] of comparison.tablesDifferent) {
      console.log(`\n  Table: ${tableName}`);
      
      if (diff.columnsOnlyInLocal.length > 0) {
        console.log('    Columns only in LOCAL:');
        for (const col of diff.columnsOnlyInLocal) {
          console.log(`      ✅ ${col}`);
        }
      }
      
      if (diff.columnsOnlyInRemote.length > 0) {
        console.log('    Columns only in REMOTE:');
        for (const col of diff.columnsOnlyInRemote) {
          console.log(`      ⚠️  ${col}`);
        }
      }
      
      if (diff.columnsDifferent.size > 0) {
        console.log('    Columns with type differences:');
        for (const [colName, colDiff] of diff.columnsDifferent) {
          console.log(`      🔀 ${colName}:`);
          console.log(`         Local:  ${colDiff.local.data_type} (nullable: ${colDiff.local.is_nullable})`);
          console.log(`         Remote: ${colDiff.remote.data_type} (nullable: ${colDiff.remote.is_nullable})`);
        }
      }
    }
    console.log();
  }
  
  // Summary
  const hasNoChanges = comparison.tablesOnlyInLocal.length === 0 &&
                       comparison.tablesOnlyInRemote.length === 0 &&
                       comparison.tablesDifferent.size === 0;
  
  if (hasNoChanges) {
    console.log('✅ Schemas are identical!');
  } else {
    console.log('Summary:');
    console.log(`  • Tables only in local: ${comparison.tablesOnlyInLocal.length}`);
    console.log(`  • Tables only in remote: ${comparison.tablesOnlyInRemote.length}`);
    console.log(`  • Tables with differences: ${comparison.tablesDifferent.size}`);
    
    // Migration hints
    if (comparison.tablesOnlyInRemote.length > 0) {
      console.log('\n⚠️  Warning: Remote has tables not in local. You may need to:');
      console.log('  1. Pull latest changes from remote');
      console.log('  2. Run pending migrations');
      console.log('  3. Or create reverse migrations if these tables should be removed');
    }
    
    if (comparison.tablesOnlyInLocal.length > 0) {
      console.log('\n📝 Note: Local has new tables. You may need to:');
      console.log('  1. Create and apply migrations to remote');
      console.log('  2. Or remove these tables if they were created by mistake');
    }
  }
}

// Run the comparison
compareSchemas().catch(console.error);