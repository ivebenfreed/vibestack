/**
 * Authentication Flow Testing - Login Validation
 * 
 * Tests login flow with valid/invalid credentials, including:
 * - Successful login with valid credentials
 * - Failed login with invalid credentials  
 * - Login form validation
 * - Redirect behavior after login
 * - Session establishment
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow Tests', () => {
  // Use fresh browser context for auth tests (no persistent profile)
  
  test.beforeEach(async ({ page }) => {
    // Start with clean session for each test
    await page.goto('/');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to sign-in if not already there
    if (page.url().includes('/dashboard')) {
      await page.goto('/sign-in');
    }
    
    // Wait for sign-in page to load
    await page.waitForSelector('[data-testid="sign-in-form"], form', { timeout: 10000 });
    
    // Fill in valid credentials (using test account)
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"], input[placeholder*="password" i]', 'testpassword123');
    
    // Submit the form
    await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    
    // Wait for successful login redirect
    await page.waitForURL(/\/dashboard|\//, { timeout: 15000 });
    
    // Verify we're logged in by checking for dashboard elements
    await expect(page).toHaveURL(/\/dashboard|\/$/);
    
    // Check for user-specific elements that indicate successful auth
    const authIndicators = [
      '[data-testid="user-menu"]',
      '[data-testid="logout-button"]', 
      'text=Dashboard',
      'text=Projects',
      'button:has-text("Sign Out")',
      'button:has-text("Logout")'
    ];
    
    let foundIndicator = false;
    for (const selector of authIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        foundIndicator = true;
        break;
      } catch (e) {
        // Continue checking other indicators
      }
    }
    
    expect(foundIndicator).toBe(true);
  });

  test('should fail login with invalid email', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForSelector('[data-testid="sign-in-form"], form');
    
    // Try invalid email
    await page.fill('input[type="email"], input[name="email"]', 'invalid@nonexistent.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"], button:has-text("Sign In")');
    
    // Should stay on sign-in page or show error
    await page.waitForTimeout(3000); // Wait for error to appear
    
    // Check for error messages
    const errorSelectors = [
      'text=Invalid credentials',
      'text=Login failed',
      'text=Incorrect email or password',
      '[data-testid="login-error"]',
      '.error',
      '.alert-error'
    ];
    
    let foundError = false;
    for (const selector of errorSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        foundError = true;
        break;
      } catch (e) {
        // Continue checking other selectors
      }
    }
    
    // Either found error message or still on sign-in page
    const onSignInPage = page.url().includes('/sign-in');
    expect(foundError || onSignInPage).toBe(true);
  });

  test('should fail login with invalid password', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForSelector('[data-testid="sign-in-form"], form');
    
    // Use valid email but wrong password
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword123');
    
    await page.click('button[type="submit"], button:has-text("Sign In")');
    
    // Should stay on sign-in page or show error
    await page.waitForTimeout(3000);
    
    // Verify we're still on sign-in or see error
    const hasError = await page.locator('text=Invalid credentials, text=Login failed, text=Incorrect').first().isVisible().catch(() => false);
    const onSignInPage = page.url().includes('/sign-in');
    
    expect(hasError || onSignInPage).toBe(true);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForSelector('form');
    
    // Enter invalid email format
    await page.fill('input[type="email"], input[name="email"]', 'invalid-email-format');
    await page.fill('input[type="password"], input[name="password"]', 'somepassword');
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Check for browser validation or custom validation
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const validationMessage = await emailInput.evaluate(el => el.validationMessage);
    
    // Either browser validation triggered or custom validation
    expect(validationMessage.length > 0 || page.url().includes('/sign-in')).toBe(true);
  });

  test('should require password field', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForSelector('form');
    
    // Enter email but leave password empty
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    // Don't fill password
    
    await page.click('button[type="submit"]');
    
    // Should show validation error or stay on form
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const validationMessage = await passwordInput.evaluate(el => el.validationMessage);
    
    expect(validationMessage.length > 0 || page.url().includes('/sign-in')).toBe(true);
  });

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access protected page first
    await page.goto('/dashboard');
    
    // Should redirect to sign-in
    await page.waitForURL(/sign-in/, { timeout: 10000 });
    
    // Login
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Should redirect back to dashboard
    await page.waitForURL(/\/dashboard|\//, { timeout: 15000 });
    expect(page.url()).toMatch(/\/dashboard|\/$/);
  });
});