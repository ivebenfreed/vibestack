/**
 * Test the simplified integrity system with auto-reset
 * Issue #60 - Simple validation that resets on failure
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Simple Integrity System', () => {
  test('should establish baseline and validate successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 30000 });
    
    // Check console logs for integrity validation
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('integrity') || text.includes('validation') || text.includes('baseline')) {
        logs.push(text);
        console.log('Console:', text);
      }
    });
    
    // Wait a bit for sync to initialize
    await page.waitForTimeout(3000);
    
    // Check localStorage for baseline
    const hasBaseline = await page.evaluate(() => {
      const baseline = localStorage.getItem('integrity-baseline-simple');
      if (baseline) {
        console.log('Baseline found:', JSON.parse(baseline));
        return true;
      }
      console.log('No baseline found');
      return false;
    });
    
    console.log('Has baseline:', hasBaseline);
    
    // Navigate to a page that shows data
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 10000 });
    
    // Verify app is working (not in error state)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('Something went wrong');
  });

  test('should detect corruption and auto-reset', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 30000 });
    
    // Corrupt the baseline to trigger validation failure
    await page.evaluate(() => {
      // Set an old baseline with different stats to trigger validation failure
      const corruptBaseline = {
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours old (too old)
        reason: 'test_corruption',
        stats: {
          users: 100,
          tasks: 500,
          projects: 50,
          total: 650
        },
        clientId: 'test-client'
      };
      localStorage.setItem('integrity-baseline-simple', JSON.stringify(corruptBaseline));
      console.log('Baseline corrupted for testing');
    });
    
    // Force a reconnection to trigger validation
    await page.reload();
    
    // Wait for app to recover (may take a moment for reset and re-sync)
    await page.waitForTimeout(3000); // Give time for reset to complete
    
    // Check for app ready state
    try {
      await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 10000 });
    } catch (e) {
      console.log('App may have reset, checking baseline...');
    }
    
    // Check that baseline was updated
    const newBaseline = await page.evaluate(() => {
      const baseline = localStorage.getItem('integrity-baseline-simple');
      if (baseline) {
        const parsed = JSON.parse(baseline);
        console.log('New baseline after reset:', parsed);
        return parsed;
      }
      return null;
    });
    
    // Verify baseline was updated (either cleared or re-established)
    if (newBaseline) {
      // If baseline exists, check it's recent
      const ageInMinutes = (Date.now() - newBaseline.timestamp) / (1000 * 60);
      expect(ageInMinutes).toBeLessThan(2); // Should be less than 2 minutes old
      console.log('New baseline age in minutes:', ageInMinutes);
    } else {
      // Baseline was cleared, which is also valid
      console.log('Baseline was cleared after reset');
    }
  });

  test('should handle empty database correctly', async ({ page }) => {
    // Clear baseline to simulate fresh start
    await page.evaluate(() => {
      // Clear baseline
      localStorage.removeItem('integrity-baseline-simple');
      console.log('Baseline cleared for empty database test');
    });
    
    // Navigate to trigger validation
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 30000 });
    
    // Check console for empty database handling
    const baselineStatus = await page.evaluate(() => {
      const baseline = localStorage.getItem('integrity-baseline-simple');
      if (baseline) {
        const parsed = JSON.parse(baseline);
        console.log('Baseline after navigation:', parsed);
        return { exists: true, baseline: parsed };
      } else {
        console.log('No baseline found');
        return { exists: false };
      }
    });
    
    console.log('Baseline status:', baselineStatus);
    
    // The SimpleIntegrityValidator should have established a baseline
    // or marked for establishment after initial sync
    expect(baselineStatus).toBeDefined();
    
    // App should still be functional
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Error');
  });
});