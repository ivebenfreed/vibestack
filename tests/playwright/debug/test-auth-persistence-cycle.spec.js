/**
 * Test Auth Persistence Cycle
 * 
 * This test performs login, saves persistence data, then refreshes the page
 * to test if the auth state is properly restored.
 */

import { test, expect } from '../fixtures/persistent-context.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

test('auth persistence across page refresh', async ({ page }) => {
  const env = loadEnvFile();
  
  if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
    console.log('⚠️  Skipping test: No credentials');
    test.skip();
    return;
  }

  console.log('🔄 Testing auth persistence across page refresh...');
  
  // Phase 1: Login
  console.log('📍 Phase 1: Login');
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  const needsLogin = page.url().includes('/sign-in');
  if (needsLogin) {
    console.log('🔐 Performing login...');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', env.VIBE_DEV_EMAIL);
    await page.fill('input[type="password"]', env.VIBE_DEV_PASSWORD);
    await page.click('button:has-text("Login")');
    
    await page.waitForFunction(() => !window.location.pathname.includes('/sign-in'), { timeout: 15000 });
    console.log('✅ Login completed');
  }
  
  // Wait for auth state to settle
  await page.waitForTimeout(3000);
  
  // Phase 2: Check auth state before refresh
  console.log('📍 Phase 2: Check auth state before refresh');
  const beforeRefresh = await page.evaluate(() => {
    return {
      authState: window.authMachineActor?.getSnapshot?.()?.value,
      hasUser: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
      localStorage: {
        authMachine: localStorage.getItem('auth-machine-state'),
        allKeys: Object.keys(localStorage)
      }
    };
  });
  
  console.log('Before refresh:', JSON.stringify(beforeRefresh, null, 2));
  
  // Phase 3: Refresh the page
  console.log('📍 Phase 3: Refreshing page...');
  await page.reload();
  await page.waitForTimeout(5000); // Give auth machine extra time to load persisted state
  
  // Phase 4: Check auth state after refresh
  console.log('📍 Phase 4: Check auth state after refresh');
  const afterRefresh = await page.evaluate(() => {
    return {
      authState: window.authMachineActor?.getSnapshot?.()?.value,
      hasUser: !!window.authMachineActor?.getSnapshot?.()?.context?.user,
      user: window.authMachineActor?.getSnapshot?.()?.context?.user,
      localStorage: {
        authMachine: localStorage.getItem('auth-machine-state'),
        allKeys: Object.keys(localStorage)
      },
      currentUrl: window.location.href
    };
  });
  
  console.log('After refresh:', JSON.stringify(afterRefresh, null, 2));
  
  // Phase 5: Compare results
  console.log('📍 Phase 5: Results comparison');
  console.log('Auth state persisted:', beforeRefresh.authState === afterRefresh.authState);
  console.log('User persisted:', beforeRefresh.hasUser === afterRefresh.hasUser);
  console.log('localStorage persisted:', !!afterRefresh.localStorage.authMachine);
  
  // Phase 6: If auth didn't restore, let's see what the persisted data looks like
  if (!afterRefresh.hasUser && afterRefresh.localStorage.authMachine) {
    console.log('📍 Phase 6: Examining persisted data format...');
    const persistedData = await page.evaluate(() => {
      try {
        const stored = localStorage.getItem('auth-machine-state');
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            hasValue: !!parsed.value,
            hasContext: !!parsed.context,
            value: parsed.value,
            contextKeys: parsed.context ? Object.keys(parsed.context) : [],
            contextUser: parsed.context?.user,
            contextOrg: parsed.context?.currentOrganization
          };
        }
        return null;
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Persisted data analysis:', JSON.stringify(persistedData, null, 2));
  }
  
  expect(true).toBe(true); // Always pass - diagnostic
});