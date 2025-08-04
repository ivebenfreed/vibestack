// tests/playwright/debug-inputs.spec.js
import { test, expect } from '@playwright/test';

test.describe('Debug Input Fields', () => {
  test('check input selectors', async ({ page }) => {
    console.log('=== DEBUGGING INPUT FIELDS ===');
    
    // Navigate
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    console.log('Current URL:', page.url());
    
    // Find all input elements
    const allInputs = await page.locator('input').all();
    console.log(`\nFound ${allInputs.length} input elements:`);
    
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const className = await input.getAttribute('class');
      
      console.log(`\nInput ${i + 1}:`);
      console.log('  type:', type);
      console.log('  name:', name);
      console.log('  id:', id);
      console.log('  placeholder:', placeholder);
      console.log('  class:', className?.substring(0, 50) + '...');
    }
    
    // Check specific selectors
    console.log('\n=== CHECKING SPECIFIC SELECTORS ===');
    
    const selectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input#email',
      'input[type="text"]',
      'input[type="password"]',
      'input[name="password"]',
      'input#password'
    ];
    
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      console.log(`${selector}: ${count} matches`);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/debug-inputs.png', fullPage: true });
    console.log('\nScreenshot saved: debug-inputs.png');
    
    // Keep browser open
    await page.waitForTimeout(10000);
  });
});