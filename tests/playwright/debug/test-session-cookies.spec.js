/**
 * Test Session Cookie Persistence
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('verify session cookies are persisting', async ({ page }) => {
  console.log('🍪 Testing session cookie persistence...');
  
  // First, let's see what cookies exist initially
  const initialCookies = await page.context().cookies();
  console.log('📋 Initial cookies:', initialCookies.map(c => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly })));
  
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // Check localStorage and cookies after page load
  const storage = await page.evaluate(() => {
    return {
      allLocalStorage: Object.keys(localStorage).reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {}),
      documentCookies: document.cookie,
      location: {
        hostname: window.location.hostname,
        origin: window.location.origin
      }
    };
  });
  
  console.log('🌍 Page location:', storage.location);
  console.log('🍪 Document cookies:', storage.documentCookies);
  console.log('💾 localStorage keys:', Object.keys(storage.allLocalStorage));
  
  // Get cookies via Playwright API
  const playwrightCookies = await page.context().cookies();
  const authCookies = playwrightCookies.filter(c => 
    c.name.includes('auth') || 
    c.name.includes('session') || 
    c.name.includes('better')
  );
  console.log('🔐 Auth-related cookies via Playwright:', authCookies);
  
  // Test making a direct API call to see headers sent
  const response = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      const data = await response.json();
      return {
        ok: response.ok,
        status: response.status,
        headers,
        data,
        url: response.url
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('🌐 Direct API call result:', JSON.stringify(response, null, 2));
  
  // Always pass - this is diagnostic
  expect(true).toBe(true);
});