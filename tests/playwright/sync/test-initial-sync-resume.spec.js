/**
 * Test: Initial Sync Resume Capability
 * Scenario: Test if initial sync can resume after disconnection
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';
import { clearAllSyncState } from '../helpers/sync-test-setup.js';

test.describe('Initial Sync Resume Test', () => {
  test('should handle disconnection during initial sync', async ({ page }) => {
    console.log('🚀 Testing initial sync resume capability...\n');
    console.log('='.repeat(60));
    
    // Navigate to the page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    // Clear all sync state to simulate fresh client
    console.log('\n🧹 Clearing sync state for fresh start...');
    await clearAllSyncState(page);
    
    // Set up message interception
    const messages = [];
    await page.evaluate(() => {
      window.interceptedMessages = [];
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        window.interceptedMessages.push({ type: 'sent', data: JSON.parse(data) });
        return originalSend.call(this, data);
      };
    });
    
    // Also intercept incoming messages
    await page.evaluate(() => {
      // Override WebSocket to capture incoming messages
      const OriginalWebSocket = window.WebSocket;
      window.WebSocket = class extends OriginalWebSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              window.interceptedMessages.push({ type: 'received', data });
              
              // Simulate disconnection after receiving 2 tables
              if (data.type === 'srv_init_changes' && data.table) {
                const tablesReceived = new Set(
                  window.interceptedMessages
                    .filter(m => m.type === 'received' && m.data.type === 'srv_init_changes' && m.data.table)
                    .map(m => m.data.table)
                );
                
                console.log(`Tables received so far: ${Array.from(tablesReceived).join(', ')}`);
                
                if (tablesReceived.size === 2) {
                  console.log('🔌 Disconnecting after 2 tables...');
                  this.close();
                }
              }
            } catch (e) {
              // Not JSON, ignore
            }
          });
        }
      };
    });
    
    // Reload to trigger initial sync
    console.log('🔄 Reloading page to trigger initial sync...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Wait a bit for sync to start
    await page.waitForTimeout(3000);
    
    // Check what was received before disconnection
    const firstSyncData = await page.evaluate(() => {
      const messages = window.interceptedMessages || [];
      const tablesReceived = new Set();
      const tableData = {};
      
      messages.forEach(m => {
        if (m.type === 'received' && m.data.type === 'srv_init_changes' && m.data.table) {
          tablesReceived.add(m.data.table);
          if (!tableData[m.data.table]) {
            tableData[m.data.table] = {
              chunks: 0,
              records: 0,
              tableIndex: m.data.tableIndex,
              totalTables: m.data.totalTables
            };
          }
          tableData[m.data.table].chunks++;
          tableData[m.data.table].records += m.data.changes ? m.data.changes.length : 0;
        }
      });
      
      return {
        tablesReceived: Array.from(tablesReceived),
        tableData,
        totalMessages: messages.length
      };
    });
    
    console.log('\n📊 First Sync Attempt:');
    console.log(`   Tables received: ${firstSyncData.tablesReceived.join(', ')}`);
    console.log(`   Total messages: ${firstSyncData.totalMessages}`);
    Object.entries(firstSyncData.tableData).forEach(([table, data]) => {
      console.log(`   ${table}: ${data.records} records in ${data.chunks} chunks (table ${data.tableIndex + 1}/${data.totalTables})`);
    });
    
    // Wait for reconnection
    console.log('\n⏳ Waiting for reconnection...');
    await page.waitForTimeout(2000);
    
    // Check if sync resumes or restarts
    await page.waitForFunction(() => {
      const state = window.xstateTestInspector?.getCurrentState('sync-machine-v3');
      return state === 'live_sync' || state === 'initial_sync';
    }, { timeout: 15000 }).catch(() => {
      console.log('Timeout waiting for sync state');
    });
    
    // Get final sync data
    const finalSyncData = await page.evaluate(() => {
      const messages = window.interceptedMessages || [];
      const tablesReceived = new Set();
      const tableData = {};
      let hasCompleteMessage = false;
      let reconnectCount = 0;
      
      messages.forEach((m, index) => {
        if (m.type === 'sent' && m.data.type === 'clt_sync_init') {
          reconnectCount++;
        }
        if (m.type === 'received' && m.data.type === 'srv_init_complete') {
          hasCompleteMessage = true;
        }
        if (m.type === 'received' && m.data.type === 'srv_init_changes' && m.data.table) {
          tablesReceived.add(m.data.table);
          if (!tableData[m.data.table]) {
            tableData[m.data.table] = {
              chunks: 0,
              records: 0,
              receivedAfterReconnect: index > 20 // Rough heuristic
            };
          }
          tableData[m.data.table].chunks++;
          tableData[m.data.table].records += m.data.changes ? m.data.changes.length : 0;
        }
      });
      
      return {
        tablesReceived: Array.from(tablesReceived),
        tableData,
        hasCompleteMessage,
        reconnectCount,
        totalMessages: messages.length
      };
    });
    
    console.log('\n📊 Final Sync State:');
    console.log(`   Reconnect attempts: ${finalSyncData.reconnectCount}`);
    console.log(`   Tables received total: ${finalSyncData.tablesReceived.join(', ')}`);
    console.log(`   Has completion message: ${finalSyncData.hasCompleteMessage ? '✅' : '❌'}`);
    console.log(`   Total messages: ${finalSyncData.totalMessages}`);
    
    // Check database for actual data
    const dbData = await page.evaluate(async () => {
      const db = window.db;
      if (!db) return null;
      
      return {
        users: await db.users.count(),
        tasks: await db.tasks.count(),
        projects: await db.projects.count(),
        tags: await db.tags.count(),
        comments: await db.comments.count()
      };
    });
    
    console.log('\n📦 Database Contents:');
    if (dbData) {
      Object.entries(dbData).forEach(([table, count]) => {
        console.log(`   ${table}: ${count}`);
      });
    }
    
    // === ANALYSIS ===
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS');
    console.log('='.repeat(60));
    
    const resumedFromProgress = firstSyncData.tablesReceived.length < finalSyncData.tablesReceived.length &&
                               firstSyncData.tablesReceived.every(t => finalSyncData.tablesReceived.includes(t));
    
    const restartedFromBeginning = finalSyncData.reconnectCount > 1;
    
    if (resumedFromProgress) {
      console.log('\n✅ RESUME CAPABILITY: Working');
      console.log('   - Sync resumed from where it left off');
      console.log('   - Did not re-send already received tables');
    } else if (restartedFromBeginning) {
      console.log('\n⚠️ RESUME CAPABILITY: Not Working');
      console.log('   - Sync restarted from the beginning after reconnection');
      console.log('   - All tables were re-sent');
      console.log('   - This could cause duplicate data or performance issues');
    } else {
      console.log('\n❓ RESUME CAPABILITY: Unclear');
      console.log('   - Could not determine if resume worked properly');
    }
    
    console.log('\n' + '='.repeat(60));
  });
});