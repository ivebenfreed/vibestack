import { test, expect } from '@playwright/test';

test('debug app loading', async ({ page }) => {
  const errors = [];
  const logs = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    logs.push(`[${type}] ${text}`);
    if (type === 'error') {
      errors.push(text);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
    errors.push(error.message);
  });
  
  // Navigate to the app
  console.log('Navigating to http://localhost:5173/');
  const response = await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  console.log('Response status:', response?.status());
  
  // Wait for potential async errors
  await page.waitForTimeout(3000);
  
  // Check what's visible
  const bodyText = await page.textContent('body');
  console.log('Body text:', bodyText || '(empty)');
  
  // Check if root element exists and has content
  const rootInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      exists: !!root,
      innerHTML: root?.innerHTML || '',
      childCount: root?.children.length || 0
    };
  });
  console.log('Root element:', rootInfo);
  
  // Check for React app
  const hasReactApp = await page.evaluate(() => {
    return !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
  });
  console.log('React detected:', hasReactApp);
  
  // Print all logs
  if (logs.length > 0) {
    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
  }
  
  if (errors.length > 0) {
    console.log('\n=== ERRORS FOUND ===');
    errors.forEach(err => console.log(err));
  }
  
  // Take screenshot
  await page.screenshot({ path: '/home/ben-freed/dev/vibestack/screenshots/debug-app.png', fullPage: true });
  console.log('Screenshot saved to screenshots/debug-app.png');
});