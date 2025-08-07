import { test, expect } from '@playwright/test';

test('debug dependency DOM classes', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // Check what dependency elements exist and their classes
  const depElements = await page.evaluate(() => {
    const deps = [];
    
    // Check for vibegantt-dependency elements
    document.querySelectorAll('[data-dependency-id]').forEach(el => {
      deps.push({
        tagName: el.tagName,
        className: el.className,
        dataset: el.dataset,
        hasDataDependencyId: !!el.getAttribute('data-dependency-id')
      });
    });
    
    return deps;
  });
  
  console.log('Found dependency elements:', depElements);
  
  // Test the specific selectors
  const selectorTests = await page.evaluate(() => {
    const results = {};
    
    // Test old selector (.vibegantt-dependency-group)
    const oldSelector = document.querySelectorAll('.vibegantt-dependency-group[data-dependency-id]');
    results.oldSelector = oldSelector.length;
    
    // Test new selector (.vibegantt-dependency)  
    const newSelector = document.querySelectorAll('.vibegantt-dependency[data-dependency-id]');
    results.newSelector = newSelector.length;
    
    // Test generic data attribute selector
    const dataSelector = document.querySelectorAll('[data-dependency-id]');
    results.dataSelector = dataSelector.length;
    
    return results;
  });
  
  console.log('Selector test results:', selectorTests);
  
  // Try clicking on a dependency if one exists
  if (selectorTests.dataSelector > 0) {
    const firstDep = page.locator('[data-dependency-id]').first();
    console.log('Clicking first dependency...');
    await firstDep.click();
    await page.waitForTimeout(1000);
    
    // Check if selection state changed
    const postClickState = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-dependency-id]');
      const results = [];
      elements.forEach(el => {
        results.push({
          id: el.getAttribute('data-dependency-id'),
          classes: el.className,
          hasSelected: el.classList.contains('selected'),
          stroke: el.querySelector('path')?.getAttribute('stroke') || 'none'
        });
      });
      return results;
    });
    
    console.log('Post-click dependency states:', postClickState);
  }
});