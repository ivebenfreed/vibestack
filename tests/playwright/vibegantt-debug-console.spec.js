// tests/playwright/vibegantt-debug-console.spec.js
// Test to capture console output and debug VibeGantt initialization
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Console Debug Tests', () => {
  test.setTimeout(60000);
  
  test('should capture console logs during VibeGantt initialization', async ({ page }) => {
    console.log('🎯 Starting VibeGantt console debug test...');
    
    // Capture all console messages
    const consoleLogs = [];
    const consoleErrors = [];
    const consoleWarns = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      
      if (type === 'error') {
        consoleErrors.push(text);
        console.log(`❌ [ERROR]: ${text}`);
      } else if (type === 'warning') {
        consoleWarns.push(text);
        console.log(`⚠️ [WARN]: ${text}`);
      } else if (text.includes('VibeGantt') || text.includes('gantt') || text.includes('Gantt') || text.includes('renderer') || text.includes('store')) {
        consoleLogs.push(text);
        console.log(`📝 [LOG]: ${text}`);
      }
    });
    
    // Capture network errors
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      console.log(`🌐 [NETWORK ERROR]: ${request.url()} - ${failure?.errorText}`);
    });
    
    // Navigate to debug page
    console.log('🌐 Navigating to VibeGantt debug page...');
    await page.goto('/debug/vibegantt');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('⏳ Network idle achieved');
    
    // Wait for component initialization
    await page.waitForTimeout(5000);
    console.log('⏳ Waited for component initialization');
    
    // Check for the main container
    const container = page.locator('.vibegantt');
    await expect(container).toBeVisible();
    console.log('✅ VibeGantt container is visible');
    
    // Inspect the container contents
    const containerHTML = await container.innerHTML();
    console.log(`🔍 Container HTML length: ${containerHTML.length} characters`);
    console.log(`🔍 Container HTML preview: ${containerHTML.substring(0, 500)}...`);
    
    // Check for child elements
    const childCount = await container.locator('*').count();
    console.log(`🔍 Container child element count: ${childCount}`);
    
    // Look for specific gantt elements
    const taskListElements = await page.locator('.vibegantt-task-list').count();
    const timelineElements = await page.locator('.vibegantt-timeline').count();
    const taskElements = await page.locator('[data-task-id]').count();
    
    console.log(`🔍 Task list elements: ${taskListElements}`);
    console.log(`🔍 Timeline elements: ${timelineElements}`);
    console.log(`🔍 Task elements: ${taskElements}`);
    
    // Check global window objects
    const windowObjects = await page.evaluate(() => {
      return {
        hasRendererOptions: '__vibegantt_renderer_options' in window,
        hasStoreActor: '__vibegantt_store_actor' in window,
        rendererOptionsKeys: window.__vibegantt_renderer_options ? Object.keys(window.__vibegantt_renderer_options) : [],
        storeActorState: window.__vibegantt_store_actor ? window.__vibegantt_store_actor.getSnapshot() : null
      };
    });
    
    console.log('🔍 Window objects:', JSON.stringify(windowObjects, null, 2));
    
    // Try to trigger more console output by interacting with the component
    console.log('🖱️ Attempting to interact with component...');
    await page.click('.vibegantt');
    await page.waitForTimeout(1000);
    
    // Try clicking debug controls
    const zoomSelect = page.locator('select');
    if (await zoomSelect.count() > 0) {
      console.log('🔧 Changing zoom level to trigger updates...');
      await zoomSelect.selectOption('month');
      await page.waitForTimeout(2000);
    }
    
    // Final screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-console-debug.png',
      fullPage: true 
    });
    
    // Report summary
    console.log('\n=== CONSOLE DEBUG SUMMARY ===');
    console.log(`📊 Total console logs: ${consoleLogs.length}`);
    console.log(`⚠️ Total warnings: ${consoleWarns.length}`);
    console.log(`❌ Total errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n❌ ERRORS:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    if (consoleWarns.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      consoleWarns.forEach((warn, i) => {
        console.log(`  ${i + 1}. ${warn}`);
      });
    }
    
    if (consoleLogs.length > 0) {
      console.log('\n📝 RELEVANT LOGS:');
      consoleLogs.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log}`);
      });
    }
    
    // Check if data was loaded
    const hasData = windowObjects.storeActorState && windowObjects.storeActorState.context && (
      Object.keys(windowObjects.storeActorState.context.tasks || {}).length > 0 ||
      Object.keys(windowObjects.storeActorState.context.dependencies || {}).length > 0
    );
    
    console.log(`🔍 Data loaded in store: ${hasData}`);
    
    if (hasData && windowObjects.storeActorState?.context) {
      const taskCount = Object.keys(windowObjects.storeActorState.context.tasks || {}).length;
      const depCount = Object.keys(windowObjects.storeActorState.context.dependencies || {}).length;
      console.log(`📊 Tasks in store: ${taskCount}`);
      console.log(`📊 Dependencies in store: ${depCount}`);
    }
    
    // The test passes if we can capture console output (regardless of errors)
    expect(consoleLogs.length + consoleErrors.length + consoleWarns.length).toBeGreaterThan(0);
  });
});