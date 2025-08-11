/**
 * Persistent Context Fixture
 * 
 * This fixture provides a persistent browser context that maintains
 * login state across test runs. Each worktree gets its own profile.
 */

import { test as base, expect } from '@playwright/test';

// Export the base test with persistent context already configured
// The playwright.config.js handles the persistent context setup
export const test = base;
export { expect };