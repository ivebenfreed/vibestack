#!/usr/bin/env node

/**
 * Core Test Utility: Organization Selection
 * 
 * Tests that the auth machine correctly selects organizations.
 * Default behavior: Wide Corp Solutions is auto-selected for CEO user.
 * 
 * Usage: 
 *   node tests/playwright/core/test-org-selection.js [orgName]
 *   node tests/playwright/core/test-org-selection.js wide     # Wide Corp Solutions (default)
 *   node tests/playwright/core/test-org-selection.js poly     # Polymorphic Test CRM
 *   node tests/playwright/core/test-org-selection.js "Custom Org Name"
 */

const { chromium } = require('playwright');

const DEFAULT_ORGS = {
  'wide': 'Wide Corp Solutions',
  'poly': 'Polymorphic Test CRM'
};

async function testOrgSelection(desiredOrgName) {
  console.log(`🧪 Testing organization selection: ${desiredOrgName}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Set up organization preference if not testing default
    await page.goto('http://localhost:5173');
    
    if (desiredOrgName !== 'Wide Corp Solutions') {
      // For non-default orgs, we need to set the preference explicitly
      const orgId = desiredOrgName === 'Polymorphic Test CRM' ? 
        '01920000-2000-7000-8000-000000000002' : null;
      
      if (orgId) {
        await page.evaluate((id) => {
          localStorage.setItem('vibestack-last-organization-id', id);
          console.log(`[TEST] Set org preference to: ${id}`);
        }, orgId);
      } else {
        // Clear preference to test default behavior
        await page.evaluate(() => {
          localStorage.removeItem('vibestack-last-organization-id');
        });
      }
    } else {
      // Clear preference to test Wide Corp default behavior
      await page.evaluate(() => {
        localStorage.removeItem('vibestack-last-organization-id');
      });
    }
    
    // Navigate and sign in
    await page.goto('http://localhost:5173');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    
    // Wait for auth and org selection to complete
    await page.waitForTimeout(8000);
    
    // Check selected organization
    const selectedOrg = await page.evaluate(() => {
      const authState = localStorage.getItem('auth-machine-state');
      if (authState) {
        const parsed = JSON.parse(authState);
        return parsed?.context?.currentOrganization?.name || 'None';
      }
      return 'No auth state';
    });
    
    console.log(`📋 Selected: ${selectedOrg}`);
    
    if (selectedOrg === desiredOrgName) {
      console.log(`✅ SUCCESS: Correct organization selected`);
      process.exit(0);
    } else {
      console.log(`❌ FAIL: Expected "${desiredOrgName}", got "${selectedOrg}"`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let orgName = 'Wide Corp Solutions'; // Default

if (args.length > 0) {
  const input = args[0].toLowerCase();
  if (DEFAULT_ORGS[input]) {
    orgName = DEFAULT_ORGS[input];
  } else {
    orgName = args[0];
  }
}

testOrgSelection(orgName).catch(console.error);