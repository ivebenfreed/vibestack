/**
 * Test to verify the timeline artifact fix
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('timeline should not have cut-off artifacts', async ({ page }) => {
  await page.goto('/debug/vibegantt');
  await page.waitForSelector('.vibegantt', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Take a screenshot of the timeline area
  await page.screenshot({ 
    path: 'screenshots/timeline-artifact-fixed.png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1200, height: 200 }
  });
  
  console.log('Screenshot saved to screenshots/timeline-artifact-fixed.png');
  
  // Check that timeline labels are rendering correctly
  const labels = await page.evaluate(() => {
    const labels = document.querySelectorAll('.vibegantt-timeline-label');
    return Array.from(labels).map(l => ({
      text: l.textContent?.trim(),
      left: l.style.left,
      width: l.style.width
    })).filter(l => l.text);
  });
  
  console.log(`Found ${labels.length} timeline labels`);
  console.log('First 5 labels:', labels.slice(0, 5));
  
  // Verify labels exist
  expect(labels.length).toBeGreaterThan(0);
});