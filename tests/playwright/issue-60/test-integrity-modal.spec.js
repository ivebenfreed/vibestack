import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Integrity Modal Testing', () => {
  test('should trigger integrity validation and display modal on failure', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for authentication and system readiness
    await page.waitForSelector('[data-testid="authenticated-content"]', { timeout: 30000 });
    
    console.log('✅ App loaded and authenticated');

    // Listen for integrity validation events
    const integrityEvent = page.waitForEvent('console', msg => 
      msg.text().includes('integrity validation')
    );

    // Trigger integrity validation by dispatching a custom event
    // This simulates an integrity failure scenario
    await page.evaluate(() => {
      const mockIntegrityResult = {
        isValid: false,
        issues: [
          {
            type: 'data_mismatch',
            severity: 'critical',
            table: 'users',
            message: 'Record count mismatch detected',
            details: {
              expected: 46,
              actual: 45,
              missingRecords: ['user-123']
            }
          },
          {
            type: 'hash_mismatch', 
            severity: 'warning',
            table: 'tasks',
            message: 'Data hash validation failed',
            details: {
              expectedHash: 'abc123',
              actualHash: 'def456'
            }
          }
        ],
        recommendedAction: 'reset',
        validationType: 'test_simulation'
      };

      // Dispatch the integrity validation event
      window.dispatchEvent(new CustomEvent('integrity-validation-completed', {
        detail: mockIntegrityResult
      }));
    });

    console.log('✅ Triggered mock integrity validation failure');

    // Wait for the integrity modal to appear
    await page.waitForSelector('[data-testid="integrity-failure-modal"]', { 
      timeout: 5000,
      state: 'visible' 
    });

    console.log('✅ Integrity failure modal appeared');

    // Verify modal content
    await expect(page.locator('[data-testid="integrity-failure-modal"]')).toBeVisible();
    await expect(page.getByText('Data Integrity Issues Detected')).toBeVisible();
    await expect(page.getByText('2 issue')).toBeVisible(); // Should show "2 issues"
    await expect(page.getByText('A full database reset is recommended')).toBeVisible();

    // Check that issues are displayed correctly
    await expect(page.getByText('Users')).toBeVisible(); // Table group
    await expect(page.getByText('Record count mismatch detected')).toBeVisible();
    await expect(page.getByText('Tasks')).toBeVisible(); // Table group  
    await expect(page.getByText('Data hash validation failed')).toBeVisible();

    // Verify severity indicators
    await expect(page.locator('.text-red-600')).toBeVisible(); // Critical severity
    await expect(page.locator('.text-yellow-600')).toBeVisible(); // Warning severity

    // Test expandable details
    await page.click('summary:has-text("View details")');
    await expect(page.getByText('"expected": 46')).toBeVisible();

    console.log('✅ Modal content verified');

    // Test modal actions
    
    // Verify both buttons are present
    await expect(page.getByText('Continue Without Reset')).toBeVisible();
    await expect(page.getByText('Reset Database')).toBeVisible();

    // Test "Continue Without Reset" button
    await page.click('button:has-text("Continue Without Reset")');
    
    // Modal should close
    await page.waitForSelector('[data-testid="integrity-failure-modal"]', { 
      state: 'hidden',
      timeout: 5000 
    });

    console.log('✅ Continue Without Reset works - modal closed');

    // Trigger another integrity failure to test reset button
    await page.evaluate(() => {
      const mockIntegrityResult = {
        isValid: false,
        issues: [
          {
            type: 'critical_failure',
            severity: 'critical',
            message: 'Database corruption detected'
          }
        ],
        recommendedAction: 'reset',
        validationType: 'test_simulation_reset'
      };

      window.dispatchEvent(new CustomEvent('integrity-validation-completed', {
        detail: mockIntegrityResult
      }));
    });

    // Wait for modal to reappear
    await page.waitForSelector('[data-testid="integrity-failure-modal"]', { 
      timeout: 5000,
      state: 'visible' 
    });

    // Mock the reset functionality to avoid actual database reset
    await page.evaluate(() => {
      // Override the global services to mock reset success
      window.globalServicesV3 = {
        integrity: {
          performReset: async () => {
            console.log('Mock integrity reset called');
            return { success: true };
          }
        }
      };
    });

    // Click reset button
    await page.click('button:has-text("Reset Database")');

    // Should show "Resetting..." state
    await expect(page.getByText('Resetting...')).toBeVisible();

    // Wait for success state (modal should close)
    await page.waitForSelector('[data-testid="integrity-failure-modal"]', { 
      state: 'hidden',
      timeout: 10000 
    });

    console.log('✅ Reset Database works - modal closed after reset');

    console.log('🎉 All integrity modal tests passed!');
  });

  test('should show toast notifications for non-reset integrity warnings', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    await page.waitForSelector('[data-testid="authenticated-content"]', { timeout: 30000 });

    // Trigger a non-reset integrity warning
    await page.evaluate(() => {
      const mockIntegrityResult = {
        isValid: false,
        issues: [
          {
            type: 'minor_sync_issue',
            severity: 'warning',
            message: 'Some records may be out of sync'
          }
        ],
        recommendedAction: 'retry', // Not 'reset', so should show toast
        validationType: 'test_toast_notification'
      };

      window.dispatchEvent(new CustomEvent('integrity-validation-completed', {
        detail: mockIntegrityResult
      }));
    });

    // Should show toast notification, not modal
    await expect(page.locator('[data-sonner-toaster]')).toBeVisible();
    await expect(page.getByText('Data Integrity Warning')).toBeVisible();
    await expect(page.getByText('1 integrity issue(s) detected')).toBeVisible();
    await expect(page.getByText('Recommended action: retry')).toBeVisible();

    // Modal should NOT appear
    await expect(page.locator('[data-testid="integrity-failure-modal"]')).not.toBeVisible();

    console.log('✅ Toast notification works for non-reset warnings');
  });
});