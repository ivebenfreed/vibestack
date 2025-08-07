import { test, expect } from '../fixtures/persistent-context.js';

test('analyze dependency DOM structure', async ({ page }) => {
  // Navigate to debug route
  await page.goto('/debug/vibegantt');
  await page.waitForSelector('.vibegantt', { state: 'visible' });
  await page.waitForTimeout(2000);
  
  // Analyze all dependency-related elements
  const analysis = await page.evaluate(() => {
    const results = {
      vibeganttDependency: [],
      vibeganttDependencyGroup: [],
      dataDependencyId: [],
      pathElements: []
    };
    
    // Check .vibegantt-dependency elements
    document.querySelectorAll('.vibegantt-dependency').forEach((el, index) => {
      results.vibeganttDependency.push({
        index,
        tagName: el.tagName,
        className: el.className,
        dependencyId: el.getAttribute('data-dependency-id'),
        hasPath: !!el.querySelector('path'),
        hasSelected: el.classList.contains('selected'),
        stroke: el.querySelector('path')?.getAttribute('stroke')
      });
    });
    
    // Check .vibegantt-dependency-group elements
    document.querySelectorAll('.vibegantt-dependency-group').forEach((el, index) => {
      results.vibeganttDependencyGroup.push({
        index,
        tagName: el.tagName,
        className: el.className,
        dependencyId: el.getAttribute('data-dependency-id'),
        hasPath: !!el.querySelector('path'),
        hasSelected: el.classList.contains('selected'),
        stroke: el.querySelector('path')?.getAttribute('stroke')
      });
    });
    
    // Check all [data-dependency-id] elements
    document.querySelectorAll('[data-dependency-id]').forEach((el, index) => {
      results.dataDependencyId.push({
        index,
        tagName: el.tagName,
        className: el.className,
        dependencyId: el.getAttribute('data-dependency-id'),
        hasPath: !!el.querySelector('path'),
        hasSelected: el.classList.contains('selected')
      });
    });
    
    // Check all path elements inside dependency elements
    document.querySelectorAll('[data-dependency-id] path').forEach((el, index) => {
      results.pathElements.push({
        index,
        stroke: el.getAttribute('stroke'),
        strokeWidth: el.getAttribute('stroke-width'),
        strokeOpacity: el.getAttribute('stroke-opacity'),
        parentClassName: el.parentElement?.className
      });
    });
    
    return results;
  });
  
  console.log('===== DOM ANALYSIS =====');
  console.log('vibegantt-dependency elements:', analysis.vibeganttDependency.length);
  console.log('vibegantt-dependency-group elements:', analysis.vibeganttDependencyGroup.length);
  console.log('data-dependency-id elements:', analysis.dataDependencyId.length);
  console.log('path elements:', analysis.pathElements.length);
  
  if (analysis.vibeganttDependency.length > 0) {
    console.log('Sample .vibegantt-dependency:', analysis.vibeganttDependency[0]);
  }
  
  if (analysis.vibeganttDependencyGroup.length > 0) {
    console.log('Sample .vibegantt-dependency-group:', analysis.vibeganttDependencyGroup[0]);
  }
  
  // Now test clicking and see what happens
  if (analysis.dataDependencyId.length > 0) {
    console.log('Testing dependency click...');
    
    // Click the first dependency
    await page.locator('[data-dependency-id]').first().click();
    await page.waitForTimeout(1000);
    
    // Check what changed
    const postClickAnalysis = await page.evaluate(() => {
      const results = [];
      
      document.querySelectorAll('[data-dependency-id]').forEach((el, index) => {
        results.push({
          index,
          tagName: el.tagName,
          className: el.className,
          dependencyId: el.getAttribute('data-dependency-id'),
          hasSelected: el.classList.contains('selected'),
          pathStroke: el.querySelector('path')?.getAttribute('stroke'),
          pathStrokeWidth: el.querySelector('path')?.getAttribute('stroke-width'),
          hasDeleteButton: !!el.querySelector('.delete-button'),
          hasConnectionHandles: el.querySelectorAll('.connection-handle').length,
          hasSelectionElements: !!el.querySelector('.dependency-selection-elements')
        });
      });
      
      return results;
    });
    
    console.log('===== POST-CLICK ANALYSIS =====');
    postClickAnalysis.forEach((item, index) => {
      if (item.hasSelected || item.hasDeleteButton || item.hasConnectionHandles > 0) {
        console.log(`SELECTED Element ${index}:`, item);
      }
    });
    
    // Take screenshot for visual confirmation
    await page.screenshot({ path: './screenshots/dependency-dom-analysis.png', fullPage: true });
  }
});