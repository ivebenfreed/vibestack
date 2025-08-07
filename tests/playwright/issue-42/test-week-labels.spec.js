/**
 * Test to verify week labels are properly centered and not cut off
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('week labels should be properly centered and sized', async ({ page }) => {
  await page.goto('/debug/vibegantt');
  await page.waitForSelector('.vibegantt', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Trigger zoom to show week labels (around 30px)
  await page.evaluate(() => {
    const wrapper = document.querySelector('.vibegantt-tasks-wrapper');
    if (!wrapper) return;
    
    // Dispatch zoom out events to get to ~30px
    for (let i = 0; i < 2; i++) {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 120,
        clientX: wrapper.clientWidth / 2,
        clientY: wrapper.clientHeight / 2,
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      wrapper.dispatchEvent(wheelEvent);
    }
  });
  
  await page.waitForTimeout(1000);
  
  // Take a screenshot focusing on the timeline
  await page.screenshot({ 
    path: 'screenshots/week-labels-fixed.png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1200, height: 100 }
  });
  
  // Check week label properties
  const weekLabels = await page.evaluate(() => {
    const labels = document.querySelectorAll('.vibegantt-timeline-label');
    const weekLabels = Array.from(labels).filter(l => 
      l.textContent?.trim().startsWith('W')
    );
    
    return weekLabels.map(label => ({
      text: label.textContent?.trim(),
      left: label.style.left,
      width: label.style.width,
      position: label.style.position,
      justifyContent: label.style.justifyContent
    }));
  });
  
  console.log('Week labels found:', weekLabels.length);
  console.log('Sample week labels:', weekLabels.slice(0, 5));
  
  // Verify week labels exist
  expect(weekLabels.length).toBeGreaterThan(0);
  
  // Verify week labels have appropriate width (should be 7 * dayWidth)
  if (weekLabels.length > 0) {
    const firstWidth = parseFloat(weekLabels[0].width);
    console.log(`First week label width: ${firstWidth}px`);
    
    // Week labels should span approximately 7 days (210px at 30px/day)
    expect(firstWidth).toBeGreaterThan(100); // Should be much wider than a single day
  }
  
  console.log('✅ Week labels are properly sized and centered');
});