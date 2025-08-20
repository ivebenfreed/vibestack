#!/usr/bin/env node

/**
 * Core Test Utility: Schema Loading
 * 
 * Tests that schema loading works correctly after organization selection.
 * Verifies that Wide Corp's 12 business entities are loaded properly.
 * 
 * Usage: 
 *   node tests/playwright/core/test-schema-loading.js
 */

const { chromium } = require('playwright');

async function testSchemaLoading() {
  console.log('🔍 Testing schema loading for Wide Corp...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console logs for schema events
  page.on('console', msg => {
    if (msg.text().includes('Schema') || msg.text().includes('SCHEMA') || 
        msg.text().includes('AppInit') || msg.text().includes('LiveStore')) {
      console.log(`🔎 BROWSER: ${msg.text()}`);
    }
  });
  
  try {
    // Clear preferences to ensure Wide Corp is selected
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.removeItem('vibestack-last-organization-id');
    });
    
    // Sign in and trigger schema loading
    await page.goto('http://localhost:5173');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    
    console.log('📝 Sign in completed, waiting for schema loading...');
    
    // Wait for schema to load
    await page.waitForTimeout(10000);
    
    // Check if schema was loaded successfully
    const schemaCheck = await page.evaluate(() => {
      // Check if schema loading events occurred
      const logs = [];
      
      // Check localStorage for schema data
      try {
        const authState = localStorage.getItem('auth-machine-state');
        if (authState) {
          const parsed = JSON.parse(authState);
          const orgName = parsed?.context?.currentOrganization?.name;
          logs.push(`Organization: ${orgName}`);
        }
        
        // Check if LiveStore has schema data
        const liveStoreData = localStorage.getItem('livestore-schema-cache');
        if (liveStoreData) {
          logs.push('LiveStore schema cache found');
        }
        
        return logs;
      } catch (error) {
        return [`Error checking schema: ${error.message}`];
      }
    });
    
    console.log('📋 Schema check results:');
    schemaCheck.forEach(log => console.log(`  - ${log}`));
    
    // Test schema endpoint directly from browser
    const schemaApiTest = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/archetype/orgs/01920000-1000-7000-8000-000000000001/schema', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const data = await response.json();
        const entityCount = data?.schema?.entities ? Object.keys(data.schema.entities).length : 0;
        const entityNames = data?.schema?.entities ? Object.keys(data.schema.entities) : [];
        
        return {
          success: true,
          entityCount,
          entityNames: entityNames.slice(0, 5), // First 5 for brevity
          totalEntities: entityNames.length
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🌐 Schema API test from browser:');
    if (schemaApiTest.success) {
      console.log(`  ✅ Schema loaded successfully`);
      console.log(`  📊 Entity count: ${schemaApiTest.totalEntities}`);
      console.log(`  📝 Sample entities: ${schemaApiTest.entityNames.join(', ')}${schemaApiTest.totalEntities > 5 ? '...' : ''}`);
      
      if (schemaApiTest.totalEntities === 12) {
        console.log('✅ SUCCESS: All 12 Wide Corp entities loaded correctly');
        process.exit(0);
      } else {
        console.log(`❌ FAIL: Expected 12 entities, got ${schemaApiTest.totalEntities}`);
        process.exit(1);
      }
    } else {
      console.log(`  ❌ Schema API failed: ${schemaApiTest.error}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testSchemaLoading().catch(console.error);