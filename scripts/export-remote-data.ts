#!/usr/bin/env tsx

/**
 * Export Remote Data to JSON
 * 
 * Exports all data from the remote Neon database to JSON files for easier processing
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { neon, neonConfig } from '@neondatabase/serverless';

// Explicitly use the remote Neon database URL
const REMOTE_DATABASE_URL = 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

interface ExportStats {
  tablesExported: number;
  totalRecords: number;
  errors: string[];
}

class DataExporter {
  private remoteDb: any;
  private stats: ExportStats;
  private outputDir: string;

  constructor() {
    console.log('📦 Initializing data export from remote Neon database...');
    
    // Configure Neon for external connection
    neonConfig.fetchEndpoint = undefined;
    this.remoteDb = neon(REMOTE_DATABASE_URL);
    
    this.stats = {
      tablesExported: 0,
      totalRecords: 0,
      errors: []
    };
    
    this.outputDir = resolve(process.cwd(), 'data-export');
  }

  async ensureOutputDir(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.outputDir}`);
    } catch (error) {
      console.error('❌ Failed to create output directory:', error);
      throw error;
    }
  }

  async exportTable(tableName: string): Promise<void> {
    try {
      console.log(`\n📊 Exporting table: ${tableName}`);
      
      // Get all data from the table
      let data: any[];
      switch (tableName) {
        case 'users':
          data = await this.remoteDb`SELECT * FROM users ORDER BY created_at ASC`;
          break;
        case 'accounts':
          data = await this.remoteDb`SELECT * FROM accounts ORDER BY created_at ASC`;
          break;
        case 'sessions':
          data = await this.remoteDb`SELECT * FROM sessions ORDER BY created_at ASC`;
          break;
        case 'verifications':
          data = await this.remoteDb`SELECT * FROM verifications ORDER BY created_at ASC`;
          break;
        case 'projects':
          data = await this.remoteDb`SELECT * FROM projects ORDER BY created_at ASC`;
          break;
        case 'tasks':
          data = await this.remoteDb`SELECT * FROM tasks ORDER BY created_at ASC`;
          break;
        case 'project_members':
          data = await this.remoteDb`SELECT * FROM project_members ORDER BY created_at ASC`;
          break;
        case 'task_dependencies':
          data = await this.remoteDb`SELECT * FROM task_dependencies ORDER BY created_at ASC`;
          break;
        case 'comments':
          data = await this.remoteDb`SELECT * FROM comments ORDER BY created_at ASC`;
          break;
        case 'tags':
          data = await this.remoteDb`SELECT * FROM tags ORDER BY created_at ASC`;
          break;
        case 'task_tags':
          data = await this.remoteDb`SELECT * FROM task_tags ORDER BY created_at ASC`;
          break;
        default:
          console.log(`⚠️  Skipping unsupported table: ${tableName}`);
          return;
      }
      
      console.log(`📊 Found ${data.length} records in ${tableName}`);
      
      if (data.length === 0) {
        console.log(`⏭️  No data to export for ${tableName}`);
        return;
      }
      
      // Convert any Date objects to ISO strings for JSON serialization
      const serializedData = data.map(record => {
        const serializedRecord: any = {};
        for (const [key, value] of Object.entries(record)) {
          if (value instanceof Date) {
            serializedRecord[key] = value.toISOString();
          } else {
            serializedRecord[key] = value;
          }
        }
        return serializedRecord;
      });
      
      // Write to JSON file
      const outputPath = resolve(this.outputDir, `${tableName}.json`);
      await writeFile(outputPath, JSON.stringify(serializedData, null, 2));
      
      console.log(`✅ Exported ${data.length} records to ${outputPath}`);
      
      this.stats.tablesExported++;
      this.stats.totalRecords += data.length;
      
    } catch (error) {
      console.error(`❌ Failed to export table ${tableName}:`, error);
      this.stats.errors.push(`Failed to export ${tableName}: ${error.message}`);
    }
  }

  async exportMetadata(): Promise<void> {
    try {
      console.log('\n📋 Exporting table metadata...');
      
      // Get table structures
      const tableInfo = await this.remoteDb`
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'accounts', 'sessions', 'verifications', 'projects', 'tasks', 'project_members', 'task_dependencies', 'comments', 'tags', 'task_tags')
        ORDER BY table_name, ordinal_position
      `;
      
      // Group by table
      const tableStructures: Record<string, any[]> = {};
      tableInfo.forEach(col => {
        if (!tableStructures[col.table_name]) {
          tableStructures[col.table_name] = [];
        }
        tableStructures[col.table_name].push({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
          position: col.ordinal_position
        });
      });
      
      // Export metadata
      const metadataPath = resolve(this.outputDir, 'table-metadata.json');
      await writeFile(metadataPath, JSON.stringify({
        exportDate: new Date().toISOString(),
        databaseVersion: 'PostgreSQL 17.5',
        tables: tableStructures
      }, null, 2));
      
      console.log(`✅ Exported metadata to ${metadataPath}`);
      
    } catch (error) {
      console.error('❌ Failed to export metadata:', error);
      this.stats.errors.push(`Failed to export metadata: ${error.message}`);
    }
  }

  async export(): Promise<void> {
    console.log('🚀 Starting data export from remote database...\n');
    
    try {
      await this.ensureOutputDir();
      
      // Export all relevant tables
      const tablesToExport = [
        'users',
        'accounts', 
        'sessions',
        'verifications',
        'projects',
        'tasks',
        'project_members',
        'task_dependencies', 
        'comments',
        'tags',
        'task_tags'
      ];
      
      for (const table of tablesToExport) {
        await this.exportTable(table);
      }
      
      // Export metadata
      await this.exportMetadata();
      
      // Print final statistics
      console.log('\n📊 Export Statistics:');
      console.log(`   Tables exported: ${this.stats.tablesExported}`);
      console.log(`   Total records: ${this.stats.totalRecords}`);
      console.log(`   Output directory: ${this.outputDir}`);
      
      if (this.stats.errors.length > 0) {
        console.log(`   Errors encountered: ${this.stats.errors.length}`);
        console.log('\n❌ Errors:');
        this.stats.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      console.log('\n✅ Export completed!');
      console.log('\n📝 Next steps:');
      console.log('   1. Review exported JSON files in data-export/');
      console.log('   2. Run the import script to load data into local database');
      console.log('   3. Verify data integrity after import');
      
    } catch (error) {
      console.error('💥 Export failed:', error);
      throw error;
    }
  }
}

// Run export if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const exporter = new DataExporter();
  exporter.export().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { DataExporter };