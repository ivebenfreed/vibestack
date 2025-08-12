#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { neon, neonConfig } from '@neondatabase/serverless';

// Load environment variables from the correct staging configuration
// Explicitly use the remote database URL
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function testConnection() {
  try {
    console.log('🔍 Testing Neon connection...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    console.log('📡 Using DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^@]*@/, ':***@'));
    
    // Reset any local development overrides
    neonConfig.fetchEndpoint = undefined;
    
    const db = neon(process.env.DATABASE_URL);
    
    // Test basic connection
    console.log('⚡ Testing basic query...');
    const result = await db`SELECT NOW() as current_time, version() as pg_version`;
    
    console.log('✅ Connection successful!');
    console.log('📅 Current time:', result[0].current_time);
    console.log('🗄️  PostgreSQL version:', result[0].pg_version);
    
    // Test table listing
    console.log('\n🔍 Listing available tables...');
    const tables = await db`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('📊 Available tables:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // Test specific table data and structure
    console.log('\n🔍 Checking table structures and data...');
    
    const userCount = await db`SELECT COUNT(*) as count FROM users`;
    console.log(`👥 Users table contains ${userCount[0].count} records`);
    
    // Show ALL users
    console.log('\n📋 ALL Users in remote database:');
    const allUsers = await db`SELECT id, name, email, created_at FROM users ORDER BY created_at`;
    allUsers.forEach(user => {
      console.log(`   ${user.id} | ${user.name} | ${user.email} | ${user.created_at}`);
    });
    
    const accountCount = await db`SELECT COUNT(*) as count FROM accounts`;
    console.log(`🔐 Accounts table contains ${accountCount[0].count} records`);
    
    const sessionCount = await db`SELECT COUNT(*) as count FROM sessions`;
    console.log(`🔑 Sessions table contains ${sessionCount[0].count} records`);
    
    const projectCount = await db`SELECT COUNT(*) as count FROM projects`;
    console.log(`📁 Projects table contains ${projectCount[0].count} records`);
    
    const taskCount = await db`SELECT COUNT(*) as count FROM tasks`;
    console.log(`📋 Tasks table contains ${taskCount[0].count} records`);
    
    // Check column structures
    console.log('\n📋 Remote table column structures:');
    
    const accountColumns = await db`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'accounts' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('\n🔐 Accounts columns:');
    accountColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    const sessionColumns = await db`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sessions' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    console.log('\n🔑 Sessions columns:');
    sessionColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Sample data from each table
    console.log('\n📊 Sample data from remote tables:');
    
    if (userCount[0].count > 0) {
      const sampleUser = await db`SELECT * FROM users LIMIT 1`;
      console.log('\n👤 Sample user:', Object.keys(sampleUser[0]).join(', '));
    }
    
    if (accountCount[0].count > 0) {
      const sampleAccount = await db`SELECT * FROM accounts LIMIT 1`;
      console.log('🔐 Sample account:', Object.keys(sampleAccount[0]).join(', '));
    }
    
    if (sessionCount[0].count > 0) {
      const sampleSession = await db`SELECT * FROM sessions LIMIT 1`;
      console.log('🔑 Sample session:', Object.keys(sampleSession[0]).join(', '));
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    
    if (error.message.includes('fetch failed')) {
      console.log('\n💡 Suggestions:');
      console.log('   - Check if the Neon database is active');
      console.log('   - Verify the connection string is correct');
      console.log('   - Ensure network connectivity to AWS us-east-1');
    }
  }
}

// Run the test
testConnection();