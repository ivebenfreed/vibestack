import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  // Create necessary directories
  const dirs = [
    '../test-results',
    '../test-results/html',
    '../test-results/artifacts',
    '../playwright/screenshots',
    '../playwright/screenshots/baseline',
    '../playwright/screenshots/actual',
    '../playwright/screenshots/diff',
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
  
  // Set up authentication state (if needed)
  if (process.env.SETUP_AUTH) {
    console.log('🔐 Setting up authentication...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // Navigate to login page
      await page.goto(`${config.projects[0].use.baseURL}/auth/signin`);
      
      // Perform login
      await page.fill('[data-testid="signin-email"]', process.env.TEST_USER_EMAIL || 'test@vibestack.com');
      await page.fill('[data-testid="signin-password"]', process.env.TEST_USER_PASSWORD || 'Test123!@#');
      await page.click('[data-testid="signin-submit"]');
      
      // Wait for successful login
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // Save authentication state
      await page.context().storageState({ 
        path: path.join(__dirname, '../playwright/fixtures/auth.json') 
      });
      
      console.log('✅ Authentication state saved');
    } catch (error) {
      console.error('❌ Authentication setup failed:', error);
    } finally {
      await browser.close();
    }
  }
  
  // Set up test data
  if (process.env.SEED_TEST_DATA) {
    console.log('🌱 Seeding test data...');
    // Add database seeding logic here
  }
  
  // Performance baseline
  console.log('📊 Setting performance baselines...');
  const performanceBaselines = {
    FCP: 1500,  // First Contentful Paint
    LCP: 2500,  // Largest Contentful Paint
    CLS: 0.1,   // Cumulative Layout Shift
    FID: 100,   // First Input Delay
    TTI: 3500,  // Time to Interactive
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../config/performance-baselines.json'),
    JSON.stringify(performanceBaselines, null, 2)
  );
  
  // Environment info
  const envInfo = {
    baseURL: config.projects[0].use.baseURL,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    ci: !!process.env.CI,
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../test-results/environment.json'),
    JSON.stringify(envInfo, null, 2)
  );
  
  console.log('✅ Global setup completed');
  console.log('📝 Environment:', envInfo);
  
  return async () => {
    // Return a teardown function if needed
    console.log('🔄 Global teardown will run after all tests');
  };
}

export default globalSetup;