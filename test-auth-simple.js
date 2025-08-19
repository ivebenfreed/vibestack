#!/usr/bin/env node

/**
 * Simple Authentication Test
 * 
 * Checks if Wide Corp CEO authentication is working
 */

const { chromium } = require('playwright');
const path = require('path');

async function testAuthentication() {
  console.log('🔐 Testing Wide Corp CEO authentication...');
  
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', 'profile-main');
  
  let browser;
  
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    console.log('🚀 Browser launched with persistent context');
    
    // Navigate to the main app
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(3000);
    
    const authStatus = await page.evaluate(() => {
      return {
        url: window.location.href,
        pathname: window.location.pathname,
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        isSignIn: window.location.pathname.includes('sign-in'),
        title: document.title,
        bodyText: document.body.innerText.substring(0, 300)
      };
    });
    
    console.log('📊 Current auth status:', authStatus);
    
    if (authStatus.isSignIn) {
      console.log('🔑 Need to complete authentication manually');
      console.log('   Please login as Wide Corp CEO in the browser');
      console.log('   Then press Enter to continue...');
      
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      // Check again
      await page.waitForTimeout(2000);
      const newStatus = await page.evaluate(() => {
        return {
          url: window.location.href,
          orgId: localStorage.getItem('vibestack-last-organization-id'),
          isAuthenticated: !window.location.pathname.includes('sign-in')
        };
      });
      
      console.log('📊 Updated auth status:', newStatus);
      
      if (newStatus.isAuthenticated && newStatus.orgId) {
        console.log('✅ Authentication successful!');
        console.log(`   Organization: ${newStatus.orgId}`);
      } else {
        console.log('⚠️ Authentication may not be complete');
      }
    } else {
      console.log('✅ Already authenticated!');
      console.log(`   Organization: ${authStatus.orgId}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'auth-test-result.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved as: auth-test-result.png');
    
    console.log('\n🔍 Now testing route access...');
    
    // Try different debug routes
    const routes = [
      '/debug/livestore-test',
      '/debug',
      '/tasks',
      '/projects'
    ];
    
    for (const route of routes) {
      console.log(`📍 Testing route: ${route}`);
      await page.goto(`http://localhost:5174${route}`);
      await page.waitForTimeout(2000);
      
      const routeStatus = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          is404: document.body.innerText.includes('404'),
          hasContent: document.body.innerText.length > 100
        };
      });
      
      console.log(`   Result: ${routeStatus.is404 ? '❌ 404' : '✅ OK'} - ${routeStatus.title}`);
      
      if (!routeStatus.is404 && route.includes('debug')) {
        console.log('✅ Found working debug route!');
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      console.log('\n🔒 Keeping browser open for 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

testAuthentication()
  .then(() => {
    console.log('\n✅ Authentication test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Authentication test failed:', error.message);
    process.exit(1);
  });