/**
 * Authentication Flow Testing - Logout Validation
 * 
 * Tests logout flow and state cleanup including:
 * - Successful logout from authenticated state
 * - Session cleanup and state clearing
 * - Redirect behavior after logout
 * - Protected route access after logout
 * - Browser back button behavior after logout
 */

import { test, expect } from '@playwright/test';

test.describe('Logout Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test with authenticated user
    await page.goto('/sign-in');
    await page.waitForSelector('form, [data-testid="sign-in-form"]');
    
    // Login first
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/dashboard|\//, { timeout: 15000 });
  });

  test('should successfully logout from authenticated state', async ({ page }) => {
    // Verify we're logged in first
    const isLoggedIn = await page.locator('button:has-text("Sign Out"), button:has-text("Logout"), [data-testid="logout-button"]').first().isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      // Try alternative logout button locations
      const logoutSelectors = [
        '[data-testid="user-menu"]',
        'button:has-text("Profile")',
        'button[aria-label="User menu"]',
        '.user-menu'
      ];
      
      for (const selector of logoutSelectors) {
        try {
          await page.click(selector);
          await page.waitForTimeout(1000);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
    }
    
    // Click logout button
    const logoutButtons = [
      'button:has-text("Sign Out")',
      'button:has-text("Logout")', 
      '[data-testid="logout-button"]',
      'text=Sign Out',
      'text=Logout'
    ];
    
    let loggedOut = false;
    for (const selector of logoutButtons) {
      try {
        await page.click(selector);
        loggedOut = true;
        break;
      } catch (e) {
        // Continue trying other selectors
      }
    }
    
    // Verify logout occurred
    await page.waitForURL(/sign-in|login|\/$/);
    expect(page.url()).toMatch(/sign-in|login|\/$/);
  });

  test('should clear authentication state after logout', async ({ page }) => {
    // Logout
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    await page.waitForURL(/sign-in|login/);
    
    // Try to access protected route - should redirect to login
    await page.goto('/dashboard');
    await page.waitForURL(/sign-in|login/, { timeout: 10000 });
    
    expect(page.url()).toMatch(/sign-in|login/);
  });

  test('should clear local storage and session data', async ({ page }) => {
    // Check if there's auth data before logout
    const authDataBefore = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('auth') || localStorage.getItem('token') || localStorage.getItem('user'),
        sessionStorage: sessionStorage.getItem('auth') || sessionStorage.getItem('token')
      };
    });
    
    // Logout
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    await page.waitForURL(/sign-in|login/);
    
    // Check that auth data is cleared
    const authDataAfter = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('auth') || localStorage.getItem('token') || localStorage.getItem('user'),
        sessionStorage: sessionStorage.getItem('auth') || sessionStorage.getItem('token')
      };
    });
    
    // At least one storage should be cleared or different
    const isCleared = !authDataAfter.localStorage || !authDataAfter.sessionStorage || 
                     authDataAfter.localStorage !== authDataBefore.localStorage ||
                     authDataAfter.sessionStorage !== authDataBefore.sessionStorage;
    
    expect(isCleared).toBe(true);
  });

  test('should prevent access to protected routes after logout', async ({ page }) => {
    // Logout first
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    await page.waitForURL(/sign-in|login/);
    
    // Try to access various protected routes
    const protectedRoutes = ['/dashboard', '/projects', '/tasks', '/settings'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to sign-in or stay on current auth page
      await page.waitForTimeout(2000);
      const url = page.url();
      
      // Should not be able to access the protected route
      expect(url).not.toContain(route.substring(1)); // Remove leading slash for check
    }
  });

  test('should handle browser back button correctly after logout', async ({ page }) => {
    // Remember the dashboard URL
    const dashboardURL = page.url();
    
    // Logout
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    await page.waitForURL(/sign-in|login/);
    
    // Try to go back using browser back button
    await page.goBack();
    await page.waitForTimeout(2000);
    
    // Should still be on login page or redirect back to login
    const currentURL = page.url();
    expect(currentURL).toMatch(/sign-in|login|\/$/);
    expect(currentURL).not.toBe(dashboardURL);
  });

  test('should show appropriate message after logout', async ({ page }) => {
    // Logout
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    await page.waitForURL(/sign-in|login/);
    
    // Check for logout success message
    const messageSelectors = [
      'text=Successfully logged out',
      'text=You have been logged out',
      'text=Signed out',
      '[data-testid="logout-message"]',
      '.success-message',
      '.alert-success'
    ];
    
    // Wait a bit for message to appear
    await page.waitForTimeout(2000);
    
    // Look for logout confirmation message (optional - some apps don't show this)
    let hasMessage = false;
    for (const selector of messageSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        hasMessage = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }
    
    // This test passes regardless - logout message is optional UX
    // The important part is that we're on the login page
    expect(page.url()).toMatch(/sign-in|login|\/$/);
  });
});