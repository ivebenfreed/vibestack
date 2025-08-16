import { test, expect } from '@playwright/test';

test('debug signin form submission', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForTimeout(1000);
  
  // Check if form exists and has correct attributes
  const form = await page.locator('form');
  const formExists = await form.count() > 0;
  console.log('Form exists:', formExists);
  
  if (formExists) {
    const formMethod = await form.getAttribute('method');
    const formAction = await form.getAttribute('action');
    console.log('Form method:', formMethod);
    console.log('Form action:', formAction);
  }
  
  // Check if submit button exists
  const submitBtn = await page.locator('[data-testid="signin-submit"]');
  const submitExists = await submitBtn.count() > 0;
  console.log('Submit button exists:', submitExists);
  
  if (submitExists) {
    const btnType = await submitBtn.getAttribute('type');
    console.log('Submit button type:', btnType);
  }
  
  // Add console log to the page to track form submission
  await page.addInitScript(() => {
    window.addEventListener('submit', (e) => {
      console.log('Form submitted, preventDefault called:', e.defaultPrevented);
    });
  });
  
  // Fill and submit
  await page.fill('[data-testid="signin-email"]', 'test@test.com');
  await page.fill('[data-testid="signin-password"]', 'password');
  
  console.log('About to click submit button...');
  await page.click('[data-testid="signin-submit"]');
  
  // Wait and check URL
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());
});