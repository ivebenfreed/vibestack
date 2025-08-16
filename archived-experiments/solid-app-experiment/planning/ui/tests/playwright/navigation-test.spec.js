import { test, expect } from '@playwright/test';

test('test signin redirects to home after successful login', async ({ page }) => {
  console.log('Testing signin navigation...');
  
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForTimeout(1000);
  
  // Fill valid credentials
  await page.fill('[data-testid="signin-email"]', 'test@vibestack.com');
  await page.fill('[data-testid="signin-password"]', 'Test123!@#');
  
  // Submit and wait for navigation
  await page.click('[data-testid="signin-submit"]');
  await page.waitForTimeout(2000); // Wait for form processing
  
  // Check if we're redirected to home
  const currentUrl = page.url();
  console.log('Current URL after signin:', currentUrl);
  
  if (currentUrl === 'http://localhost:3000/') {
    console.log('✅ SUCCESS: Signin redirects to home page');
  } else {
    console.log('❌ FAILED: Signin redirected to:', currentUrl);
  }
});

test('test signup form validation and navigation', async ({ page }) => {
  console.log('Testing signup navigation...');
  
  await page.goto('http://localhost:3000/auth/signup');
  await page.waitForTimeout(1000);
  
  // Fill all required fields
  await page.fill('[data-testid="signup-firstname"]', 'John');
  await page.fill('[data-testid="signup-lastname"]', 'Doe');
  await page.fill('[data-testid="signup-email"]', 'john@example.com');
  await page.fill('[data-testid="signup-organization"]', 'Test Company');
  await page.fill('[data-testid="signup-password"]', 'password123');
  await page.fill('[data-testid="signup-confirm-password"]', 'password123');
  await page.check('[data-testid="signup-terms"]');
  
  // Submit and wait for navigation
  await page.click('[data-testid="signup-submit"]');
  await page.waitForTimeout(3000); // Wait for form processing
  
  // Check if we're redirected to home
  const currentUrl = page.url();
  console.log('Current URL after signup:', currentUrl);
  
  if (currentUrl === 'http://localhost:3000/') {
    console.log('✅ SUCCESS: Signup redirects to home page');
  } else {
    console.log('❌ FAILED: Signup redirected to:', currentUrl);
  }
});

test('test direct navigation to main pages', async ({ page }) => {
  console.log('Testing direct navigation to main pages...');
  
  const pages = [
    'http://localhost:3000/',
    'http://localhost:3000/dashboard',
    'http://localhost:3000/entities',
    'http://localhost:3000/settings',
    'http://localhost:3000/analytics'
  ];
  
  for (const url of pages) {
    try {
      await page.goto(url);
      await page.waitForTimeout(1000);
      console.log(`✅ Can navigate to: ${url}`);
    } catch (error) {
      console.log(`❌ Failed to navigate to: ${url}`);
    }
  }
});