import { test as base, chromium, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Extend basic test with authentication context
export const test = base.extend<{
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
}>({
  // Authenticated context that persists across tests
  authenticatedContext: async ({ browser }, use) => {
    const authFile = path.join(__dirname, 'auth.json');
    
    let context: BrowserContext;
    
    // Check if we have saved authentication state
    if (fs.existsSync(authFile)) {
      // Create context with saved auth state
      context = await browser.newContext({
        storageState: authFile,
      });
    } else {
      // Create new context and perform login
      context = await browser.newContext();
      const page = await context.newPage();
      
      // Perform login
      await page.goto('/auth/signin');
      await page.fill('[data-testid="signin-email"]', process.env.TEST_USER_EMAIL || 'test@vibestack.com');
      await page.fill('[data-testid="signin-password"]', process.env.TEST_USER_PASSWORD || 'Test123!@#');
      await page.click('[data-testid="signin-submit"]');
      
      // Wait for successful login
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // Save authentication state
      await context.storageState({ path: authFile });
      await page.close();
    }
    
    // Use the authenticated context
    await use(context);
    
    // Clean up
    await context.close();
  },
  
  // Authenticated page
  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';

// Test user roles for role-based testing
export const testUsers = {
  owner: {
    email: 'owner@test.vibestack.com',
    password: 'Test123!@#',
    role: 'owner',
    authFile: 'auth-owner.json',
  },
  admin: {
    email: 'admin@test.vibestack.com',
    password: 'Test123!@#',
    role: 'admin',
    authFile: 'auth-admin.json',
  },
  member: {
    email: 'member@test.vibestack.com',
    password: 'Test123!@#',
    role: 'member',
    authFile: 'auth-member.json',
  },
  viewer: {
    email: 'viewer@test.vibestack.com',
    password: 'Test123!@#',
    role: 'viewer',
    authFile: 'auth-viewer.json',
  },
};

// Helper to get authenticated context for specific role
export async function getAuthenticatedContext(
  browser: Browser,
  role: keyof typeof testUsers
): Promise<BrowserContext> {
  const user = testUsers[role];
  const authFile = path.join(__dirname, user.authFile);
  
  if (fs.existsSync(authFile)) {
    // Use existing auth state
    return await browser.newContext({
      storageState: authFile,
    });
  }
  
  // Create new auth state
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('/auth/signin');
  await page.fill('[data-testid="signin-email"]', user.email);
  await page.fill('[data-testid="signin-password"]', user.password);
  await page.click('[data-testid="signin-submit"]');
  await page.waitForURL('**/dashboard');
  
  // Save role-specific auth state
  await context.storageState({ path: authFile });
  await page.close();
  
  return context;
}

// Multi-user test helper
export const multiUserTest = base.extend<{
  ownerPage: Page;
  adminPage: Page;
  memberPage: Page;
  viewerPage: Page;
}>({
  ownerPage: async ({ browser }, use) => {
    const context = await getAuthenticatedContext(browser, 'owner');
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  
  adminPage: async ({ browser }, use) => {
    const context = await getAuthenticatedContext(browser, 'admin');
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  
  memberPage: async ({ browser }, use) => {
    const context = await getAuthenticatedContext(browser, 'member');
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  
  viewerPage: async ({ browser }, use) => {
    const context = await getAuthenticatedContext(browser, 'viewer');
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});