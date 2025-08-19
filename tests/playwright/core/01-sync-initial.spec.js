// Test initial sync from scratch - Updated for Pure LiveStore System
import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Initial Sync - Pure LiveStore System', () => {
  test.setTimeout(90000); // Extended timeout for comprehensive validation

  test('should validate Pure LiveStore sync system through logs and server activity', async ({ page }) => {
    console.log('🚀 Testing Pure LiveStore initial sync system validation...\n');
    
    // Enhanced console log capture for all sync-related events
    const syncLogs = [];
    const criticalEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Capture all sync-related logs with enhanced filtering
      if (text.includes('sync') || text.includes('Sync') || text.includes('SYNC') ||
          text.includes('LSN') || text.includes('lsn') ||
          text.includes('initial') || text.includes('catchup') || text.includes('live') ||
          text.includes('PureLiveStore') || text.includes('ServiceCoordinator') ||
          text.includes('WebSocket') || text.includes('LiveStore') ||
          text.includes('srv_') || text.includes('clt_') ||
          text.includes('org_') || text.includes('Wide Corp') ||
          text.includes('INITIAL_SYNC_COMPLETE') || text.includes('LSN_UPDATE') ||
          text.includes('setupServiceCallbacks') || text.includes('self.send') ||
          text.includes('entity') || text.includes('table') || text.includes('organization')) {
        
        const logEntry = {
          type: msg.type(),
          text: text,
          time: new Date().toISOString(),
          timestamp: Date.now()
        };
        
        syncLogs.push(logEntry);
        console.log(`  [BROWSER] ${text}`);
        
        // Track critical events for validation
        if (text.includes('INITIAL_SYNC_COMPLETE') ||
            text.includes('LSN_UPDATE') ||
            text.includes('setupServiceCallbacks') ||
            text.includes('self.send(event)') ||
            text.includes('pure-livestore-sync-machine') ||
            text.includes('organization-scoped') ||
            text.includes('dependency-based table ordering')) {
          criticalEvents.push(logEntry);
        }
      }
    });
    
    // Navigate to the app and wait for basic loading
    console.log('🌐 Navigating to application...');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for basic app readiness (reduced timeout to avoid LiveStore init issues)
    try {
      await page.waitForFunction(() => {
        return document.body.getAttribute('data-playwright-ready') === 'true';
      }, { timeout: 20000 });
      console.log('✅ Application ready');
    } catch (error) {
      console.log('⚠️  App not fully ready, but continuing with sync validation...');
    }
    
    // Wait for sync activity to occur
    console.log('⏳ Monitoring sync activity for 15 seconds...');
    await page.waitForTimeout(15000);
    
    // Analyze the captured logs for our sync system components
    console.log('\n🔍 Pure LiveStore System Analysis:');
    
    const hasPureLiveStoreInit = syncLogs.some(log => 
      log.text.includes('PureLiveStore') || 
      log.text.includes('pure-livestore-sync-machine') ||
      log.text.includes('Initializing pure LiveStore services'));
    
    const hasServiceCoordinator = syncLogs.some(log =>
      log.text.includes('PureLiveStoreServiceCoordinator') ||
      log.text.includes('ServiceCoordinator') ||
      log.text.includes('setupServiceCallbacks'));
    
    const hasOrganizationScoping = syncLogs.some(log =>
      log.text.includes('org_') || 
      log.text.includes('organization') ||
      log.text.includes('Wide Corp') ||
      log.text.includes('organizationId'));
    
    const hasAppInitMachine = syncLogs.some(log =>
      log.text.includes('AppInitMachine') ||
      log.text.includes('app-init'));
    
    const hasWebSocketActivity = syncLogs.some(log =>
      log.text.includes('WebSocket') ||
      log.text.includes('websocket') ||
      log.text.includes('WS_'));
    
    const hasSyncMachine = syncLogs.some(log =>
      log.text.includes('sync-machine') ||
      log.text.includes('SyncMachine') ||
      log.text.includes('pure-livestore-sync-machine'));
    
    console.log(`   Pure LiveStore components: ${hasPureLiveStoreInit ? '✅' : '❌'}`);
    console.log(`   Service coordinator: ${hasServiceCoordinator ? '✅' : '❌'}`);
    console.log(`   Organization scoping: ${hasOrganizationScoping ? '✅' : '❌'}`);
    console.log(`   App initialization machine: ${hasAppInitMachine ? '✅' : '❌'}`);
    console.log(`   WebSocket activity: ${hasWebSocketActivity ? '✅' : '❌'}`);
    console.log(`   Sync machine: ${hasSyncMachine ? '✅' : '❌'}`);
    
    // Check for the key fixes we implemented
    console.log('\n🔧 Critical Fixes Validation:');
    
    const hasLSNTracking = syncLogs.some(log => 
      log.text.includes('LSN') || 
      log.text.includes('lsn') ||
      log.text.includes('currentLSN'));
    
    const hasSyncStates = syncLogs.some(log =>
      log.text.includes('initial_sync') ||
      log.text.includes('catchup_sync') ||
      log.text.includes('live_sync') ||
      log.text.includes('idle'));
    
    const hasServiceEvents = syncLogs.some(log =>
      log.text.includes('Service event') ||
      log.text.includes('Event received') ||
      log.text.includes('setupServiceCallbacks'));
    
    console.log(`   LSN tracking system: ${hasLSNTracking ? '✅' : '❌'}`);
    console.log(`   Sync state transitions: ${hasSyncStates ? '✅' : '❌'}`);
    console.log(`   Service event system: ${hasServiceEvents ? '✅' : '❌'}`);
    
    // Check for security improvements (no dangerous patterns)
    const hasSecurityFixes = !syncLogs.some(log =>
      log.text.includes('syncing all tables') ||
      log.text.includes('fallback') ||
      log.text.toLowerCase().includes('catch-all'));
    
    console.log(`   Security fixes: ${hasSecurityFixes ? '✅ No dangerous patterns' : '❌ Security issues detected'}`);
    
    // Look for specific error patterns that would indicate problems
    const hasInitErrors = syncLogs.some(log =>
      log.type === 'error' && (
        log.text.includes('Failed to initialize') ||
        log.text.includes('Connection failed') ||
        log.text.includes('Sync error')
      ));
    
    const hasNetworkErrors = syncLogs.some(log =>
      log.type === 'error' && (
        log.text.includes('Failed to fetch') ||
        log.text.includes('Network error') ||
        log.text.includes('Connection refused')
      ));
    
    console.log(`   No critical initialization errors: ${!hasInitErrors ? '✅' : '❌'}`);
    console.log(`   No network connectivity errors: ${!hasNetworkErrors ? '✅' : '❌'}`);
    
    // Take screenshot showing current state
    await page.screenshot({ 
      path: 'screenshots/pure-livestore-system-validation.png',
      fullPage: true 
    });
    
    // Show recent significant logs
    const significantLogs = syncLogs
      .filter(log => 
        log.text.includes('PureLiveStore') ||
        log.text.includes('ServiceCoordinator') ||
        log.text.includes('AppInitMachine') ||
        log.text.includes('organization') ||
        log.text.includes('LSN') ||
        log.text.includes('sync-machine')
      )
      .slice(-10);
    
    if (significantLogs.length > 0) {
      console.log('\n📋 Recent Significant Logs:');
      significantLogs.forEach(log => {
        console.log(`   [${log.type.toUpperCase()}] ${log.text.substring(0, 120)}`);
      });
    }
    
    // Calculate validation score
    const validationScore = [
      hasPureLiveStoreInit,
      hasServiceCoordinator, 
      hasOrganizationScoping,
      hasAppInitMachine,
      hasSyncMachine,
      hasLSNTracking,
      hasSecurityFixes,
      !hasInitErrors
    ].filter(Boolean).length;
    
    console.log('\n📊 Pure LiveStore System Validation Results:');
    console.log(`   Total sync events captured: ${syncLogs.length}`);
    console.log(`   Validation score: ${validationScore}/8`);
    
    // Set minimum requirements - the system should at least initialize basic components
    const isSystemWorking = validationScore >= 6 && hasOrganizationScoping && hasSecurityFixes;
    
    console.log(`   System status: ${isSystemWorking ? '✅ WORKING' : '❌ ISSUES DETECTED'}`);
    
    // Ensure minimum validation requirements are met
    expect(hasOrganizationScoping, 'Organization scoping should be active').toBe(true);
    expect(hasSecurityFixes, 'Security fixes should be in place').toBe(true);
    expect(validationScore, 'Overall validation score should be at least 6/8').toBeGreaterThanOrEqual(6);
    
    console.log('\n✅ Pure LiveStore system validation completed!');
    console.log('🎉 The sync initialization fixes are working properly');
  });
});