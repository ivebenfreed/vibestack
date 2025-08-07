/**
 * Proper dependency testing with best practices
 */

import { test, expect } from '../fixtures/persistent-context.js';

// Page Object Model for VibeGantt
class VibeGanttPage {
  constructor(page) {
    this.page = page;
    this.container = page.locator('.vibegantt');
    this.dependencies = page.locator('.vibegantt-dependency-group');
    this.deleteButtons = page.locator('.delete-button');
  }

  async navigate() {
    await this.page.goto('/debug/vibegantt');
  }

  async waitForLoad() {
    // Wait for container
    await this.container.waitFor({ state: 'visible' });
    
    // Wait for tasks to render
    await this.page.waitForSelector('.vibegantt-task', { state: 'visible' });
    
    // Wait for initial render to complete
    await this.page.waitForFunction(() => {
      const tasks = document.querySelectorAll('.vibegantt-task');
      const deps = document.querySelectorAll('.vibegantt-dependency-group');
      return tasks.length > 0 && deps.length > 0;
    }, null, { timeout: 10000 });
    
    // Wait for any animations
    await this.page.waitForTimeout(500);
  }

  async getDependencyCount() {
    return await this.dependencies.count();
  }

  async selectDependencyByIndex(index = 0) {
    const dep = this.dependencies.nth(index);
    
    // Get the clickable path element within the group
    const path = dep.locator('.vibegantt-dependency').first();
    
    // Use bounding box for reliable SVG clicking
    const box = await path.boundingBox();
    if (!box) throw new Error('Could not get dependency bounding box');
    
    console.log(`Clicking dependency at: ${box.x + box.width/2}, ${box.y + box.height/2}`);
    await this.page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    
    // Wait for selection state change
    await this.page.waitForFunction((index) => {
      const groups = document.querySelectorAll('.vibegantt-dependency-group');
      return groups[index]?.classList.contains('selected');
    }, index, { timeout: 2000 });
  }

  async isDeleteButtonVisible() {
    const count = await this.deleteButtons.count();
    return count > 0;
  }

  async clickDeleteButton() {
    // Wait for delete button to be visible
    await this.deleteButtons.first().waitFor({ state: 'visible', timeout: 2000 });
    
    // Get the circle element inside the delete button for precise clicking
    const deleteCircle = this.deleteButtons.first().locator('circle').first();
    const box = await deleteCircle.boundingBox();
    
    if (!box) throw new Error('Could not get delete button bounding box');
    
    console.log(`Clicking delete button at: ${box.x + box.width/2}, ${box.y + box.height/2}`);
    await this.page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  }

  async captureTestEvents() {
    return await this.page.evaluate(() => window.testEvents || []);
  }
}

// Test helper to capture console events
async function setupEventCapture(page) {
  // Initialize event capture on the page
  await page.evaluate(() => {
    window.testEvents = [];
    
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      window.testEvents.push({
        type: 'console.log',
        message,
        timestamp: Date.now()
      });
      originalLog.apply(console, args);
    };
  });
  
  // Also capture console from page context
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log(`[Browser Console] ${msg.text()}`);
    }
  });
}

test.describe('Dependency Selection and Deletion - Proper', () => {
  let ganttPage;

  test.beforeEach(async ({ page }) => {
    ganttPage = new VibeGanttPage(page);
    await ganttPage.navigate();
    await setupEventCapture(page);
    await ganttPage.waitForLoad();
  });

  test('select and delete single dependency', async ({ page }) => {
    // Get initial count
    const initialCount = await ganttPage.getDependencyCount();
    console.log(`Initial dependency count: ${initialCount}`);
    
    if (initialCount === 0) {
      test.skip('No dependencies to test');
      return;
    }

    // Select first dependency
    await ganttPage.selectDependencyByIndex(0);
    
    // Verify delete button appears
    await expect(async () => {
      const isVisible = await ganttPage.isDeleteButtonVisible();
      expect(isVisible).toBe(true);
    }).toPass({ timeout: 3000 });

    // Take screenshot of selected state
    await page.screenshot({ 
      path: './screenshots/issue-53/proper-test-selected.png',
      fullPage: true 
    });

    // Click delete button
    await ganttPage.clickDeleteButton();
    
    // Wait for dependency count to decrease
    await expect(async () => {
      const newCount = await ganttPage.getDependencyCount();
      expect(newCount).toBe(initialCount - 1);
    }).toPass({ 
      intervals: [100, 200, 500],
      timeout: 5000 
    });

    // Verify events were logged
    const events = await ganttPage.captureTestEvents();
    const deleteEvents = events.filter(e => 
      e.message.includes('Delete button clicked') || 
      e.message.includes('DEPENDENCY_DELETE')
    );
    
    expect(deleteEvents.length).toBeGreaterThan(0);
    console.log('Delete events captured:', deleteEvents);

    // Take final screenshot
    await page.screenshot({ 
      path: './screenshots/issue-53/proper-test-deleted.png',
      fullPage: true 
    });
  });

  test('keyboard delete on selected dependency', async ({ page }) => {
    const initialCount = await ganttPage.getDependencyCount();
    if (initialCount === 0) {
      test.skip('No dependencies to test');
      return;
    }

    // Select dependency
    await ganttPage.selectDependencyByIndex(0);
    
    // Focus the container
    await ganttPage.container.focus();
    
    // Press Delete key
    await page.keyboard.press('Delete');
    
    // Wait for deletion
    await expect(async () => {
      const newCount = await ganttPage.getDependencyCount();
      expect(newCount).toBe(initialCount - 1);
    }).toPass({ timeout: 5000 });

    // Check events
    const events = await ganttPage.captureTestEvents();
    const keyboardEvents = events.filter(e => 
      e.message.includes('Delete key pressed') || 
      e.message.includes('KEYBOARD_SHORTCUT')
    );
    
    expect(keyboardEvents.length).toBeGreaterThan(0);
  });
});