#!/usr/bin/env node

/**
 * Wide Corp LiveStore Sync Test
 * 
 * Test mutations in the Wide Corp organization that has real schemas
 * to see if LiveStore sync messages are properly triggered
 */

const { chromium } = require('playwright');
const path = require('path');

async function testWideCorpSync() {
  console.log('🔄 Testing Wide Corp LiveStore Sync...');
  
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', 'profile-main');
  
  let browser;
  
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const page = await browser.newPage();
    
    console.log('🚀 Browser launched with persistent context');
    
    // First, let's switch to Wide Corp organization
    console.log('🔄 Switching to Wide Corp organization...');
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);
    
    // Switch organization in localStorage
    await page.evaluate((orgId) => {
      localStorage.setItem('vibestack-last-organization-id', orgId);
      console.log('Switched to org:', orgId);
    }, WIDE_CORP_ORG_ID);
    
    // Navigate to LiveStore debug page with Wide Corp
    console.log('📍 Navigating to LiveStore debug page with Wide Corp...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    await page.waitForTimeout(3000);
    
    // Verify organization switch
    const orgInfo = await page.evaluate(() => {
      return {
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        pageLoaded: !!document.body
      };
    });
    
    console.log('🏢 Organization Info:', orgInfo);
    
    if (orgInfo.orgId !== WIDE_CORP_ORG_ID) {
      console.log('⚠️ Organization switch failed, trying manual reload...');
      await page.reload();
      await page.waitForTimeout(3000);
    }
    
    // Set up network monitoring for Wide Corp API calls
    const networkActivity = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('sync') || url.includes('mutation') || url.includes('livestore')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'REQUEST',
          method: request.method(),
          url: url,
          isWideCorpAPI: url.includes(WIDE_CORP_ORG_ID.replace(/-/g, '_'))
        };
        networkActivity.push(activity);
        console.log('📡 API Request:', activity.method, activity.url.substring(0, 100));
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('sync') || url.includes('mutation') || url.includes('livestore')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'RESPONSE',
          status: response.status(),
          url: url,
          isWideCorpAPI: url.includes(WIDE_CORP_ORG_ID.replace(/-/g, '_'))
        };
        networkActivity.push(activity);
        console.log('📡 API Response:', activity.status, activity.url.substring(0, 100));
      }
    });
    
    // Test 1: Check what domain services are available with Wide Corp
    console.log('\n🧪 Test 1: Checking Wide Corp domain services...');
    
    const domainInfo = await page.evaluate(() => {
      const info = {
        hasLiveStoreDomain: !!window.liveStoreDomain,
        liveStoreDomainServices: window.liveStoreDomain ? Object.keys(window.liveStoreDomain.services || {}) : [],
        orgId: localStorage.getItem('vibestack-last-organization-id')
      };
      
      // Try to get more details about available services
      if (window.liveStoreDomain && window.liveStoreDomain.services) {
        info.serviceDetails = {};
        for (const [serviceName, service] of Object.entries(window.liveStoreDomain.services)) {
          if (service && typeof service === 'object') {
            info.serviceDetails[serviceName] = Object.keys(service);
          }
        }
      }
      
      return info;
    });
    
    console.log('📊 Wide Corp Domain Info:', domainInfo);
    
    // Test 2: Run the debug page tests and monitor activity
    console.log('\n🧪 Test 2: Running LiveStore tests with Wide Corp...');
    
    try {
      // Click Run All Tests button
      const runAllButton = page.locator('button:has-text("Run All Tests")');
      await runAllButton.click();
      console.log('✅ Clicked "Run All Tests" with Wide Corp organization');
      
      // Wait for tests to complete and monitor activity
      await page.waitForTimeout(7000);
      
    } catch (error) {
      console.log('❌ Failed to run tests:', error.message);
    }
    
    // Test 3: Try direct mutation operations with Wide Corp schema
    console.log('\n🧪 Test 3: Testing direct mutations with Wide Corp schema...');
    
    const mutationResult = await page.evaluate(async () => {
      try {
        const results = [];
        
        // Test project creation with Wide Corp
        if (window.liveStoreDomain && window.liveStoreDomain.services && window.liveStoreDomain.services.project) {
          console.log('Testing project creation...');
          
          const projectData = {
            name: `Wide Corp Sync Test ${Date.now()}`,
            description: 'Testing LiveStore sync with Wide Corp schema',
            project_type: 'Testing',
            status: 'planning'
          };
          
          const projectResult = await window.liveStoreDomain.services.project.create(projectData);
          results.push({
            operation: 'project_create',
            success: projectResult.success,
            result: projectResult
          });
          
          console.log('Project creation result:', projectResult);
        }
        
        // Test skill creation with Wide Corp
        if (window.liveStoreDomain && window.liveStoreDomain.services && window.liveStoreDomain.services.skill) {
          console.log('Testing skill creation...');
          
          const skillData = {
            name: `Wide Corp Sync Skill ${Date.now()}`,
            category: 'Testing',
            level: 'Expert',
            description: 'Testing LiveStore sync with Wide Corp skill schema'
          };
          
          const skillResult = await window.liveStoreDomain.services.skill.create(skillData);
          results.push({
            operation: 'skill_create',
            success: skillResult.success,
            result: skillResult
          });
          
          console.log('Skill creation result:', skillResult);
        }
        
        return {
          success: true,
          operations: results,
          totalOperations: results.length
        };
        
      } catch (error) {
        console.error('Mutation test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Mutation Test Results:', mutationResult);
    
    // Wait for any additional sync activity
    await page.waitForTimeout(5000);
    
    // Test 4: Check for any WebSocket connections or real-time sync
    console.log('\n🧪 Test 4: Checking for WebSocket/real-time sync...');
    
    const connectionInfo = await page.evaluate(() => {
      // Check for any WebSocket connections or EventSource
      const webSockets = [];
      const eventSources = [];
      
      // This is a basic check - in a real app we'd need to hook into the WebSocket constructor
      return {
        hasWebSockets: typeof WebSocket !== 'undefined',
        hasEventSource: typeof EventSource !== 'undefined',
        userAgent: navigator.userAgent.substring(0, 50),
        location: window.location.href
      };
    });
    
    console.log('📊 Connection Info:', connectionInfo);
    
    // Get page content to check for test results
    const pageResults = await page.evaluate(() => {
      return {
        pageText: document.body.innerText.substring(0, 3000),
        hasSuccessText: document.body.innerText.includes('Success'),
        hasErrorText: document.body.innerText.includes('Error'),
        hasMutationText: document.body.innerText.includes('mutation') || document.body.innerText.includes('created'),
        domainServicesCount: document.body.innerText.match(/Domain Services: (\d+)/)?.[1] || '0'
      };
    });
    
    console.log('📄 Page Results Analysis:');
    console.log('  Success Indicators:', pageResults.hasSuccessText ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('  Error Indicators:', pageResults.hasErrorText ? '⚠️ FOUND' : '✅ NOT FOUND');
    console.log('  Mutation Indicators:', pageResults.hasMutationText ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('  Domain Services Count:', pageResults.domainServicesCount);
    
    // Take screenshot
    console.log('\n📸 Taking Wide Corp test screenshot...');
    await page.screenshot({ 
      path: 'wide-corp-sync-test.png',
      fullPage: true 
    });
    
    // Analyze network activity
    const wideCorpRequests = networkActivity.filter(activity => activity.isWideCorpAPI);
    const syncRequests = networkActivity.filter(activity => 
      activity.url.includes('sync') || 
      activity.url.includes('mutation') ||
      activity.url.includes('livestore')
    );
    
    console.log('\n🌐 Network Activity Analysis:');
    console.log('  Total API Activity:', networkActivity.length);
    console.log('  Wide Corp API Calls:', wideCorpRequests.length);
    console.log('  Sync-related Calls:', syncRequests.length);
    
    if (networkActivity.length > 0) {
      console.log('\n📡 All Network Activity:');
      networkActivity.slice(-10).forEach((activity, index) => {
        console.log(`  ${index + 1}. ${activity.type} ${activity.method || activity.status} ${activity.url.substring(0, 80)}`);
      });
    }
    
    // Final assessment
    const hasRealMutations = mutationResult.success && mutationResult.totalOperations > 0;
    const hasSyncActivity = syncRequests.length > 0 || wideCorpRequests.length > 0;
    const hasLiveStoreActivity = pageResults.hasMutationText || pageResults.hasSuccessText;
    
    console.log('\n🎉 WIDE CORP LIVESTORE SYNC TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log('  🏢 Organization:', WIDE_CORP_ORG_ID);
    console.log('  🔄 Real Mutations:', hasRealMutations ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  📡 Sync Activity:', hasSyncActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🎯 LiveStore Activity:', hasLiveStoreActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🌐 Network Requests:', networkActivity.length);
    console.log('  🔧 Domain Services:', pageResults.domainServicesCount);
    console.log('='.repeat(60));
    
    if (hasRealMutations && hasSyncActivity) {
      console.log('🎯 LIVESTORE SYNC WORKING! ✅');
      console.log('   Mutations in Wide Corp are triggering sync messages');
      console.log('   The LiveStore conversion is successfully generating change events');
    } else if (hasRealMutations) {
      console.log('🔄 MUTATIONS WORKING BUT LIMITED SYNC ⚠️');
      console.log('   LiveStore mutations are working but sync messages may need configuration');
    } else {
      console.log('⚠️ LIMITED MUTATION ACTIVITY');
      console.log('   Check Wide Corp schema integration and LiveStore setup');
    }
    
    console.log('\n📍 Screenshot saved as: wide-corp-sync-test.png');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
testWideCorpSync()
  .then(() => {
    console.log('\n✅ Wide Corp LiveStore sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Wide Corp LiveStore sync test failed:', error);
    process.exit(1);
  });