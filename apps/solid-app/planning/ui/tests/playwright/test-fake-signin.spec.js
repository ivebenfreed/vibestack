import { test, expect } from '@playwright/test';

test('test fake signin with any input', async ({ page }) => {
  console.log('Testing fake signin with any input...');
  
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForTimeout(1000);
  
  // Fill with any random input
  await page.fill('[data-testid="signin-email"]', 'anything@example.com');
  await page.fill('[data-testid="signin-password"]', 'any-password');
  
  // Submit and wait for navigation
  await page.click('[data-testid="signin-submit"]');
  await page.waitForTimeout(2000);
  
  // Check if we're redirected to home
  const currentUrl = page.url();
  console.log('Current URL after fake signin:', currentUrl);
  
  if (currentUrl === 'http://localhost:3000/') {
    console.log('✅ SUCCESS: Fake signin redirects to app home!');
  } else {
    console.log('❌ FAILED: Still on:', currentUrl);
  }
});

test('test fake signup with minimal input', async ({ page }) => {
  console.log('Testing fake signup with minimal input...');
  
  await page.goto('http://localhost:3000/auth/signup');
  await page.waitForTimeout(1000);
  
  // Fill with minimal input
  await page.fill('[data-testid="signup-email"]', 'test@test.com');
  
  // Submit and wait for navigation
  await page.click('[data-testid="signup-submit"]');
  await page.waitForTimeout(3000);
  
  // Check if we're redirected to home
  const currentUrl = page.url();
  console.log('Current URL after fake signup:', currentUrl);
  
  if (currentUrl === 'http://localhost:3000/') {
    console.log('✅ SUCCESS: Fake signup redirects to app home!');
  } else {
    console.log('❌ FAILED: Still on:', currentUrl);
  }
});