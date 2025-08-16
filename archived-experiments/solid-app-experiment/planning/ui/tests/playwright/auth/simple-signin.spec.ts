import { test, expect } from '@playwright/test';

test.describe('Simple Sign In Test', () => {
  test('can load sign in page', async ({ page }) => {
    // Navigate to sign in page
    await page.goto('/auth/signin');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="signin-card"]', { timeout: 10000 });
    
    // Check that sign in elements are visible
    await expect(page.getByTestId('signin-title')).toBeVisible();
    await expect(page.getByTestId('signin-title')).toHaveText('Sign In');
    
    // Check form fields
    await expect(page.getByTestId('signin-email')).toBeVisible();
    await expect(page.getByTestId('signin-password')).toBeVisible();
    await expect(page.getByTestId('signin-submit')).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ path: 'signin-page.png', fullPage: true });
    
    console.log('✅ Sign in page loaded successfully');
  });
  
  test('can fill and submit sign in form', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForSelector('[data-testid="signin-card"]');
    
    // Fill in the form
    await page.fill('[data-testid="signin-email"]', 'test@vibestack.com');
    await page.fill('[data-testid="signin-password"]', 'Test123!@#');
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'signin-filled.png' });
    
    // Submit the form
    await page.click('[data-testid="signin-submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    
    // Verify we're on the dashboard
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByTestId('user-menu')).toBeVisible();
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'dashboard-after-login.png', fullPage: true });
    
    console.log('✅ Sign in successful');
  });
  
  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForSelector('[data-testid="signin-card"]');
    
    // Click submit without filling form
    await page.click('[data-testid="signin-submit"]');
    
    // Check for validation errors
    await expect(page.getByTestId('signin-email-error')).toBeVisible();
    await expect(page.getByTestId('signin-email-error')).toHaveText('Email is required');
    
    await expect(page.getByTestId('signin-password-error')).toBeVisible();
    await expect(page.getByTestId('signin-password-error')).toHaveText('Password is required');
    
    // Take screenshot of validation errors
    await page.screenshot({ path: 'signin-validation-errors.png' });
    
    console.log('✅ Validation errors displayed correctly');
  });
  
  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForSelector('[data-testid="signin-card"]');
    
    // Fill with wrong credentials
    await page.fill('[data-testid="signin-email"]', 'wrong@vibestack.com');
    await page.fill('[data-testid="signin-password"]', 'WrongPassword');
    
    // Submit
    await page.click('[data-testid="signin-submit"]');
    
    // Wait for error toast
    await page.waitForSelector('[data-testid="toast-error"]', { timeout: 3000 });
    
    // Check error message
    await expect(page.getByTestId('toast-error')).toHaveText('Invalid email or password');
    
    // Should still be on sign in page
    expect(page.url()).toContain('/auth/signin');
    
    // Take screenshot
    await page.screenshot({ path: 'signin-invalid-credentials.png' });
    
    console.log('✅ Invalid credentials error shown');
  });
});