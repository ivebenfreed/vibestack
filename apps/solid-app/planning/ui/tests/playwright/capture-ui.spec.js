import { test, expect } from '@playwright/test';

test.describe('Capture UI Pages', () => {
  test('capture authentication pages', async ({ page }) => {
    // Sign in page
    await page.goto('/auth/signin');
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('signin-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/auth-signin.png', fullPage: true });
    
    // Sign up page
    await page.goto('/auth/signup');
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('signup-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/auth-signup.png', fullPage: true });
    
    // Forgot password page
    await page.goto('/auth/forgot-password');
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('forgot-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/auth-forgot.png', fullPage: true });
  });
  
  test('capture main app pages directly', async ({ page }) => {
    // Navigate directly to dashboard (bypassing auth)
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    
    // Check if AppShell is present
    const hasAppShell = await page.getByTestId('app-shell').count() > 0;
    if (hasAppShell) {
      await page.screenshot({ path: 'tests/screenshots/app-dashboard.png', fullPage: true });
    }
    
    // Entities page
    await page.goto('/entities');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/app-entities.png', fullPage: true });
    
    // Organization page
    await page.goto('/org');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/app-organization.png', fullPage: true });
    
    // Analytics page
    await page.goto('/analytics');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/app-analytics.png', fullPage: true });
    
    // Settings page
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/app-settings.png', fullPage: true });
  });
  
  test('capture mobile views', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile signin
    await page.goto('/auth/signin');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/mobile-signin.png', fullPage: true });
    
    // Mobile dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/mobile-dashboard.png', fullPage: true });
  });
});