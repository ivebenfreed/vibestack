#!/usr/bin/env tsx

/**
 * Import JSON Data to Local Database
 * 
 * Transforms and imports exported JSON data into local PostgreSQL database
 * with proper schema mapping and relationship handling
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import pkg from 'pg';
const { Client } = pkg;

interface ImportStats {
  tablesProcessed: number;
  totalRecords: number;
  errors: string[];
  skipped: number;
}

class DataImporter {
  private localClient: any;
  private stats: ImportStats;
  private dataDir: string;

  constructor() {
    console.log('📥 Initializing data import to local database...');
    
    // Initialize local connection (PostgreSQL)
    this.localClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'vibestack_dev',
      user: 'postgres',
      password: 'postgres',
    });

    this.stats = {
      tablesProcessed: 0,
      totalRecords: 0,
      errors: [],
      skipped: 0
    };
    
    this.dataDir = resolve(process.cwd(), 'data-export');
  }

  async connect(): Promise<void> {
    await this.localClient.connect();
    console.log('✅ Connected to local database');
  }

  async disconnect(): Promise<void> {
    await this.localClient.end();
    console.log('✅ Disconnected from local database');
  }

  async loadJsonData(filename: string): Promise<any[]> {
    try {
      const filePath = resolve(this.dataDir, filename);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️  Could not load ${filename}:`, error.message);
      return [];
    }
  }

  async clearTable(tableName: string): Promise<void> {
    try {
      await this.localClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      console.log(`🗑️  Cleared existing data from ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to clear table ${tableName}:`, error.message);
      throw error;
    }
  }

  async importUsers(): Promise<void> {
    console.log('\n👥 Importing users...');
    
    const users = await this.loadJsonData('users.json');
    if (users.length === 0) {
      console.log('⏭️  No users to import');
      return;
    }

    await this.clearTable('user');
    
    let successful = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Map remote user structure to local structure
        const query = `
          INSERT INTO "user" (id, created_at, updated_at, name, email, email_verified, image, is_super_admin)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `;
        
        const values = [
          user.id,
          user.created_at,
          user.updated_at,
          user.name,
          user.email,
          user.email_verified || false,
          user.image,
          user.is_super_admin || false
        ];

        await this.localClient.query(query, values);
        successful++;

      } catch (error) {
        failed++;
        console.error(`❌ Failed to insert user ${user.id}:`, error.message);
        this.stats.errors.push(`User ${user.id}: ${error.message}`);
      }
    }

    console.log(`✅ Users: ${successful} inserted, ${failed} failed`);
    this.stats.tablesProcessed++;
    this.stats.totalRecords += successful;
  }

  async importAccounts(): Promise<void> {
    console.log('\n🔐 Importing accounts...');
    
    const accounts = await this.loadJsonData('accounts.json');
    if (accounts.length === 0) {
      console.log('⏭️  No accounts to import');
      return;
    }

    await this.clearTable('account');
    
    let successful = 0;
    let failed = 0;

    for (const account of accounts) {
      try {
        // Map remote account structure to local structure (no user_id foreign key)
        const query = `
          INSERT INTO "account" (id, created_at, updated_at, provider_id, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `;
        
        const values = [
          account.id,
          account.created_at,
          account.updated_at,
          account.provider_id,
          account.provider_account_id,
          account.refresh_token,
          account.access_token,
          account.expires_at,
          account.token_type,
          account.scope,
          account.id_token,
          account.session_state
        ];

        await this.localClient.query(query, values);
        successful++;

      } catch (error) {
        failed++;
        console.error(`❌ Failed to insert account ${account.id}:`, error.message);
        this.stats.errors.push(`Account ${account.id}: ${error.message}`);
      }
    }

    console.log(`✅ Accounts: ${successful} inserted, ${failed} failed`);
    this.stats.tablesProcessed++;
    this.stats.totalRecords += successful;
  }

  async linkUsersToAccounts(): Promise<void> {
    console.log('\n🔗 Linking users to accounts...');
    
    const users = await this.loadJsonData('users.json');
    const accounts = await this.loadJsonData('accounts.json');
    
    if (users.length === 0 || accounts.length === 0) {
      console.log('⏭️  No user-account links to create');
      return;
    }

    // Create a map of user_id -> account_id from remote accounts
    const userAccountMap = new Map();
    accounts.forEach(account => {
      if (account.user_id) {
        userAccountMap.set(account.user_id, account.id);
      }
    });

    let successful = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const accountId = userAccountMap.get(user.id);
        if (accountId) {
          const query = `
            UPDATE "user" 
            SET account_id = $1 
            WHERE id = $2
          `;
          
          await this.localClient.query(query, [accountId, user.id]);
          successful++;
        } else {
          console.warn(`⚠️  No account found for user ${user.id}`);
          this.stats.skipped++;
        }

      } catch (error) {
        failed++;
        console.error(`❌ Failed to link user ${user.id}:`, error.message);
        this.stats.errors.push(`User link ${user.id}: ${error.message}`);
      }
    }

    console.log(`✅ User-Account links: ${successful} created, ${failed} failed, ${this.stats.skipped} skipped`);
  }

  async importSessions(): Promise<void> {
    console.log('\n🔑 Importing sessions...');
    
    const sessions = await this.loadJsonData('sessions.json');
    const accounts = await this.loadJsonData('accounts.json');
    
    if (sessions.length === 0) {
      console.log('⏭️  No sessions to import');
      return;
    }

    await this.clearTable('session');
    
    // Create a map of user_id -> account_id from remote accounts
    const userAccountMap = new Map();
    accounts.forEach(account => {
      if (account.user_id) {
        userAccountMap.set(account.user_id, account.id);
      }
    });

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const session of sessions) {
      try {
        // Map user_id to account_id for local schema
        const accountId = userAccountMap.get(session.user_id);
        if (!accountId) {
          console.warn(`⚠️  No account found for session ${session.id} (user ${session.user_id})`);
          skipped++;
          continue;
        }

        const query = `
          INSERT INTO "session" (id, created_at, updated_at, session_token, expires_at, account_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `;
        
        // Use either session_token or token field
        const sessionToken = session.session_token || session.token;
        
        const values = [
          session.id,
          session.created_at,
          session.updated_at,
          sessionToken,
          session.expires_at,
          accountId
        ];

        await this.localClient.query(query, values);
        successful++;

      } catch (error) {
        failed++;
        console.error(`❌ Failed to insert session ${session.id}:`, error.message);
        this.stats.errors.push(`Session ${session.id}: ${error.message}`);
      }
    }

    console.log(`✅ Sessions: ${successful} inserted, ${failed} failed, ${skipped} skipped`);
    this.stats.tablesProcessed++;
    this.stats.totalRecords += successful;
  }

  async importVerifications(): Promise<void> {
    console.log('\n📧 Importing verifications...');
    
    const verifications = await this.loadJsonData('verifications.json');
    if (verifications.length === 0) {
      console.log('⏭️  No verifications to import');
      return;
    }

    await this.clearTable('verification');
    
    let successful = 0;
    let failed = 0;

    for (const verification of verifications) {
      try {
        const query = `
          INSERT INTO "verification" (id, created_at, updated_at, identifier, value, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `;
        
        const values = [
          verification.id,
          verification.created_at,
          verification.updated_at,
          verification.identifier,
          verification.value,
          verification.expires_at
        ];

        await this.localClient.query(query, values);
        successful++;

      } catch (error) {
        failed++;
        console.error(`❌ Failed to insert verification ${verification.id}:`, error.message);
        this.stats.errors.push(`Verification ${verification.id}: ${error.message}`);
      }
    }

    console.log(`✅ Verifications: ${successful} inserted, ${failed} failed`);
    this.stats.tablesProcessed++;
    this.stats.totalRecords += successful;
  }

  async import(): Promise<void> {
    console.log('🚀 Starting data import to local database...\n');

    try {
      await this.connect();

      // Import in dependency order
      await this.importUsers();
      await this.importAccounts(); 
      await this.linkUsersToAccounts();
      await this.importSessions();
      await this.importVerifications();

      // Print final statistics
      console.log('\n📊 Import Statistics:');
      console.log(`   Tables processed: ${this.stats.tablesProcessed}`);
      console.log(`   Total records imported: ${this.stats.totalRecords}`);
      console.log(`   Records skipped: ${this.stats.skipped}`);
      
      if (this.stats.errors.length > 0) {
        console.log(`   Errors encountered: ${this.stats.errors.length}`);
        console.log('\n❌ Errors:');
        this.stats.errors.slice(0, 10).forEach(error => console.log(`   - ${error}`));
        if (this.stats.errors.length > 10) {
          console.log(`   ... and ${this.stats.errors.length - 10} more errors`);
        }
      }

      console.log('\n✅ Import completed!');
      console.log('\n📝 Next steps:');
      console.log('   1. Test authentication with imported users');
      console.log('   2. Verify data integrity in local database');
      console.log('   3. Test application functionality');

    } catch (error) {
      console.error('💥 Import failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run import if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const importer = new DataImporter();
  importer.import().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { DataImporter };