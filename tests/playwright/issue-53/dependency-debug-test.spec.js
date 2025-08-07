/**
 * Debug test to understand why dependency selection isn't working
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('debug dependency click handlers', async ({ page }) => {
  // Navigate to debug route
  await page.goto('/debug/vibegantt');
  
  // Wait for Gantt to load
  await page.waitForSelector('.vibegantt', { state: 'visible' });
  await page.waitForSelector('.vibegantt-task', { state: 'visible' });
  
  // Wait for dependencies to render
  await page.waitForTimeout(3000);
  
  // Debug: Check if click handlers are attached
  const hasClickHandlers = await page.evaluate(() => {
    const deps = document.querySelectorAll('.vibegantt-dependency-group');
    const results = [];
    
    deps.forEach((dep, i) => {
      const hasListener = dep.onclick !== null || dep.hasAttribute('onclick');
      
      results.push({
        index: i,
        hasOnClick: hasListener,
        className: dep.className,
        dataTestId: dep.getAttribute('data-testid'),
        innerHTML: dep.innerHTML.substring(0, 100)
      });
    });
    
    return results;
  });
  
  console.log('Dependencies found:', hasClickHandlers.length);
  hasClickHandlers.forEach(dep => {
    console.log(`Dep ${dep.index}:`, dep);
  });
  
  // Try to trigger click event directly in the page
  const clickResult = await page.evaluate(() => {
    const dep = document.querySelector('.vibegantt-dependency-group');
    if (!dep) return 'No dependency found';
    
    // Create and dispatch click event
    const event = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    dep.dispatchEvent(event);
    
    // Check if selected
    return {
      dispatched: true,
      hasSelectedClass: dep.classList.contains('selected'),
      className: dep.className
    };
  });
  
  console.log('Direct click result:', clickResult);
  
  // Check what happens with pointer events
  const pointerResult = await page.evaluate(() => {
    const deps = document.querySelectorAll('.vibegantt-dependency-group');
    const results = [];
    
    deps.forEach((dep, i) => {
      const styles = window.getComputedStyle(dep);
      results.push({
        index: i,
        pointerEvents: styles.pointerEvents,
        cursor: styles.cursor,
        opacity: styles.opacity
      });
    });
    
    return results;
  });
  
  console.log('Pointer event styles:');
  pointerResult.forEach(dep => {
    console.log(`Dep ${dep.index}:`, dep);
  });
});