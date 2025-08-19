/**
 * Debug Authentication Context - Find what auth variables actually exist
 */
import { test, expect } from './helpers/fixtures/persistent-context.js';

test('debug auth context', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // Find ALL window variables related to auth/user/org
  const authDebug = await page.evaluate(() => {
    const windowKeys = Object.keys(window);
    const authRelated = windowKeys.filter(key => 
      key.toLowerCase().includes('user') ||
      key.toLowerCase().includes('auth') || 
      key.toLowerCase().includes('org') ||
      key.toLowerCase().includes('session') ||
      key.toLowerCase().includes('current')
    );
    
    const authValues = {};
    authRelated.forEach(key => {
      try {
        const value = window[key];
        if (value && typeof value === 'object') {
          authValues[key] = {
            type: 'object',
            keys: Object.keys(value),
            hasId: !!value.id,
            hasEmail: !!value.email,
            id: value.id,
            email: value.email
          };
        } else {
          authValues[key] = value;
        }
      } catch (e) {
        authValues[key] = 'error accessing';
      }
    });
    
    return {
      allAuthRelatedKeys: authRelated,
      authValues,
      totalWindowKeys: windowKeys.length
    };
  });
  
  console.log('🔍 AUTH CONTEXT DEBUG:');
  console.log(`Total window keys: ${authDebug.totalWindowKeys}`);
  console.log(`Auth-related keys found: ${authDebug.allAuthRelatedKeys.join(', ')}`);
  console.log('Auth values:', JSON.stringify(authDebug.authValues, null, 2));
});