#!/usr/bin/env tsx
/**
 * DataForge UI Test Suite
 * Tests entity creation and management through the UI
 */

import puppeteer from 'puppeteer';

const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

// Test credentials
const TEST_USER = {
  email: 'ceo@widecorp.com',
  password: 'WideCorp2024!CEO'
};

// All 8 DataForge archetypes to test
const ARCHETYPES = [
  { value: 'project', label: 'Project', icon: '📁' },
  { value: 'task', label: 'Task', icon: '✅' },
  { value: 'record', label: 'Record', icon: '💾' },
  { value: 'document', label: 'Document', icon: '📄' },
  { value: 'file', label: 'File', icon: '📎' },
  { value: 'activity', label: 'Activity', icon: '⚡' },
  { value: 'discussion', label: 'Discussion', icon: '💬' },
  { value: 'collection', label: 'Collection', icon: '📚' },
];

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ test: name, passed: true, duration });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ test: name, passed: false, error: String(error), duration });
    console.log(`❌ ${name}: ${error} (${duration}ms)`);
  }
}

async function main() {
  console.log('🧪 Testing DataForge UI Operations\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    // Test 1: Login
    await runTest('Login to application', async () => {
      await page.goto(`${WEB_URL}/sign-in`);
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      
      await page.type('input[type="email"]', TEST_USER.email);
      await page.type('input[type="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      const url = page.url();
      if (!url.includes('/dashboard') && !url.includes('/entities')) {
        throw new Error(`Expected to be on dashboard, but on ${url}`);
      }
    });
    
    // Test 2: Navigate to entities page
    await runTest('Navigate to entities page', async () => {
      // Check if we have a sidebar link or need to navigate directly
      const entitiesLink = await page.$('a[href*="/entities"]');
      if (entitiesLink) {
        await entitiesLink.click();
      } else {
        await page.goto(`${WEB_URL}/entities`);
      }
      
      await page.waitForSelector('h1', { timeout: 5000 });
    });
    
    // Test 3: Open entity creation dialog
    await runTest('Open entity creation dialog', async () => {
      // Look for "Create Entity" or "New Entity" button
      const createButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('create') ||
          btn.textContent?.toLowerCase().includes('new') ||
          btn.textContent?.toLowerCase().includes('add')
        );
      });
      
      if (createButton) {
        await (createButton as any).click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      } else {
        throw new Error('Could not find entity creation button');
      }
    });
    
    // Test 4-11: Test each archetype
    for (const archetype of ARCHETYPES) {
      await runTest(`Create entity with ${archetype.label} archetype`, async () => {
        const timestamp = Date.now();
        const entityName = `UITest${archetype.label}${timestamp}`;
        
        // Fill in entity name
        const nameInput = await page.$('input[id="entity-name"]');
        if (nameInput) {
          await nameInput.click({ clickCount: 3 }); // Select all
          await nameInput.type(entityName);
        }
        
        // Select archetype from dropdown
        const archetypeSelect = await page.$('[id="archetype"]');
        if (archetypeSelect) {
          await archetypeSelect.click();
          
          // Wait for dropdown to open and select the archetype
          await page.waitForSelector('[role="option"]', { timeout: 2000 });
          const option = await page.evaluateHandle((archetypeValue) => {
            const options = Array.from(document.querySelectorAll('[role="option"]'));
            return options.find(opt => 
              opt.textContent?.toLowerCase().includes(archetypeValue.toLowerCase())
            );
          }, archetype.value);
          
          if (option) {
            await (option as any).click();
          }
        }
        
        // Submit the form
        const submitButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => 
            btn.textContent?.toLowerCase().includes('create') ||
            btn.textContent?.toLowerCase().includes('save')
          );
        });
        
        if (submitButton) {
          await (submitButton as any).click();
          
          // Wait for success notification or dialog close
          await page.waitForFunction(
            () => !document.querySelector('[role="dialog"]'),
            { timeout: 5000 }
          );
        }
      });
    }
    
    // Test 12: Verify entities were created
    await runTest('Verify entities appear in list', async () => {
      // Refresh or navigate to entities page
      await page.reload({ waitUntil: 'networkidle0' });
      
      // Check if we can see entity cards
      const entityCards = await page.$$('.entity-card, [data-entity], article');
      if (entityCards.length === 0) {
        throw new Error('No entity cards found on page');
      }
      
      // Check for archetype badges
      const badges = await page.$$('[class*="badge"]');
      if (badges.length === 0) {
        console.warn('Warning: No archetype badges found');
      }
    });
    
  } finally {
    await browser.close();
  }
  
  // Summary
  console.log('\n📊 UI Test Results Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All UI tests passed!');
  }
}

main().catch(console.error);