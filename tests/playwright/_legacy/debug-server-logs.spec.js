// Debug test to understand server log format and find sync events
import { test, expect } from '@playwright/test';
import { createEntity, deleteEntity } from './db-test-helpers.js';
import { 
  captureServerLogs, 
  findSyncEventsInLogs,
  monitorServerLogsDuring 
} from './server-validation.js';

test.describe('Debug Server Logs', () => {
  test('investigate server log format and sync events', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    
    console.log('\n=== DEBUGGING SERVER LOGS ===\n');
    
    // First, let's see what the raw logs look like
    const rawLogs = await captureServerLogs(50);
    console.log('📜 RAW SERVER LOGS (last 50 lines):');
    console.log('=====================================');
    console.log(rawLogs);
    console.log('=====================================\n');
    
    // Create an entity and monitor logs
    console.log('🔄 Creating entity and monitoring logs...\n');
    
    const { testResult: task, logs, logSummary } = await monitorServerLogsDuring(
      async () => {
        return await createEntity(page, 'task', {
          title: 'TEST_Debug_Log_Task',
          description: 'Task to debug server logs',
          status: 'pending'
        });
      },
      {
        captureLines: 100
      }
    );
    
    console.log('✅ Created task:', task.id);
    console.log('📊 Log summary:', logSummary);
    console.log('\n📜 LOGS DURING ENTITY CREATION:');
    console.log('=====================================');
    logs.forEach((line, i) => console.log(`${i}: ${line}`));
    console.log('=====================================\n');
    
    // Search for the task ID in logs
    console.log(`🔍 Searching for task ID: ${task.id}\n`);
    const taskIdLogs = logs.filter(line => line.includes(task.id));
    console.log(`Found ${taskIdLogs.length} log lines containing task ID:`);
    taskIdLogs.forEach(line => console.log(`  - ${line}`));
    
    // Search for sync-related keywords
    console.log('\n🔍 Searching for sync-related keywords...\n');
    const syncKeywords = ['sync', 'replication', 'LSN', 'lsn', 'change', 'outgoing', 'incoming', 'WebSocket', 'ws', 'broadcast'];
    
    for (const keyword of syncKeywords) {
      const keywordLogs = logs.filter(line => line.toLowerCase().includes(keyword.toLowerCase()));
      if (keywordLogs.length > 0) {
        console.log(`📌 Found ${keywordLogs.length} lines with "${keyword}":`);
        keywordLogs.slice(0, 5).forEach(line => console.log(`  - ${line}`));
        if (keywordLogs.length > 5) {
          console.log(`  ... and ${keywordLogs.length - 5} more`);
        }
      }
    }
    
    // Look for any logs that might be related to database operations
    console.log('\n🔍 Searching for database operation logs...\n');
    const dbKeywords = ['INSERT', 'UPDATE', 'DELETE', 'task', 'entity', 'database', 'db', 'dexie'];
    
    for (const keyword of dbKeywords) {
      const dbLogs = logs.filter(line => line.toLowerCase().includes(keyword.toLowerCase()));
      if (dbLogs.length > 0) {
        console.log(`📌 Found ${dbLogs.length} lines with "${keyword}":`);
        dbLogs.slice(0, 3).forEach(line => console.log(`  - ${line}`));
      }
    }
    
    // Try the existing findSyncEventsInLogs function
    console.log('\n🔍 Using findSyncEventsInLogs helper...\n');
    const syncEvents = await findSyncEventsInLogs(task.id, 200);
    console.log(`Found ${syncEvents.length} sync events using helper:`);
    syncEvents.forEach(event => console.log(`  - ${event}`));
    
    // Check for any error logs
    console.log('\n❌ Checking for errors in logs...\n');
    const errorLogs = logs.filter(line => 
      line.includes('ERROR') || 
      line.includes('Error') || 
      line.includes('error') ||
      line.includes('failed') ||
      line.includes('Failed')
    );
    if (errorLogs.length > 0) {
      console.log(`Found ${errorLogs.length} error-related logs:`);
      errorLogs.forEach(line => console.log(`  - ${line}`));
    } else {
      console.log('No errors found in logs');
    }
    
    // Cleanup
    await deleteEntity(page, 'task', task.id);
    
    // Final analysis
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log('===================');
    console.log(`- Total log lines captured: ${logs.length}`);
    console.log(`- Lines containing task ID: ${taskIdLogs.length}`);
    console.log(`- Sync-related lines found: ${syncEvents.length}`);
    console.log(`- Error lines found: ${errorLogs.length}`);
    console.log('\nThis test helps understand the actual log format so we can improve our log parsing helpers.');
  });
});