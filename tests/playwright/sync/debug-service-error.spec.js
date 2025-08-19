/**
 * Test: Debug Service Error Details
 * Scenario: Get detailed information about the SERVICE_ERROR
 */

import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('Debug Service Error', () => {
  test('should debug the SERVICE_ERROR in detail', async ({ page }) => {
    console.log('🔍 Debugging SERVICE_ERROR...\n');
    console.log('='.repeat(60));
    
    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      return document.body.getAttribute('data-playwright-ready') === 'true';
    }, { timeout: 30000 });
    
    console.log('✅ Dashboard loaded and ready');
    
    // Wait for sync to complete and error
    await page.waitForTimeout(8000);
    
    // Get detailed error information
    const serviceErrorDetails = await page.evaluate(() => {
      const inspector = window.xstateTestInspector;
      if (!inspector) return { hasInspector: false };
      
      const events = inspector.getEvents('sync-machine-v3');
      const serviceErrors = events.filter(e => e.event.type === 'SERVICE_ERROR');
      
      // Get service coordinator status
      const serviceCoordinator = window.testSyncHelpers?.getServiceCoordinator?.();
      const services = serviceCoordinator?.getServices?.();
      
      return {
        hasInspector: true,
        serviceErrors: serviceErrors.map(e => ({
          service: e.event.service,
          error: e.event.error?.message || String(e.event.error),
          context: e.event.context,
          timestamp: e.timestamp
        })),
        serviceCoordinatorStatus: {
          hasServiceCoordinator: !!serviceCoordinator,
          services: services ? Object.keys(services) : [],
          serviceDetails: services ? {
            incoming: !!services.incoming,
            outgoing: !!services.outgoing,
            webSocket: !!services.webSocket,
            dexieOutgoing: !!services.dexieOutgoing,
            integrity: !!services.integrity
          } : null
        }
      };
    });
    
    console.log('\n❌ Service Error Details:');
    if (serviceErrorDetails.serviceErrors.length > 0) {
      serviceErrorDetails.serviceErrors.forEach((error, index) => {
        console.log(`   Error ${index + 1}:`);
        console.log(`     Service: ${error.service}`);
        console.log(`     Error: ${error.error}`);
        console.log(`     Context: ${error.context || 'none'}`);
      });
    } else {
      console.log('   No SERVICE_ERROR events found');
    }
    
    console.log('\n🔧 Service Coordinator Status:');
    console.log(`   Has Service Coordinator: ${serviceErrorDetails.serviceCoordinatorStatus.hasServiceCoordinator ? '✅' : '❌'}`);
    console.log(`   Available Services: ${serviceErrorDetails.serviceCoordinatorStatus.services.join(', ') || 'none'}`);
    
    if (serviceErrorDetails.serviceCoordinatorStatus.serviceDetails) {
      const details = serviceErrorDetails.serviceCoordinatorStatus.serviceDetails;
      console.log('\n📋 Individual Service Status:');
      console.log(`   Incoming Service: ${details.incoming ? '✅' : '❌'}`);
      console.log(`   Outgoing Service: ${details.outgoing ? '✅' : '❌'}`);
      console.log(`   WebSocket Service: ${details.webSocket ? '✅' : '❌'}`);
      console.log(`   Dexie Outgoing Service: ${details.dexieOutgoing ? '✅' : '❌'}`);
      console.log(`   Integrity Service: ${details.integrity ? '✅' : '❌'}`);
    }
    
    // Check if services should be initialized
    const initializationStatus = await page.evaluate(() => {
      // Check if there are any initialization-related events
      const inspector = window.xstateTestInspector;
      if (!inspector) return null;
      
      const events = inspector.getEvents('sync-machine-v3');
      const initEvents = events.filter(e => 
        e.event.type.includes('INIT') || 
        e.event.type.includes('SERVICE') ||
        e.event.type.includes('CONNECT')
      );
      
      return {
        totalEvents: events.length,
        initEvents: initEvents.map(e => e.event.type),
        currentState: inspector.getCurrentState('sync-machine-v3')
      };
    });
    
    console.log('\n🔄 Initialization Status:');
    console.log(`   Current Sync State: ${initializationStatus?.currentState || 'Unknown'}`);
    console.log(`   Total Events: ${initializationStatus?.totalEvents || 0}`);
    if (initializationStatus?.initEvents?.length > 0) {
      console.log('   Initialization Events:');
      initializationStatus.initEvents.forEach(eventType => {
        console.log(`     - ${eventType}`);
      });
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/service-error-debug.png',
      fullPage: true 
    });
    
    console.log('\n📸 Screenshot saved: screenshots/service-error-debug.png');
    console.log('\n' + '='.repeat(60));
    console.log('Service error debug completed');
    console.log('='.repeat(60));
  });
});