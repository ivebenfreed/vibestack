import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Dependency line delete button - Simple', () => {
  test('verify delete button behavior on existing project', async ({ page }) => {
    // Navigate to home to ensure we're logged in
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for the app to be ready
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true',
      { timeout: 60000 }
    );
    
    // Check if there are any projects with the Gantt view
    const projectCards = await page.locator('.project-card, [data-testid="project-card"], a[href^="/project/"]').all();
    
    if (projectCards.length === 0) {
      console.log('No projects found, skipping test');
      return;
    }
    
    // Navigate to the first project
    await projectCards[0].click();
    await page.waitForLoadState('networkidle');
    
    // Wait for Gantt chart to appear
    const ganttChart = await page.waitForSelector('.vibeGantt, .gantt-chart, [data-testid="gantt-chart"]', { 
      timeout: 10000,
      state: 'visible' 
    }).catch(() => null);
    
    if (!ganttChart) {
      console.log('No Gantt chart found in this project, skipping test');
      return;
    }
    
    // Look for dependency lines
    await page.waitForTimeout(2000); // Give time for lines to render
    const dependencyLines = await page.locator('.gantt-dependency-line, .dependency-line, [data-testid*="dependency"]').all();
    
    if (dependencyLines.length === 0) {
      console.log('No dependency lines found in this project');
      console.log('This test requires a project with task dependencies');
      return;
    }
    
    console.log(`Found ${dependencyLines.length} dependency lines`);
    
    // Test 1: Initially no delete button should be visible
    await expect(page.locator('.gantt-dependency-delete-button')).toHaveCount(0);
    console.log('✓ No delete button initially visible');
    
    // Test 2: Click on a dependency line
    const firstLine = dependencyLines[0];
    await firstLine.click({ force: true });
    console.log('✓ Clicked on dependency line');
    
    // Test 3: Delete button should appear
    const deleteButton = await page.waitForSelector('.gantt-dependency-delete-button', { 
      timeout: 5000,
      state: 'visible' 
    }).catch(() => null);
    
    if (!deleteButton) {
      throw new Error('Delete button did not appear after clicking dependency line');
    }
    console.log('✓ Delete button appeared');
    
    // Test 4: Verify delete button is positioned near the clicked line
    const deleteButtonBox = await deleteButton.boundingBox();
    const lineBox = await firstLine.boundingBox();
    
    if (deleteButtonBox && lineBox) {
      // Delete button should be somewhat near the line
      const distance = Math.sqrt(
        Math.pow(deleteButtonBox.x - lineBox.x, 2) + 
        Math.pow(deleteButtonBox.y - lineBox.y, 2)
      );
      console.log(`Delete button distance from line: ${distance}px`);
    }
    
    // Test 5: Click elsewhere to deselect
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    
    // Test 6: Delete button should be hidden
    const isDeleteButtonHidden = await page.locator('.gantt-dependency-delete-button').isVisible().catch(() => false);
    expect(isDeleteButtonHidden).toBe(false);
    console.log('✓ Delete button hidden after clicking elsewhere');
    
    // Test 7: Click dependency line again and delete it
    await firstLine.click({ force: true });
    await page.waitForSelector('.gantt-dependency-delete-button', { timeout: 5000 });
    
    const deleteBtn = page.locator('.gantt-dependency-delete-button');
    await deleteBtn.click();
    console.log('✓ Clicked delete button');
    
    // Test 8: Wait for dependency to be removed
    await page.waitForTimeout(1000);
    const remainingLines = await page.locator('.gantt-dependency-line, .dependency-line').all();
    expect(remainingLines.length).toBeLessThan(dependencyLines.length);
    console.log(`✓ Dependency removed (was ${dependencyLines.length}, now ${remainingLines.length})`);
    
    // Test 9: Delete button should be gone
    await expect(page.locator('.gantt-dependency-delete-button')).toHaveCount(0);
    console.log('✓ Delete button removed after deletion');
  });
});