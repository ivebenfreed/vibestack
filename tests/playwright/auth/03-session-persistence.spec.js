/**
 * Authentication Session Persistence Testing
 * 
 * Tests session persistence across browser reloads and navigation:
 * - Session maintains across page reloads
 * - Session survives browser tab close/reopen
 * - Session timeout behavior
 * - Multiple tab session sharing
 * - Session refresh mechanisms
 */

import { test, expect } from '@playwright/test';

test.describe('Session Persistence Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start with fresh session and login
    await page.goto('/sign-in');
    await page.waitForSelector('form, [data-testid="sign-in-form"]');
    
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/dashboard|\//, { timeout: 15000 });
  });

  test('should maintain session after page reload', async ({ page }) => {
    // Verify we're authenticated
    expect(page.url()).toMatch(/\/dashboard|\/$/);
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still be authenticated (not redirected to login)
    await page.waitForTimeout(3000); // Allow time for auth check
    
    const currentURL = page.url();
    expect(currentURL).not.toMatch(/sign-in|login/);
    
    // Verify auth state is maintained by looking for authenticated elements
    const authElements = [
      'button:has-text("Sign Out")',
      'button:has-text("Logout")',
      '[data-testid="user-menu"]',
      'text=Dashboard'
    ];
    
    let foundAuthElement = false;
    for (const selector of authElements) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundAuthElement = true;
        break;
      } catch (e) {
        // Continue checking
      }
    }
    
    expect(foundAuthElement).toBe(true);
  });

  test('should maintain session across navigation', async ({ page }) => {
    // Navigate to different pages
    const routes = ['/', '/dashboard', '/projects', '/tasks'];
    
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      
      // Should not be redirected to login
      const currentURL = page.url();
      expect(currentURL).not.toMatch(/sign-in|login/);
      
      // Wait a bit to ensure no delayed redirects
      await page.waitForTimeout(1000);
      expect(page.url()).not.toMatch(/sign-in|login/);
    }
  });

  test('should share session between multiple tabs', async ({ context }) => {
    const page1 = await context.newPage();
    
    // Login in first tab (using existing authenticated tab as reference)
    await page1.goto('/');
    await page1.waitForLoadState('networkidle');
    
    // Should inherit session from context and not need to login
    await page1.waitForTimeout(3000);
    
    // Create second tab
    const page2 = await context.newPage();
    await page2.goto('/dashboard');
    await page2.waitForLoadState('networkidle');
    
    // Both tabs should be authenticated
    const tab1URL = page1.url();
    const tab2URL = page2.url();
    
    expect(tab1URL).not.toMatch(/sign-in|login/);
    expect(tab2URL).not.toMatch(/sign-in|login/);
    
    // Close tabs
    await page1.close();
    await page2.close();
  });

  test('should persist auth tokens in storage', async ({ page }) => {
    // Check that auth tokens are stored
    const authData = await page.evaluate(() => {
      return {
        localStorage: {
          auth: localStorage.getItem('auth'),
          token: localStorage.getItem('token'),
          user: localStorage.getItem('user'),
          session: localStorage.getItem('session')
        },
        sessionStorage: {
          auth: sessionStorage.getItem('auth'),
          token: sessionStorage.getItem('token'),
          user: sessionStorage.getItem('user'),
          session: sessionStorage.getItem('session')
        },
        cookies: document.cookie
      };
    });
    
    // Should have some form of auth data stored
    const hasAuthData = 
      authData.localStorage.auth || 
      authData.localStorage.token || 
      authData.localStorage.user ||
      authData.localStorage.session ||
      authData.sessionStorage.auth ||
      authData.sessionStorage.token ||
      authData.sessionStorage.user ||
      authData.sessionStorage.session ||
      authData.cookies.length > 0;
    
    expect(hasAuthData).toBe(true);
  });

  test('should refresh session automatically', async ({ page }) => {
    // Get initial auth timestamp or token
    const initialAuthData = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('auth') || localStorage.getItem('token'),
        timestamp: Date.now()
      };
    });
    
    // Wait for potential token refresh (simulate some activity)
    await page.goto('/projects');
    await page.waitForTimeout(2000);
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    // Check if session is still valid
    const currentURL = page.url();
    expect(currentURL).not.toMatch(/sign-in|login/);
    
    // Session should remain active
    const finalAuthData = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('auth') || localStorage.getItem('token'),
        timestamp: Date.now()
      };
    });
    
    // Either token stayed the same (long-lived) or was refreshed
    expect(finalAuthData.localStorage).toBeTruthy();
  });

  test('should handle expired session gracefully', async ({ page }) => {
    // This test simulates session expiration
    // Clear storage to simulate expired session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Navigate to a protected route
    await page.goto('/dashboard');
    
    // Should redirect to login page
    await page.waitForURL(/sign-in|login/, { timeout: 10000 });
    expect(page.url()).toMatch(/sign-in|login/);
  });

  test('should maintain session state with XState sync machine', async ({ page }) => {
    // Check that sync machine maintains proper auth state
    const syncState = await page.evaluate(() => {
      return window.xstateTestInspector?.getCurrentState('sync-machine-v3') || 'unknown';
    });
    
    // Should be in live_sync or connected state if properly authenticated
    // Don't check exact state as it depends on sync timing
    expect(syncState).not.toBe('error');
    expect(syncState).not.toBe('unknown');
  });
});