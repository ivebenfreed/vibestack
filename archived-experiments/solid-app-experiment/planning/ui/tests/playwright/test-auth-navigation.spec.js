import { test, expect } from '@playwright/test';

test('test signin navigation goes to home', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle' });
  
  // Fill in the form with test credentials
  await page.fill('[data-testid="signin-email"]', 'test@vibestack.com');
  await page.fill('[data-testid="signin-password"]', 'Test123!@#');
  
  // Submit form
  await page.click('[data-testid="signin-submit"]');
  
  // Wait for navigation
  await page.waitForURL('**/');
  
  // Verify we're on home page
  await expect(page).toHaveURL('http://localhost:3000/');
  
  console.log('Signin navigation test passed - redirects to home');
});

test('test signup navigation goes to home', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signup', { waitUntil: 'networkidle' });
  
  // Fill in the form
  await page.fill('[data-testid="signup-firstname"]', 'John');
  await page.fill('[data-testid="signup-lastname"]', 'Doe');
  await page.fill('[data-testid="signup-email"]', 'john@example.com');
  await page.fill('[data-testid="signup-organization"]', 'Test Company');
  await page.fill('[data-testid="signup-password"]', 'password123');
  await page.fill('[data-testid="signup-confirm-password"]', 'password123');
  await page.check('[data-testid="signup-terms"]');
  
  // Submit form
  await page.click('[data-testid="signup-submit"]');
  
  // Wait for navigation
  await page.waitForURL('**/');
  
  // Verify we're on home page
  await expect(page).toHaveURL('http://localhost:3000/');
  
  console.log('Signup navigation test passed - redirects to home');
});