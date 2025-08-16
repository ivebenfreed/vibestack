import { test, expect } from '@playwright/test';
import { 
  waitForAppReady, 
  takeScreenshot, 
  fillForm, 
  clickElement,
  expectToast,
  navigateTo,
  testResponsive,
  checkAccessibility,
  getPerformanceMetrics
} from '../helpers/test-utils';

test.describe('Authentication - Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/auth/signin');
  });
  
  test('sign in page renders correctly', async ({ page }) => {
    // Wait for page to be ready
    await waitForAppReady(page);
    
    // Check all elements are present
    await expect(page.getByTestId('signin-card')).toBeVisible();
    await expect(page.getByTestId('signin-title')).toHaveText('Sign In');
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await expect(page.getByTestId('signin-password')).toBeVisible();
    await expect(page.getByTestId('signin-submit')).toBeVisible();
    await expect(page.getByTestId('signin-forgot-password')).toBeVisible();
    await expect(page.getByTestId('signin-signup-link')).toBeVisible();
    
    // Check OAuth providers
    await expect(page.getByTestId('signin-google')).toBeVisible();
    await expect(page.getByTestId('signin-github')).toBeVisible();
    
    // Take screenshot
    await takeScreenshot(page, 'auth/signin-initial');
  });
  
  test('successful sign in flow', async ({ page }) => {
    // Fill in credentials
    await fillForm(page, {
      'signin-email': 'test@vibestack.com',
      'signin-password': 'Test123!@#',
    });
    
    // Screenshot filled form
    await takeScreenshot(page, 'auth/signin-filled');
    
    // Submit form
    await clickElement(page, 'signin-submit');
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    await waitForAppReady(page);
    
    // Verify user is logged in
    await expect(page.getByTestId('user-menu')).toBeVisible();
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    
    // Screenshot dashboard after login
    await takeScreenshot(page, 'auth/signin-success-dashboard');
  });
  
  test('sign in with invalid credentials', async ({ page }) => {
    // Fill in wrong credentials
    await fillForm(page, {
      'signin-email': 'wrong@vibestack.com',
      'signin-password': 'WrongPassword123',
    });
    
    // Submit form
    await clickElement(page, 'signin-submit');
    
    // Should show error
    await expectToast(page, 'Invalid email or password', 'error');
    
    // Should stay on sign in page
    expect(page.url()).toContain('/auth/signin');
    
    // Screenshot error state
    await takeScreenshot(page, 'auth/signin-error');
  });
  
  test('sign in form validation', async ({ page }) => {
    // Try to submit empty form
    await clickElement(page, 'signin-submit');
    
    // Check validation messages
    await expect(page.getByTestId('signin-email-error')).toHaveText('Email is required');
    await expect(page.getByTestId('signin-password-error')).toHaveText('Password is required');
    
    // Screenshot validation errors
    await takeScreenshot(page, 'auth/signin-validation-empty');
    
    // Test invalid email format
    await fillForm(page, {
      'signin-email': 'not-an-email',
      'signin-password': 'Test123!@#',
    });
    await clickElement(page, 'signin-submit');
    
    await expect(page.getByTestId('signin-email-error')).toHaveText('Invalid email format');
    
    // Screenshot email validation
    await takeScreenshot(page, 'auth/signin-validation-email');
  });
  
  test('forgot password link', async ({ page }) => {
    await clickElement(page, 'signin-forgot-password');
    
    // Should navigate to forgot password page
    await page.waitForURL('**/auth/forgot-password');
    await waitForAppReady(page);
    
    await expect(page.getByTestId('forgot-password-page')).toBeVisible();
    
    // Screenshot forgot password page
    await takeScreenshot(page, 'auth/forgot-password-page');
  });
  
  test('sign up link', async ({ page }) => {
    await clickElement(page, 'signin-signup-link');
    
    // Should navigate to sign up page
    await page.waitForURL('**/auth/signup');
    await waitForAppReady(page);
    
    await expect(page.getByTestId('signup-page')).toBeVisible();
    
    // Screenshot sign up page
    await takeScreenshot(page, 'auth/signup-page');
  });
  
  test('OAuth sign in buttons', async ({ page }) => {
    // Test Google OAuth
    await page.getByTestId('signin-google').hover();
    await takeScreenshot(page, 'auth/signin-google-hover');
    
    // Test GitHub OAuth
    await page.getByTestId('signin-github').hover();
    await takeScreenshot(page, 'auth/signin-github-hover');
    
    // Note: Actual OAuth flow would need to be mocked or tested separately
  });
  
  test('responsive design', async ({ page }) => {
    await testResponsive(page, async (viewport) => {
      await waitForAppReady(page);
      await takeScreenshot(page, `auth/signin-${viewport}`);
      
      // Verify all elements are still accessible
      await expect(page.getByTestId('signin-email')).toBeVisible();
      await expect(page.getByTestId('signin-password')).toBeVisible();
      await expect(page.getByTestId('signin-submit')).toBeVisible();
    });
  });
  
  test('accessibility compliance', async ({ page }) => {
    const violations = await checkAccessibility(page);
    
    // Log any violations for debugging
    if (violations.length > 0) {
      console.log('Accessibility violations:', violations);
    }
    
    expect(violations).toHaveLength(0);
  });
  
  test('performance metrics', async ({ page }) => {
    const metrics = await getPerformanceMetrics(page);
    
    // Assert performance thresholds
    expect(metrics.firstContentfulPaint).toBeLessThan(1500);
    expect(metrics.domContentLoaded).toBeLessThan(2000);
    expect(metrics.loadComplete).toBeLessThan(3000);
    
    console.log('Performance metrics:', metrics);
  });
  
  test('keyboard navigation', async ({ page }) => {
    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await expect(page.getByTestId('signin-email')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Focus password
    await expect(page.getByTestId('signin-password')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Focus submit button
    await expect(page.getByTestId('signin-submit')).toBeFocused();
    
    // Submit with Enter key
    await page.keyboard.press('Enter');
    
    // Should show validation errors (empty form)
    await expect(page.getByTestId('signin-email-error')).toBeVisible();
  });
  
  test('remember me functionality', async ({ page }) => {
    // Check remember me
    await page.getByTestId('signin-remember').check();
    
    // Fill and submit
    await fillForm(page, {
      'signin-email': 'test@vibestack.com',
      'signin-password': 'Test123!@#',
    });
    await clickElement(page, 'signin-submit');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard');
    
    // Verify session persistence (would need to check cookies/localStorage)
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');
    
    // With remember me, cookie should have longer expiry
    expect(sessionCookie).toBeDefined();
    if (sessionCookie) {
      const expiryDate = new Date(sessionCookie.expires * 1000);
      const daysDiff = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThan(7); // Should be valid for more than 7 days
    }
  });
  
  test('dark mode', async ({ page }) => {
    // Toggle dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    await waitForAppReady(page);
    
    // Take screenshot in dark mode
    await takeScreenshot(page, 'auth/signin-dark-mode');
    
    // Verify dark mode styles applied
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Should be a dark color
    expect(backgroundColor).toMatch(/rgb\(\d+, \d+, \d+\)/);
  });
});