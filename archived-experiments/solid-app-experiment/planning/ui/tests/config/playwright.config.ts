import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const PORT = process.env.PORT || 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  // Test directory
  testDir: '../playwright',
  
  // Test match patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  // Global timeout
  timeout: 30 * 1000,
  
  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporting
  reporter: [
    ['html', { outputFolder: '../test-results/html' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['junit', { outputFile: '../test-results/junit.xml' }],
    ['list'],
    ...(process.env.CI ? [['github']] : [])
  ],
  
  // Shared test configuration
  use: {
    // Base URL
    baseURL,
    
    // Trace and debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Navigation
    navigationTimeout: 10 * 1000,
    actionTimeout: 10 * 1000,
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
    
    // Color scheme
    colorScheme: 'light',
    
    // Test ID attribute
    testIdAttribute: 'data-testid',
  },
  
  // Projects for different browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    
    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    
    // Tablet devices
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },
    
    // Dark mode testing
    {
      name: 'chromium-dark',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1920, height: 1080 }
      },
    },
    
    // Accessibility testing
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Slow down actions for accessibility testing
        actionTimeout: 20 * 1000,
      },
    },
  ],
  
  // Output folder for test artifacts
  outputDir: '../test-results/artifacts',
  
  // Global setup and teardown
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
  
  // Web server configuration
  webServer: {
    command: 'pnpm dev',
    port: Number(PORT),
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
    },
  },
  
  // Expect configuration
  expect: {
    // Maximum time expect() should wait for the condition
    timeout: 5000,
    
    // Configure snapshot matching
    toHaveScreenshot: {
      // Threshold for pixel differences
      maxDiffPixels: 100,
      threshold: 0.2,
      
      // Animation handling
      animations: 'disabled',
      
      // Clip to viewport
      fullPage: false,
    },
  },
  
  // Preserve test artifacts
  preserveOutput: 'failures-only',
  
  // Quiet mode in CI
  quiet: !!process.env.CI,
});