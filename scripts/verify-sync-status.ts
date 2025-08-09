#!/usr/bin/env tsx
/**
 * Verify sync status between local and remote databases
 */

import { Client } from 'pg';

const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'vibestack_dev'
};

const remoteConfig = {
  connectionString: 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: true
};

async function main() {
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    console.log('✅ Connected\n');
    
    const tables = [
      'users', 'accounts', 'projects', 'tasks', 'comments',
      'tags', 'tag_sets', 'status_sets', 'status_definitions',
      'entity_dependencies', 'task_tags', 'project_tag_sets',
      'project_status_sets', 'sessions', 'verifications'
    ];
    
    console.log('📊 DATABASE SYNC STATUS REPORT\n');
    console.log('Table                 | Local  | Remote | Status');
    console.log('---------------------|--------|--------|------------------');
    
    let totalLocal = 0;
    let totalRemote = 0;
    
    for (const table of tables) {
      try {
        const localResult = await localClient.query(`SELECT COUNT(*) as count FROM ${table}`);
        const remoteResult = await remoteClient.query(`SELECT COUNT(*) as count FROM ${table}`);
        
        const localCount = parseInt(localResult.rows[0].count);
        const remoteCount = parseInt(remoteResult.rows[0].count);
        
        totalLocal += localCount;
        totalRemote += remoteCount;
        
        const padded = table.padEnd(20);
        const local = localCount.toString().padEnd(6);
        const remote = remoteCount.toString().padEnd(6);
        
        let status = '';
        if (localCount === remoteCount) {
          status = '✅ In sync';
        } else if (localCount < remoteCount) {
          status = `🔵 Remote has ${remoteCount - localCount} more`;
        } else {
          status = `🟡 Local has ${localCount - remoteCount} more`;
        }
        
        console.log(`${padded} | ${local} | ${remote} | ${status}`);
      } catch (error: any) {
        console.log(`${table.padEnd(20)} | ERROR  | ERROR  | ❌ ${error.message}`);
      }
    }
    
    console.log('---------------------|--------|--------|------------------');
    console.log(`TOTAL                | ${totalLocal.toString().padEnd(6)} | ${totalRemote.toString().padEnd(6)} |`);
    
    // Check for unique local records in key tables
    console.log('\n📋 UNIQUE RECORDS CHECK:\n');
    
    // Check projects
    const localProjects = await localClient.query('SELECT id, name FROM projects');
    const remoteProjects = await remoteClient.query('SELECT id FROM projects');
    const remoteProjectIds = new Set(remoteProjects.rows.map(r => r.id));
    const uniqueLocalProjects = localProjects.rows.filter(p => !remoteProjectIds.has(p.id));
    
    if (uniqueLocalProjects.length > 0) {
      console.log('🟡 Unique local projects:');
      uniqueLocalProjects.forEach(p => console.log(`   - ${p.name} (${p.id})`));
    } else {
      console.log('✅ All local projects exist in remote');
    }
    
    // Check tasks
    const localTasks = await localClient.query('SELECT id, title FROM tasks');
    const remoteTasks = await remoteClient.query('SELECT id FROM tasks');
    const remoteTaskIds = new Set(remoteTasks.rows.map(r => r.id));
    const uniqueLocalTasks = localTasks.rows.filter(t => !remoteTaskIds.has(t.id));
    
    if (uniqueLocalTasks.length > 0) {
      console.log('\n🟡 Unique local tasks:');
      uniqueLocalTasks.forEach(t => console.log(`   - ${t.title} (${t.id})`));
    } else {
      console.log('✅ All local tasks exist in remote');
    }
    
    console.log('\n✨ Sync verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

main().catch(console.error);