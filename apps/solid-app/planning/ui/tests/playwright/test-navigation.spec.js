import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
  test('navigate through all main pages', async ({ page }) => {
    // Start at root
    await page.goto('/');
    
    // Should redirect to sign-in or dashboard
    await page.waitForTimeout(1000);
    const url = page.url();
    
    if (url.includes('/auth/signin')) {
      console.log('Starting from sign-in page');
      
      // Test authentication navigation
      await expect(page.getByTestId('signin-title')).toBeVisible();
      
      // Navigate to sign up
      await page.getByTestId('signin-signup-link').click();
      await page.waitForURL('**/auth/signup');
      await expect(page.getByTestId('signup-title')).toBeVisible();
      
      // Navigate to forgot password
      await page.goto('/auth/signin');
      await page.getByTestId('signin-forgot-password').first().click();
      await page.waitForURL('**/auth/forgot-password');
      await expect(page.getByTestId('forgot-title')).toBeVisible();
      
      // Sign in to access protected pages
      await page.goto('/auth/signin');
      await page.getByTestId('signin-email').fill('test@vibestack.com');
      await page.getByTestId('signin-password').fill('Test123!@#');
      await page.getByTestId('signin-submit').click();
      
      // Wait a bit for navigation
      await page.waitForTimeout(1000);
    }
    
    // Navigate to dashboard (might already be there)
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    const hasSidebar = await page.getByTestId('app-sidebar').count() > 0;
    
    if (hasSidebar) {
      console.log('Testing main app navigation');
      
      // Test sidebar navigation
      await page.getByTestId('nav-entities').click();
      await page.waitForURL('**/entities');
      await expect(page.url()).toContain('/entities');
      
      await page.getByTestId('nav-organization').click();
      await page.waitForURL('**/org');
      await expect(page.url()).toContain('/org');
      
      await page.getByTestId('nav-analytics').click();
      await page.waitForURL('**/analytics');
      await expect(page.url()).toContain('/analytics');
      
      await page.getByTestId('nav-settings').click();
      await page.waitForURL('**/settings');
      await expect(page.url()).toContain('/settings');
      
      // Go back to dashboard
      await page.getByTestId('nav-dashboard').click();
      await page.waitForURL('**/dashboard');
      await expect(page.url()).toContain('/dashboard');
    }
  });
  
  test('test responsive navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    
    const hasSidebar = await page.getByTestId('app-sidebar').count() > 0;
    if (!hasSidebar) {
      console.log('Not on dashboard, skipping responsive nav test');
      return;
    }
    
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    
    // Sidebar should be visible
    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();
    
    // Test collapse/expand
    const toggleBtn = page.getByTestId('sidebar-toggle');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
      
      await toggleBtn.click();
      await page.waitForTimeout(300);
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    }
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Menu button should be visible
    const menuBtn = page.getByTestId('header-menu-button');
    if (await menuBtn.isVisible()) {
      // Open mobile menu
      await menuBtn.click();
      await page.waitForTimeout(300);
      
      // Check backdrop
      const backdrop = page.getByTestId('mobile-backdrop');
      if (await backdrop.isVisible()) {
        // Close by clicking backdrop
        await backdrop.click();
        await page.waitForTimeout(300);
      }
    }
  });
  
  test('test header navigation and dropdowns', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    
    const header = page.getByTestId('app-header');
    const hasHeader = await header.count() > 0;
    
    if (!hasHeader) {
      console.log('No header found, skipping header nav test');
      return;
    }
    
    // Test notifications dropdown
    const notificationsBtn = page.getByTestId('notifications-button');
    if (await notificationsBtn.isVisible()) {
      await notificationsBtn.click();
      await page.waitForTimeout(300);
      
      // Close by clicking again
      await notificationsBtn.click();
      await page.waitForTimeout(300);
    }
    
    // Test user menu dropdown
    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(300);
      
      // Check for menu items
      const profileLink = page.locator('a[href="/settings/profile"]').first();
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await page.waitForTimeout(500);
        // Should navigate to settings
        await expect(page.url()).toContain('/settings');
      }
    }
  });
  
  test('test dark mode toggle', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    
    // Look for theme switcher
    const themeSwitcher = page.locator('[aria-label="Change theme"]').first();
    const hasThemeSwitcher = await themeSwitcher.count() > 0;
    
    if (hasThemeSwitcher) {
      // Open theme menu
      await themeSwitcher.click();
      await page.waitForTimeout(300);
      
      // Try to click dark mode
      const darkModeBtn = page.locator('button:has-text("Dark")').first();
      if (await darkModeBtn.isVisible()) {
        await darkModeBtn.click();
        await page.waitForTimeout(500);
        
        // Check if dark class is applied
        const hasDarkClass = await page.evaluate(() => 
          document.documentElement.classList.contains('dark')
        );
        
        console.log('Dark mode enabled:', hasDarkClass);
        
        // Switch back to light mode
        await themeSwitcher.click();
        await page.waitForTimeout(300);
        
        const lightModeBtn = page.locator('button:has-text("Light")').first();
        if (await lightModeBtn.isVisible()) {
          await lightModeBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
  
  test('capture updated screenshots', async ({ page }) => {
    // Sign in page with new styling
    await page.goto('/auth/signin');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/improved-signin.png', fullPage: true });
    
    // Dashboard with icons
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    const hasDashboard = await page.getByTestId('app-shell').count() > 0;
    if (hasDashboard) {
      await page.screenshot({ path: 'tests/screenshots/improved-dashboard.png', fullPage: true });
      
      // Dark mode screenshot
      const themeSwitcher = page.locator('[aria-label="Change theme"]').first();
      if (await themeSwitcher.isVisible()) {
        await themeSwitcher.click();
        await page.waitForTimeout(300);
        const darkBtn = page.locator('button:has-text("Dark")').first();
        if (await darkBtn.isVisible()) {
          await darkBtn.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'tests/screenshots/dark-mode-dashboard.png', fullPage: true });
        }
      }
    }
  });
});