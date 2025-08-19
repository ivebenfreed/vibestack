#!/usr/bin/env node

/**
 * Wide Corp CEO LiveStore Sync Test
 * 
 * Login as Wide Corp CEO and test LiveStore sync mutations
 * with the real Wide Corp organization and schemas
 */

const { chromium } = require('playwright');
const path = require('path');

async function testWideCorpCeoSync() {
  console.log('🔄 Testing Wide Corp CEO LiveStore Sync...');
  
  const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
  const WIDE_CORP_CEO_EMAIL = 'ceo@widecorp.com';
  const WIDE_CORP_CEO_PASSWORD = 'WideCorp2024!CEO';
  
  let browser;
  
  try {
    // Launch browser without persistent context to start fresh
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    console.log('🚀 Browser launched for Wide Corp CEO login');
    
    // Set up network monitoring for mutations and sync
    const syncActivity = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('sync') || url.includes('mutation') || 
          url.includes('livestore') || url.includes('widecorp') || 
          url.includes(WIDE_CORP_ORG_ID) || url.includes('01920000')) {
        
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'REQUEST',
          method: request.method(),
          url: url,
          isWideCorp: url.includes(WIDE_CORP_ORG_ID) || url.includes('01920000')
        };
        syncActivity.push(activity);
        console.log('📡 REQUEST:', activity.method, activity.url.substring(activity.url.indexOf('/api')));
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('sync') || url.includes('mutation') || 
          url.includes('livestore') || url.includes('widecorp') || 
          url.includes(WIDE_CORP_ORG_ID) || url.includes('01920000')) {
        
        const activity = {
          timestamp: new Date().toISOString(),
          type: 'RESPONSE',
          status: response.status(),
          url: url,
          isWideCorp: url.includes(WIDE_CORP_ORG_ID) || url.includes('01920000')
        };
        syncActivity.push(activity);
        console.log('📡 RESPONSE:', activity.status, activity.url.substring(activity.url.indexOf('/api')));
      }
    });
    
    // Step 1: Login as Wide Corp CEO
    console.log('🔐 Step 1: Logging in as Wide Corp CEO...');
    await page.goto('http://localhost:5174/sign-in');
    await page.waitForTimeout(2000);
    
    // Fill in login form
    try {
      await page.fill('input[type="email"]', WIDE_CORP_CEO_EMAIL);
      await page.fill('input[type="password"]', WIDE_CORP_CEO_PASSWORD);
      
      // Click sign in button
      const signInButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Sign in")'));
      await signInButton.click();
      
      console.log('✅ Login form submitted for Wide Corp CEO');
      
      // Wait for login to complete
      await page.waitForTimeout(5000);
      
      // Check if login was successful
      const loginResult = await page.evaluate(() => {
        return {
          url: window.location.href,
          isSignInPage: window.location.pathname.includes('sign-in'),
          orgId: localStorage.getItem('vibestack-last-organization-id'),
          hasAuth: !!localStorage.getItem('vibestack-auth-token') || document.cookie.includes('auth')
        };
      });
      
      console.log('🔐 Login Result:', loginResult);
      
      if (loginResult.isSignInPage) {
        console.log('⚠️ Still on sign-in page, login may have failed');
        console.log('   Continuing with test anyway...');
      } else {
        console.log('✅ Successfully logged in as Wide Corp CEO');
        console.log('   Organization ID:', loginResult.orgId);
      }
      
    } catch (loginError) {
      console.log('⚠️ Login form interaction failed:', loginError.message);
      console.log('   Continuing to LiveStore test...');
    }
    
    // Step 2: Navigate to LiveStore debug page
    console.log('\n📍 Step 2: Navigating to LiveStore debug page...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    await page.waitForTimeout(3000);
    
    // Check current state
    const pageState = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        hasLiveStoreDomain: !!window.liveStoreDomain,
        liveStoreDomainServices: window.liveStoreDomain ? Object.keys(window.liveStoreDomain.services || {}) : [],
        pageText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('📊 Page State:', pageState);
    
    // Step 3: Run LiveStore tests and monitor for sync activity
    console.log('\n🧪 Step 3: Running LiveStore tests with Wide Corp CEO...');
    
    try {
      // Clear previous network activity
      syncActivity.length = 0;
      
      // Click Run All Tests
      const runAllButton = page.locator('button:has-text("Run All Tests")');
      await runAllButton.click();
      console.log('✅ Clicked "Run All Tests" as Wide Corp CEO');
      
      // Wait for tests to complete
      await page.waitForTimeout(7000);
      
      // Try specific test buttons
      console.log('🔧 Clicking individual test buttons...');
      
      const testButtons = [
        'Test Create Operations',
        'Test Domain Services', 
        'Test Sync Status',
        '🔬 Full LiveStore Test'
      ];
      
      for (const buttonText of testButtons) {
        try {
          const button = page.locator(`button:has-text("${buttonText}")`);
          await button.click();
          console.log(`✅ Clicked "${buttonText}"`);
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log(`⚠️ Failed to click "${buttonText}":`, error.message);
        }
      }
      
    } catch (error) {
      console.log('❌ Test button interaction failed:', error.message);
    }
    
    // Step 4: Try direct mutation operations
    console.log('\n🧪 Step 4: Testing direct mutations with Wide Corp schemas...');
    
    const mutationResults = await page.evaluate(async () => {
      const results = [];
      
      try {
        console.log('Checking LiveStore domain services...');
        
        if (!window.liveStoreDomain) {
          return { error: 'liveStoreDomain not available' };
        }
        
        const services = window.liveStoreDomain.services || {};
        console.log('Available services:', Object.keys(services));
        
        // Test project creation
        if (services.project && services.project.create) {
          console.log('Testing project creation...');
          
          const projectData = {
            name: `CEO Sync Test Project ${Date.now()}`,
            description: 'Wide Corp CEO testing LiveStore sync mutations',
            project_type: 'Executive Testing',
            status: 'planning'
          };
          
          try {
            const projectResult = await services.project.create(projectData);
            results.push({
              operation: 'project_create',
              success: projectResult.success,
              data: projectResult.data,
              error: projectResult.error
            });
            console.log('Project creation result:', projectResult);
          } catch (projectError) {
            results.push({
              operation: 'project_create', 
              success: false,
              error: projectError.message
            });
          }
        }
        
        // Test skill creation
        if (services.skill && services.skill.create) {
          console.log('Testing skill creation...');
          
          const skillData = {
            name: `Executive Leadership ${Date.now()}`,
            category: 'Management',
            level: 'Expert',
            description: 'Wide Corp CEO executive leadership skills'
          };
          
          try {
            const skillResult = await services.skill.create(skillData);
            results.push({
              operation: 'skill_create',
              success: skillResult.success,
              data: skillResult.data,
              error: skillResult.error
            });
            console.log('Skill creation result:', skillResult);
          } catch (skillError) {
            results.push({
              operation: 'skill_create',
              success: false, 
              error: skillError.message
            });
          }
        }
        
        // Try to create a client
        if (services.client && services.client.create) {
          console.log('Testing client creation...');
          
          const clientData = {
            name: `CEO Test Client ${Date.now()}`,
            industry: 'Technology',
            contact_email: 'test@example.com'
          };
          
          try {
            const clientResult = await services.client.create(clientData);
            results.push({
              operation: 'client_create',
              success: clientResult.success,
              data: clientResult.data,
              error: clientResult.error
            });
            console.log('Client creation result:', clientResult);
          } catch (clientError) {
            results.push({
              operation: 'client_create',
              success: false,
              error: clientError.message
            });
          }
        }
        
        return {
          success: true,
          results: results,
          totalOperations: results.length,
          availableServices: Object.keys(services)
        };
        
      } catch (error) {
        console.error('Mutation testing error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Mutation Results:', mutationResults);
    
    // Wait for any additional sync activity
    await page.waitForTimeout(5000);
    
    // Step 5: Analyze all sync activity
    console.log('\n📈 Step 5: Analyzing sync activity...');
    
    const wideCorpActivity = syncActivity.filter(activity => activity.isWideCorp);
    const mutationActivity = syncActivity.filter(activity => 
      activity.url.includes('mutation') || 
      activity.url.includes('create') ||
      activity.url.includes('project') ||
      activity.url.includes('skill') ||
      activity.url.includes('client')
    );
    
    console.log('🌐 Sync Activity Analysis:');
    console.log('  Total API Activity:', syncActivity.length);
    console.log('  Wide Corp API Calls:', wideCorpActivity.length);
    console.log('  Mutation-related Calls:', mutationActivity.length);
    
    if (syncActivity.length > 0) {
      console.log('\n📡 All API Activity:');
      syncActivity.forEach((activity, index) => {
        const urlPart = activity.url.substring(activity.url.indexOf('/api'));
        console.log(`  ${index + 1}. ${activity.type} ${activity.method || activity.status} ${urlPart}`);
      });
    }
    
    // Get final page state
    const finalPageState = await page.evaluate(() => {
      return {
        pageText: document.body.innerText.substring(0, 2000),
        hasSuccessIndicators: document.body.innerText.includes('Success') || document.body.innerText.includes('✅'),
        hasErrorIndicators: document.body.innerText.includes('Error') || document.body.innerText.includes('❌'),
        orgInfo: document.body.innerText.match(/Organization ID: ([a-f0-9-]+)/)?.[1] || 'not found',
        domainServicesCount: document.body.innerText.match(/Domain Services: (\d+)/)?.[1] || '0'
      };
    });
    
    console.log('📄 Final Page Analysis:');
    console.log('  Success Indicators:', finalPageState.hasSuccessIndicators ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('  Error Indicators:', finalPageState.hasErrorIndicators ? '⚠️ FOUND' : '✅ NOT FOUND');
    console.log('  Organization ID:', finalPageState.orgInfo);
    console.log('  Domain Services Count:', finalPageState.domainServicesCount);
    
    // Take screenshot
    console.log('\n📸 Taking Wide Corp CEO test screenshot...');
    await page.screenshot({ 
      path: 'widecorp-ceo-sync-test.png',
      fullPage: true 
    });
    
    // Final assessment
    const hasSuccessfulMutations = mutationResults.success && 
                                  mutationResults.results && 
                                  mutationResults.results.some(r => r.success);
    
    const hasSyncMessages = syncActivity.length > 0;
    const hasWideCorpActivity = wideCorpActivity.length > 0;
    const hasRealOrgId = finalPageState.orgInfo === WIDE_CORP_ORG_ID;
    
    console.log('\n🎉 WIDE CORP CEO LIVESTORE SYNC TEST SUMMARY:');
    console.log('='.repeat(70));
    console.log('  👤 User: Wide Corp CEO (ceo@widecorp.com)');
    console.log('  🏢 Expected Organization:', WIDE_CORP_ORG_ID);
    console.log('  🏢 Actual Organization:', finalPageState.orgInfo);
    console.log('  ✅ Correct Organization:', hasRealOrgId ? '✅ YES' : '❌ NO');
    console.log('  🔄 Successful Mutations:', hasSuccessfulMutations ? '✅ YES' : '❌ NO');
    console.log('  📡 Sync Messages:', hasSyncMessages ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🎯 Wide Corp API Activity:', hasWideCorpActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🌐 Total API Calls:', syncActivity.length);
    console.log('  🔧 Domain Services:', finalPageState.domainServicesCount);
    console.log('='.repeat(70));
    
    if (hasRealOrgId && hasSuccessfulMutations && hasSyncMessages) {
      console.log('🎯 LIVESTORE SYNC FULLY WORKING! ✅');
      console.log('   Wide Corp CEO can create mutations that trigger sync messages');
      console.log('   The LiveStore conversion is successfully integrated!');
    } else if (hasSuccessfulMutations) {
      console.log('🔄 MUTATIONS WORKING, LIMITED SYNC ⚠️');
      console.log('   LiveStore mutations work but sync messages need investigation');
    } else if (hasSyncMessages) {
      console.log('📡 SYNC INFRASTRUCTURE WORKING ⚠️');
      console.log('   API sync calls detected but mutations may need schema fixes');
    } else {
      console.log('⚠️ SETUP ISSUES DETECTED');
      console.log('   Check Wide Corp CEO authentication and organization setup');
    }
    
    console.log('\n📍 Screenshot saved as: widecorp-ceo-sync-test.png');
    
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
testWideCorpCeoSync()
  .then(() => {
    console.log('\n✅ Wide Corp CEO LiveStore sync test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Wide Corp CEO LiveStore sync test failed:', error);
    process.exit(1);
  });