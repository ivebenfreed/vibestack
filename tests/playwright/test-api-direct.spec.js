/**
 * Test API directly with actual browser session
 */

import { test } from './helpers/fixtures/persistent-context.js';

test.describe('API Session Test', () => {
  test('extract session token and test API', async ({ page }) => {
  console.log('🔍 Going to root and extracting session info...');
  
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // Get all cookies
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'better-auth.session_token');
  
  console.log('🍪 Session cookie found:', !!sessionCookie);
  if (sessionCookie) {
    console.log('   Domain:', sessionCookie.domain);
    console.log('   Value length:', sessionCookie.value.length);
    console.log('   HttpOnly:', sessionCookie.httpOnly);
    console.log('   Secure:', sessionCookie.secure);
  }
  
  // Test API call with session
  if (sessionCookie) {
    const apiResponse = await page.evaluate(async (cookieValue) => {
      try {
        console.log('🔄 Making API call...');
        const response = await fetch('/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/schema', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        console.log('📡 Response received:', response.status);
        
        const responseData = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: null
        };
        
        if (response.headers.get('content-type')?.includes('json')) {
          responseData.body = await response.json();
        } else {
          responseData.body = await response.text();
        }
        
        return responseData;
      } catch (error) {
        console.error('❌ API call error:', error);
        return { error: error.message, stack: error.stack };
      }
    }, sessionCookie.value);
    
    console.log('📡 API Response:');
    console.log('   Status:', apiResponse.status);
    console.log('   Error:', apiResponse.error);
    console.log('   Body:', JSON.stringify(apiResponse.body, null, 2));
  }
  });
});