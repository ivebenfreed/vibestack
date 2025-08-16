import { test, expect } from '@playwright/test';

test('debug data table loading', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  console.log('Navigating to entities page...');
  await page.goto('http://localhost:3000/entities');
  await page.waitForTimeout(2000);
  
  console.log('Current URL:', page.url());
  
  // Check if page content exists
  const pageContent = await page.content();
  console.log('Page contains "Entity Management":', pageContent.includes('Entity Management'));
  console.log('Page contains "Loading entities":', pageContent.includes('Loading entities'));
  console.log('Page contains "table":', pageContent.includes('<table'));
  
  // Wait longer and check again
  await page.waitForTimeout(5000);
  
  const updatedContent = await page.content();
  console.log('After 5 seconds - Page contains "table":', updatedContent.includes('<table'));
  
  // Check network requests
  const responses = [];
  page.on('response', response => {
    responses.push(`${response.status()} ${response.url()}`);
  });
  
  await page.reload();
  await page.waitForTimeout(3000);
  
  console.log('Network responses:', responses.filter(r => r.includes('entities')));
});