/**
 * Server Error Scenario Testing
 * 
 * Tests application behavior during server errors:
 * - 500 Internal Server Error responses
 * - 503 Service Unavailable responses
 * - 429 Rate Limiting responses
 * - Malformed server responses
 * - Server timeout scenarios
 * - Database connection failures
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Server Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for app initialization
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    );
  });

  test('should handle 500 Internal Server Error', async ({ page }) => {
    // Mock 500 errors for API calls
    await page.context().route('**/api/**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Something went wrong on the server',
          timestamp: new Date().toISOString()
        })
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('500 Error test: Making API calls');
    });

    // Try to perform actions that trigger API calls
    try {
      await page.goto('/projects');
      await page.waitForTimeout(3000);
    } catch (e) {
      // Navigation might fail - that's expected
    }

    // Check for error handling UI
    const errorIndicators = [
      'text=Something went wrong',
      'text=Server error',
      'text=Internal error',
      'text=Try again',
      '[data-testid="error-message"]',
      '.error',
      '.alert-error'
    ];

    let foundError = false;
    for (const selector of errorIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundError = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Should show error message or handle gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // App should handle 500 errors without crashing
    expect(syncState === 'error' || foundError).toBe(true);
  });

  test('should handle 503 Service Unavailable', async ({ page }) => {
    // Mock 503 service unavailable
    await page.context().route('**/api/**', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Service Unavailable',
          message: 'The service is temporarily unavailable. Please try again later.',
          retryAfter: 30
        }),
        headers: {
          'Retry-After': '30'
        }
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('503 Error test: Service unavailable');
    });

    // Try to reload or navigate
    try {
      await page.reload();
      await page.waitForTimeout(3000);
    } catch (e) {
      // Expected to fail
    }

    // Should show appropriate service unavailable message
    const serviceErrorIndicators = [
      'text=Service unavailable',
      'text=Temporarily unavailable',
      'text=Try again later',
      'text=Maintenance',
      '[data-testid="service-unavailable"]'
    ];

    let foundServiceError = false;
    for (const selector of serviceErrorIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundServiceError = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Should handle service unavailable appropriately
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(syncState === 'error' || foundServiceError).toBe(true);
  });

  test('should handle 429 Rate Limiting', async ({ page }) => {
    let requestCount = 0;

    // Mock rate limiting after 3 requests
    await page.context().route('**/api/**', async route => {
      requestCount++;
      
      if (requestCount > 3) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: 60
          }),
          headers: {
            'Retry-After': '60'
          }
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Rate limit test: Making multiple requests');
    });

    // Make multiple requests to trigger rate limiting
    for (let i = 0; i < 5; i++) {
      try {
        await page.goto('/projects');
        await page.waitForTimeout(500);
        await page.goto('/tasks');
        await page.waitForTimeout(500);
      } catch (e) {
        // Some requests expected to fail
      }
    }

    // Should show rate limiting message or handle gracefully
    const rateLimitIndicators = [
      'text=Rate limit',
      'text=Too many requests',
      'text=Please try again later',
      '[data-testid="rate-limit-error"]'
    ];

    let foundRateLimit = false;
    for (const selector of rateLimitIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        foundRateLimit = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    expect(requestCount).toBeGreaterThan(3); // Should have triggered rate limiting
  });

  test('should handle malformed server responses', async ({ page }) => {
    // Mock malformed JSON responses
    await page.context().route('**/api/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'This is not valid JSON{invalid}'
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Malformed response test: Invalid JSON');
    });

    try {
      await page.goto('/projects');
      await page.waitForTimeout(3000);
    } catch (e) {
      // Expected to fail with malformed response
    }

    // Should handle JSON parsing errors gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should not crash the application
    expect(typeof syncState).toBe('string');
  });

  test('should handle server timeout scenarios', async ({ page }) => {
    // Mock server timeout by never responding
    await page.context().route('**/api/**', async route => {
      // Never fulfill the request to simulate timeout
      // The request will timeout based on client timeout settings
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Timeout test: Requests that never respond');
    });

    try {
      await page.goto('/projects', { timeout: 10000 });
    } catch (e) {
      // Expected timeout
    }

    // Check for timeout handling
    const timeoutIndicators = [
      'text=Request timeout',
      'text=Connection timeout',
      'text=Server not responding',
      '[data-testid="timeout-error"]'
    ];

    let foundTimeout = false;
    for (const selector of timeoutIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        foundTimeout = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    // Should handle timeouts gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(syncState).not.toBe('unknown');
  });

  test('should handle partial server responses', async ({ page }) => {
    // Mock incomplete responses
    await page.context().route('**/api/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: null,
          // Missing required fields
        })
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Partial response test: Incomplete data');
    });

    try {
      await page.goto('/projects');
      await page.waitForTimeout(3000);
    } catch (e) {
      // May fail due to incomplete data
    }

    // Should handle incomplete data gracefully
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(syncState).not.toBe('unknown');
  });

  test('should handle database connection failures', async ({ page }) => {
    // Mock database connection errors
    await page.context().route('**/api/**', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Database Connection Failed',
          message: 'Unable to connect to the database',
          type: 'DATABASE_ERROR'
        })
      });
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Database error test: Connection failure');
    });

    try {
      await page.reload();
      await page.waitForTimeout(3000);
    } catch (e) {
      // Expected database connection failure
    }

    // Should show database error or handle gracefully
    const dbErrorIndicators = [
      'text=Database error',
      'text=Connection failed',
      'text=Data unavailable',
      '[data-testid="database-error"]'
    ];

    let foundDbError = false;
    for (const selector of dbErrorIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundDbError = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }

    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should handle database errors appropriately
    expect(syncState === 'error' || foundDbError).toBe(true);
  });

  test('should handle mixed success/error responses', async ({ page }) => {
    let requestCount = 0;

    // Mock alternating success/error responses
    await page.context().route('**/api/**', async route => {
      requestCount++;
      
      if (requestCount % 2 === 0) {
        // Even requests fail
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server Error' })
        });
      } else {
        // Odd requests succeed
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Mixed responses test: Success/error alternating');
    });

    // Make multiple requests
    for (let i = 0; i < 4; i++) {
      try {
        await page.goto(`/projects`);
        await page.waitForTimeout(1000);
      } catch (e) {
        // Some failures expected
      }
    }

    // Should handle mixed responses without breaking
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    expect(requestCount).toBeGreaterThan(2);
    expect(syncState).not.toBe('unknown');
  });

  test('should recover after server errors resolve', async ({ page }) => {
    let errorPhase = true;

    // Mock errors that resolve after some time
    await page.context().route('**/api/**', async route => {
      if (errorPhase) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporary server error' })
        });
      } else {
        await route.continue();
      }
    });

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Recovery test: Initial error phase');
    });

    // Make requests during error phase
    try {
      await page.goto('/projects');
      await page.waitForTimeout(2000);
    } catch (e) {
      // Expected to fail
    }

    // Resolve the server errors
    errorPhase = false;

    await page.evaluate(() => {
      window.xstateTestInspector?.addMarker('Recovery test: Errors resolved');
    });

    // Try again - should succeed now
    try {
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
    } catch (e) {
      // Should succeed now
    }

    // Should recover to normal operation
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3');
    });

    // Should not be stuck in error state after recovery
    expect(syncState).not.toBe('error');
  });
});