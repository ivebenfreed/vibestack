import { test, expect } from '@playwright/test';

test.describe('UI Screenshots', () => {
  test('capture all main pages', async ({ page }) => {
    // Sign in page
    await page.goto('/auth/signin');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('signin-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/01-signin.png', fullPage: true });
    
    // Sign up page
    await page.goto('/auth/signup');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('signup-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/02-signup.png', fullPage: true });
    
    // Forgot password page
    await page.goto('/auth/forgot-password');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('forgot-title')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/03-forgot-password.png', fullPage: true });
    
    // Mock sign in to access protected pages
    await page.goto('/auth/signin');
    await page.getByTestId('signin-email').fill('test@vibestack.com');
    await page.getByTestId('signin-password').fill('Test123!@#');
    await page.getByTestId('signin-submit').click();
    await page.waitForURL('**/dashboard');
    
    // Dashboard
    await page.waitForTimeout(500);
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/04-dashboard.png', fullPage: true });
    
    // Entities
    await page.goto('/entities');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/05-entities.png', fullPage: true });
    
    // Organization
    await page.goto('/org');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/06-organization.png', fullPage: true });
    
    // Analytics
    await page.goto('/analytics');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/07-analytics.png', fullPage: true });
    
    // Settings
    await page.goto('/settings');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/08-settings.png', fullPage: true });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/09-mobile-dashboard.png', fullPage: true });
    
    // Open mobile menu
    await page.getByTestId('header-menu-button').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/10-mobile-menu.png', fullPage: true });
  });
  
  test('test sidebar interactions', async ({ page }) => {
    // Sign in first
    await page.goto('/auth/signin');
    await page.getByTestId('signin-email').fill('test@vibestack.com');
    await page.getByTestId('signin-password').fill('Test123!@#');
    await page.getByTestId('signin-submit').click();
    await page.waitForURL('**/dashboard');
    
    // Test sidebar collapse
    const sidebar = page.getByTestId('app-sidebar');
    const toggleBtn = page.getByTestId('sidebar-toggle');
    
    // Collapse sidebar
    await toggleBtn.click();
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await page.screenshot({ path: 'tests/screenshots/11-sidebar-collapsed.png', fullPage: true });
    
    // Expand sidebar
    await toggleBtn.click();
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    
    // Test header dropdowns
    await page.getByTestId('notifications-button').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/12-notifications.png' });
    
    await page.getByTestId('user-menu').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/13-user-menu.png' });
  });
  
  test('test form interactions', async ({ page }) => {
    // Test signup form validation
    await page.goto('/auth/signup');
    await page.getByTestId('signup-submit').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/14-signup-validation.png', fullPage: true });
    
    // Fill signup form
    await page.getByTestId('signup-firstname').fill('John');
    await page.getByTestId('signup-lastname').fill('Doe');
    await page.getByTestId('signup-email').fill('john@example.com');
    await page.getByTestId('signup-organization').fill('Acme Corp');
    await page.getByTestId('signup-password').fill('SecurePass123!');
    await page.getByTestId('signup-confirm-password').fill('SecurePass123!');
    await page.getByTestId('signup-terms').check();
    await page.screenshot({ path: 'tests/screenshots/15-signup-filled.png', fullPage: true });
    
    // Test forgot password flow
    await page.goto('/auth/forgot-password');
    await page.getByTestId('forgot-email').fill('john@example.com');
    await page.getByTestId('forgot-submit').click();
    await page.waitForTimeout(1600);
    await expect(page.getByTestId('forgot-success')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/16-forgot-success.png', fullPage: true });
  });
});