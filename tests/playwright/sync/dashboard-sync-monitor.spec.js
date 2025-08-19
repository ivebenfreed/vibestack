/**
 * Test: Dashboard Sync Status Monitoring (Migration Safe)
 * Scenario: Monitor sync status on dashboard during database migration
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Dashboard Sync Monitoring', () => {
  test('should monitor sync status on dashboard without interfering', async ({ page }) => {
    console.log('📊 Monitoring sync status on dashboard (migration safe)...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Check if XState inspector is available
    const hasXState = await page.evaluate(() => {
      return window.xstateTestInspector !== undefined;
    });
    
    if (hasXState) {
      console.log('✅ XState inspector available');
      
      // Monitor sync status for 10 seconds without interfering
      console.log('\n⏳ Monitoring sync status for 10 seconds...');
      
      const syncStatusUpdates = [];
      const startTime = Date.now();
      
      while (Date.now() - startTime < 10000) {
        const currentStatus = await page.evaluate(() => {
          const syncState = window.xstateTestInspector.getCurrentState('sync-machine-v3');
          const buttonText = document.querySelector('[data-testid="sync-status-button"]')?.textContent || 
                           document.querySelector('button[aria-label*="Sync"]')?.textContent ||
                           'Unknown';
          
          return {
            xstateStatus: syncState,
            buttonText: buttonText.trim(),
            timestamp: Date.now()
          };
        });
        
        syncStatusUpdates.push(currentStatus);
        await page.waitForTimeout(1000);
      }
      
      // Analyze sync status changes
      console.log('\n📈 Sync Status Updates:');
      const uniqueStates = [...new Set(syncStatusUpdates.map(s => s.xstateStatus))];
      const uniqueButtonTexts = [...new Set(syncStatusUpdates.map(s => s.buttonText))];
      
      console.log(`   XState transitions: ${uniqueStates.join(' → ')}`);
      console.log(`   Button text changes: ${uniqueButtonTexts.join(' → ')}`);
      
      // Check if sync progressed
      const hasStateProgression = uniqueStates.length > 1;
      const isConnected = uniqueButtonTexts.some(text => 
        text.includes('Connected') || 
        text.includes('Synced') || 
        text.includes('Live')
      );
      
      console.log(`\n📊 Analysis:`);
      console.log(`   State progression: ${hasStateProgression ? '✅' : '❌'}`);
      console.log(`   Connected status: ${isConnected ? '✅' : '❌'}`);
      
    } else {
      console.log('⚠️ XState inspector not available');
    }
    
    // Check dashboard data counts (non-invasive)
    const dashboardData = await page.evaluate(() => {
      const dataElements = document.querySelectorAll('[data-testid*="count"], .text-2xl, .text-3xl');
      const counts = {};
      
      dataElements.forEach(el => {
        const text = el.textContent;
        const parent = el.closest('[data-testid], .card, .grid');
        if (parent && text && /^\d+$/.test(text.trim())) {
          const context = parent.textContent.toLowerCase();
          if (context.includes('user')) counts.users = parseInt(text);
          if (context.includes('project')) counts.projects = parseInt(text);
          if (context.includes('task')) counts.tasks = parseInt(text);
          if (context.includes('comment')) counts.comments = parseInt(text);
        }
      });
      
      return counts;
    });
    
    console.log('\n📦 Dashboard Data Counts:');
    Object.entries(dashboardData).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    // Check sync button status
    const finalSyncStatus = await page.evaluate(() => {
      const syncButton = document.querySelector('[data-testid="sync-status-button"]') || 
                        document.querySelector('button[aria-label*="Sync"]') ||
                        document.querySelector('button:has-text("Sync")');
      
      return {
        buttonText: syncButton?.textContent?.trim() || 'Not found',
        buttonClasses: syncButton?.className || 'Not found',
        isDisconnected: syncButton?.textContent?.includes('Disconnected') || false
      };
    });
    
    console.log('\n🔘 Final Sync Button Status:');
    console.log(`   Text: ${finalSyncStatus.buttonText}`);
    console.log(`   Disconnected: ${finalSyncStatus.isDisconnected ? '⚠️' : '✅'}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/dashboard-sync-monitor.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/dashboard-sync-monitor.png');
    console.log('\n' + '='.repeat(60));
    console.log('Dashboard sync monitoring completed (no interference with migration)');
    console.log('='.repeat(60));
  });
});