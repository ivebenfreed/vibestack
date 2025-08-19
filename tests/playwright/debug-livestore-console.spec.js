/**
 * Debug LiveStore Console Messages
 */

import { test, expect } from './fixtures/persistent-context.js';

test('Debug LiveStore initialization console messages', async ({ page }) => {
  console.log('🧪 Debugging LiveStore console messages...');
  
  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text,
      timestamp: new Date().toISOString()
    });
  });

  // Navigate to the app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Handle organization selection if needed
  const hasOrgSelection = await page.locator('text=Select Organization').isVisible({ timeout: 3000 });
  if (hasOrgSelection) {
    console.log('🏢 Selecting Wide Corp Solutions...');
    await page.locator('text=Wide Corp Solutions').click();
    await page.waitForTimeout(3000);
  }

  // Wait longer for async initialization
  console.log('⏳ Waiting 10 seconds for async LiveStore initialization...');
  await page.waitForTimeout(10000);

  // Check final state
  const finalState = await page.evaluate(() => {
    return {
      liveStore: typeof window.LiveStore !== 'undefined',
      liveStoreType: typeof window.LiveStore,
      syncActor: !!window.syncMachineActor,
      appInitActor: !!window.appInitActor
    };
  });

  console.log('🎯 Final state:', finalState);

  // Print all console messages related to LiveStore or sync
  const relevantMessages = consoleMessages.filter(msg => 
    msg.text.includes('LiveStore') || 
    msg.text.includes('service') || 
    msg.text.includes('sync') ||
    msg.text.includes('error') ||
    msg.text.includes('failed') ||
    msg.type === 'error'
  );

  console.log('\n📄 Relevant console messages:');
  relevantMessages.forEach((msg, i) => {
    console.log(`${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
  });

  console.log(`\n📊 Total messages: ${consoleMessages.length}, Relevant: ${relevantMessages.length}`);
  console.log('✅ Debug complete');
});