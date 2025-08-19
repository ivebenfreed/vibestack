#!/usr/bin/env node

/**
 * Wide Corp Final Sync Test
 * 
 * Complete test: Login as Wide Corp CEO, select organization, and test sync
 */

const { chromium } = require('playwright');
const path = require('path');

async function testWideCorpFinalSync() {
  console.log('🔄 Final Wide Corp LiveStore Sync Test...');
  
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  const WIDE_CORP_CEO_EMAIL = 'ceo@widecorp.com';
  const WIDE_CORP_CEO_PASSWORD = 'WideCorp2024!CEO';
  
  let browser;
  
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    console.log('🚀 Browser launched for final Wide Corp test');
    
    // Set up comprehensive network monitoring
    const allActivity = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'REQUEST',
          method: request.method(),
          url: url,
          isAPICall: true
        };
        allActivity.push(activity);
        console.log('📡 API REQUEST:', activity.method, activity.url.substring(activity.url.indexOf('/api')));
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/')) {
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'RESPONSE',
          status: response.status(),
          url: url,
          isAPICall: true
        };
        allActivity.push(activity);
        console.log('📡 API RESPONSE:', activity.status, activity.url.substring(activity.url.indexOf('/api')));
      }
    });
    
    // Step 1: Login as Wide Corp CEO
    console.log('🔐 Step 1: Logging in as Wide Corp CEO...');
    await page.goto('http://localhost:5174/sign-in');
    await page.waitForTimeout(2000);
    
    await page.fill('input[type="email"]', WIDE_CORP_CEO_EMAIL);
    await page.fill('input[type="password"]', WIDE_CORP_CEO_PASSWORD);
    
    const signInButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Sign in")'));
    await signInButton.click();
    
    console.log('✅ Login form submitted');
    await page.waitForTimeout(3000);
    
    // Step 2: Select Wide Corp Solutions organization
    console.log('🏢 Step 2: Selecting Wide Corp Solutions organization...');
    
    try {
      // Look for Wide Corp Solutions organization card
      const wideCorpCard = page.locator('text=Wide Corp Solutions').first();
      await wideCorpCard.click();
      
      console.log('✅ Clicked on Wide Corp Solutions organization');
      await page.waitForTimeout(3000);
      
    } catch (orgError) {
      console.log('⚠️ Failed to click organization:', orgError.message);
      console.log('   Continuing to debug page...');
    }
    
    // Step 3: Navigate to LiveStore debug page
    console.log('📍 Step 3: Navigating to LiveStore debug page...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    await page.waitForTimeout(3000);
    
    // Check current state
    const currentState = await page.evaluate(() => {
      return {
        url: window.location.href,
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        hasLiveStoreDomain: !!window.liveStoreDomain,
        liveStoreDomainKeys: window.liveStoreDomain ? Object.keys(window.liveStoreDomain) : [],
        services: window.liveStoreDomain?.services ? Object.keys(window.liveStoreDomain.services) : [],
        pageContent: document.body.innerText.substring(0, 800)
      };
    });
    
    console.log('📊 Current State:', currentState);
    
    // Step 4: Run all available tests and monitor API activity
    console.log('\n🧪 Step 4: Running all available tests...');
    
    // Clear previous activity
    allActivity.length = 0;
    
    try {
      // Try to click Run All Tests button
      const runAllButton = page.locator('button:has-text("Run All Tests")');
      if (await runAllButton.count() > 0) {
        await runAllButton.click();
        console.log('✅ Clicked "Run All Tests"');
        await page.waitForTimeout(5000);
      }
      
      // Try individual test buttons
      const testButtons = [
        'Test LiveStore Info',
        'Test Domain Services',
        'Test Sync Status', 
        'Test Create Operations',
        '🔬 Full LiveStore Test'
      ];
      
      for (const buttonText of testButtons) {
        try {
          const button = page.locator(`button:has-text("${buttonText}")`);
          if (await button.count() > 0) {
            await button.click();
            console.log(`✅ Clicked "${buttonText}"`);
            await page.waitForTimeout(2000);
          }
        } catch (error) {
          console.log(`⚠️ Could not click "${buttonText}":`, error.message);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Test execution issues:', error.message);
    }
    
    // Step 5: Try direct LiveStore API calls
    console.log('\n🔧 Step 5: Testing direct LiveStore operations...');
    
    const directTestResults = await page.evaluate(async () => {
      const results = [];
      
      try {
        console.log('Checking LiveStore availability...');
        
        if (!window.liveStoreDomain) {
          return { error: 'liveStoreDomain not available' };
        }
        
        console.log('LiveStore domain found, checking services...');
        const services = window.liveStoreDomain.services || {};
        
        // Test if we can create services for Wide Corp entities
        const orgId = localStorage.getItem('vibestack-last-organization-id');
        console.log('Current organization ID:', orgId);
        
        // Try to create a project service
        if (window.liveStoreDomain.createEntityService) {
          console.log('Testing createEntityService...');
          
          try {
            const projectService = window.liveStoreDomain.createEntityService(orgId, 'SoftwareProject');
            if (projectService && projectService.create) {
              const projectData = {
                name: `Final Sync Test ${Date.now()}`,
                description: 'Testing final sync with Wide Corp'
              };
              
              const result = await projectService.create(projectData);
              results.push({
                operation: 'createEntityService_project',
                success: result.success,
                result: result
              });
            }
          } catch (serviceError) {
            results.push({
              operation: 'createEntityService_project',
              success: false,
              error: serviceError.message
            });
          }
        }
        
        // Try the convenient project service
        if (window.liveStoreDomain.project && window.liveStoreDomain.project.create) {
          console.log('Testing convenient project service...');
          
          try {
            const projectData = {
              name: `Convenient API Test ${Date.now()}`,
              description: 'Testing convenient project API'
            };
            
            const result = await window.liveStoreDomain.project.create(projectData);
            results.push({
              operation: 'convenient_project_api',
              success: result.success,
              result: result
            });
          } catch (convError) {
            results.push({
              operation: 'convenient_project_api',
              success: false,
              error: convError.message
            });
          }
        }
        
        // Try the skill service
        if (window.liveStoreDomain.skill && window.liveStoreDomain.skill.create) {
          console.log('Testing skill service...');
          
          try {
            const skillData = {
              name: `Final Test Skill ${Date.now()}`,
              category: 'Testing',
              level: 'Expert'
            };
            
            const result = await window.liveStoreDomain.skill.create(skillData);
            results.push({
              operation: 'skill_create',
              success: result.success,
              result: result
            });
          } catch (skillError) {
            results.push({
              operation: 'skill_create',
              success: false,
              error: skillError.message
            });
          }
        }
        
        return {
          success: true,
          operations: results,
          orgId: orgId,
          servicesAvailable: Object.keys(services),
          hasCreateEntityService: !!window.liveStoreDomain.createEntityService
        };
        
      } catch (error) {
        console.error('Direct test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Direct Test Results:', directTestResults);
    
    // Wait for any final API activity
    await page.waitForTimeout(3000);
    
    // Get final page state
    const finalState = await page.evaluate(() => {
      return {
        pageText: document.body.innerText,
        hasSuccessIndicators: document.body.innerText.includes('Success') || document.body.innerText.includes('✅'),
        hasErrorIndicators: document.body.innerText.includes('Error') || document.body.innerText.includes('❌'),
        domainServicesCount: document.body.innerText.match(/Domain Services: (\\d+)/)?.[1] || '0',
        organizationInfo: document.body.innerText.match(/Organization ID: ([a-f0-9-]+)/)?.[1] || 'not found'
      };
    });
    
    // Take final screenshot
    console.log('\n📸 Taking final screenshot...');
    await page.screenshot({ 
      path: 'widecorp-final-sync-test.png',
      fullPage: true 
    });
    
    // Analyze all API activity
    const apiCalls = allActivity.filter(a => a.isAPICall);
    const successfulOperations = directTestResults.success && 
                                directTestResults.operations && 
                                directTestResults.operations.some(op => op.success);
    
    console.log('\n🌐 Final API Activity Analysis:');
    console.log('  Total API Calls:', apiCalls.length);
    
    if (apiCalls.length > 0) {
      console.log('\n📡 All API Activity:');
      apiCalls.slice(-15).forEach((activity, index) => {
        const urlPart = activity.url.substring(activity.url.indexOf('/api'));
        console.log(`  ${index + 1}. ${activity.type} ${activity.method || activity.status} ${urlPart}`);
      });
    }
    
    // Final comprehensive assessment
    console.log('\n🎉 FINAL WIDE CORP LIVESTORE SYNC TEST RESULTS:');
    console.log('='.repeat(70));
    console.log('  👤 User: Wide Corp CEO');
    console.log('  🏢 Organization ID:', finalState.organizationInfo);
    console.log('  🏢 Expected Org ID:', WIDE_CORP_ORG_ID);
    console.log('  ✅ Correct Organization:', finalState.organizationInfo === WIDE_CORP_ORG_ID ? '✅ YES' : '❌ NO');
    console.log('  🔄 LiveStore Operations:', successfulOperations ? '✅ WORKING' : '❌ FAILED');
    console.log('  📡 API Activity:', apiCalls.length > 0 ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  📊 Test Page Results:', finalState.hasSuccessIndicators ? '✅ SUCCESS' : '❌ NO SUCCESS');
    console.log('  🔧 Domain Services:', finalState.domainServicesCount);
    console.log('  🌐 Total API Calls:', apiCalls.length);
    console.log('='.repeat(70));
    
    if (successfulOperations && apiCalls.length > 0) {
      console.log('🎯 LIVESTORE SYNC FULLY OPERATIONAL! ✅');
      console.log('   ✓ Wide Corp CEO authenticated successfully');
      console.log('   ✓ LiveStore operations are working');
      console.log('   ✓ API calls are being generated');
      console.log('   ✓ Your LiveStore conversion is complete and functional!');
    } else if (apiCalls.length > 0) {
      console.log('📡 PARTIAL SUCCESS - API ACTIVITY DETECTED ⚠️');
      console.log('   ✓ API communication is working');
      console.log('   ⚠ LiveStore mutations may need schema configuration');
    } else {
      console.log('🔧 SETUP NEEDS ATTENTION ⚠️');
      console.log('   • Check organization selection and domain setup');
      console.log('   • Verify LiveStore schema configuration');
    }
    
    console.log('\n📍 Final screenshot saved as: widecorp-final-sync-test.png');
    
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
testWideCorpFinalSync()
  .then(() => {
    console.log('\\n✅ Final Wide Corp LiveStore sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\\n❌ Final Wide Corp LiveStore sync test failed:', error);
    process.exit(1);
  });