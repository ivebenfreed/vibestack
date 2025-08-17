/**
 * Debug: Capture ALL console logs during app load
 */

import { test, expect } from './helpers/fixtures/persistent-context.js';

test('capture all console logs during app load', async ({ page }) => {
  const consoleLogs = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  
  // Capture ALL console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    console.log(`[BROWSER-${type.toUpperCase()}] ${text}`);
    
    if (type === 'error') {
      consoleErrors.push(text);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    } else {
      consoleLogs.push(text);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE-ERROR] ${error.message}`);
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });
  
  // Capture request failures
  page.on('requestfailed', request => {
    console.log(`[REQUEST-FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  console.log('🌐 Navigating to http://localhost:5173...');
  
  // Navigate and wait
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  
  console.log('📍 Page loaded, waiting 10 seconds for all logs...');
  
  // Wait for app to initialize (or fail)
  await page.waitForTimeout(10000);
  
  console.log('\n=== FINAL CONSOLE SUMMARY ===');
  console.log(`Total logs: ${consoleLogs.length}`);
  console.log(`Total warnings: ${consoleWarnings.length}`);
  console.log(`Total errors: ${consoleErrors.length}`);
  
  if (consoleErrors.length > 0) {
    console.log('\n🚨 CONSOLE ERRORS:');
    consoleErrors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
  }
  
  if (consoleWarnings.length > 0) {
    console.log('\n⚠️ CONSOLE WARNINGS:');
    consoleWarnings.forEach((warning, i) => {
      console.log(`${i + 1}. ${warning}`);
    });
  }
  
  console.log('\n📋 RECENT LOGS:');
  consoleLogs.slice(-10).forEach((log, i) => {
    console.log(`${i + 1}. ${log}`);
  });
  
  // Check if playwright ready hook exists
  const playwrightReady = await page.evaluate(() => {
    return document.body.getAttribute('data-playwright-ready');
  });
  
  console.log(`\n🎭 Playwright ready status: ${playwrightReady || 'NOT SET'}`);
  
  // Check if root element exists
  const rootExists = await page.locator('#root').count();
  console.log(`🔍 Root element exists: ${rootExists > 0}`);
  
  // Get page title
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);
  
  console.log('\n=== END SUMMARY ===');
});