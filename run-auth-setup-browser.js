#!/usr/bin/env node

/**
 * Authentication Setup for Wide Corp CEO
 * 
 * Sets up persistent authentication context for testing dynamic LiveStore services
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Helper to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️ .env.local not found, using default credentials');
    return {
      // Default Wide Corp CEO credentials
      VIBE_DEV_EMAIL: 'ceo@widecorp.com',
      VIBE_DEV_PASSWORD: 'WideCorp2024!'
    };
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

async function setupAuthentication() {
  console.log('🔐 Setting up Wide Corp CEO authentication...');
  
  const env = loadEnvFile();
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', 'profile-main');
  
  let browser;
  
  try {
    // Launch browser with persistent context
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await browser.newPage();
    
    console.log('🚀 Browser launched with persistent context');
    console.log(`📁 Profile directory: ${userDataDir}`);
    
    // Navigate to the app
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:5174/');
    
    // Wait for initial load
    await page.waitForTimeout(2000);
    
    // Check if already logged in
    console.log('🔍 Checking authentication status...');
    const isLoggedIn = await page.evaluate(() => {
      // Check if we're on a protected route or if user info is available
      return window.location.pathname.includes('dashboard') || 
             window.location.pathname.includes('tasks') ||
             window.location.pathname.includes('projects') ||
             localStorage.getItem('vibestack-last-organization-id');
    });
    
    if (isLoggedIn) {
      console.log('✅ Already authenticated! Checking organization...');
      
      const orgInfo = await page.evaluate(() => {
        return {
          orgId: localStorage.getItem('vibestack-last-organization-id'),
          currentUrl: window.location.href
        };
      });
      
      console.log('🏢 Organization info:', orgInfo);
      
      if (orgInfo.orgId) {
        console.log('✅ Wide Corp CEO authentication confirmed!');
        console.log(`   Organization ID: ${orgInfo.orgId}`);
        console.log('✅ Authentication setup complete - ready for testing!');
        return;
      }
    }
    
    console.log('🔑 Need to authenticate...');
    
    // Look for sign-in link or button
    const signInSelectors = [
      'a[href*="sign-in"]',
      'button:has-text("Sign In")',
      'text=Sign In',
      'text=Login',
      '[data-testid="sign-in"]'
    ];
    
    let signInElement = null;
    for (const selector of signInSelectors) {
      try {
        signInElement = await page.locator(selector).first();
        if (await signInElement.isVisible({ timeout: 1000 })) {
          console.log(`📍 Found sign-in element: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (signInElement && await signInElement.isVisible()) {
      console.log('🔗 Clicking sign-in...');
      await signInElement.click();
      await page.waitForTimeout(2000);
    }
    
    // Look for email/username field
    console.log('📧 Looking for email field...');
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]'
    ];
    
    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        emailField = page.locator(selector).first();
        if (await emailField.isVisible({ timeout: 2000 })) {
          console.log(`📧 Found email field: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!emailField || !await emailField.isVisible()) {
      throw new Error('Could not find email field. Make sure you are on the sign-in page.');
    }
    
    // Look for password field
    console.log('🔒 Looking for password field...');
    const passwordField = page.locator('input[type="password"]').first();
    
    if (!await passwordField.isVisible({ timeout: 2000 })) {
      throw new Error('Could not find password field');
    }
    
    // Fill in credentials
    console.log('📝 Filling in Wide Corp CEO credentials...');
    await emailField.fill(env.VIBE_DEV_EMAIL || 'ceo@widecorp.com');
    await passwordField.fill(env.VIBE_DEV_PASSWORD || 'WideCorp2024!');
    
    console.log(`   Email: ${env.VIBE_DEV_EMAIL || 'ceo@widecorp.com'}`);
    
    // Look for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'input[type="submit"]',
      'button:has-text("Continue")'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = page.locator(selector).first();
        if (await submitButton.isVisible({ timeout: 1000 })) {
          console.log(`🔘 Found submit button: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!submitButton || !await submitButton.isVisible()) {
      throw new Error('Could not find submit button');
    }
    
    // Submit the form
    console.log('🚀 Submitting login form...');
    await submitButton.click();
    
    // Wait for navigation or success
    console.log('⏳ Waiting for authentication to complete...');
    await page.waitForTimeout(3000);
    
    // Check for organization selection or success
    console.log('🔍 Checking authentication result...');
    
    const authResult = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        pathname: window.location.pathname,
        hasOrgId: !!localStorage.getItem('vibestack-last-organization-id'),
        hasUserData: !!localStorage.getItem('user') || !!sessionStorage.getItem('user')
      };
    });
    
    console.log('📊 Authentication result:', authResult);
    
    // Look for organization selection if needed
    if (authResult.pathname.includes('organization') || authResult.currentUrl.includes('organization')) {
      console.log('🏢 Need to select organization...');
      
      // Look for Wide Corp organization option
      const orgSelectors = [
        'text=Wide Corp',
        'text=WideCorp',
        '[data-testid*="wide"]',
        'button:has-text("Wide Corp")',
        'div:has-text("Wide Corp")'
      ];
      
      let orgElement = null;
      for (const selector of orgSelectors) {
        try {
          orgElement = page.locator(selector).first();
          if (await orgElement.isVisible({ timeout: 2000 })) {
            console.log(`🏢 Found Wide Corp option: ${selector}`);
            await orgElement.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    }
    
    // Final verification
    console.log('✅ Verifying authentication status...');
    await page.waitForTimeout(2000);
    
    const finalCheck = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        orgId: localStorage.getItem('vibestack-last-organization-id'),
        isAuthenticated: window.location.pathname.includes('dashboard') || 
                        window.location.pathname.includes('tasks') ||
                        window.location.pathname.includes('projects') ||
                        !!localStorage.getItem('vibestack-last-organization-id')
      };
    });
    
    console.log('🔍 Final authentication check:', finalCheck);
    
    if (finalCheck.isAuthenticated && finalCheck.orgId) {
      console.log('🎉 AUTHENTICATION SETUP SUCCESSFUL!');
      console.log('✅ Wide Corp CEO authenticated and organization selected');
      console.log(`   Organization ID: ${finalCheck.orgId}`);
      console.log(`   Current URL: ${finalCheck.currentUrl}`);
      console.log('✅ Persistent context saved - ready for testing!');
      
      // Take a screenshot for verification
      await page.screenshot({ 
        path: 'auth-setup-success.png',
        fullPage: true 
      });
      
      console.log('📸 Screenshot saved as: auth-setup-success.png');
      
    } else {
      console.log('⚠️ Authentication may not be complete');
      console.log('   You may need to manually complete the login process');
      
      // Take a screenshot to see current state
      await page.screenshot({ 
        path: 'auth-setup-current-state.png',
        fullPage: true 
      });
      
      console.log('📸 Current state screenshot saved as: auth-setup-current-state.png');
    }
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Take error screenshot
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ 
          path: 'auth-setup-error.png',
          fullPage: true 
        });
        console.log('📸 Error screenshot saved as: auth-setup-error.png');
      }
    }
    
    throw error;
  } finally {
    if (browser) {
      console.log('🔒 Keeping browser open for manual verification...');
      console.log('   Close the browser window when ready');
      
      // Wait a bit before closing so user can see the result
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }
}

// Run the authentication setup
setupAuthentication()
  .then(() => {
    console.log('\n✅ Authentication setup complete!');
    console.log('🚀 Ready to run dynamic LiveStore tests');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Authentication setup failed:', error.message);
    process.exit(1);
  });